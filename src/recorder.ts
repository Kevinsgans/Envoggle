import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import { VideoBufferType, type AudioFrame, type VideoFrame } from '@livekit/rtc-node';

// Records a call for the demo video when ENVOGGLE_RECORD_DIR is set: every frame of each incoming
// video track and of the referee's tile, streamed into ffmpeg (H.264, near lossless, constant 30 fps on
// the wall clock), plus each incoming audio track and the referee's voice as raw PCM. manifest.json holds
// each file's start time so scripts/render-recording.mjs can line everything up afterwards.
type Entry = { file: string; kind: 'video' | 'audio'; name: string; startedAt: number; width?: number; height?: number; sampleRate?: number; channels?: number; dropped?: number };

const FPS = 30;
// Up to this many frames may wait in the pipe to ffmpeg; past that, frames are skipped (the timeline
// still holds: the next frame written fills the gap).
const QUEUE_FRAMES = 45;

// One video track as a constant 30 fps file on the wall clock: each slot of 1/30 s gets the newest frame
// that had arrived by then, and a gap repeats the previous frame, so a late or bunched frame never
// shifts the timing.
class VideoWriter {
  private process?: ChildProcess;
  private size = '';
  private segment = 0;
  private written = 0;
  private last?: Buffer;
  private entry?: Entry;

  constructor(private readonly recorder: Recorder, private readonly name: string) {}

  write(frame: VideoFrame) {
    const i420 = frame.type === VideoBufferType.I420 ? frame : frame.convert(VideoBufferType.I420);
    const size = `${i420.width}x${i420.height}`;
    if (size !== this.size) this.open(i420.width, i420.height);
    const stdin = this.process?.stdin;
    if (!stdin?.writable || !this.entry) return;
    const due = Math.floor((Date.now() - this.entry.startedAt) * FPS / 1000) + 1;
    if (due <= this.written) return;
    const bytes = Buffer.from(i420.data.buffer, i420.data.byteOffset, i420.data.byteLength);
    if (stdin.writableLength > QUEUE_FRAMES * bytes.length) {
      this.entry.dropped = (this.entry.dropped ?? 0) + 1;
      return;
    }
    // Hold the previous frame through any gap, then show this one in its own slot.
    const hold = this.last ? due - this.written - 1 : 0;
    for (let index = 0; index < hold; index++) stdin.write(this.last);
    stdin.write(Buffer.from(bytes));
    this.last = Buffer.from(bytes);
    this.written = due;
  }

  private open(width: number, height: number) {
    this.close();
    this.size = `${width}x${height}`;
    this.segment++;
    this.written = 0;
    this.last = undefined;
    const file = `${this.name}-${this.segment}.mkv`;
    this.entry = this.recorder.add({ file, kind: 'video', name: this.name, startedAt: Date.now(), width, height });
    this.process = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'yuv420p',
      '-s', this.size, '-framerate', String(FPS), '-i', 'pipe:0',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', join(this.recorder.dir, file)],
    { stdio: ['pipe', 'ignore', 'inherit'] });
    this.process.on('error', () => console.error('[envoggle] Recording needs ffmpeg on the PATH'));
    this.process.stdin?.on('error', () => {});
  }

  close() {
    this.process?.stdin?.end();
    this.process = undefined;
  }
}

class AudioWriter {
  private stream?: WriteStream;
  private written = 0;
  private entry?: Entry;

  // `padGaps`: the referee's voice comes in bursts; silence fills the gaps so it stays on the wall clock.
  constructor(private readonly recorder: Recorder, private readonly name: string, private readonly padGaps: boolean) {}

  write(frame: AudioFrame) {
    if (!this.stream) {
      const file = `${this.name}.s16le`;
      this.entry = this.recorder.add({ file, kind: 'audio', name: this.name, startedAt: Date.now(), sampleRate: frame.sampleRate, channels: frame.channels });
      this.stream = createWriteStream(join(this.recorder.dir, file));
    }
    if (frame.sampleRate !== this.entry!.sampleRate || frame.channels !== this.entry!.channels) return;
    if (this.padGaps) {
      const due = Math.floor((Date.now() - this.entry!.startedAt) / 1000 * frame.sampleRate);
      if (due > this.written) {
        this.stream.write(Buffer.alloc((due - this.written) * 2 * frame.channels));
        this.written = due;
      }
    }
    this.stream.write(Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength));
    this.written += frame.samplesPerChannel;
  }

  close() { this.stream?.end(); }
}

export class Recorder {
  readonly entries: Entry[] = [];
  private readonly videos = new Map<string, VideoWriter>();
  private readonly audios = new Map<string, AudioWriter>();

  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
    console.info('[envoggle] Recording this call to', dir);
  }

  static start(room: string) {
    const root = process.env.ENVOGGLE_RECORD_DIR;
    if (!root) return undefined;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return new Recorder(join(root, `${stamp}-${room.replace(/[^\w-]/g, '_')}`));
  }

  add(entry: Entry) {
    this.entries.push(entry);
    this.save();
    return entry;
  }

  video(name: string, frame: VideoFrame) {
    let writer = this.videos.get(name);
    if (!writer) this.videos.set(name, writer = new VideoWriter(this, name));
    try { writer.write(frame); } catch { /* never let recording break the call */ }
  }

  audio(name: string, frame: AudioFrame, padGaps = false) {
    let writer = this.audios.get(name);
    if (!writer) this.audios.set(name, writer = new AudioWriter(this, name, padGaps));
    try { writer.write(frame); } catch { /* never let recording break the call */ }
  }

  close() {
    this.videos.forEach(writer => writer.close());
    this.audios.forEach(writer => writer.close());
    this.save();
  }

  private save() {
    try { writeFileSync(join(this.dir, 'manifest.json'), JSON.stringify({ entries: this.entries }, null, 2)); } catch { /* ignore */ }
  }
}

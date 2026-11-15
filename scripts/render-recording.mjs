#!/usr/bin/env node
// Lines up a recorded call (ENVOGGLE_RECORD_DIR) into one video for editing.
// Usage: node scripts/render-recording.mjs <recording folder> [out.mp4]
// Output: the call feed (both players) on the left, the referee's tile on the right, at 30 fps,
// with the call audio and the referee's voice mixed. The raw files in the folder stay untouched.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out = join(process.argv[2] ?? '.', 'demo.mp4')] = process.argv.slice(2);
if (!dir) {
  console.error('Usage: node scripts/render-recording.mjs <recording folder> [out.mp4]');
  process.exit(1);
}
const { entries } = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const start = Math.min(...entries.map(entry => entry.startedAt));
const probe = file => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout.toString()) || 0;
const end = Math.max(...entries.map(entry => {
  const file = join(dir, entry.file);
  const length = entry.kind === 'audio'
    ? (readFileSync(file).length / 2 / entry.channels / entry.sampleRate)
    : probe(file);
  return (entry.startedAt - start) / 1000 + length;
}));

// Canvas: call feed 1920x1080 on the left, referee tile (9:16) 608x1080 on the right.
const height = 1080;
const panes = [{ prefix: 'call-p', x: 0, width: 1920 }, { prefix: 'referee', x: 1920, width: 608 }];
const args = ['-hide_banner', '-y', '-f', 'lavfi', '-i', `color=c=black:s=2528x${height}:r=30:d=${end.toFixed(3)}`];
const filters = [];
let base = '[0:v]';
let input = 1;
const audio = [];
entries.forEach((entry, index) => {
  const offset = ((entry.startedAt - start) / 1000).toFixed(3);
  if (entry.kind === 'audio') {
    args.push('-f', 's16le', '-ar', String(entry.sampleRate), '-ac', String(entry.channels), '-i', join(dir, entry.file));
    filters.push(`[${input}:a]adelay=${Math.round(offset * 1000)}:all=1,aresample=48000[a${index}]`);
    audio.push(`[a${index}]`);
  } else {
    const pane = panes.find(candidate => entry.name.startsWith(candidate.prefix));
    if (!pane) return;
    args.push('-i', join(dir, entry.file));
    filters.push(`[${input}:v]setpts=PTS-STARTPTS+${offset}/TB,scale=${pane.width}:${height}:force_original_aspect_ratio=decrease,pad=${pane.width}:${height}:(ow-iw)/2:(oh-ih)/2[v${index}]`);
    filters.push(`${base}[v${index}]overlay=${pane.x}:0:eof_action=pass[b${index}]`);
    base = `[b${index}]`;
  }
  input++;
});
filters.push(`${base}null[vout]`);
if (audio.length) filters.push(`${audio.join('')}amix=inputs=${audio.length}:normalize=0:duration=longest[aout]`);
args.push('-filter_complex', filters.join(';'), '-map', '[vout]');
if (audio.length) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-t', end.toFixed(3), out);
const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (result.status === 0) console.log('Wrote', out);
process.exit(result.status ?? 1);

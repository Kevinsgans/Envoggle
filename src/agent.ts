import { fileURLToPath } from 'node:url';
import { AutoSubscribe, ServerOptions, cli, defineAgent, stt, tts } from '@livekit/agents';
import { beta as gemini } from '@livekit/agents-plugin-google';
import { STT, TTS } from '@livekit/agents-plugin-openai';
import {
  AudioFrame, AudioSource, AudioStream, LocalAudioTrack, LocalVideoTrack, RoomEvent, TrackKind, TrackPublishOptions,
  TrackSource, VideoBufferType, VideoFrame, VideoRotation, VideoSource, VideoStream,
} from '@livekit/rtc-node';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import type { Duel } from './duel.js';

type State = ReturnType<Duel['state']>;
type Camera = { frame: VideoFrame; timestamp: number; rotation: VideoRotation };
const address = process.env.ENVOGGLE_SERVER_URL ?? 'http://127.0.0.1:3000';
const frameAge = 1000;
const slots = [0, 1];
const matchers = [1, 2].map(number => ({
  identity: process.env[`CHERT_PLAYER_${number}_IDENTITY_PREFIX`],
  audio: process.env[`CHERT_PLAYER_${number}_AUDIO_TRACK`],
  video: process.env[`CHERT_PLAYER_${number}_VIDEO_TRACK`],
}));
// Without CHERT_PLAYER_* settings, each remote participant becomes the next free player slot.
const autoAssign = !matchers.some(matcher => matcher.identity || matcher.audio || matcher.video);
// Words the players say to the referee, to bias Gemini transcription.
const vocabulary = ['Envoggle', 'start', 'start and save my frame', 'rematch'];
// In a Group FaceTime call, Chert (beta.21) sends one capture of its FaceTime window with player 1
// in the left tile and player 2 in the right tile. The window size varies, so the tiles are found
// in each checked frame: the widest band of lit rows, split into exactly two similar lit column spans.
type Tile = { left: number; right: number; top: number; bottom: number };
function findTiles(data: Buffer, width: number, height: number, channels: number): Tile[] | undefined {
  const lit = (x: number, y: number) => data[(y * width + x) * channels] > 8;
  const runs = (values: number[], test: (value: number) => boolean, min: number) => {
    const found: [number, number][] = [];
    let start = -1;
    values.forEach((value, index) => {
      if (test(value) && start < 0) start = index;
      if (!test(value) && start >= 0) { if (index - start >= min) found.push([start, index - 1]); start = -1; }
    });
    if (start >= 0 && values.length - start >= min) found.push([start, values.length - 1]);
    return found;
  };
  const rows = Array.from({ length: height }, (_, y) => { let count = 0; for (let x = 0; x < width; x++) if (lit(x, y)) count++; return count; });
  const peak = Math.max(...rows);
  if (peak < width * 0.15) return undefined;
  const band = runs(rows, count => count >= peak * 0.6, height * 0.15).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
  if (!band) return undefined;
  const [top, bottom] = band;
  const columns = Array.from({ length: width }, (_, x) => { let count = 0; for (let y = top; y <= bottom; y++) if (lit(x, y)) count++; return count / (bottom - top + 1); });
  const spans = runs(columns, share => share > 0.5, width * 0.08);
  if (spans.length !== 2) return undefined;
  const [a, b] = spans.map(([start, end]) => end - start + 1);
  if (Math.min(a, b) / Math.max(a, b) < 0.7 || spans[1][0] - spans[0][1] > width * 0.1) return undefined;
  // Inset by 1% to skip the tiles' rounded corners.
  return spans.map(([start, end]) => ({ left: start / width + 0.01, right: (end + 1) / width - 0.01, top: top / height + 0.01, bottom: (bottom + 1) / height - 0.01 }));
}
// Lock both players this long before the server's deadline, which rejects later locks.
const captureLead = 900;

const tileWidth = 720;
const tileHeight = 1280;

function wrap(value: string, chars: number) {
  const lines: string[] = [];
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const last = lines.length - 1;
    if (last >= 0 && (lines[last] + ' ' + word).length <= chars) lines[last] += ' ' + word;
    else lines.push(word.slice(0, chars));
  }
  return lines;
}

function bridgeReady(metadata: string | undefined) {
  try { return JSON.parse(metadata || '{}')?.chert_bridge_ready === true; } catch { return false; }
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!);
}

export default defineAgent({
  entry: async context => {
    const key = process.env.REFEREE_KEY;
    // Speech uses OpenAI when OPENAI_API_KEY is set, otherwise Gemini with GEMINI_API_KEY.
    const openai = Boolean(process.env.OPENAI_API_KEY);
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!key || (!openai && !geminiKey)) throw new Error('REFEREE_KEY and GEMINI_API_KEY (or OPENAI_API_KEY) are required');
    const room = context.room;
    const cameras = new Map<number, Camera>();
    const videoTracks = new Map<number, string>();
    const audioTracks = new Map<number, string>();
    const stopReaders = new Map<string, () => void>();
    const autoSlots = new Map<string, number>();
    // Voice: OpenAI when OPENAI_API_KEY is set; otherwise the Mac's built-in `say` (free, no quota;
    // free-tier Gemini speech allows only 10 requests a day). ENVOGGLE_VOICE=gemini forces Gemini.
    const localVoice = !openai && process.platform === 'darwin' && process.env.ENVOGGLE_VOICE !== 'gemini';
    const speaker: tts.TTS | undefined = openai
      ? new TTS({ model: 'gpt-4o-mini-tts', voice: 'alloy' })
      : localVoice ? undefined : new gemini.TTS({ apiKey: geminiKey, voiceName: 'Puck' });
    const listener: stt.STT = openai
      ? new STT({ model: 'gpt-4o-mini-transcribe', useRealtime: true, language: 'en' })
      : new gemini.GeminiSTT({ apiKey: geminiKey, language: 'en-US', sampleRate: 16000, customVocabulary: vocabulary });
    const listenRate = openai ? 24000 : 16000;
    console.info('[envoggle] Speech:', openai ? 'OpenAI' : localVoice ? 'Gemini listening, Mac voice' : 'Gemini', 'Players:', autoAssign ? 'auto-assigned by participant' : 'from CHERT_PLAYER_* settings');
    const voiceRate = 24000;
    const audio = new AudioSource(speaker?.sampleRate ?? voiceRate, speaker?.numChannels ?? 1);
    const video = new VideoSource(tileWidth, tileHeight);
    const output = new AbortController();
    let code = '';
    let states: State[] = [];
    let caption = 'Waiting for two player feeds';
    let spokenCaption = '';
    let lastImageKey = '';
    let speech = Promise.resolve();
    let pendingStatus = false;
    let ticking = false;
    let tickTimer: ReturnType<typeof setInterval> | undefined;
    let lastCountdown = '';
    let creating = false;
    let lastCreate = 0;
    let layoutSeen = 0;
    let layoutLogged = 0;
    let tiles: Tile[] = [];
    let layoutChecked = 0;
    let capturedRound = -1;
    let captureTimer: ReturnType<typeof setTimeout> | undefined;

    async function api(slot: number, action: string, body?: object | Buffer, round?: number): Promise<State> {
      const query = new URLSearchParams({ slot: String(slot) });
      if (round !== undefined) query.set('round', String(round));
      const response = await fetch(`${address}/api/duels/${code}/${action}?${query}`, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': Buffer.isBuffer(body) ? 'image/jpeg' : 'application/json' },
        body: Buffer.isBuffer(body) ? new Uint8Array(body) : body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(3000),
      });
      // The challenge is gone (expired or server restarted): make a new one on the next tick.
      if (response.status === 404) code = '';
      if (!response.ok) throw new Error(`Referee request failed with HTTP ${response.status}`);
      return response.json();
    }

    // Renders speech with macOS `say` to 16-bit mono PCM and plays it in 20 ms frames.
    async function speakLocally(text: string) {
      const file = join(tmpdir(), `envoggle-${randomUUID()}.wav`);
      try {
        await promisify(execFile)('say', ['-o', file, '--file-format=WAVE', `--data-format=LEI16@${voiceRate}`, text]);
        const wav = await readFile(file);
        let offset = 12;
        while (offset + 8 <= wav.length && wav.toString('ascii', offset, offset + 4) !== 'data') offset += 8 + wav.readUInt32LE(offset + 4);
        const start = offset + 8;
        const samples = new Int16Array(wav.buffer.slice(wav.byteOffset + start, wav.byteOffset + start + Math.floor((wav.length - start) / 2) * 2));
        const step = voiceRate / 50;
        for (let index = 0; index < samples.length && !output.signal.aborted; index += step) {
          const chunk = new Int16Array(step);
          chunk.set(samples.subarray(index, index + step));
          await audio.captureFrame(new AudioFrame(chunk, voiceRate, 1, step));
        }
      } finally { await rm(file, { force: true }); }
    }

    function say(text: string) {
      if (output.signal.aborted) return;
      speech = speech.then(async () => {
        if (output.signal.aborted) return;
        if (!speaker) return speakLocally(text);
        const stream = speaker.synthesize(text, undefined, output.signal);
        try { for await (const sound of stream) await audio.captureFrame(sound.frame); }
        finally { stream.close(); }
      }).catch(() => { if (!output.signal.aborted) console.error('[envoggle] Referee speech failed'); });
    }

    // Split mode: one bridge feed showing the two-tile group layout (seen within the last 3 s).
    // Both players then come from that feed and its mixed audio.
    const split = () => autoAssign && videoTracks.size === 1 && cameras.has(0) && Date.now() - layoutSeen < 3000;
    const freshCamera = (slot: number) => Date.now() - (cameras.get(slot)?.timestamp ?? 0) <= frameAge;
    const fresh = (slot: number) => freshCamera(split() ? 0 : slot);
    const readyMedia = () => split()
      ? freshCamera(0) && audioTracks.size > 0
      : slots.every(slot => fresh(slot) && audioTracks.has(slot));

    // Checks at most twice a second whether the single feed shows the two-tile group layout.
    async function checkLayout() {
      const camera = cameras.get(0);
      if (!autoAssign || videoTracks.size !== 1 || !camera || Date.now() - layoutChecked < 500) return;
      layoutChecked = Date.now();
      const rgba = camera.frame.convert(VideoBufferType.RGBA);
      const { data, info } = await sharp(rgba.data, { raw: { width: rgba.width, height: rgba.height, channels: 4 } })
        .resize(320, 180, { fit: 'fill' }).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
      const found = findTiles(data, info.width, info.height, info.channels);
      if (!found && process.env.ENVOGGLE_DEBUG_FRAMES && Date.now() - layoutLogged > 5000) {
        layoutLogged = Date.now();
        const profile = Array.from({ length: 15 }, (_, row) => {
          let count = 0;
          for (let x = 0; x < info.width; x++) if (data[(row * 12 * info.width + x) * info.channels] > 8) count++;
          return count;
        });
        console.info('[envoggle] No two-tile layout in', rgba.width, 'x', rgba.height, 'channels', info.channels, 'lit per row', profile.join(' '));
      }
      if (found) {
        tiles = found;
        if (!split()) console.info('[envoggle] Two-tile group layout found in a', rgba.width, 'x', rgba.height, 'feed');
        layoutSeen = Date.now();
      }
    }

    // A JPEG of the player's current view: their tile in split mode, otherwise their whole frame.
    async function capture(slot: number) {
      const splitting = split();
      const camera = cameras.get(splitting ? 0 : slot)!;
      const rgba = camera.frame.convert(VideoBufferType.RGBA);
      const image = sharp(rgba.data, { raw: { width: rgba.width, height: rgba.height, channels: 4 } });
      if (splitting) {
        const tile = tiles[slot];
        const left = Math.round(tile.left * rgba.width);
        const top = Math.round(tile.top * rgba.height);
        return image.extract({ left, top, width: Math.round(tile.right * rgba.width) - left, height: Math.round(tile.bottom * rgba.height) - top })
          .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true }).jpeg().toBuffer();
      }
      return image.rotate([0, 90, 180, 270][camera.rotation] ?? 0).resize({ width: 720, height: 720, fit: 'inside' }).jpeg().toBuffer();
    }

    // Locks both players' current views just before time runs out. A player without a fresh view gets no lock.
    async function captureAll(round: number) {
      const state = states[0];
      if (output.signal.aborted || state?.phase !== 'hunt' || state.round !== round) return;
      await Promise.all(slots.map(async slot => {
        if (!fresh(slot)) return;
        try { await api(slot, 'lock', await capture(slot), round); }
        catch { console.warn('[envoggle] Could not capture player', slot + 1); }
      }));
    }

    // Creates and accepts a challenge for this call once both players are on camera, so no one
    // has to read out an invite code.
    async function createChallenge() {
      const created = await fetch(`${address}/api/duels`, { method: 'POST', signal: AbortSignal.timeout(3000) });
      if (!created.ok) throw new Error(`Challenge creation failed with HTTP ${created.status}`);
      const { code: next } = await created.json() as { code: string };
      const accepted = await fetch(`${address}/api/duels/${next}/accept`, { method: 'POST', signal: AbortSignal.timeout(3000) });
      if (!accepted.ok) throw new Error(`Challenge acceptance failed with HTTP ${accepted.status}`);
      code = next;
      const state = await api(0, 'state');
      say(state.retentionEnabled && !split()
        ? 'Both players are in. Vision training is optional. Envoggle may license or sell confirmed images and labels to third parties for vision model training. Say start to play, or say start and save my frame to opt in.'
        : 'Both players are in. Say start to play.');
    }

    async function command(slot: number, transcript: string) {
      const words = transcript.trim().replace(/[.!?]+$/, '').toLowerCase().replace(/[’']/g, '');
      if (!code) return;
      const first = states[0];
      if (!first) return;
      // Either player starts the round (or a rematch) for both.
      if (/\b(start|ready|rematch)\b/.test(words) && ['lobby', 'result', 'void'].includes(first.phase) && readyMedia()) {
        const retain = !split() && words.includes('save my frame');
        for (const player of slots) if (!first.ready[player]) await api(player, 'ready', { retain: retain && player === slot });
        return;
      }
    }

    function slotFor(identity: string, track: string | undefined, kind: 'audio' | 'video') {
      if (autoAssign) {
        let slot = autoSlots.get(identity);
        if (slot === undefined) {
          slot = slots.find(free => ![...autoSlots.values()].includes(free));
          if (slot === undefined) return undefined;
          autoSlots.set(identity, slot);
          console.info('[envoggle] Player', slot + 1, 'is participant', JSON.stringify(identity));
        }
        return slot;
      }
      const matches = matchers.map((matcher, slot) => ({ matcher, slot })).filter(({ matcher }) =>
        matcher[kind] && matcher[kind] === track && (!matcher.identity || identity.startsWith(matcher.identity)));
      return matches.length === 1 ? matches[0].slot : undefined;
    }

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      const kind = track.kind === TrackKind.KIND_VIDEO ? 'video' : track.kind === TrackKind.KIND_AUDIO ? 'audio' : undefined;
      if (!kind || !publication.sid) return;
      console.info('[envoggle] Media track:', kind, JSON.stringify(publication.name), 'bridge:', participant.identity.startsWith('chert-bridge-'));
      const slot = slotFor(participant.identity, publication.name, kind);
      if (slot === undefined || stopReaders.has(publication.sid)) return;
      const sid = publication.sid;
      const mapped = kind === 'video' ? videoTracks : audioTracks;
      if (mapped.has(slot)) {
        if (autoAssign) console.warn('[envoggle] Participant', JSON.stringify(participant.identity), 'sent a second', kind, 'track. If one participant carries both players, set the CHERT_PLAYER_* track names.');
        return;
      }
      mapped.set(slot, sid);
      if (kind === 'video') {
        const reader = new VideoStream(track).getReader();
        stopReaders.set(sid, () => { void reader.cancel().catch(() => {}); });
        void (async () => {
          while (!output.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!publication.muted && videoTracks.get(slot) === sid) cameras.set(slot, { frame: value.frame, rotation: value.rotation, timestamp: Date.now() });
          }
        })().catch(() => console.error('[envoggle] Video subscription ended')).finally(() => {
          if (videoTracks.get(slot) === sid) {
            videoTracks.delete(slot);
            cameras.delete(slot);
          }
          stopReaders.delete(sid);
        });
      } else {
        const reader = new AudioStream(track, { sampleRate: listenRate, numChannels: 1 }).getReader();
        const transcription = listener.stream();
        stopReaders.set(sid, () => { void reader.cancel().catch(() => {}); transcription.close(); });
        void (async () => {
          while (!output.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!publication.muted) transcription.pushFrame(value);
          }
        })().catch(() => console.error('[envoggle] Audio subscription ended')).finally(() => transcription.close());
        void (async () => {
          for await (const event of transcription) {
            const text = event.alternatives?.[0]?.text;
            if (event.type !== stt.SpeechEventType.FINAL_TRANSCRIPT || !text) continue;
            try { await command(slot, text); }
            catch { console.warn('[envoggle] Referee command could not be applied'); }
          }
        })().catch(() => console.error('[envoggle] Transcription ended')).finally(() => {
          stopReaders.get(sid)?.();
          stopReaders.delete(sid);
          if (audioTracks.get(slot) === sid) audioTracks.delete(slot);
        });
      }
    });

    const stopTrack = (sid?: string) => { if (sid) stopReaders.get(sid)?.(); };
    room.on(RoomEvent.TrackUnsubscribed, (_track, publication) => stopTrack(publication.sid));
    room.on(RoomEvent.TrackMuted, publication => {
      for (const [slot, sid] of videoTracks) if (sid === publication.sid) cameras.delete(slot);
    });
    room.on(RoomEvent.ParticipantDisconnected, participant => { autoSlots.delete(participant.identity); });

    // Chert ends a call that hears no agent audio within 10 s of bridge_ready, which chert dev
    // signals in the room metadata. Greet once on that signal, never just because someone joined.
    let greeted = false;
    const greet = () => {
      if (greeted || !bridgeReady(room.metadata)) return;
      greeted = true;
      say(readyMedia()
        ? 'Envoggle referee here.'
        : 'Envoggle referee here. Waiting for both players to join with their rear cameras on.');
    };
    room.on(RoomEvent.RoomMetadataChanged, greet);

    await context.connect(undefined, AutoSubscribe.SUBSCRIBE_ALL);
    const publisher = room.localParticipant;
    if (!publisher) throw new Error('Referee participant unavailable');
    await publisher.publishTrack(LocalAudioTrack.createAudioTrack('envoggle-referee-voice', audio), new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }));
    await publisher.publishTrack(LocalVideoTrack.createVideoTrack('envoggle-scoreboard', video), new TrackPublishOptions({ source: TrackSource.SOURCE_CAMERA }));
    greet();

    let still: VideoFrame | undefined;
    async function scoreboard() {
      const first = states[0];
      let title = 'ENVOGGLE';
      let detail = caption;
      const rows: string[] = [];
      if (first) {
        title = first.prompt;
        const seconds = Math.max(0, Math.ceil((first.deadline - Date.now()) / 1000));
        if (first.phase === 'hunt') {
          detail = `${seconds}s · Hold up your find`;
          if (seconds === 5 && lastCountdown !== `${first.round}:5`) {
            lastCountdown = `${first.round}:5`;
            say('Five seconds. Hold your find up to the camera.');
          }
          rows.push(...first.locked.map((locked, slot) => `Player ${slot + 1} · ${locked ? 'Captured' : 'Hunting'}`));
        } else if (first.results) {
          const [a, b] = first.results;
          detail = a.points === b.points ? 'Draw' : `Player ${a.points > b.points ? 1 : 2} wins`;
          rows.push(...first.results.map((result, slot) => `Player ${slot + 1} · ${result.label} · ${result.points} pts`));
        } else detail = first.message || caption;
      }
      const key = JSON.stringify([title, detail, rows]);
      if (key !== lastImageKey) {
        // Portrait tile. FaceTime crops it to fill the screen or a group tile, so all text stays
        // centered inside the middle safe area (about 560 x 720 px) and wraps instead of running off.
        const blocks = [
          { lines: wrap(title, 16).slice(0, 2), size: 56, gap: 36, weight: 700 },
          { lines: wrap(detail, 22).slice(0, 2), size: 40, gap: 44, weight: 400 },
          ...rows.map(row => ({ lines: wrap(row, 32).slice(0, 2), size: 34, gap: 16, weight: 400 })),
        ];
        const bar = 40;
        const height = bar + blocks.reduce((sum, item) => sum + item.lines.length * item.size * 1.2 + item.gap, 0);
        let y = (tileHeight - height) / 2;
        let body = `<rect x="${(tileWidth - 240) / 2}" y="${y}" width="240" height="8" fill="#A9EFC3"/>`;
        y += bar;
        for (const item of blocks) {
          body += item.lines.map(part => {
            y += item.size * 1.2;
            return `<text x="${tileWidth / 2}" y="${y - item.size * 0.25}" text-anchor="middle" fill="#F0F4F7" font-family="Helvetica, Arial, sans-serif" font-weight="${item.weight}" font-size="${item.size}">${escapeXml(part)}</text>`;
          }).join('');
          y += item.gap;
        }
        const svg = `<svg width="${tileWidth}" height="${tileHeight}"><rect width="${tileWidth}" height="${tileHeight}" fill="#111a25"/>${body}</svg>`;
        const pixels = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
        still = new VideoFrame(pixels, tileWidth, tileHeight, VideoBufferType.RGBA);
        lastImageKey = key;
      }
      if (still && !output.signal.aborted) video.captureFrame(still);
    }

    async function tick() {
      if (ticking || output.signal.aborted) return;
      ticking = true;
      try {
        await checkLayout();
        if (!code) {
          if (readyMedia()) {
            caption = 'Setting up the round';
            if (!creating && Date.now() - lastCreate > 5000) {
              creating = true;
              lastCreate = Date.now();
              void createChallenge().catch(() => console.warn('[envoggle] Could not create a challenge'))
                .finally(() => { creating = false; });
            }
          } else caption = 'Waiting for two player feeds';
        } else if (!pendingStatus) {
          pendingStatus = true;
          void Promise.all(slots.map(slot => api(slot, 'state'))).then(async next => {
            if (output.signal.aborted) return;
            states = next;
            const [first] = next;
            if (first.phase === 'hunt' && !readyMedia()) await api(0, 'drop', {});
            let announcement = '';
            if (first.phase === 'hunt') {
              announcement = `${first.prompt}. Find the rarest thing you can and hold it up when time runs out. Go!`;
              if (capturedRound !== first.round) {
                capturedRound = first.round;
                clearTimeout(captureTimer);
                captureTimer = setTimeout(() => void captureAll(first.round), Math.max(0, first.deadline - first.serverTime - captureLead));
              }
            }
            caption = ['confirm', 'scoring'].includes(first.phase) ? 'Scoring both finds' : 'Say “start” to play';
            if (first.results) {
              const [a, b] = first.results;
              announcement = `Player one: ${a.label}, ${a.points} points. ${a.reason} Player two: ${b.label}, ${b.points} points. ${b.reason} ${a.points === b.points ? 'A draw.' : `Player ${a.points > b.points ? 'one' : 'two'} wins.`}`;
            }
            if (first.phase === 'void') announcement = first.message;
            const identifier = `${first.round}:${first.phase}:${announcement}`;
            if (announcement && identifier !== spokenCaption) {
              spokenCaption = identifier;
              say(announcement);
            }
          }).catch(() => console.warn('[envoggle] Could not sync duel state')).finally(() => { pendingStatus = false; });
        }
        await scoreboard();
      } finally { ticking = false; }
    }

    tickTimer = setInterval(() => void tick().catch(() => console.error('[envoggle] Scoreboard update failed')), 200);
    // Debug only: with ENVOGGLE_DEBUG_FRAMES set to a folder, save each player's current frame every 2 s.
    const debugFrames = process.env.ENVOGGLE_DEBUG_FRAMES;
    const debugTimer = debugFrames ? setInterval(() => {
      const stamp = Date.now();
      for (const slot of slots) {
        if (fresh(slot)) void capture(slot).then(jpeg => writeFile(`${debugFrames}/${room.name}-p${slot + 1}-${stamp}.jpg`, jpeg)).catch(() => {});
      }
      const window = split() ? cameras.get(0) : undefined;
      if (window) {
        const rgba = window.frame.convert(VideoBufferType.RGBA);
        void sharp(rgba.data, { raw: { width: rgba.width, height: rgba.height, channels: 4 } })
          .resize({ width: 720 }).jpeg().toFile(`${debugFrames}/${room.name}-window-${stamp}.jpg`).catch(() => {});
      }
    }, 2000) : undefined;
    context.addShutdownCallback(async () => clearInterval(debugTimer));
    context.addShutdownCallback(async () => {
      clearInterval(tickTimer);
      clearTimeout(captureTimer);
      output.abort();
      stopReaders.forEach(stop => stop());
      if (code && states[0]?.phase === 'hunt') await api(0, 'drop', {}).catch(() => {});
      await Promise.allSettled([speaker?.close(), listener.close(), audio.close(), video.close()]);
    });
  },
});

if (process.argv.includes('--check-media-config')) {
  const valid = matchers.every(matcher => matcher.audio && matcher.video) &&
    (matchers[0].audio !== matchers[1].audio || matchers[0].identity !== matchers[1].identity) &&
    (matchers[0].video !== matchers[1].video || matchers[0].identity !== matchers[1].identity);
  if (!valid) {
    console.error('[envoggle] Configure two independently attributable audio and video sources before starting a duel.');
    process.exitCode = 1;
  }
} else {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: process.env.AGENT_NAME || 'envoggle-referee' }));
}

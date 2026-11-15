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
import { readFileSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { FINAL_COUNTDOWN_MS, HuntClock } from './countdown.js';
import type { Duel } from './duel.js';
import { focusProgress, scanProgress, type Photo } from './find-visual.js';
import { GROUP_CALL_JOB, GROUP_REFEREE } from './group-call.js';
import { findTiles, type Tile } from './layout.js';
import { RoomServiceClient } from 'livekit-server-sdk';
import { Recorder } from './recorder.js';
import { COUNT_UP_MS } from './score-display.js';
import { DEFAULT_NAMES, TILE_HEIGHT, TILE_WIDTH, renderTile, type View } from './tile.js';

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
const vocabulary = ['Envoggle', 'start', 'start and save my frame', 'skip', 'my name is'];
// Lock both players this long before the server's deadline, which rejects later locks.
const captureLead = 900;

const tileWidth = TILE_WIDTH;
const tileHeight = TILE_HEIGHT;
// How long the last round's reveal shows before the final scores screen.
const FINAL_AFTER_MS = 12_000;
// A player has left when FaceTime has shown one person full-screen this long; the call then ends.
const LEFT_AFTER_MS = 5_000;
// No "continue": the next round starts on its own this long after a reveal (or a void round).
const NEXT_ROUND_MS = 10_000;
const REPLAY_MS = 5_000;

// Names vs ordinary words, from the macOS dictionaries: a word counts as a name if it is a listed
// first name or not an ordinary lowercase word at all.
// This drops misheard words like "good" or "focus". Without the dictionaries every word passes.
function readWords(path: string) {
  try { return new Set(readFileSync(path, 'utf8').split('\n')); } catch { return new Set<string>(); }
}
// ENVOGGLE_DICT_DIR points elsewhere on Linux, where these files are not installed (copy the Mac's).
const dictDir = process.env.ENVOGGLE_DICT_DIR ?? '/usr/share/dict';
const firstNames = readWords(`${dictDir}/propernames`);
const dictionary = readWords(`${dictDir}/words`);
const nameWords = new Set(['rose', 'ava', 'kai', 'luna', 'aria', 'ivy', 'lily', 'hope', 'faith', 'joy', 'june', 'river', 'sky', 'jade', 'pearl', 'ruby', 'summer', 'autumn', 'dawn', 'maya', 'ming', 'grant', 'chase', 'hunter', 'mark', 'bill', 'pat', 'max', 'jack', 'drew', 'art', 'gene', 'ray', 'rich', 'jay', 'dean']);
const notNames = new Set(['the', 'guys', 'bro', 'things', 'okay', 'nice', 'skip', 'envoggle', 'wave', 'yeah', 'yep', 'nope', 'hmm', 'lets', 'thats', 'whats', 'dont', 'cant', 'wont', 'didnt', 'isnt', 'youre', 'theyre', 'ive', 'ill', 'gonna', 'wanna', 'gotta', 'kinda', 'lol']);
function isName(word: string) {
  if (word.length < 2 || notNames.has(word)) return false;
  const capital = word[0].toUpperCase() + word.slice(1);
  return nameWords.has(word) || firstNames.has(capital) || !dictionary.has(word);
}

// Turns "hi, my name is alex" into "Alex". Listens only for names: short phrases whose words,
// after greetings and fillers, include a name. Returns undefined for anything else.
function parseName(words: string) {
  const rest = words.replace(/[^a-z\s-]/g, ' ').replace(/\b(hi|hey|hello|yo|so|um|uh|okay|ok|my name is|my names|name is|names|i am|im|its|this is|call me|and|i)\b/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!rest.length || rest.length > 3) return undefined;
  const name = rest.find(isName);
  return name ? (name[0].toUpperCase() + name.slice(1)).slice(0, 12) : undefined;
}

function bridgeReady(metadata: string | undefined) {
  try { return JSON.parse(metadata || '{}')?.chert_bridge_ready === true; } catch { return false; }
}

export default defineAgent({
  entry: async context => {
    const key = process.env.REFEREE_KEY;
    // Speech uses OpenAI when OPENAI_API_KEY is set, otherwise Gemini with GEMINI_API_KEY.
    const openai = Boolean(process.env.OPENAI_API_KEY);
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!key || (!openai && !geminiKey)) throw new Error('REFEREE_KEY and GEMINI_API_KEY (or OPENAI_API_KEY) are required');
    const room = context.room;
    const outboundGroup = context.job.metadata === GROUP_CALL_JOB;
    const cameras = new Map<number, Camera>();
    const videoTracks = new Map<number, string>();
    const audioTracks = new Map<number, string>();
    const stopReaders = new Map<string, () => void>();
    const autoSlots = new Map<string, number>();
    // Voice: OpenAI when OPENAI_API_KEY is set; otherwise a local voice (free, no quota; free-tier
    // Gemini speech allows only 10 requests a day): the Mac's built-in `say`, or on Linux Piper with the
    // voice model in ENVOGGLE_PIPER_MODEL. ENVOGGLE_VOICE=gemini forces Gemini.
    const piperModel = process.env.ENVOGGLE_PIPER_MODEL;
    const localVoice = !openai && (process.platform === 'darwin' || Boolean(piperModel)) && process.env.ENVOGGLE_VOICE !== 'gemini';
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
    // Demo recording (ENVOGGLE_RECORD_DIR): starts once FaceTime is connected (bridge ready), so the
    // idle waiting room between calls is never recorded.
    let recorder: Recorder | undefined | null = null;
    const rec = () => {
      if (recorder === null && bridgeReady(room.metadata)) recorder = Recorder.start(room.name || 'call');
      return recorder ?? undefined;
    };
    const speak = (frame: AudioFrame) => {
      rec()?.audio('referee-voice', frame, true);
      return audio.captureFrame(frame);
    };
    let code = '';
    let states: State[] = [];
    let caption = 'Waiting for two player feeds';
    let spokenCaption = '';
    let autoAdvance = '';
    let lastImageKey = '';
    let finalShown: { id: string; at: number } | undefined;
    let syncedAt = 0;
    let speech = Promise.resolve();
    let pendingStatus = false;
    let lastStatusCheck = 0;
    const huntClock = new HuntClock();
    let countClock: { startedAt: number; elapsed: number } | undefined;
    let ticking = false;
    let tickTimer: ReturnType<typeof setTimeout> | undefined;
    let lastCountdown = '';
    let creating = false;
    let lastCreate = 0;
    let layoutSeen = 0;
    // When FaceTime started showing one person full-screen (after the two-tile layout): someone left.
    let aloneSince = 0;
    let layoutLogged = 0;
    let tiles: Tile[] = [];
    let layoutChecked = 0;
    let capturedRound = -1;
    let captureTimer: ReturnType<typeof setTimeout> | undefined;
    // Names: once both players are on camera, the referee listens for names only. The first name
    // heard is Orange (player 1), the second Blue. The names screen shows each player's live camera in their colour box.
    const names: (string | undefined)[] = [undefined, undefined];
    let namingStarted = 0;
    let namingDone = false;
    let previews: (Buffer | undefined)[] = [undefined, undefined];
    let previewedAt = 0;
    let photoRound: { id: string; photos: (Photo | undefined)[]; pending: boolean[]; retryAt: number[] } | undefined;
    const shown = () => names.map((name, slot) => name ?? DEFAULT_NAMES[slot]);

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

    function refreshPhotos(state: State) {
      if (!code || (state.phase !== 'scoring' && state.phase !== 'result')) {
        photoRound = undefined;
        return;
      }
      const id = `${code}:${state.round}`;
      if (photoRound?.id !== id) photoRound = { id, photos: [], pending: [], retryAt: [] };
      const current = photoRound;
      for (const slot of slots) {
        if (!state.locked[slot] || current.photos[slot] || current.pending[slot] || Date.now() < (current.retryAt[slot] ?? 0)) continue;
        current.pending[slot] = true;
        void fetch(`${address}/api/duels/${code}/frame?slot=${slot}&player=${slot}&round=${state.round}`, {
          headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(3000),
        }).then(async response => {
          if (!response.ok || current !== photoRound) return;
          const frame = Buffer.from(await response.arrayBuffer());
          const { width, height } = await sharp(frame).metadata();
          current.photos[slot] = { href: `data:image/jpeg;base64,${frame.toString('base64')}`, width, height };
        }).catch(() => {}).finally(() => {
          current.pending[slot] = false;
          current.retryAt[slot] = Date.now() + 1000;
        });
      }
    }

    // Renders speech to a 16-bit mono WAV (macOS `say`, else Piper), resamples it to voiceRate if
    // needed, and plays it in 20 ms frames.
    async function speakLocally(text: string) {
      const file = join(tmpdir(), `envoggle-${randomUUID()}.wav`);
      try {
        if (process.platform === 'darwin' && !piperModel) {
          await promisify(execFile)('say', ['-o', file, '--file-format=WAVE', `--data-format=LEI16@${voiceRate}`, text]);
        } else {
          await new Promise<void>((resolve, reject) => {
            const piper = execFile(process.env.ENVOGGLE_PIPER ?? 'piper', ['-m', piperModel!, '-f', file], error => error ? reject(error) : resolve());
            piper.stdin?.end(text);
          });
        }
        const wav = await readFile(file);
        let offset = 12;
        let rate = voiceRate;
        while (offset + 8 <= wav.length && wav.toString('ascii', offset, offset + 4) !== 'data') {
          if (wav.toString('ascii', offset, offset + 4) === 'fmt ') rate = wav.readUInt32LE(offset + 12);
          offset += 8 + wav.readUInt32LE(offset + 4);
        }
        const start = offset + 8;
        const source = new Int16Array(wav.buffer.slice(wav.byteOffset + start, wav.byteOffset + start + Math.floor((wav.length - start) / 2) * 2));
        // Linear resampling (Piper voices are 22,050 Hz).
        const samples = rate === voiceRate ? source : Int16Array.from({ length: Math.floor(source.length * voiceRate / rate) }, (_, index) => {
          const position = index * rate / voiceRate;
          const low = Math.floor(position);
          const high = Math.min(source.length - 1, low + 1);
          return Math.round(source[low] + (source[high] - source[low]) * (position - low));
        });
        const step = voiceRate / 50;
        for (let index = 0; index < samples.length && !output.signal.aborted; index += step) {
          const chunk = new Int16Array(step);
          chunk.set(samples.subarray(index, index + step));
          await speak(new AudioFrame(chunk, voiceRate, 1, step));
        }
      } finally { await rm(file, { force: true }); }
    }

    function say(text: string) {
      if (output.signal.aborted) return;
      speech = speech.then(async () => {
        if (output.signal.aborted) return;
        if (!speaker) return speakLocally(text);
        const stream = speaker.synthesize(text, undefined, output.signal);
        try { for await (const sound of stream) await speak(sound.frame); }
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
      // One person full-screen lights far more of the frame (about 37%) than two tiles (11 to 22%); a
      // covered or dark camera lights less, so it never counts as someone leaving.
      let lit = 0;
      for (let index = 0; index < data.length; index += info.channels) if (data[index] > 8) lit++;
      const alone = !found && layoutSeen > 0 && lit / (info.width * info.height) > 0.3;
      aloneSince = alone ? aloneSince || Date.now() : 0;
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
        try {
          const jpeg = await capture(slot);
          await api(slot, 'lock', jpeg, round);
        }
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
      if (state.retentionEnabled && !split()) {
        say('Both players are in. Vision training is optional. Envoggle may license or sell confirmed images and labels to third parties for vision model training. Say start to play, or say start and save my frame to opt in.');
        return;
      }
      // No start screen: round 1 begins as soon as the names are in.
      for (const player of slots) await api(player, 'ready', { retain: false });
    }

    async function command(slot: number, transcript: string) {
      const words = transcript.trim().replace(/[.!?]+$/, '').toLowerCase().replace(/[’']/g, '');
      if (namingStarted && !namingDone) {
        if (/\b(skip|start|ready)\b/.test(words)) { namingDone = true; return; }
        const name = parseName(words);
        // Only names count: the first name heard is player 1 (Orange), the second is player 2 (Blue).
        const target = names.findIndex(known => !known);
        if (!name) { console.info('[envoggle] Not a name, ignored:', JSON.stringify(words)); return; }
        if (target < 0) return;
        names[target] = name;
        console.info('[envoggle] Player', target + 1, 'is named', JSON.stringify(name));
        const next = names.findIndex(known => !known);
        say(next < 0 ? `Hi ${name}.` : `Hi ${name}. ${DEFAULT_NAMES[next]}, say your name.`);
        if (next < 0) namingDone = true;
        return;
      }
      if (!code) return;
      const first = states[0];
      if (!first) return;
      // "Start" is only for the opt-in lobby; rounds after the first start on their own.
      if (/\b(start|ready)\b/.test(words) && first.phase === 'lobby' && readyMedia()) {
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
            rec()?.video(`call-p${slot + 1}`, value.frame);
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
        // The recording gets its own full-rate copy of the call audio (speech recognition uses 16 kHz).
        const recording = process.env.ENVOGGLE_RECORD_DIR ? new AudioStream(track, { sampleRate: 48000, numChannels: 1 }).getReader() : undefined;
        stopReaders.set(sid, () => { void reader.cancel().catch(() => {}); void recording?.cancel().catch(() => {}); transcription.close(); });
        if (recording) void (async () => {
          while (!output.signal.aborted) {
            const { value, done } = await recording.read();
            if (done) break;
            rec()?.audio(`call-audio-p${slot + 1}`, value);
          }
        })().catch(() => {});
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
    // When someone leaves, end the call for everyone: closing the LiveKit room disconnects the Chert
    // bridge, which hangs up FaceTime.
    let hangingUp = false;
    async function hangUp(reason: string) {
      if (hangingUp) return;
      hangingUp = true;
      console.info('[envoggle] Ending the call:', reason);
      const { LIVEKIT_URL: url, LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret } = process.env;
      try {
        if (!url || !key || !secret) throw new Error('LiveKit keys missing');
        await new RoomServiceClient(url, key, secret, { requestTimeout: 5 }).deleteRoom(room.name!);
      } catch (error) {
        console.warn('[envoggle] Could not close the room:', error instanceof Error ? error.message : '');
        context.shutdown('player left');
      }
    }
    room.on(RoomEvent.ParticipantDisconnected, participant => {
      const player = autoSlots.has(participant.identity);
      autoSlots.delete(participant.identity);
      if (player && bridgeReady(room.metadata)) void hangUp('a player left');
    });

    // Chert ends a call that hears no agent audio within 10 s of bridge_ready, which chert dev
    // signals in the room metadata. Greet once on that signal, never just because someone joined.
    let greeted = false;
    const greet = () => {
      if (greeted || !bridgeReady(room.metadata)) return;
      greeted = true;
      say('Envoggle referee here.');
    };
    room.on(RoomEvent.RoomMetadataChanged, greet);

    await context.connect(undefined, AutoSubscribe.SUBSCRIBE_ALL);
    const publisher = room.localParticipant;
    if (!publisher) throw new Error('Referee participant unavailable');
    await publisher.publishTrack(LocalAudioTrack.createAudioTrack('envoggle-referee-voice', audio), new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }));
    await publisher.publishTrack(LocalVideoTrack.createVideoTrack('envoggle-scoreboard', video), new TrackPublishOptions({ source: TrackSource.SOURCE_CAMERA }));
    greet();

    let still: VideoFrame | undefined;
    function view(): View {
      const first = states[0];
      const players = shown();
      if (!code || !first) {
        if (!readyMedia()) return { kind: 'waiting', present: [cameras.size > 0, false] };
        if (!namingDone) return { kind: 'names', names: [...names], turn: Math.max(0, names.findIndex(known => !known)), frames: previews };
        return { kind: 'message', title: 'Setting up the round', detail: 'One moment' };
      }
      if (first.phase === 'hunt') {
        const remainingMs = huntClock.remaining();
        const countdownId = `${code}:${first.round}`;
        if (remainingMs > 0 && remainingMs <= FINAL_COUNTDOWN_MS && lastCountdown !== countdownId) {
          lastCountdown = countdownId;
          say('Five seconds. Hold it up.');
        }
        return { kind: 'hunt', names: players, prompt: first.prompt, remainingMs: Math.round(remainingMs), locked: first.locked };
      }
      const photos = photoRound?.id === `${code}:${first.round}` ? photoRound.photos : [];
      const presentation = first.presentation;
      const finds = presentation?.finds;
      if (first.phase === 'scoring') {
        const now = first.serverTime + Date.now() - syncedAt;
        const focusAt = presentation?.focusStartedAt;
        const countUp = presentation?.countUp;
        if (countUp) {
          const elapsed = Math.min(COUNT_UP_MS, now - countUp.startedAt);
          const previous = countClock?.startedAt === countUp.startedAt ? countClock.elapsed : 0;
          countClock = { startedAt: countUp.startedAt, elapsed: Math.max(elapsed, previous) };
        }
        return { kind: 'scoring', names: players, prompt: first.prompt, photos, finds,
          focus: countUp ? 1 : focusAt === undefined ? 0 : focusProgress(now - focusAt),
          scan: focusAt === undefined && presentation ? scanProgress(now - presentation.scanStartedAt) : undefined,
          countUp: countUp && countClock ? { elapsed: countClock.elapsed, targets: countUp.targets } : undefined };
      }
      if (first.phase === 'confirm') return { kind: 'message', title: 'Identifying finds', detail: 'One moment' };
      if (first.results && first.completed) {
        // After the last round: its reveal for a few seconds, then the final scores.
        const id = `${code}:${first.round}`;
        if (finalShown?.id !== id) finalShown = { id, at: Date.now() };
        if (Date.now() - finalShown.at > FINAL_AFTER_MS) return { kind: 'final', names: players, history: first.history, totals: first.totalScores };
        return { kind: 'reveal', names: players, prompt: first.prompt, results: first.results, photos, finds, last: true };
      }
      if (first.results) return { kind: 'reveal', names: players, prompt: first.prompt, results: first.results, photos, finds };
      if (first.phase === 'void') return { kind: 'message', title: 'Round void', detail: `${first.message} Replaying in a few seconds.` };
      return { kind: 'ready', names: players, prompt: first.prompt };
    }

    async function scoreboard() {
      const first = states[0];
      const currentCode = code;
      const next = view();
      const key = JSON.stringify(next, (name, value) => {
        if (name === 'frames') return previewedAt;
        if (name === 'photos') return [photoRound?.id, (value as unknown[]).map(Boolean)];
        return value;
      });
      if (key !== lastImageKey) {
        const pixels = await sharp(Buffer.from(renderTile(next))).ensureAlpha().raw().toBuffer();
        still = new VideoFrame(pixels, tileWidth, tileHeight, VideoBufferType.RGBA);
        lastImageKey = key;
      }
      if (!still || output.signal.aborted) return;
      video.captureFrame(still);
      rec()?.video('referee', still);
      if (next.kind === 'reveal' && first?.results && currentCode === code && states[0]?.round === first.round && states[0].phase === 'result') {
        const identifier = `${code}:${first.round}:result`;
        if (spokenCaption !== identifier) {
          spokenCaption = identifier;
          const [a, b] = first.results;
          const [one, two] = next.names;
          // Short on purpose: the tile shows each find and tier, and the final screen the totals.
          const round = a.points === b.points ? 'Draw.' : `${a.points > b.points ? one : two} wins.`;
          const [x, y] = first.totalScores;
          const end = !first.completed ? ''
            : x === y ? `The match is a draw, ${x} each.` : `${x > y ? one : two} wins the match, ${Math.max(x, y)} to ${Math.min(x, y)}.`;
          const find = (result: typeof a) => result.points > 0 ? `${result.label}, ${result.points}` : 'nothing';
          say(`${one}: ${find(a)}. ${two}: ${find(b)}. ${round} ${end}`.trim());
        }
      }
    }

    async function tick() {
      if (ticking || output.signal.aborted) return;
      ticking = true;
      try {
        await checkLayout();
        // Group call: one person full-screen for a few seconds, after the two-tile layout, means a player left.
        if (aloneSince && Date.now() - aloneSince > LEFT_AFTER_MS && bridgeReady(room.metadata)) void hangUp('a player left the group call');
        if (outboundGroup && !bridgeReady(room.metadata)) {
          await scoreboard();
          return;
        }
        if (!code) {
          if (readyMedia() && !namingStarted) {
            namingStarted = Date.now();
            say('Orange, say your name.');
          }
          // Refresh the live camera previews on the names screen once a second, mirrored like a selfie view.
          if (namingStarted && !namingDone && Date.now() - previewedAt > 1000) {
            previewedAt = Date.now();
            void Promise.all(slots.map(slot => fresh(slot)
              ? capture(slot).then(jpeg => sharp(jpeg).flop().resize(300, 300, { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer()).catch(() => undefined)
              : Promise.resolve(undefined))).then(next => { previews = next; });
          }
          // Naming ends when both have names, someone says skip or start, or after 40 s.
          if (namingStarted && Date.now() - namingStarted > 40_000) namingDone = true;
          if (readyMedia() && namingDone) {
            caption = 'Setting up the round';
            if (!creating && Date.now() - lastCreate > 5000) {
              creating = true;
              lastCreate = Date.now();
              void createChallenge().catch(() => console.warn('[envoggle] Could not create a challenge'))
                .finally(() => { creating = false; });
            }
          } else caption = 'Waiting for two player feeds';
        } else if (!pendingStatus && Date.now() - lastStatusCheck >= 200) {
          pendingStatus = true;
          lastStatusCheck = Date.now();
          void Promise.all(slots.map(slot => api(slot, 'state'))).then(async next => {
            if (output.signal.aborted) return;
            states = next;
            syncedAt = Date.now();
            const [first] = next;
            refreshPhotos(first);
            if (first.phase === 'hunt' && !readyMedia()) await api(0, 'drop', {});
            let announcement = '';
            if (first.phase === 'hunt') {
              huntClock.sync(first.deadline, first.serverTime);
              announcement = `Round ${first.stage}: ${first.prompt}. Go!`;
              if (capturedRound !== first.round) {
                capturedRound = first.round;
                clearTimeout(captureTimer);
                captureTimer = setTimeout(() => void captureAll(first.round), Math.max(0, first.deadline - first.serverTime - captureLead));
              }
            }
            caption = ['confirm', 'scoring'].includes(first.phase) ? 'Scoring both finds' : 'Next round soon';
            if (first.phase === 'void') announcement = first.message;
            // Advance without a voice command: next round after a reveal, replay after a void round.
            const advance = first.phase === 'void' || (first.phase === 'result' && !first.completed);
            const advanceId = `${code}:${first.round}:${first.phase}`;
            if (advance && advanceId !== autoAdvance) {
              autoAdvance = advanceId;
              const roundCode = code;
              setTimeout(() => {
                const now = states[0];
                if (output.signal.aborted || code !== roundCode || !now || `${code}:${now.round}:${now.phase}` !== advanceId || !readyMedia()) return;
                void Promise.all(slots.map(player => now.ready[player] ? undefined : api(player, 'ready', { retain: false })))
                  .catch(() => console.warn('[envoggle] Could not start the next round'));
              }, first.phase === 'void' ? REPLAY_MS : NEXT_ROUND_MS);
            }
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

    function scheduleTick() {
      if (output.signal.aborted) return;
      const current = states[0];
      const counting = current?.phase === 'scoring' && current.presentation?.countUp !== undefined;
      tickTimer = setTimeout(() => {
        void tick().catch(() => console.error('[envoggle] Scoreboard update failed')).finally(scheduleTick);
      }, current?.phase === 'hunt' ? 50 : counting ? 100 : 200);
    }
    scheduleTick();
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
      clearTimeout(tickTimer);
      clearTimeout(captureTimer);
      output.abort();
      stopReaders.forEach(stop => stop());
      if (code && states[0]?.phase === 'hunt') await api(0, 'drop', {}).catch(() => {});
      await Promise.allSettled([speaker?.close(), listener.close(), audio.close(), video.close()]);
      recorder?.close();
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
  cli.runApp(new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: process.env.AGENT_NAME || GROUP_REFEREE,
    requestFunc: request => request.job.metadata === GROUP_CALL_JOB ? request.accept('Envoggle', GROUP_REFEREE) : request.accept(),
  }));
}

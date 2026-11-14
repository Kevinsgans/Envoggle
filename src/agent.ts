import { fileURLToPath } from 'node:url';
import { AutoSubscribe, ServerOptions, cli, defineAgent, stt } from '@livekit/agents';
import { STT, TTS } from '@livekit/agents-plugin-openai';
import {
  AudioSource, AudioStream, LocalAudioTrack, LocalVideoTrack, RoomEvent, TrackKind, TrackPublishOptions,
  TrackSource, VideoBufferType, VideoFrame, VideoRotation, VideoSource, VideoStream,
} from '@livekit/rtc-node';
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

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!);
}

function spokenCode(value: string) {
  const digits = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  return value.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|oh)\b/g,
    digit => String(digit === 'oh' ? 0 : digits.indexOf(digit))).replace(/[\s,-]/g, '');
}

export default defineAgent({
  entry: async context => {
    const key = process.env.REFEREE_KEY;
    if (!key || !process.env.OPENAI_API_KEY) throw new Error('REFEREE_KEY and OPENAI_API_KEY are required');
    const room = context.room;
    const cameras = new Map<number, Camera>();
    const videoTracks = new Map<number, string>();
    const audioTracks = new Map<number, string>();
    const stopReaders = new Map<string, () => void>();
    const speaker = new TTS({ model: 'gpt-4o-mini-tts', voice: 'alloy' });
    const listener = new STT({ model: 'gpt-4o-mini-transcribe', useRealtime: true, language: 'en' });
    const audio = new AudioSource(speaker.sampleRate, speaker.numChannels);
    const video = new VideoSource(640, 480);
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
    let notifiedMedia = false;
    let confirmationSlot: number | undefined;

    async function api(slot: number, action: string, body?: object | Buffer, round?: number): Promise<State> {
      const query = new URLSearchParams({ slot: String(slot) });
      if (round !== undefined) query.set('round', String(round));
      const response = await fetch(`${address}/api/duels/${code}/${action}?${query}`, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': Buffer.isBuffer(body) ? 'image/jpeg' : 'application/json' },
        body: Buffer.isBuffer(body) ? new Uint8Array(body) : body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error(`Referee request failed with HTTP ${response.status}`);
      return response.json();
    }

    function say(text: string) {
      if (output.signal.aborted) return;
      speech = speech.then(async () => {
        if (output.signal.aborted) return;
        const stream = speaker.synthesize(text, undefined, output.signal);
        try { for await (const sound of stream) await audio.captureFrame(sound.frame); }
        finally { stream.close(); }
      }).catch(() => { if (!output.signal.aborted) console.error('[envoggle] Referee speech failed'); });
    }

    const fresh = (slot: number) => Date.now() - (cameras.get(slot)?.timestamp ?? 0) <= frameAge;
    const readyMedia = () => slots.every(slot => fresh(slot) && audioTracks.has(slot));

    async function command(slot: number, transcript: string) {
      const raw = transcript.trim().replace(/[.!?]+$/, '');
      const words = raw.toLowerCase().replace(/[’']/g, '');
      if (!code) {
        const match = words.match(/^(?:code|challenge code|room code)\s+(?:is\s+)?(.+)$/);
        const candidate = match && spokenCode(match[1]);
        if (slot === 0 && candidate && /^\d{8}$/.test(candidate) && readyMedia()) {
          code = candidate;
          try {
            const state = await api(0, 'state');
            if (!state.accepted) throw new Error('Challenge pending');
            say(state.retentionEnabled
              ? 'Challenge joined. Vision training is optional. Envoggle may license or sell confirmed images and labels to third parties for vision model training. Say ready to play, or say ready and save my frame to opt in.'
              : 'Challenge joined. Both players, say ready to play.');
          } catch {
            code = '';
            say('That challenge was not found or is still awaiting acceptance. Check the code.');
          }
        }
        return;
      }
      const state = states[slot];
      if (!state) return;
      if (/^(ready|ready to play|ready and save my frame|rematch)$/.test(words) && readyMedia()) {
        await api(slot, 'ready', { retain: words === 'ready and save my frame' });
      } else if (/^lock (it )?in$/.test(words) && state.phase === 'hunt' && fresh(slot)) {
        const camera = cameras.get(slot)!;
        const rgba = camera.frame.convert(VideoBufferType.RGBA);
        const rotation = [0, 90, 180, 270][camera.rotation] ?? 0;
        const frame = await sharp(rgba.data, { raw: { width: rgba.width, height: rgba.height, channels: 4 } })
          .rotate(rotation).resize({ width: 720, height: 720, fit: 'inside' }).jpeg().toBuffer();
        await api(slot, 'lock', frame, state.round);
        say(`Player ${slot + 1}, locked.`);
      } else if (state.phase === 'confirm' && confirmationSlot === slot && state.guesses?.length && !state.confirmed) {
        if (!state.options && /^(yes|correct|thats right)$/.test(words)) await api(slot, 'confirm', { action: 'accept' });
        else if (!state.options && /^(no|incorrect)$/.test(words)) await api(slot, 'confirm', { action: 'reject' });
        else if (state.options) {
          const index = ['one', 'two', 'three'].indexOf(words.replace(/^option\s+/, '').replace(/^1$/, 'one').replace(/^2$/, 'two').replace(/^3$/, 'three'));
          if (index >= 0 && state.guesses[index]) await api(slot, 'confirm', { action: 'choose', value: state.guesses[index] });
          else if (words === 'none of these') say(`Player ${slot + 1}, say "my item is" and name it.`);
          else if (words.startsWith('my item is ')) await api(slot, 'confirm', { action: 'custom', value: raw.slice(11) });
        }
      }
    }

    function slotFor(identity: string, track: string | undefined, kind: 'audio' | 'video') {
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
      if (mapped.has(slot)) return;
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
        const reader = new AudioStream(track, { sampleRate: 24000, numChannels: 1 }).getReader();
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

    await context.connect(undefined, AutoSubscribe.SUBSCRIBE_ALL);
    const publisher = room.localParticipant;
    if (!publisher) throw new Error('Referee participant unavailable');
    await publisher.publishTrack(LocalAudioTrack.createAudioTrack('envoggle-referee-voice', audio), new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }));
    await publisher.publishTrack(LocalVideoTrack.createVideoTrack('envoggle-scoreboard', video), new TrackPublishOptions({ source: TrackSource.SOURCE_CAMERA }));

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
          detail = `${seconds}s · Say “Lock it in”`;
          if (seconds === 5 && lastCountdown !== `${first.round}:5`) {
            lastCountdown = `${first.round}:5`;
            say('Five seconds.');
          }
          rows.push(...first.locked.map((locked, slot) => `Player ${slot + 1} · ${locked ? 'Locked' : 'Hunting'}`));
        } else if (first.results) {
          const [a, b] = first.results;
          detail = a.points === b.points ? 'Draw' : `Player ${a.points > b.points ? 1 : 2} wins`;
          rows.push(...first.results.map((result, slot) => `Player ${slot + 1} · ${result.label} · ${result.points} pts`));
        } else detail = first.message || caption;
      }
      const key = JSON.stringify([title, detail, rows]);
      if (key !== lastImageKey) {
        const line = (value: string, y: number, size: number) => `<text x="38" y="${y}" fill="#F0F4F7" font-family="sans-serif" font-size="${size}">${escapeXml(value.slice(0, 52))}</text>`;
        const svg = `<svg width="640" height="480"><rect width="640" height="480" fill="#111a25"/><rect width="640" height="12" fill="#A9EFC3"/>${line(title, 120, 38)}${line(detail, 196, 26)}${rows.map((row, index) => line(row, 280 + index * 72, 22)).join('')}</svg>`;
        const pixels = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
        still = new VideoFrame(pixels, 640, 480, VideoBufferType.RGBA);
        lastImageKey = key;
      }
      if (still && !output.signal.aborted) video.captureFrame(still);
    }

    async function tick() {
      if (ticking || output.signal.aborted) return;
      ticking = true;
      try {
        if (!code) {
          if (readyMedia()) {
            caption = 'Host: say “Code” and the invite code';
            if (!notifiedMedia) say('Both cameras are ready. Player one, say code, followed by the invite code.');
            notifiedMedia = true;
          } else caption = 'Waiting for two player feeds';
        } else if (!pendingStatus) {
          pendingStatus = true;
          void Promise.all(slots.map(slot => api(slot, 'state'))).then(async next => {
            if (output.signal.aborted) return;
            states = next;
            const [first] = next;
            if (first.phase === 'hunt' && !readyMedia()) await api(0, 'drop', {});
            let announcement = '';
            confirmationSlot = undefined;
            if (first.phase === 'hunt') announcement = `${first.prompt}. Find the rarest thing you can. Go!`;
            if (first.phase === 'confirm') {
              const player = next.find(state => !state.confirmed && state.guesses?.length);
              if (player?.guesses) {
                confirmationSlot = player.slot;
                caption = `Player ${player.slot + 1}: confirm your item`;
                const choices = player.guesses.map((guess, index) => `${index + 1}, ${guess}`).join('. ');
                announcement = player.options
                  ? `Player ${player.slot + 1}. Is it ${choices}? Say the number, or say none of these.`
                  : `Player ${player.slot + 1}, is your item a ${player.guesses[0]}? Say yes or no.`;
              }
            } else caption = first.phase === 'scoring' ? 'Scoring both finds' : 'Say “ready” to play';
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
    context.addShutdownCallback(async () => {
      clearInterval(tickTimer);
      output.abort();
      stopReaders.forEach(stop => stop());
      if (code && states[0]?.phase === 'hunt') await api(0, 'drop', {}).catch(() => {});
      await Promise.allSettled([speaker.close(), listener.close(), audio.close(), video.close()]);
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

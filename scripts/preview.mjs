import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { blue } from '../dist/categories.js';
import { HUNT_DURATION_MS } from '../dist/duel.js';
import { FOCUS_MS, SCAN_MIN_MS, focusProgress, scanProgress } from '../dist/find-visual.js';
import { judgeFind } from '../dist/judge.js';
import { COUNT_UP_MS } from '../dist/score-display.js';
import { DEFAULT_NAMES, renderTile } from '../dist/tile.js';

const total = HUNT_DURATION_MS / 1000;
const countUpStart = SCAN_MIN_MS + FOCUS_MS;
const names = DEFAULT_NAMES;
const prompt = blue.prompt;
const pageUrl = new URL('./preview.html', import.meta.url);
const photoLimit = 15 * 1024 * 1024;
const photoPreviews = new Map();
const objects = [
  '<path d="M144 122h55a38 38 0 0 1 0 76h-42" fill="none" stroke="#2460b7" stroke-width="22"/><path d="M54 103h126l-12 121H66z" fill="#2875db"/><ellipse cx="117" cy="103" rx="63" ry="13" fill="#1453a0"/>',
  '<path d="m65 183 95-82 41 48-95 82z" fill="#2875db"/><path d="m157 103 22-19 41 48-22 19z" fill="#173f77"/><ellipse cx="84" cy="207" rx="10" ry="31" transform="rotate(-40 84 207)" fill="#92ceff"/>',
];
const frames = await Promise.all(objects.map(object => sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="320"><rect width="256" height="320" fill="#d9e1e8"/><ellipse cx="128" cy="241" rx="88" ry="14" fill="#acb8c5"/>${object}</svg>`,
)).jpeg().toBuffer()));
const sideways = await sharp(frames[1]).rotate(90).jpeg().toBuffer();
const photos = [frames[0], sideways].map((frame, slot) => ({
  href: `data:image/jpeg;base64,${frame.toString('base64')}`, width: slot ? 320 : 256, height: slot ? 256 : 320,
}));
const finds = [
  {
    rotation: 0,
    contour: [[54, 103], [72, 94], [117, 90], [163, 94], [180, 103], [179, 111], [199, 111], [225, 118], [242, 137], [248, 160], [242, 183], [225, 202], [199, 209], [170, 209], [168, 224], [66, 224]],
    holes: [[[177, 133], [199, 133], [212, 137], [223, 149], [226, 160], [223, 172], [213, 183], [199, 187], [173, 187]]],
  },
  { rotation: 270, contour: [[63, 184], [179, 84], [221, 132], [104, 233], [92, 233], [74, 222], [62, 207], [59, 194]] },
].map(({ rotation, contour, holes }, slot) => {
  const normalize = ring => ring.map(([x, y]) => slot ? [(320 - y) / 320 * 1000, x / 256 * 1000] : [x / 256 * 1000, y / 320 * 1000]);
  return { rotation, contour: normalize(contour), holes: holes?.map(normalize) };
});

const points = [[425, 860], [860, 425], [575, 575]];
const reveal = points.map(scores => ({
  kind: 'reveal', names, prompt, photos, finds,
  results: scores.map((score, slot) => ({ label: ['Blue mug', 'Blue telescope'][slot], points: score })),
}));
const screens = new Map([
  ['waiting', { kind: 'waiting', present: [false, false] }],
  ['one-player', { kind: 'waiting', present: [true, false] }],
  ['name-orange', { kind: 'names', names: [undefined, undefined], turn: 0, frames }],
  ['name-blue', { kind: 'names', names: ['Orange', undefined], turn: 1, frames }],
  ['setup', { kind: 'message', title: 'Setting up the round', detail: 'One moment' }],
  ['ready', { kind: 'ready', names, prompt }],
  ['blue-wins', reveal[0]],
  ['orange-wins', reveal[1]],
  ['draw', reveal[2]],
  ['void', { kind: 'message', title: 'Round void', detail: 'A camera feed dropped. Say “start” to try again.' }],
]);

const port = Number(process.env.PREVIEW_PORT || 4173);

async function readPhotos(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > photoLimit * 2 + 4096) throw new Error('Choose photos under 15 MB each.');
    chunks.push(chunk);
  }
  const form = await new Response(Buffer.concat(chunks), {
    headers: { 'Content-Type': request.headers['content-type'] ?? '' },
  }).formData();
  const files = ['orange', 'blue'].map(name => form.get(name));
  if (!files.every(file => file instanceof File && file.size > 0 && file.size <= photoLimit)) {
    throw new Error('Choose two photos under 15 MB each.');
  }
  return Promise.all(files.map(async file => {
    try {
      const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 64_000_000 });
      const { format } = await image.metadata();
      if (!['jpeg', 'png', 'webp', 'heif', 'avif'].includes(format)) throw new Error('Unsupported format');
      return await image.rotate().resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
    } catch {
      throw new Error('Could not open one of the photos. Try a JPEG, PNG, or WebP.');
    }
  }));
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'POST' && url.pathname === '/photo-preview') {
    const reply = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(body));
    };
    if (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin') {
      return reply(403, { error: 'Submit photos from the referee preview page.' });
    }
    if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
      return reply(503, { error: 'Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env and restart the preview.' });
    }
    let images;
    try {
      images = await readPhotos(request);
    } catch (error) {
      return reply(400, { error: error instanceof TypeError ? 'Choose two photos.' : error.message });
    }
    try {
      const judged = await Promise.all(images.map(({ data }) => judgeFind(data)));
      const id = randomUUID();
      if (photoPreviews.size >= 12) photoPreviews.delete(photoPreviews.keys().next().value);
      photoPreviews.set(id, {
        kind: 'reveal', names, prompt,
        photos: images.map(({ data, info }) => ({ href: `data:image/jpeg;base64,${data.toString('base64')}`, width: info.width, height: info.height })),
        finds: judged.map(result => result.geometry),
        results: judged.map(({ label, points }) => ({ label, points })),
      });
      setTimeout(() => photoPreviews.delete(id), 30 * 60_000).unref();
      return reply(200, { id });
    } catch (error) {
      console.error('[envoggle:preview] Photo judging failed', error.name);
      return reply(502, { error: 'The judge could not score the photos. Check your model configuration and try again.' });
    }
  }
  if (request.method === 'GET' && url.pathname === '/') {
    const page = await readFile(pageUrl, 'utf8');
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    return response.end(page.replace('__HUNT_SECONDS__', String(total)).replace('__SCORING_MS__', String(countUpStart + COUNT_UP_MS)));
  }
  if (request.method === 'GET' && (url.pathname === '/tile.png' || url.pathname === '/tile.svg')) {
    const screen = url.searchParams.get('screen');
    const seconds = Number(url.searchParams.get('seconds') ?? total);
    const elapsed = Number(url.searchParams.get('elapsed') ?? 450);
    const previewId = url.searchParams.get('preview');
    const custom = previewId ? photoPreviews.get(previewId) : undefined;
    if (previewId && !custom) {
      response.writeHead(404);
      return response.end('Photo preview expired');
    }
    const scoring = Number.isFinite(elapsed) && elapsed >= 0 ? {
      kind: 'scoring', names, prompt, photos: custom?.photos ?? photos,
      finds: elapsed < SCAN_MIN_MS ? undefined : custom?.finds ?? finds, focus: focusProgress(elapsed - SCAN_MIN_MS),
      scan: elapsed < SCAN_MIN_MS ? scanProgress(elapsed) : undefined,
      countUp: elapsed >= countUpStart ? {
        elapsed: elapsed - countUpStart, targets: (custom ?? reveal[0]).results.map(result => result.points),
      } : undefined,
    } : undefined;
    const view = screen === 'hunt' && Number.isFinite(seconds) && seconds >= 0 && seconds <= total
      ? { kind: 'hunt', names, prompt, remainingMs: seconds * 1000, locked: [seconds === 0, seconds === 0], animate: url.searchParams.get('static') !== '1' }
      : screen === 'scoring' ? scoring : screen === 'photo-result' ? custom : screens.get(screen);
    if (view) {
      try {
        const svg = renderTile(view);
        if (url.pathname === '/tile.svg') {
          response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
          return response.end(svg);
        }
        const tile = await sharp(Buffer.from(svg)).ensureAlpha().png().toBuffer();
        response.setHeader('Content-Type', 'image/png');
        return response.end(tile);
      } catch (error) {
        console.error('[envoggle:preview] Tile render failed', error);
        response.writeHead(500);
        return response.end('Tile render failed');
      }
    }
  }
  response.writeHead(404);
  response.end('Preview route not found');
}).listen(port, '127.0.0.1', () => console.info(`[envoggle:preview] Open http://127.0.0.1:${port}`));

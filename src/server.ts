import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { AccessToken } from 'livekit-server-sdk';
import sharp from 'sharp';
import { createDuel, duels } from './duel.js';

const assets = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['public/style.css', 'text/css']],
  ['/app.js', ['dist/web.js', 'text/javascript']],
]);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const json = (status: number, data: unknown) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(data));
  };
  const read = async (limit: number) => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > limit) throw new Error('Request too large');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  };
  try {
    const asset = assets.get(url.pathname);
    if (request.method === 'GET' && asset) {
      const body = await readFile(asset[0]);
      response.writeHead(200, { 'Content-Type': asset[1] });
      return response.end(body);
    }
    if (request.method === 'POST' && url.pathname === '/api/duels') {
      const duel = createDuel();
      return json(201, { code: duel.code, token: duel.players[0].token });
    }
    const match = url.pathname.match(/^\/api\/duels\/([a-f0-9]{8})(?:\/([a-z]+))?$/i);
    if (!match) return json(404, { error: 'Not found' });
    const duel = duels.get(match[1].toUpperCase());
    if (!duel) return json(404, { error: 'This challenge has expired.' });
    const action = match[2];
    if (!action && request.method === 'GET') return json(200, { code: duel.code, accepted: duel.accepted });
    if (action === 'accept' && request.method === 'POST') {
      if (duel.accepted) return json(409, { error: 'This challenge already has two players.' });
      duel.accepted = true;
      return json(200, { code: duel.code, token: duel.players[1].token });
    }
    const token = request.headers.authorization?.replace(/^Bearer /, '');
    const referee = Boolean(process.env.REFEREE_KEY && token === process.env.REFEREE_KEY);
    const slot = referee ? Number(url.searchParams.get('slot') ?? -1) : duel.players.findIndex(player => player.token === token);
    if (![0, 1].includes(slot)) return json(401, { error: 'Join the challenge first.' });
    if (request.method === 'GET') {
      if (action === 'state') return json(200, duel.state(slot));
      if (action === 'frame') {
        const player = url.searchParams.get('player');
        const round = url.searchParams.get('round');
        const frame = player === '0' || player === '1' ? duel.frame(Number(player), round === null ? undefined : Number(round)) : undefined;
        if (!frame) return json(404, { error: 'Frame unavailable' });
        response.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
        return response.end(frame);
      }
      if (action === 'object') {
        const frame = await duel.objectFrame(Number(url.searchParams.get('player')));
        if (!frame) return json(404, { error: 'Object preview unavailable' });
        const isPng = frame.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        response.writeHead(200, { 'Content-Type': isPng ? 'image/png' : 'image/jpeg', 'Cache-Control': 'no-store' });
        return response.end(frame);
      }
      if (action === 'media') {
        const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
        if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return json(503, { error: 'LiveKit is unavailable.' });
        const media = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: `player-${slot}`, ttl: '2h' });
        media.addGrant({ roomJoin: true, room: `envoggle-${duel.code}`, canPublish: true, canSubscribe: true, canPublishData: false });
        return json(200, { url: LIVEKIT_URL, token: await media.toJwt() });
      }
      return json(404, { error: 'Not found' });
    }
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
    if (action === 'lock') {
      const upload = await read(600_000);
      const receivedAt = Date.now();
      if (upload[0] !== 0xff || upload[1] !== 0xd8 || upload[2] !== 0xff) return json(415, { error: 'The locked frame must be a JPEG.' });
      const frame = await sharp(upload, { limitInputPixels: 4_000_000 }).rotate().resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      if (!duel.lock(slot, frame, Number(url.searchParams.get('round')), receivedAt)) return json(409, { error: 'The round is closed or a newer lock was saved.' });
    } else if (action === 'drop') {
      duel.void('A camera feed dropped. Ready up to restart.');
    } else if (action === 'ready' || action === 'confirm') {
      const body = JSON.parse((await read(4096)).toString());
      if (action === 'ready') duel.ready(slot, body.retain === true);
      else if (!duel.confirm(slot, body.action, typeof body.value === 'string' ? body.value : undefined)) return json(409, { error: 'This entry is no longer awaiting confirmation.' });
    } else return json(404, { error: 'Not found' });
    return json(200, duel.state(slot));
  } catch {
    if (!response.headersSent) json(400, { error: 'Could not process the request.' });
    else response.end();
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => console.info('[envoggle] Server ready'));

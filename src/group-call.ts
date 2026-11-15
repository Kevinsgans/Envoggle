import { setTimeout as delay } from 'node:timers/promises';
import { AccessToken, AgentDispatchClient, RoomServiceClient, TrackType } from 'livekit-server-sdk';

export const GROUP_CALL_JOB = 'envoggle-group-call';
export const GROUP_REFEREE = 'envoggle-referee';
const chertCalls = 'https://facetime.trychert.com/api/v1/calls';
const phone = /^\+[1-9]\d{7,14}$/;
const requestID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const terminal = new Set(['ended', 'failed', 'rejected']);

export class GroupCallError extends Error {
  constructor(readonly status: number, message: string, readonly retrySame = false) {
    super(message);
  }
}

type Attempt = {
  id: string;
  room: string;
  host: string;
  guest: string;
  rooms: RoomServiceClient;
  body?: string;
  starting?: Promise<void>;
  allocated?: boolean;
};

let current: Attempt | undefined;
const attempts = new Map<string, Attempt>();

function checkPlayers(host: string, guest: string) {
  const allowedHost = process.env.ENVOGGLE_CALL_HOST_PHONE?.trim();
  const allowedGuests = (process.env.ENVOGGLE_CALL_GUEST_PHONES ?? '').split(',').map(number => number.trim()).filter(Boolean);
  if (!allowedHost || !phone.test(allowedHost) || !allowedGuests.length || allowedGuests.some(number => !phone.test(number))) {
    throw new GroupCallError(503, 'Set the host and guest FaceTime numbers on the Envoggle server.');
  }
  if (host !== allowedHost || !allowedGuests.includes(guest)) {
    throw new GroupCallError(403, 'These players are not configured for Envoggle calls.');
  }
}

async function release(attempt: Attempt) {
  await attempt.rooms.deleteRoom(attempt.room).catch(() => {});
  if (current === attempt) current = undefined;
}

async function watchCall(attempt: Attempt, id: string, headers: Record<string, string>) {
  let ready = false;
  // Stop watching (and free the line for the next game) when Chert reports the call over, when it
  // answers with a permanent error such as an invalid key or an unknown call, or after the bridge
  // token's 90-minute lifetime.
  const giveUpAt = Date.now() + 95 * 60_000;
  while (Date.now() < giveUpAt) {
    try {
      const response = await fetch(`${chertCalls}/${encodeURIComponent(id)}`, { headers, signal: AbortSignal.timeout(5000) });
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        console.warn('[envoggle] Chert call status unavailable; releasing the line. HTTP', response.status);
        break;
      }
      if (response.ok) {
        const { data } = await response.json();
        if (terminal.has(data?.status)) break;
        if (!ready && Array.isArray(data?.facetime_call_events) && data.facetime_call_events.some((event: { event_type?: string }) => event.event_type === 'bridge_ready')) {
          await attempt.rooms.updateRoomMetadata(attempt.room, JSON.stringify({ chert_bridge_ready: true }));
          ready = true;
        }
      }
    } catch {
      // Keep observing the same call when either service is temporarily unavailable.
    }
    await delay(ready ? 2500 : 600, undefined, { ref: false });
  }
  await release(attempt);
}

export async function startGroupCall(input: unknown) {
  const { id, host, guest } = (input ?? {}) as Record<string, unknown>;
  if (typeof id !== 'string' || !requestID.test(id) || typeof host !== 'string' || typeof guest !== 'string' ||
    !phone.test(host) || !phone.test(guest) || host === guest) {
    throw new GroupCallError(400, 'Enter two different phone numbers with country codes.');
  }
  checkPlayers(host, guest);
  const { CHERT_FACETIME_API_KEY: key, CHERT_PROJECT_ID: project, CHERT_LINE_ID: line,
    LIVEKIT_URL: url, LIVEKIT_API_KEY: livekitKey, LIVEKIT_API_SECRET: secret } = process.env;
  if (!key || !project || !line || !url?.startsWith('wss://') || !livekitKey || !secret) {
    throw new GroupCallError(503, 'The game call service is not configured.');
  }

  let attempt = attempts.get(id);
  if (attempt && (attempt.host !== host || attempt.guest !== guest)) throw new GroupCallError(409, 'This invite belongs to different players.');
  if (attempt?.allocated) return;
  if (current && current !== attempt) throw new GroupCallError(409, 'The Chert line is already handling a game.');
  if (!attempt) {
    const rooms = new RoomServiceClient(url, livekitKey, secret, { requestTimeout: 5 });
    attempt = { id, host, guest, room: `envoggle-call-${id}`, rooms };
    attempts.set(id, attempt);
    const pending = attempt;
    setTimeout(() => {
      attempts.delete(id);
      if (current === pending && !pending.allocated) void release(pending);
    }, 90 * 60_000).unref();
  }
  current = attempt;
  const active = attempt;
  if (active.starting) return active.starting;

  const headers = { Authorization: `Bearer ${key}`, 'X-Chert-Project-Id': project };
  async function start() {
    if (!active.body) {
      try {
        await active.rooms.createRoom({ name: active.room, emptyTimeout: 120 });
        const dispatches = new AgentDispatchClient(url!, livekitKey, secret, { requestTimeout: 5 });
        await dispatches.createDispatch(active.room, process.env.AGENT_NAME || GROUP_REFEREE, { metadata: GROUP_CALL_JOB });
        const deadline = Date.now() + 12_000;
        let published = false;
        while (Date.now() < deadline) {
          const agent = await active.rooms.getParticipant(active.room, GROUP_REFEREE).catch(() => undefined);
          if (agent?.tracks.some(track => track.type === TrackType.AUDIO && !track.muted) && agent.tracks.some(track => track.type === TrackType.VIDEO && !track.muted)) {
            published = true;
            break;
          }
          await delay(300);
        }
        if (!published) throw new Error('Referee not ready');
        const bridge = new AccessToken(livekitKey, secret, { identity: 'chert-bridge', ttl: '90m' });
        bridge.addGrant({ roomJoin: true, room: active.room, canPublish: true, canSubscribe: true });
        active.body = JSON.stringify({
          direction: 'outbound', mode: 'customer_managed', line_id: line,
          recipients: [host, guest].map(value => ({ type: 'phone_number', value })),
          media: { audio: true, video: true }, livekit_url: url, participant_token: await bridge.toJwt(),
          remote_participant_identity: GROUP_REFEREE,
        });
      } catch {
        attempts.delete(active.id);
        await release(active);
        throw new GroupCallError(503, 'The referee is unavailable. Check that the Envoggle agent is running.');
      }
    }

    const uncertain = () => new GroupCallError(502, 'Chert did not confirm the call. Retry to check the same invitation.', true);
    const response = await fetch(chertCalls, {
      method: 'POST', headers: { ...headers, 'Idempotency-Key': active.id, 'Content-Type': 'application/json' },
      body: active.body, signal: AbortSignal.timeout(8000),
    }).catch(() => { throw uncertain(); });
    if (response.status >= 500 || response.status === 408) throw uncertain();
    const reply = await response.json().catch(() => undefined);
    if (!response.ok) {
      attempts.delete(active.id);
      await release(active);
      const code = reply?.error?.code ?? reply?.code;
      if (code === 'facetime_group_unavailable') throw new GroupCallError(503, 'Ask Chert to enable group video on this line.');
      if (code === 'recipient_not_verified') throw new GroupCallError(403, 'Both phone numbers need verification on the Chert line.');
      if (code === 'line_busy') throw new GroupCallError(409, 'Chert is busy. Try again after the other call ends.');
      throw new GroupCallError(502, 'Chert declined the game call. Check line readiness and recipient verification.');
    }
    const callID = reply?.data?.id;
    if (typeof callID !== 'string' || !callID) throw uncertain();
    active.allocated = true;
    void watchCall(active, callID, headers);
  }

  active.starting = start().finally(() => { active.starting = undefined; });
  return active.starting;
}

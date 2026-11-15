import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AgentDispatchClient, RoomServiceClient, TrackType } from 'livekit-server-sdk';
import { GROUP_CALL_JOB, GROUP_REFEREE, startGroupCall } from '../dist/group-call.js';

test('dispatches a referee, reuses the same Chert request after uncertainty, and cleans up when the call ends', async ({ mock }) => {
  const request = { id: '11111111-2222-3333-4444-555555555555', host: '+12025550101', guest: '+12025550102' };
  process.env.ENVOGGLE_CALL_HOST_PHONE = '';
  await assert.rejects(startGroupCall(request), { status: 503 });
  for (const [name, value] of Object.entries({
    ENVOGGLE_CALL_HOST_PHONE: request.host,
    ENVOGGLE_CALL_GUEST_PHONES: `${request.guest}, +12025550103`,
    CHERT_FACETIME_API_KEY: 'fixture-key', CHERT_PROJECT_ID: 'fixture-project', CHERT_LINE_ID: 'fixture-line',
    LIVEKIT_URL: 'wss://livekit.example.test', LIVEKIT_API_KEY: 'fixture-key', LIVEKIT_API_SECRET: 'fixture-secret',
    AGENT_NAME: 'test-agent',
  })) process.env[name] = value;
  await assert.rejects(startGroupCall({ ...request, guest: request.host }), { status: 400 });
  await assert.rejects(startGroupCall({ ...request, host: '+12025550104' }), { status: 403 });
  await assert.rejects(startGroupCall({ ...request, guest: '+12025550104' }), { status: 403 });
  const room = `envoggle-call-${request.id}`;
  mock.method(RoomServiceClient.prototype, 'createRoom', async options => assert.equal(options.name, room));
  const dispatch = mock.method(AgentDispatchClient.prototype, 'createDispatch', async (...args) => {
    assert.deepEqual(args, [room, 'test-agent', { metadata: GROUP_CALL_JOB }]);
  });
  mock.method(RoomServiceClient.prototype, 'getParticipant', async (roomName, identity) => {
    assert.equal(roomName, room);
    assert.equal(identity, GROUP_REFEREE);
    return { tracks: [{ type: TrackType.AUDIO, muted: false }, { type: TrackType.VIDEO, muted: false }] };
  });
  const { promise: metadata, resolve: signalMetadata } = Promise.withResolvers();
  mock.method(RoomServiceClient.prototype, 'updateRoomMetadata', async (roomName, value) => {
    assert.equal(roomName, room);
    assert.deepEqual(JSON.parse(value), { chert_bridge_ready: true });
    signalMetadata();
  });
  const { promise: cleanup, resolve: signalCleanup } = Promise.withResolvers();
  const release = mock.method(RoomServiceClient.prototype, 'deleteRoom', async roomName => {
    assert.equal(roomName, room);
    signalCleanup();
  });

  const requests = [];
  let checks = 0;
  mock.method(globalThis, 'fetch', async (url, init) => {
    if (init.method === 'POST') {
      assert.match(url, /\/calls$/);
      assert.equal(init.headers['Idempotency-Key'], request.id);
      requests.push(init.body);
      if (requests.length === 1) throw new TypeError('Test disconnect');
      return Response.json({ data: { id: 'fixture-call' } }, { status: 201 });
    }
    assert.match(url, /\/calls\/fixture-call$/);
    const data = checks++ === 0
      ? { status: 'active', facetime_call_events: [{ event_type: 'bridge_ready' }] }
      : { status: 'ended', facetime_call_events: [] };
    return Response.json({ data });
  });

  await assert.rejects(startGroupCall(request), { status: 502, retrySame: true });
  await assert.rejects(startGroupCall({ ...request, id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }), { status: 409 });
  await assert.rejects(startGroupCall({ ...request, guest: '+12025550103' }), { status: 409 });
  await Promise.all([startGroupCall(request), startGroupCall(request)]);
  await startGroupCall(request);
  assert.equal(dispatch.mock.callCount(), 1);
  assert.equal(requests.length, 2);
  assert.equal(requests[0], requests[1]);
  const sent = JSON.parse(requests[0]);
  assert.equal(sent.line_id, 'fixture-line');
  assert.deepEqual(sent.recipients, [request.host, request.guest].map(value => ({ type: 'phone_number', value })));
  assert.deepEqual(sent.media, { audio: true, video: true });
  const claims = JSON.parse(Buffer.from(sent.participant_token.split('.')[1], 'base64url').toString());
  assert.equal(claims.sub, 'chert-bridge');
  assert.equal(claims.video.room, room);
  await metadata;
  assert.equal(release.mock.callCount(), 0);
  const keepAlive = setTimeout(() => {}, 3500);
  try { await cleanup; }
  finally { clearTimeout(keepAlive); }
  assert.equal(release.mock.callCount(), 1);
});

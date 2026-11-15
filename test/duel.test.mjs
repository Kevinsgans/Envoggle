import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Duel, HUNT_DURATION_MS } from '../dist/duel.js';

const first = Buffer.from('first frame');
const final = Buffer.from('final frame');
const other = Buffer.from('other frame');
const json = result => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] });
const active = new Set();

afterEach(() => {
  for (const duel of active) duel.void('Test ended');
  active.clear();
});

function start(mock) {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const duel = new Duel('ABCDEF12');
  active.add(duel);
  duel.accepted = true;
  duel.ready(0, false);
  duel.ready(1, false);
  return duel;
}

async function settle() {
  await new Promise(resolve => setImmediate(resolve));
}

test('scores the best matching item in each last locked frame, holding dictionary items to their band', async ({ mock }) => {
  const previous = process.env.GEMINI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY; // the mock answers Gemini-shaped requests
  process.env.GEMINI_API_KEY = 'test-fixture';
  try {
    const captures = [];
    mock.method(globalThis, 'fetch', async (_url, request) => {
      const [, image] = JSON.parse(request.body).contents[0].parts;
      const frame = Buffer.from(image.inlineData.data, 'base64').toString();
      captures.push(frame);
      return frame === final.toString()
        ? json({ items: [{ label: 'pen', points: 150, reason: 'A blue pen.' }, { label: 'bandoneon', points: 870, reason: 'An unusual instrument.' }], safeToRetain: false })
        : json({ items: [{ label: 'gel pen', points: 640, reason: 'A blue pen.' }], safeToRetain: false });
    });
    const duel = start(mock);
    assert.equal(duel.lock(0, first, 1), true);
    assert.equal(duel.lock(0, final, 1), true);
    assert.equal(duel.lock(1, other, 1), true);
    mock.timers.tick(HUNT_DURATION_MS);
    await settle();
    assert.equal(duel.lock(0, first, 1), false);
    await settle();
    assert.equal(duel.phase, 'result');
    assert.equal(duel.confirm(0, 'accept'), false);
    assert.deepEqual(duel.results.map(result => [result.label, result.points, result.unlisted]), [['bandoneon', 870, true], ['pen', 200, false]]);
    assert.equal(captures.length, 2);
    assert.equal(captures.includes(first.toString()), false);
    assert.deepEqual(duel.frame(0), final);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
    if (anthropic !== undefined) process.env.ANTHROPIC_API_KEY = anthropic;
  }
});

test('both missed locks tie at zero and a camera drop voids the rematch', async ({ mock }) => {
  const duel = start(mock);
  mock.timers.tick(HUNT_DURATION_MS);
  await settle();
  assert.deepEqual(duel.results.map(result => result.points), [0, 0]);
  duel.ready(0, false);
  duel.ready(1, false);
  assert.equal(duel.lock(0, first, 1), false);
  duel.void('Camera disconnected');
  assert.equal(duel.phase, 'void');
  assert.equal(duel.state(0).message, 'Camera disconnected');
});

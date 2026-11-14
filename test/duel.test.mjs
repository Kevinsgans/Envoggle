import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Duel } from '../dist/duel.js';

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

test('uses the last locked frames, supports guesses and custom names, and scores known and unlisted items', async ({ mock }) => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-fixture';
  try {
    const captures = [];
    mock.method(globalThis, 'fetch', async (_url, request) => {
      const [prompt, image] = JSON.parse(request.body).contents[0].parts;
      const frame = Buffer.from(image.inlineData.data, 'base64').toString();
      captures.push(frame);
      if (prompt.text.startsWith('Identify')) return frame === final.toString()
        ? json({ guesses: ['accordion', 'concertina', 'keyboard'] })
        : json({ guesses: ['gel pen', 'pencil', 'marker'] });
      return frame === final.toString()
        ? json({ eligible: true, canonicalLabel: 'bandoneon', points: 5, reason: 'An unusual instrument.', safeToRetain: false })
        : json({ eligible: true, canonicalLabel: 'pen', points: 5, reason: 'A blue pen.', safeToRetain: false });
    });
    const duel = start(mock);
    assert.equal(duel.lock(0, first, 1), true);
    assert.equal(duel.lock(0, final, 1), true);
    assert.equal(duel.lock(1, other, 1), true);
    mock.timers.tick(HUNT_DURATION_MS);
    await settle();
    assert.equal(duel.lock(0, first, 1), false);
    assert.deepEqual(duel.state(0).guesses, ['accordion', 'concertina', 'keyboard']);
    assert.equal(duel.state(0).options, true);
    assert.equal(duel.state(1).options, false);
    assert.equal(duel.confirm(0, 'custom', 'bandoneon'), true);
    assert.equal(duel.confirm(1, 'accept'), true);
    await settle();
    assert.equal(duel.phase, 'result');
    assert.deepEqual(duel.results.map(result => [result.label, result.points]), [['bandoneon', 5], ['pen', 1]]);
    assert.equal(captures.includes(first.toString()), false);
    assert.deepEqual(duel.frame(0), final);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
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

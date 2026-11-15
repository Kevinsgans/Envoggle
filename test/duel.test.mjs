import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Duel, HUNT_DURATION_MS } from '../dist/duel.js';
import { FOCUS_MS, SCAN_MIN_MS } from '../dist/find-visual.js';
import { COUNT_UP_MS, countUpScore, renderScore } from '../dist/score-display.js';
import { renderTile } from '../dist/tile.js';

const first = Buffer.from('first frame');
const final = Buffer.from('final frame');
const other = Buffer.from('other frame');
const contour = [[353, 105], [621, 125], [604, 698], [348, 811]];
const hole = [[425, 245], [495, 245], [495, 310], [425, 310]];
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

test('scans the last locked frames and focuses the item that wins after applying dictionary scores', async ({ mock }) => {
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
        ? json({ items: [{ label: 'pen', points: 950, reason: 'A blue pen.' }, { label: 'bandoneon', points: 870, reason: 'An unusual instrument.', contour, holes: [hole, [[0, 0], [200, 0], [200, 200], [0, 200]]] }], rotation: 90, safeToRetain: false })
        : json({ items: [{ label: 'gel pen', points: 640, reason: 'A blue pen.', contour: [[0, 0], [1000, 1000], [950, 0], [0, 900]] }], rotation: 180, safeToRetain: false });
    });
    const duel = start(mock);
    assert.equal(duel.lock(0, first, 1), true);
    assert.equal(duel.lock(0, final, 1), true);
    assert.equal(duel.lock(1, other, 1), true);
    assert.equal(duel.frame(0, 1), undefined);
    mock.timers.tick(HUNT_DURATION_MS);
    await settle();
    assert.equal(duel.phase, 'scoring');
    assert.equal(duel.state(0).presentation.focusStartedAt, undefined);
    assert.deepEqual(duel.frame(0, 1), final);
    assert.equal(duel.lock(0, first, 1), false);
    mock.timers.tick(SCAN_MIN_MS);
    await settle();
    assert.equal(duel.phase, 'scoring');
    assert.equal(duel.results, undefined);
    assert.deepEqual(duel.state(1).presentation.finds, [{ contour, holes: [hole], rotation: 90 }, { rotation: 180 }]);
    mock.timers.tick(FOCUS_MS);
    await settle();
    assert.deepEqual(duel.state(0).presentation.countUp, { startedAt: Date.now(), targets: [870, 15] });
    assert.equal(duel.phase, 'scoring');
    for (const slot of [0, 1]) assert.equal(duel.state(slot).results, undefined);
    mock.timers.tick(COUNT_UP_MS - 1);
    await settle();
    assert.equal(duel.results, undefined);
    mock.timers.tick(1);
    await settle();
    assert.equal(duel.phase, 'result');
    assert.equal(duel.confirm(0, 'accept'), false);
    assert.deepEqual(duel.results.map(result => [result.label, result.points, result.unlisted]), [['bandoneon', 870, true], ['pen', 15, false]]);
    assert.equal(captures.length, 2);
    assert.equal(captures.includes(first.toString()), false);
    assert.deepEqual(duel.frame(0), final);
    duel.ready(0, false);
    duel.ready(1, false);
    assert.equal(duel.state(0).presentation, undefined);
    assert.equal(duel.frame(0, 1), undefined);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
    if (anthropic !== undefined) process.env.ANTHROPIC_API_KEY = anthropic;
  }
});

test('keeps scanning while the model is slow and gives a missed lock zero points at reveal', async ({ mock }) => {
  const previous = process.env.GEMINI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  process.env.GEMINI_API_KEY = 'test-fixture';
  try {
    const { promise, resolve } = Promise.withResolvers();
    mock.method(globalThis, 'fetch', () => promise.then(json));
    const duel = start(mock);
    duel.lock(1, other, 1);
    mock.timers.tick(HUNT_DURATION_MS);
    mock.timers.tick(SCAN_MIN_MS * 2);
    await settle();
    assert.equal(duel.state(0).presentation.focusStartedAt, undefined);
    assert.equal(duel.frame(0), undefined);
    resolve({ items: [{ label: 'grandfather clock', points: 100, reason: 'A blue clock.' }], safeToRetain: false });
    await settle();
    assert.equal(duel.phase, 'scoring');
    assert.equal(duel.state(0).presentation.focusStartedAt, Date.now());
    assert.deepEqual(duel.state(0).presentation.finds, [undefined, undefined]);
    mock.timers.tick(FOCUS_MS);
    await settle();
    assert.deepEqual(duel.state(0).presentation.countUp.targets, [null, 1000]);
    mock.timers.tick(COUNT_UP_MS);
    await settle();
    assert.deepEqual(duel.results.map(result => [result.label, result.points]), [['No find', 0], ['grandfather clock', 1000]]);
    duel.ready(0, false);
    duel.ready(1, false);
    duel.lock(1, final, 2);
    mock.timers.tick(HUNT_DURATION_MS);
    assert.equal(duel.frame(1, 1), undefined);
    assert.deepEqual(duel.frame(1, 2), final);
    await settle();
    mock.timers.tick(SCAN_MIN_MS);
    await settle();
    mock.timers.tick(FOCUS_MS);
    await settle();
    assert.ok(duel.state(1).presentation.countUp);
    duel.void('Camera disconnected');
    mock.timers.tick(COUNT_UP_MS);
    await settle();
    assert.equal(duel.state(1).presentation, undefined);
    assert.equal(duel.results, undefined);
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
  assert.equal(duel.state(0).presentation, undefined);
  assert.deepEqual(duel.results.map(result => result.points), [0, 0]);
  duel.ready(0, false);
  duel.ready(1, false);
  assert.equal(duel.lock(0, first, 1), false);
  duel.void('Camera disconnected');
  assert.equal(duel.phase, 'void');
  assert.equal(duel.state(0).message, 'Camera disconnected');
});

test('only a locked slot counts up, slowing as it approaches the final score', () => {
  const finds = { names: ['Orange', 'Blue'], prompt: 'Things that are blue', photos: [] };
  const tile = renderTile({ ...finds, kind: 'scoring', focus: 1, countUp: { elapsed: 550, targets: [null, 1000] } });
  assert.equal(tile.match(/<svg width="144"/g)?.length, 1);
  assert.match(tile, /Scoring/);
  assert.doesNotMatch(tile, /wins|Draw/);
  assert.equal(countUpScore(0, 1000), 0);
  assert.equal(countUpScore(350, 1000), 0);
  const samples = [400, 750, 1100, 1450, COUNT_UP_MS].map(elapsed => countUpScore(elapsed, 1000));
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 999);
  const gains = samples.slice(1).map((points, index) => points - samples[index]);
  assert.ok(gains.every((gain, index) => gain > 0 && (index === 0 || gain < gains[index - 1])));
  assert.equal(countUpScore(900, 0), 0);
  assert.equal(countUpScore(COUNT_UP_MS, 15), 14);
  const scoreText = points => Array.from(renderScore(points).matchAll(/<text[^>]*>([^<]*)<\/text>/g), match => match[1]).join('').trim();
  assert.equal(scoreText(0), '0');
  assert.equal(scoreText(1000), '1000');
  const draw = renderTile({ ...finds, kind: 'reveal', results: [{ label: 'First item', points: 1000 }, { label: 'Second item', points: 1000 }] });
  assert.match(draw, /Draw/);
  assert.equal(draw.match(/<svg width="144"/g)?.length, 2);
});

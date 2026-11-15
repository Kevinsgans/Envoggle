import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Duel, HUNT_DURATION_MS } from '../dist/duel.js';
import { ROUNDS_PER_MATCH, drawRounds, rounds } from '../dist/categories.js';
import { COUNT_UP_MS } from '../dist/score-display.js';
import { FOCUS_MS, SCAN_MIN_MS } from '../dist/find-visual.js';

const json = result => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] });

test('plays three different categories, replays a void round, and stops after the third round', async ({ mock }) => {
  process.env.GEMINI_API_KEY = 'test';
  delete process.env.ANTHROPIC_API_KEY;
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  mock.method(globalThis, 'fetch', async () => json({ items: [{ label: 'zorb', points: 298, reason: 'Odd.', contour: [], holes: [] }], rotation: 0, safeToRetain: false }));
  const duel = new Duel('ROUNDS01');
  duel.accepted = true;
  const start = () => { duel.ready(0, false); duel.ready(1, false); };
  const play = async () => {
    start();
    assert.equal(duel.phase, 'hunt');
    duel.lock(0, Buffer.from('a'), duel.round);
    mock.timers.tick(HUNT_DURATION_MS);
    for (let i = 0; i < 20 && duel.phase !== 'result'; i++) { await new Promise(resolve => setImmediate(resolve)); mock.timers.tick(SCAN_MIN_MS + FOCUS_MS + COUNT_UP_MS); }
    assert.equal(duel.phase, 'result');
  };
  const prompts = [];
  await play(); prompts.push(duel.state(0).prompt);
  start(); duel.void('Camera dropped');
  await play(); prompts.push(duel.state(0).prompt);
  assert.equal(duel.state(0).completed, false);
  await play(); prompts.push(duel.state(0).prompt);
  assert.deepEqual(prompts, duel.order.map(index => rounds[index].prompt));
  assert.equal(new Set(prompts).size, ROUNDS_PER_MATCH);
  assert.equal(duel.state(0).completed, true);
  assert.deepEqual(duel.state(0).totalScores, [298 * ROUNDS_PER_MATCH, 0]);
  // The match stops after three rounds: another start does nothing.
  start();
  assert.equal(duel.phase, 'result');
  assert.equal(duel.state(0).completed, true);
  assert.deepEqual(duel.state(0).totalScores, [298 * ROUNDS_PER_MATCH, 0]);
});

test('every category has five tier names and anchors inside 1 to 1000', () => {
  assert.equal(rounds.length, 8);
  assert.equal(new Set(rounds.map(round => round.prompt)).size, rounds.length);
  for (const round of rounds) {
    assert.equal(round.tiers.length, 5, round.prompt);
    for (const item of round.items) assert.ok(item.points >= 1 && item.points <= 1000, `${round.prompt}: ${item.name}`);
  }
  assert.equal(drawRounds().length, ROUNDS_PER_MATCH);
});

test('ENVOGGLE_ROUNDS fixes the categories in order and ignores bad lists', () => {
  assert.deepEqual(drawRounds(Math.random, '1,7,8'), [0, 6, 7]);
  assert.equal(rounds[0].prompt, 'Rare things that are blue');
  assert.equal(drawRounds(Math.random, '1,1,8').length, ROUNDS_PER_MATCH);
  assert.equal(drawRounds(() => 0.5, '0,7,8').every(index => index >= 0 && index < rounds.length), true);
});

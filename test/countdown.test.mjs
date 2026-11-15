import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HUNT_DURATION_MS, HuntClock, countdownFrame } from '../dist/countdown.js';
import { renderTile } from '../dist/tile.js';

test('the hunt clock advances between polls and ignores late estimates for the same deadline', () => {
  const clock = new HuntClock();
  clock.sync(40_000, 10_000, 100);
  assert.equal(clock.remaining(175), HUNT_DURATION_MS - 75);
  clock.sync(40_000, 10_075, 200);
  assert.equal(clock.remaining(200), HUNT_DURATION_MS - 100);
  clock.sync(40_000, 10_120, 210);
  assert.equal(clock.remaining(210), HUNT_DURATION_MS - 120);
  assert.equal(clock.remaining(40_000), 0);
  clock.sync(80_000, 50_000, 40_000);
  assert.equal(clock.remaining(40_000), HUNT_DURATION_MS);
});

test('the countdown drains between seconds and changes digits and urgency gradually', () => {
  const before = countdownFrame(5050);
  const boundary = countdownFrame(5000);
  const during = countdownFrame(4910);
  const after = countdownFrame(4700);
  assert.equal(before.seconds, 6);
  assert.equal(boundary.seconds, 5);
  assert.equal(boundary.blend, 0);
  assert.equal(during.blend, .5);
  assert.equal(after.blend, 1);
  assert.ok(boundary.progress > during.progress && during.progress > after.progress);
  assert.equal(boundary.urgency, 0);
  assert.ok(during.urgency > 0 && during.urgency < 1);
  assert.equal(after.urgency, 1);
  assert.equal(countdownFrame(4910, false).blend, 1);
  assert.equal(countdownFrame(4910, false).progress, boundary.progress);
  assert.equal(countdownFrame(0).progress, 0);
});

test('the referee ring moves smoothly through the five-second prompt in place', () => {
  const hunt = { kind: 'hunt', names: ['Orange', 'Blue'], prompt: 'Things that are blue', locked: [false, true] };
  const before = renderTile({ ...hunt, remainingMs: 5050 });
  const early = renderTile({ ...hunt, remainingMs: 4950 });
  const later = renderTile({ ...hunt, remainingMs: 4800 });
  const ring = svg => svg.match(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/).slice(1);
  const dash = svg => Number(svg.match(/stroke-dashoffset="([^"]+)"/)[1]);
  assert.deepEqual(ring(before), ring(later));
  assert.ok(dash(before) < dash(early) && dash(early) < dash(later));
  assert.doesNotMatch(before, /Hold it up to the camera/);
  assert.match(later, /Hold it up to the camera/);
});

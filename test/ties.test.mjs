import assert from 'node:assert/strict';
import { test } from 'node:test';
import { breakTie, bump } from '../dist/judge.js';

test('a bump adds 1 point, or 2 when 1 would land on a multiple of 5', () => {
  assert.equal(bump(544), 546);
  assert.equal(bump(541), 542);
  assert.equal(bump(0), 1);
});

test('ties go to the higher model rating, then the bigger find, then a coin flip', () => {
  const box = size => [0, 0, size, size];
  assert.equal(breakTie({ points: 544, rating: 520 }, { points: 544, rating: 610 }), 1);
  assert.equal(breakTie({ points: 544, rating: 600, box: box(0.5) }, { points: 544, rating: 600, box: box(0.3) }), 0);
  assert.equal(breakTie({ points: 544, rating: 600 }, { points: 544, rating: 600 }, () => 0.9), 1);
  assert.equal(breakTie({ points: 544 }, { points: 543 }), undefined);
  assert.equal(breakTie({ points: 0 }, { points: 0 }), undefined);
});

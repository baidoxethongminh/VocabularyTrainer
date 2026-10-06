import test from 'node:test';
import assert from 'node:assert/strict';
import { findDifferences, generateFeedback } from '../pronunciation-feedback.js';

test('findDifferences handles a transcript that ends before the expected word', () => {
  assert.deepEqual(findDifferences('decorate', 'deco'), [
    {
      start: 4,
      end: 8,
      expectedSlice: 'rate',
      actualSlice: '',
    },
  ]);
});

test('findDifferences handles a transcript with extra trailing characters', () => {
  assert.deepEqual(findDifferences('abc', 'abcd'), [
    {
      start: 3,
      end: 3,
      expectedSlice: '',
      actualSlice: 'd',
    },
  ]);
});

test('generateFeedback completes when unrelated speech reaches character comparison', () => {
  const feedback = generateFeedback('decorate', 'z', 40);

  assert.equal(feedback.isCorrect, false);
  assert.match(feedback.messages[0].message, /Dự kiến: "decorate"/);
});

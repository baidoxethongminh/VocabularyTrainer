import test from 'node:test';
import assert from 'node:assert/strict';
import { createWordProgressRenderer, splitTextIntoTokens } from '../pronunciation-viewer.js';

test('splitTextIntoTokens breaks a single word into syllable-like pronunciation units', () => {
  const tokens = splitTextIntoTokens('Architect');

  assert.deepEqual(tokens.map((token) => token.text), ['Ar', 'chi', 'tect']);
});

test('splitTextIntoTokens keeps decorate in three syllables', () => {
  const tokens = splitTextIntoTokens('decorate');

  assert.deepEqual(tokens.map((token) => token.text), ['dec', 'o', 'rate']);
});

test('word progress stops rendering after all tokens are completed', () => {
  let html = '';
  let renderCount = 0;
  const container = {};
  Object.defineProperty(container, 'innerHTML', {
    get: () => html,
    set: (value) => {
      html = value;
      renderCount += 1;
    },
  });
  const renderer = createWordProgressRenderer(container);

  renderer.setText('blue print');
  assert.equal(renderer.tick(), true);
  assert.equal(renderer.tick(), false);
  const completedRenderCount = renderCount;

  assert.equal(renderer.tick(), false);
  assert.equal(renderCount, completedRenderCount);
});

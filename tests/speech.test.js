import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpeechLanguageCode, getSlowPlaybackRate, selectBestVoice } from '../speech.js';

test('slow playback reduces the selected rate without resetting it to a fixed speed', () => {
  assert.equal(getSlowPlaybackRate(0.5), 0.375);
  assert.equal(getSlowPlaybackRate(1), 0.75);
  assert.equal(getSlowPlaybackRate(1.5), 1.125);
  assert.equal(getSlowPlaybackRate('invalid'), 0.75);
});

test('getSpeechLanguageCode prefers the correct locale for Japanese', () => {
  assert.equal(getSpeechLanguageCode('japanese'), 'ja-JP');
});

test('getSpeechLanguageCode prefers the correct locale for English', () => {
  assert.equal(getSpeechLanguageCode('english'), 'en-US');
});

test('selectBestVoice falls back to the closest matching voice for the selected language', () => {
  const voices = [
    { name: 'Microsoft Zira', lang: 'en-GB' },
    { name: 'Google Japanese', lang: 'ja-JP' },
    { name: 'Google US English', lang: 'en-US' },
  ];

  assert.equal(selectBestVoice(voices, 'japanese').name, 'Google Japanese');
  assert.equal(selectBestVoice(voices, 'english').name, 'Google US English');
});

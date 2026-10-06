/**
 * Build a learn queue that repeats each word the requested number of times.
 * @param {Array<Object>} words
 * @param {number} repetitionsPerWord
 * @returns {Array<Object>}
 */
export function buildLearnQueue(words, repetitionsPerWord) {
  if (!words.length || !Number.isInteger(repetitionsPerWord) || repetitionsPerWord < 1) {
    return [];
  }

  return words.flatMap((word) => Array(repetitionsPerWord).fill(word));
}

/**
 * Evaluate the typed answer against the current word.
 * Normalizes: trim + lowercase + whitespace normalization
 * @param {string} answer
 * @param {Object} wordEntry
 * @returns {boolean}
 */
export function isLearnAnswerCorrect(answer, wordEntry) {
  // Normalize both answer and expected word
  const normalizedAnswer = String(answer || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  
  const normalizedExpected = String(wordEntry?.word || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  
  return normalizedAnswer === normalizedExpected;
}

/**
 * Toggle whether the target word is hidden.
 * @param {boolean} currentState
 * @returns {boolean}
 */
export function toggleWordVisibility(currentState) {
  return !currentState;
}

import { getMeaningDisplayValue } from './language-config.js';

/**
 * Build a plain label for a learn queue item.
 * @param {Object} entry
 * @returns {string}
 */
export function formatLearnLabel(entry) {
  return `${entry.word} — ${getMeaningDisplayValue(entry)}`;
}

/**
 * Normalize the learn reading mode value.
 * @param {string} mode
 * @returns {string}
 */
export function normalizeLearnReadingMode(mode) {
  return mode === 'spelling' ? 'spelling' : 'normal';
}

/**
 * Split a word into individual letters for spelling mode.
 * @param {string} word
 * @returns {Array<string>}
 */
export function getSpellingSequence(word) {
  return String(word || '')
    .split('')
    .filter((character) => /[A-Za-z]/.test(character))
    .map((character) => character.toUpperCase());
}

/**
 * Build the progressive letter prefixes used for spelling highlighting.
 * @param {string} word
 * @returns {Array<string>}
 */
export function getSpellingProgressSteps(word) {
  const letters = getSpellingSequence(word);
  return letters.map((_, index) => letters.slice(0, index + 1).join(''));
}

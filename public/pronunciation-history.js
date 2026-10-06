/**
 * Pronunciation Practice History
 * 
 * Stores and retrieves pronunciation practice history per word.
 * Uses localStorage for persistence.
 */

const HISTORY_STORAGE_KEY = 'vocabularyTrainer.pronunciationHistory';
const MAX_HISTORY_ENTRIES = 50;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('Failed to save pronunciation history', error);
  }
}

/**
 * Add a pronunciation attempt to history
 * @param {Object} params
 * @param {string} params.word - The word practiced
 * @param {string} params.expected - Expected text
 * @param {string} params.actual - What user said (transcript)
 * @param {number} params.score - Overall score 0-100
 * @param {Object} params.scores - { accuracy, fluency, confidence }
 * @param {string} params.mode - Speaking mode (vocabulary/example)
 * @param {Object} params.feedback - AI feedback object
 * @returns {Array} Updated attempts for this word
 */
function addAttempt({ word, expected, actual, score, scores = {}, mode = 'vocabulary', feedback = null }) {
  if (!word) return [];

  const history = loadHistory();
  const key = word.toLowerCase().trim();
  const attempts = history[key] || [];

  const attempt = {
    timestamp: Date.now(),
    expected,
    actual,
    score: Math.round(score) || 0,
    accuracy: Math.round(scores.accuracy) || 0,
    fluency: Math.round(scores.fluency) || 0,
    confidence: Math.round(scores.confidence) || 0,
    mode,
    feedbackSummary: feedback ? feedback.messages?.map(m => m.title).join(', ') : null,
  };

  attempts.push(attempt);

  // Keep only the latest entries
  if (attempts.length > MAX_HISTORY_ENTRIES) {
    attempts.splice(0, attempts.length - MAX_HISTORY_ENTRIES);
  }

  history[key] = attempts;
  saveHistory(history);

  return attempts;
}

/**
 * Get all attempts for a specific word
 * @param {string} word
 * @returns {Array}
 */
function getAttempts(word) {
  if (!word) return [];
  const history = loadHistory();
  const key = word.toLowerCase().trim();
  return history[key] || [];
}

/**
 * Get the best score for a word
 * @param {string} word
 * @returns {number} 0-100
 */
function getBestScore(word) {
  const attempts = getAttempts(word);
  if (!attempts.length) return 0;
  return Math.max(...attempts.map(a => a.score || 0));
}

/**
 * Get progress stats for a word
 * @param {string} word
 * @returns {Object}
 */
function getWordStats(word) {
  const attempts = getAttempts(word);
  if (!attempts.length) {
    return {
      totalAttempts: 0,
      bestScore: 0,
      latestScore: 0,
      averageScore: 0,
      trend: 'none', // improving, declining, stable, none
      attempts: [],
    };
  }

  const scores = attempts.map(a => a.score || 0);
  const bestScore = Math.max(...scores);
  const latestScore = scores[scores.length - 1];
  const averageScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

  // Determine trend
  let trend = 'stable';
  if (scores.length >= 2) {
    const lastFew = scores.slice(-3);
    if (lastFew.length >= 2) {
      const first = lastFew[0];
      const last = lastFew[lastFew.length - 1];
      if (last > first + 10) trend = 'improving';
      else if (last < first - 10) trend = 'declining';
    }
  }

  return {
    totalAttempts: attempts.length,
    bestScore,
    latestScore,
    averageScore,
    trend,
    attempts,
  };
}

/**
 * Clear history for a specific word or all history
 * @param {string} [word] - If omitted, clears all history
 */
function clearHistory(word) {
  if (word) {
    const history = loadHistory();
    const key = word.toLowerCase().trim();
    delete history[key];
    saveHistory(history);
  } else {
    saveHistory({});
  }
}

/**
 * Get all words that have pronunciation history
 * @returns {Array<string>}
 */
function getPracticedWords() {
  const history = loadHistory();
  return Object.keys(history).filter(key => Array.isArray(history[key]) && history[key].length > 0);
}

export {
  addAttempt,
  getAttempts,
  getBestScore,
  getWordStats,
  clearHistory,
  getPracticedWords,
};

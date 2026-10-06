/**
 * Pronunciation Practice Integration
 *
 * Wires pronunciation-viewer, pronunciation-feedback, pronunciation-history
 * into the existing Speaking Test in app.js.
 *
 * This module is designed to be called from app.js after DOM is ready.
 */

import { createMouthRenderer, createWordProgressRenderer, VISUAL_GUIDE_STATES } from './pronunciation-viewer.js';
import { generateFeedback, calculateScore } from './pronunciation-feedback.js';
import { addAttempt, getAttempts, getWordStats } from './pronunciation-history.js';

let mouthRenderer = null;
let wordProgressRenderer = null;
let isRecording = false;
let currentTranscript = '';

// DOM references (set during init)
let dom = {};

/**
 * Initialize pronunciation UI components.
 * Call once after DOM is ready.
 */
export function initPronunciationUI(elements = {}) {
  dom = elements;

  // Create visual guide renderers
  const mouthContainer = document.getElementById('mouth-animation-container');
  const wordProgressContainer = document.getElementById('word-progress-display');

  if (wordProgressContainer) {
    wordProgressRenderer = createWordProgressRenderer(wordProgressContainer, {
      onTimelineTick: (state) => {
        if (mouthRenderer && typeof mouthRenderer.setTimelineState === 'function') {
          mouthRenderer.setTimelineState(state);
        }
      },
    });
  }

  if (mouthContainer) {
    // Wire word progress tick into the avatar's unified animation loop
    mouthRenderer = createMouthRenderer(mouthContainer, {
      onAnimTick: () => {
        if (wordProgressRenderer && typeof wordProgressRenderer.tick === 'function') {
          wordProgressRenderer.tick();
          const activeIndex = wordProgressRenderer.getActiveIndex();
          if (mouthRenderer && typeof mouthRenderer.setFrameByIndex === 'function') {
            mouthRenderer.setFrameByIndex(activeIndex);
          }
          return activeIndex;
        }
        return -1;
      },
    });
  }

  // Setup practice pronunciation button delegation
  setupPracticeButtons();

  // Setup slow listen button
  const slowBtn = document.getElementById('test-listen-slow');
  if (slowBtn) {
    slowBtn.addEventListener('click', () => {
      if (typeof dom.speakPromptSlow === 'function') {
        dom.speakPromptSlow();
      }
    });
  }

  // Setup stop record button
  const stopBtn = document.getElementById('test-stop-record');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      if (typeof dom.stopRecording === 'function') {
        dom.stopRecording();
      }
    });
  }
}

/**
 * Show pronunciation guide (visual + word progress)
 */
export function showPronunciationGuide(text) {
  const guide = document.getElementById('pronunciation-guide');
  if (guide) {
    guide.classList.remove('hidden');
  }

  if (wordProgressRenderer && text) {
    wordProgressRenderer.setText(text);
  }

  if (mouthRenderer) {
    mouthRenderer.setState(VISUAL_GUIDE_STATES.IDLE);
    mouthRenderer.setFrameByIndex(-1);
  }
  if (wordProgressRenderer && typeof wordProgressRenderer.stopAnimation === 'function') {
    wordProgressRenderer.stopAnimation();
  }
}

/**
 * Hide pronunciation guide
 */
export function hidePronunciationGuide() {
  const guide = document.getElementById('pronunciation-guide');
  if (guide) {
    guide.classList.add('hidden');
  }
}

/**
 * Called when SpeechSynthesis starts speaking
 */
export function onSpeakingStart(text, options = {}) {
  if (mouthRenderer) {
    mouthRenderer.setState(VISUAL_GUIDE_STATES.SPEAKING);
  }
  if (wordProgressRenderer && text) {
    wordProgressRenderer.setText(text);
    const durationMs = Number(options.durationMs) > 0 ? Number(options.durationMs) : 1200;
    wordProgressRenderer.startTimeline({ durationMs });
  }

  // Update button visibility for speaking mode
  const slowBtn = document.getElementById('test-listen-slow');
  const recordBtn = document.getElementById('test-record');
  const stopBtn = document.getElementById('test-stop-record');
  if (slowBtn) slowBtn.classList.remove('hidden');
  if (recordBtn) recordBtn.classList.remove('hidden');
  if (stopBtn) stopBtn.classList.add('hidden');
}

/**
 * Called when SpeechSynthesis ends
 */
export function onSpeakingEnd() {
  if (mouthRenderer) {
    mouthRenderer.setState(VISUAL_GUIDE_STATES.IDLE);
  }
  // Don't force allCompleted() — let timed animation run to completion naturally.
  // allCompleted() would stop the animation mid-way and mark all tokens done at once,
  // which breaks the sequential highlight effect the user wants to see.

  const stopBtn = document.getElementById('test-stop-record');
  if (stopBtn) stopBtn.classList.add('hidden');
}

/**
 * Called when recording starts
 */
export function onRecordingStart() {
  isRecording = true;
  currentTranscript = '';

  if (mouthRenderer) {
    mouthRenderer.setState(VISUAL_GUIDE_STATES.LISTENING);
  }

  const recordBtn = document.getElementById('test-record');
  const stopBtn = document.getElementById('test-stop-record');
  const listenBtn = document.getElementById('test-listen');
  const slowBtn = document.getElementById('test-listen-slow');

  if (recordBtn) recordBtn.classList.add('hidden');
  if (stopBtn) stopBtn.classList.remove('hidden');
  if (listenBtn) listenBtn.classList.add('hidden');
  if (slowBtn) slowBtn.classList.add('hidden');

  // Hide previous result
  const resultCard = document.getElementById('pronunciation-result');
  if (resultCard) resultCard.classList.add('hidden');
}

/**
 * Called when recording stops
 */
export function onRecordingStop() {
  isRecording = false;

  if (mouthRenderer) {
    mouthRenderer.setState(VISUAL_GUIDE_STATES.PROCESSING);
  }

  const recordBtn = document.getElementById('test-record');
  const stopBtn = document.getElementById('test-stop-record');
  const listenBtn = document.getElementById('test-listen');
  const slowBtn = document.getElementById('test-listen-slow');

  if (recordBtn) recordBtn.classList.remove('hidden');
  if (stopBtn) stopBtn.classList.add('hidden');
  if (listenBtn) listenBtn.classList.remove('hidden');
  if (slowBtn) slowBtn.classList.remove('hidden');
}

/**
 * Update word progress highlight at a specific token index
 */
export function updateWordProgress(index) {
  if (wordProgressRenderer) {
    wordProgressRenderer.setActiveIndex(index);
  }
}

/**
 * Mark a word progress token as completed
 */
export function markWordCompleted(index) {
  if (wordProgressRenderer) {
    wordProgressRenderer.markCompleted(index);
  }
}

/**
 * Reset all pronunciation UI for a new question
 */
export function resetPronunciationForQuestion(text) {
  currentTranscript = '';
  isRecording = false;

  const guide = document.getElementById('pronunciation-guide');
  const resultCard = document.getElementById('pronunciation-result');
  const testAnswerWrapper = document.getElementById('test-answer-wrapper');
  const testSubmit = document.getElementById('test-submit');
  const testNextBtn = document.getElementById('test-next');
  const testRetryBtn = document.getElementById('test-retry');
  const testSkipBtn = document.getElementById('test-skip');
  const testRecordBtn = document.getElementById('test-record');
  const testListenBtn = document.getElementById('test-listen');
  const slowBtn = document.getElementById('test-listen-slow');
  const stopBtn = document.getElementById('test-stop-record');

  // Show guide for speaking mode
  if (guide) guide.classList.remove('hidden');
  if (resultCard) resultCard.classList.add('hidden');

  // Hide typing elements for speaking mode
  if (testAnswerWrapper) testAnswerWrapper.classList.add('hidden');
  if (testSubmit) testSubmit.classList.add('hidden');
  if (testNextBtn) testNextBtn.classList.add('hidden');
  if (testRetryBtn) testRetryBtn.classList.add('hidden');
  if (testSkipBtn) testSkipBtn.classList.add('hidden');

  // Show speaking buttons
  if (testRecordBtn) testRecordBtn.classList.remove('hidden');
  if (testListenBtn) testListenBtn.classList.remove('hidden');
  if (slowBtn) slowBtn.classList.remove('hidden');
  if (stopBtn) stopBtn.classList.add('hidden');

  if (mouthRenderer) {
    mouthRenderer.setState(VISUAL_GUIDE_STATES.IDLE);
  }

  if (wordProgressRenderer && text) {
    wordProgressRenderer.setText(text);
  } else if (wordProgressRenderer) {
    wordProgressRenderer.reset();
  }
}

/**
 * Show pronunciation result with score, feedback, and history
 */
export function showPronunciationResult({ expected, actual, confidence = 0.7, word = '', mode = 'vocabulary' }) {
  const resultCard = document.getElementById('pronunciation-result');
  if (!resultCard) return;

  resultCard.classList.remove('hidden');

  // Calculate scores
  const feedback = generateFeedback(expected, actual, confidence * 100);
  const overallScore = calculateScore(expected, actual, confidence);
  const accuracyScore = feedback.isCorrect ? Math.round(confidence * 100) : Math.max(30, overallScore - 20);
  const fluencyScore = feedback.isCorrect ? Math.round(confidence * 85) : Math.max(20, overallScore - 30);
  const confScore = Math.round(confidence * 100);

  // Update score display
  const scoreValue = document.getElementById('pron-score-value');
  const scoreAccuracy = document.getElementById('pron-score-accuracy');
  const scoreFluency = document.getElementById('pron-score-fluency');
  const scoreConfidence = document.getElementById('pron-score-confidence');

  if (scoreValue) scoreValue.textContent = overallScore;
  if (scoreAccuracy) scoreAccuracy.textContent = accuracyScore;
  if (scoreFluency) scoreFluency.textContent = fluencyScore;
  if (scoreConfidence) scoreConfidence.textContent = confScore;

  // Update transcript
  const transcriptEl = document.getElementById('pron-transcript');
  if (transcriptEl) {
    transcriptEl.textContent = actual || '—';
  }

  // Update feedback messages
  const feedbackContainer = document.getElementById('pron-feedback-messages');
  if (feedbackContainer) {
    feedbackContainer.innerHTML = (feedback.messages || []).map(msg => `
      <div class="pron-feedback-msg ${msg.type}">
        <div class="msg-title">${msg.title}</div>
        <div class="msg-body">${msg.message}</div>
      </div>
    `).join('');
  }

  // Save to history
  if (word) {
    addAttempt({
      word,
      expected,
      actual,
      score: overallScore,
      scores: { accuracy: accuracyScore, fluency: fluencyScore, confidence: confScore },
      mode,
      feedback,
    });

    // Update history section
    updateHistoryDisplay(word);
  }

  // Show next/retry/skip buttons
  const testNextBtn = document.getElementById('test-next');
  const testRetryBtn = document.getElementById('test-retry');
  const testSkipBtn = document.getElementById('test-skip');
  const testRecordBtn = document.getElementById('test-record');
  const stopBtn = document.getElementById('test-stop-record');

  if (testNextBtn) testNextBtn.classList.remove('hidden');
  if (testRetryBtn) testRetryBtn.classList.remove('hidden');
  if (testSkipBtn) testSkipBtn.classList.remove('hidden');
  if (testRecordBtn) testRecordBtn.classList.remove('hidden');
  if (stopBtn) stopBtn.classList.add('hidden');

  if (mouthRenderer) {
    mouthRenderer.setState(VISUAL_GUIDE_STATES.IDLE);
  }
}

/**
 * Display pronunciation history for a word
 */
export function updateHistoryDisplay(word) {
  const historySection = document.getElementById('pron-history-section');
  const historyList = document.getElementById('pron-history-list');
  if (!historySection || !historyList) return;

  const stats = getWordStats(word);
  if (stats.totalAttempts === 0) {
    historySection.classList.add('hidden');
    return;
  }

  historySection.classList.remove('hidden');

  const latestAttempts = stats.attempts.slice(-10).reverse();
  historyList.innerHTML = latestAttempts.map((attempt, index) => {
    const attemptNum = stats.totalAttempts - index;
    const scoreClass = attempt.score >= 80 ? 'high' : attempt.score >= 50 ? 'medium' : 'low';
    return `
      <div class="pron-history-item">
        <span class="pron-history-attempt">Attempt ${attemptNum}</span>
        <span class="pron-history-score ${scoreClass}">${attempt.score}</span>
        <div class="pron-history-bar">
          <span class="pron-history-bar-fill ${scoreClass}" style="width:${attempt.score}%"></span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Hide pronunciation result
 */
export function hidePronunciationResult() {
  const resultCard = document.getElementById('pronunciation-result');
  if (resultCard) resultCard.classList.add('hidden');
}

/**
 * Clean up pronunciation UI for dictation mode
 */
export function resetForDictationMode() {
  hidePronunciationGuide();
  hidePronunciationResult();

  const testAnswerWrapper = document.getElementById('test-answer-wrapper');
  const testSubmit = document.getElementById('test-submit');
  const testRecordBtn = document.getElementById('test-record');
  const testListenBtn = document.getElementById('test-listen');
  const slowBtn = document.getElementById('test-listen-slow');
  const stopBtn = document.getElementById('test-stop-record');
  const testRetryBtn = document.getElementById('test-retry');
  const testSkipBtn = document.getElementById('test-skip');

  if (testAnswerWrapper) testAnswerWrapper.classList.remove('hidden');
  if (testSubmit) testSubmit.classList.remove('hidden');
  if (testRecordBtn) testRecordBtn.classList.add('hidden');
  if (testListenBtn) testListenBtn.classList.remove('hidden');
  if (slowBtn) slowBtn.classList.remove('hidden');
  if (stopBtn) stopBtn.classList.add('hidden');
  if (testRetryBtn) testRetryBtn.classList.add('hidden');
  if (testSkipBtn) testSkipBtn.classList.add('hidden');

  if (mouthRenderer) mouthRenderer.setState(VISUAL_GUIDE_STATES.IDLE);
  if (wordProgressRenderer) wordProgressRenderer.reset();
}

/**
 * Setup event delegation for Practice Pronunciation buttons in word cards
 */
function setupPracticeButtons() {
  const wordListEl = document.getElementById('word-list');
  if (!wordListEl) return;

  wordListEl.addEventListener('click', (event) => {
    const button = event.target.closest('.practice-pronunciation-btn');
    if (!button) return;

    const word = button.getAttribute('data-word');
    if (!word) return;

    // Navigate to test page and start speaking test with this specific word
    if (typeof dom.startPronunciationForWord === 'function') {
      dom.startPronunciationForWord(word);
    }
  });
}

/**
 * Get current transcript from recognition
 */
export function getCurrentTranscript() {
  return currentTranscript;
}

/**
 * Set current transcript
 */
export function setCurrentTranscript(transcript) {
  currentTranscript = transcript || '';
}

/**
 * Check if currently recording
 */
export function isCurrentlyRecording() {
  return isRecording;
}

export { mouthRenderer, wordProgressRenderer };

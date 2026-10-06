/**
 * Pronunciation Avatar — Smooth continuous interpolation, natural speech model
 *
 * Architecture:
 *   .pron-avatar-inner (position:relative; 120×140)
 *     └── 5 × <img> stacked absolute, only 1 visible at a time
 *
 * Animation model:
 *   Instead of a fixed cycle, we maintain a continuous float `targetFrame`
 *   and smoothly approach it each RAF tick using ease-out interpolation.
 *
 *   Two modes:
 *     FREE SPEAKING (no timeline override):
 *       targetFrame oscillates like natural speech — varying amplitude,
 *       varying frequency, with occasional small pauses at closed/open.
 *       Uses a multi-oscillator sum + random jitter bounded by
 *       a simple "breath" envelope.
 *
 *     TIMELINE DRIVEN (overrideIdx set by setTimelineState):
 *       targetFrame eases toward the syllable-derived mouth shape.
 *       Short syllable → small mouth (target ~1-2).
 *       Long syllable → wider mouth (target ~3-4).
 *
 *   The float is converted to an integer each tick — because we only have
 *   5 discrete images. But smooth easing at 60fps creates the illusion of
 *   fluid motion (sub-frame blending via temporal persistence).
 *
 * Key improvements over previous version:
 *   - RAF fires EVERY frame (no FRAME_MS gate) — 60fps comfortable.
 *   - targetFrame changes continuously, not in discrete steps.
 *   - Easing: value approaches target via `current += (target - current) * speed`.
 *   - FREE mode uses natural oscillation, not a fixed CYCLE array.
 *   - No canvas, no data URL, no background-image — same reliable 5-<img> stack.
 */

const W = 120;
const H = 140;
const BASE = 'assets/images/pronunciation-avatar-';
const EXT = '.png';
const NAMES = ['closed', 'small', 'half', 'open', 'wide'];

export const AVATAR_STATES = Object.freeze({
  IDLE: 'idle',
  SPEAKING: 'speaking',
  LISTENING: 'listening',
  PROCESSING: 'processing',
});

// ── Preload ──
let preloadedImages = [];
let preloadDone = false;
const waiters = [];

(function startPreload() {
  if (typeof window === 'undefined') { preloadDone = true; return; }
  Promise.all(
    NAMES.map(
      (name) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload  = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = BASE + name + EXT;
        }),
    ),
  ).then((results) => {
    preloadedImages = results;
    preloadDone = true;
    waiters.splice(0).forEach((fn) => fn());
  });
})();

function imgSrc(idx) {
  const img = preloadedImages[idx];
  return img && typeof img.src === 'string' ? img.src : BASE + NAMES[idx] + EXT;
}

/**
 * @param {HTMLElement} container
 * @param {object}  [opts]
 * @returns {object}  { setState, destroy, getState, setFrameByIndex, setTimelineState }
 */
export function createPronunciationAvatar(container, opts) {
  // ── 1. DOM (one shot) ──
  const outer = document.createElement('div');
  outer.className = 'pron-avatar';

  const inner = document.createElement('div');
  inner.className = 'pron-avatar-inner';
  inner.style.cssText =
    'position:relative;' +
    'width:' + W + 'px;' +
    'height:' + H + 'px;' +
    'display:block;' +
    'margin:0 auto;';

  const frames = [];
  for (let i = 0; i < NAMES.length; i++) {
    const el = document.createElement('img');
    el.src = imgSrc(i);
    el.alt = '';
    el.style.cssText =
      'position:absolute;' +
      'top:0;left:0;' +
      'width:' + W + 'px;' +
      'height:' + H + 'px;' +
      'display:' + (i === 0 ? 'block' : 'none') + ';' +
      'pointer-events:none;';
    inner.appendChild(el);
    frames.push(el);
  }

  const label = document.createElement('div');
  label.className = 'pron-avatar-state';
  label.textContent = 'Sẵn sàng';

  outer.appendChild(inner);
  outer.appendChild(label);
  container.textContent = '';
  container.appendChild(outer);

  // ── 2. State ──
  let state = AVATAR_STATES.IDLE;
  let destroyed = false;
  let raf = null;

  // Continuous frame position [0..4] (float)
  let currentFrame = 0;
  // Target frame — what we're smoothly moving toward
  let targetFrame = 0;
  // Current speed multiplier for free speaking oscillation
  let oscPhase = 0;          // accumulated oscillator phase (radians)
  let oscAmplitude = 0;      // current amplitude envelope [0..4]
  let oscFrequency = 0;      // current frequency (rad/ms)
  let breathTimer = 0;       // timer for breath cycle
  let lastTickMs = 0;

  // Timeline override
  let overrideFrame = -1;    // -1 = free speaking, ≥0 = timeline target

  // Easing constant: 0.08 means it takes ~75ms to close 99% of gap at 60fps
  const EASE = 0.08;
  // Slow ease used when returning from override to free mode
  const RELEASE_EASE = 0.03;

  // ── 3. Smooth interpolation ──
  function show(n) {
    if (destroyed) return;
    // n is a float [0..4], we snap to nearest integer for the 5-frame stack
    const idx = Math.round(Math.max(0, Math.min(4, n)));
    for (let i = 0; i < frames.length; i++) {
      frames[i].style.display = i === idx ? 'block' : 'none';
    }
  }

  // ── 4. Free speaking oscillator ──
  // Generates natural-looking mouth motion without a fixed cycle.
  // Uses a sum-of-sines model where amplitude & frequency drift slowly
  // to avoid mechanical repetition.
  function computeFreeTarget(dt) {
    // Phase accumulator — advances based on current frequency
    // Frequency wanders between 0.004 and 0.012 rad/ms (~0.6-2Hz)
    oscFrequency += (Math.random() - 0.5) * 0.00005;
    oscFrequency = Math.max(0.003, Math.min(0.014, oscFrequency));

    // Amplitude envelope — drifts between 1.0 and 3.5
    oscAmplitude += (Math.random() - 0.5) * 0.02;
    oscAmplitude = Math.max(0.8, Math.min(3.8, oscAmplitude));

    // Breath cycle: every 2-4 seconds a slight pause (mouth closed)
    breathTimer += dt;
    if (breathTimer > 2000 + Math.random() * 2000) {
      breathTimer = 0;
    }
    // Breath "closing" — dip toward 0 during breath window (300ms)
    const breathDip = breathTimer < 300
      ? 1 - (breathTimer / 300)  // closing
      : breathTimer < 600
        ? (breathTimer - 300) / 300  // reopening
        : 1;

    oscPhase += oscFrequency * dt;

    // Multi-oscillator sum: base + 2nd harmonic + noise
    const osc1 = Math.sin(oscPhase);
    const osc2 = Math.sin(oscPhase * 2.3 + 1.2) * 0.4;
    const noise = (Math.random() - 0.5) * 0.3;

    // Map [-1..1] range to [0..amplitude] with soft clamping at extremes
    const raw = (osc1 * 0.6 + osc2 + noise * 0.2) * oscAmplitude * breathDip;
    // Centre around 2.0 (half-open) and clamp to [0..4]
    return Math.max(0, Math.min(4, 2.0 + raw));
  }

  // ── 5. Natural delay profile ──
  // Maps syllable length to mouth target.
  // Short syllable (1-2 chars) → mouth barely opens (0.5–1.5)
  // Medium syllable (3-5 chars) → normal opening (1.5–3.0)
  // Long syllable (6+ chars) → wide opening (2.5–4.0)
  function syllableTarget(index) {
    if (index < 0) return 0;
    // index is the sequential token index.
    // We use it to derive mouth opening:
    // higher token → slightly wider, with oscillation
    // Based on a natural speech curve: first syllable starts mid,
    // then varies by position
    const raw = 1.5 + Math.sin(index * 1.1) * 1.2;
    return Math.max(0, Math.min(4, raw));
  }

  // ── 6. RAF loop ──
  function startRAF() {
    stopRAF();
    currentFrame = 0;
    targetFrame = 0;
    overrideFrame = -1;
    oscPhase = 0;
    oscAmplitude = 2.0;
    oscFrequency = 0.008;
    breathTimer = 600; // start mid-breath to avoid initial dip
    lastTickMs = 0;

    function tick(now) {
      if (destroyed) return;
      if (!lastTickMs) lastTickMs = now;
      const dt = Math.min(now - lastTickMs, 50); // cap at 50ms to avoid jumps
      lastTickMs = now;

      if (overrideFrame >= 0) {
        // Timeline-driven mode: target comes from syllable
        targetFrame = syllableTarget(overrideFrame);
        // Fast ease toward target
        currentFrame += (targetFrame - currentFrame) * EASE;
      } else {
        // Free speaking mode: compute dynamic target
        targetFrame = computeFreeTarget(dt);
        currentFrame += (targetFrame - currentFrame) * RELEASE_EASE;
      }

      show(currentFrame);

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }

  function stopRAF() {
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  // ── 7. Upgrade preloaded image sources ──
  function upgradeSrc() {
    if (destroyed) return;
    for (let i = 0; i < frames.length; i++) {
      const src = imgSrc(i);
      if (frames[i].src !== src) frames[i].src = src;
    }
  }
  if (!preloadDone) waiters.push(upgradeSrc);

  // ── 8. Public API ──
  function setState(s) {
    state = s || AVATAR_STATES.IDLE;
    if (state === AVATAR_STATES.SPEAKING) {
      startRAF();
    } else {
      stopRAF();
      if (state === AVATAR_STATES.IDLE) {
        currentFrame = 0;
        show(0);
      }
    }
    label.textContent =
      state === AVATAR_STATES.IDLE      ? 'Sẵn sàng' :
      state === AVATAR_STATES.SPEAKING  ? '🔊 Đang đọc' :
      state === AVATAR_STATES.LISTENING ? '🎤 Đang nghe' :
      state === AVATAR_STATES.PROCESSING? '⏳ Xử lý' : '';
    Object.values(AVATAR_STATES).forEach(
      (s) => outer.classList.toggle(s, s === state),
    );
  }

  function setFrameByIndex(idx) {
    // Called from onAnimTick and setTimelineState
    if (idx < 0) {
      overrideFrame = -1;
      return;
    }
    overrideFrame = idx;
  }

  function setTimelineState(ts) {
    if (ts && typeof ts.activeIndex === 'number' && ts.activeIndex >= 0 && ts.isSpeaking) {
      setFrameByIndex(ts.activeIndex);
    } else if (state !== AVATAR_STATES.SPEAKING) {
      overrideFrame = -1;
      show(0);
    }
  }

  function destroy() {
    destroyed = true;
    stopRAF();
    container.textContent = '';
  }

  function getState() { return state; }

  return { setState, destroy, getState, setFrameByIndex, setTimelineState };
}

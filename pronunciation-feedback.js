/**
 * Pronunciation AI Feedback Engine
 * 
 * Analyzes speech recognition results and generates targeted feedback
 * comparing expected vs actual pronunciation.
 */

// Common pronunciation mistake patterns
const MISTAKE_PATTERNS = [
  {
    id: 'word_splitting',
    test: (expected, actual) => {
      const expectedClean = expected.toLowerCase().replace(/\s+/g, '');
      const actualClean = actual.toLowerCase().replace(/\s+/g, '');
      // If actual has spaces but expected doesn't, user split the word
      return expectedClean === actualClean && actual.includes(' ') && !expected.includes(' ');
    },
    generate: (expected, actual) => ({
      type: 'error',
      title: 'Tách từ',
      message: `Bạn đọc tách thành ${actual.split(/\s+/).length} từ. Hãy nối lại: "${expected}"`,
      category: 'fluency',
    }),
  },
  {
    id: 'word_joining',
    test: (expected, actual) => {
      const expectedClean = expected.toLowerCase().replace(/\s+/g, '');
      const actualClean = actual.toLowerCase().replace(/\s+/g, '');
      return expectedClean === actualClean && !actual.includes(' ') && expected.includes(' ');
    },
    generate: (expected, actual) => ({
      type: 'error',
      title: 'Nối từ',
      message: `Bạn đọc nối các từ lại với nhau. Hãy đọc rời từng từ: "${expected}"`,
      category: 'fluency',
    }),
  },
  {
    id: 'missing_ending',
    test: (expected, actual) => {
      const expectedLower = expected.toLowerCase().trim();
      const actualLower = actual.toLowerCase().trim();
      // User missed the ending
      return expectedLower.length - actualLower.length >= 1 &&
        expectedLower.startsWith(actualLower) &&
        actualLower.length > 3;
    },
    generate: (expected, actual) => ({
      type: 'warning',
      title: 'Âm cuối chưa rõ',
      message: `Phần cuối của từ chưa được đọc rõ. Hãy đọc đầy đủ: "${expected}" - chú ý âm cuối "${expected.slice(actual.length)}"`,
      category: 'accuracy',
    }),
  },
  {
    id: 'extra_ending',
    test: (expected, actual) => {
      const expectedLower = expected.toLowerCase().trim();
      const actualLower = actual.toLowerCase().trim();
      return actualLower.length - expectedLower.length >= 1 &&
        actualLower.startsWith(expectedLower) &&
        expectedLower.length > 3;
    },
    generate: (expected, actual) => ({
      type: 'warning',
      title: 'Thêm âm cuối',
      message: `Bạn đọc thêm âm ở cuối từ. Dự kiến: "${expected}"`,
      category: 'accuracy',
    }),
  },
  {
    id: 'similar_sound',
    test: (expected, actual) => {
      const expectedLower = expected.toLowerCase().trim();
      const actualLower = actual.toLowerCase().trim();
      // Words differ but have high character similarity
      if (expectedLower === actualLower) return false;
      let matchCount = 0;
      const minLen = Math.min(expectedLower.length, actualLower.length);
      for (let i = 0; i < minLen; i++) {
        if (expectedLower[i] === actualLower[i]) matchCount++;
      }
      return matchCount / Math.max(expectedLower.length, actualLower.length) > 0.6;
    },
    generate: (expected, actual) => ({
      type: 'warning',
      title: 'Âm gần đúng',
      message: `Bạn đọc gần đúng nhưng chưa chính xác. Dự kiến: "${expected}", bạn đọc: "${actual}"`,
      category: 'accuracy',
    }),
  },
  {
    id: 'stress_issue',
    test: (expected, actual) => {
      // Detect if words are same but different case patterns (capitalization)
      return expected !== actual &&
        expected.toLowerCase() === actual.toLowerCase() &&
        expected.length > 3;
    },
    generate: (expected) => ({
      type: 'info',
      title: 'Chú ý trọng âm',
      message: `Từ được đọc đúng chính tả. Hãy chú ý trọng âm của từ "${expected}"`,
      category: 'fluency',
    }),
  },
];

function normalizeSpokenText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[,.!?;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compare expected vs actual text and find character-level differences
 */
function findDifferences(expected, actual) {
  const expectedLower = expected.toLowerCase();
  const actualLower = actual.toLowerCase();
  const differences = [];
  
  let expectedIndex = 0;
  let actualIndex = 0;
  
  while (expectedIndex < expectedLower.length || actualIndex < actualLower.length) {
    if (expectedIndex >= expectedLower.length || actualIndex >= actualLower.length) {
      differences.push({
        start: expectedIndex,
        end: expectedLower.length,
        expectedSlice: expectedLower.slice(expectedIndex),
        actualSlice: actualLower.slice(actualIndex),
      });
      break;
    }

    if (expectedLower[expectedIndex] === actualLower[actualIndex]) {
      expectedIndex++;
      actualIndex++;
    } else {
      // Find the mismatch range
      const startExpected = expectedIndex;
      const startActual = actualIndex;
      
      // Advance until matching again
      while (expectedIndex < expectedLower.length && 
             actualIndex < actualLower.length && 
             expectedLower[expectedIndex] !== actualLower[actualIndex]) {
        // Try to find alignment
        if (expectedIndex + 1 < expectedLower.length && 
            expectedLower[expectedIndex + 1] === actualLower[actualIndex]) {
          expectedIndex++;
        } else if (actualIndex + 1 < actualLower.length && 
                   expectedLower[expectedIndex] === actualLower[actualIndex + 1]) {
          actualIndex++;
        } else {
          expectedIndex++;
          actualIndex++;
        }
      }
      
      differences.push({
        start: startExpected,
        end: expectedIndex,
        expectedSlice: expectedLower.slice(startExpected, expectedIndex),
        actualSlice: actualLower.slice(startActual, actualIndex),
      });
    }
  }
  
  return differences;
}

/**
 * Generate AI-like feedback for speaking test result
 */
function generateFeedback(expected, actual, confidence) {
  const normalizedExpected = normalizeSpokenText(expected);
  const normalizedActual = normalizeSpokenText(actual);
  
  if (!normalizedActual) {
    return {
      overall: 'no_speech',
      messages: [{
        type: 'error',
        title: 'Không nhận diện được',
        message: 'Không phát hiện giọng nói. Vui lòng nói to và rõ hơn.',
        category: 'accuracy',
      }],
      isCorrect: false,
    };
  }
  
  const isCorrect = normalizedExpected === normalizedActual;
  
  // Check each pattern
  const messages = [];
  for (const pattern of MISTAKE_PATTERNS) {
    if (pattern.test(expected, actual)) {
      messages.push(pattern.generate(expected, actual));
    }
  }
  
  // If correct and no specific issues
  if (isCorrect && messages.length === 0) {
    if (confidence < 60) {
      messages.push({
        type: 'info',
        title: 'Độ tự tin thấp',
        message: 'Bạn đọc đúng nhưng hãy tự tin hơn khi phát âm.',
        category: 'confidence',
      });
    } else {
      messages.push({
        type: 'success',
        title: 'Phát âm chính xác',
        message: 'Bạn đã đọc rất chính xác! Tiếp tục phát huy.',
        category: 'accuracy',
      });
    }
  }
  
  // If completely wrong and no pattern matched
  if (!isCorrect && messages.length === 0) {
    const differences = findDifferences(expected, actual);
    if (differences.length > 0) {
      messages.push({
        type: 'error',
        title: 'Phát âm chưa chính xác',
        message: `Dự kiến: "${expected}". Bạn đọc: "${actual}". Hãy nghe lại và thử lại.`,
        category: 'accuracy',
        differences,
      });
    }
  }
  
  return {
    overall: isCorrect ? 'correct' : 'incorrect',
    messages,
    isCorrect,
    expected: normalizedExpected,
    actual: normalizedActual,
  };
}

/**
 * Generate feedback specifically for partially matching speech
 */
function generatePartialFeedback(expected, actual, transcriptSegments = []) {
  const feedback = generateFeedback(expected, actual, 50);
  
  // Add segment-level analysis if available
  if (transcriptSegments.length > 0) {
    feedback.segments = transcriptSegments.map((segment) => ({
      ...segment,
      matches: normalizeSpokenText(segment.text) === normalizeSpokenText(expected),
    }));
  }
  
  return feedback;
}

/**
 * Calculate pronunciation score (0-100)
 */
function calculateScore(expected, actual, confidence = 0.8) {
  const normalizedExpected = normalizeSpokenText(expected);
  const normalizedActual = normalizeSpokenText(actual);
  
  if (!normalizedActual) return 0;
  if (normalizedExpected === normalizedActual) return Math.round(confidence * 100);
  
  // Calculate Levenshtein similarity
  const maxLen = Math.max(normalizedExpected.length, normalizedActual.length);
  if (maxLen === 0) return 0;
  
  const distance = levenshteinDistance(normalizedExpected, normalizedActual);
  const similarity = (1 - distance / maxLen) * confidence * 100;
  
  return Math.max(0, Math.min(100, Math.round(similarity)));
}

function levenshteinDistance(a, b) {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

export {
  generateFeedback,
  generatePartialFeedback,
  calculateScore,
  findDifferences,
  normalizeSpokenText,
  MISTAKE_PATTERNS,
};

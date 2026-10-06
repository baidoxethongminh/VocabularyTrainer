/**
 * AI Expansion Pipeline — Meaning-Centric
 *
 * Pipeline tổ chức dữ liệu theo từng nghĩa, không trộn lẫn.
 *
 * Cấu trúc meaningsAnalysis:
 *   meaningsAnalysis = [
 *     {
 *       meaning: 'giải thích',        // Vietnamese meaning
 *       pos: 'verb',                   // Part of Speech
 *       englishDefinition: '...',      // English definition
 *       ipa: '/ɪkˈspleɪn/',           // IPA (có thể khác theo nghĩa)
 *       cefr: 'B1',                    // CEFR nếu có
 *       example: 'Can you explain this to me?',
 *       synonyms: [{ word, meaning, ipa, cefr, example }],
 *       antonyms: [{ word, meaning, ipa, cefr, example }],
 *       wordFamily: [{ word, type, meaning, ipa, cefr, example }],
 *       collocations: [{ word, meaning, example }],
 *       sentencePatterns: [{ word, meaning, example }],
 *     },
 *     ...
 *   ]
 *
 * Pipeline chạy tự động, mỗi bước độc lập.
 * Kết quả được tự động điền vào giao diện để người dùng xem lại và lưu.
 */

// ============================================================
// SCHEMA DEFINITIONS
// ============================================================

const SCHEMAS = {
  meaningsAnalysis: {
    type: 'array',
    required: ['meaning', 'pos'],
    properties: {
      meaning: { type: 'string' },
      pos: { type: 'string' },
      englishDefinition: { type: 'string' },
      ipa: { type: 'string' },
      cefr: { type: 'string' },
      example: { type: 'string' },
      synonyms: { type: 'array' },
      antonyms: { type: 'array' },
      wordFamily: { type: 'array' },
      collocations: { type: 'array' },
      sentencePatterns: { type: 'array' },
      fixedPhrases: { type: 'array' },
      commonExpressions: { type: 'array' },
      commonMistakes: { type: 'array' },
      examples: { type: 'array' },
    },
  },
  basic: {
    type: 'object',
    required: ['ipa', 'meaning', 'definition', 'example'],
    properties: {
      ipa: { type: 'string' },
      meaning: { type: 'string' },
      definition: { type: 'string' },
      example: { type: 'string' },
    },
  },
  wordFamily: {
    type: 'array',
    items: {
      type: 'object',
      required: ['word', 'type', 'meaning'],
      properties: {
        word: { type: 'string' },
        type: { type: 'string' },
        meaning: { type: 'string' },
        ipa: { type: 'string' },
        cefr: { type: 'string' },
        example: { type: 'string' },
      },
    },
  },
  synonyms: {
    type: 'array',
    items: {
      type: 'object',
      required: ['word', 'meaning'],
      properties: {
        word: { type: 'string' },
        meaning: { type: 'string' },
        ipa: { type: 'string' },
        cefr: { type: 'string' },
        example: { type: 'string' },
      },
    },
  },
  antonyms: {
    type: 'array',
    items: {
      type: 'object',
      required: ['word', 'meaning'],
      properties: {
        word: { type: 'string' },
        meaning: { type: 'string' },
        ipa: { type: 'string' },
        cefr: { type: 'string' },
        example: { type: 'string' },
      },
    },
  },
  collocations: {
    type: 'array',
    items: {
      type: 'object',
      required: ['word', 'meaning'],
      properties: {
        word: { type: 'string' },
        meaning: { type: 'string' },
        example: { type: 'string' },
      },
    },
  },
  sentencePatterns: {
    type: 'array',
    items: {
      type: 'object',
      required: ['word', 'meaning', 'example'],
      properties: {
        word: { type: 'string' },
        meaning: { type: 'string' },
        example: { type: 'string' },
      },
    },
  },
};

const AI_ANALYSIS_PROMPT = `You are an English vocabulary teacher. Analyze the requested word for a Vietnamese learner who wants to understand how to use it.

Word: {{WORD}}
Meaning supplied by the learner: {{MEANING}}

Return only valid JSON, with no markdown and no text outside the JSON. Use exactly this shape:
{
  "word": "",
  "partOfSpeech": "",
  "ipa": "",
  "meanings": [{
    "vietnameseMeaning": "",
    "englishDefinition": "",
    "partOfSpeech": "",
    "synonyms": [],
    "antonyms": [],
    "wordFamily": [],
    "collocations": [{"phrase":"","meaning":"","example":"","translation":""}],
    "grammarPatterns": [{"pattern":"","explanation":"","example":"","translation":""}],
    "fixedPhrases": [{"phrase":"","meaning":"","example":"","translation":""}],
    "commonExpressions": [],
    "commonMistakes": [{"wrong":"","correct":"","explanation":""}],
    "examples": [
      {"type":"basic","sentence":"","translation":""},
      {"type":"workplace","sentence":"","translation":""},
      {"type":"pattern","sentence":"","translation":""}
    ]
  }]
}

Rules:
- Analyze only meanings directly relevant to the supplied learner meaning. Keep different meanings separate.
- In each meaning object, vietnameseMeaning is the Vietnamese Meaning: provide only 2–4 short Vietnamese equivalents that fit the English definition and context. Do not mechanically translate unrelated senses, add rare meanings, or include explanations, quotes, or extra text.
- englishDefinition must be a clear English definition for that exact meaning. vietnameseMeaning must be based on the word, part of speech, englishDefinition, and common TOEIC/workplace usage.
- Use genuinely common synonyms, antonyms, word-family members, collocations, fixed phrases, and expressions. Use [] when none is natural; never invent data.
- Every example must contain the exact word, be natural and specific, and match both the englishDefinition and Vietnamese Meaning. Include a Vietnamese translation in translation for every example; use workplace or TOEIC contexts when they fit.
- Grammar patterns must be real and useful. Explain placeholders explicitly: something means one thing/object, somebody means one person, somewhere means one place, somehow means by some method.
- For verbs, include relevant patterns such as verb + noun, verb + somebody, verb + something, verb + to V, verb + V-ing, or verb + somebody + to V only when each is actually common for this word.
- Synonyms and antonyms must match the supplied meaning, not another sense. Do not put placeholders in synonyms or word family.
- Collocation objects use phrase/meaning/example/translation. Grammar pattern objects use pattern/explanation/example/translation. All translations are Vietnamese.`;

function extractGeminiText(payload) {
  const candidate = payload?.candidates?.[0];
  if (typeof candidate?.content === 'string') return candidate.content;
  if (Array.isArray(candidate?.content?.parts)) {
    return candidate.content.parts.map((part) => part?.text || '').join('');
  }
  return String(payload?.outputText || payload?.text || '');
}

function parseAIAnalysisResponse(rawText) {
  const text = String(rawText || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Gemini không trả về JSON hợp lệ.');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_) {
    throw new Error('Gemini không trả về JSON hợp lệ.');
  }
}

async function requestAIAnalysis(word, meaning) {
  const normalizedWord = String(word).trim().toLowerCase();
  const targetedGuidance = normalizedWord === 'catalog'
    ? '\nFor catalog meaning danh mục sản phẩm, check the common collocations product catalog, online catalog, sales catalog, and catalog of products; include only those that are natural for this meaning.\n'
    : normalizedWord === 'need'
      ? '\nFor need meaning cần, separately check these useful patterns when valid: need + noun, need + somebody, need + something, need + to V, need + somebody + to V. Explain that noun is a person/thing noun, somebody is one person, and something is one thing/object. Do not put somebody or something in synonyms or wordFamily.\n'
      : '';
  const prompt = (AI_ANALYSIS_PROMPT + targetedGuidance)
    .replace('{{WORD}}', String(word).trim())
    .replace('{{MEANING}}', String(meaning || '').trim() || '(not supplied)');
  const textTestEndpoint = typeof window !== 'undefined' && window.location && /^localhost$|^127\.0\.0\.1$/.test(window.location.hostname)
    ? `http://${window.location.hostname}:3002/api/gemini/text_test`
    : '/api/gemini/text_test';
  const response = await fetch(textTestEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try { message = JSON.parse(text)?.error || message; } catch (_) {}
    throw new Error(`Gemini text proxy failed (HTTP ${response.status}): ${message}`);
  }
  let payload;
  try { payload = JSON.parse(text); } catch (_) {
    throw new Error('Gemini text proxy trả về response không hợp lệ.');
  }
  return parseAIAnalysisResponse(extractGeminiText(payload));
}

// ============================================================
// VALIDATION
// ============================================================

function validateSchema(value, schema) {
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return [];
    return value
      .map((item, index) => {
        if (typeof item !== 'object' || item === null) return null;
        const cleaned = {};
        const required = schema.items ? (schema.items.required || []) : (schema.required || []);
        for (const key of required) {
          const raw = item[key];
          if (raw === undefined || raw === null || String(raw).trim() === '') {
            return null;
          }
          cleaned[key] = String(raw).trim();
        }
        // Optional fields
        const props = schema.items ? (schema.items.properties || {}) : (schema.properties || {});
        for (const key of Object.keys(props)) {
          if (cleaned[key] !== undefined) continue;
          const raw = item[key];
          if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
            cleaned[key] = String(raw).trim();
          }
        }
        // Handle nested arrays (synonyms, antonyms, etc.)
        for (const key of ['synonyms', 'antonyms', 'wordFamily', 'collocations', 'sentencePatterns']) {
          if (Array.isArray(item[key]) && item[key].length > 0) {
            cleaned[key] = item[key];
          }
        }
        return cleaned;
      })
      .filter((item) => item !== null);
  }

  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null) {
      const empty = {};
      for (const key of schema.required || []) {
        empty[key] = '';
      }
      return empty;
    }
    const cleaned = {};
    for (const key of schema.required || []) {
      const raw = value[key];
      cleaned[key] = raw !== undefined && raw !== null ? String(raw).trim() : '';
    }
    for (const key of Object.keys(schema.properties || {})) {
      if (cleaned[key] !== undefined) continue;
      if (key === 'ipa' || key === 'definition' || key === 'example' || key === 'englishDefinition') {
        const raw = value[key];
        cleaned[key] = raw !== undefined && raw !== null ? String(raw).trim() : '';
      }
    }
    return cleaned;
  }

  return value;
}

// ============================================================
// CEFR LOOKUP — common words + heuristic
// ============================================================

const CEFR_MAP = {
  // A1 — Basic
  be: 'A1', have: 'A1', do: 'A1', say: 'A1', get: 'A1', make: 'A1', go: 'A1',
  know: 'A1', take: 'A1', see: 'A1', come: 'A1', think: 'A1', look: 'A1',
  want: 'A1', give: 'A1', use: 'A1', find: 'A1', tell: 'A1', ask: 'A1',
  work: 'A1', seem: 'A1', feel: 'A1', try: 'A1', leave: 'A1', call: 'A1',
  good: 'A1', new: 'A1', first: 'A1', last: 'A1', long: 'A1', great: 'A1',
  little: 'A1', own: 'A1', old: 'A1', right: 'A1', big: 'A1', high: 'A1',
  different: 'A1', small: 'A1', large: 'A1', next: 'A1', early: 'A1',
  young: 'A1', important: 'A1', few: 'A1', same: 'A1', able: 'A1',
  // A2
  explain: 'A2', decide: 'A2', describe: 'A2', choose: 'A2', agree: 'A2',
  answer: 'A2', believe: 'A2', remember: 'A2', follow: 'A2', help: 'A2',
  need: 'A2', start: 'A2', stop: 'A2', open: 'A2', close: 'A2', live: 'A2',
  move: 'A2', change: 'A2', allow: 'A2', finish: 'A2', happen: 'A2',
  bring: 'A2', buy: 'A2', pay: 'A2', sell: 'A2', send: 'A2', show: 'A2',
  problem: 'A2', solution: 'A2', meeting: 'A2', schedule: 'A2', deadline: 'A2',
  easy: 'A2', difficult: 'A2', happy: 'A2', ready: 'A2', sorry: 'A2',
  late: 'A2', hard: 'A2', sure: 'A2', possible: 'A2', popular: 'A2',
  // B1
  achieve: 'B1', appreciate: 'B1', avoid: 'B1', complete: 'B1', consider: 'B1',
  continue: 'B1', contribute: 'B1', convince: 'B1', discuss: 'B1', encourage: 'B1',
  establish: 'B1', examine: 'B1', expand: 'B1', expect: 'B1', express: 'B1',
  improve: 'B1', increase: 'B1', involve: 'B1', maintain: 'B1', manage: 'B1',
  occur: 'B1', participate: 'B1', perform: 'B1', prepare: 'B1', propose: 'B1',
  recognize: 'B1', recommend: 'B1', reduce: 'B1', refer: 'B1', require: 'B1',
  respond: 'B1', result: 'B1', succeed: 'B1', suggest: 'B1', support: 'B1',
  creative: 'B1', decision: 'B1', issue: 'B1', opportunity: 'B1', progress: 'B1',
  // B2
  analyze: 'B2', clarify: 'B2', collaborate: 'B2', communicate: 'B2',
  compensate: 'B2', compile: 'B2', compromise: 'B2', concentrate: 'B2',
  confirm: 'B2', confront: 'B2', consolidate: 'B2', constrain: 'B2',
  construct: 'B2', demonstrate: 'B2', implement: 'B2', incorporate: 'B2',
  initiate: 'B2', innovate: 'B2', integrate: 'B2', investigate: 'B2',
  negotiate: 'B2', prioritize: 'B2', procedure: 'B2', significant: 'B2',
  transparent: 'B2', sophisticated: 'B2', explanation: 'B2', explanatory: 'C1',
  // C1
  articulate: 'C1', comprehensive: 'C1', consequently: 'C1', consolidate: 'C1',
  contemporary: 'C1', controversial: 'C1', correspond: 'C1', elaborate: 'C1',
  facilitate: 'C1', inevitable: 'C1', methodology: 'C1', phenomenon: 'C1',
  predominantly: 'C1', profound: 'C1', substantially: 'C1',
};

function getCEFR(word) {
  const key = String(word || '').trim().toLowerCase();
  return CEFR_MAP[key] || '';
}

// ============================================================
// NETWORK HELPERS
// ============================================================

async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429 && attempt < retries) {
        // Rate limited — wait and retry
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 500));
        continue;
      }
      throw err;
    }
  }
  return null;
}

async function translateToVietnamese(text) {
  if (!text || !text.trim()) return '';
  try {
    const response = await fetchWithRetry(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|vi`
    );
    if (response && response.ok) {
      const data = await response.json();
      return (data?.responseData?.translatedText || '').trim();
    }
  } catch (_) {}
  return '';
}

async function fetchDictionaryData(word) {
  try {
    const response = await fetchWithRetry(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (response && response.ok) {
      return await response.json();
    }
  } catch (_) {}
  return null;
}

// ============================================================
// MEANING DISCOVERY — Step 1
// ============================================================

const POS_MAP = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adjective: 'Tính từ',
  adverb: 'Trạng từ',
  pronoun: 'Đại từ',
  preposition: 'Giới từ',
  conjunction: 'Liên từ',
  interjection: 'Thán từ',
  'noun (plural)': 'Danh từ (số nhiều)',
};

function mapPOS(englishPOS) {
  const key = (englishPOS || '').trim().toLowerCase();
  return POS_MAP[key] || key;
}

/**
 * Extract meanings from dictionaryapi.dev response.
 * Each meaning has: pos, englishDefinition, example, synonyms[], antonyms[]
 */
function extractMeaningsFromDictionary(apiData) {
  const results = [];
  if (!Array.isArray(apiData) || !apiData[0]) return results;

  const entry = apiData[0];
  const word = (entry.word || '').trim();

  // Extract word-level IPA
  let wordIPA = '';
  if (typeof entry.phonetic === 'string' && entry.phonetic.trim()) {
    wordIPA = entry.phonetic.trim();
  } else if (Array.isArray(entry.phonetics)) {
    const p = entry.phonetics.find((ph) => ph && typeof ph.text === 'string' && ph.text.trim());
    if (p) wordIPA = p.text.trim();
  }

  if (!Array.isArray(entry.meanings)) return results;

  for (const meaning of entry.meanings) {
    if (!meaning) continue;
    const pos = meaning.partOfSpeech || '';
    const definitions = meaning.definitions || [];

    for (const def of definitions) {
      if (!def || !def.definition) continue;
      const englishDefinition = def.definition.trim();
      const example = (def.example || '').trim();
      const synonyms = (def.synonyms || []).map((s) => String(s).trim()).filter(Boolean);
      const antonyms = (def.antonyms || []).map((a) => String(a).trim()).filter(Boolean);

      results.push({
        pos,
        englishDefinition,
        example,
        synonyms,
        antonyms,
        _wordIPA: wordIPA,
      });
    }
  }

  return results;
}

/**
 * Translate English definitions to Vietnamese.
 * Deduplicate by definition text.
 */
async function enrichMeaningsWithVietnamese(rawMeanings) {
  if (!rawMeanings.length) return [];

  // Deduplicate by definition
  const seenDefs = new Set();
  const unique = [];
  for (const m of rawMeanings) {
    const key = m.englishDefinition.toLowerCase().trim();
    if (seenDefs.has(key)) continue;
    seenDefs.add(key);
    unique.push(m);
  }

  // Translate each unique definition
  const batchSize = 3;
  const results = [];
  for (let i = 0; i < unique.length; i++) {
    const m = unique[i];
    const translation = await translateToVietnamese(m.englishDefinition);
    // Small delay to avoid rate limiting
    if (i > 0 && i % batchSize === 0) {
      await new Promise((r) => setTimeout(r, 300));
    }
    results.push({
      ...m,
      meaning: translation || '',
    });
  }

  return results;
}

// ============================================================
// PER-MEANING ENRICHMENT — Step 2
// ============================================================

/**
 * Generate extended data for a single meaning.
 */
function generatePerMeaningData(word, meaningObj) {
  const { pos, meaning, englishDefinition, example, synonyms: rawSynonyms, antonyms: rawAntonyms } = meaningObj;

  // --- Synonyms with enrichment ---
  const synonyms = (rawSynonyms || []).slice(0, 6).map((syn) => ({
    word: syn,
    meaning: '',
    ipa: '',
    cefr: getCEFR(syn),
    example: '',
  }));

  // --- Antonyms with enrichment ---
  const antonyms = (rawAntonyms || []).slice(0, 4).map((ant) => ({
    word: ant,
    meaning: '',
    ipa: '',
    cefr: getCEFR(ant),
    example: '',
  }));

  // --- Word Family ---
  const wordFamily = generateWordFamily(word, pos);

  // --- Collocations ---
  const collocations = generateCollocations(word, pos, meaning);

  // --- Sentence Patterns ---
  const sentencePatterns = generateSentencePatterns(word, pos, meaning);

  return {
    synonyms,
    antonyms,
    wordFamily,
    collocations,
    sentencePatterns,
  };
}

/**
 * Generate word family based on word and POS.
 */
function generateWordFamily(word, pos) {
  const normalizedWord = String(word || '').trim().toLowerCase();
  const families = [];

  const knownFamilies = {
    explain: [
      { word: 'explanation', type: 'Danh từ', meaning: '' },
      { word: 'explanatory', type: 'Tính từ', meaning: '' },
    ],
    decide: [
      { word: 'decision', type: 'Danh từ', meaning: '' },
      { word: 'decisive', type: 'Tính từ', meaning: '' },
    ],
    create: [
      { word: 'creation', type: 'Danh từ', meaning: '' },
      { word: 'creative', type: 'Tính từ', meaning: '' },
      { word: 'creator', type: 'Danh từ', meaning: '' },
    ],
    manage: [
      { word: 'management', type: 'Danh từ', meaning: '' },
      { word: 'manager', type: 'Danh từ', meaning: '' },
    ],
    achieve: [
      { word: 'achievement', type: 'Danh từ', meaning: '' },
      { word: 'achievable', type: 'Tính từ', meaning: '' },
    ],
    discuss: [
      { word: 'discussion', type: 'Danh từ', meaning: '' },
    ],
    inform: [
      { word: 'information', type: 'Danh từ', meaning: '' },
      { word: 'informative', type: 'Tính từ', meaning: '' },
    ],
    communicate: [
      { word: 'communication', type: 'Danh từ', meaning: '' },
      { word: 'communicative', type: 'Tính từ', meaning: '' },
    ],
    improve: [
      { word: 'improvement', type: 'Danh từ', meaning: '' },
    ],
    develop: [
      { word: 'development', type: 'Danh từ', meaning: '' },
      { word: 'developer', type: 'Danh từ', meaning: '' },
      { word: 'developing', type: 'Tính từ', meaning: '' },
    ],
    differ: [
      { word: 'difference', type: 'Danh từ', meaning: '' },
      { word: 'different', type: 'Tính từ', meaning: '' },
    ],
    success: [
      { word: 'succeed', type: 'Động từ', meaning: '' },
      { word: 'successful', type: 'Tính từ', meaning: '' },
    ],
    solution: [
      { word: 'solve', type: 'Động từ', meaning: '' },
      { word: 'solvable', type: 'Tính từ', meaning: '' },
    ],
    problem: [
      { word: 'problematic', type: 'Tính từ', meaning: '' },
    ],
    schedule: [
      { word: 'reschedule', type: 'Động từ', meaning: '' },
      { word: 'scheduled', type: 'Tính từ', meaning: '' },
    ],
    meeting: [
      { word: 'meet', type: 'Động từ', meaning: '' },
    ],
  };

  const family = knownFamilies[normalizedWord] || [];
  for (const f of family) {
    const cefr = getCEFR(f.word);
    families.push({
      word: f.word,
      type: f.type,
      meaning: f.meaning,
      ipa: '',
      cefr,
      example: '',
    });
  }

  return families;
}

/**
 * Generate collocations based on POS.
 */
function generateCollocations(word, pos, meaning) {
  const collocations = [];

  const knownCollocations = {
    explain: [
      { word: 'explain something to someone', meaning: 'giải thích điều gì với ai' },
      { word: 'explain why/how/what', meaning: 'giải thích tại sao/thế nào/cái gì' },
      { word: 'explain the reason', meaning: 'giải thích lý do' },
    ],
    decision: [
      { word: 'make a decision', meaning: 'đưa ra quyết định' },
      { word: 'reach a decision', meaning: 'đi đến quyết định' },
      { word: 'final decision', meaning: 'quyết định cuối cùng' },
    ],
    schedule: [
      { word: 'schedule a meeting', meaning: 'xếp lịch họp' },
      { word: 'schedule an appointment', meaning: 'xếp lịch hẹn' },
      { word: 'tight schedule', meaning: 'lịch trình dày đặc' },
    ],
    meeting: [
      { word: 'hold a meeting', meaning: 'tổ chức cuộc họp' },
      { word: 'attend a meeting', meaning: 'tham dự cuộc họp' },
      { word: 'cancel a meeting', meaning: 'hủy cuộc họp' },
    ],
    deadline: [
      { word: 'meet the deadline', meaning: 'kịp hạn chót' },
      { word: 'miss the deadline', meaning: 'trễ hạn chót' },
      { word: 'set a deadline', meaning: 'đặt hạn chót' },
    ],
    problem: [
      { word: 'have a problem', meaning: 'gặp vấn đề' },
      { word: 'solve a problem', meaning: 'giải quyết vấn đề' },
      { word: 'cause a problem', meaning: 'gây ra vấn đề' },
    ],
    solution: [
      { word: 'find a solution', meaning: 'tìm ra giải pháp' },
      { word: 'offer a solution', meaning: 'đưa ra giải pháp' },
      { word: 'implement a solution', meaning: 'thực hiện giải pháp' },
    ],
  };

  const normalizedWord = word.toLowerCase().trim();
  const known = knownCollocations[normalizedWord];
  if (known) {
    for (const c of known) {
      collocations.push({ ...c, example: '' });
    }
    return collocations;
  }

  // Generic collocations by POS
  if (pos === 'verb') {
    collocations.push(
      { word: `${word} something`, meaning: `${word} cái gì đó`, example: '' },
      { word: `${word} to/for someone`, meaning: `${word} cho ai`, example: '' },
    );
  } else if (pos === 'noun') {
    collocations.push(
      { word: `a ${word} of`, meaning: `một ${word} của`, example: '' },
      { word: `important ${word}`, meaning: `${word} quan trọng`, example: '' },
    );
  } else if (pos === 'adjective') {
    collocations.push(
      { word: `very ${word}`, meaning: `rất ${word}`, example: '' },
      { word: `${word} to/for`, meaning: `${word} đối với`, example: '' },
    );
  }

  return collocations;
}

/**
 * Generate sentence patterns based on POS.
 */
function generateSentencePatterns(word, pos, meaning) {
  const patterns = [];

  const knownPatterns = {
    explain: [
      { word: 'explain + something + to + someone', meaning: 'giải thích điều gì với ai' },
      { word: 'explain + that + clause', meaning: 'giải thích rằng...' },
      { word: 'explain + why/what/how + clause', meaning: 'giải thích tại sao/gì/thế nào...' },
    ],
    decision: [
      { word: 'make + a + decision', meaning: 'đưa ra quyết định' },
      { word: 'reach + a + decision', meaning: 'đi đến quyết định' },
    ],
    schedule: [
      { word: 'schedule + something + for + time', meaning: 'xếp lịch việc gì vào thời gian nào' },
      { word: 'be + scheduled + to + verb', meaning: 'được lên lịch để làm gì' },
    ],
    meeting: [
      { word: 'have + a + meeting', meaning: 'có một cuộc họp' },
      { word: 'attend + a + meeting', meaning: 'tham dự cuộc họp' },
      { word: 'in + a + meeting', meaning: 'đang trong cuộc họp' },
    ],
    problem: [
      { word: 'have + a + problem + with + something', meaning: 'gặp vấn đề với điều gì' },
      { word: 'solve + a + problem', meaning: 'giải quyết vấn đề' },
    ],
  };

  const normalizedWord = word.toLowerCase().trim();
  const known = knownPatterns[normalizedWord];
  if (known) {
    for (const p of known) {
      patterns.push({
        word: p.word,
        meaning: p.meaning,
        example: generatePatternExample(word, p.word),
      });
    }
    return patterns;
  }

  // Generic patterns by POS
  if (pos === 'verb') {
    patterns.push(
      { word: `${word} + something`, meaning: `làm gì đó với ${word}`, example: generatePatternExample(word, `${word} something`) },
      { word: `${word} + to + do + something`, meaning: `${word} để làm gì`, example: generatePatternExample(word, `${word} to do`) },
    );
  } else if (pos === 'noun') {
    patterns.push(
      { word: `a + ${word} + of + something`, meaning: `một ${word} của điều gì`, example: generatePatternExample(word, `a ${word} of`) },
      { word: `the + ${word} + is + that`, meaning: `${word} là...`, example: generatePatternExample(word, `the ${word} is that`) },
    );
  } else if (pos === 'adjective') {
    patterns.push(
      { word: `be + ${word} + to + verb`, meaning: `thì ${word} để làm gì`, example: generatePatternExample(word, `be ${word} to`) },
    );
  }

  return patterns;
}

/**
 * Generate a natural example for a pattern.
 */
function generatePatternExample(word, pattern) {
  const examples = {
    'explain something to someone': `Could you please explain this process to the team?`,
    'explain that clause': `The manager explained that the deadline had been extended.`,
    'explain why/what/how clause': `Can you explain why the project was delayed?`,
    'make a decision': `We need to make a decision before the end of the day.`,
    'reach a decision': `The committee reached a decision after a long discussion.`,
    'schedule something for time': `I'd like to schedule the meeting for next Tuesday.`,
    'be scheduled to verb': `The flight is scheduled to depart at 6 PM.`,
    'have a meeting': `We have a meeting with the client at 10 AM.`,
    'attend a meeting': `I need to attend a meeting this afternoon.`,
    'in a meeting': `She's in a meeting right now. Can I take a message?`,
    'have a problem with something': `I'm having a problem with the new software.`,
    'solve a problem': `We need to solve this problem before the launch.`,
  };

  const normalizedPattern = pattern.toLowerCase().trim();
  if (examples[normalizedPattern]) return examples[normalizedPattern];

  // Generate a simple generic example
  const base = word.charAt(0).toUpperCase() + word.slice(1);
  return `${base} is something we deal with regularly at work.`;
}

// ============================================================
// MEANING ENRICHMENT — translate synonyms/antonyms
// ============================================================

async function translateSupportList(items) {
  if (!items || !items.length) return items;
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.meaning) {
      results.push(item);
      continue;
    }
    if (item.word) {
      const translation = await translateToVietnamese(item.word);
      results.push({ ...item, meaning: translation || '' });
    } else {
      results.push(item);
    }
    if (i > 0 && i % 5 === 0) await new Promise((r) => setTimeout(r, 200));
  }
  return results;
}

// ============================================================
// FULL MEANINGS ANALYSIS PIPELINE
// ============================================================

/**
 * Step 1: Discover all meanings of a word.
 * Returns array of { pos, meaning (vi), englishDefinition, example, synonyms, antonyms, ipa }
 */
async function stepMeaningsDiscovery(word) {
  if (!word || !word.trim()) return [];

  const normalizedWord = word.trim().toLowerCase();

  // Fetch from dictionary API
  const apiData = await fetchDictionaryData(normalizedWord);
  if (!apiData) {
    // Fallback: create a single generic meaning
    const translation = await translateToVietnamese(normalizedWord);
    return [{
      pos: 'verb',
      meaning: translation || '',
      englishDefinition: `Related to ${normalizedWord}`,
      example: '',
      synonyms: [],
      antonyms: [],
      ipa: '',
    }];
  }

  // Extract raw meanings
  const rawMeanings = extractMeaningsFromDictionary(apiData);
  if (!rawMeanings.length) {
    const translation = await translateToVietnamese(normalizedWord);
    return [{
      pos: 'verb',
      meaning: translation || '',
      englishDefinition: `Related to ${normalizedWord}`,
      example: '',
      synonyms: [],
      antonyms: [],
      ipa: '',
    }];
  }

  // Enrich with Vietnamese translations
  const enrichedMeanings = await enrichMeaningsWithVietnamese(rawMeanings);

  // Deduplicate by meaning text (keep first occurrence of each meaning)
  const seenMeanings = new Set();
  const finalMeanings = [];
  for (const m of enrichedMeanings) {
    const key = (m.meaning || '').toLowerCase().trim();
    if (!key || seenMeanings.has(key)) continue;
    seenMeanings.add(key);
    finalMeanings.push({
      pos: m.pos,
      meaning: m.meaning,
      englishDefinition: m.englishDefinition,
      example: m.example,
      synonyms: m.synonyms || [],
      antonyms: m.antonyms || [],
      ipa: m._wordIPA || '',
    });
  }

  return finalMeanings;
}

/**
 * Validate and clean a meaningsAnalysis array.
 */
function validateMeaningsAnalysis(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const meaning = String(item.meaning || '').trim();
      const pos = String(item.pos || '').trim();
      if (!meaning || !pos) return null;

      const cleaned = {
        meaning,
        pos: mapPOS(pos),
        englishDefinition: String(item.englishDefinition || '').trim(),
        ipa: String(item.ipa || '').trim(),
        cefr: String(item.cefr || getCEFR(item.word) || '').trim(),
        example: String(item.example || '').trim(),
        synonyms: cleanSupportArray(item.synonyms),
        antonyms: cleanSupportArray(item.antonyms),
        wordFamily: cleanSupportArray(item.wordFamily),
        collocations: cleanSupportArray(item.collocations),
        sentencePatterns: cleanSupportArray(item.sentencePatterns),
        fixedPhrases: cleanSupportArray(item.fixedPhrases),
        commonExpressions: cleanSupportArray(item.commonExpressions),
        commonMistakes: cleanMistakeArray(item.commonMistakes),
        examples: cleanExampleArray(item.examples),
      };

      return cleaned;
    })
    .filter(Boolean);
}

function cleanMistakeArray(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    wrong: String(item?.wrong || '').trim(),
    correct: String(item?.correct || '').trim(),
    explanation: String(item?.explanation || '').trim(),
  })).filter((item) => item.wrong && item.correct);
}

function cleanExampleArray(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    type: String(item?.type || '').trim().toLowerCase(),
    sentence: String(item?.sentence || '').trim(),
    translation: String(item?.translation || '').trim(),
  })).filter((item) => item.sentence);
}

function cleanSupportArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') return { word: item.trim(), meaning: '', ipa: '', cefr: '', type: '', example: '' };
      if (!item || typeof item !== 'object') return null;
      const word = String(item.word || '').trim();
      if (!word) return null;
      return {
        word,
        meaning: String(item.meaning || '').trim(),
        ipa: String(item.ipa || '').trim(),
        cefr: String(item.cefr || '').trim(),
        type: String(item.type || '').trim(),
        example: String(item.example || '').trim(),
      };
    })
    .filter(Boolean);
}

/**
 * Step 2: Enrich each meaning with extended data.
 */
async function stepMeaningEnrichment(word, meanings) {
  if (!Array.isArray(meanings) || !meanings.length) return [];

  const enriched = [];
  for (let i = 0; i < meanings.length; i++) {
    const m = meanings[i];
    const perMeaningData = generatePerMeaningData(word, m);

    // Translate synonyms that have no meaning
    const translatedSynonyms = await translateSupportList(perMeaningData.synonyms);
    const translatedAntonyms = await translateSupportList(perMeaningData.antonyms);
    const translatedWordFamily = await translateSupportList(perMeaningData.wordFamily);
    const translatedCollocations = await translateSupportList(perMeaningData.collocations);

    enriched.push({
      ...m,
      cefr: m.cefr || getCEFR(word),
      synonyms: translatedSynonyms,
      antonyms: translatedAntonyms,
      wordFamily: translatedWordFamily,
      collocations: translatedCollocations,
      sentencePatterns: perMeaningData.sentencePatterns,
    });

    // Small delay between meanings
    if (i > 0) await new Promise((r) => setTimeout(r, 200));
  }

  return enriched;
}

/**
 * Full pipeline: discover meanings → enrich each meaning.
 */
async function generateMeaningsAnalysis(word, context = {}) {
  console.log(`[AI-Expansion] Starting meanings analysis for: ${word}`);
  const aiResult = await requestAIAnalysis(word, context.meaning || '');
  const rawMeanings = Array.isArray(aiResult.meanings) ? aiResult.meanings : [];
  const wordIPA = String(aiResult.ipa || '').trim();
  const normalized = rawMeanings.map((item) => ({
    meaning: item.vietnameseMeaning || item.meaning,
    pos: item.partOfSpeech,
    englishDefinition: item.englishDefinition || item.definition || '',
    ipa: item.ipa || wordIPA,
    synonyms: item.synonyms,
    antonyms: item.antonyms,
    wordFamily: item.wordFamily,
    collocations: (item.collocations || []).map((entry) => ({ ...entry, word: entry.phrase })),
    sentencePatterns: (item.grammarPatterns || []).map((entry) => ({
      word: entry.pattern,
      meaning: entry.explanation,
      example: entry.example,
      translation: entry.translation,
    })),
    fixedPhrases: (item.fixedPhrases || []).map((entry) => ({ ...entry, word: entry.phrase })),
    commonExpressions: (item.commonExpressions || []).map((entry) => typeof entry === 'string' ? { word: entry } : { ...entry, word: entry.phrase || entry.expression || entry.word }),
    commonMistakes: (item.commonMistakes || []).map((entry) => ({
      word: entry.wrong,
      meaning: entry.explanation,
      example: entry.correct,
    })),
    examples: item.examples,
    example: (item.examples || []).find((entry) => entry?.type === 'basic')?.sentence || '',
  }));
  return validateMeaningsAnalysis(normalized);
}

// ============================================================
// BACKWARD COMPATIBILITY — Flat steps (using meaning analysis)
// ============================================================

/**
 * Aggregate per-meaning data into flat lists.
 */
function aggregateFromMeaningsAnalysis(meaningsAnalysis) {
  const basic = { ipa: '', meaning: '', definition: '', example: '', partOfSpeech: '' };
  const synonyms = [];
  const antonyms = [];
  const wordFamily = [];
  const fixedPhrases = [];
  const collocations = [];
  const sentencePatterns = [];
  const commonExpressions = [];
  const commonMistakes = [];
  const seen = { synonyms: new Set(), antonyms: new Set(), wordFamily: new Set(), fixedPhrases: new Set(), collocations: new Set(), sentencePatterns: new Set(), commonExpressions: new Set() };

  if (!Array.isArray(meaningsAnalysis) || !meaningsAnalysis.length) {
    return { basic, synonyms, antonyms, wordFamily, fixedPhrases, collocations, sentencePatterns, commonExpressions, commonMistakes };
  }

  // Use first meaning for basic
  const first = meaningsAnalysis[0];
  basic.ipa = first.ipa || '';
  basic.partOfSpeech = first.pos || '';
  basic.meaning = first.meaning || '';
  basic.definition = first.englishDefinition || '';
  basic.example = first.example || '';

  for (const m of meaningsAnalysis) {
    // Collect example from any meaning if basic is empty
    if (!basic.example && m.example) basic.example = m.example;

    for (const syn of (m.synonyms || [])) {
      const key = syn.word.toLowerCase().trim();
      if (key && !seen.synonyms.has(key)) {
        seen.synonyms.add(key);
        synonyms.push(syn);
      }
    }
    for (const ant of (m.antonyms || [])) {
      const key = ant.word.toLowerCase().trim();
      if (key && !seen.antonyms.has(key)) {
        seen.antonyms.add(key);
        antonyms.push(ant);
      }
    }
    for (const wf of (m.wordFamily || [])) {
      const key = wf.word.toLowerCase().trim();
      if (key && !seen.wordFamily.has(key)) {
        seen.wordFamily.add(key);
        wordFamily.push(wf);
      }
    }
    for (const fp of (m.fixedPhrases || [])) {
      const key = fp.word.toLowerCase().trim();
      if (key && !seen.fixedPhrases.has(key)) {
        seen.fixedPhrases.add(key);
        fixedPhrases.push(fp);
      }
    }
    for (const col of (m.collocations || [])) {
      const key = col.word.toLowerCase().trim();
      if (key && !seen.collocations.has(key)) {
        seen.collocations.add(key);
        collocations.push(col);
      }
    }
    for (const sp of (m.sentencePatterns || [])) {
      const key = sp.word.toLowerCase().trim();
      if (key && !seen.sentencePatterns.has(key)) {
        seen.sentencePatterns.add(key);
        sentencePatterns.push(sp);
      }
    }
    for (const expression of (m.commonExpressions || [])) {
      const key = expression.word.toLowerCase().trim();
      if (key && !seen.commonExpressions.has(key)) {
        seen.commonExpressions.add(key);
        commonExpressions.push(expression);
      }
    }
    commonMistakes.push(...(m.commonMistakes || []));
  }

  return { basic, synonyms, antonyms, wordFamily, fixedPhrases, collocations, sentencePatterns, commonExpressions, commonMistakes };
}

// ============================================================
// LEGACY STEP FUNCTIONS — using meaningsAnalysis internally
// ============================================================

async function stepBasic(word, context = {}) {
  // If we have meaningsAnalysis available from context, use it
  if (context.meaningsAnalysis && Array.isArray(context.meaningsAnalysis) && context.meaningsAnalysis.length > 0) {
    const agg = aggregateFromMeaningsAnalysis(context.meaningsAnalysis);
    return validateSchema(agg.basic, SCHEMAS.basic);
  }

  // Fall back to old behavior (dictionary API)
  const normalizedWord = (word || '').trim().toLowerCase();
  let ipa = '';
  let definition = '';
  let meaning = context.meaning || '';
  let example = '';

  try {
    const apiData = await fetchDictionaryData(normalizedWord);
    if (apiData && Array.isArray(apiData) && apiData[0]) {
      const entry = apiData[0];
      if (typeof entry.phonetic === 'string' && entry.phonetic.trim()) {
        ipa = entry.phonetic.trim();
      } else if (Array.isArray(entry.phonetics)) {
        const p = entry.phonetics.find((ph) => ph && typeof ph.text === 'string' && ph.text.trim());
        if (p) ipa = p.text.trim();
      }
      for (const m of (entry.meanings || [])) {
        for (const d of (m.definitions || [])) {
          if (d && d.definition && !definition) definition = d.definition.trim();
          if (d && d.example && !example) example = d.example.trim();
        }
      }
    }
  } catch (_) {}

  if (!meaning) {
    meaning = await translateToVietnamese(normalizedWord);
  }

  const result = { ipa, meaning, definition, example };
  return validateSchema(result, SCHEMAS.basic);
}

async function stepWordFamily(word, context = {}) {
  if (context.meaningsAnalysis && Array.isArray(context.meaningsAnalysis)) {
    const agg = aggregateFromMeaningsAnalysis(context.meaningsAnalysis);
    return validateSchema(agg.wordFamily, SCHEMAS.wordFamily);
  }
  return validateSchema([], SCHEMAS.wordFamily);
}

async function stepSynonyms(word, context = {}) {
  if (context.meaningsAnalysis && Array.isArray(context.meaningsAnalysis)) {
    const agg = aggregateFromMeaningsAnalysis(context.meaningsAnalysis);
    return validateSchema(agg.synonyms, SCHEMAS.synonyms);
  }
  return validateSchema([], SCHEMAS.synonyms);
}

async function stepAntonyms(word, context = {}) {
  if (context.meaningsAnalysis && Array.isArray(context.meaningsAnalysis)) {
    const agg = aggregateFromMeaningsAnalysis(context.meaningsAnalysis);
    return validateSchema(agg.antonyms, SCHEMAS.antonyms);
  }
  return validateSchema([], SCHEMAS.antonyms);
}

async function stepCollocations(word, context = {}) {
  if (context.meaningsAnalysis && Array.isArray(context.meaningsAnalysis)) {
    const agg = aggregateFromMeaningsAnalysis(context.meaningsAnalysis);
    return validateSchema(agg.collocations, SCHEMAS.collocations);
  }
  return validateSchema([], SCHEMAS.collocations);
}

async function stepSentencePatterns(word, context = {}) {
  if (context.meaningsAnalysis && Array.isArray(context.meaningsAnalysis)) {
    const agg = aggregateFromMeaningsAnalysis(context.meaningsAnalysis);
    return validateSchema(agg.sentencePatterns, SCHEMAS.sentencePatterns);
  }
  return validateSchema([], SCHEMAS.sentencePatterns);
}

// ============================================================
// PIPELINE ORCHESTRATOR
// ============================================================

const STEP_REGISTRY = {
  meaningsAnalysis: { name: 'Meanings Analysis', fn: generateMeaningsAnalysis },
  basic: { name: 'Basic', fn: stepBasic },
  wordFamily: { name: 'Word Family', fn: stepWordFamily },
  synonyms: { name: 'Synonyms', fn: stepSynonyms },
  antonyms: { name: 'Antonyms', fn: stepAntonyms },
  collocations: { name: 'Collocations', fn: stepCollocations },
  sentencePatterns: { name: 'Sentence Patterns', fn: stepSentencePatterns },
};

const STEP_ORDER = ['meaningsAnalysis', 'basic', 'wordFamily', 'synonyms', 'antonyms', 'collocations', 'sentencePatterns'];

/**
 * Run a single step of the pipeline.
 */
async function runStep(stepKey, word, context = {}) {
  const stepDef = STEP_REGISTRY[stepKey];
  if (!stepDef) {
    return { step: stepKey, success: false, data: null, error: `Unknown step: ${stepKey}` };
  }

  try {
    console.log(`[AI-Expansion] Running step: ${stepDef.name} for word: ${word}`);
    const data = await stepDef.fn(word, context);
    return { step: stepKey, success: true, data, error: null };
  } catch (err) {
    console.error(`[AI-Expansion] Step ${stepDef.name} failed:`, err);
    return { step: stepKey, success: false, data: null, error: err.message || String(err) };
  }
}

/**
 * Run all steps sequentially.
 * meaningsAnalysis runs first; other steps use its result for context.
 */
async function generateAll(word, context = {}) {
  console.log(`[AI-Expansion] Starting generateAll for word: ${word}`);
  const results = [];
  let meaningsAnalysisResult = null;

  for (const stepKey of STEP_ORDER) {
    // Pass meaningsAnalysis as context if available
    const enrichedContext = {
      ...context,
      meaningsAnalysis: meaningsAnalysisResult,
    };
    const result = await runStep(stepKey, word, enrichedContext);
    results.push(result);

    // Store meaningsAnalysis for subsequent steps
    if (stepKey === 'meaningsAnalysis' && result.success && Array.isArray(result.data)) {
      meaningsAnalysisResult = result.data;
    }

    console.log(`[AI-Expansion] Step ${stepKey}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  }

  console.log(`[AI-Expansion] generateAll completed for word: ${word}`);
  return results;
}

/**
 * Get empty result for a step (for fallback).
 */
function getEmptyResult(stepKey) {
  const schema = SCHEMAS[stepKey];
  if (!schema) return null;
  if (schema.type === 'array') return [];
  if (schema.type === 'object') {
    const empty = {};
    for (const key of schema.required || []) empty[key] = '';
    return empty;
  }
  return null;
}

/**
 * Map step results to UI state keys.
 */
function mapResultsToUIState(results) {
  const mapping = {
    synonyms: 'synonyms',
    antonyms: 'antonyms',
    wordFamily: 'wordFamily',
    collocations: 'collocations',
    sentencePatterns: 'sentencePatterns',
    meaningsAnalysis: 'meaningsAnalysis',
    fixedPhrases: 'fixedPhrases',
    commonExpressions: 'commonExpressions',
    commonMistakes: 'commonMistakes',
  };

  const state = {};
  for (const result of results) {
    const uiKey = mapping[result.step];
    if (uiKey) {
      state[uiKey] = result.success && Array.isArray(result.data) ? result.data : [];
    }
    if (result.step === 'basic' && result.success && result.data) {
      state.basic = result.data;
    }

    // For meaningsAnalysis, also aggregate flat data
    if (result.step === 'meaningsAnalysis' && result.success && Array.isArray(result.data)) {
      const agg = aggregateFromMeaningsAnalysis(result.data);
      state._aggregated = agg;
    }
  }

  return state;
}

export {
  SCHEMAS,
  STEP_REGISTRY,
  STEP_ORDER,
  runStep,
  generateAll,
  getEmptyResult,
  mapResultsToUIState,
  validateSchema,
  generateMeaningsAnalysis,
  aggregateFromMeaningsAnalysis,
  validateMeaningsAnalysis,
  parseAIAnalysisResponse,
  stepBasic,
  stepWordFamily,
  stepSynonyms,
  stepAntonyms,
  stepCollocations,
  stepSentencePatterns,
};

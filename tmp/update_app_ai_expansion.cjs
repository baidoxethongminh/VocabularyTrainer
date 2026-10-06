const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

// 1. Replace the old applyGeneratedSupportData function
const oldFunc = content.indexOf('async function applyGeneratedSupportData(word)');
if (oldFunc === -1) { console.log('ERROR: applyGeneratedSupportData not found'); process.exit(1); }

const bindEventsPos = content.indexOf('function bindEvents()', oldFunc);
if (bindEventsPos === -1) { console.log('ERROR: bindEvents not found'); process.exit(1); }

const newCode = `// ===== AI EXPANSION PIPELINE =====

function getAIExpansionContext() {
  const word = inputWord?.value?.trim() || '';
  return {
    word,
    meaning: inputMeaning?.value?.trim() || '',
    topic: inputTopic?.value || '',
    subTopic: inputSubtopic?.value || '',
  };
}

async function handleAIStep(stepKey) {
  const ctx = getAIExpansionContext();
  if (!ctx.word) { addFeedback.textContent = 'Vui lòng nhập từ trước.'; return; }
  addFeedback.textContent = '⏳ Đang tạo ' + stepKey + '...';
  try {
    const result = await runStep(stepKey, ctx.word, ctx);
    if (result.success) {
      const uiState = mapResultsToUIState([result]);
      if (stepKey === 'basic') {
        if (result.data?.ipa) inputIpa.value = result.data.ipa;
        if (result.data?.example) inputExample.value = result.data.example;
      }
      if (uiState.synonyms) currentSupportSynonyms = mergeSupportLists(currentSupportSynonyms, uiState.synonyms);
      if (uiState.antonyms) currentSupportAntonyms = mergeSupportLists(currentSupportAntonyms, uiState.antonyms);
      if (uiState.wordFamily) currentSupportWordFamily = mergeSupportLists(currentSupportWordFamily, uiState.wordFamily);
      if (uiState.collocations) currentSupportCollocations = mergeSupportLists(currentSupportCollocations, uiState.collocations);
      if (uiState.sentencePatterns) currentSupportSentencePatterns = mergeSupportLists(currentSupportSentencePatterns, uiState.sentencePatterns);
      renderSupportEditorSections();
      addFeedback.textContent = '✅ Đã tạo ' + stepKey + ' thành công.';
    } else {
      addFeedback.textContent = '❌ Lỗi ' + stepKey + ': ' + (result.error || 'Không xác định');
    }
  } catch (err) {
    addFeedback.textContent = '❌ Lỗi ' + stepKey + ': ' + err.message;
  }
}

async function handleGenerateAll() {
  const ctx = getAIExpansionContext();
  if (!ctx.word) { addFeedback.textContent = 'Vui lòng nhập từ trước.'; return; }
  generateSupportDataButton.disabled = true;
  generateSupportDataButton.textContent = '⏳ Đang tạo tất cả...';
  try {
    const results = await generateAll(ctx.word, ctx);
    const uiState = mapResultsToUIState(results);
    
    const basicResult = results.find(r => r.step === 'basic');
    if (basicResult?.success && basicResult.data) {
      if (basicResult.data.ipa) inputIpa.value = basicResult.data.ipa;
      if (basicResult.data.example) inputExample.value = basicResult.data.example;
    }
    
    if (uiState.synonyms && uiState.synonyms.length) currentSupportSynonyms = mergeSupportLists(currentSupportSynonyms, uiState.synonyms);
    if (uiState.antonyms && uiState.antonyms.length) currentSupportAntonyms = mergeSupportLists(currentSupportAntonyms, uiState.antonyms);
    if (uiState.wordFamily && uiState.wordFamily.length) currentSupportWordFamily = mergeSupportLists(currentSupportWordFamily, uiState.wordFamily);
    if (uiState.collocations && uiState.collocations.length) currentSupportCollocations = mergeSupportLists(currentSupportCollocations, uiState.collocations);
    if (uiState.sentencePatterns && uiState.sentencePatterns.length) currentSupportSentencePatterns = mergeSupportLists(currentSupportSentencePatterns, uiState.sentencePatterns);
    
    renderSupportEditorSections();
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    if (failCount === 0) {
      addFeedback.textContent = '✅ Hoàn thành tất cả ' + results.length + ' bước.';
    } else {
      addFeedback.textContent = '✅ ' + successCount + ' bước thành công, ' + failCount + ' bước thất bại.';
    }
  } catch (err) {
    addFeedback.textContent = '❌ Lỗi: ' + err.message;
  } finally {
    generateSupportDataButton.disabled = false;
    generateSupportDataButton.textContent = '✨ Tạo tất cả';
  }
}

`;

content = content.slice(0, oldFunc) + newCode + content.slice(bindEventsPos);

// 2. Replace the event listener for generateSupportDataButton
const oldListener = content.indexOf("generateSupportDataButton?.addEventListener('click', () => {");
if (oldListener === -1) { 
  // Try alternative pattern
  const altListener = content.indexOf("generateSupportDataButton?.addEventListener('click', ()");
  if (altListener === -1) { console.log('ERROR: old listener not found'); process.exit(1); }
  const listenerEnd2 = content.indexOf('});', altListener) + 3;
  content = content.slice(0, altListener) + "generateSupportDataButton?.addEventListener('click', handleGenerateAll);\n" + content.slice(listenerEnd2);
} else {
  const listenerEnd = content.indexOf('});', oldListener) + 3;
  content = content.slice(0, oldListener) + "generateSupportDataButton?.addEventListener('click', handleGenerateAll);\n" + content.slice(listenerEnd);
}

fs.writeFileSync('app.js', content, 'utf8');
console.log('SUCCESS: app.js updated');

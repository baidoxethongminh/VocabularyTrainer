# Refactor Plan: Tối giản giao diện Add Vocabulary

## Root cause
- 2 nút AI trùng chức năng (✨ Tự động ở IPA, ✨ Tạo tất cả ở AI Expansion)
- AI Expansion card chiếm nhiều diện tích
- Form quá dài, nhiều khoảng trắng
- Cognitive load cao vì người dùng không biết nên bấm nút nào

## Changes

### index.html
1. **Thêm nút ✨ AI Generate sau Word field** — thay thế cả 2 nút cũ
2. **IPA field: bỏ auto-fill button** — thành plain input
3. **Xóa AI Expansion card** (`.support-section` wrapper có title + button)
4. **Xóa text inputs trùng**: Synonyms, Antonyms, Word Family (editor sections đã cover)
5. **Giữ lại Fixed Phrases** text input (không có editor section tương ứng)
6. **Reorder fields**: Topic → SubTopic → Type → Word + AI → Meaning → IPA → Examples → ai-expansion-editor → Save
7. **Giảm padding/margin** trong CSS

### app.js
1. **Thêm `aiGenerateBtn`** reference (`btn-ai-generate`)
2. **Loại bỏ** `generateSupportDataButton` reference (element bị xóa)
3. **Loại bỏ** `inputSynonyms`, `inputAntonyms`, `inputWordFamily` references
4. **`handleGenerateAll`**: đổi `generateSupportDataButton` → `aiGenerateBtn`
5. **`startEditMode`**: guard/remove lines set values on removed inputs
6. **`clearAddFormInputFields`**: remove clearing of removed inputs
7. **`syncSupportInputFields`**: remove lines for removed inputs
8. **Submit handler**: đã có optional chaining, an toàn

### style.css
1. Giảm `.page-card` padding: 24 → 16px
2. Giảm `.form-grid` gap: 18 → 12px
3. Giảm `.field-card` gap: 10 → 6px
4. Giảm margin headers

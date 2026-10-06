# TRACKING MẤT DỮ LIỆU

## Phân tích luồng Save:

1. AI Generate → `handleGenerateAll()` → cập nhật `currentSupportSynonyms`, `currentSupportCollocations` v.v. ✅
2. User bấm Save → submit handler → tạo `synonyms = mergeSupportLists(currentSupportSynonyms, parsedSynonyms)` ✅
3. Gọi `addVocabularyEntry()` hoặc `updateVocabularyEntryByWord()` ✅
4. Trong đó gọi `writeWordDocument()` → `toFirestorePayload()` → **THIẾU collocations** ❌
5. Snapshot từ Firestore → ghi đè vocabularyCache bằng dữ liệu **thiếu collocations** ❌

## Lỗi tìm thấy:

### Lỗi #1 (NGHIÊM TRỌNG): `toFirestorePayload()` thiếu `collocations`
File: `storage.js` hàm `toFirestorePayload` ~dòng 276
Không có dòng `collocations: normalizeSupportObjectList(entry.collocations)`
→ Collocations KHÔNG BAO GIỜ được lưu lên Firestore

### Lỗi #2 (NGHIÊM TRỌNG): `normalizeVocabularyEntry()` thiếu `collocations` trong return object
File: `storage.js` ~dòng 228
Return object không có `collocations` (dù `...entry` spread tạm giữ)
→ Khi snapshot ghi đè, hoặc khi normalize từ form mới, collocations dễ mất

### Lỗi #3 (NGHIÊM TRỌNG): `writeWordDocument()` không update cache khi online
File: `storage.js` ~dòng 148-160
Sau `setDoc` thành công, không update `vocabularyCache` và không `persistVocabularyOfflineCache`
→ F5 ngay sau save sẽ mất dữ liệu (đọc từ offline cache cũ)

### Lỗi #4: `attachVocabularyListener()` ghi đè vocabularyCache với snapshot thiếu
File: `storage.js` ~dòng 186-203
Snapshot gọi `updateDerivedCaches(loadedEntries)` ghi đè toàn bộ cache
→ Dữ liệu mới save bị thay thế bởi dữ liệu từ snapshot (có thể cũ hơn hoặc thiếu field)

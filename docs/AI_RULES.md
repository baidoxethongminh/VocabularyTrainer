# AI_RULES.md

## 0. BẮT BUỘC

Đọc toàn bộ file này trước khi sửa bất kỳ dòng code nào.

Nếu chưa đọc xong thì KHÔNG được code.

---

# 1. KHÔNG ĐƯỢC ĐOÁN

Không được đoán.

Nếu chưa biết nguyên nhân:

- đọc code
- trace data flow
- tìm root cause

Tuyệt đối không sửa theo cảm tính.

---

# 2. ROOT CAUSE ONLY

Không vá lỗi.

Không workaround.

Không fix tạm.

Chỉ sửa nguyên nhân gốc.

Nếu chưa tìm được root cause thì tiếp tục phân tích.

---

# 3. KHÔNG REFACTOR

Nếu tôi không yêu cầu:

KHÔNG

- đổi tên biến
- đổi cấu trúc project
- tối ưu code
- format toàn bộ file
- thêm tính năng
- xóa code cũ

Chỉ sửa đúng phần liên quan.

---

# 4. KHÔNG ĐỤNG FILE KHÔNG LIÊN QUAN

Ví dụ lỗi ở

app.js

thì không được sửa

storage.js

nếu chưa chứng minh được liên quan.

---

# 5. FIRESTORE LÀ SINGLE SOURCE OF TRUTH

Không được:

- ghi LocalStorage trước
- render từ cache cũ
- overwrite Firestore

Mọi CRUD phải đi qua Firestore.

---

# 6. KHÔNG ĐƯỢC LÀM MẤT DỮ LIỆU

Tuyệt đối không:

- reset object
- reset array
- overwrite field
- xóa property

nếu chưa chứng minh là an toàn.

---

# 7. KHÔNG ĐƯỢC RESET STATE

Không được tự ý:

currentSupport = []

currentMeaningsAnalysis=[]

form.reset()

editingWord=null

nếu đang Edit.

---

# 8. KHÔNG ĐƯỢC GHI ĐÈ

Nếu object đã có

collocations

thì không được

collocations=[]

trừ khi người dùng xóa.

---

# 9. TRACE TOÀN BỘ DATA FLOW

Mỗi lần sửa phải trace

Input

↓

UI State

↓

Memory

↓

Firestore

↓

Snapshot

↓

Render

↓

Edit

↓

Save

Không được bỏ qua bước nào.

---

# 10. MỖI LẦN SỬA PHẢI BÁO CÁO

Bắt buộc báo:

Root cause

File

Function

Line

Impact

Test

---

# 11. KHÔNG ĐƯỢC TỰ Ý THÊM CODE

Nếu không cần

KHÔNG thêm

helper

wrapper

class

function

module

---

# 12. GIỮ TƯƠNG THÍCH

Không làm hỏng

API

Firestore

Local cache

UI

Event

Snapshot

---

# 13. KHÔNG LÀM HỎNG EVENT

Sau render

phải kiểm tra

onclick

addEventListener

event delegation

---

# 14. KIỂM TRA SAU MỖI LẦN CODE (BẮT BUỘC)

Sau khi sửa xong phải chạy toàn bộ kiểm tra dưới đây.

## A. Syntax

Không được kết thúc nếu còn

SyntaxError

Unexpected token

Missing )

Missing }

Missing ]

Duplicate declaration

Identifier already declared

Unexpected end of input

Parser error

## B. Build

Project phải build thành công.

Không còn lỗi compile.

## C. Console

Console phải sạch.

Không còn:

error

uncaught

promise rejection

warning nghiêm trọng

## D. Data

Kiểm tra:

Add

Edit

Delete

Reload

F5

Firestore Sync

Snapshot

Không được mất dữ liệu.

## E. AI Expansion

Sinh dữ liệu

↓

Save

↓

Reload

↓

Edit

Toàn bộ dữ liệu vẫn còn.

Bao gồm:

- meaningsAnalysis
- collocations
- sentencePatterns
- commonExpressions
- commonMistakes
- wordFamily
- synonyms
- antonyms
- examples

## F. Không phá tính năng cũ

Kiểm tra:

Learning

Testing

Topic

SubTopic

Search

Sort

Filter

Speaking

Dictation

Import

Export

Firebase

## G. Báo cáo

Cuối cùng bắt buộc ghi:

✔ Root cause

✔ Files modified

✔ Functions modified

✔ Why

✔ Test passed

✔ Remaining risk

Nếu còn bất kỳ lỗi nào thì KHÔNG được ghi "Task Completed".

Phải tiếp tục sửa cho tới khi toàn bộ kiểm tra đều PASS.
# 15. CẤM BÁO "TASK COMPLETED" KHI CHƯA KIỂM TRA

Không được báo:

- Done
- Fixed
- Task Completed

nếu chưa:

✓ chạy parser
✓ kiểm tra syntax
✓ kiểm tra console
✓ kiểm tra build
✓ kiểm tra dữ liệu
✓ kiểm tra Firestore

Nếu chưa chạy thì phải ghi:

"Code đã được sửa nhưng CHƯA được xác minh bằng việc chạy project."
# 16. PHẢI DÙNG CÔNG CỤ KIỂM TRA

Sau mỗi lần sửa code phải chạy các kiểm tra phù hợp với project.

Ví dụ:

- ESLint
- TypeScript compiler (nếu có)
- Node parser
- npm run build
- npm run test (nếu có)

Không được kết luận code đúng chỉ bằng cách đọc.

Nếu parser hoặc build báo lỗi thì phải sửa hết trước khi kết thúc.
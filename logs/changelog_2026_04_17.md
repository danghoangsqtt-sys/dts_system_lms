# Nhật ký hoạt động & Debug - Ngày 17/04/2036

## Tổng quan
Quá trình xử lý các lỗi nghiêm trọng liên quan đến Vercel build, cấu hình API, và nâng cấp kiến trúc AI cho dự án `DTS_LMS_2026`. Đặc biệt tập trung vào việc di chuyển tài nguyên từ Serverless Proxy sang kiến trúc Client-Side AI (Bluebee BYOK).

---

## 1. Sửa lỗi Vercel Build (Build Conflict)

**Tình trạng ban đầu:**
- Lỗi `npm install` trên Vercel do xung đột peer dependency giữa `vite` (v8) và `@vitejs/plugin-react` (v4.7.0).
- Hệ thống Vercel từ chối build do version mismatch.

**Xử lý:**
- Ghim cứng phiên bản Vite trong `package.json`: 
  - Đổi từ `"vite": "^5.4.2"` thành `"vite": "~5.4.2"`
- Ghim cứng phiên bản SDK Gemini:
  - Đổi `"@google/genai": "*"` thành `"@google/genai": "^1.41.0"` (Tránh Breaking API changes từ phía Google).
- Bỏ `package-lock.json` ra khỏi `.gitignore` để Vercel có thể hash deterministic dependencies, đảm bảo đồng bộ môi trường giữa Local và Serverless.

---

## 2. Tái cấu trúc Serverless API (Node.js Request Format)

**Tình trạng ban đầu:**
- Lỗi 504 Gateway Timeout trên Vercel.
- Lỗi Module Resolution: `Cannot find module '/var/task/api/_lib/keyPool'`. Vercel's Node File Tracing (NFT) bỏ qua các thư mục bắt đầu bằng dấu `_`.
- Crash ngầm 500 do sử dụng Response chuẩn Web Standard API trong môi trường Serverless Node.js cũ.

**Xử lý:**
- Đổi tên thư mục `api/_lib/` thành `api/lib/`
- Viết lại toàn bộ 7 endpoints API: `chat.ts`, `generate.ts`, `embed.ts`, `evaluate.ts`, `token.ts`, `keyPool.ts`, và `rateLimit.ts` sang chuẩn `VercelRequest` & `VercelResponse`.
- Xóa cơ chế vòng lặp Round-Robin phức tạp trong bộ nhớ đệm (vì Serverless không giữ state).
- Thêm đuôi `.js` vào ESM Strict Resolution cho file typescript.

---

## 3. Khôi phục UI (Giao diện vỡ vụn)

**Tình trạng ban đầu:**
- Màn hình vỡ Bootstrap do importmap dư thừa trong `index.html` gây xung đột.
- Fetch Local version file (`version.json`) lỗi 404 Syntax error HTML template.

**Xử lý:**
- Xóa `importmap` trong `index.html` đang chỏ tới phiên bản React / Vite online xung đột môi trường nội bộ.
- Khôi phục tag CDN cho Tailwind trong code vì dự án chưa triển khai PostCSS compiler hoàn chỉnh.
- Chuyển `version.json` vào thư mục `public/` để Vite build tự xuất file tĩnh.

---

## 4. Migration sang AI Client-Side (Kiến trúc Bluebee BYOK)

**Tình trạng ban đầu:**
- API Key (1 tài khoản duy nhất) trên máy chủ chia sẻ cho hàng tram thiết bị truy cập đồng thời, gây ra lỗi 429 Quota Exceeded.
- Thời gian chạy trên Vercel tối đa 10 giây (Tài khoản Free) thường xuyên gây chết RAG quá trình chunk.

**Xử lý (Kiến trúc tương tự dự án Bluebee LMS đã hoạt động ổn định):**
- **Migration `geminiService.ts`**: Chuyển cuộc gọi AI trực tiếp từ Browser đến máy chủ của Google API. Proxy server qua /api/ đã bị loại bỏ.
- **BYOK (Bring Your Own Key)**: Ưu tiên sử dụng Key được cấp trong LocalStorage (`DTS_GEMINI_API_KEY`). Admin/Giáo viên và học viên tự nhập key của mình trong UI Settings → Khắp phục hoàn toàn lỗi Rate Limit chung.
- **Fail-safe Logic `generateWithFallback`**: Code hiện tại có chế độ Retry Exponential Backoff (chờ 500ms, 1000ms...) khi gặp 429, và tự động chuyển model tĩnh nếu bị 503 Overloaded.
- **Model Switch**: Mặc định chạy `gemini-2.5-flash`, tự động fallback sang `gemini-2.0-flash`.
- **RAG Local limit**: Chèn `MAX_CONTEXT_CHARS` max 600K chars và limit 20 memory histories để tiết kiệm token và chống out of memory RAM.
- **`documentProcessor.ts`**: Nhúng mô hình tạo vec-tơ tương tự logic gọi client thay cho `fetch(/api/ai/embed)`.

---

## Hướng dẫn cập nhật Vercel Environment (Bảo trì)
Sử dụng cấu hình fallback nếu người dùng chưa nhập Key cá nhân:
Di chuyển vào Vercel > Settings > Environment Variables:
- Bổ sung khoá `VITE_GEMINI_API_KEY` (Bắt buộc phải có chữ `VITE_` để web App hiểu).

## Kết quả
- Build Thành công trên Vercel
- Tất cả chức năng AI đã hoạt động trở lại. Code Base đã được merge.

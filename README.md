# 🎓 DHSYSTEM LMS - Nền Tảng Học Tập & Thi Trực Tuyến Toàn Diện

![LMS Banner](https://img.shields.io/badge/DHSYSTEM-E--Learning_Platform-14452F?style=for-the-badge&logo=react)
![Version](https://img.shields.io/badge/Version-2.0.0-blue?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Appwrite](https://img.shields.io/badge/Appwrite-F02E65?style=flat-square&logo=appwrite&logoColor=white)

**DHSYSTEM LMS** là một hệ thống quản lý học tập (Learning Management System) tiên tiến, được thiết kế để mang lại trải nghiệm giáo dục số hóa liền mạch cho cả Ban quản trị, Giảng viên và Học viên. Hệ thống kết hợp giữa công cụ kiểm tra đánh giá mạnh mẽ và môi trường biên soạn bài giảng đa phương tiện trực tiếp (Live Studio).

---

## 🌟 TÍNH NĂNG NỔI BẬT

### 1. 📝 Hệ Thống Kiểm Tra & Đánh Giá (Smart Exam Engine)
- **Đa dạng hình thức:** Hỗ trợ câu hỏi Trắc nghiệm (Multiple Choice) và Tự luận (Essay) ngay trên cùng một đề thi.
- **Bảo mật & Công bằng:** Chống gian lận với cơ chế xáo trộn câu hỏi, xáo trộn đáp án và giới hạn thời gian thực.
- **Trải nghiệm Moodle-like:** Giao diện làm bài thi chuyên nghiệp, màn hình "Review Before Submit" kiểm soát câu bỏ trống, tự động chấm điểm và trả kết quả tức thì.
- **Thống kê chuyên sâu:** Cung cấp Dashboard phân tích điểm số, tỷ lệ đúng/sai chi tiết cho Giảng viên.

### 2. 🎬 Bài Giảng Số - Live Course Studio
- **Trình soạn thảo trực tiếp (WYSIWYG):** Giảng viên có thể "vừa xây nhà, vừa ngắm nội thất", chèn link tài liệu và xem trước ngay trên một màn hình mà không cần tải lại trang.
- **Tích hợp Google Drive & YouTube an toàn:** Tự động chuyển đổi link chia sẻ thành Iframe hiển thị tĩnh, loại bỏ các thanh công cụ chỉnh sửa của Google Docs/Slides để bảo vệ file gốc tuyệt đối.
- **Smart Notes (Sổ tay thông minh):** Học viên có thể ghi chú trực tiếp dưới mỗi bài học. Dữ liệu được lưu ngầm tự động và liên kết chặt chẽ với từng tài liệu.

### 3. 📚 Thư Viện Tri Thức & RAG
- Quản lý kho tài liệu huấn luyện AI riêng biệt.
- Ngân hàng câu hỏi thông minh, phân loại theo Thư mục và Mức độ nhận thức (Bloom's Taxonomy).

### 4. 👥 Quản Lý Phân Quyền 3 Cấp Độ
- **Ban Giám Đốc (Admin):** Toàn quyền kiểm soát hệ thống, phê duyệt học viên, quản lý lớp học.
- **Giảng Viên (Teacher):** Biên soạn giáo trình, tạo đề thi, theo dõi tiến độ lớp học được phân công.
- **Học Viên (Student):** Tham gia học tập, làm bài kiểm tra, xem hồ sơ cá nhân với huy hiệu định danh lớp học rõ ràng.

---

## 🛠️ CÔNG NGHỆ SỬ DỤNG (TECH STACK)

- **Frontend Core:** React.js, TypeScript, Vite.
- **Styling:** Tailwind CSS (Responsive UI/UX).
- **Backend & Database:** Appwrite BaaS (Authentication, Databases, Storage).
- **Routing:** React Router DOM.
- **State Management & Caching:** React Hooks, Local Storage.

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT (LOCAL DEVELOPMENT)

### Yêu cầu hệ thống:
- Node.js (Phiên bản 18.x trở lên)
- Trình quản lý gói `npm` hoặc `yarn`
- Tài khoản và Project trên [Appwrite](https://appwrite.io/)

### Các bước triển khai:

1. **Clone mã nguồn dự án:**
   ```bash
   git clone <repository-url>
   cd dts_lms_2026
Cài đặt các gói thư viện (Dependencies):

Bash
npm install
Thiết lập biến môi trường:

Tạo file .env ở thư mục gốc của dự án.

Thêm các thông số kết nối đến Appwrite:

Đoạn mã
VITE_APPWRITE_ENDPOINT=[https://cloud.appwrite.io/v1](https://cloud.appwrite.io/v1)
VITE_APPWRITE_PROJECT_ID=your_project_id
VITE_APPWRITE_SERVER_API_KEY=your_secret_api_key
Khởi chạy môi trường phát triển:

Bash
npm run dev
Hệ thống sẽ chạy tại địa chỉ http://localhost:3000 (hoặc cổng được cấu hình).

Build cho môi trường Production:

Bash
npm run build
## 📂 CẤU TRÚC THƯ MỤC CHÍNH

- 📁 **components/** - *Chứa toàn bộ các Component giao diện chính*
  - 📁 **Admin/** - *Giao diện quản trị viên (Duyệt học viên, Quản lý lớp)*
  - 📁 **OnlineTest/** - *Phòng thi trực tuyến & Dashboard phân tích điểm số*
  - 📁 **Teacher/** - *Live Studio biên soạn Bài giảng số và Quản lý lớp học*
  - 📁 **QuestionGenerator/** - *Hệ thống sinh câu hỏi bằng AI và Thủ công*
- 📁 **contexts/** - *React Context quản lý trạng thái toàn cục (Auth, Theme)*
- 📁 **hooks/** - *Các Custom Hooks (Ví dụ: Nhận diện giọng nói)*
- 📁 **lib/** - *File khởi tạo và cấu hình các SDK (Appwrite Endpoint, Project ID)*
- 📁 **services/** - *Chịu trách nhiệm giao tiếp Backend*
  - 📄 `databaseService.ts` - *Xử lý logic CRUD với Appwrite Database*
  - 📄 `geminiService.ts` - *Tích hợp AI tạo câu hỏi từ văn bản*
- 📁 **types/** - *Khai báo các Interfaces/Types cho TypeScript*
- 📁 **utils/** - *Các hàm hỗ trợ tiện ích (Engine chấm điểm, Format thời gian)*
🛡️ BẢO MẬT & QUYỀN RIÊNG TƯ
Toàn bộ Document Security (Quyền Read/Write) được kiểm soát chặt chẽ trên Appwrite.

Kiến trúc cơ sở dữ liệu ngăn chặn việc Học viên truy cập chéo đề thi hoặc tài liệu khi chưa được phép hoặc chưa xuất bản.

Lọc hiển thị nội dung Google Drive an toàn (Bypass edit modes).

© Bản quyền thuộc về DHSYSTEM. Mọi hành vi sao chép mã nguồn khi chưa được phép đều vi phạm bản quyền.
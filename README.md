# Extension-TuTien (Auto Discord Bot)

Tiện ích mở rộng Chrome (Chrome Extension) tự động hóa các hành động chơi game Tu Tiên trên Discord với các tính năng điều khiển tối ưu, độ trễ, thời gian chờ và tự động làm vườn chuyên nghiệp.

---

## 🎯 Tính năng nổi bật

- **Auto Làm Vườn (Dược Viên)**: 
  - Tự động tuần tự chăm sóc cả 3 vườn: **Vườn Chế Đan** (mặc định 14 ô), **Vườn Luyện Hóa** (mặc định 14 ô), và **Vườn Quý Hiếm** (mặc định 6 ô).
  - Tự động mở menu dropdown chọn ô đất, tự động phân tích động số ô đất tối đa từ tiêu đề game (dạng `Chi Tiết Ô Đất X/Y`).
  - Tự động diệt sâu 🐛, tưới nước 💧 và bón phân 🌱 khi có yêu cầu.
  - Tự động bấm nút chuyển tiếp **Cây Tiếp** để duyệt qua các ô đất tiếp theo, có cơ chế dự phòng quay lại sảnh nếu gặp sự cố.
- **Auto Đi Bí Cảnh / Phó Bản**:
  - Tự động nhấp vào các nút cửa ưu tiên hàng đầu theo ngũ hành bát quái (`Sinh`, `Hưu`, `Cảnh`, `Khai`, `Đỗ`).
  - Ưu tiên các sự kiện ngẫu nhiên có lợi: hứng lấy linh nhũ, lắng nghe đạo pháp, phong ấn, v.v.
- **Auto Hồi Phục**: Tự động sử dụng kỹ năng hồi máu để hồi phục trạng thái khi cần thiết trước khi tiếp tục hành trình.
- **Giao Diện Logs Console Chuyên Nghiệp**: Tích hợp một khung terminal giả lập hiển thị trực tiếp lịch trình chạy bot và các trạng thái hoạt động ngay trên giao diện popup.
- **Dynamic Script Injection (Version Handshake)**: Tự động kiểm tra và cập nhật ghi đè mã nguồn mới nhất lên tab Discord đang mở mỗi khi reload tiện ích, bạn không cần phải F5 tải lại trang Discord theo cách thủ công.
- **Tùy Chỉnh Thời Gian Chờ (Delay/Cooldown)**: Điều chỉnh thời gian chờ thong thả giữa mỗi lần bấm nút để đảm bảo an toàn tối đa cho tài khoản game của bạn.

---

## 📋 Yêu cầu hệ thống

- Trình duyệt Google Chrome hoặc các trình duyệt nhân Chromium (Edge, Brave, Opera, Cốc Cốc...)
- Đã đăng nhập tài khoản Discord trên trình duyệt Chrome.

---

## 🚀 Hướng dẫn cài đặt

1. **Tải mã nguồn về máy tính**:
   - Bạn có thể tải tệp ZIP hoặc clone trực tiếp repo này về máy.

2. **Cài đặt tiện ích vào trình duyệt**:
   - Mở trình duyệt và truy cập địa chỉ: `chrome://extensions/`
   - Bật tùy chọn **Developer mode (Chế độ nhà phát triển)** ở góc trên bên phải màn hình.
   - Nhấp vào nút **Load unpacked (Tải tiện ích đã giải nén)** ở góc trên bên trái.
   - Chọn thư mục chứa toàn bộ dự án này.

3. **Kích hoạt hoạt động**:
   - Mở tab Discord trong trình duyệt của bạn và truy cập kênh game Tu Tiên.
   - Nhấp vào biểu tượng tiện ích mở rộng **Auto Tu Tiên** trên thanh công cụ trình duyệt để mở popup điều khiển.
   - Bật cấu hình mong muốn (Auto hồi máu, Auto đi bí cảnh, Auto làm vườn) rồi nhấn **Bắt đầu**.

---

## ⚙️ Cấu trúc dự án

- `manifest.json` - Tệp cấu hình phân quyền và khai báo Extension.
- `popup.html` - Giao diện điều khiển (HTML).
- `popup.css` - Kiểu dáng thiết kế giao diện (CSS).
- `popup.js` - Xử lý logic và vòng lặp đồng bộ trạng thái bot.
- `content.js` - Cầu nối tin nhắn (Isolated world) chuyển tiếp tín hiệu.
- `inject.js` - Trái tim của bot (Main world) thực hiện quét DOM, bắt sự kiện và tự động click trên Discord.
- `README.md` - Tài liệu hướng dẫn sử dụng.

---

## ⚠️ Lưu ý sử dụng
- Hãy sử dụng extension này một cách có trách nhiệm.
- Cân nhắc tăng thời gian Cooldown trong popup để giảm tần suất gửi tin nhắn, giữ tài khoản ở mức an toàn nhất.

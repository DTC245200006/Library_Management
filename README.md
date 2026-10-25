# HỆ THỐNG QUẢN LÝ THƯ VIỆN SỐ (LIBRARY MANAGEMENT SYSTEM)
> **Môn học:** Triển khai và Quản trị Hệ thống Phần mềm  
> **Đề tài 1:** Quản lý Thư viện (Mượn/trả sách, Quản lý độc giả, Quản lý sách)  
> **Kiến trúc:** Microservices bằng Docker Compose (Node.js, PostgreSQL, pgAdmin, Nginx Reverse Proxy, Prometheus, Grafana, Loki, Promtail)

---

## 1. Danh sách Dịch vụ & Cổng truy cập (Port Mappings)

| Dịch vụ | Chức năng | Cổng truy cập / Giao thức | Tài khoản mặc định |
| :--- | :--- | :--- | :--- |
| **Nginx Reverse Proxy** | Cổng vào chính duy nhất (HTTP & HTTPS) | `http://localhost:80`<br>`https://localhost:443` | - |
| **Library Web App** | Giao diện và API Quản lý thư viện | Qua Nginx hoặc nội bộ `app:3000` | - |
| **PostgreSQL 16** | Cơ sở dữ liệu quan hệ | Mạng nội bộ (`internal: true`) | `library_user` / `StrongLibPass2026!` |
| **pgAdmin 4** | Quản trị CSDL trực quan | `http://localhost:5050` | `admin@library.local` / `AdminPg2026!Secret` |
| **Prometheus** | Thu thập chỉ số hiệu năng (Metrics) | `http://localhost:9090` | - |
| **Grafana** | Bảng điều khiển trực quan hóa | `http://localhost:3001` | `admin` / `GrafanaAdmin2026!` |
| **Loki & Promtail** | Hệ thống thu thập và lưu trữ log tập trung | `http://localhost:3100` (Loki) | - |

---

## 2. Hướng dẫn Cài đặt & Khởi chạy Hệ thống

### Bước 1: Chuẩn bị file biến môi trường
```bash
cp .env.example .env
```

### Bước 2: Khởi động toàn bộ hệ thống bằng Docker Compose
```bash
docker compose up -d --build
```

Kiểm tra trạng thái các container:
```bash
docker compose ps
```
Tất cả các container phải hiển thị trạng thái `Up` (hoặc `healthy`).

---

## 3. Kiểm thử & Đánh giá Tính năng

### 3.1. Truy cập Website Quản lý Thư viện
- Mở trình duyệt truy cập: `http://localhost` hoặc `https://localhost` (chấp nhận chứng chỉ tự ký).
- Thực hiện các nghiệp vụ:
  * Thêm sách mới, tìm kiếm sách.
  * Thêm độc giả mới.
  * Lập phiếu mượn sách và bấm nút **"Trả Sách"**.

### 3.2. Quản trị Cơ sở Dữ liệu qua pgAdmin 4
- Truy cập `http://localhost:5050`. Đăng nhập với:
  * **Email:** `admin@library.local`
  * **Password:** `AdminPg2026!Secret`
- Thêm kết nối tới server PostgreSQL:
  * **Host name/address:** `postgres`
  * **Port:** `5432`
  * **Maintenance database:** `library_db`
  * **Username:** `library_user`
  * **Password:** `StrongLibPass2026!`
- Xem cấu trúc 3 bảng: `books`, `readers`, `borrow_records`.

### 3.3. Giám sát Prometheus & Grafana
- **Prometheus:** Truy cập `http://localhost:9090/targets` kiểm tra tất cả 5 jobs (`prometheus`, `library_app`, `postgres`, `nginx`, `cadvisor`) đều ở trạng thái **UP (1/1)**.
- **Grafana:** Truy cập `http://localhost:3001` (user: `admin`, pass: `GrafanaAdmin2026!`). Mở Dashboard **"Library System | Monitoring Dashboard"** để theo dõi đồ thị tài nguyên CPU, RAM, lưu lượng HTTP và DB.

### 3.4. Kiểm tra Log tập trung Loki qua LogQL
Truy cập **Grafana -> Explore** (chọn Data source là **Loki**) và chạy 3 truy vấn LogQL:
1. Xem toàn bộ log của Web Server Nginx:
   ```logql
   {job="nginx"}
   ```
2. Lọc log truy cập có phương thức HTTP GET / POST:
   ```logql
   {job="nginx", logtype="access"} |= "GET"
   ```
3. Thống kê số lượng log theo cửa sổ thời gian 5 phút:
   ```logql
   sum(count_over_time({job="nginx"}[5m]))
   ```

---

## 4. Các Biện pháp Hardening & Bảo mật Hệ thống

1. **Bảo mật Biến môi trường (.env):**
   - File `.env` chứa mật khẩu bí mật được liệt kê trong `.gitignore` và không bao giờ commit lên GitHub.
   - Xác minh: `git check-ignore .env` (kết quả trả về `.env`).
2. **Cách ly Mạng (Network Isolation):**
   - Mạng `database_net` được thiết lập `internal: true`, ngăn chặn mọi truy cập từ bên ngoài mạng Docker và ngắt kết nối trực tiếp ra Internet.
3. **Không công khai cổng PostgreSQL ra ngoài Host:**
   - Container `postgres` không bind port ra máy chủ thật, chỉ ứng dụng và exporter nội bộ mới được giao tiếp.
   - Xác minh: `docker port library_db` (kết quả trả về rỗng).
4. **Chạy ứng dụng với User Non-root:**
   - `app/Dockerfile` chỉ định `USER node` nhằm giảm thiểu rủi ro leo thang đặc quyền container.
5. **Security Headers trên Nginx:**
   - Thiết lập các tiêu đề HTTP bảo vệ: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`.
   - Xác minh: `curl -I -k https://localhost`

---

## 5. Quy trình 03 Commit trên Git theo Đề bài

- **Commit 1:** Khởi tạo ứng dụng Web Quản lý Thư viện, CSDL PostgreSQL, pgAdmin và Nginx Reverse Proxy.
- **Commit 2:** Tích hợp hệ thống giám sát Prometheus, Grafana và các Exporters.
- **Commit 3:** Tích hợp hệ thống log tập trung Loki, Promtail, LogQL và hoàn thiện Hardening.

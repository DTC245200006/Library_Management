-- Library Management System Database Schema & Initial Data
CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    isbn VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    published_year INT,
    total_copies INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS readers (
    id SERIAL PRIMARY KEY,
    card_number VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS borrow_records (
    id SERIAL PRIMARY KEY,
    book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    reader_id INT NOT NULL REFERENCES readers(id) ON DELETE CASCADE,
    borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    return_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'BORROWED', -- 'BORROWED', 'RETURNED', 'OVERDUE'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
CREATE INDEX IF NOT EXISTS idx_borrow_status ON borrow_records(status);
CREATE INDEX IF NOT EXISTS idx_readers_card ON readers(card_number);

-- Seed initial data
INSERT INTO books (isbn, title, author, category, published_year, total_copies, available_copies)
VALUES
    ('978-604-0-12345-1', 'Nhập môn Triển khai và Quản trị Hệ thống', 'TS. Hoàng Văn Tâm', 'Giáo trình CNTT', 2024, 15, 12),
    ('978-604-0-12345-2', 'Lập trình Node.js và Microservices nâng cao', 'Nguyễn Văn A', 'Lập trình', 2023, 10, 8),
    ('978-604-0-12345-3', 'Docker & Kubernetes Thực chiến từ Zero đến Pro', 'Trần Thị B', 'DevOps & Cloud', 2024, 20, 16),
    ('978-604-0-12345-4', 'Quản trị Cơ sở Dữ liệu PostgreSQL', 'Lê Văn C', 'Cơ sở dữ liệu', 2022, 12, 10),
    ('978-604-0-12345-5', 'An toàn Thông tin và Hardening Máy chủ Linux', 'Phạm Quốc D', 'Bảo mật', 2023, 8, 6),
    ('978-604-0-12345-6', 'Giám sát Hệ thống với Prometheus và Grafana', 'Vũ Hồng E', 'Giám sát & SRE', 2024, 10, 9)
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO readers (card_number, full_name, email, phone, address)
VALUES
    ('DG001', 'Lê Văn Đức', 'duc.le@ictu.edu.vn', '0912345678', 'Thái Nguyên'),
    ('DG002', 'Lê Văn Quyền', 'quyen.le@ictu.edu.vn', '0987654321', 'Hà Nội'),
    ('DG003', 'Nguyễn Hoàng Nam', 'nam.nguyen@ictu.edu.vn', '0905123456', 'Bắc Ninh'),
    ('DG004', 'Trần Thu Trang', 'trang.tran@ictu.edu.vn', '0934567890', 'Vĩnh Phúc')
ON CONFLICT (card_number) DO NOTHING;

INSERT INTO borrow_records (book_id, reader_id, borrow_date, due_date, return_date, status, notes)
VALUES
    (1, 1, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '9 days', NULL, 'BORROWED', 'Mượn phục vụ môn học TKQTHPTM'),
    (2, 2, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '1 day', NULL, 'OVERDUE', 'Cần nhắc nhở hạn trả'),
    (3, 3, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE - INTERVAL '2 days', 'RETURNED', 'Đã trả đúng hạn, sách nguyên vẹn'),
    (4, 4, CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '11 days', NULL, 'BORROWED', 'Tài liệu nghiên cứu đồ án')
ON CONFLICT DO NOTHING;

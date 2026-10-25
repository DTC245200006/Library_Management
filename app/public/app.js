// Frontend logic for Library Management System
let booksData = [];
let readersData = [];
let borrowsData = [];

// Switch Navigation Tabs
function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Set active nav button
    const buttons = document.querySelectorAll('.nav-item');
    if (tabId === 'dashboard') buttons[0].classList.add('active');
    if (tabId === 'books') buttons[1].classList.add('active');
    if (tabId === 'readers') buttons[2].classList.add('active');
    if (tabId === 'borrows') buttons[3].classList.add('active');
    if (tabId === 'system') buttons[4].classList.add('active');

    const titles = {
        dashboard: 'Tổng quan Hệ thống Thư viện',
        books: 'Quản lý Kho Sách & Đầu mục',
        readers: 'Danh sách Độc giả & Thẻ Thư viện',
        borrows: 'Quản lý Mượn và Trả Sách',
        system: 'Cấu hình Hệ thống & Bảng Giám sát'
    };
    document.getElementById('page-title').innerText = titles[tabId] || 'Quản lý Thư viện';
}

// Modal controls
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function openAddBookModal() { openModal('modal-add-book'); }
function openAddReaderModal() { openModal('modal-add-reader'); }

function openBorrowModal() {
    // Populate select options
    const bookSelect = document.getElementById('borrow-book-select');
    const readerSelect = document.getElementById('borrow-reader-select');

    bookSelect.innerHTML = '<option value="">-- Chọn sách có sẵn --</option>';
    booksData.filter(b => b.available_copies > 0).forEach(b => {
        bookSelect.innerHTML += `<option value="${b.id}">${b.title} (Còn ${b.available_copies} cuốn)</option>`;
    });

    readerSelect.innerHTML = '<option value="">-- Chọn độc giả mượn --</option>';
    readersData.forEach(r => {
        readerSelect.innerHTML += `<option value="${r.id}">${r.full_name} (${r.card_number})</option>`;
    });

    // Default due date: 14 days from now
    const next14Days = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    document.getElementById('borrow-due-date').value = next14Days;

    openModal('modal-borrow');
}

// Fetch all data
async function loadAllData() {
    await Promise.all([
        loadStats(),
        loadBooks(),
        loadReaders(),
        loadBorrows()
    ]);
}

// 1. Stats
async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('stat-books').innerText = data.total_books || 0;
        document.getElementById('stat-readers').innerText = data.total_readers || 0;
        document.getElementById('stat-borrows').innerText = data.active_borrows || 0;
        document.getElementById('stat-overdue').innerText = data.overdue_borrows || 0;
    } catch (e) {
        console.error('Lỗi khi tải thống kê:', e);
    }
}

// 2. Books
async function loadBooks(searchQuery = '') {
    try {
        const url = searchQuery ? `/api/books?search=${encodeURIComponent(searchQuery)}` : '/api/books';
        const res = await fetch(url);
        booksData = await res.json();
        renderBooksTable();
    } catch (e) {
        console.error('Lỗi khi tải sách:', e);
    }
}

function renderBooksTable() {
    const tbody = document.getElementById('books-table-body');
    if (!booksData.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Không có sách nào trong thư viện.</td></tr>';
        return;
    }

    tbody.innerHTML = booksData.map(b => `
        <tr>
            <td>#${b.id}</td>
            <td><code>${b.isbn}</code></td>
            <td><strong>${b.title}</strong></td>
            <td>${b.author}</td>
            <td><span class="stat-tag info">${b.category || 'Chung'}</span></td>
            <td>${b.published_year || '-'}</td>
            <td>
                <strong>${b.available_copies}</strong> / ${b.total_copies}
            </td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteBook(${b.id})">Xóa</button>
            </td>
        </tr>
    `).join('');
}

function handleBookSearch() {
    const q = document.getElementById('book-search').value.trim();
    loadBooks(q);
}

// 3. Readers
async function loadReaders() {
    try {
        const res = await fetch('/api/readers');
        readersData = await res.json();
        renderReadersTable();
    } catch (e) {
        console.error('Lỗi khi tải độc giả:', e);
    }
}

function renderReadersTable() {
    const tbody = document.getElementById('readers-table-body');
    if (!readersData.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Chưa có độc giả nào đăng ký.</td></tr>';
        return;
    }

    tbody.innerHTML = readersData.map(r => `
        <tr>
            <td>#${r.id}</td>
            <td><strong>${r.card_number}</strong></td>
            <td>${r.full_name}</td>
            <td>${r.email}</td>
            <td>${r.phone || '-'}</td>
            <td>${r.address || '-'}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteReader(${r.id})">Xóa</button>
            </td>
        </tr>
    `).join('');
}

// 4. Borrows
async function loadBorrows() {
    try {
        const res = await fetch('/api/borrow-records');
        borrowsData = await res.json();
        renderBorrowsTables();
    } catch (e) {
        console.error('Lỗi khi tải phiếu mượn:', e);
    }
}

function getStatusBadge(status, dueDate) {
    if (status === 'RETURNED') {
        return '<span class="badge badge-returned">Đã Trả</span>';
    }
    const isOverdue = new Date(dueDate) < new Date();
    if (status === 'OVERDUE' || isOverdue) {
        return '<span class="badge badge-overdue">Quá Hạn</span>';
    }
    return '<span class="badge badge-borrowed">Đang Mượn</span>';
}

function renderBorrowsTables() {
    const recentBody = document.getElementById('recent-borrows-body');
    const allBody = document.getElementById('all-borrows-table-body');

    if (!borrowsData.length) {
        const empty = '<tr><td colspan="8" class="text-center">Chưa có hoạt động mượn sách nào.</td></tr>';
        recentBody.innerHTML = empty;
        allBody.innerHTML = empty;
        return;
    }

    // Recent preview (top 5)
    recentBody.innerHTML = borrowsData.slice(0, 5).map(b => `
        <tr>
            <td>#PM${b.id}</td>
            <td><strong>${b.book_title}</strong></td>
            <td>${b.reader_name} (${b.card_number})</td>
            <td>${b.borrow_date ? b.borrow_date.split('T')[0] : ''}</td>
            <td>${b.due_date ? b.due_date.split('T')[0] : ''}</td>
            <td>${getStatusBadge(b.status, b.due_date)}</td>
        </tr>
    `).join('');

    // All records
    allBody.innerHTML = borrowsData.map(b => `
        <tr>
            <td>#PM${b.id}</td>
            <td><strong>${b.book_title}</strong></td>
            <td>${b.reader_name} (${b.card_number})</td>
            <td>${b.borrow_date ? b.borrow_date.split('T')[0] : ''}</td>
            <td>${b.due_date ? b.due_date.split('T')[0] : ''}</td>
            <td>${b.return_date ? b.return_date.split('T')[0] : '-'}</td>
            <td>${getStatusBadge(b.status, b.due_date)}</td>
            <td>
                ${b.status !== 'RETURNED' ? 
                    `<button class="btn btn-sm btn-success" onclick="returnBook(${b.id})">Trả Sách</button>` : 
                    '<span style="color:#64748b; font-size:0.85rem">Hoàn tất</span>'
                }
            </td>
        </tr>
    `).join('');
}

// Actions
async function submitAddBook(e) {
    e.preventDefault();
    const payload = {
        isbn: document.getElementById('book-isbn').value.trim(),
        title: document.getElementById('book-title').value.trim(),
        author: document.getElementById('book-author').value.trim(),
        category: document.getElementById('book-category').value.trim(),
        total_copies: parseInt(document.getElementById('book-copies').value, 10),
    };

    try {
        const res = await fetch('/api/books', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeModal('modal-add-book');
            document.getElementById('form-add-book').reset();
            loadAllData();
        } else {
            const err = await res.json();
            alert('Lỗi: ' + (err.error || 'Không thể thêm sách'));
        }
    } catch (e) {
        alert('Lỗi kết nối máy chủ!');
    }
}

async function submitAddReader(e) {
    e.preventDefault();
    const payload = {
        card_number: document.getElementById('reader-card').value.trim(),
        full_name: document.getElementById('reader-name').value.trim(),
        email: document.getElementById('reader-email').value.trim(),
        phone: document.getElementById('reader-phone').value.trim(),
        address: document.getElementById('reader-address').value.trim(),
    };

    try {
        const res = await fetch('/api/readers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeModal('modal-add-reader');
            document.getElementById('form-add-reader').reset();
            loadAllData();
        } else {
            const err = await res.json();
            alert('Lỗi: ' + (err.error || 'Không thể thêm độc giả'));
        }
    } catch (e) {
        alert('Lỗi kết nối máy chủ!');
    }
}

async function submitBorrow(e) {
    e.preventDefault();
    const payload = {
        book_id: parseInt(document.getElementById('borrow-book-select').value, 10),
        reader_id: parseInt(document.getElementById('borrow-reader-select').value, 10),
        due_date: document.getElementById('borrow-due-date').value,
        notes: document.getElementById('borrow-notes').value.trim(),
    };

    try {
        const res = await fetch('/api/borrow-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeModal('modal-borrow');
            document.getElementById('form-borrow').reset();
            loadAllData();
        } else {
            const err = await res.json();
            alert('Lỗi: ' + (err.error || 'Không thể tạo phiếu mượn'));
        }
    } catch (e) {
        alert('Lỗi kết nối máy chủ!');
    }
}

async function returnBook(id) {
    if (!confirm('Xác nhận độc giả đã trả sách này?')) return;
    try {
        const res = await fetch(`/api/borrow-records/${id}/return`, { method: 'PUT' });
        if (res.ok) {
            loadAllData();
        } else {
            alert('Lỗi khi trả sách!');
        }
    } catch (e) {
        alert('Lỗi kết nối máy chủ!');
    }
}

async function deleteBook(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa sách này?')) return;
    try {
        await fetch(`/api/books/${id}`, { method: 'DELETE' });
        loadAllData();
    } catch (e) {
        alert('Lỗi kết nối máy chủ!');
    }
}

async function deleteReader(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa độc giả này?')) return;
    try {
        await fetch(`/api/readers/${id}`, { method: 'DELETE' });
        loadAllData();
    } catch (e) {
        alert('Lỗi kết nối máy chủ!');
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
});

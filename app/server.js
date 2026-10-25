const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const client = require('prom-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));

// Prometheus Metrics Setup
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'library_' });

const httpRequestCounter = new client.Counter({
    name: 'library_http_requests_total',
    help: 'Total number of HTTP requests handled by the Library application',
    labelNames: ['method', 'route', 'status_code'],
});
register.registerMetric(httpRequestCounter);

const httpRequestDuration = new client.Histogram({
    name: 'library_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});
register.registerMetric(httpRequestDuration);

const borrowCounter = new client.Counter({
    name: 'library_borrow_operations_total',
    help: 'Total count of book borrow and return operations',
    labelNames: ['operation'], // 'borrow', 'return'
});
register.registerMetric(borrowCounter);

// Middleware to track request metrics
app.use((req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const durationInSeconds = diff[0] + diff[1] / 1e9;
        const route = req.route ? req.route.path : req.path;
        httpRequestCounter.inc({
            method: req.method,
            route: route,
            status_code: res.statusCode,
        });
        httpRequestDuration.observe({
            method: req.method,
            route: route,
            status_code: res.statusCode,
        }, durationInSeconds);
    });
    next();
});

// Database Connection
const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'library_db',
    user: process.env.DB_USER || 'library_user',
    password: process.env.DB_PASSWORD || 'StrongLibPass2026!',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Initialize database schema and data if not exists
async function initDb() {
    let retries = 10;
    while (retries > 0) {
        try {
            console.log(`[DB] Connecting to PostgreSQL at ${process.env.DB_HOST || 'postgres'}...`);
            const clientConn = await pool.connect();
            const sqlPath = path.join(__dirname, 'init.sql');
            if (fs.existsSync(sqlPath)) {
                const sql = fs.readFileSync(sqlPath, 'utf8');
                await clientConn.query(sql);
                console.log('[DB] Database schema and initial data initialized successfully.');
            }
            clientConn.release();
            break;
        } catch (err) {
            retries -= 1;
            console.error(`[DB] Connection failed: ${err.message}. Retries left: ${retries}`);
            if (retries === 0) {
                console.error('[DB] Could not connect to database after multiple retries.');
            } else {
                await new Promise(res => setTimeout(res, 3000));
            }
        }
    }
}
initDb();

// Prometheus Metrics Endpoint
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        res.status(500).end(err);
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'healthy', database: 'connected', timestamp: new Date() });
    } catch (err) {
        res.status(503).json({ status: 'unhealthy', database: err.message });
    }
});

// ==================== REST APIS ====================

// 1. Dashboard Statistics
app.get('/api/stats', async (req, res) => {
    try {
        const booksCount = await pool.query('SELECT COUNT(*) FROM books');
        const readersCount = await pool.query('SELECT COUNT(*) FROM readers');
        const activeBorrows = await pool.query("SELECT COUNT(*) FROM borrow_records WHERE status = 'BORROWED'");
        const overdueBorrows = await pool.query("SELECT COUNT(*) FROM borrow_records WHERE status = 'OVERDUE' OR (status = 'BORROWED' AND due_date < CURRENT_DATE)");

        res.json({
            total_books: parseInt(booksCount.rows[0].count, 10),
            total_readers: parseInt(readersCount.rows[0].count, 10),
            active_borrows: parseInt(activeBorrows.rows[0].count, 10),
            overdue_borrows: parseInt(overdueBorrows.rows[0].count, 10),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Books APIs (CRUD)
app.get('/api/books', async (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT * FROM books ORDER BY id DESC';
        let values = [];
        if (search) {
            query = 'SELECT * FROM books WHERE title ILIKE $1 OR author ILIKE $1 OR isbn ILIKE $1 ORDER BY id DESC';
            values = [`%${search}%`];
        }
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/books', async (req, res) => {
    try {
        const { isbn, title, author, category, published_year, total_copies } = req.body;
        if (!isbn || !title || !author) {
            return res.status(400).json({ error: 'ISBN, Tiêu đề và Tác giả là bắt buộc.' });
        }
        const total = parseInt(total_copies || 1, 10);
        const result = await pool.query(
            `INSERT INTO books (isbn, title, author, category, published_year, total_copies, available_copies)
             VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING *`,
            [isbn, title, author, category || 'Chung', published_year || new Date().getFullYear(), total]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/books/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM books WHERE id = $1', [id]);
        res.json({ message: 'Đã xóa sách thành công.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Readers APIs (CRUD)
app.get('/api/readers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM readers ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/readers', async (req, res) => {
    try {
        const { card_number, full_name, email, phone, address } = req.body;
        if (!card_number || !full_name || !email) {
            return res.status(400).json({ error: 'Mã thẻ, Họ tên và Email là bắt buộc.' });
        }
        const result = await pool.query(
            `INSERT INTO readers (card_number, full_name, email, phone, address)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [card_number, full_name, email, phone || '', address || '']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/readers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM readers WHERE id = $1', [id]);
        res.json({ message: 'Đã xóa độc giả thành công.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Borrow Records APIs
app.get('/api/borrow-records', async (req, res) => {
    try {
        const query = `
            SELECT br.id, br.book_id, br.reader_id, br.borrow_date, br.due_date, 
                   br.return_date, br.status, br.notes,
                   b.title as book_title, b.isbn,
                   r.full_name as reader_name, r.card_number
            FROM borrow_records br
            JOIN books b ON br.book_id = b.id
            JOIN readers r ON br.reader_id = r.id
            ORDER BY br.id DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Borrow book
app.post('/api/borrow-records', async (req, res) => {
    const clientConn = await pool.connect();
    try {
        await clientConn.query('BEGIN');
        const { book_id, reader_id, due_date, notes } = req.body;

        // Check availability
        const bookRes = await clientConn.query('SELECT available_copies FROM books WHERE id = $1 FOR UPDATE', [book_id]);
        if (bookRes.rows.length === 0) {
            await clientConn.query('ROLLBACK');
            return res.status(404).json({ error: 'Không tìm thấy sách.' });
        }
        if (bookRes.rows[0].available_copies <= 0) {
            await clientConn.query('ROLLBACK');
            return res.status(400).json({ error: 'Sách đã hết bản sao có sẵn.' });
        }

        // Deduct available
        await clientConn.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = $1', [book_id]);

        // Insert record
        const insertRes = await clientConn.query(
            `INSERT INTO borrow_records (book_id, reader_id, due_date, notes, status)
             VALUES ($1, $2, $3, $4, 'BORROWED') RETURNING *`,
            [book_id, reader_id, due_date || (new Date(Date.now() + 14 * 86400000)).toISOString().split('T')[0], notes || '']
        );

        await clientConn.query('COMMIT');
        borrowCounter.inc({ operation: 'borrow' });
        res.status(201).json(insertRes.rows[0]);
    } catch (err) {
        await clientConn.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        clientConn.release();
    }
});

// Return book
app.put('/api/borrow-records/:id/return', async (req, res) => {
    const clientConn = await pool.connect();
    try {
        await clientConn.query('BEGIN');
        const { id } = req.params;

        const recordRes = await clientConn.query('SELECT * FROM borrow_records WHERE id = $1 FOR UPDATE', [id]);
        if (recordRes.rows.length === 0) {
            await clientConn.query('ROLLBACK');
            return res.status(404).json({ error: 'Không tìm thấy phiếu mượn.' });
        }
        const record = recordRes.rows[0];
        if (record.status === 'RETURNED') {
            await clientConn.query('ROLLBACK');
            return res.status(400).json({ error: 'Phiếu này đã được trả trước đó.' });
        }

        // Return copy
        await clientConn.query('UPDATE books SET available_copies = available_copies + 1 WHERE id = $1', [record.book_id]);

        // Update record
        const updated = await clientConn.query(
            `UPDATE borrow_records SET status = 'RETURNED', return_date = CURRENT_DATE WHERE id = $1 RETURNING *`,
            [id]
        );

        await clientConn.query('COMMIT');
        borrowCounter.inc({ operation: 'return' });
        res.json(updated.rows[0]);
    } catch (err) {
        await clientConn.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        clientConn.release();
    }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[App] Library Management Server running on port ${PORT}`);
    console.log(`[App] Metrics available at http://localhost:${PORT}/metrics`);
});

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('./database');
const path = require('path');
const cors = require('cors');
app.use(express.json());
app.use(cors());

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'super_tajny_klucz_123';

// Middleware
app.use(express.json());

// Udostępnianie plików z uploads/
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer – upload plików
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, callback) => {
        callback(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// ======================================
// PROSTY ENDPOINT TESTOWY
// ======================================
app.get('/', (req, res) => {
    res.send('Backend działa 🔥');
});

// ======================================
// REJESTRACJA UŻYTKOWNIKA
// ======================================
app.post('/register', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Podaj email i hasło.' });
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return res.status(500).json({ error: 'Błąd serwera.' });
        }

        const sql = `INSERT INTO users (email, password) VALUES (?, ?)`;
        db.run(sql, [email, hash], function (err) {
            if (err) {
                return res.status(400).json({ error: 'Email już istnieje.' });
            }

            return res.json({ message: 'Użytkownik zarejestrowany.' });
        });
    });
});

// ======================================
// LOGOWANIE
// ======================================
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], (err, user) => {
        if (!user) return res.status(400).json({ error: 'Złe dane logowania.' });

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (!isMatch) return res.status(400).json({ error: 'Złe hasło.' });

            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

            return res.json({ message: 'Zalogowano.', token });
        });
    });
});

// ======================================
// MIDDLEWARE AUTORYZACJI
// ======================================
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'Brak tokenu.' });

    const token = header.replace('Bearer ', '');

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Nieprawidłowy token.' });

        req.user = decoded;
        next();
    });
}

// ======================================
// UPLOAD BITU
// ======================================
app.post('/beats/upload', authMiddleware, upload.single('beat_file'), (req, res) => {
    const { title, price } = req.body;
    const filePath = req.file.path;

    const sql = `
        INSERT INTO beats (user_id, title, price, file_path)
        VALUES (?, ?, ?, ?)
    `;
    db.run(sql, [req.user.userId, title, price, filePath], err => {
        if (err) {
            return res.status(500).json({ error: 'Błąd zapisu bitu.' });
        }

        return res.json({ message: 'Bit przesłany pomyślnie!' });
    });
});

// ======================================
// POBIERANIE LISTY BITÓW
// ======================================
app.get('/beats', (req, res) => {
    db.all(`SELECT * FROM beats`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Błąd pobierania.' });
        res.json(rows);
    });
});

// Start serwera
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});

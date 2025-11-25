const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

// ===== KONFIGURACJA POD RENDER =====
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_tajny_klucz_123';

// Middleware do JSON i formularzy
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Proste CORS (żeby frontend mógł gadać z backendem)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ===== STATYCZNE PLIKI =====

// Frontend (index.html, script.js, style.css)
app.use(express.static(path.join(__dirname, 'frontend')));

// Uploady (mp3/wav)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// ===== AUTH MIDDLEWARE =====

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Brak tokenu.' });
  }

  const token = authHeader.replace('Bearer ', '');

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Nieprawidłowy token.' });
    }

    req.user = {
      id: payload.userId,
      email: payload.email,
    };
    next();
  });
}

// ===== REJESTRACJA =====

app.post('/api/register', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Podaj email i hasło.' });
  }

  const sqlCheck = 'SELECT id FROM users WHERE email = ?';
  db.get(sqlCheck, [email], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Błąd bazy danych.' });
    }

    if (row) {
      return res
        .status(400)
        .json({ error: 'Użytkownik o takim emailu już istnieje.' });
    }

    bcrypt.hash(password, 10, (hashErr, hash) => {
      if (hashErr) {
        console.error(hashErr);
        return res
          .status(500)
          .json({ error: 'Błąd serwera przy haszowaniu hasła.' });
      }

      const insertSql = 'INSERT INTO users (email, password) VALUES (?, ?)';
      db.run(insertSql, [email, hash], function (insertErr) {
        if (insertErr) {
          console.error(insertErr);
          return res
            .status(500)
            .json({ error: 'Błąd bazy danych przy tworzeniu użytkownika.' });
        }

        return res.status(201).json({
          message: 'Utworzono użytkownika.',
          userId: this.lastID,
        });
      });
    });
  });
});

// ===== LOGOWANIE =====

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Podaj email i hasło.' });
  }

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.get(sql, [email], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Błąd bazy danych.' });
    }

    if (!user) {
      return res
        .status(400)
        .json({ error: 'Nieprawidłowy login lub hasło.' });
    }

    bcrypt.compare(password, user.password, (cmpErr, isMatch) => {
      if (cmpErr || !isMatch) {
        return res
          .status(400)
          .json({ error: 'Nieprawidłowy login lub hasło.' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Zalogowano.',
        token,
      });
    });
  });
});

// ===== MULTER – UPLOAD BITÓW =====

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
  fileFilter: (req, file, cb) => {
    // pozwólmy na audio; jak chcesz, możesz później zaostrzyć
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Dozwolone są tylko pliki audio.'), false);
    }
  },
});

// ===== ENDPOINT: UPLOAD BITU (MP3/WAV) – WYMAGA TOKENU =====

app.post(
  '/api/beats/upload',
  authMiddleware,
  upload.single('beat_file'),
  (req, res) => {
    const { title, price } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Brak pliku z bitem.' });
    }

    if (!title || !price) {
      return res.status(400).json({ error: 'Podaj tytuł i cenę.' });
    }

    const filePath = `/uploads/${file.filename}`;

    const sql =
      'INSERT INTO beats (user_id, title, price, file_path) VALUES (?, ?, ?, ?)';
    db.run(
      sql,
      [req.user.id, title, price, filePath],
      function (err) {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ error: 'Błąd bazy danych przy zapisie beata.' });
        }

        return res.status(201).json({
          message: 'Beat zapisany.',
          beat: {
            id: this.lastID,
            user_id: req.user.id,
            title,
            price,
            file_path: filePath,
          },
        });
      }
    );
  }
);

// ===== LISTA WSZYSTKICH BITÓW (PUBLICZNE) =====

app.get('/api/beats', (req, res) => {
  const sql = `
    SELECT beats.*, users.email AS owner_email
    FROM beats
    LEFT JOIN users ON beats.user_id = users.id
    ORDER BY beats.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: 'Błąd bazy danych przy pobieraniu beatów.' });
    }

    return res.json(rows);
  });
});

// ===== PROSTY TEST (np. do sprawdzenia w przeglądarce) =====

app.get('/api', (req, res) => {
  res.send('Backend działa 🔥');
});

// ===== SPA FALLBACK – zawsze zwracaj index.html dla innych ścieżek =====

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ===== START SERWERA =====

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});

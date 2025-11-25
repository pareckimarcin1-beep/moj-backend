// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const db = require('./database');

const app = express();

// PORT dla lokalnie i dla Rendera
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_tajny_klucz_123';

// ===== MIDDLEWARE =====
app.use(express.json());

// statyczne pliki z frontendu (HTML, CSS, JS, obrazki itd.)
app.use(express.static(path.join(__dirname, 'frontend')));

// ===== KONFIGURACJA MULTER (upload bitów) =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// ===== FUNKCJA AUTORYZACJI (JWT) =====
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Brak tokenu.' });
  }

  const token = authHeader.replace('Bearer ', '');

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Nieprawidłowy token.' });
    }

    // zapisujemy info o userze do req
    req.user = {
      userId: payload.userId,
      email: payload.email
    };

    next();
  });
}

// ===== PROSTY ENDPOINT TESTOWY API =====
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Backend działa 🔥' });
});

// ===== REJESTRACJA UŻYTKOWNIKA =====
app.post('/register', (req, res) => {
  const { email, password, confirmPassword, notRobot } = req.body;

  // podstawowe sprawdzenia
  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Podaj email i dwukrotnie hasło.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Hasła nie są takie same.' });
  }

  if (!notRobot) {
    return res.status(400).json({ error: 'Potwierdź, że nie jesteś robotem.' });
  }

  // sprawdź, czy email już istnieje
  const sqlCheck = 'SELECT id FROM users WHERE email = ?';
  db.get(sqlCheck, [email], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Błąd serwera przy sprawdzaniu użytkownika.' });
    }

    if (row) {
      return res.status(409).json({ error: 'Użytkownik z takim mailem już istnieje.' });
    }

    // hashujemy hasło
    bcrypt.hash(password, 10, (hashErr, hash) => {
      if (hashErr) {
        console.error(hashErr);
        return res.status(500).json({ error: 'Błąd serwera przy haszowaniu hasła.' });
      }

      const sqlInsert = 'INSERT INTO users (email, password) VALUES (?, ?)';
      db.run(sqlInsert, [email, hash], function (insertErr) {
        if (insertErr) {
          console.error(insertErr);
          return res.status(500).json({ error: 'Błąd serwera przy zapisie użytkownika.' });
        }

        return res.status(201).json({ message: 'Utworzono użytkownika.' });
      });
    });
  });
});

// ===== LOGOWANIE UŻYTKOWNIKA =====
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Podaj email i hasło.' });
  }

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.get(sql, [email], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Błąd serwera przy logowaniu.' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Nieprawidłowe dane logowania.' });
    }

    bcrypt.compare(password, user.password, (bcryptErr, isMatch) => {
      if (bcryptErr) {
        console.error(bcryptErr);
        return res.status(500).json({ error: 'Błąd serwera przy sprawdzaniu hasła.' });
      }

      if (!isMatch) {
        return res.status(401).json({ error: 'Nieprawidłowe dane logowania.' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({ message: 'Zalogowano.', token });
    });
  });
});

// ===== UPLOAD BITU (MP3/WAV) – chroniony JWT =====
app.post(
  '/beats/upload',
  authMiddleware,
  upload.single('beat_file'),
  (req, res) => {
    const { title, price } = req.body;
    const filePath = req.file ? req.file.path : null;

    if (!title || !price || !filePath) {
      return res.status(400).json({ error: 'Podaj tytuł, cenę i plik.' });
    }

    const sql =
      'INSERT INTO beats (user_id, title, price, file_path) VALUES (?, ?, ?, ?)';

    db.run(sql, [req.user.userId, title, price, filePath], function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Błąd serwera przy zapisie bitu.' });
      }

      res.status(201).json({
        message: 'Beat zapisany.',
        beatId: this.lastID
      });
    });
  }
);

// ===== LISTA BITÓW (publiczna) =====
app.get('/beats', (req, res) => {
  const sql = 'SELECT * FROM beats';

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Błąd serwera przy pobieraniu bitów.' });
    }

    res.json(rows);
  });
});

// ===== SPA FALLBACK – ZAWSZE ZWRACA index.html =====
// UWAGA: żadnych '*', żadnych '/*', tylko app.use NA KOŃCU
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ===== START SERWERA =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});

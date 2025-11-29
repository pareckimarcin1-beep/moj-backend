// =========================
//  IMPORTY
// =========================
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
//  KONFIGURACJA
// =========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serwowanie frontendu
app.use(express.static(path.join(__dirname, 'frontend')));

// Debug – loguje każde zapytanie
app.use((req, res, next) => {
  console.log('REQ:', req.method, req.url);
  next();
});

// =========================
//  ZMIENNE ENV
// =========================
const JWT_SECRET = process.env.JWT_SECRET || 'DEV_SECRET_ZMIEN_TO';
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// =========================
//  JWT
// =========================
function createJwtToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authRequired(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Brak tokenu.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Nieprawidłowy token.' });
  }
}

// =========================
//  MAILER (opcjonalny)
// =========================
let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// wysyłanie maila weryfikacyjnego
async function sendVerificationEmail(userEmail, token) {
  const verifyUrl = `${APP_URL}/api/verify-email?token=${encodeURIComponent(token)}`;

  if (!transporter) {
    console.log("=== LINK WERYFIKACYJNY ===");
    console.log(userEmail, verifyUrl);
    console.log("===========================");
    return;
  }

  await transporter.sendMail({
    from: `"Twoja Aplikacja" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: "Aktywacja konta",
    html: `<p>Kliknij link:</p><a href="${verifyUrl}">${verifyUrl}</a>`
  });
}

// =========================
//  reCAPTCHA V2 – WERYFIKACJA
// =========================
async function verifyRecaptcha(token) {
  if (!token) return false;

  const params = new URLSearchParams();
  params.append('secret', RECAPTCHA_SECRET);
  params.append('response', token);

  const googleRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body: params
  });

  const data = await googleRes.json();
  console.log("reCAPTCHA wynik:", data);

  return data.success === true;
}

// =========================
//  REJESTRACJA
// =========================
app.post('/api/register', async (req, res) => {
  console.log("PRZYSZŁO /api/register", req.body);

  const { email, password, confirmPassword, recaptchaToken } = req.body;

  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ error: "Wypełnij wszystkie pola." });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Hasła nie są takie same." });
  }

  // reCAPTCHA
  const captchaOK = await verifyRecaptcha(recaptchaToken);
  if (!captchaOK) {
    return res.status(400).json({ error: "reCAPTCHA nie została zaliczona." });
  }

  try {
    const existing = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existing) {
      return res.status(400).json({ error: "Taki email już istnieje." });
    }

    const hash = await bcrypt.hash(password, 10);

    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 24 * 60 * 60 * 1000;

    const userId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (email, password_hash, is_verified, verification_token, verification_expires)
         VALUES (?, ?, 0, ?, ?)`,
        [email, hash, token, expires],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    await sendVerificationEmail(email, token);

    res.json({ message: "Konto utworzone. Sprawdź maila.", userId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Błąd serwera." });
  }
});

// =========================
//  WERYFIKACJA MAILA
// =========================
app.get('/api/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send("Brak tokenu.");

  db.get(
    "SELECT * FROM users WHERE verification_token = ?",
    [token],
    (err, user) => {
      if (err) return res.status(500).send("Błąd serwera.");
      if (!user) return res.status(400).send("Nieprawidłowy token.");

      if (user.verification_expires < Date.now()) {
        return res.status(400).send("Token wygasł.");
      }

      db.run(
        `UPDATE users
         SET is_verified = 1, verification_token = NULL, verification_expires = NULL
         WHERE id = ?`,
        [user.id]
      );

      res.send("Email zweryfikowany! Możesz się zalogować.");
    }
  );
});

// =========================
//  LOGOWANIE
// =========================
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.status(500).json({ error: "Błąd serwera." });
    if (!user) return res.status(400).json({ error: "Nieprawidłowe dane." });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: "Nieprawidłowe dane." });

    if (!user.is_verified) {
      return res.status(403).json({ error: "Email niezweryfikowany!" });
    }

    const token = createJwtToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ message: "Zalogowano!" });
  });
});

// =========================
//  WYLOGOWANIE
// =========================
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: "Wylogowano." });
});

// =========================
//  TESTOWY ENDPOINT
// =========================
app.get('/api/secret', authRequired, (req, res) => {
  res.json({ message: `Witaj, ${req.user.email}!` });
});

// =========================
//  START
// =========================
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});

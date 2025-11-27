const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// serwujemy frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// Logowanie KAŻDEGO requestu - do debugowania
app.use((req, res, next) => {
  console.log('REQ:', req.method, req.url);
  next();
});

// serwujemy frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// ===== JWT =====
const JWT_SECRET = process.env.JWT_SECRET || 'DEV_SECRET_ZMIEN_TO';
const JWT_EXPIRES_IN = '7d';

function createJwtToken(user) {
  // zapisujemy w tokenie id i email
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function authRequired(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Brak tokenu. Zaloguj się.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Nieprawidłowy lub wygasły token.' });
  }
}

// ===== MAIL (na razie: albo SMTP, albo link w konsoli) =====
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

async function sendVerificationEmail(userEmail, token) {
  const appUrl = process.env.APP_URL || 'http://localhost:' + PORT;
  const verifyUrl = `${appUrl}/api/verify-email?token=${encodeURIComponent(token)}`;

  // Jeśli nie ma skonfigurowanego SMTP – po prostu wypisz link w konsoli
  if (!transporter) {
    console.log('=== LINK WERYFIKACYJNY DLA', userEmail, '===');
    console.log(verifyUrl);
    console.log('===========================================');
    return;
  }

  const mailOptions = {
    from: `"Twoja Aplikacja" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: 'Aktywacja konta',
    text: `Kliknij, aby aktywować konto: ${verifyUrl}`,
    html: `
      <p>Cześć!</p>
      <p>Kliknij poniższy link, aby aktywować konto:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

// ===== REJESTRACJA =====
app.post('/api/register', async (req, res) => {
  console.log('PRZYSZŁO /api/register', req.body);

  const { email, password, confirmPassword } = req.body;

  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Wypełnij wszystkie pola.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Hasła nie są takie same.' });
  }

  try {
    // Czy taki email już istnieje?
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Użytkownik z takim emailem już istnieje.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24h

    const userId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (email, password_hash, is_verified, verification_token, verification_expires)
         VALUES (?, ?, 0, ?, ?)`,
        [email, passwordHash, verificationToken, expires],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    await sendVerificationEmail(email, verificationToken);

    res.json({
      message: 'Konto utworzone. Sprawdź maila (albo konsolę serwera) i kliknij link aktywacyjny.',
      userId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera przy rejestracji.' });
  }
});

// ===== WERYFIKACJA MAILA =====
app.get('/api/verify-email', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Brak tokenu.');
  }

  db.get(
    'SELECT * FROM users WHERE verification_token = ?',
    [token],
    (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Błąd serwera.');
      }

      if (!user) {
        return res.status(400).send('Nieprawidłowy token.');
      }

      if (!user.verification_expires || user.verification_expires < Date.now()) {
        return res.status(400).send('Token wygasł. Zarejestruj się ponownie.');
      }

      db.run(
        `UPDATE users
         SET is_verified = 1,
             verification_token = NULL,
             verification_expires = NULL
         WHERE id = ?`,
        [user.id],
        (err2) => {
          if (err2) {
            console.error(err2);
            return res.status(500).send('Błąd serwera przy aktualizacji.');
          }

          res.send('Email zweryfikowany! Możesz się zalogować.');
        }
      );
    }
  );
});

// ===== LOGOWANIE =====
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Podaj email i hasło.' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Błąd serwera.' });
    }

    if (!user) {
      return res.status(400).json({ error: 'Nieprawidłowe dane logowania.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Nieprawidłowe dane logowania.' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Email nie został zweryfikowany.' });
    }

    const token = createJwtToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // na produkcji (Render + HTTPS) ustaw na true
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ message: 'Zalogowano pomyślnie.' });
  });
});

// ===== WYLOGOWANIE =====
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Wylogowano.' });
});

// ===== PRYWATNY ENDPOINT (TEST) =====
app.get('/api/secret', authRequired, (req, res) => {
  res.json({ message: `Witaj użytkowniku o id ${req.user.id} i emailu ${req.user.email}` });
});

// ===== START SERWERA =====
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});

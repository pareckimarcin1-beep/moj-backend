// script.js

// ===== WERYFIKACJA WIEKU =====
function initAgeCheck() {
  const overlay = document.getElementById('age-overlay');
  const page = document.getElementById('page-content');

  const already = localStorage.getItem('ageVerified');
  if (already === 'true') {
    if (overlay) overlay.style.display = 'none';
    if (page) page.style.display = 'block';
    return;
  }

  const yesBtn = document.getElementById('age-yes-btn');
  const noBtn = document.getElementById('age-no-btn');

  if (yesBtn) {
    yesBtn.addEventListener('click', () => {
      localStorage.setItem('ageVerified', 'true');
      if (overlay) overlay.style.display = 'none';
      if (page) page.style.display = 'block';
    });
  }

  if (noBtn) {
    noBtn.addEventListener('click', () => {
      window.location.href = 'https://google.com';
    });
  }
}

// ===== REJESTRACJA + reCAPTCHA =====
function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  const emailInput = document.getElementById('register-email');
  const pass1Input = document.getElementById('register-password');
  const pass2Input = document.getElementById('register-password2');
  const notRobotInput = document.getElementById('reg-not-robot');
  const msg = document.getElementById('reg-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (msg) {
      msg.textContent = '';
      msg.style.color = 'inherit';
    }

    const email = emailInput.value.trim();
    const password = pass1Input.value;
    const confirmPassword = pass2Input.value;
    const notRobot = notRobotInput.checked;

    if (!email || !password || !confirmPassword) {
      msg.textContent = 'Wypełnij wszystkie pola.';
      msg.style.color = 'red';
      return;
    }

    if (password !== confirmPassword) {
      msg.textContent = 'Hasła nie są takie same.';
      msg.style.color = 'red';
      return;
    }

    if (!notRobot) {
      msg.textContent = 'Zaznacz, że nie jesteś robotem (checkbox).';
      msg.style.color = 'red';
      return;
    }

    // ===== reCAPTCHA =====
    if (typeof grecaptcha === 'undefined') {
      msg.textContent = 'Błąd reCAPTCHA (skrypt się nie załadował). Odśwież stronę.';
      msg.style.color = 'red';
      return;
    }

    const recaptchaToken = grecaptcha.getResponse();
    if (!recaptchaToken) {
      msg.textContent = 'Potwierdź reCAPTCHA (kliknij "Nie jestem robotem").';
      msg.style.color = 'red';
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          confirmPassword,
          recaptchaToken,
        }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {}

      if (!res.ok) {
        msg.textContent = data.error || 'Błąd przy rejestracji.';
        msg.style.color = 'red';
        console.error('Błąd rejestracji:', data);
        return;
      }

      msg.textContent =
        data.message ||
        'Konto utworzone. Sprawdź maila / konsolę serwera (link weryfikacyjny).';
      msg.style.color = 'green';

      pass1Input.value = '';
      pass2Input.value = '';
      notRobotInput.checked = false;
      grecaptcha.reset(); // reset reCAPTCHA
    } catch (err) {
      console.error(err);
      msg.textContent = 'Błąd połączenia z serwerem.';
      msg.style.color = 'red';
    }
  });

  const googleBtn = document.getElementById('google-register-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      alert('Logowanie przez Google dodamy później 😉');
    });
  }
}

// ===== LOGOWANIE =====
function initLoginForm() {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const msg = document.getElementById('login-message');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.style.color = 'inherit';

    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      msg.textContent = 'Podaj email i hasło.';
      msg.style.color = 'red';
      return;
    }

    // --- reCAPTCHA ---
    if (typeof grecaptcha === 'undefined') {
      msg.textContent = 'Błąd reCAPTCHA (skrypt się nie załadował). Odśwież stronę.';
      msg.style.color = 'red';
      return;
    }

    const recaptchaToken = grecaptcha.getResponse();
    if (!recaptchaToken) {
      msg.textContent = 'Potwierdź reCAPTCHA (kliknij "Nie jestem robotem").';
      msg.style.color = 'red';
      return;
    }
    // -----------------

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, recaptchaToken })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || 'Błędne dane logowania.';
        msg.style.color = 'red';
        return;
      }

      msg.textContent = 'Zalogowano pomyślnie.';
      msg.style.color = 'green';

      // czyścimy captcha po udanym logowaniu
      grecaptcha.reset();
    } catch (err) {
      console.error(err);
      msg.textContent = 'Błąd połączenia z serwerem.';
      msg.style.color = 'red';
    }
  });
}

// ===== LISTA BITÓW =====
function initBeatsSection() {
  const btn = document.getElementById('load-beats-btn');
  const list = document.getElementById('beats-list');
  if (!btn || !list) return;

  btn.addEventListener('click', async () => {
    list.innerHTML = '';

    try {
      const res = await fetch('/beats');
      const data = await res.json();

      if (!Array.isArray(data)) {
        list.innerHTML = '<li>Brak danych lub błąd.</li>';
        return;
      }

      if (data.length === 0) {
        list.innerHTML = '<li>Brak bitów w bazie.</li>';
        return;
      }

      data.forEach((beat) => {
        const li = document.createElement('li');
        li.textContent = `${beat.title} — ${beat.price} zł`;
        list.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      list.innerHTML = '<li>Błąd podczas pobierania bitów.</li>';
    }
  });
}

// ===== START PO ZAŁADOWANIU =====
document.addEventListener('DOMContentLoaded', () => {
  // ...twoje initAgeCheck(), initRegisterForm() itd...

  const googleBtn = document.getElementById('google-register-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      // przekierowanie do backendu (który wysyła cię do Google)
      window.location.href = '/api/auth/google';
    });
  }
});


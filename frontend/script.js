// =========================
//  WERYFIKACJA WIEKU
// =========================
function initAgeCheck() {
  const overlay = document.getElementById('age-overlay');
  const page = document.getElementById('page-content');
  const yesBtn = document.getElementById('age-yes-btn');
  const noBtn = document.getElementById('age-no-btn');

  // Jeśli czegoś brakuje – nie rób nic, nie wywalaj błędu
  if (!overlay || !page || !yesBtn || !noBtn) {
    console.warn('Age check elements not found – skipping.');
    return;
  }

  const already = localStorage.getItem('ageVerified');
  if (already === 'true') {
    overlay.style.display = 'none';
    page.style.display = 'block';
    return;
  }

  yesBtn.addEventListener('click', () => {
    localStorage.setItem('ageVerified', 'true');
    overlay.style.display = 'none';
    page.style.display = 'block';
  });

  noBtn.addEventListener('click', () => {
    window.location.href = 'https://google.com';
  });
}

// =========================
//  REJESTRACJA
// =========================
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

    const email = (emailInput?.value || '').trim();
    const password = pass1Input?.value || '';
    const confirmPassword = pass2Input?.value || '';
    const notRobot = !!(notRobotInput && notRobotInput.checked);

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

    // reCAPTCHA – pobieramy token
    let recaptchaToken = null;
    if (typeof grecaptcha !== 'undefined') {
      recaptchaToken = grecaptcha.getResponse();
    }
    if (!recaptchaToken) {
      msg.textContent = 'Potwierdź reCAPTCHA.';
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
          recaptchaToken
        }),
      });

      let data = {};
      try { data = await res.json(); } catch (e) {}

      if (!res.ok) {
        msg.textContent = data.error || 'Błąd przy rejestracji.';
        msg.style.color = 'red';
        console.error('Błąd rejestracji:', data);
        return;
      }

      msg.textContent = data.message || 'Konto utworzone. Sprawdź maila / konsolę serwera.';
      msg.style.color = 'green';

      if (pass1Input) pass1Input.value = '';
      if (pass2Input) pass2Input.value = '';
      if (notRobotInput) notRobotInput.checked = false;
      if (typeof grecaptcha !== 'undefined') {
        grecaptcha.reset();
      }
    } catch (err) {
      console.error(err);
      msg.textContent = 'Błąd połączenia z serwerem.';
      msg.style.color = 'red';
    }
  });
}

// =========================
//  LOGOWANIE
// =========================
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const msg = document.getElementById('login-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (msg) {
      msg.textContent = '';
      msg.style.color = 'inherit';
    }

    const email = (emailInput?.value || '').trim();
    const password = passInput?.value || '';

    if (!email || !password) {
      msg.textContent = 'Podaj email i hasło.';
      msg.style.color = 'red';
      return;
    }

    // reCAPTCHA – używamy tego samego widgetu, co przy rejestracji
    let recaptchaToken = null;
    if (typeof grecaptcha !== 'undefined') {
      recaptchaToken = grecaptcha.getResponse();
    }
    if (!recaptchaToken) {
      msg.textContent = 'Potwierdź reCAPTCHA (kliknij "Nie jestem robotem").';
      msg.style.color = 'red';
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          recaptchaToken
        }),
      });

      let data = {};
      try { data = await res.json(); } catch (e) {}

      if (!res.ok) {
        msg.textContent = data.error || 'Błędne dane logowania.';
        msg.style.color = 'red';
        console.error('Błąd logowania:', data);
        return;
      }

      msg.textContent = 'Zalogowano pomyślnie.';
      msg.style.color = 'green';

      // Czyścimy tylko hasło
      if (passInput) passInput.value = '';

      if (typeof grecaptcha !== 'undefined') {
        grecaptcha.reset();
      }
    } catch (err) {
      console.error(err);
      msg.textContent = 'Błąd połączenia z serwerem.';
      msg.style.color = 'red';
    }
  });
}

// =========================
//  LISTA BITÓW (opcjonalnie)
// =========================
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

// =========================
//  GOOGLE LOGIN PRZYCISK
// =========================
function initGoogleButton() {
  const googleBtn = document.getElementById('google-register-btn');
  if (!googleBtn) return;

  googleBtn.addEventListener('click', () => {
    window.location.href = '/api/auth/google';
  });
}

// =========================
//  INICJALIZACJA
// =========================
document.addEventListener('DOMContentLoaded', () => {
  initAgeCheck();
  initRegisterForm();
  initLoginForm();
  initBeatsSection();
  initGoogleButton();
});

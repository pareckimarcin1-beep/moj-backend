// script.js

// Weryfikacja wieku
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

// Obsługa rejestracji
function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  // TU BYŁ BŁĄD: w HTML masz id="register-email", "register-password", "register-password2"
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
      if (msg) {
        msg.textContent = 'Wypełnij wszystkie pola.';
        msg.style.color = 'red';
      }
      return;
    }

    if (password !== confirmPassword) {
      if (msg) {
        msg.textContent = 'Hasła nie są takie same.';
        msg.style.color = 'red';
      }
      return;
    }

    if (!notRobot) {
      if (msg) {
        msg.textContent = 'Zaznacz, że nie jesteś robotem.';
        msg.style.color = 'red';
      }
      return;
    }

    try {
      // TU BYŁ BŁĄD: wcześniej było '/register', a backend ma '/api/register'
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {}

      if (!res.ok) {
        if (msg) {
          msg.textContent = data.error || 'Błąd przy rejestracji.';
          msg.style.color = 'red';
        }
        console.error('Błąd rejestracji:', data);
        return;
      }

      if (msg) {
        msg.textContent =
          data.message ||
          'Konto utworzone. Sprawdź maila lub konsolę serwera (link weryfikacyjny).';
        msg.style.color = 'green';
      }

      // wyczyść formularz
      pass1Input.value = '';
      pass2Input.value = '';
      notRobotInput.checked = false;
    } catch (err) {
      console.error(err);
      if (msg) {
        msg.textContent = 'Błąd połączenia z serwerem.';
        msg.style.color = 'red';
      }
    }
  });

  // Przycisk Google – na razie tylko info
  const googleBtn = document.getElementById('google-register-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      alert('Logowanie przez Google dodamy, jak skonfigurujemy konto deweloperskie Google 😉');
      // w przyszłości np.: window.location.href = '/auth/google';
    });
  }
}

// Obsługa logowania
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const msg = document.getElementById('login-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = '';

    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      if (msg) {
        msg.textContent = 'Podaj email i hasło.';
        msg.style.color = 'red';
      }
      return;
    }

    try {
      // TU BYŁ BŁĄD: wcześniej było '/login', a backend ma '/api/login'
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {}

      if (!res.ok) {
        if (msg) {
          msg.textContent = data.error || 'Błędne dane logowania.';
          msg.style.color = 'red';
        }
        console.error('Błąd logowania:', data);
        return;
      }

      if (msg) {
        msg.textContent = data.message || 'Zalogowano pomyślnie.';
        msg.style.color = 'green';
      }

      // Backend ustawia JWT w ciasteczku httpOnly,
      // więc nie musimy trzymać tokena w localStorage
      console.log('Zalogowano, odpowiedź backendu:', data);
    } catch (err) {
      console.error(err);
      if (msg) {
        msg.textContent = 'Błąd połączenia z serwerem.';
        msg.style.color = 'red';
      }
    }
  });
}

// Pobieranie listy bitów (przykład)
function initBeatsSection() {
  const btn = document.getElementById('load-beats-btn');
  const list = document.getElementById('beats-list');
  if (!btn || !list) return;

  btn.addEventListener('click', async () => {
    list.innerHTML = '';

    try {
      // to zostawiam tak jak miałeś – zakładam, że masz już backend pod /beats
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

// Inicjalizacja po załadowaniu strony
document.addEventListener('DOMContentLoaded', () => {
  initAgeCheck();
  initRegisterForm();
  initLoginForm();
  initBeatsSection();
});

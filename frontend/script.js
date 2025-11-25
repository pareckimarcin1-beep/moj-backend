// script.js

// Pomocnicza funkcja do pobierania tokena z localStorage
function getToken() {
  return localStorage.getItem('token') || null;
}

// Weryfikacja wieku
function initAgeCheck() {
  const overlay = document.getElementById('age-overlay');
  const page = document.getElementById('page-content');

  const already = localStorage.getItem('ageVerified');
  if (already === 'true') {
    overlay.style.display = 'none';
    page.style.display = 'block';
    return;
  }

  const yesBtn = document.getElementById('age-yes-btn');
  const noBtn = document.getElementById('age-no-btn');

  yesBtn.addEventListener('click', () => {
    localStorage.setItem('ageVerified', 'true');
    overlay.style.display = 'none';
    page.style.display = 'block';
  });

  noBtn.addEventListener('click', () => {
    // Możesz przekierować np. na Google albo po prostu zamknąć stronę
    window.location.href = 'https://google.com';
  });
}

// Obsługa rejestracji
function initRegisterForm() {
  const form = document.getElementById('register-form');
  const emailInput = document.getElementById('reg-email');
  const pass1Input = document.getElementById('reg-password');
  const pass2Input = document.getElementById('reg-password2');
  const notRobotInput = document.getElementById('reg-not-robot');
  const msg = document.getElementById('reg-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.style.color = 'inherit';

    const email = emailInput.value.trim();
    const password = pass1Input.value;
    const confirmPassword = pass2Input.value;
    const notRobot = notRobotInput.checked;

    if (password !== confirmPassword) {
      msg.textContent = 'Hasła nie są takie same.';
      msg.style.color = 'red';
      return;
    }

    if (!notRobot) {
      msg.textContent = 'Zaznacz, że nie jesteś robotem.';
      msg.style.color = 'red';
      return;
    }

    try {
      const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword, notRobot })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || 'Błąd przy rejestracji.';
        msg.style.color = 'red';
        return;
      }

      msg.textContent = data.message || 'Konto utworzone. Możesz się zalogować.';
      msg.style.color = 'green';

      // wyczyść formularz
      pass1Input.value = '';
      pass2Input.value = '';
      notRobotInput.checked = false;
    } catch (err) {
      console.error(err);
      msg.textContent = 'Błąd połączenia z serwerem.';
      msg.style.color = 'red';
    }
  });

  // Przycisk Google – na razie tylko info
  const googleBtn = document.getElementById('google-register-btn');
  googleBtn.addEventListener('click', () => {
    alert('Logowanie przez Google dodamy, jak skonfigurujemy konto deweloperskie Google 😉');
    // w przyszłości np.: window.location.href = '/auth/google';
  });
}

// Obsługa logowania
function initLoginForm() {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const msg = document.getElementById('login-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';

    const email = emailInput.value.trim();
    const password = passInput.value;

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || 'Błędne dane logowania.';
        msg.style.color = 'red';
        return;
      }

      msg.textContent = 'Zalogowano pomyślnie.';
      msg.style.color = 'green';

      if (data.token) {
        localStorage.setItem('token', data.token);
      }
    } catch (err) {
      console.error(err);
      msg.textContent = 'Błąd połączenia z serwerem.';
      msg.style.color = 'red';
    }
  });
}

// Pobieranie listy bitów (przykład)
function initBeatsSection() {
  const btn = document.getElementById('load-beats-btn');
  const list = document.getElementById('beats-list');

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

// Inicjalizacja po załadowaniu strony
document.addEventListener('DOMContentLoaded', () => {
  initAgeCheck();
  initRegisterForm();
  initLoginForm();
  initBeatsSection();
});

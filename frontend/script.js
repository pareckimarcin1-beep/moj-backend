// ======================================
// WERYFIKACJA WIEKU – OVERLAY 16/18+
// ======================================
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('age-overlay');
  const mainContent = document.getElementById('main-content');
  const btnYes = document.getElementById('age-yes');
  const btnNo = document.getElementById('age-no');

  if (!overlay || !mainContent || !btnYes || !btnNo) return;

  const isAdult = localStorage.getItem('isAdult');
  if (isAdult === 'true') {
    overlay.style.display = 'none';
    mainContent.style.filter = 'none';
  } else {
    mainContent.style.filter = 'blur(4px)';
  }

  btnYes.addEventListener('click', () => {
    localStorage.setItem('isAdult', 'true');
    overlay.style.display = 'none';
    mainContent.style.filter = 'none';
  });

  btnNo.addEventListener('click', () => {
    // "Nie mam" – wyrzucamy ze strony, jak chciałeś
    window.location.href = 'https://www.google.com';
  });
});

// ======================================
// LOGIKA FRONTENDU – AUTH, UPLOAD, LISTA
// ======================================

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = ''; // ten sam host co backend (Render / localhost)

  const userEmailLabel = document.getElementById('user-email-label');
  const logoutBtn = document.getElementById('logout-btn');

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const authMessage = document.getElementById('auth-message');

  const uploadForm = document.getElementById('upload-form');
  const uploadMessage = document.getElementById('upload-message');

  const beatsList = document.getElementById('beats-list');
  const refreshBeatsBtn = document.getElementById('refresh-beats');

  // ========= Helpery =========

  function getToken() {
    return localStorage.getItem('token');
  }

  function setToken(token, email) {
    localStorage.setItem('token', token);
    localStorage.setItem('email', email || '');
    updateAuthUI();
  }

  function clearToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    updateAuthUI();
  }

  function updateAuthUI() {
    const token = getToken();
    const email = localStorage.getItem('email') || '';

    if (token) {
      userEmailLabel.textContent = `Zalogowany jako: ${email}`;
      logoutBtn.style.display = 'inline-flex';
      uploadForm.style.display = 'block';
    } else {
      userEmailLabel.textContent = 'Niezalogowany';
      logoutBtn.style.display = 'none';
      uploadForm.style.display = 'none';
    }
  }

  function setMessage(el, text, type = '') {
    if (!el) return;
    el.textContent = text || '';
    el.classList.remove('error', 'success');
    if (type) el.classList.add(type);
  }

  updateAuthUI();

  // ========= Zakładki login / register =========

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      tabContents.forEach((content) => {
        content.classList.toggle('active', content.id.startsWith(tab));
      });

      setMessage(authMessage, '');
    });
  });

  // ========= Rejestracja =========

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setMessage(authMessage, 'Rejestrowanie...', '');

      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;

      try {
        const res = await fetch(`${API_BASE}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Błąd rejestracji');

        setMessage(authMessage, 'Użytkownik zarejestrowany, możesz się zalogować.', 'success');
      } catch (err) {
        setMessage(authMessage, err.message, 'error');
      }
    });
  }

  // ========= Logowanie =========

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setMessage(authMessage, 'Logowanie...', '');

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok || !data.token) {
          throw new Error(data.error || 'Błędne dane logowania');
        }

        setToken(data.token, email);
        setMessage(authMessage, 'Zalogowano pomyślnie.', 'success');
      } catch (err) {
        setMessage(authMessage, err.message, 'error');
      }
    });
  }

  // ========= Wylogowanie =========

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearToken();
      setMessage(authMessage, 'Wylogowano.', '');
    });
  }

  // ========= Upload bitu =========

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setMessage(uploadMessage, 'Wysyłanie bitu...', '');

      const token = getToken();
      if (!token) {
        setMessage(uploadMessage, 'Musisz być zalogowany.', 'error');
        return;
      }

      const title = document.getElementById('beat-title').value.trim();
      const price = document.getElementById('beat-price').value;
      const fileInput = document.getElementById('beat-file');

      if (!fileInput.files || !fileInput.files[0]) {
        setMessage(uploadMessage, 'Wybierz plik audio.', 'error');
        return;
      }

      const formData = new FormData();
      formData.append('title', title);
      formData.append('price', price);
      formData.append('beat_file', fileInput.files[0]);

      try {
        const res = await fetch(`${API_BASE}/beats/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Błąd wysyłania bitu');

        setMessage(uploadMessage, 'Bit dodany pomyślnie.', 'success');
        uploadForm.reset();
        loadBeats();
      } catch (err) {
        setMessage(uploadMessage, err.message, 'error');
      }
    });
  }

  // ========= Pobieranie listy bitów =========

  async function loadBeats() {
    if (!beatsList) return;

    beatsList.innerHTML = '<p>Ładowanie...</p>';

    try {
      const res = await fetch(`${API_BASE}/beats`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Błąd pobierania bitów');

      if (!Array.isArray(data) || data.length === 0) {
        beatsList.innerHTML = '<p>Brak bitów do wyświetlenia.</p>';
        return;
      }

      beatsList.innerHTML = '';

      data.forEach((beat) => {
        const row = document.createElement('div');
        row.className = 'beat-row';

        const left = document.createElement('div');
        left.className = 'beat-title';
        left.textContent = beat.title || 'Bez tytułu';

        const right = document.createElement('div');
        right.className = 'beat-meta';
        const price = beat.price != null ? beat.price : '?';
        right.textContent = `${price} PLN`;

        row.appendChild(left);
        row.appendChild(right);
        beatsList.appendChild(row);
      });
    } catch (err) {
      beatsList.innerHTML = `<p style="color:#fca5a5;">${err.message}</p>`;
    }
  }

  if (refreshBeatsBtn) {
    refreshBeatsBtn.addEventListener('click', loadBeats);
  }

  // Załaduj listę przy starcie
  loadBeats();
});

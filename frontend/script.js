const API_URL = "http://localhost:3000";
let authToken = "";

// ------------------- REJESTRACJA -------------------
async function register() {
    const email = document.getElementById("reg_email").value;
    const password = document.getElementById("reg_pass").value;

    const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    alert(data.message || data.error);
}

// ------------------- LOGOWANIE -------------------
async function login() {
    const email = document.getElementById("log_email").value;
    const password = document.getElementById("log_pass").value;

    const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.token) {
        authToken = data.token;
        alert("Zalogowano!");
    } else {
        alert(data.error);
    }
}

// ------------------- UPLOAD BITU -------------------
async function uploadBeat() {
    const title = document.getElementById("beat_title").value;
    const price = document.getElementById("beat_price").value;
    const file = document.getElementById("beat_file").files[0];

    if (!authToken) return alert("Najpierw się zaloguj!");
    if (!file) return alert("Wybierz plik!");

    const formData = new FormData();
    formData.append("beat_file", file);
    formData.append("title", title);
    formData.append("price", price);

    const res = await fetch(`${API_URL}/beats/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${authToken}` },
        body: formData
    });

    const data = await res.json();
    alert(data.message || data.error);

    loadBeats();
}

// ------------------- LISTA BITÓW -------------------
async function loadBeats() {
    const res = await fetch(`${API_URL}/beats`);
    const beats = await res.json();

    const div = document.getElementById("beats_list");
    div.innerHTML = "";

    beats.forEach(b => {
        div.innerHTML += `
            <div class="beat">
                <p><b>${b.title}</b> – ${b.price} zł</p>
                <audio src="${API_URL}/${b.file_path}" controls></audio>
            </div>
        `;
    });
}

window.onload = loadBeats;

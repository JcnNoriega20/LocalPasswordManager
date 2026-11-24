const API_URL = "http://127.0.0.1:3000";

async function apiFetch(url, options = {}) {
  const auth = await chrome.runtime.sendMessage({ action: "GET_API_TOKEN" });
  if (!auth?.ok || !auth.token) {
    throw new Error(
      auth?.error || "No se pudo autenticar con el servidor local.",
    );
  }
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${auth.token}`);
  headers.set("X-LPM-Extension-ID", chrome.runtime.id); // <-- nueva
  return fetch(url, { ...options, headers, cache: "no-store" });
}

// Paleta de colores para los avatares
const AVATAR_COLORS = [
  "#F87171",
  "#FBBF24",
  "#34D399",
  "#60A5FA",
  "#A78BFA",
  "#F472B6",
  "#818CF8",
  "#2DD4BF",
];

document.addEventListener("DOMContentLoaded", async () => {
  await checkVaultStatus();
  await applyTheme();

  // Botones principales
  document.getElementById("btn-create").addEventListener("click", createVault);
  document.getElementById("btn-unlock").addEventListener("click", unlockVault);
  document.getElementById("btn-lock").addEventListener("click", lockVault);
  document.getElementById("btn-add").addEventListener("click", addCredential);
  document.getElementById("btn-import").addEventListener("click", importCSV);

  // Botón del generador de contraseñas
  document
    .getElementById("btn-generate")
    .addEventListener("click", generatePassword);

  // Botón de configuración
  document.getElementById("btn-settings").addEventListener("click", () => {
    document
      .querySelectorAll('[id^="view-"]')
      .forEach((v) => v.classList.add("hidden"));
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    document.getElementById("view-settings").classList.remove("hidden");
    document.getElementById("btn-settings").style.background = "var(--border)";
  });

  // Cambiar modo oscuro
  document
    .getElementById("toggle-dark-mode")
    .addEventListener("change", (e) => {
      const isDark = e.target.checked;
      document.body.classList.toggle("dark-mode", isDark);
      chrome.storage.local.set({ darkMode: isDark });
    });

  // Pestañas (Tabs)
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      document
        .querySelectorAll('[id^="view-"]')
        .forEach((v) => v.classList.add("hidden"));
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document.getElementById("btn-settings").style.background =
        "var(--surface-hover)";

      const targetId = e.target.dataset.target;
      if (targetId) {
        e.target.classList.add("active");
        document.getElementById(targetId).classList.remove("hidden");
      }
    });
  });

  document
    .getElementById("search-credentials")
    .addEventListener("input", filterCredentials);
});

// --- GENERADOR DE CONTRASEÑAS ---
function generatePassword() {
  const length = parseInt(document.getElementById("pass-length").value, 10);
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.<>?";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }

  const input = document.getElementById("cred-password");
  input.value = password;
  input.type = "text"; // Mostrar brevemente para que el usuario la vea
  input.focus();
  input.select();

  // Ocultar de nuevo después de 2 segundos si el usuario no cambia el foco
  setTimeout(() => {
    if (document.activeElement !== input) {
      input.type = "password";
    }
  }, 2000);
}

// --- TEMAS ---
async function applyTheme() {
  const { darkMode } = await chrome.storage.local.get("darkMode");
  if (darkMode) {
    document.body.classList.add("dark-mode");
    document.getElementById("toggle-dark-mode").checked = true;
  }
}

// --- UTILIDADES ---
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function showSection(id) {
  ["create-section", "unlock-section", "main-section"].forEach((s) => {
    document.getElementById(s).classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
}

async function checkVaultStatus() {
  try {
    const res = await apiFetch(`${API_URL}/vault/status`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || `Error HTTP ${res.status}`);
    }

    if (!data.exists) {
      showSection("create-section");
    } else if (data.unlocked) {
      await chrome.storage.session.set({ unlocked: true });
      showSection("main-section");
      loadCredentials();
    } else {
      const { unlocked } = await chrome.storage.session.get("unlocked");
      if (unlocked) await chrome.storage.session.remove("unlocked");
      showSection("unlock-section");
    }
  } catch (err) {
    console.error("[POPUP] Error al verificar estado de la bóveda:", err);
    alert(err?.message || "No se pudo conectar con el servidor.");
  }
}

async function createVault() {
  const pass = document.getElementById("new-password").value;
  const confirm = document.getElementById("confirm-password").value;
  const msg = document.getElementById("create-msg");
  msg.textContent = "";

  if (pass !== confirm) {
    msg.textContent = "Las contraseñas no coinciden.";
    return;
  }

  try {
    const res = await apiFetch(`${API_URL}/vault/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ masterPassword: pass }),
    });
    const data = await res.json();
    if (res.ok) {
      await chrome.storage.session.set({ unlocked: true });
      showSection("main-section");
      loadCredentials();
    } else {
      msg.textContent = data.error;
    }
  } catch {
    msg.textContent = "Error de conexión.";
  }
}

async function unlockVault() {
  const pass = document.getElementById("master-password").value;
  const msg = document.getElementById("unlock-msg");
  msg.textContent = "";

  try {
    const res = await apiFetch(`${API_URL}/vault/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ masterPassword: pass }),
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById("master-password").value = "";
      await chrome.storage.session.set({ unlocked: true });
      showSection("main-section");
      loadCredentials();
    } else {
      msg.textContent = data.error;
    }
  } catch {
    msg.textContent = "Error de conexión.";
  }
}

async function lockVault() {
  await apiFetch(`${API_URL}/vault/lock`, { method: "POST" });
  await chrome.storage.session.remove("unlocked");
  document.getElementById("search-credentials").value = "";
  showSection("unlock-section");
}

// --- LISTA DE CREDENCIALES ---
let allLoadedCredentials = [];

async function loadCredentials() {
  const list = document.getElementById("credentials-list");
  list.innerHTML =
    '<p style="text-align:center; font-size:12px; color:var(--text-muted);">Cargando...</p>';

  try {
    const res = await apiFetch(`${API_URL}/credentials`);
    allLoadedCredentials = await res.json();
    renderCredentialList(allLoadedCredentials);
  } catch {
    list.innerHTML =
      '<p style="text-align:center; font-size:12px; color:var(--danger);">Error al cargar.</p>';
  }
}

function renderCredentialList(creds) {
  const list = document.getElementById("credentials-list");
  list.replaceChildren();

  if (creds.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No hay credenciales.";
    empty.style.cssText =
      "text-align:center;font-size:12px;color:var(--text-muted);padding:20px 0;";
    list.appendChild(empty);
    return;
  }

  for (const credential of creds) {
    const item = document.createElement("div");
    item.className = "credential";

    const avatar = document.createElement("div");
    avatar.className = "cred-avatar";
    avatar.style.backgroundColor = getAvatarColor(credential.name);
    avatar.textContent = credential.name.charAt(0).toUpperCase();

    const info = document.createElement("div");
    info.className = "cred-info";

    const name = document.createElement("span");
    name.className = "cred-name";
    name.textContent = credential.name;

    const username = document.createElement("span");
    username.className = "cred-user";
    username.textContent = credential.username;

    const password = document.createElement("span");
    password.className = "cred-password-text";
    password.id = `pass-${credential.id}`;
    password.textContent = credential.password;

    info.append(name, username, password);

    const actions = document.createElement("div");
    actions.className = "cred-actions";

    const toggleButton = document.createElement("button");
    toggleButton.className = "btn-toggle-pass";
    toggleButton.dataset.id = String(credential.id);
    toggleButton.title = "Mostrar/Ocultar";
    toggleButton.textContent = "👁️";
    toggleButton.addEventListener("click", () => {
      password.classList.toggle("visible");
      toggleButton.textContent = password.classList.contains("visible")
        ? "🙈"
        : "👁️";
    });

    const copyButton = document.createElement("button");
    copyButton.className = "btn-copy";
    copyButton.dataset.id = String(credential.id);
    copyButton.title = "Copiar contraseña";
    copyButton.textContent = "📋";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(credential.password);
        const originalText = copyButton.textContent;
        copyButton.textContent = "✅";
        setTimeout(() => {
          copyButton.textContent = originalText;
          window.close();
        }, 800);
      } catch {
        copyButton.textContent = "⚠️";
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "btn-del btn-delete";
    deleteButton.dataset.id = String(credential.id);
    deleteButton.title = "Eliminar";
    deleteButton.textContent = "🗑️";
    deleteButton.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta credencial?")) return;
      const response = await apiFetch(
        `${API_URL}/credentials/${credential.id}`,
        {
          method: "DELETE",
        },
      );
      if (response.ok) loadCredentials();
    });

    actions.append(toggleButton, copyButton, deleteButton);
    item.append(avatar, info, actions);
    list.appendChild(item);
  }
}

function filterCredentials(e) {
  const term = e.target.value.toLowerCase();
  const filtered = allLoadedCredentials.filter(
    (c) =>
      c.name.toLowerCase().includes(term) ||
      c.username.toLowerCase().includes(term) ||
      (c.website && c.website.toLowerCase().includes(term)),
  );
  renderCredentialList(filtered);
}

async function addCredential() {
  const name = document.getElementById("cred-name").value;
  const website = document.getElementById("cred-website").value;
  const username = document.getElementById("cred-username").value;
  const password = document.getElementById("cred-password").value;
  const notes = document.getElementById("cred-notes").value;
  const msg = document.getElementById("add-msg");
  msg.textContent = "";

  if (!name || !website || !username || !password) {
    msg.textContent = "Completa los campos obligatorios.";
    return;
  }

  try {
    const res = await apiFetch(`${API_URL}/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, website, username, password, notes }),
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById("cred-name").value = "";
      document.getElementById("cred-website").value = "";
      document.getElementById("cred-username").value = "";
      document.getElementById("cred-password").value = "";
      document.getElementById("cred-notes").value = "";

      msg.className = "msg success";
      msg.textContent = "Guardada con éxito.";
      setTimeout(() => (msg.textContent = ""), 2000);

      document.querySelector('[data-target="view-list"]').click();
      loadCredentials();
    } else {
      msg.className = "msg error";
      msg.textContent = data.error;
    }
  } catch {
    msg.textContent = "Error de conexión.";
  }
}

async function importCSV() {
  const fileInput = document.getElementById("csv-file");
  const msg = document.getElementById("import-msg");
  msg.textContent = "";

  if (!fileInput.files.length) {
    msg.className = "msg error";
    msg.textContent = "Selecciona un archivo CSV.";
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    const csvData = e.target.result;
    msg.className = "msg";
    msg.textContent = "Importando...";

    try {
      const res = await apiFetch(`${API_URL}/credentials/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData }),
      });

      const data = await res.json();
      if (res.ok) {
        msg.className = "msg success";
        msg.textContent = `${data.importados} importadas (${data.errores} errores)`;
        fileInput.value = "";
        loadCredentials();
        setTimeout(
          () => document.querySelector('[data-target="view-list"]').click(),
          2000,
        );
      } else {
        msg.className = "msg error";
        msg.textContent = data.error;
      }
    } catch (err) {
      msg.className = "msg error";
      msg.textContent = "Error de conexión.";
    }
  };

  reader.readAsText(file);
}

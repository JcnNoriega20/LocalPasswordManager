// content.js - Script de inyección para Autorrelleno Inteligente

// --- VARIABLES GLOBALES ---
// Guardamos lo último que el usuario escribió en campos de login
let lastTypedUsername = "";
let lastTypedPassword = "";

// --- 1. ESPÍA DE CAMPOS (Captura mientras el usuario escribe) ---
document.addEventListener("input", (e) => {
  const target = e.target;
  if (target.tagName !== "INPUT") return;

  if (target.type === "password" && target.value) {
    lastTypedPassword = target.value;
  } else if (
    (target.type === "email" || target.type === "text") &&
    target.value &&
    (target.name?.includes("user") ||
      target.id?.includes("user") ||
      target.name?.includes("email") ||
      target.id?.includes("email") ||
      target.type === "email")
  ) {
    lastTypedUsername = target.value;
  }
});

// --- 2. CAPTURA DE ENVÍO DE FORMULARIO ---
document.addEventListener("submit", async (e) => {
  // Si no tenemos contraseña, no hay nada que sugerir
  if (!lastTypedPassword || !lastTypedUsername) return;

  const currentHost = window.location.hostname.replace(/^www\./, "");

  // Verificar si ya existe en la bóveda
  try {
    const checkRes = await chrome.runtime.sendMessage({
      action: "CHECK_CREDENTIAL_EXISTS",
      payload: { website: currentHost, username: lastTypedUsername },
    });

    // Si ya existe, o hubo error, no molestar
    if (!checkRes.ok || checkRes.data.exists) return;

    // Si no existe, mostrar sugerencia
    showSaveSuggestion(currentHost, lastTypedUsername, lastTypedPassword);
  } catch (err) {
    console.error("Error al verificar credencial:", err);
  }
});

// --- 3. MENÚ DE AUTORRELLENO (Ya lo tenías) ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "AUTOFILL_BY_URL") {
    performAutofill()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function performAutofill() {
  const existingMenu = document.getElementById("pwm-autofill-menu");
  if (existingMenu) existingMenu.remove();

  const currentHost = window.location.hostname
    .toLowerCase()
    .replace(/^www\./, "");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "FETCH_CREDENTIALS",
    });
    if (!response.ok)
      throw new Error(
        response.error || "No se pudieron obtener las credenciales.",
      );

    const credentials = response.data;
    const matches = credentials.filter((c) => {
      if (!c.website) return false;
      const savedHost = c.website
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0];
      return currentHost.includes(savedHost) || savedHost.includes(currentHost);
    });

    if (matches.length === 0) {
      showToast("No hay credenciales para este sitio.", "error");
      return { ok: false };
    }

    if (matches.length === 1) {
      fillFields(matches[0]);
      showToast("✅ Credenciales rellenadas.", "success");
      return { ok: true };
    }

    showSelectionMenu(matches);
    return { ok: true };
  } catch (error) {
    showToast("❌ " + error.message, "error");
    return { ok: false };
  }
}

function fillFields(cred) {
  const userInput = document.querySelector(
    'input[type="email"], input[name*="user" i], input[id*="user" i]',
  );
  const passInput = document.querySelector('input[type="password"]');

  if (!passInput) {
    showToast("No se encontró campo de contraseña.", "error");
    return;
  }

  if (userInput && cred.username) {
    userInput.value = cred.username;
    userInput.dispatchEvent(new Event("input", { bubbles: true }));
    userInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (cred.password) {
    passInput.value = cred.password;
    passInput.dispatchEvent(new Event("input", { bubbles: true }));
    passInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function showSelectionMenu(matches) {
  const menu = document.createElement("div");
  menu.id = "pwm-autofill-menu";

  Object.assign(menu.style, {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "300px",
    backgroundColor: "#1e1e2e",
    color: "#cdd6f4",
    borderRadius: "12px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
    fontFamily: "sans-serif",
    zIndex: "2147483647",
    overflow: "hidden",
    border: "1px solid #45475a",
  });

  const header = document.createElement("div");
  header.textContent = "Selecciona una cuenta";
  Object.assign(header.style, {
    padding: "12px 16px",
    fontWeight: "bold",
    borderBottom: "1px solid #45475a",
    backgroundColor: "#181825",
  });
  menu.appendChild(header);

  const list = document.createElement("div");
  list.style.maxHeight = "250px";
  list.style.overflowY = "auto";

  matches.forEach((cred) => {
    const item = document.createElement("div");
    Object.assign(item.style, {
      padding: "12px 16px",
      cursor: "pointer",
      borderBottom: "1px solid #313244",
    });
    item.addEventListener(
      "mouseenter",
      () => (item.style.backgroundColor = "#313244"),
    );
    item.addEventListener(
      "mouseleave",
      () => (item.style.backgroundColor = "transparent"),
    );
    item.innerHTML = `<div style="font-weight: bold; font-size: 14px;">${cred.name}</div><div style="font-size: 12px; color: #a6adc8;">${cred.username}</div>`;
    item.addEventListener("click", () => {
      fillFields(cred);
      showToast("✅ Credenciales rellenadas.", "success");
      menu.remove();
    });
    list.appendChild(item);
  });

  menu.appendChild(list);
  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener("click", function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    });
  }, 100);
}

// --- 4. SUGERENCIA DE GUARDADO (NUEVO) ---
function showSaveSuggestion(host, username, password) {
  // Evitar múltiples notificaciones
  if (document.getElementById("pwm-save-banner")) return;

  const banner = document.createElement("div");
  banner.id = "pwm-save-banner";

  Object.assign(banner.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    width: "320px",
    backgroundColor: "#1e1e2e",
    color: "#cdd6f4",
    borderRadius: "12px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
    fontFamily: "sans-serif",
    zIndex: "2147483647",
    padding: "16px",
    border: "1px solid #45475a",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  });

  banner.innerHTML = `
        <div>
            <div style="font-weight: bold; margin-bottom: 4px;">💾 ¿Guardar contraseña?</div>
            <div style="font-size: 12px; color: #a6adc8;">Sitio: <b>${host}</b><br>Usuario: <b>${username}</b></div>
        </div>
        <div style="display: flex; gap: 8px;">
            <button id="pwm-save-yes" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #8B5CF6; color: white; font-weight: bold; cursor: pointer;">Guardar</button>
            <button id="pwm-save-no" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #45475a; color: #cdd6f4; cursor: pointer;">Ahora no</button>
        </div>
    `;

  document.body.appendChild(banner);

  // Botón "Guardar"
  document
    .getElementById("pwm-save-yes")
    .addEventListener("click", async () => {
      const btn = document.getElementById("pwm-save-yes");
      btn.textContent = "...";
      btn.disabled = true;

      const res = await chrome.runtime.sendMessage({
        action: "SAVE_CREDENTIAL",
        payload: {
          name: host,
          website: host,
          username: username,
          password: password,
          notes: "Guardada automáticamente desde el navegador.",
        },
      });

      if (res.ok) {
        showToast("✅ Contraseña guardada.", "success");
      } else {
        showToast("❌ Error al guardar: " + res.error, "error");
      }
      banner.remove();
    });

  // Botón "Ahora no"
  document.getElementById("pwm-save-no").addEventListener("click", () => {
    banner.remove();
  });

  // Auto-cerrar después de 15 segundos
  setTimeout(() => {
    if (document.getElementById("pwm-save-banner")) banner.remove();
  }, 15000);
}

// --- 5. TOAST (Ya lo tenías) ---
function showToast(message, type = "success") {
  const existing = document.getElementById("pwm-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "pwm-toast";
  toast.textContent = message;

  Object.assign(toast.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "12px 24px",
    borderRadius: "8px",
    color: "#fff",
    fontWeight: "bold",
    zIndex: "999999",
    backgroundColor: type === "success" ? "#10B981" : "#EF4444",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
    fontFamily: "sans-serif",
  });

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

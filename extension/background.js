const API_URL = "http://127.0.0.1:3000";
const TOKEN_STORAGE_KEY = "lpmApiToken";

async function getApiToken() {
  const stored = await chrome.storage.local.get(TOKEN_STORAGE_KEY);
  if (
    typeof stored[TOKEN_STORAGE_KEY] === "string" &&
    stored[TOKEN_STORAGE_KEY]
  ) {
    return stored[TOKEN_STORAGE_KEY];
  }

  // The server only returns the bootstrap token to this exact extension origin.
  const response = await fetch(`${API_URL}/auth/token`, {
    cache: "no-store",
    headers: {
      "X-LPM-Extension-ID": chrome.runtime.id,
    },
  });
  if (!response.ok) {
    throw new Error(`No se pudo autenticar. HTTP ${response.status}`);
  }
  const data = await response.json();
  if (typeof data.token !== "string" || !/^[a-f0-9]{64}$/.test(data.token)) {
    throw new Error("El servidor devolvió un token no válido.");
  }
  await chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: data.token });
  return data.token;
}

async function apiFetch(path, options = {}) {
  const token = await getApiToken();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-LPM-Extension-ID", chrome.runtime.id);
  return fetch(`${API_URL}${path}`, { ...options, headers, cache: "no-store" });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "GET_API_TOKEN") {
    getApiToken()
      .then((token) => sendResponse({ ok: true, token }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.action === "FETCH_CREDENTIALS") {
    apiFetch("/credentials")
      .then((res) => {
        if (!res.ok)
          throw new Error(
            res.status === 401
              ? "No autorizado."
              : "Bóveda bloqueada o error de servidor.",
          );
        return res.json();
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.action === "CHECK_CREDENTIAL_EXISTS") {
    apiFetch("/credentials/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error || "No se pudo comprobar la credencial.");
        return data;
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.action === "SAVE_CREDENTIAL") {
    apiFetch("/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error || "No se pudo guardar la credencial.");
        return data;
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "autofill-credential") return;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { action: "AUTOFILL_BY_URL" }, () => {
      if (chrome.runtime.lastError) {
        console.warn(
          "[LPM] No se pudo contactar el content script:",
          chrome.runtime.lastError.message,
        );
      }
    });
  } catch (error) {
    console.error("Error en background:", error);
  }
});

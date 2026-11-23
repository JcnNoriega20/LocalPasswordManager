// background.js
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "autofill-credential") {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab || !tab.id) return;
      chrome.tabs.sendMessage(tab.id, { action: "AUTOFILL_BY_URL" });
    } catch (error) {
      console.error("Error en background:", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Traer credenciales (ya lo tenías)
  if (message.action === "FETCH_CREDENTIALS") {
    fetch("http://localhost:3000/credentials")
      .then((res) => {
        if (!res.ok) throw new Error("Bóveda bloqueada o error de servidor.");
        return res.json();
      })
      .then((data) => sendResponse({ ok: true, data: data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // 2. NUEVO: Verificar si una credencial ya existe
  if (message.action === "CHECK_CREDENTIAL_EXISTS") {
    fetch("http://localhost:3000/credentials/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload),
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ ok: true, data: data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // 3. NUEVO: Guardar una credencial nueva
  if (message.action === "SAVE_CREDENTIAL") {
    fetch("http://localhost:3000/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload),
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ ok: true, data: data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

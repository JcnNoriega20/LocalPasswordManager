import express from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import csv from "csv-parser";
import db, { dataDirectory } from "./database/database";
import "./database/schema";
import { vaultExists, createVault, unlockVault } from "./vault/vault";
import {
  isVaultUnlocked,
  setVaultKey,
  lockVault,
  resetInactivityTimer,
} from "./vault/vault-session";
import {
  createCredential,
  getCredentials,
  updateCredential,
  deleteCredential,
  type CredentialInput,
} from "./credentials/credentials";

const app = express();
const PORT = Number(process.env.LPM_PORT ?? 3000);
const HOST = "127.0.0.1";
const MAX_JSON_BYTES = "1mb";
const MAX_CSV_CHARS = 5_000_000;
const API_TOKEN_PATH = path.join(dataDirectory, ".api-token");

// One random API token per local installation. It is kept outside the project
// tree, next to the local database, and is never included in backups/exports.
function loadOrCreateApiToken(): string {
  try {
    const existing = fs.readFileSync(API_TOKEN_PATH, "utf8").trim();
    if (/^[a-f0-9]{64}$/.test(existing)) return existing;
  } catch {
    // Create the token below when the file does not exist.
  }

  const token = randomBytes(32).toString("hex");
  fs.writeFileSync(API_TOKEN_PATH, token, { encoding: "utf8", mode: 0o600, flag: "w" });
  try { fs.chmodSync(API_TOKEN_PATH, 0o600); } catch { /* Windows ACLs govern access. */ }
  return token;
}

const apiToken = loadOrCreateApiToken();
const extensionId = (process.env.LPM_EXTENSION_ID ?? "").trim();
const allowedExtensionOrigin = /^[a-p]{32}$/.test(extensionId)
  ? `chrome-extension://${extensionId}`
  : "";
console.log("[CONFIG] Origen permitido:", allowedExtensionOrigin || "(VACÍO)");
app.disable("x-powered-by");

// Avoid caching responses that can contain decrypted credentials or the API token.
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

app.use(express.json({ limit: MAX_JSON_BYTES }));

app.use((req, res, next) => {
  const host = (req.hostname || "").toLowerCase();

  if (host !== "127.0.0.1" && host !== "localhost") {
    return res.status(403).json({ error: "Host no permitido." });
  }

  const origin = req.get("Origin");
  const claimedExtensionId = req.get("X-LPM-Extension-ID");
  console.log("[AUTH]", req.method, req.path, "origin:", origin, "ext-id:", claimedExtensionId);

  const validOrigin = origin === allowedExtensionOrigin;
  const validServiceWorker =
    !origin &&
    /^[a-p]{32}$/.test(extensionId) &&
    claimedExtensionId === extensionId;

  if (!allowedExtensionOrigin || (!validOrigin && !validServiceWorker)) {
    return res.status(403).json({
      error: "Origen o identificador de extensión no permitido."
    });
  }

  if (validOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedExtensionOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-LPM-Extension-ID"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});


// Bootstrap is intentionally limited to the exact extension origin above.
// Every other API endpoint requires the installation-specific bearer token.
app.get("/auth/token", (_req, res) => {
  res.json({ token: apiToken });
});

function requireUnlockedVault(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!isVaultUnlocked()) {
    return res.status(403).json({ error: "La bóveda está bloqueada." });
  }
  resetInactivityTimer();
  next();
}

function validateCredentialInput(body: any): body is CredentialInput {
  return Boolean(
    body &&
    typeof body.name === "string" && body.name.trim().length > 0 && body.name.length <= 200 &&
    typeof body.website === "string" && body.website.length <= 2048 &&
    typeof body.username === "string" && body.username.length > 0 && body.username.length <= 1024 &&
    typeof body.password === "string" && body.password.length > 0 && body.password.length <= 4096 &&
    (body.notes == null || (typeof body.notes === "string" && body.notes.length <= 10000))
  );
}

function normalizeHostname(value: string): string | null {
  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(candidate).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sameSite(currentHost: string, savedHost: string): boolean {
  // Exact host or a subdomain of the saved host. Never use includes(), which
  // would incorrectly match domains such as evil-example.com to example.com.
  return currentHost === savedHost || currentHost.endsWith(`.${savedHost}`);
}

app.get("/vault/status", (_req, res) => {
  res.json({ exists: vaultExists(), unlocked: isVaultUnlocked() });
});

app.post("/vault/create", (req, res) => {
  const { masterPassword } = req.body ?? {};
  if (typeof masterPassword !== "string" || masterPassword.length < 12) {
    return res.status(400).json({
      error: "La contraseña maestra debe tener al menos 12 caracteres.",
    });
  }

  try {
    createVault(masterPassword);
    const key = unlockVault(masterPassword);
    setVaultKey(key);
    return res.status(201).json({ message: "Bóveda creada y desbloqueada." });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "No se pudo crear la bóveda.",
    });
  }
});

app.post("/vault/unlock", (req, res) => {
  const { masterPassword } = req.body ?? {};
  if (typeof masterPassword !== "string" || masterPassword.length === 0) {
    return res.status(400).json({ error: "Debes proporcionar la contraseña maestra." });
  }
  try {
    const key = unlockVault(masterPassword);
    setVaultKey(key);
    return res.json({ message: "Bóveda desbloqueada." });
  } catch (error) {
    return res.status(401).json({
      error: error instanceof Error ? error.message : "No se pudo desbloquear la bóveda.",
    });
  }
});

app.post("/vault/lock", (_req, res) => {
  lockVault();
  res.json({ message: "Bóveda bloqueada." });
});

app.get("/credentials", requireUnlockedVault, (_req, res) => {
  try {
    res.json(getCredentials());
  } catch {
    res.status(500).json({ error: "No se pudieron leer las credenciales." });
  }
});

app.post("/credentials/check", requireUnlockedVault, (req, res) => {
  const { website, username } = req.body ?? {};
  if (typeof website !== "string" || typeof username !== "string" || !website || !username) {
    return res.status(400).json({ error: "Faltan datos." });
  }

  try {
    const currentHost = normalizeHostname(website);
    const credentials = getCredentials();
    const exists = currentHost !== null && credentials.some((credential) => {
      const savedHost = normalizeHostname(credential.website);
      return Boolean(
        savedHost && sameSite(currentHost, savedHost) &&
        credential.username.toLowerCase() === username.toLowerCase()
      );
    });
    res.json({ exists });
  } catch {
    res.status(500).json({ error: "No se pudo comprobar la credencial." });
  }
});

app.post("/credentials", requireUnlockedVault, (req, res) => {
  if (!validateCredentialInput(req.body)) {
    return res.status(400).json({ error: "Los datos de la credencial no son válidos." });
  }
  try {
    const id = createCredential(req.body);
    res.status(201).json({ message: "Credencial creada.", id });
  } catch {
    res.status(500).json({ error: "No se pudo guardar la credencial." });
  }
});

app.put("/credentials/:id", requireUnlockedVault, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || !validateCredentialInput(req.body)) {
    return res.status(400).json({ error: "El identificador o los datos no son válidos." });
  }
  try {
    updateCredential(id, req.body);
    res.json({ message: "Credencial actualizada." });
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "Credencial no encontrada.",
    });
  }
});

app.delete("/credentials/:id", requireUnlockedVault, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identificador no válido." });
  }
  try {
    deleteCredential(id);
    res.json({ message: "Credencial eliminada." });
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "Credencial no encontrada.",
    });
  }
});

// Parse CSV in memory: never write an unencrypted plaintext import to disk.
app.post("/credentials/import", requireUnlockedVault, (req, res) => {
  const csvData = req.body?.csvData;
  if (typeof csvData !== "string" || csvData.length === 0) {
    return res.status(400).json({ error: "No se proporcionaron datos CSV." });
  }
  if (Buffer.byteLength(csvData, "utf8") > MAX_CSV_CHARS) {
    return res.status(413).json({ error: "El archivo CSV supera el tamaño permitido." });
  }

  const rows: Record<string, string>[] = [];
  const parser = Readable.from([csvData]).pipe(csv());
  let parserFailed = false;
  parser.on("data", (row: Record<string, string>) => rows.push(row));
  parser.on("error", () => {
    parserFailed = true;
    if (!res.headersSent) {
      res.status(400).json({ error: "No se pudo interpretar el archivo CSV." });
    }
  });
  parser.on("end", () => {
    if (parserFailed || res.headersSent) return;
    try {
      let imported = 0;
      let skipped = 0;
      const importTransaction = db.transaction(() => {
        for (const row of rows) {
          const name = row.name || row.Name || row.title || row.Title || row.account || "";
          const website = row.url || row.URL || row.website || row.login_uri || row.uri || "";
          const username = row.username || row.Username || row.login || row.email || row.user || "";
          const password = row.password || row.Password || row.pass || "";
          const notes = row.notes || row.Notes || row.note || row.comment || null;

          if (name && username && password) {
            createCredential({ name, website: website || "Sin sitio web", username, password, notes });
            imported++;
          } else {
            skipped++;
          }
        }
      });
      importTransaction();
      res.json({ message: "Importación completada.", importados: imported, errores: skipped });
    } catch {
      res.status(500).json({ error: "No se pudo completar la importación. La transacción fue revertida." });
    }
  });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Servidor local escuchando en http://${HOST}:${PORT}`);
});

function shutdown() {
  lockVault();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
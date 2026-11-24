"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_crypto_1 = require("node:crypto");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_stream_1 = require("node:stream");
const csv_parser_1 = __importDefault(require("csv-parser"));
const database_1 = __importStar(require("./database/database"));
require("./database/schema");
const vault_1 = require("./vault/vault");
const vault_session_1 = require("./vault/vault-session");
const credentials_1 = require("./credentials/credentials");
const app = (0, express_1.default)();
const PORT = Number(process.env.LPM_PORT ?? 3000);
const HOST = "127.0.0.1";
const MAX_JSON_BYTES = "1mb";
const MAX_CSV_CHARS = 5_000_000;
const API_TOKEN_PATH = node_path_1.default.join(database_1.dataDirectory, ".api-token");
// One random API token per local installation. It is kept outside the project
// tree, next to the local database, and is never included in backups/exports.
function loadOrCreateApiToken() {
    try {
        const existing = node_fs_1.default.readFileSync(API_TOKEN_PATH, "utf8").trim();
        if (/^[a-f0-9]{64}$/.test(existing))
            return existing;
    }
    catch {
        // Create the token below when the file does not exist.
    }
    const token = (0, node_crypto_1.randomBytes)(32).toString("hex");
    node_fs_1.default.writeFileSync(API_TOKEN_PATH, token, { encoding: "utf8", mode: 0o600, flag: "w" });
    try {
        node_fs_1.default.chmodSync(API_TOKEN_PATH, 0o600);
    }
    catch { /* Windows ACLs govern access. */ }
    return token;
}
const apiToken = loadOrCreateApiToken();
const extensionId = (process.env.LPM_EXTENSION_ID ?? "").trim();
const allowedExtensionOrigin = /^[a-p]{32}$/.test(extensionId)
    ? `chrome-extension://${extensionId}`
    : "";
app.disable("x-powered-by");
// This service is local-only. Browser requests must come from the exact
// installed extension ID; a generic chrome-extension:// pattern is not enough.
app.use((req, res, next) => {
    const host = (req.hostname || "").toLowerCase();
    if (host !== "127.0.0.1" && host !== "localhost") {
        return res.status(403).json({ error: "Host no permitido." });
    }
    const origin = req.get("Origin");
    // console.log("[API AUTH DEBUG]", {
    //   method: req.method,
    //   path: req.path,
    //   origin: req.get("origin"),
    //   host: req.get("host")
    // });
    if (!origin || !allowedExtensionOrigin || origin !== allowedExtensionOrigin) {
        return res.status(403).json({ error: "Origen no permitido. Configura LPM_EXTENSION_ID." });
    }
    res.setHeader("Access-Control-Allow-Origin", allowedExtensionOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS")
        return res.sendStatus(204);
    next();
});
// Avoid caching responses that can contain decrypted credentials or the API token.
app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
});
app.use(express_1.default.json({ limit: MAX_JSON_BYTES }));
// Bootstrap is intentionally limited to the exact extension origin above.
// Every other API endpoint requires the installation-specific bearer token.
app.get("/auth/token", (_req, res) => {
    res.json({ token: apiToken });
});
app.use((req, res, next) => {
    const host = (req.hostname || "").toLowerCase();
    if (host !== "127.0.0.1" && host !== "localhost") {
        return res.status(403).json({ error: "Host no permitido." });
    }
    const origin = req.get("Origin");
    const claimedExtensionId = req.get("X-LPM-Extension-ID");
    const validOrigin = origin === allowedExtensionOrigin;
    const validServiceWorker = !origin &&
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
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-LPM-Extension-ID");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});
function requireUnlockedVault(_req, res, next) {
    if (!(0, vault_session_1.isVaultUnlocked)()) {
        return res.status(403).json({ error: "La bóveda está bloqueada." });
    }
    (0, vault_session_1.resetInactivityTimer)();
    next();
}
function validateCredentialInput(body) {
    return Boolean(body &&
        typeof body.name === "string" && body.name.trim().length > 0 && body.name.length <= 200 &&
        typeof body.website === "string" && body.website.length <= 2048 &&
        typeof body.username === "string" && body.username.length > 0 && body.username.length <= 1024 &&
        typeof body.password === "string" && body.password.length > 0 && body.password.length <= 4096 &&
        (body.notes == null || (typeof body.notes === "string" && body.notes.length <= 10000)));
}
function normalizeHostname(value) {
    try {
        const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
        return new URL(candidate).hostname.toLowerCase().replace(/^www\./, "");
    }
    catch {
        return null;
    }
}
function sameSite(currentHost, savedHost) {
    // Exact host or a subdomain of the saved host. Never use includes(), which
    // would incorrectly match domains such as evil-example.com to example.com.
    return currentHost === savedHost || currentHost.endsWith(`.${savedHost}`);
}
app.get("/vault/status", (_req, res) => {
    res.json({ exists: (0, vault_1.vaultExists)(), unlocked: (0, vault_session_1.isVaultUnlocked)() });
});
app.post("/vault/create", (req, res) => {
    const { masterPassword } = req.body ?? {};
    if (typeof masterPassword !== "string" || masterPassword.length < 12) {
        return res.status(400).json({
            error: "La contraseña maestra debe tener al menos 12 caracteres.",
        });
    }
    try {
        (0, vault_1.createVault)(masterPassword);
        const key = (0, vault_1.unlockVault)(masterPassword);
        (0, vault_session_1.setVaultKey)(key);
        return res.status(201).json({ message: "Bóveda creada y desbloqueada." });
    }
    catch (error) {
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
        const key = (0, vault_1.unlockVault)(masterPassword);
        (0, vault_session_1.setVaultKey)(key);
        return res.json({ message: "Bóveda desbloqueada." });
    }
    catch (error) {
        return res.status(401).json({
            error: error instanceof Error ? error.message : "No se pudo desbloquear la bóveda.",
        });
    }
});
app.post("/vault/lock", (_req, res) => {
    (0, vault_session_1.lockVault)();
    res.json({ message: "Bóveda bloqueada." });
});
app.get("/credentials", requireUnlockedVault, (_req, res) => {
    try {
        res.json((0, credentials_1.getCredentials)());
    }
    catch {
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
        const credentials = (0, credentials_1.getCredentials)();
        const exists = currentHost !== null && credentials.some((credential) => {
            const savedHost = normalizeHostname(credential.website);
            return Boolean(savedHost && sameSite(currentHost, savedHost) &&
                credential.username.toLowerCase() === username.toLowerCase());
        });
        res.json({ exists });
    }
    catch {
        res.status(500).json({ error: "No se pudo comprobar la credencial." });
    }
});
app.post("/credentials", requireUnlockedVault, (req, res) => {
    if (!validateCredentialInput(req.body)) {
        return res.status(400).json({ error: "Los datos de la credencial no son válidos." });
    }
    try {
        const id = (0, credentials_1.createCredential)(req.body);
        res.status(201).json({ message: "Credencial creada.", id });
    }
    catch {
        res.status(500).json({ error: "No se pudo guardar la credencial." });
    }
});
app.put("/credentials/:id", requireUnlockedVault, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0 || !validateCredentialInput(req.body)) {
        return res.status(400).json({ error: "El identificador o los datos no son válidos." });
    }
    try {
        (0, credentials_1.updateCredential)(id, req.body);
        res.json({ message: "Credencial actualizada." });
    }
    catch (error) {
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
        (0, credentials_1.deleteCredential)(id);
        res.json({ message: "Credencial eliminada." });
    }
    catch (error) {
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
    const rows = [];
    const parser = node_stream_1.Readable.from([csvData]).pipe((0, csv_parser_1.default)());
    let parserFailed = false;
    parser.on("data", (row) => rows.push(row));
    parser.on("error", () => {
        parserFailed = true;
        if (!res.headersSent) {
            res.status(400).json({ error: "No se pudo interpretar el archivo CSV." });
        }
    });
    parser.on("end", () => {
        if (parserFailed || res.headersSent)
            return;
        try {
            let imported = 0;
            let skipped = 0;
            const importTransaction = database_1.default.transaction(() => {
                for (const row of rows) {
                    const name = row.name || row.Name || row.title || row.Title || row.account || "";
                    const website = row.url || row.URL || row.website || row.login_uri || row.uri || "";
                    const username = row.username || row.Username || row.login || row.email || row.user || "";
                    const password = row.password || row.Password || row.pass || "";
                    const notes = row.notes || row.Notes || row.note || row.comment || null;
                    if (name && username && password) {
                        (0, credentials_1.createCredential)({ name, website: website || "Sin sitio web", username, password, notes });
                        imported++;
                    }
                    else {
                        skipped++;
                    }
                }
            });
            importTransaction();
            res.json({ message: "Importación completada.", importados: imported, errores: skipped });
        }
        catch {
            res.status(500).json({ error: "No se pudo completar la importación. La transacción fue revertida." });
        }
    });
});
const server = app.listen(PORT, HOST, () => {
    console.log(`Servidor local escuchando en http://${HOST}:${PORT}`);
});
function shutdown() {
    (0, vault_session_1.lockVault)();
    server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
require("./database/schema");
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const vault_1 = require("./vault/vault");
const vault_session_1 = require("./vault/vault-session");
const credentials_1 = require("./credentials/credentials");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// --- ESTADO DE LA BÓVEDA ---
app.get("/vault/status", (_req, res) => {
    res.json({
        exists: (0, vault_1.vaultExists)(),
        unlocked: (0, vault_session_1.isVaultUnlocked)()
    });
});
// --- CREAR BÓVEDA (primera vez) ---
app.post("/vault/create", (req, res) => {
    const { masterPassword } = req.body;
    if (!masterPassword || masterPassword.length < 12) {
        return res.status(400).json({
            error: "La contraseña maestra debe tener al menos 12 caracteres."
        });
    }
    try {
        (0, vault_1.createVault)(masterPassword);
        const key = (0, vault_1.unlockVault)(masterPassword);
        (0, vault_session_1.setVaultKey)(key);
        res.status(201).json({ message: "Bóveda creada y desbloqueada." });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// --- DESBLOQUEAR ---
app.post("/vault/unlock", (req, res) => {
    const { masterPassword } = req.body;
    try {
        const key = (0, vault_1.unlockVault)(masterPassword);
        (0, vault_session_1.setVaultKey)(key);
        res.json({ message: "Bóveda desbloqueada." });
    }
    catch (error) {
        res.status(401).json({ error: error.message });
    }
});
// --- BLOQUEAR ---
app.post("/vault/lock", (_req, res) => {
    (0, vault_session_1.lockVault)();
    res.json({ message: "Bóveda bloqueada." });
});
// --- MIDDLEWARE ---
const requireUnlockedVault = (_req, res, next) => {
    if (!(0, vault_session_1.isVaultUnlocked)()) {
        return res.status(403).json({ error: "La bóveda está bloqueada." });
    }
    // 🔥 NUEVO: Reiniciar el temporizador de inactividad en cada petición
    (0, vault_session_1.resetInactivityTimer)();
    next();
};
// --- CREDENCIALES (protegidas) ---
app.get("/credentials", requireUnlockedVault, (_req, res) => {
    try {
        res.json((0, credentials_1.getCredentials)());
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// --- VERIFICAR SI UNA CREDENCIAL YA EXISTE ---
app.post("/credentials/check", requireUnlockedVault, (req, res) => {
    const { website, username } = req.body;
    if (!website || !username) {
        return res.status(400).json({ error: "Faltan datos." });
    }
    try {
        const creds = (0, credentials_1.getCredentials)();
        const currentHost = website.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
        const exists = creds.some(c => {
            if (!c.website)
                return false;
            const savedHost = c.website.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
            const hostMatches = currentHost.includes(savedHost) || savedHost.includes(currentHost);
            const userMatches = c.username.toLowerCase() === username.toLowerCase();
            return hostMatches && userMatches;
        });
        res.json({ exists });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post("/credentials", requireUnlockedVault, (req, res) => {
    const { name, website, username, password, notes } = req.body;
    if (!name || !website || !username || !password) {
        return res.status(400).json({ error: "Faltan campos obligatorios." });
    }
    try {
        const id = (0, credentials_1.createCredential)({ name, website, username, password, notes });
        res.status(201).json({ message: "Credencial creada.", id });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put("/credentials/:id", requireUnlockedVault, (req, res) => {
    const { id } = req.params;
    const { name, website, username, password, notes } = req.body;
    try {
        (0, credentials_1.updateCredential)(Number(id), { name, website, username, password, notes });
        res.json({ message: "Credencial actualizada." });
    }
    catch (error) {
        res.status(404).json({ error: error.message });
    }
});
app.delete("/credentials/:id", requireUnlockedVault, (req, res) => {
    const { id } = req.params;
    try {
        (0, credentials_1.deleteCredential)(Number(id));
        res.json({ message: "Credencial eliminada." });
    }
    catch (error) {
        res.status(404).json({ error: error.message });
    }
});
// --- IMPORTAR CREDENCIALES DESDE CSV ---
app.post("/credentials/import", requireUnlockedVault, (req, res) => {
    const { csvData } = req.body;
    if (!csvData) {
        return res.status(400).json({ error: "No se proporcionaron datos CSV." });
    }
    const tempPath = `./temp_import_${Date.now()}.csv`;
    fs_1.default.writeFileSync(tempPath, csvData);
    const results = [];
    let importados = 0;
    let errores = 0;
    fs_1.default.createReadStream(tempPath)
        .pipe((0, csv_parser_1.default)())
        .on('data', (data) => results.push(data))
        .on('end', () => {
        try {
            for (const row of results) {
                const name = row.name || row.Name || row.title || row.Title || row.account || "";
                const website = row.url || row.URL || row.website || row.login_uri || row.uri || "";
                const username = row.username || row.Username || row.login || row.email || row.user || "";
                const password = row.password || row.Password || row.pass || "";
                const notes = row.notes || row.Notes || row.note || row.comment || null;
                if (name && username && password) {
                    (0, credentials_1.createCredential)({
                        name: name,
                        website: website || "Sin sitio web",
                        username: username,
                        password: password,
                        notes: notes
                    });
                    importados++;
                }
                else {
                    errores++;
                }
            }
            fs_1.default.unlinkSync(tempPath);
            res.json({
                message: `Importación completada.`,
                importados,
                errores
            });
        }
        catch (error) {
            if (fs_1.default.existsSync(tempPath))
                fs_1.default.unlinkSync(tempPath);
            res.status(500).json({ error: "Error al procesar el CSV: " + error.message });
        }
    });
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});

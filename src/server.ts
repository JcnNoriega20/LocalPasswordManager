import express from "express";
import cors from 'cors';
import "./database/schema";
import fs from "fs";
import csv from "csv-parser";
import { vaultExists, createVault, unlockVault } from "./vault/vault";
import {
    isVaultUnlocked,
    setVaultKey,
    lockVault,
    resetInactivityTimer  // ← NUEVO: importar
} from "./vault/vault-session";
import { createCredential, getCredentials, updateCredential, deleteCredential } from "./credentials/credentials";

const app = express();
app.use(cors());
app.use(express.json());

// --- ESTADO DE LA BÓVEDA ---
app.get("/vault/status", (_req, res) => {
    res.json({
        exists: vaultExists(),
        unlocked: isVaultUnlocked()
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
        createVault(masterPassword);
        const key = unlockVault(masterPassword);
        setVaultKey(key);
        res.status(201).json({ message: "Bóveda creada y desbloqueada." });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// --- DESBLOQUEAR ---
app.post("/vault/unlock", (req, res) => {
    const { masterPassword } = req.body;
    try {
        const key = unlockVault(masterPassword);
        setVaultKey(key);
        res.json({ message: "Bóveda desbloqueada." });
    } catch (error: any) {
        res.status(401).json({ error: error.message });
    }
});

// --- BLOQUEAR ---
app.post("/vault/lock", (_req, res) => {
    lockVault();
    res.json({ message: "Bóveda bloqueada." });
});

// --- MIDDLEWARE ---
const requireUnlockedVault = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!isVaultUnlocked()) {
        return res.status(403).json({ error: "La bóveda está bloqueada." });
    }
    // 🔥 NUEVO: Reiniciar el temporizador de inactividad en cada petición
    resetInactivityTimer();
    next();
};

// --- CREDENCIALES (protegidas) ---
app.get("/credentials", requireUnlockedVault, (_req, res) => {
    try {
        res.json(getCredentials());
    } catch (error: any) {
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
        const creds = getCredentials();
        const currentHost = website.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

        const exists = creds.some(c => {
            if (!c.website) return false;
            const savedHost = c.website.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
            const hostMatches = currentHost.includes(savedHost) || savedHost.includes(currentHost);
            const userMatches = c.username.toLowerCase() === username.toLowerCase();
            return hostMatches && userMatches;
        });

        res.json({ exists });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/credentials", requireUnlockedVault, (req, res) => {
    const { name, website, username, password, notes } = req.body;
    if (!name || !website || !username || !password) {
        return res.status(400).json({ error: "Faltan campos obligatorios." });
    }
    try {
        const id = createCredential({ name, website, username, password, notes });
        res.status(201).json({ message: "Credencial creada.", id });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put("/credentials/:id", requireUnlockedVault, (req, res) => {
    const { id } = req.params;
    const { name, website, username, password, notes } = req.body;
    try {
        updateCredential(Number(id), { name, website, username, password, notes });
        res.json({ message: "Credencial actualizada." });
    } catch (error: any) {
        res.status(404).json({ error: error.message });
    }
});

app.delete("/credentials/:id", requireUnlockedVault, (req, res) => {
    const { id } = req.params;
    try {
        deleteCredential(Number(id));
        res.json({ message: "Credencial eliminada." });
    } catch (error: any) {
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
    fs.writeFileSync(tempPath, csvData);

    const results: any[] = [];
    let importados = 0;
    let errores = 0;

    fs.createReadStream(tempPath)
        .pipe(csv())
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
                        createCredential({
                            name: name,
                            website: website || "Sin sitio web",
                            username: username,
                            password: password,
                            notes: notes
                        });
                        importados++;
                    } else {
                        errores++;
                    }
                }
                fs.unlinkSync(tempPath);

                res.json({
                    message: `Importación completada.`,
                    importados,
                    errores
                });
            } catch (error: any) {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                res.status(500).json({ error: "Error al procesar el CSV: " + error.message });
            }
        });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});
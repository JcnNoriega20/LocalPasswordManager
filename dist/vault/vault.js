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
exports.vaultExists = vaultExists;
exports.createVault = createVault;
exports.unlockVault = unlockVault;
const database_1 = __importStar(require("../database/database"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const crypto_1 = require("../crypto/crypto");
const VERIFIER_TEXT = "MY_PASSWORD_MANAGER_VAULT_OK";
const CURRENT_FORMAT_VERSION = 2;
function vaultExists() {
    const result = database_1.default
        .prepare("SELECT COUNT(*) as count FROM vault_metadata")
        .get();
    return result.count > 0;
}
/**
 * Migrates legacy credential metadata (name and website) from plaintext to
 * AES-GCM ciphertext. The migration is atomic: either every row and the
 * version marker are committed, or the original database remains unchanged.
 */
function migrateVaultData(key, currentVersion) {
    if (currentVersion > CURRENT_FORMAT_VERSION) {
        throw new Error("Esta bóveda fue creada con una versión más reciente de LocalPasswordManager. Actualiza la aplicación.");
    }
    if (currentVersion === CURRENT_FORMAT_VERSION)
        return;
    if (currentVersion !== 1) {
        throw new Error(`Versión de bóveda no compatible: ${currentVersion}`);
    }
    // Produce a consistent SQLite snapshot before touching the legacy vault.
    // The backup remains local and is never uploaded by this application.
    const backupDirectory = node_path_1.default.join(database_1.dataDirectory, "backups");
    node_fs_1.default.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
    const backupId = `${Date.now()}-${process.hrtime.bigint().toString()}`;
    const temporarySnapshotPath = node_path_1.default.join(backupDirectory, `vault-before-v2-${backupId}.tmp.db`);
    const encryptedBackupPath = node_path_1.default.join(backupDirectory, `vault-before-v2-${backupId}.db.enc`);
    const escapedSnapshotPath = temporarySnapshotPath.replace(/'/g, "''");
    try {
        database_1.default.exec(`VACUUM INTO '${escapedSnapshotPath}'`);
        try {
            node_fs_1.default.chmodSync(temporarySnapshotPath, 0o600);
        }
        catch {
            // Windows does not provide POSIX file modes; cleanup still happens below.
        }
        const snapshotBytes = node_fs_1.default.readFileSync(temporarySnapshotPath);
        try {
            const encryptedSnapshot = (0, crypto_1.encryptBuffer)(snapshotBytes, key);
            node_fs_1.default.writeFileSync(encryptedBackupPath, encryptedSnapshot, { flag: "wx", mode: 0o600 });
        }
        finally {
            snapshotBytes.fill(0);
        }
    }
    finally {
        // Do not leave a plaintext copy of the legacy database behind.
        if (node_fs_1.default.existsSync(temporarySnapshotPath))
            node_fs_1.default.unlinkSync(temporarySnapshotPath);
    }
    const migrate = database_1.default.transaction(() => {
        const rows = database_1.default
            .prepare("SELECT id, name, website FROM credentials")
            .all();
        const update = database_1.default.prepare("UPDATE credentials SET name = ?, website = ? WHERE id = ?");
        for (const row of rows) {
            update.run((0, crypto_1.encrypt)(row.name, key), (0, crypto_1.encrypt)(row.website, key), row.id);
        }
        database_1.default.prepare("UPDATE vault_metadata SET format_version = ? WHERE id = 1").run(CURRENT_FORMAT_VERSION);
    });
    migrate();
}
function createVault(masterPassword) {
    if (vaultExists())
        throw new Error("La bóveda ya está creada.");
    if (typeof masterPassword !== "string" || masterPassword.length < 12) {
        throw new Error("La contraseña maestra debe tener al menos 12 caracteres.");
    }
    const salt = (0, crypto_1.generateSalt)();
    const key = (0, crypto_1.deriveKey)(masterPassword, salt);
    try {
        const verifier = (0, crypto_1.encrypt)(VERIFIER_TEXT, key);
        database_1.default.prepare(`
      INSERT INTO vault_metadata (
        id, salt, verifier, created_at, format_version
      ) VALUES (1, ?, ?, ?, ?)
    `).run(salt.toString("base64"), verifier, new Date().toISOString(), CURRENT_FORMAT_VERSION);
    }
    finally {
        key.fill(0);
    }
}
function unlockVault(masterPassword) {
    const metadata = database_1.default
        .prepare(`
      SELECT salt, verifier, format_version
      FROM vault_metadata
      WHERE id = 1
      LIMIT 1
    `)
        .get();
    if (!metadata)
        throw new Error("La bóveda todavía no ha sido creada.");
    const salt = Buffer.from(metadata.salt, "base64");
    const key = (0, crypto_1.deriveKey)(masterPassword, salt);
    let verifier;
    try {
        verifier = (0, crypto_1.decrypt)(metadata.verifier, key);
    }
    catch {
        key.fill(0);
        throw new Error("Contraseña maestra incorrecta o datos de verificación dañados.");
    }
    if (verifier !== VERIFIER_TEXT) {
        key.fill(0);
        throw new Error("Contraseña maestra incorrecta.");
    }
    try {
        // Old databases receive format_version=1 from the schema migration.
        migrateVaultData(key, metadata.format_version ?? 1);
        return key;
    }
    catch (error) {
        key.fill(0);
        throw new Error(`No se pudo completar la migración de la bóveda; no se confirmó ningún cambio. ${error instanceof Error ? error.message : "Error desconocido."}`);
    }
}

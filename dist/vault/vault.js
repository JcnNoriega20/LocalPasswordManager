"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vaultExists = vaultExists;
exports.createVault = createVault;
exports.unlockVault = unlockVault;
const database_1 = __importDefault(require("../database/database"));
const crypto_1 = require("../crypto/crypto");
const VERIFIER_TEXT = "MY_PASSWORD_MANAGER_VAULT_OK";
function vaultExists() {
    const result = database_1.default
        .prepare(`
      SELECT COUNT(*) as count
      FROM vault_metadata
    `)
        .get();
    return result.count > 0;
}
function createVault(masterPassword) {
    if (vaultExists()) {
        throw new Error("La bóveda ya está creada.");
    }
    if (masterPassword.length < 12) {
        throw new Error("La contraseña maestra debe tener al menos 12 caracteres.");
    }
    const salt = (0, crypto_1.generateSalt)();
    const key = (0, crypto_1.deriveKey)(masterPassword, salt);
    const verifier = (0, crypto_1.encrypt)(VERIFIER_TEXT, key);
    database_1.default.prepare(`
    INSERT INTO vault_metadata (
      salt,
      verifier,
      created_at
    )
    VALUES (?, ?, ?)
  `).run(salt.toString("base64"), verifier, new Date().toISOString());
    key.fill(0);
}
function unlockVault(masterPassword) {
    const metadata = database_1.default
        .prepare(`
      SELECT salt, verifier
      FROM vault_metadata
      LIMIT 1
    `)
        .get();
    if (!metadata) {
        throw new Error("La bóveda todavía no ha sido creada.");
    }
    const salt = Buffer.from(metadata.salt, "base64");
    const key = (0, crypto_1.deriveKey)(masterPassword, salt);
    try {
        const verifier = (0, crypto_1.decrypt)(metadata.verifier, key);
        if (verifier !== VERIFIER_TEXT) {
            key.fill(0);
            throw new Error("Contraseña maestra incorrecta.");
        }
        return key;
    }
    catch {
        key.fill(0);
        throw new Error("Contraseña maestra incorrecta.");
    }
}

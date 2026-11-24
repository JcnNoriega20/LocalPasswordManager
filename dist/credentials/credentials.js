"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCredential = createCredential;
exports.getCredentials = getCredentials;
exports.updateCredential = updateCredential;
exports.deleteCredential = deleteCredential;
const database_1 = __importDefault(require("../database/database"));
const crypto_1 = require("../crypto/crypto");
const vault_session_1 = require("../vault/vault-session");
function createCredential(credential) {
    const key = (0, vault_session_1.getVaultKey)();
    const now = new Date().toISOString();
    const result = database_1.default.prepare(`
    INSERT INTO credentials (
      name, website, username, password, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run((0, crypto_1.encrypt)(credential.name, key), (0, crypto_1.encrypt)(credential.website, key), (0, crypto_1.encrypt)(credential.username, key), (0, crypto_1.encrypt)(credential.password, key), credential.notes ? (0, crypto_1.encrypt)(credential.notes, key) : null, now, now);
    return Number(result.lastInsertRowid);
}
function getCredentials() {
    const key = (0, vault_session_1.getVaultKey)();
    const credentials = database_1.default.prepare(`
    SELECT id, name, website, username, password, notes, created_at, updated_at
    FROM credentials
    ORDER BY id DESC
  `).all();
    return credentials
        .map((credential) => ({
        id: credential.id,
        name: (0, crypto_1.decrypt)(credential.name, key),
        website: (0, crypto_1.decrypt)(credential.website, key),
        username: (0, crypto_1.decrypt)(credential.username, key),
        password: (0, crypto_1.decrypt)(credential.password, key),
        notes: credential.notes ? (0, crypto_1.decrypt)(credential.notes, key) : null,
        created_at: credential.created_at,
        updated_at: credential.updated_at,
    }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
function updateCredential(id, credential) {
    const key = (0, vault_session_1.getVaultKey)();
    const now = new Date().toISOString();
    const result = database_1.default.prepare(`
    UPDATE credentials
    SET name = ?, website = ?, username = ?, password = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run((0, crypto_1.encrypt)(credential.name, key), (0, crypto_1.encrypt)(credential.website, key), (0, crypto_1.encrypt)(credential.username, key), (0, crypto_1.encrypt)(credential.password, key), credential.notes ? (0, crypto_1.encrypt)(credential.notes, key) : null, now, id);
    if (result.changes === 0)
        throw new Error("Credencial no encontrada.");
}
function deleteCredential(id) {
    // Keep the domain layer safe even if it is called outside an HTTP route.
    (0, vault_session_1.getVaultKey)();
    const result = database_1.default.prepare("DELETE FROM credentials WHERE id = ?").run(id);
    if (result.changes === 0)
        throw new Error("Credencial no encontrada.");
}

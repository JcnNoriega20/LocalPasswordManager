"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSalt = generateSalt;
exports.deriveKey = deriveKey;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.safeCompare = safeCompare;
const node_crypto_1 = require("node:crypto");
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SCRYPT_OPTIONS = {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
};
function generateSalt() {
    return (0, node_crypto_1.randomBytes)(SALT_LENGTH);
}
function deriveKey(masterPassword, salt) {
    return (0, node_crypto_1.scryptSync)(masterPassword, salt, KEY_LENGTH, SCRYPT_OPTIONS);
}
function encrypt(plaintext, key) {
    const iv = (0, node_crypto_1.randomBytes)(IV_LENGTH);
    const cipher = (0, node_crypto_1.createCipheriv)("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([
        iv,
        authTag,
        encrypted
    ]).toString("base64");
}
function decrypt(encryptedData, key) {
    const data = Buffer.from(encryptedData, "base64");
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = (0, node_crypto_1.createDecipheriv)("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]);
    return decrypted.toString("utf8");
}
function safeCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}

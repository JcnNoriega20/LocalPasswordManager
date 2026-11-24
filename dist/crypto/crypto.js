"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCRYPT_OPTIONS = exports.AUTH_TAG_LENGTH = exports.IV_LENGTH = exports.SALT_LENGTH = exports.KEY_LENGTH = void 0;
exports.generateSalt = generateSalt;
exports.deriveKey = deriveKey;
exports.encryptBuffer = encryptBuffer;
exports.decryptBuffer = decryptBuffer;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.safeCompare = safeCompare;
const node_crypto_1 = require("node:crypto");
exports.KEY_LENGTH = 32;
exports.SALT_LENGTH = 16;
exports.IV_LENGTH = 12;
exports.AUTH_TAG_LENGTH = 16;
// These parameters preserve compatibility with existing vaults.
// Do not change them without introducing a new, versioned KDF format.
exports.SCRYPT_OPTIONS = {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
};
function generateSalt() {
    return (0, node_crypto_1.randomBytes)(exports.SALT_LENGTH);
}
function deriveKey(masterPassword, salt) {
    if (typeof masterPassword !== "string" || masterPassword.length === 0) {
        throw new Error("La contraseña maestra no es válida.");
    }
    if (!Buffer.isBuffer(salt) || salt.length !== exports.SALT_LENGTH) {
        throw new Error("El salt de la bóveda no es válido.");
    }
    return (0, node_crypto_1.scryptSync)(masterPassword, salt, exports.KEY_LENGTH, exports.SCRYPT_OPTIONS);
}
function encryptBuffer(plaintext, key) {
    if (!Buffer.isBuffer(plaintext)) {
        throw new Error("El contenido que se va a cifrar debe ser un Buffer.");
    }
    if (!Buffer.isBuffer(key) || key.length !== exports.KEY_LENGTH) {
        throw new Error("La clave de cifrado no es válida.");
    }
    const iv = (0, node_crypto_1.randomBytes)(exports.IV_LENGTH);
    const cipher = (0, node_crypto_1.createCipheriv)("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
}
function decryptBuffer(encryptedData, key) {
    if (!Buffer.isBuffer(encryptedData) || encryptedData.length < exports.IV_LENGTH + exports.AUTH_TAG_LENGTH) {
        throw new Error("El contenido cifrado está incompleto.");
    }
    if (!Buffer.isBuffer(key) || key.length !== exports.KEY_LENGTH) {
        throw new Error("La clave de cifrado no es válida.");
    }
    const iv = encryptedData.subarray(0, exports.IV_LENGTH);
    const authTag = encryptedData.subarray(exports.IV_LENGTH, exports.IV_LENGTH + exports.AUTH_TAG_LENGTH);
    const ciphertext = encryptedData.subarray(exports.IV_LENGTH + exports.AUTH_TAG_LENGTH);
    const decipher = (0, node_crypto_1.createDecipheriv)("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
function encrypt(plaintext, key) {
    if (typeof plaintext !== "string") {
        throw new Error("El contenido que se va a cifrar debe ser texto.");
    }
    // Preserve the legacy Base64 envelope byte-for-byte in layout.
    return encryptBuffer(Buffer.from(plaintext, "utf8"), key).toString("base64");
}
function decrypt(encryptedData, key) {
    if (typeof encryptedData !== "string" || !encryptedData.length) {
        throw new Error("El contenido cifrado no es válido.");
    }
    // Buffer.from(base64) is permissive; reject malformed encodings explicitly.
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encryptedData)) {
        throw new Error("El formato del contenido cifrado no es válido.");
    }
    return decryptBuffer(Buffer.from(encryptedData, "base64"), key).toString("utf8");
}
function safeCompare(a, b) {
    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b) || a.length !== b.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}

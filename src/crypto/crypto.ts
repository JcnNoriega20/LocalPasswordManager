import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";

export const KEY_LENGTH = 32;
export const SALT_LENGTH = 16;
export const IV_LENGTH = 12;
export const AUTH_TAG_LENGTH = 16;

// These parameters preserve compatibility with existing vaults.
// Do not change them without introducing a new, versioned KDF format.
export const SCRYPT_OPTIONS = {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

export function generateSalt(): Buffer {
  return randomBytes(SALT_LENGTH);
}

export function deriveKey(masterPassword: string, salt: Buffer): Buffer {
  if (typeof masterPassword !== "string" || masterPassword.length === 0) {
    throw new Error("La contraseña maestra no es válida.");
  }
  if (!Buffer.isBuffer(salt) || salt.length !== SALT_LENGTH) {
    throw new Error("El salt de la bóveda no es válido.");
  }

  return scryptSync(masterPassword, salt, KEY_LENGTH, SCRYPT_OPTIONS);
}

export function encryptBuffer(plaintext: Buffer, key: Buffer): Buffer {
  if (!Buffer.isBuffer(plaintext)) {
    throw new Error("El contenido que se va a cifrar debe ser un Buffer.");
  }
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
    throw new Error("La clave de cifrado no es válida.");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBuffer(encryptedData: Buffer, key: Buffer): Buffer {
  if (!Buffer.isBuffer(encryptedData) || encryptedData.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("El contenido cifrado está incompleto.");
  }
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
    throw new Error("La clave de cifrado no es válida.");
  }

  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encrypt(plaintext: string, key: Buffer): string {
  if (typeof plaintext !== "string") {
    throw new Error("El contenido que se va a cifrar debe ser texto.");
  }
  // Preserve the legacy Base64 envelope byte-for-byte in layout.
  return encryptBuffer(Buffer.from(plaintext, "utf8"), key).toString("base64");
}

export function decrypt(encryptedData: string, key: Buffer): string {
  if (typeof encryptedData !== "string" || !encryptedData.length) {
    throw new Error("El contenido cifrado no es válido.");
  }
  // Buffer.from(base64) is permissive; reject malformed encodings explicitly.
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encryptedData)) {
    throw new Error("El formato del contenido cifrado no es válido.");
  }
  return decryptBuffer(Buffer.from(encryptedData, "base64"), key).toString("utf8");
}

export function safeCompare(a: Buffer, b: Buffer): boolean {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b) || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

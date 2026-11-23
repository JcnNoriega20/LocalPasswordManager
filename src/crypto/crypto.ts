import {

    randomBytes,
    scryptSync,
    createCipheriv,
    createDecipheriv,
    timingSafeEqual
} from "node:crypto";

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

export function generateSalt(): Buffer {
    return randomBytes(SALT_LENGTH);
}

export function deriveKey(
    masterPassword: string,
    salt: Buffer
): Buffer {
    return scryptSync(
        masterPassword,
        salt,
        KEY_LENGTH,
        SCRYPT_OPTIONS
    );
}

export function encrypt(
    plaintext: string,
    key: Buffer
): string {

    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(
        "aes-256-gcm",
        key,
        iv
    );

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

export function decrypt(
    encryptedData: string,
    key: Buffer
): string {

    const data = Buffer.from(
        encryptedData,
        "base64"
    );

    const iv = data.subarray(
        0,
        IV_LENGTH
    );

    const authTag = data.subarray(
        IV_LENGTH,
        IV_LENGTH + AUTH_TAG_LENGTH
    );

    const ciphertext = data.subarray(
        IV_LENGTH + AUTH_TAG_LENGTH
    );

    const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        iv
    );

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]);

    return decrypted.toString("utf8");
}

export function safeCompare(
    a: Buffer,
    b: Buffer
): boolean {

    if (a.length !== b.length) {
        return false;
    }

    return timingSafeEqual(a, b);
}
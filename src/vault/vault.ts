import db from "../database/database";
import {
    generateSalt,
    deriveKey,
    encrypt,
    decrypt
} from "../crypto/crypto";

const VERIFIER_TEXT = "MY_PASSWORD_MANAGER_VAULT_OK";

export function vaultExists(): boolean {

    const result = db
        .prepare(`
      SELECT COUNT(*) as count
      FROM vault_metadata
    `)
        .get() as { count: number };

    return result.count > 0;
}

export function createVault(
    masterPassword: string
): void {

    if (vaultExists()) {
        throw new Error(
            "La bóveda ya está creada."
        );
    }

    if (masterPassword.length < 12) {
        throw new Error(
            "La contraseña maestra debe tener al menos 12 caracteres."
        );
    }

    const salt = generateSalt();

    const key = deriveKey(
        masterPassword,
        salt
    );

    const verifier = encrypt(
        VERIFIER_TEXT,
        key
    );

    db.prepare(`
    INSERT INTO vault_metadata (
      salt,
      verifier,
      created_at
    )
    VALUES (?, ?, ?)
  `).run(
        salt.toString("base64"),
        verifier,
        new Date().toISOString()
    );

    key.fill(0);
}

export function unlockVault(
    masterPassword: string
): Buffer {

    const metadata = db
        .prepare(`
      SELECT salt, verifier
      FROM vault_metadata
      LIMIT 1
    `)
        .get() as {
            salt: string;
            verifier: string;
        } | undefined;

    if (!metadata) {
        throw new Error(
            "La bóveda todavía no ha sido creada."
        );
    }

    const salt = Buffer.from(
        metadata.salt,
        "base64"
    );

    const key = deriveKey(
        masterPassword,
        salt
    );

    try {

        const verifier = decrypt(
            metadata.verifier,
            key
        );

        if (verifier !== VERIFIER_TEXT) {
            key.fill(0);

            throw new Error(
                "Contraseña maestra incorrecta."
            );
        }

        return key;

    } catch {

        key.fill(0);

        throw new Error(
            "Contraseña maestra incorrecta."
        );
    }
}
import db from "../database/database";
import {
    encrypt,
    decrypt
} from "../crypto/crypto";
import {
    getVaultKey
} from "../vault/vault-session";

export interface CredentialInput {
    name: string;
    website: string;
    username: string;
    password: string;
    notes?: string | null;
}

export function createCredential(
    credential: CredentialInput
): number {

    const key = getVaultKey();

    const now = new Date().toISOString();

    const encryptedUsername = encrypt(
        credential.username,
        key
    );

    const encryptedPassword = encrypt(
        credential.password,
        key
    );

    const encryptedNotes = credential.notes
        ? encrypt(credential.notes, key)
        : null;

    const result = db
        .prepare(`
      INSERT INTO credentials (
        name,
        website,
        username,
        password,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
        .run(
            credential.name,
            credential.website,
            encryptedUsername,
            encryptedPassword,
            encryptedNotes,
            now,
            now
        );

    return Number(result.lastInsertRowid);
}

export function getCredentials() {

    const key = getVaultKey();

    const credentials = db
        .prepare(`
      SELECT
        id,
        name,
        website,
        username,
        password,
        notes,
        created_at,
        updated_at
      FROM credentials
      ORDER BY name ASC
    `)
        .all() as Array<{
            id: number;
            name: string;
            website: string;
            username: string;
            password: string;
            notes: string | null;
            created_at: string;
            updated_at: string;
        }>;

    return credentials.map((credential) => {

        return {
            id: credential.id,
            name: credential.name,
            website: credential.website,

            username: decrypt(
                credential.username,
                key
            ),

            password: decrypt(
                credential.password,
                key
            ),

            notes: credential.notes
                ? decrypt(credential.notes, key)
                : null,

            created_at: credential.created_at,
            updated_at: credential.updated_at
        };
    });
}

export function updateCredential(
    id: number,
    credential: CredentialInput
): void {

    const key = getVaultKey();

    const encryptedUsername = encrypt(
        credential.username,
        key
    );

    const encryptedPassword = encrypt(
        credential.password,
        key
    );

    const encryptedNotes = credential.notes
        ? encrypt(credential.notes, key)
        : null;

    const now = new Date().toISOString();

    const result = db
        .prepare(`
      UPDATE credentials
      SET
        name = ?,
        website = ?,
        username = ?,
        password = ?,
        notes = ?,
        updated_at = ?
      WHERE id = ?
    `)
        .run(
            credential.name,
            credential.website,
            encryptedUsername,
            encryptedPassword,
            encryptedNotes,
            now,
            id
        );

    if (result.changes === 0) {
        throw new Error(
            "Credencial no encontrada."
        );
    }
}

export function deleteCredential(
    id: number
): void {

    const result = db
        .prepare(`
      DELETE FROM credentials
      WHERE id = ?
    `)
        .run(id);

    if (result.changes === 0) {
        throw new Error(
            "Credencial no encontrada."
        );
    }
}
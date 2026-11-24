import db from "../database/database";
import { encrypt, decrypt } from "../crypto/crypto";
import { getVaultKey } from "../vault/vault-session";

export interface CredentialInput {
  name: string;
  website: string;
  username: string;
  password: string;
  notes?: string | null;
}

export interface CredentialRecord {
  id: number;
  name: string;
  website: string;
  username: string;
  password: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function createCredential(credential: CredentialInput): number {
  const key = getVaultKey();
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO credentials (
      name, website, username, password, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    encrypt(credential.name, key),
    encrypt(credential.website, key),
    encrypt(credential.username, key),
    encrypt(credential.password, key),
    credential.notes ? encrypt(credential.notes, key) : null,
    now,
    now
  );

  return Number(result.lastInsertRowid);
}

export function getCredentials(): CredentialRecord[] {
  const key = getVaultKey();
  const credentials = db.prepare(`
    SELECT id, name, website, username, password, notes, created_at, updated_at
    FROM credentials
    ORDER BY id DESC
  `).all() as Array<{
    id: number;
    name: string;
    website: string;
    username: string;
    password: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return credentials
    .map((credential) => ({
      id: credential.id,
      name: decrypt(credential.name, key),
      website: decrypt(credential.website, key),
      username: decrypt(credential.username, key),
      password: decrypt(credential.password, key),
      notes: credential.notes ? decrypt(credential.notes, key) : null,
      created_at: credential.created_at,
      updated_at: credential.updated_at,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function updateCredential(id: number, credential: CredentialInput): void {
  const key = getVaultKey();
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE credentials
    SET name = ?, website = ?, username = ?, password = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    encrypt(credential.name, key),
    encrypt(credential.website, key),
    encrypt(credential.username, key),
    encrypt(credential.password, key),
    credential.notes ? encrypt(credential.notes, key) : null,
    now,
    id
  );

  if (result.changes === 0) throw new Error("Credencial no encontrada.");
}

export function deleteCredential(id: number): void {
  // Keep the domain layer safe even if it is called outside an HTTP route.
  getVaultKey();
  const result = db.prepare("DELETE FROM credentials WHERE id = ?").run(id);
  if (result.changes === 0) throw new Error("Credencial no encontrada.");
}

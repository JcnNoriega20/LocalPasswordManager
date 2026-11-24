import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("migrates legacy plaintext metadata without losing existing credentials", async () => {
  const temporaryDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "lpm-migration-test-"));
  process.env.LPM_DATA_DIR = temporaryDataDirectory;
  let closeDatabase: (() => void) | undefined;
  let lockSession: (() => void) | undefined;

  try {
    // Import only after setting LPM_DATA_DIR because the database is a singleton.
    const databaseModule = (await import(
      "../database/database.js"
    )) as unknown as {
      default: {
        close: () => void;
        prepare: (sql: string) => {
          run: (...values: unknown[]) => unknown;
          get: (...values: unknown[]) => unknown;
        };
      };
    };

    const db = databaseModule.default;
    closeDatabase = () => db.close();
    await import("../database/schema.js");
    const { generateSalt, deriveKey, encrypt, decryptBuffer } = await import("../crypto/crypto.js");
    const { unlockVault } = await import("../vault/vault.js");
    const { setVaultKey, lockVault } = await import("../vault/vault-session.js");
    lockSession = lockVault;
    const { getCredentials } = await import("../credentials/credentials.js");

    const masterPassword = "ClaveMaestraDePrueba-2026!";
    const salt = generateSalt();
    const key = deriveKey(masterPassword, salt);
    const verifier = encrypt("MY_PASSWORD_MANAGER_VAULT_OK", key);

    // Recreate the pre-migration metadata format.
    db.prepare(`
      INSERT INTO vault_metadata (id, salt, verifier, created_at)
      VALUES (1, ?, ?, ?)
    `).run(salt.toString("base64"), verifier, new Date().toISOString());

    db.prepare(`
      INSERT INTO credentials (name, website, username, password, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "Cuenta de prueba",
      "https://example.com",
      encrypt("usuario@example.com", key),
      encrypt("Contraseña-secreta-123", key),
      encrypt("Nota privada", key),
      new Date().toISOString(),
      new Date().toISOString()
    );
    key.fill(0);

    const unlockedKey = unlockVault(masterPassword);
    setVaultKey(unlockedKey);

    const metadata = db.prepare("SELECT format_version FROM vault_metadata WHERE id = 1").get() as { format_version: number };
    assert.equal(metadata.format_version, 2);

    const raw = db.prepare("SELECT name, website FROM credentials LIMIT 1").get() as { name: string; website: string };
    assert.notEqual(raw.name, "Cuenta de prueba");
    assert.notEqual(raw.website, "https://example.com");

    const [credential] = getCredentials();
    assert.equal(credential.name, "Cuenta de prueba");
    assert.equal(credential.website, "https://example.com");
    assert.equal(credential.username, "usuario@example.com");
    assert.equal(credential.password, "Contraseña-secreta-123");
    assert.equal(credential.notes, "Nota privada");

    const backups = path.join(temporaryDataDirectory, "backups");
    const backupName = fs.readdirSync(backups).find((name) => name.endsWith(".db.enc"));
    assert.ok(backupName);
    const encryptedBackup = fs.readFileSync(path.join(backups, backupName));
    assert.notEqual(encryptedBackup.subarray(0, 16).toString("utf8"), "SQLite format 3\0");
    const restoredSnapshot = decryptBuffer(encryptedBackup, unlockedKey);
    assert.equal(restoredSnapshot.subarray(0, 16).toString("utf8"), "SQLite format 3\0");
    lockVault();
  } finally {
    lockSession?.();
    closeDatabase?.();
    fs.rmSync(temporaryDataDirectory, { recursive: true, force: true });
  }
});

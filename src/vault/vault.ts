import db, { dataDirectory } from "../database/database";
import fs from "node:fs";
import path from "node:path";
import {
  generateSalt,
  deriveKey,
  encrypt,
  decrypt,
  encryptBuffer,
} from "../crypto/crypto";

const VERIFIER_TEXT = "MY_PASSWORD_MANAGER_VAULT_OK";
const CURRENT_FORMAT_VERSION = 2;

export function vaultExists(): boolean {
  const result = db
    .prepare("SELECT COUNT(*) as count FROM vault_metadata")
    .get() as { count: number };
  return result.count > 0;
}

/**
 * Migrates legacy credential metadata (name and website) from plaintext to
 * AES-GCM ciphertext. The migration is atomic: either every row and the
 * version marker are committed, or the original database remains unchanged.
 */
function migrateVaultData(key: Buffer, currentVersion: number): void {
  if (currentVersion > CURRENT_FORMAT_VERSION) {
    throw new Error(
      "Esta bóveda fue creada con una versión más reciente de LocalPasswordManager. Actualiza la aplicación."
    );
  }
  if (currentVersion === CURRENT_FORMAT_VERSION) return;
  if (currentVersion !== 1) {
    throw new Error(`Versión de bóveda no compatible: ${currentVersion}`);
  }

  // Produce a consistent SQLite snapshot before touching the legacy vault.
  // The backup remains local and is never uploaded by this application.
  const backupDirectory = path.join(dataDirectory, "backups");
  fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  const backupId = `${Date.now()}-${process.hrtime.bigint().toString()}`;
  const temporarySnapshotPath = path.join(backupDirectory, `vault-before-v2-${backupId}.tmp.db`);
  const encryptedBackupPath = path.join(backupDirectory, `vault-before-v2-${backupId}.db.enc`);
  const escapedSnapshotPath = temporarySnapshotPath.replace(/'/g, "''");

  try {
    db.exec(`VACUUM INTO '${escapedSnapshotPath}'`);
    try {
      fs.chmodSync(temporarySnapshotPath, 0o600);
    } catch {
      // Windows does not provide POSIX file modes; cleanup still happens below.
    }
    const snapshotBytes = fs.readFileSync(temporarySnapshotPath);
    try {
      const encryptedSnapshot = encryptBuffer(snapshotBytes, key);
      fs.writeFileSync(encryptedBackupPath, encryptedSnapshot, { flag: "wx", mode: 0o600 });
    } finally {
      snapshotBytes.fill(0);
    }
  } finally {
    // Do not leave a plaintext copy of the legacy database behind.
    if (fs.existsSync(temporarySnapshotPath)) fs.unlinkSync(temporarySnapshotPath);
  }

  const migrate = db.transaction(() => {
    const rows = db
      .prepare("SELECT id, name, website FROM credentials")
      .all() as Array<{ id: number; name: string; website: string }>;

    const update = db.prepare(
      "UPDATE credentials SET name = ?, website = ? WHERE id = ?"
    );

    for (const row of rows) {
      update.run(encrypt(row.name, key), encrypt(row.website, key), row.id);
    }

    db.prepare(
      "UPDATE vault_metadata SET format_version = ? WHERE id = 1"
    ).run(CURRENT_FORMAT_VERSION);
  });

  migrate();
}

export function createVault(masterPassword: string): void {
  if (vaultExists()) throw new Error("La bóveda ya está creada.");
  if (typeof masterPassword !== "string" || masterPassword.length < 12) {
    throw new Error("La contraseña maestra debe tener al menos 12 caracteres.");
  }

  const salt = generateSalt();
  const key = deriveKey(masterPassword, salt);

  try {
    const verifier = encrypt(VERIFIER_TEXT, key);
    db.prepare(`
      INSERT INTO vault_metadata (
        id, salt, verifier, created_at, format_version
      ) VALUES (1, ?, ?, ?, ?)
    `).run(
      salt.toString("base64"),
      verifier,
      new Date().toISOString(),
      CURRENT_FORMAT_VERSION
    );
  } finally {
    key.fill(0);
  }
}

export function unlockVault(masterPassword: string): Buffer {
  const metadata = db
    .prepare(`
      SELECT salt, verifier, format_version
      FROM vault_metadata
      WHERE id = 1
      LIMIT 1
    `)
    .get() as {
      salt: string;
      verifier: string;
      format_version?: number;
    } | undefined;

  if (!metadata) throw new Error("La bóveda todavía no ha sido creada.");

  const salt = Buffer.from(metadata.salt, "base64");
  const key = deriveKey(masterPassword, salt);

  let verifier: string;
  try {
    verifier = decrypt(metadata.verifier, key);
  } catch {
    key.fill(0);
    throw new Error("Contraseña maestra incorrecta o datos de verificación dañados.");
  }

  if (verifier !== VERIFIER_TEXT) {
    key.fill(0);
    throw new Error("Contraseña maestra incorrecta.");
  }

  try {
    // Old databases receive format_version=1 from the schema migration.
    migrateVaultData(key, metadata.format_version ?? 1);
    return key;
  } catch (error) {
    key.fill(0);
    throw new Error(
      `No se pudo completar la migración de la bóveda; no se confirmó ningún cambio. ${error instanceof Error ? error.message : "Error desconocido."}`
    );
  }
}

import test from "node:test";
import assert from "node:assert/strict";
import { generateSalt, deriveKey, encrypt, decrypt } from "../crypto/crypto";

test("AES-256-GCM round trip and tamper detection", () => {
  const salt = generateSalt();
  const key = deriveKey("ClaveMaestra-de-prueba-2026!", salt);
  const original = "Texto privado de prueba 🔐";
  const encrypted = encrypt(original, key);

  assert.equal(decrypt(encrypted, key), original);

  const bytes = Buffer.from(encrypted, "base64");
  bytes[bytes.length - 1] ^= 1;
  assert.throws(() => decrypt(bytes.toString("base64"), key));
  key.fill(0);
});

test("rejects malformed encrypted payloads", () => {
  const salt = generateSalt();
  const key = deriveKey("ClaveMaestra-de-prueba-2026!", salt);
  assert.throws(() => decrypt("not-base64!", key));
  assert.throws(() => decrypt("AA==", key));
  key.fill(0);
});

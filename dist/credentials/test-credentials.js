"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../database/database"));
const vault_1 = require("../vault/vault");
const vault_session_1 = require("../vault/vault-session");
const credentials_1 = require("./credentials");
console.log("🔐 Desbloqueando bóveda...");
const key = (0, vault_1.unlockVault)("MiClaveMaestraDePrueba123!");
(0, vault_session_1.setVaultKey)(key);
console.log("✅ Bóveda desbloqueada.");
console.log("\n🔑 Creando credencial de prueba...");
const id = (0, credentials_1.createCredential)({
    name: "Google",
    website: "https://google.com",
    username: "usuario.prueba@gmail.com",
    password: "PasswordPrueba123!",
    notes: "Cuenta de prueba"
});
console.log("✅ Credencial creada con ID:", id);
console.log("\n📦 Datos almacenados directamente en SQLite:");
const rawCredential = database_1.default
    .prepare(`
    SELECT *
    FROM credentials
    WHERE id = ?
  `)
    .get(id);
console.log(rawCredential);
console.log("\n🔓 Recuperando credencial mediante nuestro servicio...");
const credentials = (0, credentials_1.getCredentials)();
const createdCredential = credentials.find((credential) => credential.id === id);
console.log(createdCredential);
console.log("\n🔎 Comprobando datos...");
if (createdCredential?.username ===
    "usuario.prueba@gmail.com" &&
    createdCredential?.password ===
        "PasswordPrueba123!" &&
    createdCredential?.notes ===
        "Cuenta de prueba") {
    console.log("✅ Los datos fueron descifrados correctamente.");
}
else {
    console.log("❌ ERROR: los datos no coinciden.");
}
console.log("\n🔒 Bloqueando bóveda...");
(0, vault_session_1.lockVault)();
console.log("¿Bóveda desbloqueada?", false);
console.log("\n🔒 Intentando acceder a las credenciales con la bóveda bloqueada...");
try {
    (0, credentials_1.getCredentials)();
    console.log("❌ ERROR: se pudieron obtener credenciales con la bóveda bloqueada.");
}
catch (error) {
    console.log("✅ Acceso rechazado correctamente.");
    console.log("Mensaje:", error instanceof Error
        ? error.message
        : error);
}

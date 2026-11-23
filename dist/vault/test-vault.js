"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../database/database"));
const vault_1 = require("./vault");
console.log("¿Existe la bóveda?", (0, vault_1.vaultExists)());
console.log("\nCreando bóveda...");
(0, vault_1.createVault)("MiClaveMaestraDePrueba123!");
console.log("Bóveda creada correctamente.");
console.log("\n¿Existe la bóveda ahora?", (0, vault_1.vaultExists)());
console.log("\nIntentando desbloquear...");
const key = (0, vault_1.unlockVault)("MiClaveMaestraDePrueba123!");
console.log("✅ Bóveda desbloqueada correctamente.");
console.log("Longitud de la clave:", key.length, "bytes");
key.fill(0);
console.log("\nIntentando desbloquear con contraseña incorrecta...");
try {
    (0, vault_1.unlockVault)("ContraseñaIncorrecta123!");
    console.log("❌ ERROR: se permitió una contraseña incorrecta.");
}
catch {
    console.log("✅ Contraseña incorrecta rechazada.");
}
console.log("\nDatos almacenados en vault_metadata:");
const metadata = database_1.default
    .prepare(`
    SELECT *
    FROM vault_metadata
  `)
    .all();
console.log(metadata);

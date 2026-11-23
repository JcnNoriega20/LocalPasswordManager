"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("./crypto");
const correctPassword = "MiClaveMaestraDePrueba123!";
const wrongPassword = "ContraseñaIncorrecta123";
const originalText = "Esta es una contraseña secreta.";
const salt = (0, crypto_1.generateSalt)();
const correctKey = (0, crypto_1.deriveKey)(correctPassword, salt);
const wrongKey = (0, crypto_1.deriveKey)(wrongPassword, salt);
const encrypted = (0, crypto_1.encrypt)(originalText, correctKey);
console.log("Texto cifrado:");
console.log(encrypted);
console.log("\nIntentando descifrar con contraseña correcta...");
const decrypted = (0, crypto_1.decrypt)(encrypted, correctKey);
console.log("Resultado:");
console.log(decrypted);
console.log("\nIntentando descifrar con contraseña incorrecta...");
try {
    const wrongDecryption = (0, crypto_1.decrypt)(encrypted, wrongKey);
    console.log(wrongDecryption);
}
catch {
    console.log("❌ No se pudo descifrar. Contraseña incorrecta.");
}

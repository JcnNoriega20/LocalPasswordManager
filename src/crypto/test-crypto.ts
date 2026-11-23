import {
    generateSalt,
    deriveKey,
    encrypt,
    decrypt
} from "./crypto";

const correctPassword =
    "MiClaveMaestraDePrueba123!";

const wrongPassword =
    "ContraseñaIncorrecta123";

const originalText =
    "Esta es una contraseña secreta.";

const salt = generateSalt();

const correctKey = deriveKey(
    correctPassword,
    salt
);

const wrongKey = deriveKey(
    wrongPassword,
    salt
);

const encrypted = encrypt(
    originalText,
    correctKey
);

console.log("Texto cifrado:");
console.log(encrypted);

console.log("\nIntentando descifrar con contraseña correcta...");

const decrypted = decrypt(
    encrypted,
    correctKey
);

console.log("Resultado:");
console.log(decrypted);

console.log("\nIntentando descifrar con contraseña incorrecta...");

try {

    const wrongDecryption = decrypt(
        encrypted,
        wrongKey
    );

    console.log(wrongDecryption);

} catch {

    console.log(
        "❌ No se pudo descifrar. Contraseña incorrecta."
    );
}
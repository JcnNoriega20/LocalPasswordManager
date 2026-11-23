import db from "../database/database";
import {
    unlockVault
} from "../vault/vault";

import {
    setVaultKey,
    lockVault
} from "../vault/vault-session";

import {
    createCredential,
    getCredentials
} from "./credentials";

console.log("🔐 Desbloqueando bóveda...");

const key = unlockVault(
    "MiClaveMaestraDePrueba123!"
);

setVaultKey(key);

console.log("✅ Bóveda desbloqueada.");

console.log("\n🔑 Creando credencial de prueba...");

const id = createCredential({
    name: "Google",
    website: "https://google.com",
    username: "usuario.prueba@gmail.com",
    password: "PasswordPrueba123!",
    notes: "Cuenta de prueba"
});

console.log(
    "✅ Credencial creada con ID:",
    id
);

console.log("\n📦 Datos almacenados directamente en SQLite:");

const rawCredential = db
    .prepare(`
    SELECT *
    FROM credentials
    WHERE id = ?
  `)
    .get(id);

console.log(rawCredential);

console.log(
    "\n🔓 Recuperando credencial mediante nuestro servicio..."
);

const credentials = getCredentials();

const createdCredential = credentials.find(
    (credential) => credential.id === id
);

console.log(createdCredential);

console.log("\n🔎 Comprobando datos...");

if (
    createdCredential?.username ===
    "usuario.prueba@gmail.com" &&
    createdCredential?.password ===
    "PasswordPrueba123!" &&
    createdCredential?.notes ===
    "Cuenta de prueba"
) {
    console.log(
        "✅ Los datos fueron descifrados correctamente."
    );
} else {
    console.log(
        "❌ ERROR: los datos no coinciden."
    );
}

console.log("\n🔒 Bloqueando bóveda...");

lockVault();

console.log(
    "¿Bóveda desbloqueada?",
    false
);

console.log(
    "\n🔒 Intentando acceder a las credenciales con la bóveda bloqueada..."
);

try {

    getCredentials();

    console.log(
        "❌ ERROR: se pudieron obtener credenciales con la bóveda bloqueada."
    );

} catch (error) {

    console.log(
        "✅ Acceso rechazado correctamente."
    );

    console.log(
        "Mensaje:",
        error instanceof Error
            ? error.message
            : error
    );
}
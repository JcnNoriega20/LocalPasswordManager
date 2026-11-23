import db from "../database/database";
import {
    createVault,
    unlockVault,
    vaultExists
} from "./vault";

console.log(
    "¿Existe la bóveda?",
    vaultExists()
);

console.log("\nCreando bóveda...");

createVault(
    "MiClaveMaestraDePrueba123!"
);

console.log("Bóveda creada correctamente.");

console.log(
    "\n¿Existe la bóveda ahora?",
    vaultExists()
);

console.log("\nIntentando desbloquear...");

const key = unlockVault(
    "MiClaveMaestraDePrueba123!"
);

console.log(
    "✅ Bóveda desbloqueada correctamente."
);

console.log(
    "Longitud de la clave:",
    key.length,
    "bytes"
);

key.fill(0);

console.log(
    "\nIntentando desbloquear con contraseña incorrecta..."
);

try {

    unlockVault(
        "ContraseñaIncorrecta123!"
    );

    console.log(
        "❌ ERROR: se permitió una contraseña incorrecta."
    );

} catch {

    console.log(
        "✅ Contraseña incorrecta rechazada."
    );
}

console.log("\nDatos almacenados en vault_metadata:");

const metadata = db
    .prepare(`
    SELECT *
    FROM vault_metadata
  `)
    .all();

console.log(metadata); 
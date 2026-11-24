# Notas de migración — etapa 1

## Antes de actualizar

1. Cierra todas las instancias de LocalPasswordManager.
2. Copia manualmente la carpeta `data` completa, incluyendo `vault.db`, `vault.db-wal` y `vault.db-shm` si existen.
3. No elimines ni renombres la bóveda original.
4. Actualiza el código y ejecuta `npm install` si cambió el `package.json`.

## Qué cambia

- La ubicación de datos deja de depender de `process.cwd()`. En desarrollo (`tsx`) y producción (`dist`) se utiliza la carpeta `data` en la raíz del proyecto. Se puede sobrescribir con `LPM_DATA_DIR`.
- Las bóvedas existentes se detectan como formato de datos 1. Al desbloquearlas correctamente, se genera un snapshot SQLite cifrado AES-256-GCM en `data/backups/` y luego se cifran `name` y `website` en una transacción. El snapshot temporal sin cifrar se elimina al terminar la copia. `username`, `password` y `notes` conservan el formato cifrado anterior.
- Las bóvedas nuevas se crean con formato de datos 2.
- El formato AES-256-GCM y la derivación Scrypt actuales no se cambian en esta etapa.
- El CSV se procesa en memoria; ya no se escribe un archivo CSV temporal sin cifrar.
- El servidor escucha en `127.0.0.1:3000`. La extensión usa esa dirección.

## Actualización local

```bash
npm install
npm test
npm run build
npm run dev
```

Después, en Helium abre `chrome://extensions/` y recarga la extensión. Prueba primero desbloquear la bóveda y verificar que aparecen todas las credenciales. Crea una credencial de prueba, bloquea y vuelve a desbloquear.

## Si algo falla

- No borres `data/` ni ningún archivo `.db`, `.db-wal` o `.db-shm`.
- Conserva el snapshot `data/backups/vault-before-v2-*.db` y tu copia manual.
- Si la migración no termina, no sigas intentando con scripts que reinicialicen la base de datos. Comparte el mensaje de error y revisaremos el snapshot.

# LocalPasswordManager — arquitectura y hoja de ruta

## Objetivo

Administrador de contraseñas **local-first**. La bóveda funciona sin conexión; el usuario puede activar una sincronización cifrada de extremo a extremo cuando exista una infraestructura de sincronización. El servidor de sincronización no recibirá claves de descifrado ni credenciales en texto plano.

## Arquitectura objetivo

- **Clientes:** aplicación web React + TypeScript (nueva interfaz), extensión Manifest V3 y, más adelante, cliente de escritorio si se justifica.
- **Núcleo:** módulo TypeScript independiente para bóveda, criptografía, sesiones, validación y formato de exportación.
- **Persistencia local:** SQLite con cifrado de campos sensibles a nivel de aplicación.
- **API local:** Express enlazado exclusivamente a `127.0.0.1`; API versionada y acceso de origen restringido.
- **Copias:** snapshots locales y exportaciones cifradas autenticadas; restauración probada antes de reemplazar la bóveda activa.
- **Sincronización opcional:** servicio remoto que almacena blobs cifrados, versiones y metadatos mínimos. Cifrado/descifrado ocurre en los dispositivos.

## Decisiones criptográficas

### Formato heredado (V1)

- KDF: Node.js `scryptSync`, `N=32768`, `r=8`, `p=1`, `maxmem=64 MiB`.
- Salt: 16 bytes aleatorios.
- Cifrado: AES-256-GCM.
- IV: 12 bytes aleatorios.
- Tag: 16 bytes.
- Codificación almacenada: Base64 de `IV || tag || ciphertext`.

Este formato se conserva para poder desbloquear las bóvedas existentes. No se cambian sus parámetros ni su distribución de bytes.

### Formato futuro (V2 criptográfico)

Evaluar Argon2id como KDF, con parámetros medidos en equipos de referencia, y un sobre de cifrado versionado que incluya algoritmo, parámetros, salt, nonce, tag y ciphertext. Evaluar AAD para vincular ciphertext a su registro/campo. No migrar automáticamente hasta tener pruebas, límites de recursos y una ruta de rollback.

> La versión 2 de datos introducida en esta primera etapa **no** significa que ya se haya cambiado la KDF o el formato AES. Solo indica que `name` y `website` también están cifrados. El formato criptográfico heredado sigue siendo el mismo.

## Etapas

1. **Seguridad y preservación local (en curso):** cifrado de metadatos, migración transaccional, backup previo, límites de API, API loopback, importación CSV sin archivo temporal, pruebas de migración.
2. **Auditoría criptográfica y sesiones:** comparar Argon2id/scrypt, AAD, rotación de clave, bloqueo configurable, memoria y portapapeles.
3. **Interfaz:** conservar el backend; decidir React + TypeScript después de revisar las pantallas actuales. Separar dashboard y extensión como clientes.
4. **Backup/restore:** exportación cifrada, formato documentado, autenticidad, restauración a staging y validación.
5. **Sincronización:** identidad de dispositivo, emparejamiento, blobs E2EE, control de versiones, conflictos y revocación.
6. **Preparación comercial:** pruebas de seguridad, threat model, documentación, instaladores, actualizaciones y política de privacidad.

## Límites de seguridad actuales

La API local está restringida a loopback y valida `Host`/`Origin`, pero el origen de una extensión no es un mecanismo de autenticación fuerte frente a otras extensiones o procesos locales. Antes de distribuir el producto se debe añadir emparejamiento cliente-servidor con un secreto aleatorio por instalación, rotación/revocación y protección contra solicitudes locales no autorizadas.

SQLite `secure_delete` y el borrado de buffers son mitigaciones de mejor esfuerzo; no garantizan borrado físico de SSD, snapshots, backups o memoria administrada por el runtime.

# API local autenticada — configuración de desarrollo

Esta versión agrega una primera capa de autenticación entre la extensión y el servidor local.

## 1. Obtener el ID de la extensión

1. Abre `chrome://extensions` o `helium://extensions` en Helium.
2. Activa el modo desarrollador.
3. Busca **My Password Manager** y copia el campo **ID**.
4. Debe tener 32 caracteres, todos entre `a` y `p`.

## 2. Iniciar el servidor en Windows CMD

En la terminal, desde la carpeta del proyecto, ejecuta (reemplaza el valor por el ID real):

```bat
set "LPM_EXTENSION_ID=abcdefghijklmnopqrstuvwxyzabcdef" && npm run dev
```

La variable se aplica a esa ejecución. Si abres otra terminal, tendrás que volver a establecerla. Para `npm start`, usa el mismo patrón:

```bat
set "LPM_EXTENSION_ID=abcdefghijklmnopqrstuvwxyzabcdef" && npm start
```

No escribas literalmente el ID de ejemplo.

## 3. Recargar la extensión

En la página de extensiones, pulsa **Recargar** en My Password Manager. Cierra y vuelve a abrir el popup.

El service worker obtiene el token local mediante `/auth/token`, lo guarda en `chrome.storage.local` y lo envía como `Authorization: Bearer ...` en las llamadas a la API.

## 4. Token local

El servidor crea automáticamente `data/.api-token` con 32 bytes aleatorios (64 caracteres hexadecimales). El archivo queda dentro de `data/`, carpeta ignorada por Git, junto a la base de datos. No lo compartas ni lo subas al repositorio.

Si se pierde el token, detén el servidor y elimina `data/.api-token`; al volver a iniciar se generará otro. Después recarga la extensión y se aprovisionará el token nuevo. Esto revoca el token anterior.

## Alcance y limitaciones

- Las rutas de la API requieren el token Bearer.
- El servidor acepta únicamente el origen exacto configurado mediante `LPM_EXTENSION_ID`; ya no acepta cualquier ID con formato de extensión.
- Las respuestas sensibles y el token usan `Cache-Control: no-store`.
- Esta es una protección frente a solicitudes originadas desde páginas web y extensiones distintas. No debe considerarse protección contra malware o procesos locales que controlen el equipo: un proceso local con capacidad de conectarse al puerto y falsificar cabeceras puede intentar obtener el token. Antes de distribuir comercialmente la aplicación habrá que diseñar un emparejamiento local más fuerte y una estrategia de revocación/rotación.

# Loom

Loom es una app macOS tipo Loom: aparece como una capa flotante encima del monitor, graba pantalla, cámara y audio, compone la cámara como burbuja movible sobre el video, permite dibujar durante la grabación y puede guardar localmente o subir a nube.

## Funcionalidades investigadas de Loom Desktop

Fuentes oficiales consultadas:

- Loom Desktop graba pantalla completa, ventana, tamaño personalizado, cámara sola, pantalla sola y pantalla + cámara.
- La app Desktop ofrece la experiencia más completa: pantalla completa, cámara, audio del sistema y grabación de ventana.
- El flujo de Loom usa una ventana pequeña de grabación, selección de micrófono, botón de inicio, stop y subida automática/link.
- Incluye burbuja de cámara, cambio entre pantalla sola y pantalla + cámara durante grabación, avatar, fondos, controles flotantes y timer.
- Tiene notas de presentador visibles mientras grabas, pero no pensadas para aparecer en el video.
- Tiene dibujo durante grabación, con trazos que desaparecen después de unos segundos.
- Tiene reinicio rápido de grabación manteniendo preferencias.
- Sus videos Desktop usan H.264/AAC en backend y hasta 4K; esta app usa el mejor contenedor disponible por Electron/Chromium localmente, normalmente WebM y a veces MP4 si el runtime lo soporta.
- Loom sube a Loom HQ y genera links; esta app puede guardar local, subir a Cloudflare Stream, Google Drive o YouTube no listado.

Referencias:

- https://www.loom.com/screen-recorder
- https://support.atlassian.com/loom/docs/get-started-with-the-loom-desktop-app/
- https://support.atlassian.com/loom/docs/loom-device-compatibility
- https://support.atlassian.com/loom/docs/use-looms-different-capture-modes/
- https://support.atlassian.com/loom/docs/capture-internal-audio-system-audio
- https://support.atlassian.com/loom/docs/use-speaker-notes/
- https://support.atlassian.com/loom/docs/use-the-drawing-tool/
- https://support.atlassian.com/loom/docs/restart-a-recording
- https://support.atlassian.com/loom/docs/loom-video-encoding-settings-by-platform/

## Cómo correr

```bash
npm install
npm start
```

## Crear DMG para compartir

```bash
npm run pack
```

```bash
npm run dist
```

El instalador queda como `dist/Loom-<version>-arm64.dmg` y permite arrastrar la app a Applications.

## Permisos macOS

En `System Settings > Privacy & Security`, permite:

- Screen Recording
- Camera
- Microphone

Después cierra y abre la app otra vez.

## Google Drive y YouTube

La app usa un OAuth Client de tipo Desktop con PKCE y un callback local temporal en `127.0.0.1`. No necesita dominio ni backend para Google. Cada usuario conecta su propia cuenta y los tokens quedan guardados sólo en su Mac.

Para Google Drive, la app permite elegir entre guardar en `Mi unidad` o crear/reutilizar una carpeta `Loom` dentro del Drive del usuario.

Scopes usados:

- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/youtube.upload`

## Diferencias intencionales

No usa la nube de Loom ni servicios propietarios de Loom, y no implementa IA/transcripción porque eso requiere backend/modelos externos. El núcleo de producto sí está: grabación local, pantalla/cámara/mic, biblioteca, controles, dibujo, guardado en tu computadora y subida opcional a nube propia.

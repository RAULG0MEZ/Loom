# Loom macOS App

App Electron para macOS tipo Loom:

- overlay flotante sin ventana tradicional;
- pantalla completa, pantalla + camara, solo camara y area personalizada;
- camara movible, redimensionable y con modo pantalla completa;
- barra en vivo movible para pausar, terminar, cancelar y dibujar;
- resolucion configurable;
- guardado local en carpeta elegida o subida a Cloudflare Stream;
- redireccion a la biblioteca de GitHub Pages al subir videos.

## Correr en desarrollo

```bash
npm install
npm start
```

## Crear DMG

```bash
npm run dist
```

El DMG queda en `dist/`.

## Configuracion local de Cloudflare Stream

La app busca un archivo local `cloudflare-stream.json` en el Application Support de la app. No se suben tokens al repo.

Ejemplo:

```json
{
  "accountId": "CLOUDFLARE_ACCOUNT_ID",
  "apiToken": "CLOUDFLARE_STREAM_API_TOKEN",
  "customerSubdomain": "customer-example.cloudflarestream.com",
  "libraryUrl": "https://raulg0mez.github.io/Loom/"
}
```

## Permisos macOS

Instala la app en `Aplicaciones` antes de dar permisos. Luego activa:

- Camara
- Microfono
- Grabacion de audio del sistema y pantalla

Si macOS se queda en loop de permisos, cierra Loom por completo y abre la copia instalada en `Aplicaciones`, no la del DMG.

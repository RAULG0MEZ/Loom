# Loom

Repositorio de Loom para macOS y su biblioteca web en GitHub Pages.

## Descargar la app

El DMG no se guarda dentro del commit porque pesa mas de 100 MB y GitHub bloquea archivos normales de ese tamaño. La forma correcta esta en Releases:

- Latest release: https://github.com/RAULG0MEZ/Loom/releases/latest
- Instalador: descarga `INSTALAR-Loom.dmg`, abre el DMG y arrastra `Loom` a `Aplicaciones`.

## Trabajar en la app macOS

El codigo de Electron esta en `mac-app/`.

```bash
cd mac-app
npm install
npm start
```

Crear DMG local:

```bash
cd mac-app
npm run dist
```

El instalador queda en `mac-app/dist/`.

## Biblioteca web

La pagina publica vive aqui:

https://raulg0mez.github.io/Loom/

Required repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_API_TOKEN`
- `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN`

La pagina soporta abrir un video recien subido con:

```text
https://raulg0mez.github.io/Loom/?video=<CLOUDFLARE_STREAM_UID>
```

Mientras Cloudflare procesa el video, la app abre:

```text
https://raulg0mez.github.io/Loom/?video=<CLOUDFLARE_STREAM_UID>&status=uploading
```

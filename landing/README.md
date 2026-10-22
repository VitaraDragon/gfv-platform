# Landing Global Farm View

Progetto Vue 3 + Vite della landing pubblica (Firebase Hosting: `gfv-platform.web.app`, dominio previsto `gfvagri.com`).

## Flag

In `src/config/landing-config.js`, `LANDING_ATTIVA` è **false**: in build/preview/produzione si vede ancora «Coming soon».

Con `npm run dev` la pagina nuova è visibile in locale (anche a flag spento).

## Sviluppo locale

```bash
cd landing
npm install
npm run dev
```

Apri http://localhost:5173/

## Build e anteprima (come in produzione)

```bash
cd landing
npm run build
npm run preview
```

Con il flag spento deve comparire «Coming soon».

## Video di Tony (non nel repo)

I file MP4/WebM sono esclusi da git (circa 25 MB). In repo ci sono solo i poster `.jpg` e i sottotitoli `.vtt`.

**Dove prenderli (PC di Pier):**

`$HOME\Downloads\gfv-landing-tony\`

File da copiare in `landing/public/video/` **prima** di `npm run deploy:landing` (e utili anche in locale per `npm run dev`):

- `tony-landing-v2-16x9.webm`
- `tony-landing-v2-16x9.mp4`
- `tony-landing-v2-4x5.webm`
- `tony-landing-v2-4x5.mp4`

Esempio PowerShell (una riga per comando):

```powershell
New-Item -ItemType Directory -Force -Path landing\public\video
Copy-Item $HOME\Downloads\gfv-landing-tony\tony-landing-v2-16x9.webm landing\public\video\
Copy-Item $HOME\Downloads\gfv-landing-tony\tony-landing-v2-16x9.mp4 landing\public\video\
Copy-Item $HOME\Downloads\gfv-landing-tony\tony-landing-v2-4x5.webm landing\public\video\
Copy-Item $HOME\Downloads\gfv-landing-tony\tony-landing-v2-4x5.mp4 landing\public\video\
```

Senza i video la pagina funziona lo stesso: si vede il poster (o un riquadro neutro).

## Deploy

Dalla radice del repo (solo a mano, quando deciso):

```bash
npm run deploy:landing
```

Un merge su `develop` o `main` **non** pubblica la landing.

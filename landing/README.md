# Landing Global Farm View

Progetto Vue 3 + Vite della landing pubblica (Firebase Hosting: `gfv-platform.web.app`, dominio previsto `gfvagri.com`).

## Flag

In `src/config/landing-config.js`, `LANDING_ATTIVA` è **false**: in build/preview/produzione si vede ancora «Coming soon».

Con `npm run dev` la pagina nuova è visibile in locale (anche a flag spento), insieme a termini, privacy, cookie e 404.

## Due modi della build

| Comando | Cartella | Cosa produce (con `LANDING_ATTIVA = false`) |
|---------|----------|-----------------------------------------------|
| `npm run build` | `dist/` | **Coming soon**: `index.html` + `404.html` (copia della home). Niente pagine legali, robots, sitemap, meta OG nuovi. È la cartella che Firebase pubblica. |
| `npm run build:anteprima` | `dist-anteprima/` | **Completa**: home nuova, pagine legali, 404 vera, robots, sitemap, meta e OG. **Non si pubblica mai** (`firebase.json` punta solo a `landing/dist`). |

Anteprima della cartella completa:

```bash
cd landing
npm run build:anteprima
npm run preview:anteprima
```

## Sviluppo locale

```bash
cd landing
npm install
npm run dev
```

- http://localhost:5173/ → pagina nuova
- http://localhost:5173/privacy.html (e termini, cookie, 404) → pagine con riquadro «Testo in preparazione»

## Build e anteprima (come in produzione)

```bash
cd landing
npm run build
npm run preview
```

Con il flag spento deve comparire «Coming soon».

## Deploy (solo a mano)

Dalla **radice** del repo:

```bash
npm run deploy:landing
```

Questo rifà la build in `landing/dist` e poi pubblica su Firebase Hosting.

**Attenzione:** `npm run deploy:hosting` pubblica `landing/dist` **così com'è**, senza rifare la build. Per pubblicare la landing usare **solo** `npm run deploy:landing`.

Un merge su `develop` o `main` **non** pubblica la landing. Non lanciare deploy da Cursor/CI senza decisione esplicita.

## Prova hosting in locale (senza pubblicare)

Dalla radice, dopo una build normale (`npm run build` in `landing/`, oppure `npm run build:landing` dalla radice):

```bash
npx firebase emulators:start --only hosting
```

Apri l'indirizzo stampato (di solito http://127.0.0.1:5000/). Con flag spento: Coming soon su `/` e anche su indirizzi inesistenti (la `404.html` è copia della home). Chiudi con Ctrl+C.

## Segnaposto da compilare prima dell'accensione

| Cosa | File | Costante |
|------|------|----------|
| Dominio pubblico e conferma | `src/config/landing-config.js` | `URL_SITO`, `DOMINIO_CONFERMATO` |
| Email e PEC | stesso | `EMAIL_CONTATTO`, `PEC_CONTATTO` |
| P.IVA (non mostrata; solo da decidere) | stesso | `PARTITA_IVA` |
| Chi siamo e foto | stesso | `TESTO_CHI_SIAMO`, `FOTO_PIER_URL` |
| Frase IVA (commercialista) | stesso | `IVA_CONFERMATA` |
| Flag testi legali pronti | stesso | `TESTI_LEGALI_PRONTI` |
| Link/testo Iubenda + versione per ogni pagina | stesso (`PAGINE_LEGALI`) | `urlTestoCompleto`, `versione`, `testoDefinitivo` |
| Immagine social 1200×630 | stesso | `OG_IMMAGINE`, `OG_IMMAGINE_PRONTA` |
| Accensione landing | stesso | `LANDING_ATTIVA` |

I documenti legali dell'**app** (URL in `core/config/accettazione-legale-config.js`) restano un lavoro separato: la landing non li modifica.

## Cosa devono coprire i testi definitivi

Promemoria per Pier e per chi scrive su Iubenda (non è testo legale pubblicato):

**Termini**

- Solo uso professionale e maggiorenni (niente recesso di 14 giorni dei consumatori)
- Prezzi del Base con rinnovo automatico annuale e disdetta dall'app
- Tony può sbagliare: valgono prezzi e Termini
- Regole sugli account abbandonati solo quando esisterà la funzione di pulizia

**Privacy**

- Titolare Pierpaolo Rossi per i visitatori della landing
- Sezione `#tony` (Gemini, ElevenLabs, contatori temporanei con codice dall'IP cancellato dopo 48 ore, log di 30 giorni senza testo, trasferimenti fuori UE con le garanzie da verificare)
- Dati dell'app in Europa (Firestore a Milano, funzioni in Belgio) senza scrivere «tutti i dati restano in UE»

**Cookie**

- Nessun cookie di profilazione
- `localStorage` tecnico per la presa visione dell'avviso di Tony
- reCAPTCHA/App Check caricato solo dopo il clic
- Font sul nostro hosting
- Niente banner finché non ci sono analytics o pixel

**DPA dell'app** (azienda titolare, GFV responsabile): documento a parte; dove pubblicarlo è un punto aperto.

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

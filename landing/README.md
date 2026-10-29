# Landing Global Farm View

Progetto Vue 3 + Vite della landing pubblica (Firebase Hosting: `gfv-platform.web.app`, dominio previsto `gfvagri.com`).

## Flag

In `src/config/landing-config.js`, `LANDING_ATTIVA` è **false**: in build/preview/produzione si vede ancora «Coming soon».

Con `npm run dev` la pagina nuova è visibile in locale (anche a flag spento), insieme a termini, privacy, cookie e 404.

## Tony bussa ed entra (passo 5)

Flag `TONY_BUSSA_ATTIVO` in `src/config/landing-config.js`: oggi è **false**. Spento, i pulsanti «Vuoi provare GFV?» restano il link alla registrazione classica. La riga «A dicembre Tony bussa anche qui.» non c'è più.

Per provarlo in locale, senza accendere il flag:

```bash
cd landing
npm install
npm run dev
```

Apri http://localhost:5173/?tonybussa=1

Vale solo in sviluppo (`npm run dev`) o nella build di anteprima. La build normale (`npm run build`, quella che si pubblica) con il flag spento ignora `?tonybussa=1`.

Dal telefono, sulla stessa rete Wi-Fi del computer:

```bash
npm run dev -- --host
```

Poi apri `http://INDIRIZZO-DEL-PC:5173/?tonybussa=1`. L'indirizzo IPv4 del PC si legge con `ipconfig`. Se Windows chiede il permesso al firewall, consenti Node sulla rete privata. Android usa le clip WebM (e, se il telefono lo permette, vibra ai tre colpi). iPhone e Safari usano i WebP animati (passo 12a); se manca il WebP resta lo stacked. Niente vibrazione su iPhone, è normale.

Clip e suoni stanno in `public/tony-live/` (sono nel repo, circa 3,9 MB). Sul PC di Pier arrivano da `Downloads\gfv-landing-tony\live\` (clip) e da `live\audio\` (suoni). Non partono all'apertura della pagina: il browser li chiede solo dopo il clic su «Vuoi provare GFV?».

## Tony parla (passo 6)

Le voci sono file già pronti (pacchetto del 26/10/2026), non una chiamata a un servizio. Stanno in `public/tony-live/voci/`. Il loop in cui Tony muove la bocca sta accanto alle altre clip (`tony-talking-loop-*`). Se le clip non arrivano, Tony resta fermo con `tony-static-idle-desktop.png` / `tony-static-idle-mobile.png` (stessa inquadratura di idle). `tony-static.png` resta nel repo per le anteprime nelle condivisioni.

Per provarlo vale lo stesso indirizzo del passo 5: http://localhost:5173/?tonybussa=1 (solo in sviluppo o in anteprima). Dopo l'entrata Tony dice il saluto e, sul computer, la bocca segue il volume della voce. «✕ Saluta Tony» fa dire «Ci vediamo dentro GFV!» mentre esce.

Se togli «Audio attivo», Tony non parla: resta fermo e il testo nel fumetto c'è lo stesso. La scelta resta anche se chiudi e riapri la pagina. Con «riduci movimento» del sistema la voce c'è, ma Tony non cambia clip: resta nel fermo.

## Chat di Tony (passo 12a)

Dopo il saluto, nel fumetto compaiono tre domande rapide, un campo di testo e (se il browser lo sa fare) il microfono. Le domande vanno alla funzione `tonyLandingAsk` con il token di App Check; la risposta arriva **scritta**, pezzo per pezzo.

Per provarla in locale senza la funzione pubblicata usa il **modello finto** (solo con `npm run dev`):

```bash
cd landing
npm run dev
```

Apri http://localhost:5173/?tonybussa=1&tonyfinto=1

Altri scenari: `tonyfinto=lento`, `spento`, `tetto`, `limite`, `dati`, `errore`, `rete`, `appcheck`. Nella build (`npm run build` / `build:anteprima`) il finto **non** c’è.

Clip v4 in `public/tony-live/`: entrata H1 (desktop) / H2 (mobile), idle, ascolto (raise/loop/lower), thinking, scrive sul taccuino, talking, uscita veloce. Formato: Safari e iPhone → WebP; Chrome/Edge/Firefox/Android → WebM; ultima riserva → stacked. Email e password sono bloccate già in pagina (e di nuovo dalla funzione). I limiti (15/30/1000, tetto mensile) li decide solo la funzione.

## Voce di Tony (passo 12b)

Dopo la risposta scritta Tony può **parlare** (clip `talking`) con `tonyLandingAudio` (stessa voce ElevenLabs dell’app). L’altoparlante parte dalla casella «Audio attivo» dell’avviso: le **prime 3** risposte della sessione partono da sole se l’altoparlante è acceso; dalla quarta compare «▶ Ascolta». Se l’audio non arriva, si resta sul testo **senza messaggi d’errore**.

Prove in locale con modello finto **e** voce finta (solo `npm run dev`):

```bash
cd landing
npm run dev
```

Apri http://localhost:5173/?tonybussa=1&tonyfinto=1

Scenari voce: `tonyvoce=lenta`, `errore`, `tetto`, `no` (niente voce). Nella build di produzione la voce finta **non** c’è.

## Correzioni scena di Tony (passo 12c)

Il contenitore delle clip (`.tony-player-host`) ha al massimo due livelli durante un passaggio e se ne svuota a ogni arresto: niente secondo Tony dietro. Con un errore del servizio Tony finisce la clip in corso e resta **animato** su `idle` (campo e pulsanti spariscono come prima); lo statico serve **solo** se le clip non arrivano. Immagini ferme: `tony-static-idle-desktop.png` e `tony-static-idle-mobile.png` (primo fotogramma di idle, stessa inquadratura), con dissolvenza incrociata di 180 ms se si veniva da una clip. Fine giro vera per WebM/stacked/WebP; dissolvenza di 150 ms da e verso `talking` e da `idle`; elementi precaricati riusati; WebP scaricate una volta sola (Blob). Sul telefono il pannello della chat è alto il 55% fisso e Tony resta fermo sul bordo alto. Prova clip assenti solo con `npm run dev`: `?tonyfinto=noclip`.

## Registrazione nella chat (passo 13)

Dopo il saluto, se App Check (o il modo finto) è pronto, «Crea il tuo account gratuito» apre un **modulo nella chat** (email, password, conferma, nome azienda; niente nome e cognome). Email e password **non** passano dalla chat né da Tony: niente `tonyLandingAsk`, niente voce, niente log. Clip `topic-registrazione` (2,5 s) poi taccuino in loop. A fine registrazione resta aperta la sessione sulla landing e parte l’aiuto per l’account (passo 14).

Prove in locale **senza account veri** (solo `npm run dev`):

```bash
cd landing
npm run dev
```

Apri http://localhost:5173/?tonybussa=1&tonyfinto=ok&tonyreg=ok

Altri scenari: `tonyreg=lento`, `email-usata`, `password-debole`, `rete`, `azienda`, `azienda-pulizia-fallita`, `profilo`, `legale`. Con solo `tonyfinto=` (senza `tonyreg`) vale come `ok`. Nella build di produzione il modo finto **non** c’è.

## Aiuto per l'account (passo 14)

Dopo la registrazione Tony propone tre domande (sede, poderi, terreni), saltabili con «Dopo». Le risposte vanno a `tonyLandingAsk` in fase `account` (serve l’accesso); i dati restano **solo in memoria**. Alla fine compare la scheda «Confermi?»: **solo** «Sì, salva» chiama `tonyLandingSetup`. Poi la frase fissa «Fatto! Per 7 giorni…» con voce `tony-fatto.mp3` e «Vai alla tua dashboard» (login con email già scritta).

Regola d’oro: tra Tony e il salvataggio c’è sempre il visitatore. Il modello non salva e non dice «ho salvato».

Prove in locale (solo `npm run dev`):

```bash
cd landing
npm run dev
```

Apri http://localhost:5173/?tonybussa=1&tonyfinto=ok&tonyreg=ok&tonyaiuto=ok&tonysetup=ok

Altri: `tonyaiuto=troppi|categoria|vuoto|limite|accesso`, `tonysetup=lento|doppio|dati-non-validi|niente-da-salvare|limite-terreni|gia-preparato|…`. Nella build i modi finti **non** ci sono.

Per rigenerare le stesse regole di salvataggio usate dalla scheda:

```bash
node landing/scripts/genera-setup-core-landing.mjs
```

`tonyLandingAsk` (fase account) va ripubblicata al promote su `main` (vedi «Dopo l’unione» del passo).

### Dopo l’unione (console, prima del passo 16)

- Google Cloud → chiave API web: se ha limitazioni per sito, aggiungere i domini della landing; se per API, Identity Toolkit / Firestore / Cloud Functions.
- Firebase → Authentication → Domini autorizzati: aggiungere `gfvagri.com`.
- **Non** obbligare App Check su Firestore/Auth (l’app su github.io non ce l’ha).
- Quando i testi legali sono pronti: accendere insieme `ACCETTAZIONE_LEGALE_ATTIVA` e `NOME_TITOLARE_FACOLTATIVO_ATTIVO`.

## App Check (passo 9)

Protezione per le **funzioni nuove della landing** (prima `tonyLandingSetup`, poi le altre): controlla che la chiamata arrivi dalla nostra pagina. L'app su github.io **non** cambia.

Sta in `src/lib/firebase-landing.js` (unico file che importa Firebase) e in `src/config/firebase-landing-config.js` (config pubblica uguale all'app). Si scarica **solo dopo** la prima casella, quando Tony è entrato: mai all'apertura della pagina, niente se premi «No, grazie».

Prova in locale:

```bash
cd landing
npm run dev
```

Apri http://localhost:5173/?tonybussa=1 → «Fai entrare Tony». Nella console del browser compare **una volta** `AppCheck debug token: …`: va registrato nella console Firebase (token di debug). Dopo averlo salvato, ricaricando compare `[landing] App Check pronto`.

Il token di debug è **privato**: mai nel repo, nei messaggi o negli screenshot. Dal telefono con l'indirizzo del PC App Check **non** si attiva (è normale: si usa solo su `localhost`). Se `CHIAVE_SITO_APP_CHECK` in `firebase-landing-config.js` è vuota, la protezione è spenta e non si carica niente.

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

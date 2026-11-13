# Runbook deploy — Firebase, hosting, GitHub Pages

**Data:** 2026-06-07  
**Audience:** agenti / sviluppatori su **nuovo PC Windows** (o dopo clone repo)  
**Progetto Firebase:** `gfv-platform` · regione CF: **`europe-west1`**

---

## 1. Cosa va dove (non confondere)

| Artefatto | Destinazione | Comando tipico |
|-----------|--------------|----------------|
| **ERP** (`core/`, `modules/`, Tony client, …) | **Ancora GitHub Pages** `https://vitaradragon.github.io/gfv-platform/`. Passerà a Firebase Hosting, sito `gfv-platform-app` (target `app`, cartella `dist-app`), solo dopo la verifica. Questa modifica non pubblica l’app. | Oggi: PR `develop` → `main` (Pages). Dopo il passaggio: `npm run deploy:app` da `origin/main` pulito |
| **Landing** marketing (`landing/dist`) | **Firebase Hosting** `https://gfv-platform.web.app` (target `default`, invariato) | `npm run deploy:landing` (`--only hosting:default`) |
| **Cloud Functions** (Tony, meteo, email, …) | **Firebase / Cloud Run** | `npm run deploy:functions` |
| **Firestore rules / indexes** | Firebase | `npm run deploy:rules` |

Modifiche solo a `core/js/tony/*.js` → **push GitHub** (Pages), non hosting Firebase, finché l’ERP è su Pages.

`npm run deploy:hosting` e `npm run deploy:landing` pubblicano **solo** `hosting:default` (la landing). Mai `firebase deploy --only hosting`: con due target pubblicherebbe anche l’app. Mai `hosting:channel:deploy` senza `--only default` (i canali di anteprima della landing, incluso prova-tony, stanno sul sito `gfv-platform`). Per gli emulatori: `--only hosting:default` oppure `--only hosting:app`, non `--only hosting`.

> **Attenzione — dal 2026-09-01 non si pusha più direttamente su `main`.**
> `main` è il sito pubblico: ogni commit è online all'istante. Il lavoro passa da `develop` e arriva su `main` con una PR di promozione.
> Flusso completo: `docs-sviluppo/PUBBLICAZIONE_BRANCH_E_RELEASE.md` · `README.md` §Contribuire · `.cursor/rules/pubblicazione-e-branch.mdc`

---

## 2. Setup nuovo PC — checklist agente

Eseguire dalla root `gfv-platform/`:

```powershell
# 1. Verifica / install CLI (Windows)
.\scripts\setup-dev-pc.ps1
.\scripts\setup-dev-pc.ps1 -Install   # se mancano node/git/firebase global

# 2. Dipendenze repo
npm install
cd functions; npm install; cd ..
cd landing; npm install; cd ..

# 3. Login Firebase (browser)
firebase login
firebase use gfv-platform

# 4. CRITICO — file functions/.env (vedi §4)
#    Non copiare chiavi secret in functions/.env

# 5. Emulator locale (opzionale): secrets in functions/.secret.local (§5)
```

Se `firebase` non è riconosciuto nel terminale Cursor anche dopo install:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
firebase --version
```

Oppure **non usare** il comando globale `firebase` e usare sempre gli script npm (§3).

---

## 3. Comandi deploy (senza dipendere da PATH globale)

`firebase-tools` è in **devDependency** root (`package.json`). Preferire:

| Obiettivo | Comando |
|-----------|---------|
| Cloud Functions | `npm run deploy:functions` |
| Hosting landing (solo dist già buildata) | `npm run deploy:hosting` → `--only hosting:default` |
| Build landing + hosting landing | `npm run deploy:landing` → `--only hosting:default` |
| App ERP (solo al passaggio, da `origin/main` pulito) | `npm run deploy:app` → `--only hosting:app` |
| Rules + indexes | `npm run deploy:rules` |
| Functions + rules | `npm run deploy:firebase` |

Non usare `--only hosting` (senza `:default` o `:app`). Non usare `hosting:channel:deploy` senza `--only default`.

Wrapper PowerShell (ricarica PATH + firebase locale):

```powershell
.\scripts\firebase.ps1 deploy --only functions
.\scripts\firebase.ps1 --version
```

Install globale (alternativa): `npm install -g firebase-tools` → riavviare terminale.

---

## 4. Errore deploy Functions — `.env` vs Secret Manager (2026-06-07)

### Sintomo

Deploy fallisce con HTTP 400 su più function, es.:

```text
Secret environment variable overlaps non secret environment variable: OPENWEATHER_API_KEY
Secret environment variable overlaps non secret environment variable: RESEND_API_KEY
```

Function tipicamente coinvolte: `tonyAsk`, `tonyAskStream`, `getMeteoSede`, `getMeteoSedeAvanzato`, `getMeteoTerreni`, `sendTransactionalEmail`.

### Causa

In `functions/index.js` (e `tony-ask-stream.js`) queste chiavi sono **`defineSecret`** + `secrets: [...]` nel deploy.

Se esiste **`functions/.env`** con le stesse chiavi, Firebase CLI le carica come **variabili d’ambiente normali** in deploy (`Loaded environment variables from .env`). Cloud Run rifiuta lo stesso nome sia come env plain sia come secret → **400 overlap**.

> **Nota:** spesso il problema è sul PC che fa deploy, **non** in Google Cloud Console. Rimuovere le chiavi da `.env` basta; non serve cancellare secret su Cloud Run.

### Fix obbligatorio su ogni macchina

1. Apri `functions/.env` (file **gitignored**, non in repo).
2. **Rimuovi** (o commenta) righe con:
   - `OPENWEATHER_API_KEY=...`
   - `RESEND_API_KEY=...`
   - `SENTRY_DSN=...` (se presente — anche `SENTRY_DSN` usa `defineSecret`)
3. Lascia il file vuoto o solo commenti (vedi `functions/.env.example`).
4. Rilancia: `npm run deploy:functions`

### Produzione — dove stanno le chiavi

**Script automatico (consigliato):**

```powershell
# Dalla root repo — legge functions/.secret.local, oppure recupera GEMINI dalla revisione Cloud Run precedente
npm run sync:functions-secrets:deploy
```

Equivalente: `.\scripts\sync-functions-secrets.ps1 -Deploy`

Manuale (Secret Manager):

```powershell
firebase functions:secrets:set OPENWEATHER_API_KEY
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set SENTRY_DSN   # opzionale
```

Verifica presenza (nomi servizio Cloud Run, **non** valori):

```powershell
gcloud run services describe tonyask --region=europe-west1 --format="value(spec.template.spec.containers[0].env[].name)"
```

Attesi almeno: `OPENWEATHER_API_KEY`, `GEMINI_API_KEY` (montati come secret).

### Errore Tony «Configurazione servizio AI… Contatta l'amministratore»

**Causa:** `GEMINI_API_KEY` assente su `tonyask` / `tonyaskstream` dopo un deploy (la chiave era solo env manuale su Cloud Run e il redeploy l’ha rimossa).

**Fix:**

1. `firebase functions:secrets:set GEMINI_API_KEY` (chiave da [Google AI Studio](https://aistudio.google.com/apikey))
2. `npm run deploy:functions`
3. Hard refresh app / PWA

Il codice usa `defineSecret("GEMINI_API_KEY")` in `functions/index.js` e `functions/tony-ask-stream.js`.

**Non** mettere `GEMINI_API_KEY` in `functions/.env`.

**GEMINI_API_KEY** oggi è env **plain** su Cloud Run (`tonyask` / `tonyaskstream`), non `defineSecret` — può restare in Console Cloud Run; **non** metterla in `.env` se in futuro passa a secret con lo stesso nome.

---

## 5. Emulator locale Functions

Non usare `.env` per chiavi già in `defineSecret`.

Creare **`functions/.secret.local`** (gitignored via `.gitignore`):

```env
OPENWEATHER_API_KEY=...
RESEND_API_KEY=...
SENTRY_DSN=...
```

Template commenti: `functions/.env.example`.

---

## 6. Deploy Firebase Hosting — cartella `landing/dist`

### Sintomo

```text
Error: Directory 'landing/dist' for Hosting does not exist.
```

### Fix

`firebase.json`, target `default` → `"public": "landing/dist"`. Il target `app` (`dist-app`) è un altro sito e non si pubblica con questi comandi. La cartella della landing esiste **solo dopo build Vite**:

```powershell
npm run build:landing
npm run deploy:hosting
# oppure tutto insieme:
npm run deploy:landing
```

`landing/dist` è in `.gitignore` — su ogni PC va **rigenerata** prima del primo hosting deploy della landing.

---

## 6b. Build dell’app — cartella `dist-app` (non è ancora il sito pubblico)

`npm run build:app` svuota e ricrea `dist-app/` con i soli file del sito (allow-list, solo file tracciati da git). `dist-app/` è in `.gitignore`.

Il target Firebase è `app`, sito `gfv-platform-app`. Il passaggio non è fatto: Pages resta acceso e `deploy:app` non va lanciato da un branch di lavoro. Il comando rifiuta HEAD diverso da `origin/main` e un working tree sporco. Il predeploy del target lancia di nuovo `build:app`.

Prova locale, senza pubblicare:

```powershell
npm run build:app
node ./node_modules/firebase-tools/lib/bin/firebase.js emulators:start --only hosting:app
```

Per gli emulatori non usare `--only hosting` (partirebbero entrambi i target). La landing si prova con `--only hosting:default`.

---

## 7. Verifica deploy riuscito

**Functions:**

```text
+  functions[tonyAsk(europe-west1)] Successful update operation.
...
+  Deploy complete!
```

**Hosting landing:** URL in output → `https://gfv-platform.web.app`

**ERP:** oggi ancora GitHub Pages, dopo il push su `main` (1–2 min, poi hard refresh). Il passaggio a `gfv-platform-app` non è fatto: finché Pages non è spento, il merge su `main` pubblica ancora l’albero del repository. Dopo il passaggio servirà `npm run deploy:app`.

---

## 8. Troubleshooting rapido

| Problema | Azione |
|----------|--------|
| `firebase` / `npx` non riconosciuto | Riavvia terminale; §2 PATH; usa `npm run deploy:*` |
| Overlap OPENWEATHER / RESEND | §4 — svuota `functions/.env` |
| Tony «Contatta l'amministratore» / meteo chat errore | §4 — `firebase functions:secrets:set GEMINI_API_KEY` + `deploy:functions` |
| Briefing dashboard assente su mobile PWA | Autoplay TTS bloccato: serve messaggio in chat (`__tonyDisplayProactive`); aggiorna client da GitHub Pages |
| `landing/dist` missing | §6 — `npm run build:landing` |
| Tony CORS / 404 callable | Client deve usare `getFunctions(app, 'europe-west1')` |
| 403 callable pubbliche preventivo | Cloud Run invoker public su servizio (vedi `functions/README.md`) |

---

## 9. Prompt per agente su secondo PC

**File completo:** `docs-sviluppo/SETUP_ALTRO_PC_CURSOR.md` (prompt + checklist).

```text
Leggi docs-sviluppo/SETUP_ALTRO_PC_CURSOR.md e DEPLOY_RUNBOOK.md.
git pull → npm install → functions/.env senza chiavi → npm run sync:functions-secrets:deploy se serve deploy CF.
```

---

## 10. File di riferimento

| File | Ruolo |
|------|--------|
| `package.json` | script `deploy:*`, devDep `firebase-tools` |
| `scripts/firebase.ps1` | wrapper CLI con PATH refresh |
| `scripts/setup-dev-pc.ps1` | check/install ambiente Windows |
| `functions/.env.example` | regole `.env` vs `.secret.local` |
| `functions/README.md` | Tony/Gemini, meteo, preventivo pubblico |
| `firebase.json` | hosting `default` → `landing/dist`; hosting `app` → `dist-app` (non pubblicato finché il passaggio non è verificato) |
| `docs-sviluppo/SETUP_ALTRO_PC_CURSOR.md` | **Setup completo altro PC per Cursor** |

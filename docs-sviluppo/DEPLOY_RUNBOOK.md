# Runbook deploy — Firebase, hosting, GitHub Pages

**Data:** 2026-06-07  
**Audience:** agenti / sviluppatori su **nuovo PC Windows** (o dopo clone repo)  
**Progetto Firebase:** `gfv-platform` · regione CF: **`europe-west1`**

---

## 1. Cosa va dove (non confondere)

| Artefatto | Destinazione | Comando tipico |
|-----------|--------------|----------------|
| **ERP** (`core/`, `modules/`, Tony client, …) | **GitHub Pages** `https://vitaradragon.github.io/gfv-platform/` | `git push origin main` |
| **Landing** marketing (`landing/dist`) | **Firebase Hosting** `https://gfv-platform.web.app` | `npm run deploy:landing` |
| **Cloud Functions** (Tony, meteo, email, …) | **Firebase / Cloud Run** | `npm run deploy:functions` |
| **Firestore rules / indexes** | Firebase | `npm run deploy:rules` |

Modifiche solo a `core/js/tony/*.js` → **push GitHub**, non hosting Firebase.

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
| Hosting (solo dist già buildata) | `npm run deploy:hosting` |
| Build landing + hosting | `npm run deploy:landing` |
| Rules + indexes | `npm run deploy:rules` |
| Functions + rules | `npm run deploy:firebase` |

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

`firebase.json` → `"public": "landing/dist"`. La cartella esiste **solo dopo build Vite**:

```powershell
npm run build:landing
npm run deploy:hosting
# oppure tutto insieme:
npm run deploy:landing
```

`landing/dist` è in `.gitignore` — su ogni PC va **rigenerata** prima del primo hosting deploy.

---

## 7. Verifica deploy riuscito

**Functions:**

```text
+  functions[tonyAsk(europe-west1)] Successful update operation.
...
+  Deploy complete!
```

**Hosting:** URL in output → `https://gfv-platform.web.app`

**ERP (Tony client):** dopo `git push`, attendere 1–2 min e hard refresh su GitHub Pages.

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

```text
Leggi docs-sviluppo/DEPLOY_RUNBOOK.md.
Verifica functions/.env: nessuna riga OPENWEATHER_API_KEY, RESEND_API_KEY, SENTRY_DSN.
Se manca landing/dist: npm run build:landing prima di deploy:hosting.
Deploy CF: npm run deploy:functions dalla root repo.
Deploy ERP client: git push (GitHub Pages), non firebase hosting.
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
| `firebase.json` | hosting → `landing/dist` |

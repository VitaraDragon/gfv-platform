# Setup altro PC — istruzioni per Cursor

**Data:** 2026-06-07  
**Scopo:** allineare una seconda macchina Windows (clone/pull del repo) per sviluppo GFV, deploy Firebase e Tony.  
**Leggere questo file** all’inizio della sessione Cursor sull’altro PC.

---

## Prompt da incollare in Cursor (copia tutto)

```
Leggi e segui docs-sviluppo/SETUP_ALTRO_PC_CURSOR.md e docs-sviluppo/DEPLOY_RUNBOOK.md.

Obiettivo: allineare questo PC per sviluppo e deploy GFV (Tony, meteo, Cloud Functions, hosting landing).

Esegui in ordine:
1. Verifica git pull / main aggiornato
2. npm install (root), npm install in functions/, npm install in landing/
3. Controlla functions/.env — deve essere vuoto o solo commenti (NESSUNA chiave API)
4. Se manca functions/.secret.local: copia da functions/.secret.local.example e chiedi all'utente di compilare le chiavi (o usa sync con recupero Cloud Run)
5. firebase login + firebase use gfv-platform (se non già fatto)
6. npm run sync:functions-secrets:deploy (solo se serve ridistribuire le CF o GEMINI manca in Secret Manager)
7. Verifica: gcloud secrets list --project=gfv-platform deve includere GEMINI_API_KEY, OPENWEATHER_API_KEY, RESEND_API_KEY
8. Test locale opzionale: npm start → dashboard → Tony risponde al meteo

Non committare functions/.env, functions/.secret.local né chiavi API.
Non mettere chiavi in functions/.env (conflitto deploy Secret Manager).
```

---

## 1. Sincronizza il codice

### Con GitHub Desktop
1. Apri il repository `gfv-platform`
2. **Fetch origin** → **Pull** (branch `main`)
3. Verifica di essere su `main` aggiornato

### Con terminale
```powershell
cd C:\percorso\al\tuo\gfv-platform
git pull origin main
git status
```

---

## 2. Ambiente Windows (una tantum o se manca qualcosa)

```powershell
cd C:\percorso\al\tuo\gfv-platform
.\scripts\setup-dev-pc.ps1
.\scripts\setup-dev-pc.ps1 -Install
```

Poi **chiudi e riapri** PowerShell/Cursor se hai appena installato Node o Firebase CLI.

Verifica:
```powershell
node -v
npm -v
firebase --version
gcloud --version
firebase login
firebase use gfv-platform
```

Se `firebase` non è nel PATH, usa sempre gli script npm dalla root (vedi sotto).

---

## 3. Dipendenze npm

```powershell
cd C:\percorso\al\tuo\gfv-platform
npm install
cd functions
npm install
cd ..\landing
npm install
cd ..
```

Opzionale hook git:
```powershell
npm run setup:hooks
```

---

## 4. Chiavi API — regola fondamentale

| File | Uso | Committare? |
|------|-----|-------------|
| `functions/.secret.local` | Chiavi locali + sync Secret Manager | **NO** (gitignored) |
| `functions/.env` | Solo commenti / vuoto in produzione | **NO** (gitignored) |
| Secret Manager (Firebase) | Produzione Cloud Functions | Console cloud |

### ERRORE da evitare
**Non** mettere in `functions/.env`:
- `GEMINI_API_KEY`
- `OPENWEATHER_API_KEY`
- `RESEND_API_KEY`
- `SENTRY_DSN`

Firebase carica `.env` al deploy come env **normali** → conflitto con `defineSecret` → deploy fallisce (errore 400 overlap).

### Setup chiavi su questo PC

**Opzione A — file locale (consigliata per deploy ripetuti da questa macchina):**
```powershell
copy functions\.secret.local.example functions\.secret.local
# Modifica .secret.local con le chiavi reali (editor)
```

**Opzione B — recupero automatico GEMINI:**
Lo script può recuperare `GEMINI_API_KEY` da una **revisione Cloud Run precedente** se era ancora presente come env.

---

## 5. Sync secret + deploy Cloud Functions

Dalla **root** del repo:

```powershell
# Solo upload secret (senza deploy)
npm run sync:functions-secrets

# Upload secret + deploy functions (uso tipico dopo pull o modifica functions/)
npm run sync:functions-secrets:deploy
```

Equivalente PowerShell:
```powershell
.\scripts\sync-functions-secrets.ps1 -Deploy
```

Cosa fa lo script (`scripts/sync-functions-secrets.ps1`):
1. Legge `functions/.secret.local` e `functions/.env` (se hanno chiavi)
2. Se manca `GEMINI_API_KEY`, la recupera da revisione Cloud Run `tonyask` precedente
3. Carica su Secret Manager (`firebase functions:secrets:set`)
4. Con `-Deploy`: esegue `npm run deploy:functions`

Secret attesi su progetto `gfv-platform`:
- `GEMINI_API_KEY` (Tony / Gemini)
- `OPENWEATHER_API_KEY` (meteo)
- `RESEND_API_KEY` (email)
- `SENTRY_DSN` (opzionale)

Verifica nomi env su Cloud Run (non i valori):
```powershell
gcloud run services describe tonyask --region=europe-west1 --project=gfv-platform --format="value(spec.template.spec.containers[0].env[].name)"
```
Attesi almeno: `GEMINI_API_KEY`, `OPENWEATHER_API_KEY`, `SENTRY_DSN`

---

## 6. Deploy hosting (landing)

Solo per il sito marketing `gfv-platform.web.app` — **non** l’ERP Tony.

```powershell
npm run build:landing
npm run deploy:hosting
# oppure tutto insieme:
npm run deploy:landing
```

`landing/dist` non è in git: va **generata** prima del primo deploy hosting su ogni PC.

---

## 7. ERP + Tony client (GitHub Pages)

Le modifiche a `core/js/tony/`, dashboard, ecc. vanno online con:

```powershell
git add ...
git commit -m "..."
git push origin main
```

L’app ERP è su **GitHub Pages** (`vitaradragon.github.io/gfv-platform/`), non su Firebase Hosting.

Dopo push: attendi 1–2 minuti → **hard refresh** browser / PWA.

---

## 8. Test di verifica

### Backend (dopo `sync:functions-secrets:deploy`)
- [ ] Deploy termina con `Deploy complete!`
- [ ] `gcloud secrets list --project=gfv-platform` include `GEMINI_API_KEY`

### App (dopo pull + refresh GitHub Pages)
- [ ] Login dashboard
- [ ] Apri Tony → chiedi «che tempo fa?» → risposta senza errore Gemini / «contatta amministratore»
- [ ] Dashboard manager: dopo ~3 s compare briefing in **chat** Tony (su mobile senza audio è normale)

### Locale (opzionale)
```powershell
npm start
# http://127.0.0.1:8000 → core/dashboard-standalone.html
```

---

## 9. Comandi deploy — riepilogo

| Obiettivo | Comando |
|-----------|---------|
| Secret + CF | `npm run sync:functions-secrets:deploy` |
| Solo CF | `npm run deploy:functions` |
| Solo rules | `npm run deploy:rules` |
| Landing + hosting | `npm run deploy:landing` |
| Solo hosting (dist già buildata) | `npm run deploy:hosting` |
| Dev locale | `npm start` |
| Wrapper firebase (PATH rotto) | `.\scripts\firebase.ps1 deploy --only functions` |

---

## 10. Documentazione correlata

| File | Contenuto |
|------|-----------|
| `docs-sviluppo/DEPLOY_RUNBOOK.md` | Runbook deploy, errori `.env`/secret, hosting |
| `functions/README.md` | Tony CF, GEMINI, meteo |
| `scripts/sync-functions-secrets.ps1` | Script sync secret |
| `scripts/setup-dev-pc.ps1` | Check/install ambiente Windows |
| `functions/.secret.local.example` | Template chiavi locali |

---

## 11. Troubleshooting rapido

| Problema | Soluzione |
|----------|-----------|
| `firebase` non riconosciuto | Riavvia terminale; usa `npm run deploy:*` o `.\scripts\firebase.ps1` |
| Overlap OPENWEATHER / RESEND su deploy | Svuota chiavi da `functions/.env` |
| Tony «GEMINI non configurata» | `npm run sync:functions-secrets:deploy` |
| `landing/dist` missing | `npm run build:landing` prima di hosting |
| Briefing assente su mobile | Hard refresh dopo pull; messaggio in chat (non solo voce) |
| Warning `contentscript.js` in console | Estensione browser — ignorare |

---

## 12. Cosa NON fare

- Non committare `.env`, `.secret.local`, chiavi API
- Non mettere chiavi API in `functions/.env`
- Non usare `firebase deploy --only hosting` per pubblicare l’ERP Tony (solo landing)
- Non cancellare secret da Google Cloud Console senza reimpostarli con lo script

---

*Ultimo aggiornamento allineato a: defineSecret GEMINI/OPENWEATHER, `sync-functions-secrets.ps1`, briefing dashboard `__tonyDisplayProactive`.*

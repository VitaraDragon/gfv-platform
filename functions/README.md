# Cloud Functions – Tony (Gemini)

La callable **tonyAsk** chiama l’API Gemini con la chiave sul server, così il frontend non espone la API key. È deployata in **europe-west1** (obbligatorio che il client usi la stessa regione).

## Prerequisiti

- Node 20 (engines in package.json)
- Firebase CLI: `npm i -g firebase-tools` e `firebase login`
- Chiave API Gemini (da [Google AI Studio](https://aistudio.google.com/apikey))
- Piano Blaze su Firebase

## Setup

1. **Installa dipendenze**
   ```bash
   cd functions
   npm install
   ```

2. **Imposta la chiave Gemini (GEMINI_API_KEY)**  
   Il codice usa **`defineSecret("GEMINI_API_KEY")`** su `tonyAsk` e `tonyAskStream` (come OpenWeather).  
   **Una tantum** sul progetto:

   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```

   Poi ridistribuisci: `npm run deploy:functions` (root repo).

   **Non** mettere `GEMINI_API_KEY` in `functions/.env` (conflitto deploy analogo a OpenWeather — vedi `docs-sviluppo/DEPLOY_RUNBOOK.md` §4).

   Dopo un deploy, Firebase **non** ripristina variabili env impostate solo a mano su Cloud Run: la chiave deve restare in Secret Manager.

   Verifica (solo presenza, non stampare la chiave in chat):

   ```bash
   gcloud run services describe tonyask --region=europe-west1 --format="value(spec.template.spec.containers[0].env[].name)"
   ```

   Devono comparire `OPENWEATHER_API_KEY` e `GEMINI_API_KEY` (entrambe da secret ref).

   ~~Impostazione manuale solo Cloud Run~~ (legacy, sostituita da secret sopra).

2b. **Sentry (opzionale ma consigliato)**  
   Progetto Sentry: org **`sabbie-gialle`**, slug progetto **`node-gcpfunctions`** (regione ingest **DE**). Il codice carica `instrument.js` prima di tutto e legge **`SENTRY_DSN`**.  
   Imposta la variabile come per Gemini, sulla stessa revisione Cloud Run dei servizi `tonyask` / `gettonyaudio` (stesso progetto Google Cloud):
   - Console → Cloud Run → servizio (es. `tonyask`) → **Modifica e distribuisci nuova revisione** → **Variabili e secret** → variabile **`SENTRY_DSN`** = valore copiato da Sentry (Client Keys / DSN del progetto `node-gcpfunctions`).  
   Opzionale: **`SENTRY_ENVIRONMENT`** (es. `production`), **`SENTRY_TRACES_SAMPLE_RATE`** (0–1, default `0.2`).  
   Se `SENTRY_DSN` manca, le functions partono comunque e in log compare un warning.

3. **Deploy**

   Dalla **root** del repo (consigliato — non dipende da `firebase` nel PATH globale):

   ```bash
   npm run deploy:functions
   ```

   Oppure: `firebase deploy --only functions` (richiede Firebase CLI in PATH).

   **Runbook completo (nuovo PC, errori `.env`/hosting):** `docs-sviluppo/DEPLOY_RUNBOOK.md`.

   La function viene creata in **europe-west1**. Il client in `tony-service.js` deve usare **getFunctions(app, 'europe-west1')**; altrimenti le chiamate vanno a us-central1 e si ottiene CORS/404.

## ⚠️ Deploy fallito — overlap secret / `.env`

Se il deploy restituisce:

`Secret environment variable overlaps non secret environment variable: OPENWEATHER_API_KEY` (o `RESEND_API_KEY`),

**non** andare subito su Cloud Console: controllare **`functions/.env`** sulla macchina che deploya.

- Il codice usa `defineSecret("OPENWEATHER_API_KEY")` e `defineSecret("RESEND_API_KEY")`.
- Se le stesse chiavi sono in `functions/.env`, Firebase le invia come env **normali** + **secret** → Cloud Run 400.

**Fix:** rimuovere quelle righe da `functions/.env`; per emulator usare `functions/.secret.local`. Dettaglio: **`docs-sviluppo/DEPLOY_RUNBOOK.md` §4**.

## Preventivo pubblico (link email cliente)

Callable **senza login** (regione `europe-west1`, come Tony):

- **`getPreventivoPubblico`** — input `{ token }` (stesso `tokenAccettazione` nel link). Restituisce dati mostrati su `accetta-preventivo-standalone.html`.
- **`aggiornaStatoPreventivoPubblico`** — input `{ token, azione: 'accetta' | 'rifiuta' }`. Aggiorna Firestore con Admin SDK.

Dopo `firebase deploy --only functions`, se il client riceve **403** sulle callable senza utente loggato, in **Google Cloud Console → Cloud Run** apri il servizio corrispondente alla function e verifica che **Invokers** includa accesso pubblico (o usa `invoker: "public"` nel codice, già impostato per queste due).

**Indici Firestore** (`firestore.indexes.json`):

- In **`firebase.json`** la sezione `firestore` deve includere **`"indexes": "firestore.indexes.json"`**: senza questo file gli indici **non vengono mai deployati** anche se presenti nel repo.
- Per la query `collectionGroup('preventivi').where('tokenAccettazione', '==', token)` serve un **field override** su `preventivi` / `tokenAccettazione` con `queryScope` **COLLECTION** e **COLLECTION_GROUP** (Firestore rifiuta un “composito” a un solo campo: usare gli override, non una voce in `indexes` solo per quel campo).

**Sentry / secret**: non associare **`SENTRY_DSN`** (`secrets: [sentryDsn]`) a queste due callable. Se il secret non è legato correttamente alla revisione Cloud Run, le richieste possono rispondere **500 INTERNAL**; `instrument.js` funziona comunque se `SENTRY_DSN` è assente (solo warning in log).

Le **Firestore rules** non espongono più letture pubbliche su `tenants`, `clienti`, `preventivi` per questa pagina.

**Note operative**: se il client ottiene **404** sulla URL della callable, la function non è deployata. **CORS** senza `Access-Control-Allow-Origin` su preflight spesso maschera 404/403: verificare deploy e IAM (`invoker: "public"`).

## Cleanup policy (opzionale)

Al primo deploy la CLI può chiedere quanti giorni conservare le immagini container. Es. 7 giorni. Se la policy non si applica: `firebase functions:artifacts:setpolicy` o `firebase deploy --only functions --force`.

## Come provare Tony

Dopo il deploy e l’impostazione di GEMINI_API_KEY: apri la dashboard (utente loggato), apri la console del browser (F12) e lancia:
```js
await Tony.ask("Ciao")
```
Vedi anche `docs-sviluppo/GUIDA_SVILUPPO_TONY.md` (sezione 3).

## Meteo sede (OpenWeather)

Callable **`getMeteoSede`** (regione **europe-west1**, come Tony):

- **Secret**: `OPENWEATHER_API_KEY` — `firebase functions:secrets:set OPENWEATHER_API_KEY`
- **Input**: `{ tenantId }` — utente autenticato, membership tenant attiva
- **Gating**: piano tenant **Free** → rifiutato; **Base+** → meteo sulla `sedeCoordinate` del tenant
- **Logica**: `functions/meteo-service.js` — One Call 3.0, cache 15 min in `tenants/{id}/meteoCache/sede`

**Deploy** (prima function nuova):

```bash
firebase deploy --only "functions,firestore:rules"
```

**Client**: `core/services/meteo-service.js` → `fetchMeteoSede`; widget `core/js/dashboard-meteo.js`.

Documentazione completa: **`docs-sviluppo/meteo/PLAN_INTEGRAZIONE_METEO.md`**.

### Tony — meteo operativo (modulo `meteo` + Tony Avanzato)

Logica chat in **`functions/meteo-service.js`** (`tryMeteoOperativoQuickReply`, `tryMeteoGiornoQuickReply`, …) e regole in **`functions/tony-meteo-rules.js`**:

- Pianificazione **trattamento** e **lavorazione terreno** (`lavoroCampo`) su previsioni ~8 gg
- Valutazione **tre assi**: meteo del giorno + praticabilità (mm lookback × morfologia) + asciugatura post-pioggia (solo lavorazioni)
- **Doppia alternativa** dopo rifiuto praticabilità: prima data utile prima/dopo il giorno scartato
- Mirror client: `core/config/tony-meteo-rules.js`

Canone prodotto: **`docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` §19**. Test: `tests/meteo-tony-quick-reply.test.js`, `tests/tony-meteo-rules.test.js`.

Deploy Tony/meteo: `firebase deploy --only functions` + hard refresh widget Tony (`core/js/tony/main.js` per fix filo chat).


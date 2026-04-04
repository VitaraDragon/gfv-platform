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
   La function legge **process.env.GEMINI_API_KEY**. Per le Functions v2 (Cloud Run) la variabile si imposta dalla **Google Cloud Console**:
   - Vai su [Cloud Run](https://console.cloud.google.com/run) → progetto **gfv-platform** → servizio **tonyask**
   - Clicca **Modifica nuova revisione** (o Modifica)
   - Sezione **Container** → scorri a **Variabili e secret** / **Variables and secrets**
   - **Aggiungi variabile**: Nome `GEMINI_API_KEY`, Valore = la tua API key Gemini
   - **Distribuisci**

   In alternativa (secret): crea il secret con `firebase functions:secrets:set GEMINI_API_KEY` e adatta il codice a usare `defineSecret` (vedi documentazione Firebase).

2b. **Sentry (opzionale ma consigliato)**  
   Progetto Sentry: org **`sabbie-gialle`**, slug progetto **`node-gcpfunctions`** (regione ingest **DE**). Il codice carica `instrument.js` prima di tutto e legge **`SENTRY_DSN`**.  
   Imposta la variabile come per Gemini, sulla stessa revisione Cloud Run dei servizi `tonyask` / `gettonyaudio` (stesso progetto Google Cloud):
   - Console → Cloud Run → servizio (es. `tonyask`) → **Modifica e distribuisci nuova revisione** → **Variabili e secret** → variabile **`SENTRY_DSN`** = valore copiato da Sentry (Client Keys / DSN del progetto `node-gcpfunctions`).  
   Opzionale: **`SENTRY_ENVIRONMENT`** (es. `production`), **`SENTRY_TRACES_SAMPLE_RATE`** (0–1, default `0.2`).  
   Se `SENTRY_DSN` manca, le functions partono comunque e in log compare un warning.

3. **Deploy**
   ```bash
   cd ..
   firebase deploy --only functions
   ```
   La function viene creata in **europe-west1**. Il client in `tony-service.js` deve usare **getFunctions(app, 'europe-west1')**; altrimenti le chiamate vanno a us-central1 e si ottiene CORS/404.

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

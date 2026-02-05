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

3. **Deploy**
   ```bash
   cd ..
   firebase deploy --only functions
   ```
   La function viene creata in **europe-west1**. Il client in `tony-service.js` deve usare **getFunctions(app, 'europe-west1')**; altrimenti le chiamate vanno a us-central1 e si ottiene CORS/404.

## Cleanup policy (opzionale)

Al primo deploy la CLI può chiedere quanti giorni conservare le immagini container. Es. 7 giorni. Se la policy non si applica: `firebase functions:artifacts:setpolicy` o `firebase deploy --only functions --force`.

## Come provare Tony

Dopo il deploy e l’impostazione di GEMINI_API_KEY: apri la dashboard (utente loggato), apri la console del browser (F12) e lancia:
```js
await Tony.ask("Ciao")
```
Vedi anche `docs-sviluppo/GUIDA_SVILUPPO_TONY.md` (sezione 3).

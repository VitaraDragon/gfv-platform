# Ottimizzazioni caricamento – GFV Platform

**Data**: 2026-02-01  
**Obiettivo**: Ridurre i tempi di caricamento percepiti e reali.

---

## Cosa è stato fatto

### 1. Config loader (`core/js/config-loader.js`)

- **Rimossi i `setTimeout(..., 100)`** dopo il caricamento degli script di config. Lo script è già eseguito al `onload`, quindi i 100 ms aggiungevano solo ritardo (~200 ms totali su Firebase + Maps).
- **Cache in `sessionStorage`**: al primo caricamento si salvano `firebaseConfig` e `GOOGLE_MAPS_API_KEY`. Nella stessa sessione (altre pagine, refresh) non si rifanno le richieste ai file di config: lettura immediata da cache.
- **Nuova funzione `loadConfigAndMaps()`**: carica in parallelo Firebase config e Google Maps config con `Promise.all`, così si aspetta solo il più lento invece della somma dei due.
- **Polling più frequente**: negli `waitFor*` l’intervallo è passato da 100 ms a 50 ms, così se un altro script imposta la config si rileva prima.

### 2. Dashboard (`core/dashboard-standalone.html`)

- **Config in parallelo** (e base path per moduli, vedi sotto): al posto di `loadConfig().then(() => loadGoogleMapsConfig())` si usa `loadConfigAndMaps()`, così i due file partono insieme e il tempo di attesa è minore.
- **Google Maps non blocca la prima paint**: tolto l’`await waitForGoogleMapsConfig()` prima di procedere. Firebase viene inizializzato subito dopo `waitForConfig()`, la dashboard si renderizza, e `loadGoogleMapsAPI()` parte in background; la mappa si abilita quando l’SDK è pronto.

---

## Effetto atteso

- **Prima visita (cache vuota)**  
  - Circa 200 ms in meno per via della rimozione dei due `setTimeout`.  
  - Config Firebase e Maps caricati in parallelo invece che in sequenza (risparmio circa uguale al tempo del secondo file).  
  - La dashboard compare prima perché non si aspetta più il config Maps prima di inizializzare Firebase e mostrare il contenuto.

- **Navigazione nella stessa sessione**  
  - Config letta da `sessionStorage`, senza nuovo fetch: risposta quasi istantanea per le pagine che usano il config loader.

---

## Uso di `loadConfigAndMaps()` nelle altre pagine

**Pagine in core/**: includere `config-loader.js` e chiamare `loadConfigAndMaps()` (o `loadConfig()` se non serve Maps). **Pagine in modules/.../views/** (vigneto, frutteto): impostare `window.GFV_CONFIG_BASE = '../../../core';`, includere `../../../core/js/config-loader.js`, poi chiamare `loadConfigAndMaps()`; nel modulo usare `const waitForConfig = () => window.GFVConfigLoader.waitForConfig();` e rimuovere le funzioni locali `waitForConfig`/`loadFallbackConfig`. Vigneti e frutteti (anagrafica) sono già aggiornati; per le altre view vedi "Pattern per le altre view moduli" sotto.

In sintesi (pagine core):

1. Includere `config-loader.js`.
2. Sostituire la sequenza “carica Firebase config poi Google Maps config” con una sola chiamata:
   ```javascript
   window.GFVConfigLoader.loadConfigAndMaps().then(() => { ... }).catch(...);
   ```
3. Se la mappa non serve subito, non chiamare `loadGoogleMapsAPI()` all’avvio: chiamarla solo quando l’utente apre la sezione con la mappa (lazy load).

Così si riducono ritardi e duplicazioni di logica.

---

## Opzioni ulteriori (non implementate)

- **Preload degli script di config**  
  Nel `<head>` delle pagine principali:
  ```html
  <link rel="preload" href="config/firebase-config.js" as="script">
  <link rel="preload" href="config/google-maps-config.js" as="script">
  ```
  Il browser può iniziare a scaricare subito, in parallelo al parsing.

- **Script di config inline o inclusi in pagina**  
  Invece di iniettare dinamicamente `firebase-config.js` e `google-maps-config.js`, includerli con `<script src="...">` nell’HTML (o inline in build). Si evita il round-trip aggiuntivo; va gestito il path relativo (es. `../config/` dalle sottocartelle).

- **`defer` sugli script non critici**  
  Per script come intro.js: `<script src="..." defer></script>` così non bloccano il parsing; l’esecuzione avviene dopo il DOM.

- **Service Worker e cache**  
  Il service worker può mettere in cache i file di config (e altri asset) per visite successive e uso offline.

---

## Pattern per le altre view moduli (vigneto / frutteto)

Per ogni view che ha ancora `waitForConfig` e `loadFallbackConfig` inline:

1. Prima del `<script type="module">` inserire:
   - `<script>window.GFV_CONFIG_BASE = '../../../core';</script>`
   - `<script src="../../../core/js/config-loader.js"></script>`
   - `<script>window.GFVConfigLoader.loadConfigAndMaps().catch(function(e){ console.error('Config load error', e); });</script>`
   (Se la pagina non usa Google Maps, usare `loadConfig()` al posto di `loadConfigAndMaps()`.)
2. Nel modulo: eliminare l'intero blocco delle funzioni `waitForConfig` e `loadFallbackConfig`.
3. Nel modulo: aggiungere `const waitForConfig = () => window.GFVConfigLoader.waitForConfig();` e lasciare invariata la chiamata `const firebaseConfig = await waitForConfig();` in init().

File da aggiornare: vigneto-dashboard, vigneto-statistiche, vendemmia, potatura, trattamenti, pianifica-impianto, calcolo-materiali; frutteto-dashboard, frutteto-statistiche, raccolta-frutta, potatura, trattamenti.

---

## Note

- La cache in `sessionStorage` è per sessione: chiudendo il tab si perde. Per persistenza tra sessioni si potrebbe usare `localStorage` (attenzione a eventuali dati sensibili nella config).
- Le pagine che ancora non usano `config-loader.js` e duplicano la logica di caricamento beneficerebbero dell’uso del loader centralizzato e di `loadConfigAndMaps()` dove serve.

# Refactoring codice – Raccomandazioni

**Data**: 2026-02-01  
**Ambito**: Duplicazione, configurazione, global state, sicurezza

---

## Risposta breve

**Sì, c’è margine per un refactoring mirato.**  
Non serve rifare tutto: architettura e servizi sono già in ordine. Conviene intervenire su **caricamento config**, **uso dei globali** e **chiave API hardcoded**, e solo dove il beneficio è chiaro (manutenibilità, sicurezza, meno bug).

---

## 1. Caricamento config Firebase e Google Maps (priorità alta)

### Problema

- Esiste **`core/js/config-loader.js`** con:
  - `GFVConfigLoader.loadConfig()`
  - `GFVConfigLoader.loadGoogleMapsConfig()`
  - `GFVConfigLoader.waitForConfig()` / `waitForGoogleMapsConfig()`
  - `GFVConfigLoader.loadGoogleMapsAPI()`
- Solo **dashboard-standalone.html** lo usa (include lo script e chiama `loadConfig().then(...)`).
- **Decine di altre pagine** (attivita, statistiche, terreni, gestione-lavori, vigneti, frutteti, vendemmia, potatura, raccolta-frutta, ecc.) **duplicano** la stessa logica:
  - `new Promise` + `setInterval` che controlla `window.firebaseConfig` (e a volte `window.GOOGLE_MAPS_API_KEY`);
  - in molti casi anche `loadFallbackConfig()` copiata (script da raw GitHub).
- In **attivita-standalone.html** e **statistiche-standalone.html** è presente una **copia quasi identica** di `loadConfig()` + `loadFallbackConfig()` (stesso codice di config-loader ma inline).

Effetto: stesso comportamento replicato in ~30+ file; modifiche (es. timeout, URL fallback, gestione errori) vanno fatte in molti posti; rischio incoerenze e bug.

### Raccomandazione

- **Standardizzare su `config-loader.js`** per tutte le pagine che usano Firebase e/o Google Maps.
- In ogni pagina standalone che oggi ha script inline “wait for firebaseConfig / GOOGLE_MAPS”:
  - Includere `<script src="js/config-loader.js"></script>` (path relativo al contesto, es. `../js/` o `../../core/js/` a seconda della cartella).
  - Sostituire il blocco inline con una chiamata a:
    - `window.GFVConfigLoader.loadConfig()` (e, se serve Maps, `loadGoogleMapsConfig()` e eventualmente `loadGoogleMapsAPI()`).
  - Rimuovere le funzioni locali `loadConfig`, `loadFallbackConfig`, e i `setInterval` su `window.firebaseConfig`.
- Opzionale: in config-loader esporre una sola funzione tipo `loadAppConfig(options)` che carica Firebase + Maps se richiesto, così ogni pagina fa una sola chiamata.

**Stima**: refactoring meccanico ma esteso (toccare molte HTML). Si può fare per gruppi (prima core, poi moduli).

---

## 2. Chiave API Google Maps hardcoded (priorità alta)

### Problema

- In **molte view** (vendemmia, potatura, pianifica-impianto, raccolta-frutta, gestione-lavori, ecc.) compare:
  - `window.GOOGLE_MAPS_API_KEY || 'AIzaSyDno2cpcMHfs_FqhD4-hi_esj6pBixyJBk'`
- La stessa chiave è in **core/config/google-maps-config.js** come valore di default.
- Effetti: chiave esposta in più punti; se la cambi in un file e non in altri, comportamento incoerente; uso come “fallback” in produzione può essere un rischio (abuso quota / sicurezza).

### Raccomandazione

- **Un solo posto** per la chiave: es. `core/config/google-maps-config.js` (o env/build se un giorno ci sarà).
- Nelle view **non** mettere fallback hardcoded: usare solo `window.GOOGLE_MAPS_API_KEY` dopo che è stato caricato `config-loader` (o google-maps-config).
- Se la chiave non c’è: disabilitare Maps con un messaggio chiaro (“Configura la chiave Google Maps nelle impostazioni”) invece di usare una chiave di default nel codice.

**Stima**: sostituzione stringa in pochi file + eventuale messaggio “Maps non configurata” dove oggi si usa il fallback.

---

## 3. Servizi e `window.firebaseConfig` (priorità media)

### Problema

- **vendemmia-service.js** (modulo vigneto), in un ramo di “creazione vendemmia da lavoro”, fa:
  - `if (typeof window.firebaseConfig !== 'undefined') { const app = initializeApp(window.firebaseConfig); const db = getFirestore(app); ... }`
  - Quindi crea una **seconda** istanza Firebase e usa `db` locale invece del Firestore già inizializzato dalla pagina.
- Lo stesso pattern (uso di `window.firebaseConfig` e a volte `initializeApp` dentro servizi) potrebbe esserci in altri punti (es. altri moduli).

Effetto: dipendenza da globali; doppia inizializzazione; rischio incoerenza (due app Firebase). I servizi dovrebbero usare solo `firebase-service.js` (getDb, getCollection, ecc.) e assumere che l’app sia già inizializzata dalla pagina.

### Raccomandazione

- In **vendemmia-service.js** (e ovunque si faccia lo stesso):
  - Rimuovere `initializeApp(window.firebaseConfig)` e l’uso di un `db` locale.
  - Usare **solo** `getDb()` (e le helper) da `core/services/firebase-service.js` per leggere/scrivere Firestore.
- Garantire che le pagine che usano quel servizio inizializzino Firebase (tramite config-loader) prima di importare il modulo. Così i servizi restano “puri” e senza dipendenza da `window`.

**Stima**: pochi punti da correggere (vendemmia-service e eventuali altri servizi con lo stesso pattern).

---

## 4. Controller e globali (priorità media)

### Problema

- **terreni-controller.js** dipende da `window.firebaseConfig` e `window.GOOGLE_MAPS_API_KEY` (attesa con polling), mentre altri controller (es. dashboard) ricevono le dipendenze in modo più strutturato (callbacks, init dalla pagina).
- Coerenza: o tutti i controller che usano Firebase/Maps ricevono la config (o un riferimento a “app inizializzata”) dalla pagina, oppure tutti usano un unico meccanismo (es. config-loader) senza riscrivere la logica di attesa in ogni controller.

### Raccomandazione

- **terreni-controller.js**: rimuovere la logica di `waitForConfig()` interna; la pagina che usa il controller deve:
  - Caricare config con `GFVConfigLoader.loadConfig()` e `loadGoogleMapsConfig()` (o `loadGoogleMapsAPI()`),
  - Poi inizializzare Firebase e solo dopo chiamare le funzioni del controller (o passare un flag “config ready”).
- Stesso principio per altri controller che oggi fanno polling su `window.firebaseConfig` / `window.GOOGLE_MAPS_API_KEY`: spostare “chi carica la config” alla pagina e “chi usa la config” al loader centralizzato.

**Stima**: refactoring localizzato a terreni-controller e alle pagine che lo usano (es. terreni-standalone.html); eventualmente 1–2 altri controller.

---

## 5. Auth e redirect a login (priorità bassa)

### Problema

- Molte pagine (circa 30) hanno un blocco `onAuthStateChanged` che, se l’utente non è autenticato, reindirizza a `login-standalone.html`. La logica è simile ma non condivisa (copy-paste con piccole variazioni).

### Raccomandazione

- Introdurre un piccolo **auth-guard** riutilizzabile (es. `shared/auth-guard.js` o in core):
  - Funzione tipo `requireAuth(redirectUrl)` che:
    - Si registra a `onAuthStateChanged` (o usa una Promise che si risolve con l’utente);
    - se non c’è utente, imposta `location.href` (o `redirectUrl`) e ritorna;
    - altrimenti ritorna l’utente (o i dati utente) per uso nella pagina.
- Le pagine che oggi hanno il blocco inline sostituiscono con una chiamata tipo `await requireAuth('core/auth/login-standalone.html')` (o simile) all’avvio dello script module.
- Opzionale: stesso modulo può esporre `requireAuthForTenant()` se serve verificare anche il tenant.

**Stima**: un file nuovo + sostituzione in ~30 HTML; beneficio soprattutto su modifiche future (es. cambiare URL di login o aggiungere log).

---

## 6. Cosa non refactorizzare (o rimandare)

- **Struttura moduli (vigneto, frutteto, conto-terzi, parco-macchine)**  
  Già ordinata (models, services, views). Nessun bisogno di ristrutturare.

- **Servizi core (firebase-service, auth-service, tenant-service, ecc.)**  
  API chiare, multi-tenant coerente, error handling standardizzato. Al massimo piccoli ritocchi, niente riscritture.

- **Dimensioni delle pagine standalone (HTML lunghi)**  
  Sono “single page” con tanto markup e script; è un trade-off accettabile per app senza bundler. Spezzare in componenti richiederebbe un passo verso framework o almeno template; da valutare solo se si introduce un build step.

- **Uso di ES module e import da CDN Firebase**  
  Coerente con deploy statico. Nessun refactoring necessario per questo.

---

## 7. Ordine suggerito

| Ordine | Intervento | Priorità | Efforto |
|--------|------------|----------|--------|
| 1 | Eliminare fallback con chiave Google Maps hardcoded; un solo punto di configurazione | Alta | Basso |
| 2 | Vendemmia-service (e altri servizi): usare solo getDb(), niente initializeApp in servizi | Alta | Basso |
| 3 | Standardizzare tutte le pagine su config-loader.js (rimuovere duplicati loadConfig / wait) | Alta | Medio |
| 4 | Terreni-controller (e simili): niente polling su window; config dalla pagina / loader | Media | Basso |
| 5 | Auth-guard condiviso per “redirect se non loggato” | Bassa | Medio |

---

## 8. Conclusione

- **Sì, ha senso fare refactoring** su: caricamento config, uso globali, chiave API, e (opzionale) auth guard.
- **No** a un refactoring “generale” di architettura o di tutti i servizi: sono già in buono stato.
- Conviene procedere in piccolo: prima punti 1 e 2, poi 3 per gruppi di pagine (es. prima core, poi moduli), così si riduce il rischio e si può testare passo passo.

Se vuoi, il prossimo passo può essere: (a) un piano passo-passo solo per “config-loader ovunque” (elenco file da toccare), oppure (b) una patch di esempio per una pagina (es. attivita-standalone) + vendemmia-service da usare come riferimento per le altre.

# Dobbiamo ancora fare

**Data**: 27 febbraio 2026  
**Scopo**: Elenco unificato delle cose da fare (sicurezza, documentazione, Tony, snellimento codice, test) per avere una direzione chiara.  
**Riferimenti**: VALUTAZIONE_APP_2026-02-25, PROPOSTA_SNELLIMENTO_E_OTTIMIZZAZIONE_CODICE, RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE, ARCHITETTURA_MODULI_E_INTERAZIONI.

> **Aggiornamento 2026-03-08**: §1.3 – **FATTO** per terreni, diario attività, gestione lavori. currentTableData implementato in attivita-controller.js, terreni, gestione-lavori-controller.js. FILTER_TABLE lavori in main.js + functions. Le altre voci restano valide.

---

## 1. Priorità alta

### 1.1 Sicurezza – Firestore inviti
- **Aggiornamento 2026-04-11**: **FATTO** in codice (verifica incrociata). In `firestore.rules`, `match /inviti/{invitoId}` — `allow create` è vincolata a utente autenticato, campi obbligatori, `inviatoDa == request.auth.uid`, `belongsToTenant` + `isManagerOrAdmin` sul `tenantId` (non più `create: if true`). Dettaglio storico: `COSA_ABBIAMO_FATTO.md` §2026-04-04; perimetro `docs-sviluppo/SICUREZZA_FLUSSI.md`.

### 1.2 Documentazione – Indice unico
- **Cosa**: Molti file in docs-sviluppo; manca un indice che indichi “stato attuale” vs “storico” e dove trovare sicurezza, moduli, Tony.
- **Da fare**: Creare **INDICE_DOCUMENTAZIONE.md** (o sezione in README) con: onboarding (LEGGIMI_PRIMA, STATO_PROGETTO_COMPLETO, ARCHITETTURA_MODULI), sicurezza (firestore.rules + istruzioni), moduli (ARCHITETTURA_MODULI, PLAN_*), Tony (GUIDA_SVILUPPO_TONY, CHECKLIST_TONY); indicare quali doc sono “stato attuale” e quali “storico”.

### 1.3 Tony – Riepilogo su altre pagine lista
- **Cosa**: Il riepilogo Tony (risposte tipo “Quanti sono?”, “Cosa c’è in lista?”) è già su: **tutte le liste Macchine** (trattori, attrezzi, flotta, scadenze, guasti), **entrambe le liste Magazzino** (prodotti, movimenti), **terreni**, **diario attività**, **gestione lavori** (2026-03-08).
- **Da fare**: Estendere il pattern `currentTableData` (placeholder + summary + items + setContext + evento `table-data-ready`) alle pagine lista che ancora non ce l’hanno, ad esempio:
  - **Core**: statistiche, validazione ore, gestione squadre, gestisci utenti, gestione operai, compensi, report.
  - **Vigneto**: vigneti, vendemmia, potatura, trattamenti, statistiche vigneto.
  - **Frutteto**: frutteti, raccolta frutta, potatura, trattamenti, statistiche frutteto.
  - **Conto-terzi**: clienti, preventivi, tariffe, terreni clienti.
- **Come**: Seguire la checklist in RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md (placeholder, pageType, summary, items in render, setContext, table-data-ready).

### 1.4 Snellimento – Bootstrap unico e utility condivise
- **Bootstrap unico**: **`core/js/standalone-bootstrap.js`** esiste (carica config, Firebase, tenant, inietta Tony). Usato in `terreni-test-bootstrap.html`, `prodotti-test-bootstrap.html` come prova. **Da fare**: estendere l'adozione a tutte le pagine standalone (oggi la maggior parte usa ancora lo schema manuale con config-loader + waitForConfig). *(Riferimento: PROPOSTA_SNELLIMENTO §2.1.)*
- **Utility condivise**: Centralizzare in **shared/utils** (o core/js/utils.js): `escapeHtml(str)`, `showAlert(containerId, message, type)` (o allineare a `shared/utils/error-handler.js` con `showMessage`). Usare ovunque al posto delle copie locali. *(§2.2.)*
- **Log di debug Tony**: Rimuovere o condizionare i `console.log` in `core/js/tony/main.js` (es. dietro `window.__TONY_DEBUG`). *(§3.1.)*

---

## 2. Priorità media

### 2.1 Documentazione e codice
- **README e roadmap**: Allineare README e roadmap allo stato reale (moduli, Tony, link a STATO_PROGETTO_COMPLETO e ARCHITETTURA_MODULI).
- **TODO aperti**: Tracciare e chiudere i TODO nei servizi (es. varieta-frutteto salvataggio preferenze, verifiche zone/ore in lavori-service).
- **Controller e globali**: Ridurre dipendenza da `window.firebaseConfig` / `GOOGLE_MAPS_API_KEY` (es. iniezione da config-loader).
- **Path e git**: Usare path Unix in repo; evitare duplicati `core/` vs `core\`; eventuale .gitattributes.

### 2.2 Snellimento – Path-resolver e CSS
- **Path-resolver**: Standardizzare l’uso di **path-resolver** (o wrapper da core/js) per tutti gli import dinamici verso core e parco-macchine; niente path “magici” sparsi. *(PROPOSTA_SNELLIMENTO §2.3.)*
- **CSS condiviso liste**: Introdurre un foglio condiviso (es. `core/styles/list-views.css` o `modules/macchine/styles/list-views.css`) con classi comuni per le liste (trattori, attrezzi, flotta, scadenze, guasti, prodotti); le pagine tengono solo stili specifici. *(§4.3.)*
- **list-utils.js (Parco Macchine)**: Estrarre un piccolo modulo con `statoBadge(stato)`, eventuale `renderTableMezzi(filtered, columnsConfig)` per le 5 liste macchine, per evitare blocchi ripetuti. *(§2.2.)*

### 2.3 Tony – Widget più manutenibile
- **Spezzare tony-widget-standalone.js**: ✅ **FATTO (2026-02)**: la logica è ora in `core/js/tony/` (main.js orchestratore, ui.js FAB/chat/dialog, engine.js mappe e resolve, voice.js TTS). `tony-widget-standalone.js` è il loader che importa `tony/main.js`. *(PROPOSTA_SNELLIMENTO §3.1.)*
- **Gestione lavori**: ✅ **GIÀ MODULARE (verificato 2026-03-08)**: usa `gestione-lavori-controller.js`, `gestione-lavori-events.js`, `gestione-lavori-utils.js`, `gestione-lavori-maps.js`, `gestione-lavori-tour.js`. Non serve estendere il pattern dashboard. *(§3.2.)*
- **Altre pagine lunghe**: Estendere il pattern a potatura, trattamenti vigneto/frutteto: spostare pezzi in moduli JS dedicati. *(§3.2.)*

### 2.4 Service-helper e getDb
- Usare **service-helper** in modo coerente per letture comuni (lista macchine, terreni, ecc.) invece di import dinamici diretti verso i servizi; verificare che non restino chiamate che bypassano firebase-service o tenant-service. *(§4.2.)*

---

## 3. Priorità bassa

### 3.1 Test
- Estendere test sui **servizi** con mock (tenantId, Firestore).
- Introdurre **1–2 test E2E** su flussi critici (login → dashboard, creazione terreno, creazione lavoro), es. Playwright/Cypress.

### 3.2 Snellimento – Performance
- **Lazy load Tony**: Caricare lo script Tony **solo al primo click sul FAB** (o al primo focus sulla chat), con “Caricamento…” alla prima apertura. Riduce tempo di caricamento iniziale sulle pagine dove l’utente non usa subito Tony. *(PROPOSTA_SNELLIMENTO §4.1.)*
- **Un solo punto di init Tony**: Se lo standalone-bootstrap garantisce Firebase pronto prima di inserire Tony, ridurre o eliminare il polling in getAppInstance() e semplificare l’init. *(§4.1.)*

### 3.3 Documentazione storica
- Archiviare o raggruppare i RIEPILOGO_LAVORI_* e mantenere un unico “stato attuale” aggiornato.

---

## 4. Cosa evitare

- **Non** introdurre un framework (React/Vue) solo per “snellire”: il progetto è standalone HTML + ES module e va bene così.
- **Non** unificare tutte le standalone in una SPA unica senza una roadmap chiara.
- **Non** riscrivere tutto in un colpo: procedere con **interventi incrementali** (prima bootstrap + utils, poi refactor tony-widget, poi CSS condiviso) con test e verifica dopo ogni passo.

*(Riferimento: PROPOSTA_SNELLIMENTO §7.)*

---

## 5. Riepilogo per area

| Area | Cosa fare |
|------|-----------|
| **Sicurezza** | ~~Inviti `create` aperto~~ — **chiuso** in rules (2026-04-04; verifica doc 2026-04-11). |
| **Documentazione** | Indice (INDICE_DOCUMENTAZIONE.md), README/roadmap allineati, consolidamento doc storica. |
| **Tony** | Riepilogo su altre liste (vigneti, clienti, validazione ore, …); terreni, attivita, gestione lavori già dotati; log debug condizionati; opzionale lazy load. *(Widget già spezzato in core/js/tony/.)* |
| **Codice** | Bootstrap unico, escapeHtml/showAlert condivisi, path-resolver ovunque, CSS condiviso liste, list-utils macchine, service-helper coerente. |
| **Test** | Più test servizi (mock), 1–2 E2E critici. |
| **Vari** | TODO nei servizi, controller senza globali, path Unix in repo. |

---

*Documento “Dobbiamo ancora fare” – 25 febbraio 2026*

# Architettura moduli, logica e interazioni tecniche

**Ultimo aggiornamento: 2026-02-25.**

Questo documento descrive **tutti i moduli** dell’app GFV Platform, le **soluzioni tecniche** adottate, le **funzioni principali** e **come i moduli interagiscono tra loro** a livello di codice (servizi, import, chiamate). Per flussi operativi e ruoli utente si veda **`guida-app/intersezioni-moduli.md`**.

---

## 1. Panoramica moduli

| Modulo | Cartella | Contenuto principale |
|--------|----------|----------------------|
| **Core** | `core/` | Auth, dashboard, terreni, attivita, statistiche, segnatura-ore; admin (gestione-lavori, gestione-guasti, segnalazione-guasti, validazione-ore, utenti, squadre, operai, compensi, macchine admin, report, abbonamento, impostazioni, amministrazione). Servizi: firebase-service, auth-service, tenant-service, terreni-service, attivita-service, lavori-service, ore-service, statistiche-service, liste-service, squadre-service. |
| **Conto terzi** | `modules/conto-terzi/` | Clienti, preventivi, tariffe, terreni clienti, mappa clienti, nuovo preventivo, accetta preventivo. Servizi: clienti-service, preventivi-service, tariffe-service, poderi-clienti-service. Modelli: Cliente, Preventivo, Tariffa, PodereCliente. |
| **Frutteto** | `modules/frutteto/` | Dashboard, anagrafica frutteti, statistiche, raccolta frutta, potatura, trattamenti. Servizi: frutteti-service, frutteto-statistiche-service, frutteto-statistiche-aggregate-service, lavori-frutteto-service, potatura-frutteto-service, raccolta-frutta-service, trattamenti-frutteto-service. Modelli: Frutteto, PotaturaFrutteto, RaccoltaFrutta, TrattamentoFrutteto. Config: specie-fruttifere. |
| **Magazzino** | `modules/magazzino/` | Home, prodotti, movimenti. Servizi: prodotti-service, movimenti-service. Modelli: Prodotto, MovimentoMagazzino. Config: categorie-prodotto. |
| **Macchine (views)** | `modules/macchine/` | **Solo viste HTML**: dashboard Parco Macchine, trattori-list, attrezzi-list, flotta-list, scadenze-list, guasti-list. Tutta la logica dati è in `parco-macchine`. |
| **Parco macchine (logica)** | `modules/parco-macchine/` | **Servizi e modelli** per trattori/attrezzi: macchine-service (CRUD, getAllMacchine, getMacchina, updateMacchina, createMacchina), macchine-utilizzo-service (aggiornaOreMacchinaDaUtilizzo, liberazione macchine da attività/lavori), categorie-attrezzi-service. Modelli: Macchina, CategoriaAttrezzo. |
| **Report** | `modules/report/` | Vista report-standalone, report-service, adapters (es. vigneto-adapter) per aggregare dati da altri moduli. |
| **Vigneto** | `modules/vigneto/` | Dashboard, anagrafica vigneti, vendemmia, potatura, trattamenti, statistiche, calcolo materiali, pianificazione impianto. Servizi: vigneti-service, vendemmia-service, potatura-vigneto-service, trattamenti-vigneto-service, vigneto-statistiche-service, vigneto-statistiche-aggregate-service, lavori-vigneto-service, calcolo-materiali-service, pianificazione-impianto-service. Modelli: Vigneto, Vendemmia, PotaturaVigneto, TrattamentoVigneto, PianificazioneImpianto. Config: forme-allevamento. |

---

## 2. Soluzioni tecniche comuni

### 2.1 Multi-tenant e accesso dati

- **Punto unico Firebase**: `core/services/firebase-service.js` espone `getAppInstance()`, `getDb()`, `getAuthInstance()`. Tutta l’app usa questo modulo (Firebase 11); nessun altro file inizializza Firebase in modo autonomo.
- **tenantId**: Ogni operazione su dati aziendali usa il `tenantId` dell’utente loggato (da auth/tenant-service). Le collection Firestore sono organizzate per tenant (es. `tenants/{tenantId}/terreni`, `tenants/{tenantId}/lavori`).
- **Servizi core**: I servizi in `core/services/` (terreni-service, attivita-service, lavori-service, ore-service, statistiche-service, ecc.) usano `getDb()` e ricevono o leggono il `tenantId` per isolare i dati.

### 2.2 Import dinamici tra moduli

- Per evitare dipendenze circolari e caricare moduli solo quando servono, si usano **import dinamici** `await import('...')` invece di `import ... from '...'` in cima al file.
- Esempi: le view di vigneto/frutteto e i servizi di integrazione chiamano `terreni-service`, `parco-macchine/services/macchine-service`, `lavori-vigneto-service` tramite `await import(...)`.

### 2.3 Split Parco Macchine: views vs logica

- **`modules/macchine/`**: contiene **solo le pagine** (dashboard, liste trattori/attrezzi/flotta/scadenze/guasti). Queste pagine importano i servizi da **`modules/parco-macchine/`**.
- **`modules/parco-macchine/`**: contiene **modelli e servizi** (Macchina, CategoriaAttrezzo, macchine-service, macchine-utilizzo-service, categorie-attrezzi-service). Sono usati da core (attivita, gestione-lavori, validazione-ore, segnalazione-guasti, gestione-guasti) e da tutti i moduli che gestiscono macchine (vigneto, frutteto).
- **Motivo**: separazione netta tra UI del “Parco Macchine” (liste, dashboard, scadenze, guasti) e logica condivisa (CRUD macchine, aggiornamento ore, liberazione in uso), così core e moduli specializzati possono usare le stesse funzioni senza dipendere dalle view.

### 2.4 Tony (assistente IA)

- **Service**: `core/services/tony-service.js` (init, setContext, ask, askStream, onAction, triggerAction). **Backend**: Cloud Functions `tonyAsk` e `getTonyAudio` in `functions/index.js` (europe-west1).
- **Widget**: `core/js/tony-widget-standalone.js` è il loader; la logica è in `core/js/tony/` (main.js orchestratore, ui.js FAB/chat/dialog, engine.js mappe e resolve, voice.js TTS). Carica `tony-form-schemas.js`, `tony-smart-filler.js`, `tony-form-injector.js`; usa `core/config/tony-routes.json` (generato da `npm run generate:tony-routes`) per le rotte.
- **Contesto**: Le pagine passano dati a Tony con `Tony.setContext('nomeModulo', data)` o `syncTonyModules(modules)`. Il widget invia `context.page` (pagePath, currentTableData, availableRoutes) e il contesto dashboard/moduli alla Cloud Function.
- **Dettaglio**: `GUIDA_SVILUPPO_TONY.md`, `TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md`, `CHECKLIST_TONY.md`.

---

## 3. Funzioni principali per modulo

### 3.1 Core

- **terreni-service**: `getAllTerreni(tenantId)`, `getTerreno(tenantId, id)`, CRUD terreni.
- **attivita-service**: CRUD attività, associazione a terreno/lavoro.
- **lavori-service**: CRUD lavori, `getTerreno` per validazioni.
- **ore-service**: ore operai, validazione, compensi.
- **statistiche-service**: statistiche aggregate; usa `getAllTerreni`.
- **firebase-service**: `getDb()`, `getAppInstance()`, `getAuthInstance()`.

### 3.2 Parco macchine (modules/parco-macchine)

- **macchine-service**: `getAllMacchine(tenantId)`, `getMacchina(tenantId, id)`, `createMacchina`, `updateMacchina`, gestione stato (disponibile, in_uso, guasto, ecc.).
- **macchine-utilizzo-service**: `aggiornaOreMacchinaDaUtilizzo(tenantId, attivitaId, lavoroId, …)` per aggiornare ore macchina e liberare/assegnare stato; usato da attivita (diario) e da flussi lavori (completamento, validazione).
- **categorie-attrezzi-service**: CRUD categorie attrezzi, compatibilità CV.

### 3.3 Vigneto

- **vigneti-service**: CRUD vigneti, collegamento terreno.
- **vendemmia-service**: CRUD vendemmie, calcolo resa, costi (anche macchine tramite `getMacchina`).
- **lavori-vigneto-service**: integrazione lavori–vigneto; `calcolaCostiLavoro(lavoroId, lavoro)`, `aggiornaVignetiDaTerreno(tenantId, terrenoId)` (chiamata da core quando un terreno cambia coltura/eliminazione); usa `getMacchina` (parco-macchine).
- **trattamenti-vigneto-service**: CRUD trattamenti, uso `getTerreno`, `getMacchina`, `calcolaCostiLavoro`.
- **potatura-vigneto-service**: CRUD potature, uso terreni e costi.
- **vigneto-statistiche-service** / **vigneto-statistiche-aggregate-service**: statistiche e aggregazioni pre-calcolate.
- **pianificazione-impianto-service**, **calcolo-materiali-service**: pianificazione e calcolo materiali (condivisi con Frutteto via parametro coltura).

### 3.4 Frutteto

- **frutteti-service**: CRUD frutteti.
- **lavori-frutteto-service**: integrazione lavori–frutteto; calcolo costi, uso `getMacchina`.
- **potatura-frutteto-service**, **trattamenti-frutteto-service**, **raccolta-frutta-service**: CRUD e uso `getTerreno`, `getMacchina`; potatura usa anche `calcolaCostiLavoro` da **lavori-vigneto-service** (logica costi condivisa).
- **frutteto-statistiche-service** / **frutteto-statistiche-aggregate-service**: statistiche e aggregazioni.

### 3.5 Conto terzi

- **clienti-service**, **preventivi-service**, **tariffe-service**, **poderi-clienti-service**: CRUD rispettivi; preventivi gestiscono stati (bozza, inviato, accettato, pianificato) e creazione lavoro da preventivo pianificato.

### 3.6 Magazzino

- **prodotti-service**: CRUD prodotti, giacenze, scorte minime.
- **movimenti-service**: movimenti carico/scarico, eventuale collegamento a lavoro/attività.

### 3.7 Report

- **report-service**: aggregazione dati per report; **adapters** (es. vigneto-adapter) per leggere dati da altri moduli.

---

## 4. Interazioni tecniche (chi chiama chi)

### 4.1 Chi usa Parco Macchine (parco-macchine)

- **macchine-service** (`getAllMacchine`, `getMacchina`, `updateMacchina`, `createMacchina`) è usato da:
  - **core**: `core/admin/gestione-guasti-standalone.html`, `core/admin/segnalazione-guasti-standalone.html`, `core/js/attivita-controller.js` (updateMacchina).
  - **attivita**: `core/attivita-standalone.html` (macchine-utilizzo-service per ore/liberazione).
  - **validazione-ore**: `core/admin/validazione-ore-standalone.html` (macchine-utilizzo-service).
  - **views macchine**: `modules/macchine/views/*.html` (trattori-list, attrezzi-list, flotta-list, scadenze-list, macchine-dashboard) per liste e form.
  - **vigneto**: vendemmia-standalone, potatura-standalone, trattamenti-vigneto-service, lavori-vigneto-service (getMacchina per costi/nomi).
  - **frutteto**: potatura-frutteto-service, lavori-frutteto-service, trattamenti-frutteto-service (getMacchina).
- **macchine-utilizzo-service** (`aggiornaOreMacchinaDaUtilizzo`, liberazione macchine) è usato da:
  - **core/attivita-standalone.html**, **core/admin/validazione-ore-standalone.html**, e dalla logica di completamento/validazione lavori (eventi gestione-lavori, attivita-events).

### 4.2 Chi usa Core (terreni, lavori, attivita)

- **terreni-service** (`getTerreno`, `getAllTerreni`) è usato da:
  - **core**: lavori-service, statistiche-service.
  - **vigneto**: vigneti, vendemmia, potatura, trattamenti, calcolo-materiali, pianifica-impianto (tutti i servizi e varie view).
  - **frutteto**: frutteti, potatura, trattamenti, raccolta (servizi e view).
  - **conto-terzi**: terreni clienti, preventivi (terreno e coltura/morfologia).
- **lavori-vigneto-service** (`calcolaCostiLavoro`, `aggiornaVignetiDaTerreno`) è usato da:
  - **vigneto**: trattamenti-vigneto-service, potatura-standalone, vigneti-standalone (dettaglio spese).
  - **frutteto**: potatura-frutteto-service (calcolaCostiLavoro).
  - **core**: `core/js/attivita-events.js` (aggiornaVignetiDaTerreno al cambio/eliminazione terreno), `core/admin/lavori-caposquadra-standalone.html` (aggiornaVignetiDaTerreno).

### 4.2 Magazzino e altri

- **Magazzino**: prodotti e movimenti possono essere referenziati da trattamenti (vigneto/frutteto) e da lavori/attività (prodottoId, movimento collegato a lavoroId/attivitaId); i dettagli dipendono dalle singole view/servizi.
- **Report**: legge da più moduli tramite adapters (es. vigneto-adapter) e report-service.

---

## 5. Riepilogo

- **Moduli**: Core, Conto terzi, Frutteto, Magazzino, Macchine (views), Parco macchine (servizi/modelli), Report, Vigneto.
- **Logica e soluzioni**: multi-tenant con getDb/tenantId, import dinamici tra moduli, split macchine (UI) / parco-macchine (logica), Tony con setContext e rotte generate.
- **Interazioni**: Parco macchine è usato da core (lavori, attivita, validazione, guasti) e da vigneto/frutteto; terreni-service e lavori-vigneto-service sono usati da core e da vigneto/frutteto; frutteto riusa calcolaCostiLavoro del vigneto; core attivita-events e lavori-caposquadra chiamano aggiornaVignetiDaTerreno.

Per **flussi operativi**, **ruoli** e **matrice funzionale** modulo A ↔ modulo B vedi **`guida-app/intersezioni-moduli.md`**.  
Per **Parco Macchine e Manodopera** nel dettaglio: **`PLAN_MODULI_INTERCONNESSI.md`**.  
Per **stato progetto e struttura file**: **`STATO_PROGETTO_COMPLETO.md`**.

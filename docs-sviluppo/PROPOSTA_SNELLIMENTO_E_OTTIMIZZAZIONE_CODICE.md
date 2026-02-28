# Proposta snellimento e ottimizzazione del codice

**Data**: 25 febbraio 2026  
**Obiettivo**: Ridurre duplicazione, alleggerire file monolitici e uniformare i pattern senza stravolgere l’architettura attuale.

---

## 1. Sintesi: sì, il codice si può snellire e ottimizzare

L’architettura (core / modules / shared, multi-tenant, servizi) è solida. Ci sono però **duplicazioni**, **file molto grandi** e **pattern non uniformi** su cui si può intervenire a medio termine per manutenibilità e performance. Le proposte sotto sono priorizzate per impatto e sforzo.

---

## 2. Duplicazioni da eliminare o ridurre

### 2.1 Bootstrap iniziale (config + Firebase + Tony) nelle pagine standalone

**Problema**: In **decine di pagine** si ripete lo stesso blocco con piccole variazioni di path:

- `window.GFV_CONFIG_BASE = '...'` (core: `''`, admin: `'../'`, modules: `'../../../core'`)
- `window.currentTableData = ...` (solo dove serve per Tony)
- `<script src=".../config-loader.js">`
- `GFVConfigLoader.loadConfigAndMaps()`
- Nel modulo: `waitForConfig()`, `import` di firebase-service, tenant-service, `initializeFirebase()`, `loadTonyAfterFirebase()` (stesso pattern con path diversi)

**Proposta**:
- Introdurre **uno script di bootstrap** unico (es. `core/js/standalone-bootstrap.js`) che:
  - Riceve il “contesto” (es. `data-config-base="../"` su uno script o `window.GFV_CONFIG_BASE` già impostato prima).
  - Carica config, inizializza Firebase, registra tenant, inietta Tony (link CSS + script widget).
- Le pagine includono **un solo script** (e opzionalmente il placeholder `currentTableData` dove serve) invece di 4–5 righe ripetute.
- **Effetto**: meno copy-paste, un solo punto da aggiornare per cambi di path o di init; riduzione linee nelle HTML.

### 2.2 Funzioni utility ripetute: `escapeHtml`, `showAlert`, badge stato

**Problema**: `escapeHtml`, `showAlert` (o equivalenti) e funzioni tipo `statoBadge` compaiono **in molte pagine** (liste macchine, prodotti, gestione squadre, statistiche, ecc.) con implementazioni quasi identiche.

**Proposta**:
- Centralizzare in **shared/utils** (o in `core/js/utils.js` usato dalle standalone):
  - `escapeHtml(str)`
  - `showAlert(containerId, message, type)` (o allineare a `shared/utils/error-handler.js` che ha già `showMessage`) e usarlo ovunque al posto di `showAlert` locali.
- Per le **liste Parco Macchine** (trattori, attrezzi, flotta, scadenze, guasti): estrarre **un piccolo modulo** (es. `modules/macchine/js/list-utils.js`) con `statoBadge(stato)`, `renderTableMezzi(filtered, columnsConfig)` se la struttura tabella è simile, così si evita di ripetere gli stessi blocchi in 5 file.
- **Effetto**: meno codice duplicato, comportamento uniforme (anche per accessibilità e sicurezza XSS).

### 2.3 `resolvePath` / path verso core e parco-macchine

**Problema**: Nei moduli (vigneto, frutteto, macchine) **ogni view** definisce una propria `resolvePath` o usa path relativi diversi (`'../../../core'`, `'../../parco-macchine'`, ecc.). Esiste già `core/services/path-resolver.js` ma non è usato ovunque.

**Proposta**:
- Standardizzare l’uso di **path-resolver** (o di un suo wrapper da `core/js/` per le view) per tutti gli import dinamici verso core e parco-macchine.
- Le pagine che sono in `modules/X/views/` ricevono il base path da un unico punto (es. da `GFV_CONFIG_BASE` o da `path-resolver`) e non ridefiniscono logiche di path.
- **Effetto**: niente path “magici” sparsi; meno errori quando si spostano file.

---

## 3. File monolitici da spezzare

### 3.1 `tony-widget-standalone.js` → **core/js/tony/** ✅ FATTO (2026-02)

**Stato**: La logica è stata estratta in `core/js/tony/` (main.js, ui.js, engine.js, voice.js). `tony-widget-standalone.js` è il loader. Vedi GUIDA_SVILUPPO_TONY §11. **Ancora da fare**: condizionare i log di debug (es. `window.__TONY_DEBUG`).

**Problema originale** (risolto): Un solo file gestiva UI, voce, coda comandi, parsing, contesto, sync moduli, rotte. Conteneva molti `console.log` di debug.

**Rimane da fare**: condizionare i log di debug (es. dietro `window.__TONY_DEBUG`). L'estrazione in moduli è completata (main, ui, engine, voice):
   - **tony-widget-ui.js**: creazione DOM (FAB, pannello, dialog), gestione open/close, append messaggi, dialog conferma.
   - **tony-widget-voice.js**: STT, TTS, coda audio, modalità continua, timeout, congedo, barge-in.
   - **tony-widget-commands.js**: parsing risposta, coda comandi, `processTonyCommand`, `SET_FIELD` / `OPEN_MODAL` / `INJECT_FORM_DATA` (e relativi helper).
   - **tony-widget-context.js**: `sendRequestWithContext`, costruzione `pageCtx`, currentTableData, moduli, auto-discovery, syncTonyModules, rotte.
3. **tony-widget-standalone.js** diventa un “loader” che importa questi moduli e orchestra init e eventi (ordine di caricamento e dipendenze vanno rispettati, es. form-injector/smart-filler già caricati altrove).
- **Effetto**: file più corti, responsabilità chiare, possibilità di testare voce e comandi in isolamento; manutenzione più semplice.

### 3.2 Dashboard e gestione-lavori (HTML/JS molto lunghi)

**Problema**: `dashboard-standalone.html` e `gestione-lavori-standalone.html` (e relativi JS) sono molto corposi; la dashboard ha già estratto `dashboard-data.js`, `dashboard-sections.js`, `dashboard-controller.js` – pattern da estendere dove possibile.

**Proposta**:
- Per **gestione-lavori**: verificare se ulteriori pezzi (es. mappe zone, dettaglio lavoro, form creazione) possono essere spostati in **moduli JS** dedicati (come già fatto per mappe e eventi), lasciando nell’HTML solo struttura e binding.
- Per le **pagine molto lunghe** (es. potatura, trattamenti vigneto/frutteto): identificare blocchi ripetuti (form, tabella, filtri) e valutare componenti condivisi o template/tag custom (anche senza framework: funzioni che ritornano HTML da template string).
- **Effetto**: file più leggibili e modificabili senza toccare la logica di business.

---

## 4. Ottimizzazioni tecniche

### 4.1 Caricamento script e Tony

- **Lazy load del widget Tony**: invece di iniettare subito CSS + script Tony in ogni pagina, si può caricare lo script Tony **solo al primo click sul FAB** (o al primo focus sulla chat). La prima apertura può mostrare “Caricamento…” e poi inizializzare. **Pro**: riduce tempo di caricamento iniziale e lavoro JS su pagine dove l’utente non usa Tony. **Contro**: piccolo ritardo al primo uso.
- **Un solo punto di init Tony**: oggi il widget fa polling per `getAppInstance()` e poi chiama `Tony.init(app)`. Se lo **standalone-bootstrap** (vedi §2.1) garantisce che Firebase sia pronto prima di inserire lo script Tony, si può ridurre o eliminare il polling e semplificare l’init.

### 4.2 Uso coerente di service-helper e getDb

- **service-helper.js** esiste e standardizza alcuni accessi (macchine, terreni, colture, ecc.), ma molte pagine fanno ancora **import dinamici diretti** verso i servizi. Dove ha senso, conviene **usare service-helper** per letture comuni (es. lista macchine, terreni) così da avere un solo punto per cache, error handling e logging.
- **getDb()** e **getCurrentTenantId()** sono già il pattern corretto; verificare che non restino chiamate che bypassano firebase-service o tenant-service (es. vecchie referenze a `initializeApp` o a `tenantId` “preso da qualche parte”).

### 4.3 CSS ripetuto nelle liste (macchine, prodotti, ecc.)

- Le pagine liste (trattori, attrezzi, flotta, scadenze, guasti, prodotti) hanno **blocchi `<style>` molto simili** (tabella, badge, filtri, modal, bottoni). Si può introdurre un **foglio condiviso** (es. `core/styles/list-views.css` o `modules/macchine/styles/list-views.css`) con classi comuni e includerlo nelle liste; le pagine tengono solo gli stili specifici.
- **Effetto**: meno CSS duplicato, aspetto più uniforme, modifiche di tema in un solo file.

---

## 5. Cosa comporterebbero le modifiche (effetti concreti)

Le modifiche proposte **non** hanno tutte lo stesso tipo di effetto. In sintesi:

### 5.1 Riduzione tempi di caricamento? **Solo in parte**

- **Bootstrap unico, escapeHtml/showAlert condivisi, path-resolver, CSS condiviso, spezzare tony-widget in moduli**:  
  **Non** riducono il tempo di caricamento della pagina. Il browser deve comunque caricare ed eseguire la stessa logica (config, Firebase, Tony, liste, ecc.). Al massimo si risparmiano **qualche decina di KB** togliendo codice duplicato (HTML/JS/CSS ripetuti), ma l’effetto sui tempi è **trascurabile** rispetto a rete e Firebase.

- **Riduzione/rimozione log di debug** in `tony-widget-standalone.js`:  
  Leggera **riduzione del tempo di esecuzione** (meno `console.log`) e file leggermente più piccolo; impatto piccolo ma positivo.

- **Lazy load di Tony** (caricare il widget Tony solo al primo click sul FAB):  
  **Sì, riduzione netta del tempo di caricamento iniziale** sulle pagine dove Tony è incluso. Fino al primo click non si scaricano né si eseguono: `tony-widget-standalone.js`, `tony-form-schemas.js`, `tony-smart-filler.js`, `tony-form-injector.js`, CSS Tony, e l’init (polling, Tony.init). Su connessioni lente o dispositivi deboli la prima paint risulta più veloce. **Contro**: al primo click sul FAB c’è un breve “Caricamento…” prima che la chat sia pronta.

**In sintesi**: la maggior parte delle proposte **non** serve a ridurre i tempi di caricamento; l’unica che incide in modo chiaro è il **lazy load di Tony**.

### 5.2 Cosa comporterebbero davvero le altre modifiche

| Tipo di modifica | Effetto principale | Effetto secondario |
|------------------|--------------------|---------------------|
| **Bootstrap unico** | Meno duplicazione; un solo punto da modificare per init/path. | Meno errori quando si aggiungono pagine; nessun impatto sensibile su caricamento. |
| **escapeHtml / showAlert condivisi** | Codice più uniforme; meno rischio XSS e messaggi incoerenti. | Meno righe duplicate; manutenzione più semplice. |
| **path-resolver ovunque** | Meno path sbagliati quando si spostano file; comportamento più prevedibile. | Nessun effetto su performance. |
| **Spezzare tony-widget in moduli** | File più piccoli e chiari; possibilità di testare voce/comandi separatamente. | Manutenzione e debug più facili; nessun guadagno diretto di velocità (stesso codice totale). |
| **Rimuovere/condizionare log debug** | Meno rumore in console; file leggermente più piccolo. | Leggera riduzione tempo di esecuzione. |
| **CSS condiviso liste** | Un solo file da cambiare per tema liste; meno CSS duplicato. | Cache browser può servire un unico `list-views.css` per tutte le liste; guadagno minimo su caricamento. |
| **Lazy load Tony** | **Riduzione tempo di caricamento iniziale** (Tony non viene caricato finché non serve). | Meno lavoro JS e meno richieste alla prima apertura pagina. |
| **service-helper usato ovunque** | Un solo punto per cache/error handling (se lo si implementa lì). | Potenziale per future ottimizzazioni (es. cache liste); oggi soprattutto coerenza. |

### 5.3 Riepilogo per obiettivo

- **Vuoi ridurre i tempi di caricamento?**  
  → L’intervento che conta è il **lazy load di Tony**. Il resto ha impatto trascurabile o nullo sui tempi.

- **Vuoi meno bug e meno fatica a modificare il codice?**  
  → Bootstrap unico, utils condivisi, path-resolver, spezzare il widget Tony, CSS condiviso: **manutenibilità e coerenza**.

- **Vuoi codice più ordinato e testabile?**  
  → Spezzare tony-widget, rimuovere log debug, uso coerente di service-helper: **qualità del codice**.

---

## 6. Priorità e sforzo stimato (rispetto a manutenibilità / qualità)

| Intervento | Impatto | Sforzo | Priorità |
|------------|--------|--------|----------|
| Bootstrap unico (standalone-bootstrap.js) | Alto (molte pagine) | Medio | Alta |
| Shared escapeHtml + showAlert / uso error-handler | Medio | Basso | Alta |
| Rimozione/condizionamento log debug in tony-widget | Medio | Basso | Alta |
| Spezzare tony-widget in 4–5 moduli | Alto (manutenibilità) | Alto | Media |
| Standardizzare path-resolver ovunque | Medio | Medio | Media |
| CSS condiviso liste (list-views.css) | Medio | Basso | Media |
| list-utils.js per liste Parco Macchine | Medio | Basso | Bassa |
| Lazy load Tony (caricamento al primo click) | Performance | Medio | Bassa |

---

## 7. Cosa evitare (per non complicare)

- **Non** introdurre un framework (React/Vue) solo per “snellire”: il progetto è standalone HTML + ES module e va bene così; eventuali “componenti” possono restare funzioni che ritornano HTML.
- **Non** unificare tutte le standalone in una SPA unica senza una roadmap chiara: il modello “una pagina = un HTML” semplifica deploy e permessi; eventuale SPA andrebbe pianificata a parte.
- **Non** riscrivere tutto in un colpo: meglio **interventi incrementali** (prima bootstrap + utils, poi refactor tony-widget, poi CSS condiviso) con test e verifica dopo ogni passo.

---

## 8. Conclusione

Sì, il codice **si può snellire e ottimizzare** senza cambiare architettura. I punti con miglior rapporto impatto/sforzo sono:

1. **Bootstrap unico** per le pagine standalone (meno duplicazione e un solo punto di init).
2. **Utility condivise** (escapeHtml, showAlert) e uso coerente di error-handler.
3. **Riduzione log di debug** e **suddividere tony-widget-standalone.js** in moduli più piccoli.
4. **Path-resolver** usato ovunque e **CSS condiviso** per le liste.

Procedendo in modo incrementale si riduce duplicazione, si migliora manutenibilità e si prepara il terreno per eventuali ottimizzazioni di caricamento (es. lazy load di Tony).

---

*Documento di proposta – 25 febbraio 2026*

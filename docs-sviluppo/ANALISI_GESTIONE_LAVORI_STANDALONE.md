# 📋 Analisi Completa: gestione-lavori-standalone.html

**Data Analisi**: 2025-01-26  
**File Analizzato**: `core/admin/gestione-lavori-standalone.html`  
**Dimensione**: 4921 righe  
**Stato**: Pronto per Refactoring  
**Obiettivo**: Estrarre logica JavaScript in moduli separati per migliorare manutenibilità

---

## 📊 Panoramica Generale

### Struttura File Attuale

```
gestione-lavori-standalone.html (4921 righe)
├── HTML Structure (righe 1-1040)
│   ├── Header con navigazione
│   ├── Filtri ricerca
│   ├── Container lista lavori
│   ├── Modal crea/modifica lavoro
│   ├── Modal dettaglio lavoro (con tabs)
│   ├── Modal categoria lavoro
│   └── Modal tipo lavoro
│
├── CSS Inline (righe 9-600)
│   └── Stili completi inline
│
└── JavaScript Inline (righe 1085-4921)
    ├── Configurazione Firebase/Google Maps
    ├── Variabili globali
    ├── Caricamento dati
    ├── Rendering UI
    ├── Event handlers
    ├── Google Maps logic (dettaglio mappa)
    ├── Gestione zone lavorate
    ├── Gestione categorie/tipi lavoro
    └── Tour interattivo
```

### Metriche Codice

- **Righe totali**: 4921
- **Righe HTML**: ~1040
- **Righe CSS**: ~600
- **Righe JavaScript**: ~3280
- **Funzioni JavaScript**: 50+ funzioni
- **Variabili globali**: 20+ variabili
- **Event listeners**: 10+ listener

---

## 🔍 Analisi Dettagliata Funzioni

### 1. Funzioni di Configurazione e Inizializzazione

#### `waitForConfig()` (riga 1087)
- **Responsabilità**: Attende caricamento configurazioni Firebase
- **Dipendenze**: Nessuna
- **Usata da**: Inizializzazione principale
- **Modulo target**: Controller (inizializzazione)

#### `setupManodoperaVisibility(hasManodoperaModule)` (riga ~1223)
- **Responsabilità**: Mostra/nasconde funzionalità Manodopera
- **Dipendenze**: DOM elements
- **Modulo target**: Controller (setup)

#### `setupTipoAssegnazioneHandlers()` (riga ~2799)
- **Responsabilità**: Setup handler per tipo assegnazione (squadra/autonomo)
- **Dipendenze**: DOM elements
- **Modulo target**: Events (setup)

#### `setupCategoriaLavoroHandler()` (riga ~1298)
- **Responsabilità**: Setup handler per cambio categoria lavoro
- **Dipendenze**: DOM elements
- **Modulo target**: Events (setup)

---

### 2. Funzioni di Caricamento Dati

#### `loadTerreni()` (riga ~1300)
- **Responsabilità**: Carica lista terreni da Firestore
- **Dipendenze**: `db`, `currentTenantId`, `terreniList` (globale)
- **Modulo target**: Controller

#### `loadCategorieLavori()` (riga ~1350)
- **Responsabilità**: Carica categorie lavori (struttura gerarchica)
- **Dipendenze**: `db`, `currentTenantId`, servizi categorie
- **Modulo target**: Controller
- **Note**: Usa `categorie-service.js` quando disponibile

#### `loadTipiLavoro(categoriaId)` (riga ~1450)
- **Responsabilità**: Carica tipi lavoro (con filtro categoria opzionale)
- **Dipendenze**: `db`, `currentTenantId`, servizi tipi-lavoro
- **Modulo target**: Controller
- **Note**: Usa `tipi-lavoro-service.js` quando disponibile

#### `loadLavori()` (riga ~1600)
- **Responsabilità**: Carica tutti i lavori del tenant da Firestore
- **Dipendenze**: `db`, `currentTenantId`, `lavoriList` (globale)
- **Chiama**: `renderLavori()`
- **Modulo target**: Controller

#### `loadCaposquadra()` (riga ~1700)
- **Responsabilità**: Carica lista caposquadra (solo se Manodopera attivo)
- **Dipendenze**: `db`, `currentTenantId`, `caposquadraList` (globale)
- **Modulo target**: Controller

#### `loadOperai()` (riga ~1750)
- **Responsabilità**: Carica lista operai (solo se Manodopera attivo)
- **Dipendenze**: `db`, `currentTenantId`, `operaiList` (globale)
- **Modulo target**: Controller

#### `loadSquadre()` (riga ~1800)
- **Responsabilità**: Carica lista squadre (solo se Manodopera attivo)
- **Dipendenze**: `db`, `currentTenantId`, `squadreList` (globale)
- **Modulo target**: Controller

#### `loadTrattori()` (riga ~1850)
- **Responsabilità**: Carica lista trattori (solo se Parco Macchine attivo)
- **Dipendenze**: `db`, `currentTenantId`, servizio macchine
- **Modulo target**: Controller
- **Note**: Usa `macchine-service.js` quando disponibile

#### `loadAttrezzi()` (riga ~1900)
- **Responsabilità**: Carica lista attrezzi (solo se Parco Macchine attivo)
- **Dipendenze**: `db`, `currentTenantId`, servizio macchine
- **Modulo target**: Controller
- **Note**: Usa `macchine-service.js` quando disponibile

#### `loadCategorieAttrezzi()` (riga ~1950)
- **Responsabilità**: Carica categorie attrezzi (solo se Parco Macchine attivo)
- **Dipendenze**: `db`, `currentTenantId`
- **Modulo target**: Controller

#### `loadProgressiLavoro(lavoroId)` (riga ~2100)
- **Responsabilità**: Carica progressi lavoro (zone lavorate, superficie, etc.)
- **Dipendenze**: `db`, `currentTenantId`
- **Modulo target**: Controller

#### `initializeCategorieLavori()` (riga ~2200)
- **Responsabilità**: Inizializza categorie lavori predefinite se mancanti
- **Dipendenze**: `db`, `currentTenantId`
- **Modulo target**: Controller

#### `initializeTipiLavoroPredefiniti()` (riga ~2300)
- **Responsabilità**: Inizializza tipi lavoro predefiniti se mancanti
- **Dipendenze**: `db`, `currentTenantId`
- **Modulo target**: Controller

#### `migraCategorieLavoriEsistenti()` (riga ~2400)
- **Responsabilità**: Migra categorie esistenti alla struttura gerarchica
- **Dipendenze**: `db`, `currentTenantId`
- **Modulo target**: Controller

#### `migraDatiEsistenti()` (riga ~2500)
- **Responsabilità**: Migra dati esistenti dalla lista piatta alla struttura gerarchica
- **Dipendenze**: `db`, `currentTenantId`
- **Modulo target**: Controller

---

### 3. Funzioni di Rendering UI

#### `renderLavori()` (riga ~2879)
- **Responsabilità**: Renderizza lista lavori in tabella HTML
- **Dipendenze**: `lavoriList` (globale), `filteredLavoriList` (globale)
- **Chiama**: `loadProgressiLavoro()`, `maybeAutoStartLavoriTour()`
- **Usata da**: `loadLavori()`, `applyFilters()`, `clearFilters()`, `handleSalvaLavoro()`, etc.
- **Modulo target**: Controller
- **Note**: Genera HTML completo della tabella, gestisce lavori in attesa di approvazione

#### `populateTipoLavoroDropdown(categoriaId, sottocategoriaId, tipiLavoroFiltrati)` (riga ~2700)
- **Responsabilità**: Popola dropdown tipi lavoro nel form
- **Dipendenze**: `tipiLavoroList` (globale), DOM elements
- **Usata da**: `loadTipiLavoro()`, `openCreaModal()`, `openModificaModal()`
- **Modulo target**: Controller (UI helper)

---

### 4. Funzioni di Filtri e Ricerca

#### `applyFilters()` (riga 2844) - `window.applyFilters`
- **Responsabilità**: Applica filtri alla lista lavori
- **Dipendenze**: `lavoriList` (globale), DOM elements filtri
- **Chiama**: `renderLavori()`
- **Usata da**: Event listener `onchange` su filtri
- **Modulo target**: Controller/Events
- **Note**: Esposta su `window` per accesso da HTML

#### `clearFilters()` (riga 2866) - `window.clearFilters`
- **Responsabilità**: Resetta filtri e mostra tutti i lavori
- **Dipendenze**: DOM elements filtri, `lavoriList` (globale)
- **Chiama**: `applyFilters()`
- **Usata da**: Bottone "Pulisci Filtri"
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

---

### 5. Funzioni Event Handlers (Modal e Form)

#### `openCreaModal()` (riga 3188) - `window.openCreaModal`
- **Responsabilità**: Apre modal per creare nuovo lavoro
- **Dipendenze**: `loadTipiLavoro()`, `populateTipoLavoroDropdown()`, DOM elements
- **Chiama**: 
  - `loadTipiLavoro()` (ricarica tipi)
  - `populateTipoLavoroDropdown()`
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

#### `openModificaModal(lavoroId)` (riga 3242) - `window.openModificaModal`
- **Responsabilità**: Apre modal in modalità modifica
- **Dipendenze**: `lavoriList` (globale), `loadTipiLavoro()`, `populateTipoLavoroDropdown()`
- **Chiama**: `loadTipiLavoro()`, `populateTipoLavoroDropdown()`
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

#### `closeLavoroModal()` (riga 3334) - `window.closeLavoroModal`
- **Responsabilità**: Chiude modal e pulisce stato
- **Dipendenze**: `currentLavoroId` (globale), DOM elements
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

#### `handleSalvaLavoro(event)` (riga 3340) - `window.handleSalvaLavoro`
- **Responsabilità**: Gestisce salvataggio lavoro (crea/modifica)
- **Dipendenze**: `currentTenantId` (globale), `currentLavoroId` (globale), DOM form elements
- **Chiama**: `showAlert()`, `renderLavori()`, `closeLavoroModal()`
- **Modulo target**: Events
- **Note**: 
  - Esposta su `window` per accesso da HTML
  - Gestisce validazione form
  - Gestisce assegnazione flessibile (squadra/autonomo)
  - Gestisce macchine (se Parco Macchine attivo)

#### `openEliminaModal(lavoroId)` (riga 3586) - `window.openEliminaModal`
- **Responsabilità**: Apre modal conferma eliminazione
- **Dipendenze**: `lavoriList` (globale)
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

#### `approvaLavoro(lavoroId)` (riga 3731) - `window.approvaLavoro`
- **Responsabilità**: Approva lavoro completato
- **Dipendenze**: `db`, `currentTenantId`, `lavoriList` (globale)
- **Chiama**: `showAlert()`, `renderLavori()`
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

#### `rifiutaLavoro(lavoroId)` (riga 3791) - `window.rifiutaLavoro`
- **Responsabilità**: Rifiuta lavoro completato
- **Dipendenze**: `db`, `currentTenantId`, `lavoriList` (globale)
- **Chiama**: `showAlert()`, `renderLavori()`
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

#### `openDettaglioModal(lavoroId)` (riga 3949) - `window.openDettaglioModal`
- **Responsabilità**: Apre modal dettaglio lavoro (con tabs)
- **Dipendenze**: `lavoriList` (globale), `loadDettaglioOverview()`, `loadDettaglioMap()`
- **Chiama**: `loadDettaglioOverview()`, `switchTab()`
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

#### `closeDettaglioModal()` (riga 3969) - `window.closeDettaglioModal`
- **Responsabilità**: Chiude modal dettaglio
- **Dipendenze**: DOM elements, `dettaglioMap` (globale)
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

#### `switchTab(tabName)` (riga 3983) - `window.switchTab`
- **Responsabilità**: Cambia tab nel modal dettaglio
- **Dipendenze**: DOM elements
- **Chiama**: `loadDettaglioOverview()`, `loadDettaglioMap()`
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

---

### 6. Funzioni Dettaglio Lavoro

#### `loadDettaglioOverview(lavoroId)` (riga 4000)
- **Responsabilità**: Carica e renderizza tab Overview del dettaglio
- **Dipendenze**: `lavoriList` (globale), `loadProgressiLavoro()`
- **Modulo target**: Controller

#### `loadDettaglioMap(lavoroId)` (riga 4106)
- **Responsabilità**: Carica e renderizza tab Mappa del dettaglio con zone lavorate
- **Dipendenze**: `lavoriList` (globale), `terreniList` (globale), Google Maps API
- **Chiama**: `filtraZonePerData()`, `mostraZoneSullaMappa()`, `aggiornaListaZone()`
- **Modulo target**: Maps
- **Note**: Gestisce visualizzazione zone lavorate sulla mappa

#### `filtraZonePerData(data)` (riga ~4256)
- **Responsabilità**: Filtra zone lavorate per data
- **Dipendenze**: `allZoneLavorate` (globale), `zonePerData` (globale)
- **Chiama**: `mostraZoneSullaMappa()`, `aggiornaListaZone()`
- **Modulo target**: Maps

#### `mostraZoneSullaMappa(zone)` (riga ~4272)
- **Responsabilità**: Disegna zone lavorate sulla mappa
- **Dipendenze**: `dettaglioMap` (globale), `dettaglioMapPolygons` (globale)
- **Modulo target**: Maps

#### `aggiornaListaZone(zone)` (riga ~4323)
- **Responsabilità**: Aggiorna lista zone nel tab Mappa
- **Dipendenze**: DOM elements
- **Modulo target**: Maps

#### `aggiornaInfoZoneFiltrate(zone)` (riga ~4382)
- **Responsabilità**: Aggiorna info zone filtrate
- **Dipendenze**: DOM elements
- **Modulo target**: Maps

#### `mostraTutteLeZone()` (riga 4412) - `window.mostraTutteLeZone`
- **Responsabilità**: Mostra tutte le zone (rimuove filtro data)
- **Dipendenze**: `allZoneLavorate` (globale)
- **Chiama**: `mostraZoneSullaMappa()`, `aggiornaListaZone()`
- **Modulo target**: Maps
- **Note**: Esposta su `window` per accesso da HTML

---

### 7. Funzioni Gestione Categorie/Tipi Lavoro

#### `openCategoriaLavoroModal()` (riga ~4600)
- **Responsabilità**: Apre modal crea categoria lavoro
- **Dipendenze**: DOM elements
- **Modulo target**: Events
- **Note**: Esposta su `window`

#### `closeCategoriaLavoroModal()` (riga ~4650)
- **Responsabilità**: Chiude modal categoria
- **Dipendenze**: DOM elements
- **Modulo target**: Events
- **Note**: Esposta su `window`

#### `handleSalvaCategoriaLavoro(event)` (riga ~4700)
- **Responsabilità**: Gestisce salvataggio categoria lavoro
- **Dipendenze**: `db`, `currentTenantId`, DOM form elements
- **Chiama**: `loadCategorieLavori()`, `showAlert()`
- **Modulo target**: Events
- **Note**: Esposta su `window`

#### `openTipoLavoroModal()` (riga ~4750)
- **Responsabilità**: Apre modal crea tipo lavoro
- **Dipendenze**: DOM elements, `categorieLavoriPrincipali` (globale)
- **Modulo target**: Events
- **Note**: Esposta su `window`

#### `closeTipoLavoroModal()` (riga ~4800)
- **Responsabilità**: Chiude modal tipo lavoro
- **Dipendenze**: DOM elements
- **Modulo target**: Events
- **Note**: Esposta su `window`

#### `handleSalvaTipoLavoro(event)` (riga ~4850)
- **Responsabilità**: Gestisce salvataggio tipo lavoro
- **Dipendenze**: `db`, `currentTenantId`, DOM form elements
- **Chiama**: `loadTipiLavoro()`, `showAlert()`
- **Modulo target**: Events
- **Note**: Esposta su `window`

---

### 8. Funzioni Utility

#### `showAlert(message, type)` (riga ~2000)
- **Responsabilità**: Mostra alert temporaneo all'utente
- **Dipendenze**: DOM element alert container
- **Usata da**: Molte funzioni
- **Modulo target**: Utils
- **Note**: Utility generica, riutilizzabile

#### `escapeHtml(text)` (riga ~2050)
- **Responsabilità**: Escape caratteri HTML per sicurezza
- **Dipendenze**: Nessuna
- **Usata da**: `renderLavori()`, `loadDettaglioOverview()`
- **Modulo target**: Utils
- **Note**: Utility generica, riutilizzabile

#### `getStatoFormattato(stato)` (riga ~2100)
- **Responsabilità**: Formatta stato lavoro per visualizzazione
- **Dipendenze**: Nessuna
- **Usata da**: `renderLavori()`, `loadDettaglioOverview()`
- **Modulo target**: Utils

#### `calcolaStatoProgresso(lavoro)` (riga ~2200)
- **Responsabilità**: Calcola stato progresso lavoro (in_anticipo/in_tempo/in_ritardo)
- **Dipendenze**: Nessuna
- **Usata da**: `renderLavori()`
- **Modulo target**: Utils

---

### 9. Funzioni Tour Interattivo

#### `setupLavoriTourButton()` (riga ~4746)
- **Responsabilità**: Setup bottone tour e event listener
- **Dipendenze**: DOM element tour button
- **Chiama**: `startLavoriTour(true)`
- **Modulo target**: Tour
- **Note**: Chiamata all'inizializzazione

#### `maybeAutoStartLavoriTour()` (riga ~4750)
- **Responsabilità**: Avvia tour automaticamente se utente non l'ha mai visto
- **Dipendenze**: `localStorage`, `LAVORI_TOUR_STORAGE_KEY` (globale), `lavoriTourAutoRequested` (globale)
- **Chiama**: `startLavoriTour(false)`
- **Usata da**: `renderLavori()`
- **Modulo target**: Tour
- **Note**: Auto-start dopo 2 secondi

#### `startLavoriTour(triggeredManually)` (riga ~4760)
- **Responsabilità**: Avvia tour interattivo
- **Dipendenze**: `introJs`, DOM elements, `openCreaModal()`, `closeLavoroModal()`, `buildLavoriTourSteps()`
- **Chiama**: 
  - `openCreaModal()` (se modal non aperto)
  - `buildLavoriTourSteps()`
  - `closeLavoroModal()` (se aperto per tour)
- **Modulo target**: Tour
- **Note**: Gestisce apertura/chiusura modal durante tour

#### `buildLavoriTourSteps()` (riga 5095)
- **Responsabilità**: Costruisce array step per tour
- **Dipendenze**: DOM elements con `data-tour-section`
- **Usata da**: `startLavoriTour()`
- **Modulo target**: Tour
- **Note**: Definisce tutti gli step del tour

---

## 📦 Variabili Globali

### Variabili Dati
```javascript
let terreniList = [];                    // Array tutti i terreni
let caposquadraList = [];                // Array caposquadra (solo se Manodopera)
let operaiList = [];                     // Array operai (solo se Manodopera)
let squadreList = [];                    // Array squadre (solo se Manodopera)
let lavoriList = [];                     // Array tutti i lavori
let filteredLavoriList = [];             // Array lavori filtrati
let trattoriList = [];                   // Array trattori (solo se Parco Macchine)
let attrezziList = [];                   // Array attrezzi (solo se Parco Macchine)
let categorieAttrezziList = [];          // Array categorie attrezzi (solo se Parco Macchine)
let categorieLavoriPrincipali = [];      // Array categorie lavori principali
let sottocategorieLavoriMap = new Map(); // parentId -> Array<sottocategorie>
let tipiLavoroList = [];                 // Array tipi lavoro
```

### Variabili Stato
```javascript
let currentUserData = null;              // Dati utente corrente
let currentTenantId = null;              // ID tenant corrente
let currentLavoroId = null;              // ID lavoro in modifica
let hasParcoMacchineModule = false;      // Flag modulo Parco Macchine
let hasManodoperaModule = false;         // Flag modulo Manodopera
let hasContoTerziModule = false;         // Flag modulo Conto Terzi
```

### Variabili Google Maps (Dettaglio)
```javascript
let dettaglioMap = null;                 // Istanza Google Map (dettaglio)
let dettaglioMapMarkers = [];            // Array markers mappa dettaglio
let dettaglioMapPolygons = [];           // Array poligoni mappa dettaglio
let allZoneLavorate = [];                // Array tutte le zone lavorate
let zonePerData = {};                    // Oggetto {dataKey: [zone]}
let dateDisponibili = [];                // Array date disponibili per filtro
```

### Variabili Tour
```javascript
const LAVORI_TOUR_STORAGE_KEY = 'gfv_lavori_tour_v1';
let lavoriTourAutoRequested = false;
let lavoriTourOpenedModal = false;
```

### Istanze Firebase
```javascript
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
```

---

## 🎯 Piano di Estrazione Moduli

### Modulo 1: `core/admin/js/gestione-lavori-controller.js`

**Responsabilità**: Logica principale e coordinamento

**Funzioni da Estrarre**:
- `waitForConfig()` - Inizializzazione
- `setupManodoperaVisibility()` - Setup visibilità moduli
- `loadTerreni()` - Caricamento dati
- `loadCategorieLavori()` - Caricamento dati
- `loadTipiLavoro()` - Caricamento dati
- `loadLavori()` - Caricamento dati principale
- `loadCaposquadra()` - Caricamento dati (solo se Manodopera)
- `loadOperai()` - Caricamento dati (solo se Manodopera)
- `loadSquadre()` - Caricamento dati (solo se Manodopera)
- `loadTrattori()` - Caricamento dati (solo se Parco Macchine)
- `loadAttrezzi()` - Caricamento dati (solo se Parco Macchine)
- `loadCategorieAttrezzi()` - Caricamento dati (solo se Parco Macchine)
- `loadProgressiLavoro()` - Caricamento progressi
- `initializeCategorieLavori()` - Inizializzazione
- `initializeTipiLavoroPredefiniti()` - Inizializzazione
- `migraCategorieLavoriEsistenti()` - Migrazione
- `migraDatiEsistenti()` - Migrazione
- `renderLavori()` - Rendering UI
- `populateTipoLavoroDropdown()` - UI helper
- `loadDettaglioOverview()` - Rendering dettaglio
- `applyFilters()` - Filtri (può andare in Events)
- `clearFilters()` - Filtri (può andare in Events)

**Variabili Globali da Gestire**:
- `lavoriList`, `filteredLavoriList`
- `terreniList`, `caposquadraList`, `operaiList`, `squadreList`
- `trattoriList`, `attrezziList`, `categorieAttrezziList`
- `categorieLavoriPrincipali`, `sottocategorieLavoriMap`, `tipiLavoroList`
- `currentTenantId`, `hasParcoMacchineModule`, `hasManodoperaModule`, `hasContoTerziModule`

**Dipendenze Esterne**:
- Firebase (`db`, `auth`)
- Servizi: `tenant-service.js`, `categorie-service.js`, `tipi-lavoro-service.js`, `macchine-service.js`
- Utils: `escapeHtml()`, `getStatoFormattato()`, `calcolaStatoProgresso()`
- Events: `maybeAutoStartLavoriTour()` (per chiamare dopo render)

---

### Modulo 2: `core/admin/js/gestione-lavori-events.js`

**Responsabilità**: Gestione event handlers per modal e form

**Funzioni da Estrarre**:
- `setupTipoAssegnazioneHandlers()` - Setup handler
- `setupCategoriaLavoroHandler()` - Setup handler
- `openCreaModal()` - `window.openCreaModal`
- `openModificaModal(lavoroId)` - `window.openModificaModal`
- `closeLavoroModal()` - `window.closeLavoroModal`
- `handleSalvaLavoro(event)` - `window.handleSalvaLavoro`
- `openEliminaModal(lavoroId)` - `window.openEliminaModal`
- `approvaLavoro(lavoroId)` - `window.approvaLavoro`
- `rifiutaLavoro(lavoroId)` - `window.rifiutaLavoro`
- `openDettaglioModal(lavoroId)` - `window.openDettaglioModal`
- `closeDettaglioModal()` - `window.closeDettaglioModal`
- `switchTab(tabName)` - `window.switchTab`
- `openCategoriaLavoroModal()` - `window.openCategoriaLavoroModal`
- `closeCategoriaLavoroModal()` - `window.closeCategoriaLavoroModal`
- `handleSalvaCategoriaLavoro(event)` - `window.handleSalvaCategoriaLavoro`
- `openTipoLavoroModal()` - `window.openTipoLavoroModal`
- `closeTipoLavoroModal()` - `window.closeTipoLavoroModal`
- `handleSalvaTipoLavoro(event)` - `window.handleSalvaTipoLavoro`

**Variabili Globali da Gestire**:
- `currentLavoroId`

**Dipendenze Esterne**:
- Controller: `loadTipiLavoro()`, `populateTipoLavoroDropdown()`, `renderLavori()`, `loadDettaglioOverview()`, `loadDettaglioMap()`
- Utils: `showAlert()`
- Firebase: `db`, `currentTenantId`

---

### Modulo 3: `core/admin/js/gestione-lavori-maps.js`

**Responsabilità**: Logica Google Maps per dettaglio lavori e zone lavorate

**Funzioni da Estrarre**:
- `loadDettaglioMap(lavoroId)` - Carica e inizializza mappa dettaglio
- `filtraZonePerData(data)` - Filtra zone per data
- `mostraZoneSullaMappa(zone)` - Disegna zone sulla mappa
- `aggiornaListaZone(zone)` - Aggiorna lista zone
- `aggiornaInfoZoneFiltrate(zone)` - Aggiorna info zone filtrate
- `mostraTutteLeZone()` - `window.mostraTutteLeZone`

**Variabili Globali da Gestire**:
- `dettaglioMap`
- `dettaglioMapMarkers`
- `dettaglioMapPolygons`
- `allZoneLavorate`
- `zonePerData`
- `dateDisponibili`

**Dipendenze Esterne**:
- Controller: `lavoriList`, `terreniList`
- Google Maps API: `google.maps`, `google.maps.geometry`
- DOM: elementi mappa

---

### Modulo 4: `core/admin/js/gestione-lavori-tour.js`

**Responsabilità**: Tour interattivo con IntroJS

**Funzioni da Estrarre**:
- `setupLavoriTourButton()` - Setup bottone tour
- `maybeAutoStartLavoriTour()` - Auto-start tour
- `startLavoriTour(triggeredManually)` - Avvia tour
- `buildLavoriTourSteps()` - Costruisce array step (funzione interna)

**Variabili Globali da Gestire**:
- `LAVORI_TOUR_STORAGE_KEY`
- `lavoriTourAutoRequested`
- `lavoriTourOpenedModal`

**Dipendenze Esterne**:
- Events: `openCreaModal()`, `closeLavoroModal()`
- IntroJS: `introJs`
- DOM: elementi con `data-tour-section`

---

### Modulo 5: `core/admin/js/gestione-lavori-utils.js`

**Responsabilità**: Funzioni utility generiche e specifiche

**Funzioni da Estrarre**:
- `showAlert(message, type)` - Mostra alert temporaneo
- `escapeHtml(text)` - Escape caratteri HTML per sicurezza
- `getStatoFormattato(stato)` - Formatta stato lavoro per visualizzazione
- `calcolaStatoProgresso(lavoro)` - Calcola stato progresso lavoro

**Note**:
- Funzioni pure (senza side effects, tranne `showAlert` che accede al DOM)

---

## 🏗️ Scelte Architetturali e Motivazioni

### 1. Pattern State Object + Update Function (come Terreni)

**Scelta**: Le funzioni dei moduli Maps ed Events accettano un `state` object e una funzione `updateState` invece di modificare variabili globali direttamente.

**Motivazioni**:
- ✅ **Testabilità**: Si può passare uno state mock per i test
- ✅ **Controllo**: Il file HTML controlla come lo state viene aggiornato
- ✅ **Compatibilità**: Lo state può essere un wrapper delle variabili globali esistenti
- ✅ **Flessibilità**: Facile passare a un sistema di state management più avanzato in futuro

---

### 2. Pattern Callback per Comunicazione tra Moduli

**Scelta**: I moduli Events e Tour accettano callback invece di importare direttamente altri moduli.

**Motivazioni**:
- ✅ **Evita Dipendenze Circolari**: Events non dipende da Controller, Controller non dipende da Events
- ✅ **Moduli Indipendenti**: Ogni modulo può essere testato isolatamente
- ✅ **Controllo Centralizzato**: Il file HTML coordina tutti i moduli
- ✅ **Flessibilità**: Facile cambiare l'ordine di esecuzione o aggiungere logica extra

---

### 3. Mantenimento Variabili Globali per Compatibilità

**Scelta**: Manteniamo le variabili globali esistenti per compatibilità con codice che le usa direttamente (es. attributi HTML `onclick`, callback Google Maps).

**Motivazioni**:
- ✅ **Compatibilità**: Il codice esistente che usa `window.openCreaModal()` continua a funzionare
- ✅ **Gradualità**: Possiamo migrare gradualmente senza rompere tutto
- ✅ **Callback Esterni**: Google Maps e altri servizi esterni si aspettano funzioni globali

---

## 📊 Risultato Atteso

### Prima
- `gestione-lavori-standalone.html`: 4921 righe (tutto inline)

### Dopo
- `gestione-lavori-standalone.html`: ~1000-1200 righe (HTML + CSS + inizializzazione + wrapper)
- `core/admin/js/gestione-lavori-controller.js`: ~800-1000 righe
- `core/admin/js/gestione-lavori-events.js`: ~600-800 righe
- `core/admin/js/gestione-lavori-maps.js`: ~500-600 righe
- `core/admin/js/gestione-lavori-tour.js`: ~300-400 righe
- `core/admin/js/gestione-lavori-utils.js`: ~150-200 righe

**Totale**: Stesso codice, meglio organizzato in 6 file invece di 1.

---

## 🚀 Ordine di Esecuzione Consigliato

1. **Controller** (base, altre funzioni dipendono)
2. **Utils** (usato da altri moduli)
3. **Maps** (indipendente, può essere fatto in parallelo)
4. **Events** (dipende da Controller e Maps)
5. **Tour** (dipende da Events)

---

## ✅ Criteri di Completamento

Il refactoring è completo quando:

1. ✅ Tutti i 5 moduli sono stati creati
2. ✅ Tutte le funzioni sono state estratte
3. ✅ File HTML è pulito e leggibile
4. ✅ Tutte le funzionalità funzionano
5. ✅ Nessun errore in console
6. ✅ Test completi passati
7. ✅ Codice documentato

---

**Data Creazione**: 2025-01-26  
**Versione**: 1.0  
**Stato**: ✅ Analisi Completa - Pronto per Estrazione




# 📋 Analisi Completa: terreni-standalone.html

**Data Analisi**: 2025-01-26  
**File Analizzato**: `core/terreni-standalone.html`  
**Dimensione**: 3106 righe  
**Stato**: Pronto per Refactoring  
**Obiettivo**: Estrarre logica JavaScript in moduli separati per migliorare manutenibilità

---

## 📊 Panoramica Generale

### Struttura File Attuale

```
terreni-standalone.html (3106 righe)
├── HTML Structure (righe 1-680)
│   ├── Header con navigazione
│   ├── Filtri ricerca
│   ├── Container lista terreni
│   └── Modal crea/modifica terreno
│
├── CSS Inline (righe 11-533)
│   └── Stili completi inline
│
└── JavaScript Inline (righe 707-3087)
    ├── Configurazione Firebase/Google Maps
    ├── Variabili globali
    ├── Funzioni helper
    ├── Caricamento dati
    ├── Rendering UI
    ├── Event handlers
    ├── Google Maps logic
    └── Tour interattivo
```

### Metriche Codice

- **Righe totali**: 3106
- **Righe HTML**: ~680
- **Righe CSS**: ~523
- **Righe JavaScript**: ~1880
- **Funzioni JavaScript**: 49 funzioni
- **Variabili globali**: 12 variabili
- **Event listeners**: 8+ listener

---

## 🔍 Analisi Dettagliata Funzioni

### 1. Funzioni di Configurazione e Inizializzazione

#### `waitForConfig()` (riga 709)
- **Responsabilità**: Attende caricamento configurazioni Firebase e Google Maps
- **Dipendenze**: Nessuna
- **Usata da**: Inizializzazione principale
- **Modulo target**: Controller (inizializzazione)

#### `getTenantId(userId)` (riga 845)
- **Responsabilità**: Recupera tenant ID dall'utente
- **Dipendenze**: `db`, `currentTenantId` (globale)
- **Usata da**: `loadTerreni()`
- **Modulo target**: Controller (helper)

#### `getTerreniCollection(tenantId)` (riga 862)
- **Responsabilità**: Ottiene riferimento collection Firestore terreni
- **Dipendenze**: `db`
- **Usata da**: `loadTerreni()`, `handleSaveTerreno()`, `confirmDeleteTerreno()`
- **Modulo target**: Controller (helper)

---

### 2. Funzioni di Caricamento Dati

#### `loadPoderi()` (riga 930)
- **Responsabilità**: Carica lista poderi da Firestore
- **Dipendenze**: `db`, `currentTenantId`, `poderi` (globale)
- **Chiama**: `populatePoderiDropdown()`
- **Modulo target**: Controller
- **Note**: Usa servizi centralizzati quando possibile

#### `populatePoderiDropdown()` (riga 956)
- **Responsabilità**: Popola dropdown poderi nel form
- **Dipendenze**: `poderi` (globale), DOM element `terreno-podere`
- **Usata da**: `loadPoderi()`, `openTerrenoModal()`
- **Modulo target**: Controller (UI helper)

#### `initializeColturePredefiniteTerreni()` (riga 977)
- **Responsabilità**: Inizializza colture predefinite se mancanti
- **Dipendenze**: `db`, `currentTenantId`, servizi categorie/colture
- **Usata da**: `loadCategorieColtureTerreni()`
- **Modulo target**: Controller
- **Note**: Usa servizi centralizzati quando possibile

#### `loadCategorieColtureTerreni()` (riga 1097)
- **Responsabilità**: Carica categorie colture (con fallback file://)
- **Dipendenze**: `db`, `currentTenantId`, servizi categorie
- **Chiama**: `initializeColturePredefiniteTerreni()` se necessario
- **Modulo target**: Controller
- **Note**: Usa `categorie-service.js` quando disponibile

#### `loadColturePerCategoriaTerreni()` (riga 1161)
- **Responsabilità**: Carica colture per categoria selezionata
- **Dipendenze**: `db`, `currentTenantId`, servizi colture
- **Modulo target**: Controller
- **Note**: Usa `colture-service.js` quando disponibile

#### `updateColtureDropdownTerreni()` (riga 1284)
- **Responsabilità**: Aggiorna dropdown colture quando cambia categoria
- **Dipendenze**: `colturePerCategoriaTerreni` (globale), DOM elements
- **Chiama**: `getColturaColor()`
- **Usata da**: Event listener `onchange` su `terreno-coltura-categoria`
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

#### `setupColturaColorListener()` (riga 1340)
- **Responsabilità**: Setup listener per aggiornare colore poligono quando cambia coltura
- **Dipendenze**: DOM element `terreno-coltura`
- **Modulo target**: Events

#### `loadColture()` (riga 1356)
- **Responsabilità**: Wrapper per caricare categorie e colture
- **Dipendenze**: `loadCategorieColtureTerreni()`, `loadColturePerCategoriaTerreni()`
- **Usata da**: `onAuthStateChanged`, `openTerrenoModal()`
- **Modulo target**: Controller

#### `loadTerreni()` (riga 1362)
- **Responsabilità**: Carica tutti i terreni del tenant da Firestore
- **Dipendenze**: `db`, `currentTenantId`, `getTenantId()`, `getTerreniCollection()`
- **Chiama**: `renderTerreni()`
- **Modulo target**: Controller
- **Note**: 
  - Filtra terreni clienti (esclude `clienteId`)
  - Calcola superficie da mappa se mancante
  - Aggiorna automaticamente superficie nel DB se calcolata

---

### 3. Funzioni di Rendering UI

#### `renderTerreni()` (riga 1542)
- **Responsabilità**: Renderizza lista terreni in tabella HTML
- **Dipendenze**: `terreni` (globale), `terreniFiltrati` (globale)
- **Chiama**: `escapeHtml()`, `calcolaAlertAffitto()`, `formattaDataScadenza()`, `maybeAutoStartTerreniTour()`
- **Usata da**: `loadTerreni()`, `filterTerreni()`, `clearFilters()`, `handleSaveTerreno()`, `confirmDeleteTerreno()`
- **Modulo target**: Controller
- **Note**: Genera HTML completo della tabella

#### `populatePoderiDropdown()` (già descritta sopra)

---

### 4. Funzioni di Filtri e Ricerca

#### `filterTerreni()` (riga 1506) - `window.filterTerreni`
- **Responsabilità**: Filtra terreni per tipo possesso e alert scadenza
- **Dipendenze**: `terreni` (globale), DOM elements filtri
- **Chiama**: `calcolaAlertAffitto()`, `renderTerreni()`
- **Usata da**: Event listener `onchange` su filtri
- **Modulo target**: Controller/Events
- **Note**: Esposta su `window` per accesso da HTML

#### `clearFilters()` (riga 1534) - `window.clearFilters`
- **Responsabilità**: Resetta filtri e mostra tutti i terreni
- **Dipendenze**: DOM elements filtri, `terreni` (globale)
- **Chiama**: `renderTerreni()`
- **Usata da**: Bottone "Pulisci Filtri"
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

---

### 5. Funzioni Event Handlers (Modal e Form)

#### `openTerrenoModal(terrenoId)` (riga 2356) - `window.openTerrenoModal`
- **Responsabilità**: Apre modal per creare/modificare terreno
- **Dipendenze**: `currentTerrenoId` (globale), `terreni` (globale), `loadColture()`, `populatePoderiDropdown()`, `updateColtureDropdownTerreni()`, `toggleDataScadenzaAffitto()`, `initMap()`, `loadExistingPolygon()`
- **Chiama**: 
  - `loadColture()` (ricarica colture)
  - `populatePoderiDropdown()`
  - `updateColtureDropdownTerreni()` (se modifica)
  - `toggleDataScadenzaAffitto()`
  - `initMap()` (se Google Maps disponibile)
  - `loadExistingPolygon()` (se modifica terreno con mappa)
- **Modulo target**: Events
- **Note**: 
  - Esposta su `window` per accesso da HTML
  - Gestisce sia creazione che modifica
  - Precompila form se modifica

#### `closeTerrenoModal()` (riga 2470) - `window.closeTerrenoModal`
- **Responsabilità**: Chiude modal e pulisce stato
- **Dipendenze**: `polygon` (globale), `map` (globale), `currentPolygonCoords` (globale), `isDrawing` (globale), `currentTerrenoId` (globale)
- **Modulo target**: Events
- **Note**: 
  - Esposta su `window` per accesso da HTML
  - Pulisce mappa e poligono

#### `handleSaveTerreno(e)` (riga 2488) - `window.handleSaveTerreno`
- **Responsabilità**: Gestisce salvataggio terreno (crea/modifica)
- **Dipendenze**: `currentTenantId` (globale), `currentTerrenoId` (globale), `currentPolygonCoords` (globale), `getTerreniCollection()`, DOM form elements
- **Chiama**: `showAlert()`, `renderTerreni()`, `closeTerrenoModal()`
- **Modulo target**: Events
- **Note**: 
  - Esposta su `window` per accesso da HTML
  - Gestisce validazione form
  - Calcola superficie da mappa se presente
  - Gestisce campi affitto condizionali

#### `editTerreno(terrenoId)` (riga 2594) - `window.editTerreno`
- **Responsabilità**: Apre modal in modalità modifica
- **Dipendenze**: `openTerrenoModal()`
- **Chiama**: `openTerrenoModal(terrenoId)`
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

#### `confirmDeleteTerreno(terrenoId)` (riga 2599) - `window.confirmDeleteTerreno`
- **Responsabilità**: Conferma ed elimina terreno
- **Dipendenze**: `db`, `currentTenantId`, `getTerreniCollection()`, `terreni` (globale)
- **Chiama**: `showAlert()`, `renderTerreni()`
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

#### `toggleDataScadenzaAffitto()` (riga 2691) - `window.toggleDataScadenzaAffitto`
- **Responsabilità**: Mostra/nasconde campi affitto in base a tipo possesso
- **Dipendenze**: DOM elements form
- **Modulo target**: Events
- **Note**: Esposta su `window` per accesso da HTML

---

### 6. Funzioni Utility

#### `showAlert(message, type)` (riga 2665)
- **Responsabilità**: Mostra alert temporaneo all'utente
- **Dipendenze**: DOM element `alert-container`
- **Usata da**: `handleSaveTerreno()`, `confirmDeleteTerreno()`, `searchLocation()`
- **Modulo target**: Utils
- **Note**: Utility generica, riutilizzabile

#### `escapeHtml(text)` (riga 2678)
- **Responsabilità**: Escape caratteri HTML per sicurezza
- **Dipendenze**: Nessuna
- **Usata da**: `renderTerreni()`
- **Modulo target**: Utils
- **Note**: Utility generica, riutilizzabile

#### `calcolaAlertAffitto(dataScadenza)` (riga 2711)
- **Responsabilità**: Calcola colore e testo alert scadenza affitto
- **Dipendenze**: Nessuna
- **Usata da**: `renderTerreni()`, `filterTerreni()`
- **Modulo target**: Utils
- **Note**: Logica business specifica terreni

#### `formattaDataScadenza(data)` (riga 2742)
- **Responsabilità**: Formatta data scadenza per visualizzazione
- **Dipendenze**: Nessuna
- **Usata da**: `renderTerreni()`
- **Modulo target**: Utils
- **Note**: Utility formattazione date

#### `mapColturaToColorCategory(colturaNome, colturaCategoria)` (riga 2765)
- **Responsabilità**: Mappa nome coltura a categoria colore generica
- **Dipendenze**: Nessuna
- **Usata da**: `getColturaColor()`
- **Modulo target**: Utils/Maps
- **Note**: Logica mapping colori colture

#### `getColturaColor()` (riga 2855)
- **Responsabilità**: Ottiene colore coltura selezionata per poligono mappa
- **Dipendenze**: DOM element `terreno-coltura`, `mapColturaToColorCategory()`
- **Usata da**: `updateColtureDropdownTerreni()`, `initMap()`, `loadExistingPolygon()`
- **Modulo target**: Maps/Utils
- **Note**: Usato per colorare poligono mappa

---

### 7. Funzioni Google Maps

#### `initMap()` (riga 2870) - `window.initMap`
- **Responsabilità**: Inizializza Google Maps nel container
- **Dipendenze**: `window.googleMapsReady`, `google.maps`, DOM element `map`, `getColturaColor()`, `updateAreaInfo()`
- **Chiama**: `updateAreaInfo()` (via listener)
- **Usata da**: `openTerrenoModal()`, callback Google Maps
- **Modulo target**: Maps
- **Note**: 
  - Esposta su `window` per callback Google Maps
  - Setup listener click per tracciamento
  - Setup listener modifiche poligono

#### `searchLocation()` (riga 2941) - `window.searchLocation`
- **Responsabilità**: Cerca indirizzo e centra mappa
- **Dipendenze**: `map`, `google.maps.Geocoder`, DOM element `map-search`, `showAlert()`
- **Modulo target**: Maps
- **Note**: Esposta su `window` per accesso da HTML

#### `toggleDrawing()` (riga 2969) - `window.toggleDrawing`
- **Responsabilità**: Attiva/disattiva modalità tracciamento poligono
- **Dipendenze**: `map`, `polygon` (globale), `isDrawing` (globale), `currentPolygonCoords` (globale), DOM elements
- **Chiama**: `clearPolygon()` (implicitamente)
- **Modulo target**: Maps
- **Note**: Esposta su `window` per accesso da HTML

#### `clearPolygon()` (riga 2993) - `window.clearPolygon`
- **Responsabilità**: Cancella poligono tracciato
- **Dipendenze**: `polygon` (globale), `currentPolygonCoords` (globale), DOM elements
- **Modulo target**: Maps
- **Note**: Esposta su `window` per accesso da HTML

#### `updateAreaInfo()` (riga 3004)
- **Responsabilità**: Calcola e aggiorna info superficie da poligono
- **Dipendenze**: `polygon` (globale), `currentPolygonCoords` (globale), `google.maps.geometry`, DOM elements
- **Usata da**: Listener click mappa, listener modifiche poligono
- **Modulo target**: Maps
- **Note**: Calcola superficie in ettari e aggiorna campo form

#### `loadExistingPolygon(polygonCoords)` (riga 3020) - `window.loadExistingPolygon`
- **Responsabilità**: Carica poligono esistente sulla mappa
- **Dipendenze**: `map`, `polygon` (globale), `currentPolygonCoords` (globale), `getColturaColor()`, `updateAreaInfo()`
- **Chiama**: `clearPolygon()`, `updateAreaInfo()`
- **Usata da**: `openTerrenoModal()` (quando modifica terreno con mappa)
- **Modulo target**: Maps
- **Note**: 
  - Esposta su `window` per accesso esterno
  - Setup listener modifiche poligono
  - Fit bounds automatico

---

### 8. Funzioni Tour Interattivo

#### `setupTerreniTourButton()` (riga 1648)
- **Responsabilità**: Setup bottone tour e event listener
- **Dipendenze**: DOM element `terreni-tour-button`
- **Chiama**: `startTerreniTour(true)`
- **Modulo target**: Tour
- **Note**: Chiamata all'inizializzazione

#### `maybeAutoStartTerreniTour()` (riga 1655)
- **Responsabilità**: Avvia tour automaticamente se utente non l'ha mai visto
- **Dipendenze**: `localStorage`, `TERRENI_TOUR_STORAGE_KEY` (globale), `terreniTourAutoRequested` (globale)
- **Chiama**: `startTerreniTour(false)`
- **Usata da**: `renderTerreni()`
- **Modulo target**: Tour
- **Note**: Auto-start dopo 2 secondi

#### `startTerreniTour(triggeredManually)` (riga 1668)
- **Responsabilità**: Avvia tour interattivo
- **Dipendenze**: `introJs`, DOM elements, `openTerrenoModal()`, `closeTerrenoModal()`, `buildTerreniTourSteps()`, `ensureTooltipVisible()`
- **Chiama**: 
  - `openTerrenoModal()` (se modal non aperto)
  - `buildTerreniTourSteps()`
  - `closeTerrenoModal()` (se aperto per tour)
  - `ensureTooltipVisible()` (via callback)
- **Modulo target**: Tour
- **Note**: Gestisce apertura/chiusura modal durante tour

#### `buildTerreniTourSteps()` (riga 2229)
- **Responsabilità**: Costruisce array step per tour
- **Dipendenze**: DOM elements con `data-tour-section`
- **Usata da**: `startTerreniTour()`
- **Modulo target**: Tour
- **Note**: Definisce tutti gli step del tour

#### `ensureTooltipVisible()` (riga 1758)
- **Responsabilità**: Forza posizionamento corretto tooltip durante tour
- **Dipendenze**: DOM elements tooltip, `window.getComputedStyle()`, `window.innerHeight`, `window.innerWidth`
- **Usata da**: Callback tour `onchange`
- **Modulo target**: Tour
- **Note**: Gestisce posizionamento tooltip su schermi piccoli

---

## 📦 Variabili Globali

### Variabili Dati
```javascript
let terreni = [];                    // Array tutti i terreni
let terreniFiltrati = [];            // Array terreni filtrati
let colture = [];                    // Lista colture disponibili (deprecato, usa colturePerCategoriaTerreni)
let poderi = [];                     // Lista poderi disponibili
let categorieColtureTerreni = [];    // Array categorie colture
let colturePerCategoriaTerreni = {}; // Oggetto {categoriaId: [colture]}
```

### Variabili Stato
```javascript
let currentTerrenoId = null;         // ID terreno in modifica
let currentTenantId = null;           // ID tenant corrente
```

### Variabili Google Maps
```javascript
let map = null;                      // Istanza Google Map
let polygon = null;                  // Poligono tracciato
let isDrawing = false;               // Flag modalità tracciamento
let currentPolygonCoords = [];       // Coordinate poligono corrente
```

### Variabili Tour
```javascript
const TERRENI_TOUR_STORAGE_KEY = 'gfv_terreni_tour_v1';
let terreniTourAutoRequested = false;
let terreniTourOpenedModal = false;
```

### Istanze Firebase
```javascript
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
```

---

## 🔗 Dipendenze tra Funzioni

### Grafo Dipendenze Principali

```
onAuthStateChanged
  ├── loadColture()
  │     ├── loadCategorieColtureTerreni()
  │     │     └── initializeColturePredefiniteTerreni()
  │     └── loadColturePerCategoriaTerreni()
  ├── loadPoderi()
  │     └── populatePoderiDropdown()
  └── loadTerreni()
        └── renderTerreni()
              ├── escapeHtml()
              ├── calcolaAlertAffitto()
              ├── formattaDataScadenza()
              └── maybeAutoStartTerreniTour()
                    └── startTerreniTour()
                          ├── openTerrenoModal()
                          ├── buildTerreniTourSteps()
                          ├── closeTerrenoModal()
                          └── ensureTooltipVisible()

openTerrenoModal()
  ├── loadColture()
  ├── populatePoderiDropdown()
  ├── updateColtureDropdownTerreni()
  │     └── getColturaColor()
  │           └── mapColturaToColorCategory()
  ├── toggleDataScadenzaAffitto()
  └── initMap()
        └── getColturaColor()
        └── updateAreaInfo() (via listener)

handleSaveTerreno()
  ├── showAlert()
  ├── getTerreniCollection()
  └── renderTerreni()

filterTerreni()
  ├── calcolaAlertAffitto()
  └── renderTerreni()
```

---

## 🎯 Piano di Estrazione Moduli

### Modulo 1: `core/js/terreni-controller.js`

**Responsabilità**: Logica principale e coordinamento

**Funzioni da Estrarre**:
- `waitForConfig()` - Inizializzazione
- `getTenantId(userId)` - Helper
- `getTerreniCollection(tenantId)` - Helper
- `loadPoderi()` - Caricamento dati
- `populatePoderiDropdown()` - UI helper
- `initializeColturePredefiniteTerreni()` - Inizializzazione
- `loadCategorieColtureTerreni()` - Caricamento dati
- `loadColturePerCategoriaTerreni()` - Caricamento dati
- `loadColture()` - Wrapper
- `loadTerreni()` - Caricamento dati principale
- `renderTerreni()` - Rendering UI
- `filterTerreni()` - Filtri (può andare in Events)
- `clearFilters()` - Filtri (può andare in Events)

**Variabili Globali da Gestire**:
- `terreni`, `terreniFiltrati`
- `colture`, `poderi`
- `categorieColtureTerreni`, `colturePerCategoriaTerreni`
- `currentTenantId`

**Dipendenze Esterne**:
- Firebase (`db`, `auth`)
- Servizi: `tenant-service.js`, `categorie-service.js`, `colture-service.js`
- Utils: `escapeHtml()`, `calcolaAlertAffitto()`, `formattaDataScadenza()`
- Events: `maybeAutoStartTerreniTour()` (per chiamare dopo render)

**Export Necessari**:
```javascript
export {
  initializeTerreni,
  loadTerreni,
  loadPoderi,
  loadColture,
  renderTerreni,
  filterTerreni,
  clearFilters
};
```

---

### Modulo 2: `core/js/terreni-events.js`

**Responsabilità**: Gestione eventi UI e form

**Funzioni da Estrarre**:
- `openTerrenoModal(terrenoId)` - `window.openTerrenoModal`
- `closeTerrenoModal()` - `window.closeTerrenoModal`
- `handleSaveTerreno(e)` - `window.handleSaveTerreno`
- `editTerreno(terrenoId)` - `window.editTerreno`
- `confirmDeleteTerreno(terrenoId)` - `window.confirmDeleteTerreno`
- `toggleDataScadenzaAffitto()` - `window.toggleDataScadenzaAffitto`
- `updateColtureDropdownTerreni()` - `window.updateColtureDropdownTerreni`
- `setupColturaColorListener()` - Setup listener

**Variabili Globali da Gestire**:
- `currentTerrenoId`

**Dipendenze Esterne**:
- Controller: `loadColture()`, `populatePoderiDropdown()`, `renderTerreni()`
- Maps: `initMap()`, `loadExistingPolygon()`
- Utils: `showAlert()`, `getColturaColor()`
- Firebase: `db`, `currentTenantId`, `getTerreniCollection()`

**Export Necessari**:
```javascript
export {
  setupTerreniEventListeners,
  openTerrenoModal,
  closeTerrenoModal,
  handleSaveTerreno,
  editTerreno,
  confirmDeleteTerreno
};
```

**Note**: Alcune funzioni devono essere esposte su `window` per accesso da attributi HTML (`onclick`, `onsubmit`, `onchange`)

---

### Modulo 3: `core/js/terreni-maps.js`

**Responsabilità**: Logica Google Maps

**Funzioni da Estrarre**:
- `initMap()` - `window.initMap`
- `searchLocation()` - `window.searchLocation`
- `toggleDrawing()` - `window.toggleDrawing`
- `clearPolygon()` - `window.clearPolygon`
- `updateAreaInfo()` - Helper interno
- `loadExistingPolygon(polygonCoords)` - `window.loadExistingPolygon`

**Variabili Globali da Gestire**:
- `map`
- `polygon`
- `isDrawing`
- `currentPolygonCoords`

**Dipendenze Esterne**:
- Utils: `getColturaColor()`, `showAlert()`
- Google Maps API: `google.maps`, `google.maps.geometry`
- DOM: elementi mappa

**Export Necessari**:
```javascript
export {
  initMap,
  searchLocation,
  toggleDrawing,
  clearPolygon,
  loadExistingPolygon,
  getMapInstance,
  getPolygonInstance,
  getCurrentPolygonCoords
};
```

**Note**: 
- `initMap()` deve essere esposta su `window` per callback Google Maps
- Funzioni devono essere esposte su `window` per accesso da HTML

---

### Modulo 4: `core/js/terreni-tour.js`

**Responsabilità**: Tour interattivo

**Funzioni da Estrarre**:
- `setupTerreniTourButton()` - Setup iniziale
- `maybeAutoStartTerreniTour()` - Auto-start
- `startTerreniTour(triggeredManually)` - Avvio tour
- `buildTerreniTourSteps()` - Costruzione step
- `ensureTooltipVisible()` - Posizionamento tooltip

**Variabili Globali da Gestire**:
- `TERRENI_TOUR_STORAGE_KEY`
- `terreniTourAutoRequested`
- `terreniTourOpenedModal`

**Dipendenze Esterne**:
- Events: `openTerrenoModal()`, `closeTerrenoModal()`
- IntroJS: `introJs`
- DOM: elementi con `data-tour-section`

**Export Necessari**:
```javascript
export {
  setupTerreniTourButton,
  maybeAutoStartTerreniTour,
  startTerreniTour
};
```

**Note**: Tour dipende da Events per aprire/chiudere modal

---

### Modulo 5: `core/js/terreni-utils.js` (Opzionale)

**Responsabilità**: Utility functions

**Funzioni da Estrarre**:
- `showAlert(message, type)` - Alert generico
- `escapeHtml(text)` - Escape HTML
- `calcolaAlertAffitto(dataScadenza)` - Calcolo alert
- `formattaDataScadenza(data)` - Formattazione date
- `mapColturaToColorCategory(colturaNome, colturaCategoria)` - Mapping colori
- `getColturaColor()` - Ottieni colore coltura

**Dipendenze Esterne**:
- DOM: elementi alert, form
- Maps: `mapColturaToColorCategory()` per `getColturaColor()`

**Export Necessari**:
```javascript
export {
  showAlert,
  escapeHtml,
  calcolaAlertAffitto,
  formattaDataScadenza,
  mapColturaToColorCategory,
  getColturaColor
};
```

**Note**: Alcune utility potrebbero essere spostate in `shared/utils/` se riutilizzabili

---

## 📋 Checklist Estrazione

### Fase 1: Controller
- [ ] Creare `core/js/terreni-controller.js`
- [ ] Estrarre funzioni caricamento dati
- [ ] Estrarre funzioni rendering
- [ ] Gestire variabili globali dati
- [ ] Export funzioni principali
- [ ] Testare caricamento dati
- [ ] Testare rendering lista

### Fase 2: Events
- [ ] Creare `core/js/terreni-events.js`
- [ ] Estrarre event handlers modal
- [ ] Estrarre event handlers form
- [ ] Gestire variabili globali stato
- [ ] Esporre funzioni su `window` per HTML
- [ ] Testare creazione terreno
- [ ] Testare modifica terreno
- [ ] Testare eliminazione terreno

### Fase 3: Maps
- [ ] Creare `core/js/terreni-maps.js`
- [ ] Estrarre funzioni Google Maps
- [ ] Gestire variabili globali mappa
- [ ] Esporre funzioni su `window` per HTML/callback
- [ ] Testare inizializzazione mappa
- [ ] Testare tracciamento poligono
- [ ] Testare calcolo superficie
- [ ] Testare caricamento poligono esistente

### Fase 4: Tour
- [ ] Creare `core/js/terreni-tour.js`
- [ ] Estrarre logica tour
- [ ] Gestire variabili globali tour
- [ ] Rimuovere eventuali log debug
- [ ] Testare tour completo
- [ ] Testare auto-start tour

### Fase 5: Utils (Opzionale)
- [ ] Creare `core/js/terreni-utils.js`
- [ ] Estrarre utility functions
- [ ] Testare utility functions

### Fase 6: Pulizia HTML
- [ ] Rimuovere funzioni estratte da HTML
- [ ] Aggiungere import moduli
- [ ] Mantenere solo HTML, CSS, inizializzazione
- [ ] Aggiungere commenti organizzativi
- [ ] Verificare leggibilità file

### Fase 7: Testing Completo
- [ ] Testare tutte le funzionalità
- [ ] Verificare ambiente `file://`
- [ ] Verificare ambiente HTTP
- [ ] Verificare Google Maps
- [ ] Verificare tour
- [ ] Verificare filtri
- [ ] Verificare creazione/modifica/eliminazione
- [ ] Verificare calcolo superficie
- [ ] Verificare nessun errore console

---

## 🔄 Pattern da Seguire

### Pattern Export/Import

**Modulo JavaScript**:
```javascript
// core/js/terreni-controller.js
export function loadTerreni() {
  // ...
}

export function renderTerreni() {
  // ...
}
```

**File HTML**:
```javascript
// Import moduli
import { loadTerreni, renderTerreni } from './js/terreni-controller.js';
import { setupTerreniEventListeners } from './js/terreni-events.js';
import { initMap } from './js/terreni-maps.js';
import { setupTerreniTourButton } from './js/terreni-tour.js';

// Inizializzazione
onAuthStateChanged(auth, async (user) => {
  // ...
  await loadTerreni();
  setupTerreniEventListeners();
  setupTerreniTourButton();
});
```

### Pattern Variabili Globali

**Opzione 1: Passare come Parametri**
```javascript
// Funzione che usa variabile globale
function renderTerreni(terreni, terreniFiltrati) {
  // ...
}
```

**Opzione 2: State Object Condiviso**
```javascript
// State object
const terreniState = {
  terreni: [],
  terreniFiltrati: [],
  currentTerrenoId: null
};

// Funzioni accedono a state
function renderTerreni(state) {
  const terreniDaMostrare = state.terreniFiltrati.length > 0 
    ? state.terreniFiltrati 
    : state.terreni;
  // ...
}
```

**Opzione 3: Mantenere Globali (Temporaneo)**
```javascript
// Per compatibilità durante transizione
window.terreniState = {
  terreni: [],
  terreniFiltrati: []
};
```

### Pattern Funzioni Esposte su Window

**Per accesso da HTML**:
```javascript
// In terreni-events.js
export function openTerrenoModal(terrenoId) {
  // ...
}

// Esporre su window per HTML
window.openTerrenoModal = openTerrenoModal;
```

**Nel file HTML**:
```html
<button onclick="openTerrenoModal()">Aggiungi</button>
```

---

## ⚠️ Note Importanti

### 1. Ordine di Caricamento
- Firebase deve essere inizializzato prima
- Google Maps deve essere caricato prima delle funzioni mappa
- Moduli devono essere importati nell'ordine corretto

### 2. Dipendenze Circolari
- Controller → Events (per chiamare renderTerreni dopo save)
- Events → Maps (per initMap quando si apre modal)
- Tour → Events (per aprire/chiudere modal)
- **Soluzione**: Usare callback o eventi custom

### 3. Variabili Globali
- Alcune variabili devono rimanere globali (es. `map`, `polygon` per Google Maps)
- Altre possono essere gestite tramite state object
- Valutare caso per caso

### 4. Compatibilità HTML
- Funzioni chiamate da attributi HTML (`onclick`, `onsubmit`) devono essere su `window`
- Mantenere compatibilità durante transizione

### 5. Testing Incrementale
- Testare dopo ogni modulo estratto
- Non procedere se ci sono errori
- Rollback se necessario

---

## 📊 Risultato Atteso

### Prima
- `terreni-standalone.html`: 3106 righe (tutto inline)

### Dopo
- `terreni-standalone.html`: ~800-1000 righe (HTML + CSS + inizializzazione)
- `core/js/terreni-controller.js`: ~500-600 righe
- `core/js/terreni-events.js`: ~400-500 righe
- `core/js/terreni-maps.js`: ~400-500 righe
- `core/js/terreni-tour.js`: ~300-400 righe
- `core/js/terreni-utils.js`: ~150-200 righe (opzionale)

**Totale**: Stesso codice, meglio organizzato

---

## 🚀 Ordine di Esecuzione Consigliato

1. **Controller** (base, altre funzioni dipendono)
2. **Utils** (usato da altri moduli)
3. **Maps** (indipendente, può essere fatto in parallelo)
4. **Events** (dipende da Controller e Maps)
5. **Tour** (dipende da Events)

---

## 📝 Template Modulo

### Struttura File Modulo

```javascript
/**
 * Terreni Controller - Logica principale gestione terreni
 * 
 * @module core/js/terreni-controller
 */

// ============================================
// IMPORTS
// ============================================
import { getDb, getAuthInstance } from '../services/firebase-service.js';
import { getCurrentTenantId } from '../services/tenant-service.js';

// ============================================
// STATE
// ============================================
// Gestione state (opzionale, può usare variabili globali temporaneamente)

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Carica tutti i terreni del tenant
 */
export async function loadTerreni() {
  // ...
}

/**
 * Renderizza lista terreni
 */
export function renderTerreni() {
  // ...
}

// ============================================
// FUNZIONI HELPER
// ============================================

function getTerreniCollection(tenantId) {
  // ...
}

// ============================================
// EXPORTS
// ============================================
export default {
  loadTerreni,
  renderTerreni
};
```

---

## ✅ Criteri di Completamento

Il refactoring è completo quando:

1. ✅ Tutti i moduli sono stati creati
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




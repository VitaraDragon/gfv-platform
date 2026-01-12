# 📋 Documento Progresso Refactoring terreni-standalone.html

**Data Creazione**: 2025-01-26  
**Stato**: Estrazione Moduli Completata - Pronto per Integrazione  
**Versione**: 1.0

---

## 🎯 Obiettivo

Refactorizzare `core/terreni-standalone.html` (3106 righe) estraendo la logica JavaScript in moduli separati per migliorare:
- **Manutenibilità**: Codice organizzato in moduli logici
- **Leggibilità**: File HTML più pulito e focalizzato
- **Riutilizzabilità**: Funzioni riutilizzabili in altri contesti
- **Testabilità**: Moduli testabili indipendentemente

**Risultato Atteso**: File HTML ridotto a ~800-1000 righe (HTML + CSS + inizializzazione) + 5 moduli JavaScript separati.

---

## ✅ Lavoro Completato

### Moduli Creati

Sono stati creati **5 moduli JavaScript** nella directory `core/js/`:

#### 1. `core/js/terreni-controller.js` ✅
**Responsabilità**: Logica principale e coordinamento

**Funzioni Estratte**:
- `waitForConfig()` - Attende caricamento configurazioni Firebase e Google Maps
- `getTenantId(userId, db, currentTenantId)` - Recupera tenant ID dall'utente
- `getTerreniCollection(tenantId, db)` - Ottiene riferimento collection terreni
- `loadPoderi(currentTenantId, db, poderi)` - Carica lista poderi
- `populatePoderiDropdown(poderi)` - Popola dropdown poderi
- `initializeColturePredefiniteTerreni(currentTenantId, db)` - Inizializza colture predefinite
- `loadCategorieColtureTerreni(currentTenantId, db, app, auth, categorieColtureTerreni)` - Carica categorie colture
- `loadColturePerCategoriaTerreni(currentTenantId, db, app, auth, colturePerCategoriaTerreni, colture)` - Carica colture per categoria
- `loadColture(...)` - Wrapper per caricare categorie e colture
- `loadTerreni(currentTenantId, auth, db, terreni, terreniFiltrati, renderTerreniCallback)` - Carica tutti i terreni
- `renderTerreni(terreni, terreniFiltrati, maybeAutoStartTerreniTourCallback)` - Renderizza lista terreni
- `filterTerreni(terreni, terreniFiltrati, renderTerreniCallback)` - Filtra terreni
- `clearFilters(terreni, terreniFiltrati, renderTerreniCallback)` - Resetta filtri

**Dipendenze**:
- Importa da `terreni-utils.js`: `escapeHtml`, `calcolaAlertAffitto`, `formattaDataScadenza`, `showAlert`

**Note**:
- Le funzioni accettano parametri espliciti invece di usare variabili globali
- Usa callback per comunicare con altri moduli (es. `renderTerreniCallback`)
- Mantiene compatibilità con servizi centralizzati (`categorie-service.js`, `colture-service.js`)
- Include fallback per ambiente `file://`

---

#### 2. `core/js/terreni-utils.js` ✅
**Responsabilità**: Funzioni utility generiche e specifiche

**Funzioni Estratte**:
- `showAlert(message, type)` - Mostra alert temporaneo
- `escapeHtml(text)` - Escape caratteri HTML per sicurezza
- `calcolaAlertAffitto(dataScadenza)` - Calcola colore e testo alert scadenza affitto
- `formattaDataScadenza(data)` - Formatta data scadenza per visualizzazione
- `mapColturaToColorCategory(colturaNome, colturaCategoria)` - Mappa nome coltura a categoria colore
- `getColturaColor()` - Ottiene colore coltura selezionata per poligono mappa

**Note**:
- Funzioni pure (senza side effects, tranne `showAlert` e `getColturaColor` che accedono al DOM)
- `getColturaColor()` accede al DOM per leggere valori form (necessario per mappe)
- Palette colori colture definita internamente al modulo

---

#### 3. `core/js/terreni-maps.js` ✅
**Responsabilità**: Logica Google Maps

**Funzioni Estratte**:
- `initMap(state, updateState)` - Inizializza Google Maps
- `searchLocation(state)` - Cerca indirizzo e centra mappa
- `toggleDrawing(state, updateState)` - Attiva/disattiva modalità tracciamento
- `clearPolygon(state, updateState)` - Cancella poligono tracciato
- `updateAreaInfo(state)` - Calcola e aggiorna info superficie
- `loadExistingPolygon(polygonCoords, state, updateState)` - Carica poligono esistente
- `getMapInstance(state)` - Helper per ottenere istanza mappa
- `getPolygonInstance(state)` - Helper per ottenere istanza poligono
- `getCurrentPolygonCoords(state)` - Helper per ottenere coordinate poligono

**Dipendenze**:
- Importa da `terreni-utils.js`: `getColturaColor`, `showAlert`

**Note Architetturali**:
- **SCELTA IMPORTANTE**: Le funzioni accettano un `state` object e una funzione `updateState` invece di modificare variabili globali direttamente
- Questo pattern permette di gestire lo state in modo più controllato
- Lo state object contiene: `{ map, polygon, isDrawing, currentPolygonCoords }`
- La funzione `updateState` viene passata dal file HTML principale e aggiorna le variabili globali

**Motivazione**:
- Evita dipendenze dirette da variabili globali
- Facilita testing (si può passare uno state mock)
- Mantiene compatibilità con codice esistente (lo state può essere un wrapper delle variabili globali)

---

#### 4. `core/js/terreni-events.js` ✅
**Responsabilità**: Event handlers per modal e form

**Funzioni Estratte**:
- `openTerrenoModal(terrenoId, state, updateState, ...callbacks)` - Apre modal crea/modifica
- `closeTerrenoModal(state, updateState)` - Chiude modal e pulisce stato
- `handleSaveTerreno(e, state, updateState, ...callbacks)` - Gestisce salvataggio terreno
- `editTerreno(terrenoId, openTerrenoModalCallback)` - Apre modal in modalità modifica
- `confirmDeleteTerreno(terrenoId, state, ...callbacks)` - Conferma ed elimina terreno
- `toggleDataScadenzaAffitto()` - Mostra/nasconde campi affitto
- `updateColtureDropdownTerreni(state, updateState, getColturaColorCallback)` - Aggiorna dropdown colture
- `setupColturaColorListener(state, getColturaColorCallback)` - Setup listener colore poligono

**Dipendenze**:
- Importa da `terreni-utils.js`: `showAlert`
- Richiede callback per: `loadColture`, `populatePoderiDropdown`, `updateColtureDropdownTerreni`, `toggleDataScadenzaAffitto`, `initMap`, `loadExistingPolygon`, `getTerreniCollection`, `loadTerreni`

**Note Architetturali**:
- **SCELTA IMPORTANTE**: Le funzioni accettano molti callback invece di importare direttamente altri moduli
- Questo evita dipendenze circolari e mantiene i moduli più indipendenti
- Il file HTML principale coordina i moduli passando i callback necessari

**Motivazione**:
- Evita dipendenze circolari (Events → Controller → Events)
- Mantiene moduli testabili indipendentemente
- Permette al file HTML di controllare il flusso di esecuzione

---

#### 5. `core/js/terreni-tour.js` ✅
**Responsabilità**: Tour interattivo con IntroJS

**Funzioni Estratte**:
- `setupTerreniTourButton(startTerreniTourCallback)` - Setup bottone tour
- `maybeAutoStartTerreniTour(state, updateState, startTerreniTourCallback)` - Auto-start tour
- `startTerreniTour(triggeredManually, state, updateState, ...callbacks)` - Avvia tour
- `buildTerreniTourSteps()` - Costruisce array step (funzione interna)

**Dipendenze**:
- Richiede callback per: `openTerrenoModal`, `closeTerrenoModal`
- Dipende da IntroJS (caricato esternamente)

**Note**:
- Costante `TERRENI_TOUR_STORAGE_KEY` definita nel modulo
- Funzione `ensureTooltipVisible()` è interna a `startTourWithSteps()` (non esportata)
- Gestisce apertura/chiusura modal durante il tour

---

## 🏗️ Scelte Architetturali e Motivazioni

### 1. Pattern State Object + Update Function

**Scelta**: Le funzioni dei moduli Maps ed Events accettano un `state` object e una funzione `updateState` invece di modificare variabili globali direttamente.

**Esempio**:
```javascript
// Invece di:
let map = null;
function initMap() {
    map = new google.maps.Map(...);
}

// Usiamo:
function initMap(state, updateState) {
    const map = new google.maps.Map(...);
    updateState({ map });
}
```

**Motivazioni**:
- ✅ **Testabilità**: Si può passare uno state mock per i test
- ✅ **Controllo**: Il file HTML controlla come lo state viene aggiornato
- ✅ **Compatibilità**: Lo state può essere un wrapper delle variabili globali esistenti
- ✅ **Flessibilità**: Facile passare a un sistema di state management più avanzato in futuro

**Implementazione nel File HTML**:
```javascript
// State object che wrappa variabili globali
const terreniState = {
    map: null,
    polygon: null,
    isDrawing: false,
    currentPolygonCoords: [],
    currentTerrenoId: null,
    currentTenantId: null,
    terreni: [],
    terreniFiltrati: [],
    // ... altre variabili
};

// Funzione updateState che aggiorna variabili globali
function updateState(updates) {
    Object.assign(terreniState, updates);
    // Aggiorna anche variabili globali per compatibilità
    map = terreniState.map;
    polygon = terreniState.polygon;
    isDrawing = terreniState.isDrawing;
    // ... ecc.
}
```

---

### 2. Pattern Callback per Comunicazione tra Moduli

**Scelta**: I moduli Events e Tour accettano callback invece di importare direttamente altri moduli.

**Esempio**:
```javascript
// Invece di:
import { loadTerreni } from './terreni-controller.js';
export function handleSaveTerreno(e) {
    // ...
    await loadTerreni();
}

// Usiamo:
export function handleSaveTerreno(e, state, updateState, loadTerreniCallback) {
    // ...
    if (loadTerreniCallback) {
        await loadTerreniCallback();
    }
}
```

**Motivazioni**:
- ✅ **Evita Dipendenze Circolari**: Events non dipende da Controller, Controller non dipende da Events
- ✅ **Moduli Indipendenti**: Ogni modulo può essere testato isolatamente
- ✅ **Controllo Centralizzato**: Il file HTML coordina tutti i moduli
- ✅ **Flessibilità**: Facile cambiare l'ordine di esecuzione o aggiungere logica extra

**Implementazione nel File HTML**:
```javascript
import { handleSaveTerreno } from './js/terreni-events.js';
import { loadTerreni } from './js/terreni-controller.js';

// Crea wrapper che passa i callback
async function handleSaveTerrenoWrapper(e) {
    await handleSaveTerreno(
        e,
        terreniState,
        updateState,
        getTerreniCollectionWrapper,
        async () => {
            await loadTerreni(
                terreniState.currentTenantId,
                auth,
                db,
                terreniState.terreni,
                terreniState.terreniFiltrati,
                (terreni, terreniFiltrati) => {
                    renderTerreni(terreni, terreniFiltrati, maybeAutoStartTerreniTourWrapper);
                }
            );
        }
    );
}
```

---

### 3. Mantenimento Variabili Globali per Compatibilità

**Scelta**: Manteniamo le variabili globali esistenti per compatibilità con codice che le usa direttamente (es. attributi HTML `onclick`, callback Google Maps).

**Motivazioni**:
- ✅ **Compatibilità**: Il codice esistente che usa `window.openTerrenoModal()` continua a funzionare
- ✅ **Gradualità**: Possiamo migrare gradualmente senza rompere tutto
- ✅ **Callback Esterni**: Google Maps e altri servizi esterni si aspettano funzioni globali

**Implementazione**:
```javascript
// Nel file HTML, dopo aver importato i moduli:
import { openTerrenoModal } from './js/terreni-events.js';

// Crea wrapper che aggiorna lo state
async function openTerrenoModalWrapper(terrenoId) {
    await openTerrenoModal(
        terrenoId,
        terreniState,
        updateState,
        loadColtureWrapper,
        populatePoderiDropdownWrapper,
        // ... altri callback
    );
}

// Esponi su window per compatibilità
window.openTerrenoModal = openTerrenoModalWrapper;
```

---

### 4. Import Dinamici per Firebase

**Scelta**: I moduli importano Firebase dinamicamente quando necessario invece di importare all'inizio.

**Esempio**:
```javascript
// Invece di:
import { collection, getDocs } from 'firebase/firestore';

// Usiamo:
const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
```

**Motivazioni**:
- ✅ **Compatibilità**: Il file HTML usa già Firebase da CDN, non da npm
- ✅ **Lazy Loading**: Firebase viene caricato solo quando necessario
- ✅ **Coerenza**: Mantiene lo stesso pattern del file HTML originale

---

## 📊 Struttura State Object

Lo state object che deve essere creato nel file HTML principale:

```javascript
const terreniState = {
    // Google Maps
    map: null,
    polygon: null,
    isDrawing: false,
    currentPolygonCoords: [],
    
    // Terreni
    currentTerrenoId: null,
    currentTenantId: null,
    terreni: [],
    terreniFiltrati: [],
    
    // Liste
    poderi: [],
    colture: [],
    categorieColtureTerreni: [],
    colturePerCategoriaTerreni: {},
    
    // Tour
    terreniTourAutoRequested: false,
    terreniTourOpenedModal: false,
    
    // Firebase (opzionale, può essere globale)
    db: null,
    auth: null
};
```

---

## 🔄 Prossimi Passi: Integrazione nel File HTML

### Fase 1: Preparazione State e Wrapper Functions

1. **Creare state object** all'inizio del file JavaScript (dopo inizializzazione Firebase)
2. **Creare funzione `updateState`** che aggiorna sia lo state che le variabili globali
3. **Mantenere variabili globali** per compatibilità con codice esistente

```javascript
// Dopo inizializzazione Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State object
const terreniState = {
    map: null,
    polygon: null,
    isDrawing: false,
    currentPolygonCoords: [],
    currentTerrenoId: null,
    currentTenantId: null,
    terreni: [],
    terreniFiltrati: [],
    poderi: [],
    colture: [],
    categorieColtureTerreni: [],
    colturePerCategoriaTerreni: {},
    terreniTourAutoRequested: false,
    terreniTourOpenedModal: false,
    db,
    auth
};

// Variabili globali per compatibilità
let map = null;
let polygon = null;
let isDrawing = false;
let currentPolygonCoords = [];
let currentTerrenoId = null;
let currentTenantId = null;
let terreni = [];
let terreniFiltrati = [];
let poderi = [];
let colture = [];
let categorieColtureTerreni = [];
let colturePerCategoriaTerreni = {};
let terreniTourAutoRequested = false;
let terreniTourOpenedModal = false;

// Funzione updateState
function updateState(updates) {
    Object.assign(terreniState, updates);
    // Sincronizza con variabili globali
    map = terreniState.map;
    polygon = terreniState.polygon;
    isDrawing = terreniState.isDrawing;
    currentPolygonCoords = terreniState.currentPolygonCoords;
    currentTerrenoId = terreniState.currentTerrenoId;
    currentTenantId = terreniState.currentTenantId;
    terreni = terreniState.terreni;
    terreniFiltrati = terreniState.terreniFiltrati;
    poderi = terreniState.poderi;
    colture = terreniState.colture;
    categorieColtureTerreni = terreniState.categorieColtureTerreni;
    colturePerCategoriaTerreni = terreniState.colturePerCategoriaTerreni;
    terreniTourAutoRequested = terreniState.terreniTourAutoRequested;
    terreniTourOpenedModal = terreniState.terreniTourOpenedModal;
}
```

---

### Fase 2: Import Moduli

Aggiungere import dei moduli all'inizio della sezione JavaScript:

```javascript
// Import moduli
import { 
    waitForConfig,
    getTenantId,
    getTerreniCollection,
    loadPoderi,
    populatePoderiDropdown,
    loadColture,
    loadTerreni,
    renderTerreni,
    filterTerreni,
    clearFilters
} from './js/terreni-controller.js';

import {
    showAlert,
    escapeHtml,
    calcolaAlertAffitto,
    formattaDataScadenza,
    getColturaColor
} from './js/terreni-utils.js';

import {
    initMap,
    searchLocation,
    toggleDrawing,
    clearPolygon,
    loadExistingPolygon
} from './js/terreni-maps.js';

import {
    openTerrenoModal,
    closeTerrenoModal,
    handleSaveTerreno,
    editTerreno,
    confirmDeleteTerreno,
    toggleDataScadenzaAffitto,
    updateColtureDropdownTerreni,
    setupColturaColorListener
} from './js/terreni-events.js';

import {
    setupTerreniTourButton,
    maybeAutoStartTerreniTour,
    startTerreniTour
} from './js/terreni-tour.js';
```

---

### Fase 3: Creare Wrapper Functions

Creare wrapper functions che collegano i moduli e gestiscono lo state:

```javascript
// Wrapper per loadColture
async function loadColtureWrapper() {
    await loadColture(
        terreniState.currentTenantId,
        db,
        app,
        auth,
        terreniState.categorieColtureTerreni,
        terreniState.colturePerCategoriaTerreni,
        terreniState.colture
    );
}

// Wrapper per loadPoderi
async function loadPoderiWrapper() {
    await loadPoderi(
        terreniState.currentTenantId,
        db,
        terreniState.poderi
    );
}

// Wrapper per loadTerreni
async function loadTerreniWrapper() {
    await loadTerreni(
        terreniState.currentTenantId,
        auth,
        db,
        terreniState.terreni,
        terreniState.terreniFiltrati,
        (terreni, terreniFiltrati) => {
            renderTerreniWrapper(terreni, terreniFiltrati);
        }
    );
}

// Wrapper per renderTerreni
function renderTerreniWrapper(terreni, terreniFiltrati) {
    renderTerreni(
        terreni,
        terreniFiltrati,
        () => maybeAutoStartTerreniTourWrapper()
    );
}

// Wrapper per filterTerreni
function filterTerreniWrapper() {
    filterTerreni(
        terreniState.terreni,
        terreniState.terreniFiltrati,
        (terreni, terreniFiltrati) => {
            renderTerreniWrapper(terreni, terreniFiltrati);
        }
    );
}

// Wrapper per clearFilters
function clearFiltersWrapper() {
    clearFilters(
        terreniState.terreni,
        terreniState.terreniFiltrati,
        (terreni, terreniFiltrati) => {
            renderTerreniWrapper(terreni, terreniFiltrati);
        }
    );
}

// Wrapper per openTerrenoModal
async function openTerrenoModalWrapper(terrenoId) {
    await openTerrenoModal(
        terrenoId,
        terreniState,
        updateState,
        loadColtureWrapper,
        () => populatePoderiDropdown(terreniState.poderi),
        () => updateColtureDropdownTerreniWrapper(),
        toggleDataScadenzaAffitto,
        (state, updateState) => initMap(state, updateState),
        (polygonCoords, state, updateState) => loadExistingPolygon(polygonCoords, state, updateState)
    );
}

// Wrapper per closeTerrenoModal
function closeTerrenoModalWrapper() {
    closeTerrenoModal(terreniState, updateState);
}

// Wrapper per handleSaveTerreno
async function handleSaveTerrenoWrapper(e) {
    await handleSaveTerreno(
        e,
        terreniState,
        updateState,
        (tenantId) => getTerreniCollection(tenantId, db),
        loadTerreniWrapper
    );
}

// Wrapper per confirmDeleteTerreno
async function confirmDeleteTerrenoWrapper(terrenoId) {
    await confirmDeleteTerreno(
        terrenoId,
        terreniState,
        (tenantId) => getTerreniCollection(tenantId, db),
        loadTerreniWrapper
    );
}

// Wrapper per updateColtureDropdownTerreni
function updateColtureDropdownTerreniWrapper() {
    updateColtureDropdownTerreni(
        terreniState,
        updateState,
        getColturaColor
    );
}

// Wrapper per initMap
function initMapWrapper() {
    initMap(terreniState, updateState);
}

// Wrapper per searchLocation
function searchLocationWrapper() {
    searchLocation(terreniState);
}

// Wrapper per toggleDrawing
function toggleDrawingWrapper() {
    toggleDrawing(terreniState, updateState);
}

// Wrapper per clearPolygon
function clearPolygonWrapper() {
    clearPolygon(terreniState, updateState);
}

// Wrapper per loadExistingPolygon
function loadExistingPolygonWrapper(polygonCoords) {
    loadExistingPolygon(polygonCoords, terreniState, updateState);
}

// Wrapper per startTerreniTour
function startTerreniTourWrapper(triggeredManually) {
    startTerreniTour(
        triggeredManually,
        terreniState,
        updateState,
        openTerrenoModalWrapper,
        closeTerrenoModalWrapper
    );
}

// Wrapper per maybeAutoStartTerreniTour
function maybeAutoStartTerreniTourWrapper() {
    maybeAutoStartTerreniTour(
        terreniState,
        updateState,
        startTerreniTourWrapper
    );
}
```

---

### Fase 4: Esporre Funzioni su Window

Esporre le funzioni necessarie per gli attributi HTML (`onclick`, `onsubmit`, `onchange`):

```javascript
// Esponi funzioni su window per attributi HTML
window.openTerrenoModal = openTerrenoModalWrapper;
window.closeTerrenoModal = closeTerrenoModalWrapper;
window.handleSaveTerreno = handleSaveTerrenoWrapper;
window.editTerreno = (terrenoId) => editTerreno(terrenoId, openTerrenoModalWrapper);
window.confirmDeleteTerreno = confirmDeleteTerrenoWrapper;
window.toggleDataScadenzaAffitto = toggleDataScadenzaAffitto;
window.updateColtureDropdownTerreni = updateColtureDropdownTerreniWrapper;
window.filterTerreni = filterTerreniWrapper;
window.clearFilters = clearFiltersWrapper;
window.initMap = initMapWrapper; // Per callback Google Maps
window.searchLocation = searchLocationWrapper;
window.toggleDrawing = toggleDrawingWrapper;
window.clearPolygon = clearPolygonWrapper;
window.loadExistingPolygon = loadExistingPolygonWrapper;
```

---

### Fase 5: Sostituire Funzioni Inline

Sostituire tutte le funzioni inline nel file HTML con chiamate ai wrapper:

1. **Rimuovere** tutte le definizioni di funzioni che sono state estratte nei moduli
2. **Mantenere** solo:
   - Inizializzazione Firebase
   - Setup state object
   - Setup wrapper functions
   - Setup event listeners base
   - Chiamate ai wrapper nell'`onAuthStateChanged`

**Esempio**:
```javascript
// PRIMA (da rimuovere):
async function loadTerreni() {
    // ... 150 righe di codice ...
}

// DOPO (mantenere solo):
// Import già fatto all'inizio
// Wrapper già creato
// Chiamata:
onAuthStateChanged(auth, async (user) => {
    // ...
    await loadTerreniWrapper();
});
```

---

### Fase 6: Aggiornare onAuthStateChanged

Aggiornare la funzione `onAuthStateChanged` per usare i wrapper:

```javascript
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = './auth/login-standalone.html';
        return;
    }

    try {
        // Carica dati utente e tenant
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            // ... setup UI ...
            
            // Aggiorna state
            updateState({ currentTenantId: userData.tenantId });
            
            // Carica dati usando wrapper
            await loadColtureWrapper();
            await loadPoderiWrapper();
            await loadTerreniWrapper();
            
            // Setup listener colore coltura
            setupColturaColorListener(terreniState, getColturaColor);
        }
    } catch (error) {
        console.error('Errore caricamento utente:', error);
    }
});
```

---

### Fase 7: Setup Tour

Setup tour button e auto-start:

```javascript
// Setup tour button
setupTerreniTourButton(startTerreniTourWrapper);

// Auto-start tour (chiamato da renderTerreni)
// Già gestito nel wrapper renderTerreniWrapper
```

---

## ⚠️ Note Importanti per l'Integrazione

### 1. Ordine di Import

Gli import devono essere nell'ordine corretto per evitare errori:
1. Controller (base)
2. Utils (usato da altri)
3. Maps (indipendente)
4. Events (dipende da Controller, Maps, Utils)
5. Tour (dipende da Events)

### 2. Compatibilità Google Maps Callback

La funzione `initMap` deve essere esposta su `window` per il callback di Google Maps:

```javascript
// Nel file HTML, prima di caricare Google Maps script:
window.initGoogleMaps = function() {
    window.googleMapsReady = true;
    // ... eventuale logica aggiuntiva ...
};

// Dopo aver caricato i moduli:
window.initMap = initMapWrapper; // Sovrascrive se necessario
```

### 3. Gestione Errori

Tutti i wrapper dovrebbero gestire errori e loggare per debug:

```javascript
async function loadTerreniWrapper() {
    try {
        await loadTerreni(/* ... */);
    } catch (error) {
        console.error('Errore in loadTerreniWrapper:', error);
        showAlert('Errore nel caricamento dei terreni', 'error');
    }
}
```

### 4. Testing Incrementale

Testare dopo ogni fase:
1. ✅ Dopo Fase 1: Verificare che state object funzioni
2. ✅ Dopo Fase 2: Verificare che import funzionino
3. ✅ Dopo Fase 3: Verificare che wrapper funzionino
4. ✅ Dopo Fase 4: Verificare che funzioni su window funzionino
5. ✅ Dopo Fase 5: Verificare che tutto funzioni insieme

### 5. Rimozione Codice Duplicato

Dopo aver verificato che tutto funziona:
- Rimuovere tutte le funzioni inline che sono state estratte
- Rimuovere variabili globali non più necessarie (se tutte le funzioni usano lo state)
- Mantenere solo variabili globali necessarie per compatibilità

---

## 🐛 Problemi Noti e Soluzioni

### Problema 1: Dipendenze Circolari

**Problema**: Events potrebbe voler chiamare Controller, Controller potrebbe voler chiamare Events.

**Soluzione**: Usare callback invece di import diretti. Il file HTML coordina.

### Problema 2: Variabili Globali vs State Object

**Problema**: Alcune funzioni potrebbero ancora accedere a variabili globali direttamente.

**Soluzione**: Mantenere sincronizzazione bidirezionale tra state object e variabili globali nella funzione `updateState`.

### Problema 3: Callback Google Maps

**Problema**: Google Maps si aspetta `window.initMap` come callback.

**Soluzione**: Esporre wrapper su `window.initMap` dopo aver caricato i moduli.

---

## 📝 Checklist Integrazione

### Preparazione
- [ ] Creare state object
- [ ] Creare funzione updateState
- [ ] Mantenere variabili globali per compatibilità

### Import
- [ ] Importare tutti i moduli nell'ordine corretto
- [ ] Verificare che non ci siano errori di import

### Wrapper Functions
- [ ] Creare wrapper per Controller
- [ ] Creare wrapper per Maps
- [ ] Creare wrapper per Events
- [ ] Creare wrapper per Tour

### Esposizione su Window
- [ ] Esporre funzioni necessarie per attributi HTML
- [ ] Esporre initMap per callback Google Maps

### Sostituzione Codice
- [ ] Rimuovere funzioni inline estratte
- [ ] Aggiornare onAuthStateChanged
- [ ] Aggiornare setup tour

### Testing
- [ ] Testare caricamento terreni
- [ ] Testare creazione terreno
- [ ] Testare modifica terreno
- [ ] Testare eliminazione terreno
- [ ] Testare filtri
- [ ] Testare Google Maps
- [ ] Testare tour
- [ ] Verificare nessun errore in console

### Pulizia
- [ ] Rimuovere codice duplicato
- [ ] Rimuovere variabili globali non più necessarie
- [ ] Aggiungere commenti organizzativi
- [ ] Verificare leggibilità file

---

## 📊 Risultato Atteso

### Prima
- `terreni-standalone.html`: 3106 righe (tutto inline)

### Dopo
- `terreni-standalone.html`: ~800-1000 righe (HTML + CSS + inizializzazione + wrapper)
- `core/js/terreni-controller.js`: ~600 righe
- `core/js/terreni-utils.js`: ~250 righe
- `core/js/terreni-maps.js`: ~400 righe
- `core/js/terreni-events.js`: ~500 righe
- `core/js/terreni-tour.js`: ~400 righe

**Totale**: Stesso codice, meglio organizzato in 6 file invece di 1.

---

## 🔗 File di Riferimento

- **Analisi Originale**: `ANALISI_TERRENI_STANDALONE.md`
- **Piano Refactoring**: `PIANO_REFACTORING_LISTE_2025-12-16.md`
- **File Originale**: `core/terreni-standalone.html`
- **Moduli Creati**: `core/js/terreni-*.js`

---

## 📞 Note Finali

Questo refactoring è stato progettato per essere:
- **Incrementale**: Si può testare dopo ogni fase
- **Compatibile**: Non rompe codice esistente
- **Manutenibile**: Codice organizzato e documentato
- **Estendibile**: Facile aggiungere nuove funzionalità

Se durante l'integrazione si riscontrano problemi:
1. Verificare che tutti gli import siano corretti
2. Verificare che i wrapper passino tutti i parametri necessari
3. Verificare che lo state object sia sincronizzato con variabili globali
4. Controllare console per errori specifici
5. Testare incrementale: ripristinare funzioni inline se necessario

---

**Data Ultimo Aggiornamento**: 2025-12-25  
**Stato**: ✅ Integrazione Completata - Refactoring Finalizzato  
**Risultato**: File ridotto da 3106 righe a 1367 righe (-1639 righe, -53%)

---

## ✅ Integrazione Completata (2025-12-25)

### Lavoro Svolto

#### Fase 1-7: Integrazione Completa ✅
- ✅ Creato `terreniState` object e funzione `updateState`
- ✅ Aggiunti import per tutti i 5 moduli
- ✅ Creati 20+ wrapper functions
- ✅ Esposte funzioni su `window` per compatibilità HTML
- ✅ Sostituito codice inline con chiamate ai wrapper
- ✅ Aggiornato `onAuthStateChanged` e setup tour
- ✅ Rimosse 15+ funzioni duplicate (~1639 righe)

### Risultati

| Metrica | Prima | Dopo | Riduzione |
|---------|-------|------|-----------|
| **Righe totali** | 3106 | 1367 | -1639 righe (-53%) |
| **Funzioni duplicate rimosse** | - | 15+ | - |

### Errori Risolti

1. ✅ `Identifier 'categorieColtureTerreni' has already been declared`
2. ✅ `404 Not Found` per manifest.json e servizi
3. ✅ `Unexpected end of input` (funzioni duplicate)

### Testing ✅

- ✅ Tutte le funzionalità testate e funzionanti
- ✅ Nessun errore in console


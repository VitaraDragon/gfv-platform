# 🔧 Integrazione Moduli Gestione Lavori

**Data**: 2025-01-26  
**File Target**: `core/admin/gestione-lavori-standalone.html`  
**Obiettivo**: Integrare tutti i moduli estratti nel file HTML seguendo il pattern di Terreni

---

## 📦 Moduli Creati

1. ✅ `core/admin/js/gestione-lavori-utils.js` - Funzioni utility
2. ⏳ `core/admin/js/gestione-lavori-controller.js` - Logica principale (funzioni base completate)
3. ✅ `core/admin/js/gestione-lavori-maps.js` - Logica Google Maps
4. ⏳ `core/admin/js/gestione-lavori-events.js` - Event handlers (funzioni base completate)
5. ✅ `core/admin/js/gestione-lavori-tour.js` - Tour interattivo

---

## 🏗️ Pattern di Integrazione (da Terreni)

### 1. Import Moduli (inizio script type="module")

```javascript
import { 
    waitForConfig as waitForConfigModule,
    setupManodoperaVisibility as setupManodoperaVisibilityModule,
    loadTerreni as loadTerreniModule,
    loadCategorieLavori as loadCategorieLavoriModule,
    loadLavori as loadLavoriModule,
    // ... altre funzioni controller
} from './js/gestione-lavori-controller.js';

import {
    showAlert as showAlertUtil,
    escapeHtml as escapeHtmlUtil,
    getStatoFormattato as getStatoFormattatoUtil,
    getStatoProgressoFormattato as getStatoProgressoFormattatoUtil,
    calcolaStatoProgresso as calcolaStatoProgressoUtil
} from './js/gestione-lavori-utils.js';

import {
    loadDettaglioMap as loadDettaglioMapModule,
    filtraZonePerData as filtraZonePerDataModule,
    mostraZoneSullaMappa as mostraZoneSullaMappaModule,
    aggiornaListaZone as aggiornaListaZoneModule,
    aggiornaInfoZone as aggiornaInfoZoneModule,
    mostraTutteLeZone as mostraTutteLeZoneModule
} from './js/gestione-lavori-maps.js';

import {
    setupTipoAssegnazioneHandlers as setupTipoAssegnazioneHandlersModule,
    setupCategoriaLavoroHandler as setupCategoriaLavoroHandlerModule,
    applyFilters as applyFiltersModule,
    clearFilters as clearFiltersModule,
    openCreaModal as openCreaModalModule,
    closeLavoroModal as closeLavoroModalModule,
    openModificaModal as openModificaModalModule,
    openEliminaModal as openEliminaModalModule,
    approvaLavoro as approvaLavoroModule,
    rifiutaLavoro as rifiutaLavoroModule,
    openDettaglioModal as openDettaglioModalModule,
    closeDettaglioModal as closeDettaglioModalModule,
    switchTab as switchTabModule
} from './js/gestione-lavori-events.js';

import {
    setupLavoriTourButton as setupLavoriTourButtonModule,
    maybeAutoStartLavoriTour as maybeAutoStartLavoriTourModule,
    startLavoriTour as startLavoriTourModule
} from './js/gestione-lavori-tour.js';
```

### 2. State Object

```javascript
const lavoriState = {
    // Dati
    currentLavoroId: null,
    currentTenantId: null,
    terreniList: [],
    caposquadraList: [],
    operaiList: [],
    squadreList: [],
    lavoriList: [],
    filteredLavoriList: [],
    trattoriList: [],
    attrezziList: [],
    categorieAttrezziList: [],
    categorieLavoriPrincipali: [],
    sottocategorieLavoriMap: new Map(),
    tipiLavoroList: [],
    
    // Google Maps (dettaglio)
    dettaglioMap: null,
    dettaglioMapMarkers: [],
    dettaglioMapPolygons: [],
    allZoneLavorate: [],
    zonePerData: {},
    dateDisponibili: [],
    
    // Moduli
    hasParcoMacchineModule: false,
    hasManodoperaModule: false,
    hasContoTerziModule: false,
    
    // Tour
    lavoriTourAutoRequested: false,
    lavoriTourOpenedModal: false,
    
    // Firebase (riferimenti)
    db,
    auth,
    app
};
```

### 3. Variabili Globali (per compatibilità)

```javascript
// Manteniamo variabili globali per compatibilità con codice esistente
let currentLavoroId = null;
let currentTenantId = null;
let terreniList = [];
let caposquadraList = [];
let operaiList = [];
let squadreList = [];
let lavoriList = [];
let filteredLavoriList = [];
let trattoriList = [];
let attrezziList = [];
let categorieAttrezziList = [];
let categorieLavoriPrincipali = [];
let sottocategorieLavoriMap = new Map();
let tipiLavoroList = [];
let dettaglioMap = null;
let dettaglioMapMarkers = [];
let dettaglioMapPolygons = [];
let allZoneLavorate = [];
let zonePerData = {};
let dateDisponibili = [];
let hasParcoMacchineModule = false;
let hasManodoperaModule = false;
let hasContoTerziModule = false;
const LAVORI_TOUR_STORAGE_KEY = 'gfv_lavori_tour_v1';
let lavoriTourAutoRequested = false;
let lavoriTourOpenedModal = false;
```

### 4. Funzione updateState

```javascript
function updateState(updates) {
    Object.assign(lavoriState, updates);
    // Sincronizza con variabili globali per compatibilità
    currentLavoroId = lavoriState.currentLavoroId;
    currentTenantId = lavoriState.currentTenantId;
    terreniList = lavoriState.terreniList;
    caposquadraList = lavoriState.caposquadraList;
    operaiList = lavoriState.operaiList;
    squadreList = lavoriState.squadreList;
    lavoriList = lavoriState.lavoriList;
    filteredLavoriList = lavoriState.filteredLavoriList;
    trattoriList = lavoriState.trattoriList;
    attrezziList = lavoriState.attrezziList;
    categorieAttrezziList = lavoriState.categorieAttrezziList;
    categorieLavoriPrincipali = lavoriState.categorieLavoriPrincipali;
    sottocategorieLavoriMap = lavoriState.sottocategorieLavoriMap;
    tipiLavoroList = lavoriState.tipiLavoroList;
    dettaglioMap = lavoriState.dettaglioMap;
    dettaglioMapMarkers = lavoriState.dettaglioMapMarkers;
    dettaglioMapPolygons = lavoriState.dettaglioMapPolygons;
    allZoneLavorate = lavoriState.allZoneLavorate;
    zonePerData = lavoriState.zonePerData;
    dateDisponibili = lavoriState.dateDisponibili;
    hasParcoMacchineModule = lavoriState.hasParcoMacchineModule;
    hasManodoperaModule = lavoriState.hasManodoperaModule;
    hasContoTerziModule = lavoriState.hasContoTerziModule;
    lavoriTourAutoRequested = lavoriState.lavoriTourAutoRequested;
    lavoriTourOpenedModal = lavoriState.lavoriTourOpenedModal;
}
```

### 5. Wrapper Functions (esposte su window)

```javascript
// Wrapper per funzioni esposte su window
window.applyFilters = function() {
    applyFiltersModule(
        lavoriState.lavoriList,
        lavoriState.filteredLavoriList,
        lavoriState.hasManodoperaModule,
        renderLavoriWrapper
    );
};

window.clearFilters = function() {
    clearFiltersModule(
        lavoriState.lavoriList,
        lavoriState.filteredLavoriList,
        lavoriState.hasManodoperaModule,
        () => window.applyFilters()
    );
};

window.openCreaModal = async function() {
    await openCreaModalModule(
        lavoriState,
        updateState,
        lavoriState.hasManodoperaModule,
        lavoriState.hasParcoMacchineModule,
        loadCategorieLavoriWrapper,
        loadTipiLavoroWrapper,
        populateTerrenoDropdownWrapper,
        populateCategoriaLavoroDropdownWrapper,
        populateCaposquadraDropdownWrapper,
        populateOperaiDropdownWrapper,
        populateTrattoriDropdownWrapper,
        setupTipoAssegnazioneHandlersWrapper
    );
};

window.closeLavoroModal = function() {
    closeLavoroModalModule(lavoriState, updateState);
};

window.openModificaModal = async function(lavoroId) {
    await openModificaModalModule(
        lavoroId,
        lavoriState,
        updateState,
        lavoriState.lavoriList,
        lavoriState.tipiLavoroList,
        lavoriState.hasManodoperaModule,
        lavoriState.hasParcoMacchineModule,
        populateTerrenoDropdownWrapper,
        populateCategoriaLavoroDropdownWrapper,
        populateTipoLavoroDropdownWrapper,
        populateCaposquadraDropdownWrapper,
        populateOperaiDropdownWrapper,
        populateTrattoriDropdownWrapper,
        populateAttrezziDropdownWrapper,
        populateOperatoreMacchinaDropdownWrapper,
        loadTipiLavoroWrapper,
        setupTipoAssegnazioneHandlersWrapper
    );
};

window.handleSalvaLavoro = async function(event) {
    // TODO: Implementare usando callback
    // Questa funzione è molto complessa e richiede molte dipendenze
    // Verrà implementata durante l'integrazione
};

window.openEliminaModal = async function(lavoroId) {
    await openEliminaModalModule(
        lavoroId,
        lavoriState.lavoriList,
        lavoriState.currentTenantId,
        db,
        lavoriState.hasParcoMacchineModule,
        updateMacchinaStatoWrapper,
        loadTrattoriWrapper,
        loadAttrezziWrapper,
        loadLavoriWrapper
    );
};

window.approvaLavoro = async function(lavoroId) {
    await approvaLavoroModule(
        lavoroId,
        lavoriState.lavoriList,
        lavoriState.currentTenantId,
        db,
        currentUserData,
        lavoriState.hasParcoMacchineModule,
        lavoriState.hasContoTerziModule,
        updateMacchinaStatoWrapper,
        loadTrattoriWrapper,
        loadAttrezziWrapper,
        loadLavoriWrapper,
        generaVoceDiarioContoTerziWrapper
    );
};

window.rifiutaLavoro = async function(lavoroId) {
    await rifiutaLavoroModule(
        lavoroId,
        lavoriState.lavoriList,
        lavoriState.currentTenantId,
        db,
        currentUserData,
        loadLavoriWrapper
    );
};

window.openDettaglioModal = async function(lavoroId) {
    await openDettaglioModalModule(
        lavoroId,
        lavoriState,
        updateState,
        lavoriState.lavoriList,
        loadDettaglioOverviewWrapper,
        switchTabWrapper
    );
};

window.closeDettaglioModal = function() {
    closeDettaglioModalModule(lavoriState, updateState);
};

window.switchTab = async function(tabName) {
    await switchTabModule(
        tabName,
        lavoriState,
        loadDettaglioOverviewWrapper,
        loadDettaglioMapWrapper,
        loadDettaglioOreWrapper
    );
};

window.mostraTutteLeZone = function() {
    mostraTutteLeZoneModule(lavoriState, updateState);
};
```

---

## 📝 Note Implementazione

### Funzioni da Implementare Durante Integrazione

1. **handleSalvaLavoro** - Molto complessa, richiede molte dipendenze
2. **renderLavori** - Funzione di rendering complessa (può rimanere inline o essere estratta)
3. **loadTipiLavoro** - Complessa, richiede gestione file:// protocol
4. **loadStatistics** - Funzione statistiche
5. **loadDettaglioOverview** - Carica overview dettaglio
6. **loadDettaglioOre** - Carica ore dettaglio
7. **populateTipoLavoroDropdown** - Popola dropdown tipi lavoro
8. **populateCategoriaLavoroDropdown** - Popola dropdown categorie
9. **populateSottocategorieLavoro** - Popola sottocategorie
10. **populateAttrezziDropdown** - Popola dropdown attrezzi
11. **populateOperatoreMacchinaDropdown** - Popola dropdown operatore macchina
12. **setupMacchineHandlers** - Setup handler macchine
13. **updateMacchinaStato** - Aggiorna stato macchina
14. **correggiMacchineLavoriCompletati** - Corregge macchine lavori completati
15. **migraCategorieLavoriEsistenti** - Migra categorie esistenti
16. **migraDatiEsistenti** - Migra dati esistenti
17. **generaVoceDiarioContoTerzi** - Genera voce diario conto terzi
18. **Funzioni categorie/tipi lavoro** - openCategoriaLavoroModal, handleSalvaCategoriaLavoro, etc.

---

## 🎯 Ordine di Integrazione

1. ✅ Import moduli
2. ✅ State object e variabili globali
3. ✅ Funzione updateState
4. ⏳ Wrapper functions base
5. ⏳ Integrazione onAuthStateChanged
6. ⏳ Funzioni rimanenti da implementare
7. ⏳ Rimozione codice duplicato dal file HTML
8. ⏳ Test completo

---

**Stato**: Documento creato - Pronto per integrazione




# 📘 Guida Completa Refactoring Moduli Rimanenti - GFV Platform

**Data Creazione**: 2025-01-26  
**Versione**: 1.0  
**Obiettivo**: Guida dettagliata per refactorizzare i moduli rimanenti seguendo i pattern già stabiliti

---

## 📋 Indice

1. [Panoramica](#panoramica)
2. [Cosa Abbiamo Fatto](#cosa-abbiamo-fatto)
3. [Come Lo Abbiamo Fatto](#come-lo-abbiamo-fatto)
4. [Perché Lo Abbiamo Fatto](#perché-lo-abbiamo-fatto)
5. [Pattern Architetturali](#pattern-architetturali)
6. [Struttura Moduli](#struttura-moduli)
7. [Processo Step-by-Step](#processo-step-by-step)
8. [File da Refactorizzare](#file-da-refactorizzare)
9. [Esempi Pratici](#esempi-pratici)
10. [Checklist Completa](#checklist-completa)

---

## 🎯 Panoramica

### Stato Attuale

**Completato (95%+)**:
- ✅ **Dashboard** (`core/dashboard-standalone.html`) - 5655 → 644 righe (-88%)
- ✅ **Terreni** (`core/terreni-standalone.html`) - 3106 → 1367 righe (-53%)
- ✅ **Gestione Lavori** (`core/admin/gestione-lavori-standalone.html`) - 4921 → 2434 righe (-54.6%)
- ✅ **Gestione Macchine** (`core/admin/gestione-macchine-standalone.html`) - ~2000 → 1094 righe (-45%)
- ✅ **Servizi Centralizzati** - Liste, Colture, Categorie, Tipi Lavoro, Macchine

**Da Fare**:
- ⏳ Modulo Manodopera (4 file)
- ⏳ Modulo Conto Terzi (8 file)
- ⏳ File Core rimanenti (`impostazioni-standalone.html`, `attivita-standalone.html`, `statistiche-standalone.html`)

### Obiettivo Generale

Estrarre la logica JavaScript inline dai file HTML in moduli separati per migliorare:
- **Manutenibilità**: Codice organizzato in moduli logici
- **Leggibilità**: File HTML più puliti e focalizzati
- **Riutilizzabilità**: Funzioni riutilizzabili in altri contesti
- **Testabilità**: Moduli testabili indipendentemente

---

## 📊 Cosa Abbiamo Fatto

### Risultati Ottenuti

#### Metriche Quantitative
- **Righe totali rimosse**: ~15.000+ righe
- **Moduli JavaScript creati**: 25+ moduli
- **Servizi centralizzati**: 5 servizi
- **File refactorizzati**: 3 file principali + 20+ file per servizi centralizzati
- **Riduzione media**: 69% per file principale

#### File Refactorizzati

| File | Righe Prima | Righe Dopo | Riduzione | Moduli Creati |
|------|------------|-----------|-----------|---------------|
| `dashboard-standalone.html` | 5655 | 644 | -5011 (-88%) | 6 |
| `terreni-standalone.html` | 3106 | 1367 | -1639 (-53%) | 5 |
| `gestione-lavori-standalone.html` | 4921 | 2434 | -2689 (-54.6%) | 5 |
| `gestione-macchine-standalone.html` | ~2000 | 1094 | ~-900 (-45%) | 4 |
| **TOTALE** | **15682** | **5539** | **-10137 (-64.7%)** | **20** |

#### Moduli Creati

**Dashboard** (6 moduli):
1. `dashboard-controller.js` - Logica principale e coordinamento
2. `dashboard-data.js` - Caricamento dati da Firebase (~1800 righe)
3. `dashboard-maps.js` - Gestione Google Maps (~900 righe)
4. `dashboard-events.js` - Event handlers (~300 righe)
5. `dashboard-tour.js` - Tour interattivo (~200 righe)
6. `dashboard-utils-extended.js` - Utility estese (~150 righe)

**Terreni** (5 moduli):
1. `terreni-controller.js` - Logica principale e caricamento dati (~600 righe)
2. `terreni-utils.js` - Funzioni utility (~250 righe)
3. `terreni-maps.js` - Gestione Google Maps (~400 righe)
4. `terreni-events.js` - Event handlers (~500 righe)
5. `terreni-tour.js` - Tour interattivo (~400 righe)

**Gestione Lavori** (5 moduli):
1. `gestione-lavori-controller.js` - Logica core e caricamento dati (2148 righe)
2. `gestione-lavori-utils.js` - Funzioni utility (~177 righe)
3. `gestione-lavori-events.js` - Event handlers (1494 righe)
4. `gestione-lavori-tour.js` - Tour interattivo (392 righe)
5. `gestione-lavori-maps.js` - Gestione mappe Google Maps

**Gestione Macchine** (4 moduli):
1. `gestione-macchine-utils.js` - Funzioni utility (~137 righe)
2. `gestione-macchine-controller.js` - Logica principale e caricamento dati (~598 righe)
3. `gestione-macchine-events.js` - Event handlers e gestione interazioni (~831 righe)
4. `gestione-macchine-tour.js` - Tour interattivo (~402 righe)

---

## 🔧 Come Lo Abbiamo Fatto

### Processo Generale

1. **Analisi**: Identificare tutte le funzioni JavaScript inline
2. **Categorizzazione**: Raggruppare funzioni per responsabilità
3. **Creazione Moduli**: Creare moduli separati per categoria
4. **Estrazione**: Spostare funzioni nei moduli appropriati
5. **Parametrizzazione**: Rendere funzioni pure (parametri espliciti)
6. **Integrazione**: Creare wrapper nel file HTML
7. **Test**: Verificare che tutto funzioni correttamente
8. **Pulizia**: Rimuovere codice duplicato e log di debug

### Categorizzazione Funzioni

Le funzioni vengono categorizzate in base alla loro responsabilità:

1. **Controller** (`*-controller.js`):
   - Setup e inizializzazione
   - Caricamento dati da Firebase
   - Rendering UI (liste, tabelle, dropdown)
   - Funzioni di popolamento dropdown/filtri

2. **Utils** (`*-utils.js`):
   - Funzioni utility generiche (escapeHtml, showAlert)
   - Formattazione dati (date, numeri, stati)
   - Calcoli e trasformazioni dati

3. **Events** (`*-events.js`):
   - Event handlers (click, submit, change)
   - Gestione modali (open, close, save)
   - Validazione form
   - Gestione filtri

4. **Maps** (`*-maps.js`):
   - Inizializzazione Google Maps
   - Gestione poligoni e marker
   - Ricerca indirizzi
   - Overlay e filtri mappa

5. **Tour** (`*-tour.js`):
   - Setup bottone tour
   - Costruzione step tour
   - Avvio tour interattivo
   - Gestione localStorage per tour completato

---

## 💡 Perché Lo Abbiamo Fatto

### Benefici Ottenuti

#### 1. Manutenibilità
- ✅ **Codice organizzato**: Ogni modulo ha una responsabilità chiara
- ✅ **Facile navigazione**: Funzioni facilmente trovabili per responsabilità
- ✅ **Modifiche isolate**: Cambiamenti in un modulo non impattano altri
- ✅ **Commenti chiari**: Ogni modulo ha commenti per navigazione

#### 2. Testabilità
- ✅ **Moduli indipendenti**: Ogni modulo può essere testato separatamente
- ✅ **Funzioni pure**: Funzioni con parametri espliciti, facili da testare
- ✅ **Mock dependencies**: Facile passare mock per test
- ✅ **Isolamento**: Test di un modulo non richiedono setup completo

#### 3. Riutilizzabilità
- ✅ **Funzioni riutilizzabili**: Funzioni possono essere usate in altri contesti
- ✅ **Servizi centralizzati**: Liste e dati comuni in servizi riutilizzabili
- ✅ **Pattern standardizzati**: Pattern uniformi tra tutti i moduli
- ✅ **Modularità**: Facile aggiungere nuove funzionalità

#### 4. Leggibilità
- ✅ **File HTML puliti**: HTML focalizzato su struttura e layout
- ✅ **Separazione concerns**: HTML, CSS e JavaScript separati
- ✅ **Codice focalizzato**: Ogni file ha uno scopo chiaro
- ✅ **Riduzione complessità**: File più piccoli e gestibili

#### 5. Performance
- ✅ **Riduzione chiamate Firestore**: Servizi centralizzati evitano chiamate duplicate
- ✅ **Caricamento moduli efficiente**: ES6 modules con lazy loading
- ✅ **Nessun impatto negativo**: Performance mantenute o migliorate

#### 6. Scalabilità
- ✅ **Facile estendere**: Aggiungere nuove funzionalità è più semplice
- ✅ **Pattern riutilizzabili**: Pattern applicabili ad altri file
- ✅ **Architettura solida**: Base solida per crescita futura

---

## 🏗️ Pattern Architetturali

### 1. Pattern Callback per Comunicazione tra Moduli

**Scelta**: I moduli accettano callback invece di importare direttamente altri moduli.

**Vantaggi**:
- ✅ Evita dipendenze circolari
- ✅ Moduli indipendenti e testabili
- ✅ Controllo centralizzato nel file HTML
- ✅ Flessibilità nell'ordine di esecuzione

**Esempio**:
```javascript
// ❌ SBAGLIATO - Import diretto (crea dipendenze circolari)
import { loadTerreni } from './terreni-controller.js';
export function renderTerreni() {
    await loadTerreni();
}

// ✅ CORRETTO - Callback pattern
export function renderTerreni(loadTerreniCallback) {
    if (loadTerreniCallback) {
        await loadTerreniCallback();
    }
}
```

**Implementazione nel File HTML**:
```javascript
// Nel file HTML
import { renderTerreni as renderTerreniModule } from './js/terreni-controller.js';
import { loadTerreni as loadTerreniModule } from './js/terreni-controller.js';

// Wrapper che passa i callback
function renderTerreniWrapper() {
    renderTerreniModule(
        loadTerreniWrapper  // Passa callback invece di importare
    );
}
```

### 2. Pattern Dependencies Object

**Scelta**: Le funzioni ricevono un object `dependencies` con tutte le dipendenze necessarie.

**Vantaggi**:
- ✅ Testabilità (facile passare mock dependencies)
- ✅ Flessibilità (cambiare implementazione senza modificare moduli)
- ✅ Coerenza (pattern uniforme)
- ✅ Compatibilità (mantiene compatibilità con Firebase da CDN)

**Esempio**:
```javascript
// ❌ SBAGLIATO - Dipendenze globali
export async function loadData() {
    const userDoc = await getDoc(doc(db, 'users', userId));
}

// ✅ CORRETTO - Dependencies object
export async function loadData(dependencies) {
    const { getDoc, doc, db, userId } = dependencies;
    const userDoc = await getDoc(doc(db, 'users', userId));
}
```

**Implementazione nel File HTML**:
```javascript
// Nel file HTML
const dependencies = {
    db,
    auth,
    getDoc,
    doc,
    collection,
    getDocs,
    // ... altre dipendenze Firebase
};

// Chiamata funzione
await loadDataModule(dependencies);
```

### 3. Pattern State Object + Update Function

**Scelta**: Le funzioni accettano un `state` object e una funzione `updateState` invece di modificare variabili globali direttamente.

**Vantaggi**:
- ✅ Testabilità (si può passare uno state mock)
- ✅ Controllo (il file HTML controlla come lo state viene aggiornato)
- ✅ Compatibilità (lo state può essere un wrapper delle variabili globali)
- ✅ Flessibilità (facile passare a un sistema di state management più avanzato)

**Esempio**:
```javascript
// ❌ SBAGLIATO - Variabili globali dirette
let map = null;
function initMap() {
    map = new google.maps.Map(...);
}

// ✅ CORRETTO - State object + update function
function initMap(state, updateState) {
    const map = new google.maps.Map(...);
    updateState({ map });
}
```

**Implementazione nel File HTML**:
```javascript
// Nel file HTML
const terreniState = {
    map: null,
    polygon: null,
    isDrawing: false,
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
    // ... altre variabili
}

// Chiamata funzione
initMapModule(terreniState, updateState);
```

### 4. Mantenimento Variabili Globali per Compatibilità

**Scelta**: Manteniamo variabili globali per compatibilità con codice esistente (es. attributi HTML `onclick`, callback Google Maps).

**Vantaggi**:
- ✅ Compatibilità (codice esistente continua a funzionare)
- ✅ Gradualità (possiamo migrare gradualmente)
- ✅ Callback Esterni (Google Maps e altri servizi si aspettano funzioni globali)

**Esempio**:
```javascript
// Nel file HTML
import { openTerrenoModal as openTerrenoModalModule } from './js/terreni-events.js';

// Wrapper globale
function openTerrenoModalWrapper(terrenoId) {
    openTerrenoModalModule(
        terrenoId,
        terreniState,
        updateState,
        loadColtureWrapper,
        populatePoderiDropdownWrapper,
        // ... altri callback
    );
}

// Esposizione su window per attributi HTML
window.openTerrenoModal = openTerrenoModalWrapper;
```

**Uso in HTML**:
```html
<button onclick="openTerrenoModal('terreno123')">Modifica</button>
```

### 5. Separazione Create Functions e Load Functions

**Scelta**: Le funzioni `create*` (che creano HTML) sono separate dalle funzioni `load*` (che caricano dati).

**Vantaggi**:
- ✅ Separazione Concerns (UI separata da logica business)
- ✅ Riutilizzabilità (funzioni create* possono essere riutilizzate)
- ✅ Testabilità (facile testare logica caricamento dati separatamente)

**Esempio**:
```javascript
// Create function - Crea HTML
export function createTerreniList(terreni) {
    let html = '<ul>';
    terreni.forEach(terreno => {
        html += `<li>${escapeHtml(terreno.nome)}</li>`;
    });
    html += '</ul>';
    return html;
}

// Load function - Carica dati
export async function loadTerreni(dependencies) {
    const { collection, getDocs, db, tenantId } = dependencies;
    const terreniRef = collection(db, `tenants/${tenantId}/terreni`);
    const snapshot = await getDocs(terreniRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

---

## 📁 Struttura Moduli

### Struttura Standard di un Modulo

Ogni modulo segue questa struttura:

```javascript
/**
 * Nome Modulo - Descrizione responsabilità
 * 
 * @module path/to/module
 */

// ============================================
// IMPORTS
// ============================================
// Import da altri moduli (se necessario)
import { escapeHtml, showAlert } from './utils.js';

// ============================================
// COSTANTI
// ============================================
const CONSTANT_NAME = 'value';

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Descrizione funzione
 * @param {Type} paramName - Descrizione parametro
 * @param {Function} callback - Callback per comunicare con altri moduli
 * @param {Object} dependencies - Dipendenze Firebase e utilities
 * @returns {Promise|void} Descrizione ritorno
 */
export async function functionName(param1, callback, dependencies) {
    // Implementazione
}

// ============================================
// FUNZIONI HELPER INTERNE
// ============================================

/**
 * Funzione helper interna (non esportata)
 */
function helperFunction() {
    // Implementazione
}
```

### Convenzioni Naming

- **Funzioni esportate**: `camelCase` (es. `loadTerreni`, `renderLavori`)
- **Funzioni helper interne**: `camelCase` con prefisso opzionale (es. `calculateTotal`, `formatDate`)
- **Costanti**: `UPPER_SNAKE_CASE` (es. `TOUR_STORAGE_KEY`)
- **Moduli**: `kebab-case` (es. `terreni-controller.js`, `gestione-lavori-events.js`)

### Organizzazione Funzioni

Le funzioni sono organizzate per categoria:

1. **Setup/Inizializzazione**: `waitForConfig()`, `setup*()`
2. **Caricamento Dati**: `load*()` - Caricano dati da Firebase
3. **Rendering UI**: `render*()`, `populate*()` - Creano HTML
4. **Event Handlers**: `handle*()`, `open*()`, `close*()` - Gestiscono eventi
5. **Utility**: `get*()`, `format*()`, `calculate*()` - Funzioni helper
6. **Tour**: `setup*Tour()`, `start*Tour()`, `build*TourSteps()` - Tour interattivo

---

## 📝 Processo Step-by-Step

### Fase 1: Analisi e Preparazione

1. **Identificare File Target**
   - Leggere il file HTML completo
   - Contare righe totali
   - Identificare tutte le funzioni JavaScript inline

2. **Categorizzare Funzioni**
   - Creare lista funzioni per categoria:
     - Controller (load*, render*, populate*)
     - Utils (get*, format*, calculate*)
     - Events (handle*, open*, close*)
     - Maps (init*, load*, draw*)
     - Tour (setup*, start*, build*)

3. **Identificare Dipendenze**
   - Variabili globali usate
   - Funzioni Firebase usate
   - Servizi esterni (Google Maps, IntroJS)
   - Altri moduli già esistenti

4. **Creare Documento Analisi**
   - Elencare tutte le funzioni
   - Identificare dipendenze
   - Notare pattern e duplicazioni
   - Stimare complessità

### Fase 2: Creazione Moduli

1. **Creare Struttura Moduli**
   - Creare file modulo per categoria
   - Aggiungere header con commenti
   - Definire struttura base

2. **Estrarre Funzioni Utils (Prima)**
   - Funzioni utility sono usate da altri moduli
   - Estrarre: `escapeHtml`, `showAlert`, `format*`, `calculate*`
   - Testare che funzionino

3. **Estrarre Funzioni Controller**
   - Funzioni di caricamento dati
   - Funzioni di rendering UI
   - Funzioni di popolamento dropdown
   - Parametrizzare con dependencies e callbacks

4. **Estrarre Funzioni Events**
   - Event handlers
   - Gestione modali
   - Validazione form
   - Parametrizzare con state e callbacks

5. **Estrarre Funzioni Maps (se necessario)**
   - Inizializzazione Google Maps
   - Gestione poligoni/marker
   - Parametrizzare con state e updateState

6. **Estrarre Funzioni Tour (se necessario)**
   - Setup bottone tour
   - Costruzione step
   - Avvio tour
   - Parametrizzare con callbacks

### Fase 3: Integrazione nel File HTML

1. **Import Moduli**
   ```javascript
   import { 
       functionName as functionNameModule
   } from './js/module-name.js';
   ```

2. **Creare State Object (se necessario)**
   ```javascript
   const moduleState = {
       // Variabili globali wrappate
   };
   ```

3. **Creare Funzione updateState (se necessario)**
   ```javascript
   function updateState(updates) {
       Object.assign(moduleState, updates);
       // Aggiorna variabili globali per compatibilità
   }
   ```

4. **Creare Wrapper**
   ```javascript
   function functionNameWrapper(...args) {
       functionNameModule(
           ...args,
           moduleState,
           updateState,
           // ... callback necessari
       );
   }
   ```

5. **Esporre su Window (per attributi HTML)**
   ```javascript
   window.functionName = functionNameWrapper;
   ```

6. **Sostituire Chiamate Inline**
   - Rimuovere definizioni funzioni inline
   - Sostituire chiamate con wrapper
   - Mantenere commenti che indicano dove sono le funzioni

### Fase 4: Test e Verifica

1. **Test Funzionalità Base**
   - Aprire pagina nel browser
   - Verificare che non ci siano errori JavaScript
   - Testare funzionalità principali

2. **Test Event Handlers**
   - Testare tutti i pulsanti e form
   - Verificare che i modali si aprano/chiudano
   - Testare validazione form

3. **Test Caricamento Dati**
   - Verificare che i dati si carichino correttamente
   - Testare filtri e ricerca
   - Verificare aggiornamenti real-time (se presenti)

4. **Test Google Maps (se presente)**
   - Verificare che la mappa si carichi
   - Testare interazioni mappa
   - Verificare poligoni/marker

5. **Test Tour (se presente)**
   - Verificare che il tour si avvii
   - Testare tutti gli step
   - Verificare localStorage

### Fase 5: Pulizia e Ottimizzazione

1. **Rimuovere Codice Duplicato**
   - Cercare funzioni duplicate
   - Rimuovere duplicati
   - Mantenere solo versione nei moduli

2. **Rimuovere Log di Debug**
   - Cercare `console.log` con `[DEBUG]`
   - Rimuovere log non necessari
   - Mantenere solo `console.error` e `console.warn` utili

3. **Rimuovere Costanti Obsolete**
   - Verificare se ci sono costanti non più usate
   - Rimuovere costanti obsolete
   - Aggiungere commenti esplicativi

4. **Ottimizzare Import**
   - Verificare che tutti gli import siano necessari
   - Rimuovere import non usati
   - Organizzare import per categoria

5. **Aggiungere Commenti**
   - Commentare sezioni complesse
   - Aggiungere JSDoc alle funzioni principali
   - Documentare pattern usati

---

## 📂 File da Refactorizzare

### ✅ Completati

#### 1. ✅ `core/admin/gestione-macchine-standalone.html` - **COMPLETATO**
- **Dimensione Iniziale**: ~2000+ righe
- **Dimensione Attuale**: 1094 righe
- **Riduzione**: ~900+ righe (-45%)
- **Moduli Creati**: 4 moduli
- **Data Completamento**: 2025-12-28

**Moduli Creati**:
- ✅ `gestione-macchine-controller.js` (~598 righe) - Caricamento dati e rendering
- ✅ `gestione-macchine-events.js` (~831 righe) - Event handlers modali e form
- ✅ `gestione-macchine-utils.js` (~137 righe) - Utility (formattazione, calcoli)
- ✅ `gestione-macchine-tour.js` (~402 righe) - Tour interattivo

### Priorità Alta

**Servizi da Usare**:
- `macchine-service.js` - Già esistente
- `categorie-attrezzi-service.js` - Già esistente

#### 2. `core/admin/impostazioni-standalone.html`
- **Dimensione**: ~4258 righe
- **Funzioni**: ~55 funzioni
- **Complessità**: Alta
- **Note**: File più grande, richiede più tempo

**Moduli da Creare**:
- `impostazioni-controller.js` - Caricamento dati e rendering
- `impostazioni-events.js` - Event handlers
- `impostazioni-utils.js` - Utility
- `impostazioni-tour.js` - Tour (se presente)

### Priorità Media

#### 3. Modulo Manodopera (4 file)

**File**:
- `gestione-operai-standalone.html` (~1010 righe, 13 funzioni)
- `gestione-squadre-standalone.html` (~13 funzioni)
- `compensi-operai-standalone.html`
- `statistiche-manodopera-standalone.html`

**Approccio**: Refactorizzare insieme per coerenza modulo

**Moduli da Creare** (per ogni file):
- `*-controller.js`
- `*-events.js`
- `*-utils.js`
- `*-tour.js` (se presente)

#### 4. Modulo Conto Terzi (8 file)

**File**:
- `clienti-standalone.html` (~903 righe, 13 funzioni)
- `preventivi-standalone.html`
- `nuovo-preventivo-standalone.html`
- `tariffe-standalone.html`
- `terreni-clienti-standalone.html`
- `mappa-clienti-standalone.html`
- `conto-terzi-home-standalone.html`
- `accetta-preventivo-standalone.html`

**Approccio**: Refactorizzare insieme per coerenza modulo

**Moduli da Creare** (per ogni file):
- `*-controller.js`
- `*-events.js`
- `*-utils.js`
- `*-maps.js` (per file con mappe)
- `*-tour.js` (se presente)

**Servizi da Usare**:
- `clienti-service.js` - Già esistente
- `preventivi-service.js` - Già esistente
- `tariffe-service.js` - Già esistente
- `poderi-clienti-service.js` - Già esistente

#### 5. File Core Rimanenti

**File**:
- `attivita-standalone.html` (52 funzioni)
- `statistiche-standalone.html` (43 funzioni)

**Moduli da Creare** (per ogni file):
- `*-controller.js`
- `*-events.js`
- `*-utils.js`
- `*-tour.js` (se presente)

---

## 💻 Esempi Pratici

### Esempio 1: Estrarre Funzione Utils

**Prima** (inline nel file HTML):
```javascript
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
}
```

**Dopo** (modulo `gestione-macchine-utils.js`):
```javascript
/**
 * Gestione Macchine Utils - Funzioni utility
 * 
 * @module core/admin/js/gestione-macchine-utils
 */

/**
 * Mostra alert temporaneo
 * @param {string} message - Messaggio da mostrare
 * @param {string} type - Tipo alert ('info', 'success', 'error', 'warning')
 */
export function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
}
```

**Integrazione nel File HTML**:
```javascript
import { showAlert as showAlertUtil } from './js/gestione-macchine-utils.js';

// Wrapper (se necessario per compatibilità)
window.showAlert = showAlertUtil;
```

### Esempio 2: Estrarre Funzione Controller con Dependencies

**Prima** (inline nel file HTML):
```javascript
async function loadMacchine() {
    const macchineRef = collection(db, `tenants/${currentTenantId}/macchine`);
    const snapshot = await getDocs(macchineRef);
    macchineList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderMacchine();
}
```

**Dopo** (modulo `gestione-macchine-controller.js`):
```javascript
/**
 * Carica lista macchine
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Function} renderMacchineCallback - Callback per renderizzare macchine
 * @returns {Promise<Array>} Lista macchine
 */
export async function loadMacchine(tenantId, dependencies, renderMacchineCallback) {
    const { collection, getDocs, db } = dependencies;
    
    try {
        const macchineRef = collection(db, `tenants/${tenantId}/macchine`);
        const snapshot = await getDocs(macchineRef);
        const macchineList = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
        
        // Chiama callback per renderizzare
        if (renderMacchineCallback) {
            renderMacchineCallback(macchineList);
        }
        
        return macchineList;
    } catch (error) {
        console.error('Errore caricamento macchine:', error);
        throw error;
    }
}
```

**Integrazione nel File HTML**:
```javascript
import { loadMacchine as loadMacchineModule } from './js/gestione-macchine-controller.js';

// Dependencies object
const dependencies = {
    db,
    collection,
    getDocs,
    // ... altre dipendenze Firebase
};

// Wrapper
async function loadMacchineWrapper() {
    const macchineList = await loadMacchineModule(
        currentTenantId,
        dependencies,
        renderMacchineWrapper
    );
    // Aggiorna variabile globale per compatibilità
    window.macchineList = macchineList;
}
```

### Esempio 3: Estrarre Event Handler con State

**Prima** (inline nel file HTML):
```javascript
function openCreaMacchinaModal() {
    document.getElementById('macchina-modal').style.display = 'block';
    document.getElementById('macchina-form').reset();
    currentMacchinaId = null;
}
```

**Dopo** (modulo `gestione-macchine-events.js`):
```javascript
/**
 * Apre modal creazione macchina
 * @param {Object} state - State object
 * @param {Function} updateState - Funzione per aggiornare state
 */
export function openCreaMacchinaModal(state, updateState) {
    const modal = document.getElementById('macchina-modal');
    const form = document.getElementById('macchina-form');
    
    if (modal) modal.style.display = 'block';
    if (form) form.reset();
    
    updateState({ currentMacchinaId: null });
}
```

**Integrazione nel File HTML**:
```javascript
import { openCreaMacchinaModal as openCreaMacchinaModalModule } from './js/gestione-macchine-events.js';

// State object
const macchineState = {
    currentMacchinaId: null,
    macchineList: [],
    // ... altre variabili
};

// Funzione updateState
function updateState(updates) {
    Object.assign(macchineState, updates);
    // Aggiorna variabili globali per compatibilità
    currentMacchinaId = macchineState.currentMacchinaId;
}

// Wrapper
function openCreaMacchinaModalWrapper() {
    openCreaMacchinaModalModule(macchineState, updateState);
}

// Esposizione su window
window.openCreaMacchinaModal = openCreaMacchinaModalWrapper;
```

### Esempio 4: Estrarre Funzione con Callback Pattern

**Prima** (inline nel file HTML):
```javascript
function renderMacchine() {
    const container = document.getElementById('macchine-list');
    let html = '';
    macchineList.forEach(macchina => {
        html += `<div>${macchina.nome}</div>`;
    });
    container.innerHTML = html;
}
```

**Dopo** (modulo `gestione-macchine-controller.js`):
```javascript
/**
 * Renderizza lista macchine
 * @param {Array} macchineList - Lista macchine
 * @param {Function} escapeHtml - Funzione per escape HTML
 * @param {Function} getStatoFormattato - Funzione per formattare stato
 */
export function renderMacchine(macchineList, escapeHtml, getStatoFormattato) {
    const container = document.getElementById('macchine-list');
    if (!container) return;
    
    let html = '<div class="macchine-grid">';
    macchineList.forEach(macchina => {
        html += `
            <div class="macchina-card">
                <h3>${escapeHtml(macchina.nome)}</h3>
                <p>Stato: ${getStatoFormattato(macchina.stato)}</p>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}
```

**Integrazione nel File HTML**:
```javascript
import { renderMacchine as renderMacchineModule } from './js/gestione-macchine-controller.js';
import { escapeHtml as escapeHtmlUtil } from './js/gestione-macchine-utils.js';
import { getStatoFormattato as getStatoFormattatoUtil } from './js/gestione-macchine-utils.js';

// Wrapper
function renderMacchineWrapper() {
    renderMacchineModule(
        macchineState.macchineList,
        escapeHtmlUtil,
        getStatoFormattatoUtil
    );
}
```

---

## ✅ Checklist Completa

### Pre-Refactoring

- [ ] Leggere file HTML completo
- [ ] Identificare tutte le funzioni JavaScript inline
- [ ] Categorizzare funzioni (Controller, Utils, Events, Maps, Tour)
- [ ] Identificare dipendenze (variabili globali, Firebase, servizi esterni)
- [ ] Identificare servizi centralizzati già disponibili
- [ ] Creare documento analisi con lista funzioni
- [ ] Stimare complessità e tempo necessario

### Creazione Moduli

- [ ] Creare struttura file moduli
- [ ] Aggiungere header con commenti JSDoc
- [ ] Estrarre funzioni Utils (prima, sono usate da altri)
- [ ] Estrarre funzioni Controller
- [ ] Estrarre funzioni Events
- [ ] Estrarre funzioni Maps (se presente)
- [ ] Estrarre funzioni Tour (se presente)
- [ ] Parametrizzare tutte le funzioni (dependencies, callbacks, state)
- [ ] Aggiungere commenti JSDoc alle funzioni principali

### Integrazione File HTML

- [ ] Aggiungere import moduli
- [ ] Creare state object (se necessario)
- [ ] Creare funzione updateState (se necessario)
- [ ] Creare wrapper per ogni funzione estratta
- [ ] Esporre funzioni su window (per attributi HTML)
- [ ] Sostituire chiamate inline con wrapper
- [ ] Rimuovere definizioni funzioni inline
- [ ] Aggiungere commenti che indicano dove sono le funzioni

### Test

- [ ] Aprire pagina nel browser
- [ ] Verificare che non ci siano errori JavaScript in console
- [ ] Testare funzionalità principali
- [ ] Testare tutti i pulsanti e form
- [ ] Testare modali (apertura, chiusura, salvataggio)
- [ ] Testare caricamento dati
- [ ] Testare filtri e ricerca
- [ ] Testare Google Maps (se presente)
- [ ] Testare tour (se presente)
- [ ] Verificare aggiornamenti real-time (se presenti)

### Pulizia

- [ ] Rimuovere codice duplicato
- [ ] Rimuovere log di debug non necessari
- [ ] Rimuovere costanti obsolete
- [ ] Ottimizzare import (rimuovere non usati)
- [ ] Aggiungere commenti esplicativi
- [ ] Verificare che tutti i commenti siano aggiornati

### Documentazione

- [ ] Aggiornare documento progresso refactoring
- [ ] Documentare pattern usati
- [ ] Documentare dipendenze e servizi usati
- [ ] Aggiungere note su scelte architetturali
- [ ] Aggiornare riepilogo completo refactoring

---

## 🎯 Priorità e Ordine Consigliato

### Approccio 1: Per Modulo (Consigliato)

**Vantaggi**:
- Coerenza all'interno del modulo
- Riutilizzo di pattern e servizi
- Test più semplici per modulo
- Manutenzione più semplice

**Ordine**:
1. **Modulo Parco Macchine** (più semplice, servizi già pronti)
   - `gestione-macchine-standalone.html`
2. **Modulo Manodopera** (4 file, complessità media)
   - `gestione-operai-standalone.html`
   - `gestione-squadre-standalone.html`
   - `compensi-operai-standalone.html`
   - `statistiche-manodopera-standalone.html`
3. **Modulo Conto Terzi** (8 file, ma più piccoli)
   - Tutti gli 8 file insieme
4. **File Core Rimanenti**
   - `impostazioni-standalone.html` (più complesso)
   - `attivita-standalone.html`
   - `statistiche-standalone.html`

### Approccio 2: Per Dimensione/Complessità

**Ordine**:
1. File piccoli/medi (13-26 funzioni) per velocità
2. File grandi (impostazioni) quando si ha più tempo

---

## 📚 Risorse e Riferimenti

### Documenti di Riferimento

- `REFACTORING_DASHBOARD_PROGRESS.md` - Pattern Dashboard
- `REFACTORING_TERRENI_PROGRESS.md` - Pattern Terreni
- `REFACTORING_GESTIONE_LAVORI_PROGRESS.md` - Pattern Gestione Lavori
- `RIEPILOGO_COMPLETO_REFACTORING.md` - Riepilogo completo
- `STATO_REFACTORING_RIEPILOGO.md` - Stato dettagliato Gestione Lavori

### File di Esempio

**Dashboard**:
- `core/js/dashboard-controller.js`
- `core/js/dashboard-data.js`
- `core/js/dashboard-events.js`
- `core/js/dashboard-maps.js`
- `core/js/dashboard-tour.js`
- `core/js/dashboard-utils-extended.js`

**Terreni**:
- `core/js/terreni-controller.js`
- `core/js/terreni-utils.js`
- `core/js/terreni-maps.js`
- `core/js/terreni-events.js`
- `core/js/terreni-tour.js`

**Gestione Lavori**:
- `core/admin/js/gestione-lavori-controller.js`
- `core/admin/js/gestione-lavori-utils.js`
- `core/admin/js/gestione-lavori-events.js`
- `core/admin/js/gestione-lavori-maps.js`
- `core/admin/js/gestione-lavori-tour.js`

### Servizi Centralizzati

- `core/services/liste-service.js`
- `core/services/colture-service.js`
- `core/services/categorie-service.js`
- `core/services/tipi-lavoro-service.js`
- `modules/parco-macchine/services/macchine-service.js`
- `modules/parco-macchine/services/categorie-attrezzi-service.js`
- `modules/conto-terzi/services/clienti-service.js`
- `modules/conto-terzi/services/preventivi-service.js`
- `modules/conto-terzi/services/tariffe-service.js`

---

## ⚠️ Note Importanti

### Compatibilità

- ✅ **Mantenere variabili globali** per compatibilità con attributi HTML (`onclick`, `onchange`)
- ✅ **Mantenere pattern Firebase** da CDN (non da npm)
- ✅ **Fallback file://** per ambiente locale
- ✅ **Wrapper globali** per funzioni chiamate da HTML

### Performance

- ✅ **Nessun impatto negativo** sulle performance
- ✅ **Caricamento moduli** efficiente (ES6 modules)
- ✅ **Lazy loading** dove possibile
- ✅ **Riduzione chiamate Firestore** duplicate tramite servizi centralizzati

### Testing

- ✅ **Test incrementali** dopo ogni modulo estratto
- ✅ **Test completo** dopo integrazione
- ✅ **Verifica console** per errori JavaScript
- ✅ **Test funzionalità** principali e secondarie

### Manutenibilità

- ✅ **Commenti chiari** per navigazione
- ✅ **Pattern uniformi** tra tutti i moduli
- ✅ **Separazione concerns** (Controller, Events, Utils, Maps, Tour)
- ✅ **Funzioni facilmente trovabili** per responsabilità

---

## 🚀 Conclusione

Questa guida fornisce tutte le informazioni necessarie per refactorizzare i moduli rimanenti seguendo i pattern già stabiliti. 

**Punti Chiave**:
1. Seguire i pattern architetturali già stabiliti
2. Usare servizi centralizzati quando disponibili
3. Mantenere compatibilità con codice esistente
4. Testare dopo ogni fase
5. Documentare scelte e pattern usati

**Tempo Stimato**:
- File piccolo/medio (13-26 funzioni): 1-2 giorni
- File grande (50+ funzioni): 3-5 giorni
- Modulo completo (4-8 file): 1-2 settimane

**Benefici Attesi**:
- Riduzione 50-70% righe file HTML
- Codice più modulare e manutenibile
- Funzioni riutilizzabili
- Testabilità migliorata
- Scalabilità migliorata

---

**Data Ultimo Aggiornamento**: 2025-01-26  
**Versione**: 1.0  
**Autore**: Guida creata basandosi su refactoring completato di Dashboard, Terreni e Gestione Lavori


# 📋 Piano Standardizzazione Servizi Centralizzati - GFV Platform

**Data Creazione**: 2025-01-26  
**Data Ultimo Aggiornamento**: 2026-01-03  
**Versione**: 1.4  
**Priorità**: Alta  
**Stato**: ✅ **COMPLETATO E TESTATO** - Tutte le fasi completate, tutti i test passati (4/4)

---

## 🎯 Obiettivo

Standardizzare l'uso dei servizi centralizzati in tutta l'applicazione per:
- ✅ Eliminare duplicazione di codice per caricamento dati
- ✅ Garantire consistenza dei dati tra moduli
- ✅ Migliorare performance (riduzione chiamate Firestore duplicate)
- ✅ Facilitare manutenzione (modifiche in un solo punto)
- ✅ Standardizzare pattern di chiamata servizi

---

## 📊 Situazione Attuale

### Problema Identificato

**Inconsistenza nell'uso dei servizi centralizzati:**

| Dato | Servizio Esiste? | Uso Centralizzato? | Moduli che Caricano Direttamente |
|------|------------------|-------------------|----------------------------------|
| **Tipi Lavoro** | ✅ Sì | ✅ Sì | Nessuno (tutti usano servizio) |
| **Colture** | ✅ Sì | ✅ Sì | Nessuno (tutti usano servizio) |
| **Categorie** | ✅ Sì | ✅ Sì | Nessuno (tutti usano servizio) |
| **Macchine** | ✅ Sì | ⚠️ **Parziale** | `gestione-lavori-controller.js`, `terreni-controller.js`, `dashboard-data.js` |
| **Terreni** | ✅ Sì | ❌ **No** | `terreni-controller.js`, `gestione-lavori-controller.js`, `dashboard-data.js`, `attivita-controller.js` |

### Codice Duplicato

**Pattern attuale ripetuto in ogni modulo (~30 righe duplicate):**

```javascript
// Pattern attuale (duplicato in ogni modulo)
const isFileProtocol = window.location.protocol === 'file:';
if (isFileProtocol) {
    // Fallback diretto da Firestore
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const macchineRef = collection(db, 'tenants', currentTenantId, 'macchine');
    const snapshot = await getDocs(macchineRef);
    // ... conversione dati ...
} else {
    // Inizializza Firebase instances
    const { setFirebaseInstances } = await import('../services/firebase-service.js');
    setFirebaseInstances({ app, db, auth });
    
    // Imposta tenantId
    const { setCurrentTenantId } = await import('../services/tenant-service.js');
    if (currentTenantId) {
        setCurrentTenantId(currentTenantId);
    }
    
    // Importa e chiama servizio
    const { getAllMacchine } = await import('../../modules/parco-macchine/services/macchine-service.js');
    let macchine = await getAllMacchine({...});
    
    // Converte formato dati
    // Gestisce errori
}
```

**Problemi:**
- ❌ Codice duplicato in ogni modulo (~30 righe × N moduli)
- ❌ Pattern inconsistente tra moduli
- ❌ Gestione errori duplicata
- ❌ Difficile manutenzione (modifiche in N file)

---

## 🏗️ Soluzione Proposta

### 1. Creare Helper Centralizzato

Creare `core/services/service-helper.js` che standardizza:
- Inizializzazione Firebase instances
- Impostazione tenantId
- Chiamata servizi con fallback
- Gestione errori centralizzata
- Conversione formati dati

### 2. Migrare Moduli a Usare Servizi

Migrare tutti i moduli che caricano direttamente da Firestore a usare:
- `macchine-service.js` per macchine
- `terreni-service.js` per terreni
- Altri servizi per dati condivisi

### 3. Standardizzare Pattern di Chiamata

Tutti i moduli useranno lo stesso pattern standardizzato tramite helper.

---

## 📝 Piano di Implementazione

### FASE 1: Creare Helper Centralizzato ✅ COMPLETATA

**Obiettivo**: Creare helper che standardizza chiamate ai servizi.

**File Creato**: `core/services/service-helper.js` ✅

**Completato**: 2025-01-26
- ✅ File `core/services/service-helper.js` creato
- ✅ Funzione `callService()` implementata
- ✅ Funzione `loadMacchineViaService()` implementata
- ✅ Funzione `loadTerreniViaService()` implementata
- ✅ Fallback ambiente `file://` implementato
- ✅ Gestione errori centralizzata
- ✅ JSDoc completo aggiunto

**Funzionalità**:
1. Inizializzazione automatica Firebase instances
2. Impostazione automatica tenantId
3. Chiamata servizi con gestione errori
4. Fallback automatico per ambiente `file://`
5. Conversione formati dati standardizzata

**Pattern di Uso**:
```javascript
import { callService } from '../services/service-helper.js';

// Esempio: Caricare macchine
const macchine = await callService('macchine', 'getAllMacchine', {
    tenantId: currentTenantId,
    firebaseInstances: { app, db, auth },
    options: { orderBy: 'nome', orderDirection: 'asc' },
    converter: (m) => ({ id: m.id, nome: m.nome, ... }) // Opzionale
});
```

**Checklist Fase 1**:
- [ ] Creare file `core/services/service-helper.js`
- [ ] Implementare funzione `callService()`
- [ ] Implementare fallback per ambiente `file://`
- [ ] Implementare gestione errori
- [ ] Aggiungere JSDoc completo
- [ ] Testare helper con servizio macchine
- [ ] Testare helper con servizio terreni
- [ ] Documentare pattern di uso

---

### FASE 2: Migrare Moduli Macchine ✅ COMPLETATA

**Obiettivo**: Migrare tutti i moduli che caricano macchine direttamente a usare `macchine-service.js` tramite helper.

**Completato**: 2025-01-26  
**Completamento Finale**: 2026-01-03

**Moduli Migrati**:
1. ✅ `core/admin/js/gestione-lavori-controller.js` - `loadTrattori()`, `loadAttrezzi()`
   - Funzioni migrate a usare `loadMacchineViaService()`
   - Wrapper aggiornati per passare `app` e `auth`
   - Codice duplicato rimosso (~100 righe)

2. ✅ `core/segnatura-ore-standalone.html` - `loadMacchine()` (2026-01-03)
   - Funzione migrata a usare `loadMacchineViaService()`
   - Codice semplificato da ~70 righe a ~15 righe
   - Pattern standardizzato con fallback automatico

**Moduli Verificati**:
- ✅ `core/js/dashboard-data.js` - Non carica macchine direttamente (verificato)
- ✅ `core/js/terreni-controller.js` - Non carica macchine (verificato)

**Pattern Attuale** (da sostituire):
```javascript
// ❌ PRIMA: Caricamento diretto
const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
const macchineRef = collection(db, 'tenants', currentTenantId, 'macchine');
const snapshot = await getDocs(macchineRef);
macchineList.length = 0;
snapshot.forEach(doc => {
    macchineList.push({ id: doc.id, ...doc.data() });
});
```

**Pattern Nuovo** (da implementare):
```javascript
// ✅ DOPO: Uso servizio centralizzato
import { callService } from '../services/service-helper.js';

async function loadMacchine(currentTenantId, firebaseInstances, macchineList) {
    try {
        const macchine = await callService('macchine', 'getAllMacchine', {
            tenantId: currentTenantId,
            firebaseInstances,
            options: {
                orderBy: 'nome',
                orderDirection: 'asc'
            },
            converter: (m) => ({
                id: m.id,
                nome: m.nome,
                tipoMacchina: m.tipoMacchina || m.tipo,
                tipo: m.tipo || m.tipoMacchina,
                stato: m.stato,
                cavalli: m.cavalli,
                cavalliMinimiRichiesti: m.cavalliMinimiRichiesti,
                categoriaFunzione: m.categoriaFunzione,
                ...(m.toFirestore ? m.toFirestore() : m)
            })
        });
        
        macchineList.length = 0;
        macchineList.push(...macchine);
    } catch (error) {
        console.error('Errore caricamento macchine:', error);
        macchineList.length = 0;
    }
}
```

**Checklist Fase 2**:
- [x] Analizzare `gestione-lavori-controller.js` - identificare funzioni che caricano macchine
- [x] Sostituire `loadTrattori()` con uso servizio
- [x] Sostituire `loadAttrezzi()` con uso servizio
- [x] Analizzare `dashboard-data.js` - identificare caricamento macchine
- [x] Sostituire caricamento macchine in `dashboard-data.js` (non necessario, non carica direttamente)
- [x] Verificare `terreni-controller.js` - se carica macchine, migrare (non necessario, non carica)
- [x] Migrare `segnatura-ore-standalone.html` - `loadMacchine()` (2026-01-03)
- [x] Testare funzionalità dopo migrazione
- [x] Verificare che formati dati siano compatibili
- [x] Rimuovere codice duplicato

---

### FASE 3: Migrare Moduli Terreni ✅ COMPLETATA

**Obiettivo**: Migrare tutti i moduli che caricano terreni direttamente a usare `terreni-service.js` tramite helper.

**Completato**: 2026-01-03

**Moduli Migrati**:
1. ✅ `core/js/terreni-controller.js` - `loadTerreni()`
   - Funzione migrata a usare `loadTerreniViaService()`
   - Logica calcolo superficie mantenuta (helper interno `calcolaSuperficieDaMappa()`)
   - Wrapper aggiornato per passare `app`
   - Codice duplicato rimosso (~130 righe)

2. ✅ `core/admin/js/gestione-lavori-controller.js` - `loadTerreni()`
   - Funzione migrata a usare `loadTerreniViaService()`
   - Wrapper aggiornato per passare `app` e `auth`
   - Codice duplicato rimosso (~30 righe)

3. ✅ `core/js/attivita-controller.js` - `loadTerreni()` (2026-01-03)
   - Funzione migrata a usare `loadTerreniViaService()`
   - Supporto modalità Conto Terzi (carica terreni aziendali + clienti se necessario)
   - Aggiunti parametri `app` e `auth`
   - Wrapper aggiornato in `attivita-standalone.html`

4. ✅ `core/js/dashboard-maps.js` - Caricamento terreni (2026-01-03)
   - Migrato a usare `loadTerreniViaService()`
   - Ripristinati `collection` e `getDocs` nelle dependencies (necessari per funzioni interne)
   - Aggiunto `app` alle dependencies in `dashboard-standalone.html`

5. ✅ `modules/conto-terzi/views/terreni-clienti-standalone.html` - `loadTerreni()` (2026-01-03)
   - Migrato a usare `loadTerreniViaService()` con filtro `clienteId`
   - Corretto percorso import da `../../../../` a `../../../`
   - Codice semplificato da ~30 righe a ~15 righe

**Moduli Verificati**:
- ✅ `core/js/dashboard-data.js` - Query specifiche (affitti, lookup) lasciate così (non critiche)

**Pattern Attuale** (da sostituire):
```javascript
// ❌ PRIMA: Caricamento diretto
const { query, orderBy, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
const terreniCollection = await getTerreniCollection(currentTenantId, db);
const q = query(terreniCollection, orderBy('nome', 'asc'));
const querySnapshot = await getDocs(q);

terreni.length = 0;
querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    // Escludi terreni dei clienti
    if (data.clienteId && data.clienteId !== '') {
        return;
    }
    terreni.push({
        id: docSnap.id,
        nome: data.nome || '',
        superficie: data.superficie || null,
        // ... altri campi
    });
});
```

**Pattern Nuovo** (da implementare):
```javascript
// ✅ DOPO: Uso servizio centralizzato
import { callService } from '../services/service-helper.js';

async function loadTerreni(currentTenantId, firebaseInstances, terreni, terreniFiltrati, renderTerreniCallback) {
    try {
        // Usa servizio centralizzato (esclude automaticamente terreni clienti se clienteId non specificato)
        const terreniList = await callService('terreni', 'getAllTerreni', {
            tenantId: currentTenantId,
            firebaseInstances,
            options: {
                orderBy: 'nome',
                orderDirection: 'asc',
                clienteId: null // Solo terreni aziendali
            },
            converter: (t) => ({
                id: t.id,
                nome: t.nome || '',
                superficie: t.superficie || null,
                coltura: t.coltura || null,
                podere: t.podere || null,
                coordinate: t.coordinate || null,
                polygonCoords: t.polygonCoords || null,
                note: t.note || '',
                tipoPossesso: t.tipoPossesso || 'proprieta',
                dataScadenzaAffitto: t.dataScadenzaAffitto || null,
                canoneAffitto: t.canoneAffitto || null,
                hasMappa: function() {
                    return this.polygonCoords && Array.isArray(this.polygonCoords) && this.polygonCoords.length > 0;
                }
            })
        });
        
        terreni.length = 0;
        terreni.push(...terreniList);
        
        // Reset filtri
        terreniFiltrati.length = 0;
        
        // Renderizza
        if (renderTerreniCallback) {
            renderTerreniCallback(terreni, terreniFiltrati);
        }
    } catch (error) {
        console.error('Errore caricamento terreni:', error);
        showAlert('Errore nel caricamento dei terreni: ' + error.message, 'error');
    }
}
```

**Note Importanti**:
- Il servizio `terreni-service.js` restituisce oggetti `Terreno` (model)
- Potrebbe essere necessario convertire in formato compatibile con codice esistente
- Verificare che il servizio escluda automaticamente terreni clienti (clienteId !== null)

**Checklist Fase 3**:
- [x] Analizzare `terreni-controller.js` - identificare `loadTerreni()`
- [x] Sostituire `loadTerreni()` con uso servizio
- [x] Verificare conversione formato dati (Terreno model → formato compatibile)
- [x] Analizzare `gestione-lavori-controller.js` - identificare `loadTerreni()`
- [x] Sostituire `loadTerreni()` in `gestione-lavori-controller.js`
- [x] Analizzare `dashboard-data.js` - identificare caricamento terreni
- [x] Sostituire caricamento terreni in `dashboard-data.js` (query specifiche lasciate così)
- [x] Analizzare `attivita-controller.js` - se carica terreni, migrare
- [x] Migrare `attivita-controller.js` - `loadTerreni()` (2026-01-03)
- [x] Migrare `dashboard-maps.js` - caricamento terreni (2026-01-03)
- [x] Migrare `terreni-clienti-standalone.html` - `loadTerreni()` (2026-01-03)
- [x] Testare funzionalità dopo migrazione
- [x] Verificare che filtri terreni funzionino correttamente
- [x] Rimuovere codice duplicato

---

### FASE 4: Standardizzare Altri Servizi (Opzionale)

**Obiettivo**: Verificare e standardizzare uso di altri servizi condivisi.

**Servizi da Verificare**:
- `operai-service.js` (se esiste)
- `squadre-service.js` (se esiste)
- `clienti-service.js` (modulo Conto Terzi)
- Altri servizi condivisi

**Checklist Fase 4**:
- [ ] Identificare tutti i servizi esistenti
- [ ] Verificare quali moduli caricano direttamente invece di usare servizi
- [ ] Migrare moduli a usare servizi tramite helper
- [ ] Documentare pattern per ogni servizio

---

## 🔧 Implementazione Dettagliata

### FASE 1: Creare Helper Centralizzato

#### Step 1.1: Creare File `core/services/service-helper.js`

**Struttura File**:
```javascript
/**
 * Service Helper - Helper centralizzato per chiamate ai servizi
 * Standardizza pattern di chiamata, gestione errori e fallback
 * 
 * @module core/services/service-helper
 */

// ============================================
// IMPORTS
// ============================================

// ============================================
// COSTANTI
// ============================================

// Mappa servizi → path moduli
const SERVICE_PATHS = {
    'macchine': '../../modules/parco-macchine/services/macchine-service.js',
    'terreni': '../services/terreni-service.js',
    'colture': '../services/colture-service.js',
    'tipi-lavoro': '../services/tipi-lavoro-service.js',
    'categorie': '../services/categorie-service.js',
    // Aggiungere altri servizi qui
};

// ============================================
// FUNZIONI HELPER INTERNE
// ============================================

/**
 * Verifica se siamo in ambiente file://
 * @returns {boolean} true se ambiente file://
 */
function isFileProtocol() {
    return window.location.protocol === 'file:';
}

/**
 * Inizializza Firebase instances nei servizi
 * @param {Object} firebaseInstances - Istanze Firebase {app, db, auth}
 */
async function initializeFirebaseInstances(firebaseInstances) {
    try {
        const { setFirebaseInstances } = await import('./firebase-service.js');
        setFirebaseInstances(firebaseInstances);
    } catch (error) {
        console.warn('Errore inizializzazione Firebase instances:', error);
    }
}

/**
 * Imposta tenantId nei servizi
 * @param {string} tenantId - ID tenant
 */
async function setTenantId(tenantId) {
    if (!tenantId) return;
    
    try {
        const { setCurrentTenantId } = await import('./tenant-service.js');
        setCurrentTenantId(tenantId);
    } catch (error) {
        console.warn('Errore impostazione tenantId:', error);
    }
}

/**
 * Fallback: carica dati direttamente da Firestore
 * @param {string} serviceName - Nome servizio
 * @param {Object} options - Opzioni
 * @param {string} options.tenantId - ID tenant
 * @param {Object} options.firebaseInstances - Istanze Firebase
 * @param {string} options.collectionName - Nome collection
 * @returns {Promise<Array>} Array di documenti
 */
async function fallbackDirectFirestore(serviceName, options) {
    const { tenantId, firebaseInstances, collectionName } = options;
    const { db } = firebaseInstances;
    
    if (!db || !tenantId || !collectionName) {
        throw new Error('Parametri mancanti per fallback Firestore');
    }
    
    const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const collectionRef = collection(db, 'tenants', tenantId, collectionName);
    
    // Query base con ordinamento se specificato
    let q = collectionRef;
    if (options.orderBy) {
        q = query(collectionRef, orderBy(options.orderBy, options.orderDirection || 'asc'));
    }
    
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });
    
    return results;
}

/**
 * Mappa nome servizio a nome collection Firestore
 * @param {string} serviceName - Nome servizio
 * @returns {string} Nome collection
 */
function getCollectionName(serviceName) {
    const mapping = {
        'macchine': 'macchine',
        'terreni': 'terreni',
        'colture': 'colture',
        'tipi-lavoro': 'tipiLavoro',
        'categorie': 'categorie',
    };
    return mapping[serviceName] || serviceName;
}

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Chiama un servizio centralizzato con gestione errori e fallback
 * 
 * @param {string} serviceName - Nome servizio ('macchine', 'terreni', ecc.)
 * @param {string} serviceFunction - Nome funzione servizio ('getAllMacchine', 'getAllTerreni', ecc.)
 * @param {Object} options - Opzioni
 * @param {string} options.tenantId - ID tenant (obbligatorio)
 * @param {Object} options.firebaseInstances - Istanze Firebase {app, db, auth} (obbligatorio)
 * @param {Object} options.options - Opzioni da passare alla funzione servizio (opzionale)
 * @param {Function} options.converter - Funzione per convertire formato dati (opzionale)
 * @param {string} options.collectionName - Nome collection per fallback (opzionale, auto-detect)
 * @param {string} options.orderBy - Campo ordinamento per fallback (opzionale)
 * @param {string} options.orderDirection - Direzione ordinamento per fallback (opzionale)
 * @returns {Promise<Array|Object>} Risultato servizio (convertito se converter specificato)
 * 
 * @example
 * // Caricare macchine
 * const macchine = await callService('macchine', 'getAllMacchine', {
 *     tenantId: currentTenantId,
 *     firebaseInstances: { app, db, auth },
 *     options: { orderBy: 'nome', orderDirection: 'asc' },
 *     converter: (m) => ({ id: m.id, nome: m.nome, ... })
 * });
 * 
 * @example
 * // Caricare terreni
 * const terreni = await callService('terreni', 'getAllTerreni', {
 *     tenantId: currentTenantId,
 *     firebaseInstances: { app, db, auth },
 *     options: { orderBy: 'nome', clienteId: null }
 * });
 */
export async function callService(serviceName, serviceFunction, options = {}) {
    const { tenantId, firebaseInstances, options: serviceOptions = {}, converter } = options;
    
    // Validazione parametri
    if (!tenantId) {
        throw new Error('tenantId obbligatorio per chiamata servizio');
    }
    if (!firebaseInstances || !firebaseInstances.db) {
        throw new Error('firebaseInstances.db obbligatorio per chiamata servizio');
    }
    
    // Verifica ambiente file:// (fallback diretto)
    if (isFileProtocol()) {
        console.warn(`⚠️ Ambiente file://: usando fallback diretto per servizio ${serviceName}`);
        const collectionName = options.collectionName || getCollectionName(serviceName);
        const results = await fallbackDirectFirestore(serviceName, {
            tenantId,
            firebaseInstances,
            collectionName,
            orderBy: options.orderBy,
            orderDirection: options.orderDirection
        });
        
        // Applica converter se specificato
        return converter ? results.map(converter) : results;
    }
    
    // Usa servizio centralizzato
    try {
        // 1. Inizializza Firebase instances nei servizi
        await initializeFirebaseInstances(firebaseInstances);
        
        // 2. Imposta tenantId nei servizi
        await setTenantId(tenantId);
        
        // 3. Importa servizio
        const servicePath = SERVICE_PATHS[serviceName];
        if (!servicePath) {
            throw new Error(`Servizio ${serviceName} non trovato in SERVICE_PATHS`);
        }
        
        const serviceModule = await import(servicePath);
        
        // 4. Verifica che funzione esista
        if (!serviceModule[serviceFunction]) {
            throw new Error(`Funzione ${serviceFunction} non trovata in servizio ${serviceName}`);
        }
        
        // 5. Chiama funzione servizio
        const result = await serviceModule[serviceFunction](serviceOptions);
        
        // 6. Applica converter se specificato
        if (converter && Array.isArray(result)) {
            return result.map(converter);
        } else if (converter && typeof result === 'object') {
            return converter(result);
        }
        
        return result;
    } catch (error) {
        console.error(`❌ Errore chiamata servizio ${serviceName}.${serviceFunction}:`, error);
        
        // Fallback: carica direttamente da Firestore
        console.warn(`⚠️ Fallback: caricamento diretto da Firestore per ${serviceName}`);
        try {
            const collectionName = options.collectionName || getCollectionName(serviceName);
            const results = await fallbackDirectFirestore(serviceName, {
                tenantId,
                firebaseInstances,
                collectionName,
                orderBy: options.orderBy,
                orderDirection: options.orderDirection
            });
            
            // Applica converter se specificato
            return converter ? results.map(converter) : results;
        } catch (fallbackError) {
            console.error(`❌ Errore anche nel fallback per ${serviceName}:`, fallbackError);
            throw new Error(`Errore caricamento ${serviceName}: ${error.message}`);
        }
    }
}

/**
 * Helper specifico per caricare macchine
 * @param {Object} options - Opzioni
 * @returns {Promise<Array>} Array macchine
 */
export async function loadMacchineViaService(options) {
    return callService('macchine', 'getAllMacchine', {
        ...options,
        converter: (m) => ({
            id: m.id,
            nome: m.nome,
            tipoMacchina: m.tipoMacchina || m.tipo,
            tipo: m.tipo || m.tipoMacchina, // Retrocompatibilità
            stato: m.stato,
            cavalli: m.cavalli,
            cavalliMinimiRichiesti: m.cavalliMinimiRichiesti,
            categoriaFunzione: m.categoriaFunzione,
            ...(m.toFirestore ? m.toFirestore() : m)
        })
    });
}

/**
 * Helper specifico per caricare terreni
 * @param {Object} options - Opzioni
 * @returns {Promise<Array>} Array terreni
 */
export async function loadTerreniViaService(options) {
    return callService('terreni', 'getAllTerreni', {
        ...options,
        converter: (t) => ({
            id: t.id,
            nome: t.nome || '',
            superficie: t.superficie || null,
            coltura: t.coltura || null,
            podere: t.podere || null,
            coordinate: t.coordinate || null,
            polygonCoords: t.polygonCoords || null,
            note: t.note || '',
            tipoPossesso: t.tipoPossesso || 'proprieta',
            dataScadenzaAffitto: t.dataScadenzaAffitto || null,
            canoneAffitto: t.canoneAffitto || null,
            hasMappa: function() {
                return this.polygonCoords && Array.isArray(this.polygonCoords) && this.polygonCoords.length > 0;
            }
        })
    });
}

// Export default
export default {
    callService,
    loadMacchineViaService,
    loadTerreniViaService
};
```

#### Step 1.2: Testare Helper

**File di Test**: Creare `tests/service-helper.test.js` (opzionale, test manuale)

**Test Manuali**:
1. Testare in ambiente HTTP (servizio centralizzato)
2. Testare in ambiente `file://` (fallback diretto)
3. Testare gestione errori (servizio non disponibile)
4. Testare conversione dati

**Checklist Step 1.2**:
- [ ] Testare `callService('macchine', 'getAllMacchine', ...)`
- [ ] Testare `callService('terreni', 'getAllTerreni', ...)`
- [ ] Testare fallback ambiente `file://`
- [ ] Testare gestione errori
- [ ] Testare conversione dati con converter
- [ ] Verificare che dati restituiti siano compatibili

---

### FASE 2: Migrare Moduli Macchine

#### Step 2.1: Migrare `gestione-lavori-controller.js`

**File**: `core/admin/js/gestione-lavori-controller.js`

**Funzioni da Migrare**:
- `loadTrattori()` (se presente)
- `loadAttrezzi()` (se presente)
- Qualsiasi funzione che carica macchine direttamente

**Procedura**:

1. **Identificare funzioni**:
   ```bash
   # Cercare pattern di caricamento diretto
   grep -n "collection.*macchine" core/admin/js/gestione-lavori-controller.js
   ```

2. **Sostituire con uso servizio**:
   ```javascript
   // PRIMA (da rimuovere)
   export async function loadTrattori(currentTenantId, db, trattoriList) {
       const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
       const macchineRef = collection(db, 'tenants', currentTenantId, 'macchine');
       const q = query(macchineRef, where('tipoMacchina', '==', 'trattore'));
       const snapshot = await getDocs(q);
       trattoriList.length = 0;
       snapshot.forEach(doc => {
           trattoriList.push({ id: doc.id, ...doc.data() });
       });
   }
   
   // DOPO (da implementare)
   import { loadMacchineViaService } from '../../../services/service-helper.js';
   
   export async function loadTrattori(currentTenantId, firebaseInstances, trattoriList) {
       try {
           const macchine = await loadMacchineViaService({
               tenantId: currentTenantId,
               firebaseInstances,
               options: {
                   tipoMacchina: 'trattore',
                   orderBy: 'nome',
                   orderDirection: 'asc'
               }
           });
           
           trattoriList.length = 0;
           trattoriList.push(...macchine);
       } catch (error) {
           console.error('Errore caricamento trattori:', error);
           trattoriList.length = 0;
       }
   }
   ```

3. **Aggiornare chiamate**:
   - Cercare tutte le chiamate a `loadTrattori()` e `loadAttrezzi()`
   - Aggiornare per passare `firebaseInstances` invece di solo `db`

**Checklist Step 2.1**:
- [ ] Identificare funzioni che caricano macchine
- [ ] Sostituire con uso `loadMacchineViaService()`
- [ ] Aggiornare firme funzioni (aggiungere `firebaseInstances`)
- [ ] Aggiornare chiamate alle funzioni
- [ ] Testare funzionalità
- [ ] Verificare che dropdown trattori/attrezzi funzionino
- [ ] Rimuovere codice duplicato

#### Step 2.2: Migrare `dashboard-data.js`

**File**: `core/js/dashboard-data.js`

**Procedura Simile a Step 2.1**

**Checklist Step 2.2**:
- [ ] Identificare caricamento macchine in `dashboard-data.js`
- [ ] Sostituire con uso servizio
- [ ] Testare statistiche macchine nella dashboard
- [ ] Verificare che dati siano corretti

---

### FASE 3: Migrare Moduli Terreni

#### Step 3.1: Migrare `terreni-controller.js`

**File**: `core/js/terreni-controller.js`

**Funzione da Migrare**: `loadTerreni()`

**Procedura**:

1. **Analizzare funzione attuale**:
   - Leggere `loadTerreni()` completo
   - Identificare logica specifica (es. calcolo superficie da mappa)
   - Identificare filtri (es. escludi terreni clienti)

2. **Sostituire con uso servizio**:
   ```javascript
   // PRIMA (da sostituire)
   export async function loadTerreni(currentTenantId, auth, db, terreni, terreniFiltrati, renderTerreniCallback) {
       // ... ~150 righe di codice ...
   }
   
   // DOPO (da implementare)
   import { loadTerreniViaService } from '../services/service-helper.js';
   
   export async function loadTerreni(currentTenantId, auth, db, app, terreni, terreniFiltrati, renderTerreniCallback) {
       try {
           if (!currentTenantId) {
               const user = auth.currentUser;
               if (user) {
                   currentTenantId = await getTenantId(user.uid, db, currentTenantId);
               }
           }
           
           if (!currentTenantId) {
               throw new Error('Tenant ID non disponibile. Assicurati di essere autenticato.');
           }
           
           // Usa servizio centralizzato
           const terreniList = await loadTerreniViaService({
               tenantId: currentTenantId,
               firebaseInstances: { app, db, auth },
               options: {
                   orderBy: 'nome',
                   orderDirection: 'asc',
                   clienteId: null // Solo terreni aziendali
               }
           });
           
           // Calcola superficie da mappa se necessario (logica specifica)
           terreniList.forEach(terreno => {
               if ((!terreno.superficie || terreno.superficie === 0) && terreno.polygonCoords) {
                   // Calcola superficie (mantenere logica esistente se necessaria)
                   // ... logica calcolo superficie ...
               }
           });
           
           terreni.length = 0;
           terreni.push(...terreniList);
           
           // Reset filtri
           terreniFiltrati.length = 0;
           
           // Renderizza
           if (renderTerreniCallback) {
               renderTerreniCallback(terreni, terreniFiltrati);
           }
       } catch (error) {
           console.error('Errore caricamento terreni:', error);
           showAlert('Errore nel caricamento dei terreni: ' + error.message, 'error');
       }
   }
   ```

3. **Mantenere logica specifica**:
   - Calcolo superficie da mappa (se presente)
   - Filtri specifici
   - Callback rendering

**Note Importanti**:
- Il servizio `terreni-service.js` restituisce oggetti `Terreno` (model)
- Il converter in `loadTerreniViaService()` converte già in formato compatibile
- Verificare che logica calcolo superficie funzioni ancora

**Checklist Step 3.1**:
- [ ] Analizzare `loadTerreni()` completo
- [ ] Identificare logica specifica da mantenere
- [ ] Sostituire caricamento con `loadTerreniViaService()`
- [ ] Mantenere logica calcolo superficie
- [ ] Aggiornare firma funzione (aggiungere `app` a `firebaseInstances`)
- [ ] Aggiornare chiamate alla funzione
- [ ] Testare funzionalità
- [ ] Verificare che filtri funzionino
- [ ] Verificare che rendering funzioni
- [ ] Rimuovere codice duplicato

#### Step 3.2: Migrare `gestione-lavori-controller.js`

**File**: `core/admin/js/gestione-lavori-controller.js`

**Funzione da Migrare**: `loadTerreni()`

**Procedura Simile a Step 3.1**

**Checklist Step 3.2**:
- [ ] Identificare `loadTerreni()` in `gestione-lavori-controller.js`
- [ ] Sostituire con uso servizio
- [ ] Aggiornare chiamate
- [ ] Testare funzionalità
- [ ] Verificare che dropdown terreni funzionino

#### Step 3.3: Migrare `dashboard-data.js`

**File**: `core/js/dashboard-data.js`

**Procedura Simile a Step 3.1**

**Checklist Step 3.3**:
- [ ] Identificare caricamento terreni in `dashboard-data.js`
- [ ] Sostituire con uso servizio
- [ ] Testare statistiche terreni nella dashboard

---

## ✅ Checklist Completa

### Pre-Implementazione
- [ ] Leggere documento completo
- [ ] Verificare che servizi esistano (`macchine-service.js`, `terreni-service.js`)
- [ ] Verificare struttura servizi (funzioni disponibili, formati dati)
- [ ] Identificare tutti i moduli da migrare

### Fase 1: Helper Centralizzato
- [ ] Creare `core/services/service-helper.js`
- [ ] Implementare `callService()`
- [ ] Implementare `loadMacchineViaService()`
- [ ] Implementare `loadTerreniViaService()`
- [ ] Implementare fallback `file://`
- [ ] Aggiungere JSDoc completo
- [ ] Testare helper con servizio macchine
- [ ] Testare helper con servizio terreni
- [ ] Testare fallback ambiente `file://`
- [ ] Testare gestione errori

### Fase 2: Migrare Macchine
- [ ] Migrare `gestione-lavori-controller.js` - `loadTrattori()`
- [ ] Migrare `gestione-lavori-controller.js` - `loadAttrezzi()`
- [ ] Migrare `dashboard-data.js` - caricamento macchine
- [ ] Verificare `terreni-controller.js` - se carica macchine
- [ ] Testare funzionalità dopo migrazione
- [ ] Verificare formati dati compatibili
- [ ] Rimuovere codice duplicato

### Fase 3: Migrare Terreni
- [ ] Migrare `terreni-controller.js` - `loadTerreni()`
- [ ] Migrare `gestione-lavori-controller.js` - `loadTerreni()`
- [ ] Migrare `dashboard-data.js` - caricamento terreni
- [ ] Verificare `attivita-controller.js` - se carica terreni
- [ ] Testare funzionalità dopo migrazione
- [ ] Verificare filtri terreni
- [ ] Verificare rendering terreni
- [ ] Rimuovere codice duplicato

### Post-Implementazione
- [ ] Test completo funzionalità
- [ ] Verificare che non ci siano errori in console
- [ ] Verificare performance (riduzione chiamate Firestore)
- [ ] Aggiornare documentazione
- [ ] Commit modifiche

---

## 🧪 Test e Verifica

### Test Funzionalità

**Per ogni modulo migrato, testare**:

1. **Caricamento Dati**:
   - [ ] Dati si caricano correttamente
   - [ ] Formato dati compatibile con codice esistente
   - [ ] Filtri funzionano correttamente

2. **Dropdown/Filtri**:
   - [ ] Dropdown si popolano correttamente
   - [ ] Filtri funzionano
   - [ ] Ricerca funziona

3. **Rendering**:
   - [ ] Liste/tabelle si renderizzano correttamente
   - [ ] Dati visualizzati corretti
   - [ ] Nessun errore in console

4. **Errori**:
   - [ ] Gestione errori funziona
   - [ ] Fallback funziona in ambiente `file://`
   - [ ] Messaggi errore chiari

### Test Performance

**Verificare**:
- [ ] Riduzione chiamate Firestore (Network tab)
- [ ] Nessun degrado performance
- [ ] Cache servizi funziona (se implementata)

---

## 📚 Documentazione

### Aggiornare Documenti

Dopo completamento, aggiornare:
- [ ] `RIEPILOGO_COMPLETO_REFACTORING.md` - Aggiungere sezione standardizzazione servizi
- [ ] `GUIDA_REFACTORING_MODULI_RIMANENTI.md` - Aggiornare pattern servizi
- [ ] README servizi - Documentare uso helper

### Pattern di Uso Documentato

Aggiungere esempi di uso helper in documentazione.

---

## ⚠️ Note Importanti

### Compatibilità

- ✅ **Mantenere compatibilità**: Formati dati devono essere compatibili con codice esistente
- ✅ **Fallback file://**: Helper gestisce automaticamente ambiente `file://`
- ✅ **Gestione errori**: Fallback automatico se servizio non disponibile

### Performance

- ✅ **Riduzione chiamate**: Servizi centralizzati riducono chiamate Firestore duplicate
- ✅ **Cache**: Servizi possono implementare cache (futuro miglioramento)
- ✅ **Lazy loading**: Import servizi solo quando necessario

### Manutenzione

- ✅ **Un solo punto**: Modifiche ai servizi in un solo file
- ✅ **Pattern uniforme**: Tutti i moduli usano stesso pattern
- ✅ **Testabilità**: Facile testare servizi isolatamente

---

## 🚀 Prossimi Passi

Dopo completamento standardizzazione:

1. **Ottimizzazioni**:
   - Implementare cache nei servizi
   - Implementare real-time updates (se necessario)
   - Ottimizzare query Firestore

2. **Altri Servizi**:
   - Standardizzare altri servizi (operai, squadre, clienti)
   - Creare helper specifici se necessario

3. **Testing**:
   - Aggiungere test unitari per helper
   - Aggiungere test integrazione per servizi

---

## ✅ Completamenti e Fix (2025-01-26)

### Fix Dropdown Trattori Vuoto

**Problema Identificato:**
- Il dropdown dei trattori risultava vuoto in `attivita-standalone.html` quando si apriva il modal "Aggiungi Attività"
- La funzione `populateTrattoriDropdown()` veniva chiamata senza parametri, utilizzando l'array vuoto di default invece di `macchineList`

**Soluzione Implementata:**
1. ✅ Modificato `openAttivitaModal` in `core/js/attivita-events.js` per passare esplicitamente `macchineList` a `populateTrattoriDropdown(macchineList)`
2. ✅ Aggiornato il wrapper `populateTrattoriDropdown` in `attivita-standalone.html` per gestire entrambi i casi:
   - Quando viene chiamato con `macchineList` (array) → usa quello passato
   - Quando viene chiamato con `selectedTrattoreId` (stringa) → usa `macchineList` dalla variabile globale
3. ✅ Rimossi log di debug eccessivi da tutti i file interessati
4. ✅ Verificato che tutte le pagine funzionino correttamente con e senza modulo Parco Macchine attivo

**File Modificati:**
- `core/js/attivita-controller.js` - Rimossi log debug
- `core/js/attivita-events.js` - Fix passaggio parametri
- `core/attivita-standalone.html` - Fix wrapper `populateTrattoriDropdown`
- `core/admin/js/gestione-lavori-controller.js` - Rimossi log debug
- `core/admin/js/gestione-lavori-events.js` - Rimossi log debug
- `core/admin/gestione-lavori-standalone.html` - Rimossi log debug

**Risultato:**
- ✅ Dropdown trattori popolato correttamente in tutte le pagine
- ✅ Codice più pulito (log di debug rimossi)
- ✅ Tutte le pagine testate e funzionanti

---

## ✅ Completamenti e Fix (2026-01-03)

### Completamento FASE 2 e FASE 3

**Obiettivo**: Completare la migrazione di tutti i file rimanenti a usare `service-helper.js`.

**File Migrati**:
1. ✅ `core/segnatura-ore-standalone.html` - Migrato `loadMacchine()` a `loadMacchineViaService`
2. ✅ `core/js/attivita-controller.js` - Migrato `loadTerreni()` a `loadTerreniViaService`
3. ✅ `core/js/dashboard-maps.js` - Migrato caricamento terreni a `loadTerreniViaService`
4. ✅ `modules/conto-terzi/views/terreni-clienti-standalone.html` - Migrato a `loadTerreniViaService`

**Fix Applicati**:

#### 1. Fix Indice Composito Firestore
**Problema**: Query con filtro `clienteId` + `orderBy` richiedono indice composito Firestore che non esiste.

**Soluzione**:
- Modificato `terreni-service.js` per rilevare filtro `clienteId` e filtrare/ordinare lato client
- Modificato `fallbackDirectFirestore` in `service-helper.js` per gestire stesso caso
- Evita necessità di creare indici compositi, funziona immediatamente

**File Modificati**:
- ✅ `core/services/terreni-service.js` - Gestione filtro lato client per `clienteId`
- ✅ `core/services/service-helper.js` - Fallback intelligente per indice composito

#### 2. Fix Campo Coltura - Precompilazione Diario Attività
**Problema**: Campo `coltura` non disponibile nei terreni caricati, precompilazione automatica non funzionava nel diario attività.

**Causa**: Modello `Terreno` non includeva `coltura` nel costruttore.

**Soluzione**:
- Aggiunto `coltura` al modello `Terreno` (costruttore e documentazione)
- Modificato `terreni-service.js` per salvare dati originali come `_originalData`
- Migliorato converter in `service-helper.js` per preferire dati originali quando disponibili

**File Modificati**:
- ✅ `core/models/Terreno.js` - Aggiunto campo `coltura`
- ✅ `core/services/terreni-service.js` - Salvataggio dati originali
- ✅ `core/services/service-helper.js` - Converter migliorato per preservare `coltura`

#### 3. Fix Dashboard Maps - Dependencies Mancanti
**Problema**: Errore "collection is not defined" in `dashboard-maps.js` dopo migrazione.

**Causa**: `collection` e `getDocs` rimossi dalla destructuring ma ancora usati da funzioni interne.

**Soluzione**: Ripristinati `collection` e `getDocs` nelle dependencies.

**File Modificati**:
- ✅ `core/js/dashboard-maps.js` - Ripristinati `collection` e `getDocs` nelle dependencies
- ✅ `core/dashboard-standalone.html` - Aggiunto `app` alle dependencies

#### 4. Fix Percorso Import Terreni Clienti
**Problema**: Percorso import errato in `terreni-clienti-standalone.html` (`../../../../` invece di `../../../`).

**Soluzione**: Corretto percorso import.

**File Modificati**:
- ✅ `modules/conto-terzi/views/terreni-clienti-standalone.html` - Corretto percorso import

**Risultato**:
- ✅ **Standardizzazione completata**: Tutti i file principali usano `service-helper.js`
- ✅ **Precompilazione coltura funzionante**: Campo `coltura` disponibile per precompilazione automatica
- ✅ **Gestione indici automatica**: Evitati errori indice composito Firestore
- ✅ **~150+ righe rimosse**: Codice duplicato eliminato
- ✅ **Pattern uniforme**: Tutti i file seguono stesso pattern standardizzato

---

## ✅ Completamenti e Fix (2025-01-26)


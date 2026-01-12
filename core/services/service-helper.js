/**
 * Service Helper - Helper centralizzato per chiamate ai servizi
 * Standardizza pattern di chiamata, gestione errori e fallback
 * 
 * @module core/services/service-helper
 */

// ============================================
// COSTANTI
// ============================================

// Mappa servizi → path moduli
const SERVICE_PATHS = {
    'macchine': '../../modules/parco-macchine/services/macchine-service.js',
    'terreni': './terreni-service.js',
    'colture': './colture-service.js',
    'tipi-lavoro': './tipi-lavoro-service.js',
    'categorie': './categorie-service.js',
    // Aggiungere altri servizi qui
};

// Mappa nome servizio a nome collection Firestore
const COLLECTION_NAMES = {
    'macchine': 'macchine',
    'terreni': 'terreni',
    'colture': 'colture',
    'tipi-lavoro': 'tipiLavoro',
    'categorie': 'categorie',
};

// ============================================
// FUNZIONI HELPER INTERNE
// ============================================

/**
 * Verifica se siamo in ambiente file://
 * @returns {boolean} true se ambiente file://
 */
function isFileProtocol() {
    return typeof window !== 'undefined' && window.location.protocol === 'file:';
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
 * @param {string} options.orderBy - Campo ordinamento (opzionale)
 * @param {string} options.orderDirection - Direzione ordinamento (opzionale)
 * @param {Array} options.whereFilters - Filtri where (opzionale)
 * @returns {Promise<Array>} Array di documenti
 */
async function fallbackDirectFirestore(serviceName, options) {
    const { tenantId, firebaseInstances, collectionName, orderBy, orderDirection, whereFilters } = options;
    const { db } = firebaseInstances;
    
    if (!db || !tenantId || !collectionName) {
        throw new Error('Parametri mancanti per fallback Firestore');
    }
    
    try {
        const { collection, getDocs, query, orderBy: orderByFn, where: whereFn } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const collectionRef = collection(db, 'tenants', tenantId, collectionName);
        
        // Verifica se c'è un filtro clienteId (richiede indice composito con orderBy)
        // In tal caso, carica tutti e filtra/ordina lato client
        const hasClienteIdFilter = whereFilters && whereFilters.some(f => f[0] === 'clienteId');
        const useClientSideFilter = hasClienteIdFilter && orderBy;
        
        // Costruisci query
        let q = collectionRef;
        
        // Aggiungi filtri where se presenti (escludi clienteId se filtriamo lato client)
        if (whereFilters && whereFilters.length > 0) {
            whereFilters.forEach(filter => {
                const [field, operator, value] = filter;
                // Salta filtro clienteId se filtriamo lato client
                if (useClientSideFilter && field === 'clienteId') {
                    return;
                }
                q = query(q, whereFn(field, operator, value));
            });
        }
        
        // Aggiungi ordinamento solo se non filtriamo lato client
        if (orderBy && !useClientSideFilter) {
            q = query(q, orderByFn(orderBy, orderDirection || 'asc'));
        }
        
        const snapshot = await getDocs(q);
        const results = [];
        snapshot.forEach(doc => {
            results.push({ id: doc.id, ...doc.data() });
        });
        
        // Filtra lato client se necessario
        if (useClientSideFilter) {
            const clienteIdFilter = whereFilters.find(f => f[0] === 'clienteId');
            if (clienteIdFilter) {
                const [, , clienteIdValue] = clienteIdFilter;
                const filtered = results.filter(r => r.clienteId === clienteIdValue);
                
                // Ordina lato client
                if (orderBy) {
                    filtered.sort((a, b) => {
                        const aVal = a[orderBy] || '';
                        const bVal = b[orderBy] || '';
                        const comparison = String(aVal).localeCompare(String(bVal));
                        return orderDirection === 'desc' ? -comparison : comparison;
                    });
                }
                
                return filtered;
            }
        }
        
        return results;
    } catch (error) {
        console.error('Errore fallback Firestore:', error);
        throw error;
    }
}

/**
 * Ottiene nome collection per servizio
 * @param {string} serviceName - Nome servizio
 * @returns {string} Nome collection
 */
function getCollectionName(serviceName) {
    return COLLECTION_NAMES[serviceName] || serviceName;
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
 * @param {Array} options.whereFilters - Filtri where per fallback (opzionale) - formato: [['campo', '==', 'valore']]
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
        
        // Estrai filtri where da serviceOptions se presenti
        const whereFilters = [];
        if (serviceOptions.tipoMacchina) {
            whereFilters.push(['tipoMacchina', '==', serviceOptions.tipoMacchina]);
        }
        if (serviceOptions.stato) {
            whereFilters.push(['stato', '==', serviceOptions.stato]);
        }
        if (serviceOptions.clienteId !== undefined && serviceOptions.clienteId !== null) {
            whereFilters.push(['clienteId', '==', serviceOptions.clienteId]);
        }
        
        const results = await fallbackDirectFirestore(serviceName, {
            tenantId,
            firebaseInstances,
            collectionName,
            orderBy: options.orderBy || serviceOptions.orderBy,
            orderDirection: options.orderDirection || serviceOptions.orderDirection,
            whereFilters: options.whereFilters || whereFilters
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
        } else if (converter && typeof result === 'object' && result !== null) {
            return converter(result);
        }
        
        return result;
    } catch (error) {
        console.error(`❌ Errore chiamata servizio ${serviceName}.${serviceFunction}:`, error);
        
        // Fallback: carica direttamente da Firestore
        console.warn(`⚠️ Fallback: caricamento diretto da Firestore per ${serviceName}`);
        try {
            const collectionName = options.collectionName || getCollectionName(serviceName);
            
            // Estrai filtri where da serviceOptions se presenti
            const whereFilters = [];
            if (serviceOptions.tipoMacchina) {
                whereFilters.push(['tipoMacchina', '==', serviceOptions.tipoMacchina]);
            }
            if (serviceOptions.stato) {
                whereFilters.push(['stato', '==', serviceOptions.stato]);
            }
            if (serviceOptions.clienteId !== undefined && serviceOptions.clienteId !== null) {
                whereFilters.push(['clienteId', '==', serviceOptions.clienteId]);
            }
            
            const results = await fallbackDirectFirestore(serviceName, {
                tenantId,
                firebaseInstances,
                collectionName,
                orderBy: options.orderBy || serviceOptions.orderBy,
                orderDirection: options.orderDirection || serviceOptions.orderDirection,
                whereFilters: options.whereFilters || whereFilters
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
 * @param {string} options.tenantId - ID tenant
 * @param {Object} options.firebaseInstances - Istanze Firebase {app, db, auth}
 * @param {Object} options.options - Opzioni da passare a getAllMacchine
 * @returns {Promise<Array>} Array macchine (formato compatibile)
 */
export async function loadMacchineViaService(options) {
    return callService('macchine', 'getAllMacchine', {
        ...options,
        converter: (m) => {
            // Converti da Macchina model a formato compatibile
            const base = {
                id: m.id,
                nome: m.nome,
                tipoMacchina: m.tipoMacchina || m.tipo,
                tipo: m.tipo || m.tipoMacchina, // Retrocompatibilità
                stato: m.stato,
                cavalli: m.cavalli,
                cavalliMinimiRichiesti: m.cavalliMinimiRichiesti,
                categoriaFunzione: m.categoriaFunzione,
            };
            
            // Aggiungi altri campi se presenti (da toFirestore o direttamente)
            if (typeof m.toFirestore === 'function') {
                const firestoreData = m.toFirestore();
                return { ...base, ...firestoreData };
            }
            
            return { ...base, ...m };
        }
    });
}

/**
 * Helper specifico per caricare terreni
 * @param {Object} options - Opzioni
 * @param {string} options.tenantId - ID tenant
 * @param {Object} options.firebaseInstances - Istanze Firebase {app, db, auth}
 * @param {Object} options.options - Opzioni da passare a getAllTerreni
 * @returns {Promise<Array>} Array terreni (formato compatibile)
 */
export async function loadTerreniViaService(options) {
    return callService('terreni', 'getAllTerreni', {
        ...options,
        converter: (t) => {
            // Converti da Terreno model a formato compatibile
            // Estrai dati originali se disponibili (prima della conversione in modello)
            const originalData = t._originalData || t;
            
            const base = {
                id: t.id,
                nome: t.nome || '',
                superficie: t.superficie || null,
                coltura: originalData.coltura || t.coltura || null, // Preferisci dati originali
                podere: t.podere || null,
                coordinate: t.coordinate || null,
                polygonCoords: t.polygonCoords || null,
                note: t.note || '',
                tipoPossesso: t.tipoPossesso || 'proprieta',
                dataScadenzaAffitto: t.dataScadenzaAffitto || null,
                canoneAffitto: t.canoneAffitto || null,
                clienteId: t.clienteId || null,
            };
            
            // Aggiungi metodo hasMappa per compatibilità
            base.hasMappa = function() {
                return this.polygonCoords && Array.isArray(this.polygonCoords) && this.polygonCoords.length > 0;
            };
            
            // Aggiungi altri campi se presenti (da dati originali o da toFirestore)
            if (typeof t.toFirestore === 'function') {
                const firestoreData = t.toFirestore();
                // Assicurati che coltura sia inclusa anche se null
                if (originalData.coltura !== undefined) {
                    firestoreData.coltura = originalData.coltura;
                }
                return { ...base, ...firestoreData };
            }
            
            // Se non è un modello, usa direttamente i dati
            return { ...base, ...originalData };
        }
    });
}

// Export default
export default {
    callService,
    loadMacchineViaService,
    loadTerreniViaService
};


/**
 * Statistiche Controller - Logica principale caricamento dati e calcolo statistiche
 * 
 * @module core/js/statistiche-controller
 */

import { resolveEffectiveModules } from '../utils/module-access-resolver.js';
import {
    isTerrenoArchiviato,
    nomeTerrenoPerStorico
} from '../../shared/js/terreno-archivio.js';
import { formatIsoDateToItalianShort } from './date-format-it.js';
import { fetchLavoriWithOreOperai } from '../services/manodopera-lavori-ore-loader.js';
import {
    periodoCacheKey,
    collectOreValidateFiltrate,
    aggregaOreMacchineTotali,
    aggregaMacchinePiuUtilizzate,
    aggregaOreMacchinaPerTerreno,
    aggregaOreMacchinaVsLavoratore,
    aggregaOreMacchinePerMese
} from './statistiche-macchine-aggregazioni.js';

function formatPeriodoFiltroText(dataDa, dataA) {
    if (dataDa && dataA) {
        return `${formatIsoDateToItalianShort(dataDa)} - ${formatIsoDateToItalianShort(dataA)}`;
    }
    return 'Tutti i periodi';
}

/** Cache snapshot Macchine: tenant + filtri. Dedup in-flight per evitare stampede in Promise.all. */
let _macchineSnapshotCache = {
    key: null,
    data: null,
    promise: null
};

/** Evita alert/banner ripetuti quando getAllAttivita è chiamata in parallelo nello stesso carico. */
let _indexWarningShownForLoad = false;

/**
 * Invalida la cache snapshot Statistiche Macchine (es. dopo cambio dati).
 */
export function invalidateStatisticheMacchineCache() {
    _macchineSnapshotCache = { key: null, data: null, promise: null };
}

/**
 * Reset avviso indice Firestore all'inizio di un nuovo tentativo di carico.
 */
export function resetStatisticheIndexWarning() {
    _indexWarningShownForLoad = false;
    const el = typeof document !== 'undefined'
        ? document.getElementById('statistiche-index-warning')
        : null;
    if (el) {
        el.classList.remove('is-visible');
        el.textContent = '';
        el.removeAttribute('data-index-link');
    }
}

/**
 * Mostra una sola volta (per tentativo di carico) l'avviso indice mancante in pagina.
 * @param {string|null} indexLink
 */
export function notifyMissingFirestoreIndex(indexLink) {
    if (_indexWarningShownForLoad) return;
    _indexWarningShownForLoad = true;

    const base =
        'Necessario creare un indice Firestore per i filtri multipli. Dopo la pubblicazione dell\'indice attendi qualche minuto e riprova.';
    const el = typeof document !== 'undefined'
        ? document.getElementById('statistiche-index-warning')
        : null;

    if (el) {
        el.replaceChildren();
        el.appendChild(document.createTextNode(base));
        if (indexLink) {
            el.appendChild(document.createTextNode(' '));
            const link = document.createElement('a');
            link.href = indexLink;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = 'Apri link per creare l\'indice';
            el.appendChild(link);
            el.setAttribute('data-index-link', indexLink);
        } else {
            el.removeAttribute('data-index-link');
        }
        el.classList.add('is-visible');
        return;
    }

    console.warn(base, indexLink || '');
}

/**
 * Carica una sola volta attivita filtrate + lavori/oreOperai validate (+ mappa terreni).
 * @param {Object} periodo
 * @param {boolean} hasParcoMacchineModule
 * @param {string} currentTenantId
 * @param {Function} getAllAttivitaCallback
 * @param {Object} dependencies
 * @returns {Promise<{ attivita: Array, oreRows: Array, terreniMap: Object, hasManodopera: boolean, fetchStats: Object }>}
 */
export async function loadStatisticheMacchineSnapshot(periodo, hasParcoMacchineModule, currentTenantId, getAllAttivitaCallback, dependencies) {
    if (!hasParcoMacchineModule) {
        return { attivita: [], oreRows: [], terreniMap: {}, hasManodopera: false, fetchStats: { lavoriReads: 0, oreOperaiReads: 0, fromCache: true } };
    }

    const key = `${currentTenantId || ''}|${periodoCacheKey(periodo || {})}`;
    if (_macchineSnapshotCache.key === key && _macchineSnapshotCache.data) {
        return {
            ..._macchineSnapshotCache.data,
            fetchStats: { ...(_macchineSnapshotCache.data.fetchStats || {}), fromCache: true }
        };
    }
    if (_macchineSnapshotCache.key === key && _macchineSnapshotCache.promise) {
        return _macchineSnapshotCache.promise;
    }

    _macchineSnapshotCache.key = key;
    _macchineSnapshotCache.promise = (async () => {
        const fetchStats = { lavoriReads: 0, oreOperaiReads: 0, tenantReads: 0, terreniReads: 0, fromCache: false };
        const attivita = getAllAttivitaCallback ? await getAllAttivitaCallback(periodo || {}) : [];
        let oreRows = [];
        let terreniMap = {};
        let hasManodopera = false;

        if (currentTenantId && dependencies?.db) {
            try {
                const { getDoc, doc, collection, getDocs } = dependencies;
                const tenantDoc = await getDoc(doc(dependencies.db, 'tenants', currentTenantId));
                fetchStats.tenantReads = 1;
                if (tenantDoc.exists()) {
                    hasManodopera = resolveEffectiveModules(tenantDoc.data()).includes('manodopera');
                }

                if (hasManodopera) {
                    const bundle = await fetchLavoriWithOreOperai(currentTenantId, dependencies, {
                        statoFilter: 'validate'
                    });
                    fetchStats.lavoriReads = 1;
                    fetchStats.oreOperaiReads = (bundle.lavoriDocs || []).length;
                    oreRows = collectOreValidateFiltrate(bundle, periodo || {});

                    const terreniSnap = await getDocs(collection(dependencies.db, `tenants/${currentTenantId}/terreni`));
                    fetchStats.terreniReads = 1;
                    terreniSnap.docs.forEach((tDoc) => {
                        terreniMap[tDoc.id] = tDoc.data() || {};
                    });
                }
            } catch (error) {
                console.warn('Errore caricamento snapshot ore macchine Manodopera:', error);
            }
        }

        const data = { attivita, oreRows, terreniMap, hasManodopera, fetchStats };
        _macchineSnapshotCache.data = data;
        return data;
    })();

    try {
        return await _macchineSnapshotCache.promise;
    } finally {
        if (_macchineSnapshotCache.key === key) {
            _macchineSnapshotCache.promise = null;
        }
    }
}

function safeUpdateChart(fn, chartCanvasId, label) {
    try {
        if (typeof fn === 'function') fn();
    } catch (error) {
        console.error(`Errore grafico ${label}:`, error);
        const canvas = document.getElementById(chartCanvasId);
        const container = canvas?.closest('.chart-card')?.querySelector('.chart-container')
            || canvas?.parentElement;
        if (container) {
            const msg = (error && error.message) ? String(error.message) : 'errore sconosciuto';
            container.innerHTML = `<div class="empty-state"><p>Errore caricamento grafico (${label}): ${msg}</p></div>`;
        }
    }
}

function setMacchineKpiLoading() {
    ['metric-ore-macchine-totali', 'metric-macchine-utilizzate', 'metric-utilizzo-medio', 'metric-manutenzioni-scadenza']
        .forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'Caricamento…';
        });
}

// ============================================
// FUNZIONI HELPER
// ============================================

/**
 * Ottiene tenant ID dall'utente
 * @param {string} userId - ID utente
 * @param {Object} dependencies - Dipendenze Firebase (getDoc, doc, db)
 * @param {string} currentTenantId - Tenant ID corrente (se già disponibile)
 * @returns {Promise<string|null>}
 */
export async function getTenantId(userId, dependencies, currentTenantId = null) {
    if (currentTenantId) return currentTenantId;
    
    try {
        const { getDoc, doc, db } = dependencies;
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            return userData.tenantId;
        }
    } catch (error) {
        console.error('Errore recupero tenant:', error);
    }
    return null;
}

/**
 * Ottiene riferimento collection terreni per tenant
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze Firebase (collection, db)
 * @returns {Object} Collection reference
 */
export function getTerreniCollection(tenantId, dependencies) {
    if (!tenantId) throw new Error('Tenant ID non disponibile');
    const { collection, db } = dependencies;
    return collection(db, `tenants/${tenantId}/terreni`);
}

/**
 * Ottiene riferimento collection attività per tenant
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze Firebase (collection, db)
 * @returns {Object} Collection reference
 */
export function getAttivitaCollection(tenantId, dependencies) {
    if (!tenantId) throw new Error('Tenant ID non disponibile');
    const { collection, db } = dependencies;
    return collection(db, `tenants/${tenantId}/attivita`);
}

/**
 * Ottiene riferimento collection macchine per tenant
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze Firebase (collection, db)
 * @returns {Object} Collection reference
 */
export function getMacchineCollection(tenantId, dependencies) {
    if (!tenantId) throw new Error('Tenant ID non disponibile');
    const { collection, db } = dependencies;
    return collection(db, `tenants/${tenantId}/macchine`);
}

// ============================================
// FUNZIONI CARICAMENTO DATI
// ============================================

/**
 * Carica macchine usando servizio centralizzato tramite helper
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} state - State object (macchineList, hasParcoMacchineModule)
 * @param {Function} updateState - Funzione per aggiornare state
 * @param {Object} dependencies - Dipendenze Firebase (app, db, auth, collection, getDocs)
 * @returns {Promise<Array>} Lista macchine
 */
export async function loadMacchine(currentTenantId, state, updateState, dependencies) {
    if (!currentTenantId) return [];
    
    try {
        // Usa servizio centralizzato tramite helper
        const { loadMacchineViaService } = await import('../services/service-helper.js');
        const { app, db, auth } = dependencies;
        const macchine = await loadMacchineViaService({
            tenantId: currentTenantId,
            firebaseInstances: { app, db, auth },
            options: {
                orderBy: 'nome',
                orderDirection: 'asc'
            }
        });
        
        // Filtra lato client: solo macchine non dismesse
        const macchineList = macchine
            .filter(m => m.stato !== 'dismesso')
            .map(m => ({
                id: m.id,
                nome: m.nome,
                tipoMacchina: m.tipoMacchina || m.tipo,
                tipo: m.tipo || m.tipoMacchina, // Retrocompatibilità
                stato: m.stato,
                cavalli: m.cavalli,
                cavalliMinimiRichiesti: m.cavalliMinimiRichiesti,
                categoriaFunzione: m.categoriaFunzione,
                ...(m.toFirestore ? m.toFirestore() : m)
            }));
        
        updateState({ macchineList });
        return macchineList;
    } catch (error) {
        console.error('Errore caricamento macchine:', error);
        updateState({ macchineList: [] });
        return [];
    }
}

/**
 * Carica tutti i terreni aziendali (escludi terreni clienti)
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Function} getTenantIdCallback - Callback per ottenere tenant ID
 * @returns {Promise<Array>} Lista terreni
 */
export async function getAllTerreni(currentTenantId, dependencies, getTenantIdCallback, options = {}) {
    let tenantId = currentTenantId;
    if (!tenantId) {
        const { auth } = dependencies;
        const user = auth.currentUser;
        if (user && getTenantIdCallback) {
            tenantId = await getTenantIdCallback(user.uid, dependencies, null);
        }
    }
    
    if (!tenantId) return [];
    
    try {
        const { query, getDocs } = dependencies;
        const q = query(getTerreniCollection(tenantId, dependencies));
        const snapshot = await getDocs(q);
        // Filtra solo terreni aziendali (escludi terreni clienti)
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(terreno => {
                // Escludi terreni dei clienti (solo terreni aziendali)
                return !terreno.clienteId || terreno.clienteId === '';
            })
            .filter((terreno) => options.includiArchiviati === true || !isTerrenoArchiviato(terreno));
    } catch (error) {
        console.error('Errore caricamento terreni:', error);
        return [];
    }
}

export function nomeTerrenoStatistiche(terreno, fallback = '-') {
    return nomeTerrenoPerStorico(terreno, fallback);
}

export function superficieTerreniAttivi(terreni = []) {
    return terreni
        .filter((terreno) => !isTerrenoArchiviato(terreno))
        .reduce((totale, terreno) => {
            const superficie = Number(terreno && terreno.superficie);
            return totale + (Number.isFinite(superficie) ? superficie : 0);
        }, 0);
}

/**
 * Totali «Terreni» / «Superficie totale» delle statistiche: solo aziendali attivi.
 * Esclude archiviati e terreni cliente. Non altera lo storico.
 *
 * @param {Array<object>} terreni
 * @returns {{
 *   totaleTerreni: number,
 *   terreniProprieta: number,
 *   terreniAffitto: number,
 *   superficieTotale: number,
 *   superficieProprieta: number,
 *   superficieAffitto: number,
 *   canoneMensileTotale: number
 * }}
 */
export function calcolaMetricheTerreniAttivi(terreni = []) {
    let totaleTerreni = 0;
    let terreniProprieta = 0;
    let terreniAffitto = 0;
    let superficieTotale = 0;
    let superficieProprieta = 0;
    let superficieAffitto = 0;
    let canoneMensileTotale = 0;

    (Array.isArray(terreni) ? terreni : []).forEach((terreno) => {
        if (!terreno || typeof terreno !== 'object') return;
        if (terreno.clienteId) return;
        if (isTerrenoArchiviato(terreno)) return;
        totaleTerreni += 1;
        const superficie = Number(terreno.superficie) || 0;
        superficieTotale += superficie;
        const tipoPossesso = terreno.tipoPossesso || 'proprieta';
        if (tipoPossesso === 'proprieta') {
            terreniProprieta += 1;
            superficieProprieta += superficie;
        } else if (tipoPossesso === 'affitto') {
            terreniAffitto += 1;
            superficieAffitto += superficie;
            if (terreno.canoneAffitto) {
                canoneMensileTotale += Number(terreno.canoneAffitto) || 0;
            }
        }
    });

    return {
        totaleTerreni,
        terreniProprieta,
        terreniAffitto,
        superficieTotale,
        superficieProprieta,
        superficieAffitto,
        canoneMensileTotale
    };
}

/**
 * Carica tutte le attività con filtri opzionali
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} filters - Filtri opzionali (terrenoId, tipoLavoro, dataDa, dataA)
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Function} getTenantIdCallback - Callback per ottenere tenant ID
 * @returns {Promise<Array>} Lista attività
 */
export async function getAllAttivita(currentTenantId, filters = {}, dependencies, getTenantIdCallback) {
    let tenantId = currentTenantId;
    if (!tenantId) {
        const { auth } = dependencies;
        const user = auth.currentUser;
        if (user && getTenantIdCallback) {
            tenantId = await getTenantIdCallback(user.uid, dependencies, null);
        }
    }
    
    if (!tenantId) return [];
    
    try {
        const { query, where, orderBy, getDocs } = dependencies;
        let q = query(getAttivitaCollection(tenantId, dependencies));

        // Applica filtri
        if (filters.terrenoId) {
            q = query(q, where('terrenoId', '==', filters.terrenoId));
        }
        if (filters.tipoLavoro) {
            q = query(q, where('tipoLavoro', '==', filters.tipoLavoro));
        }
        if (filters.dataDa) {
            q = query(q, where('data', '>=', filters.dataDa));
        }
        if (filters.dataA) {
            q = query(q, where('data', '<=', filters.dataA));
        }

        // Ordina per data (richiede indice composito se ci sono 2+ filtri)
        q = query(q, orderBy('data', 'desc'));
        const snapshot = await getDocs(q);
        let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filtra solo attività aziendali (escludi attività terreni clienti)
        results = results.filter(attivita => {
            return !attivita.clienteId || attivita.clienteId === '';
        });
        
        return results;
    } catch (error) {
        // Se l'errore è relativo agli indici, prova senza orderBy
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
            console.warn('Indice Firestore mancante, carico senza orderBy e ordino in memoria...');
            try {
                const { query, where, getDocs } = dependencies;
                // Ricarica senza orderBy
                let q = query(getAttivitaCollection(tenantId, dependencies));
                if (filters.terrenoId) q = query(q, where('terrenoId', '==', filters.terrenoId));
                if (filters.tipoLavoro) q = query(q, where('tipoLavoro', '==', filters.tipoLavoro));
                if (filters.dataDa) q = query(q, where('data', '>=', filters.dataDa));
                if (filters.dataA) q = query(q, where('data', '<=', filters.dataA));
                
                const snapshot = await getDocs(q);
                let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Filtra solo attività aziendali
                results = results.filter(attivita => {
                    return !attivita.clienteId || attivita.clienteId === '';
                });
                
                // Ordina in memoria per data
                results.sort((a, b) => {
                    if (!a.data || !b.data) return 0;
                    return b.data.localeCompare(a.data);
                });
                
                // Filtra per data se necessario
                if (filters.dataDa) {
                    results = results.filter(att => att.data >= filters.dataDa);
                }
                if (filters.dataA) {
                    results = results.filter(att => att.data <= filters.dataA);
                }
                
                const indexLink = error.message.match(/https:\/\/[^\s]+/);
                if (indexLink) {
                    console.warn('Per migliorare le prestazioni, crea l\'indice Firestore:', indexLink[0]);
                    notifyMissingFirestoreIndex(indexLink[0]);
                }

                return results;
            } catch (retryError) {
                console.error('Errore anche senza orderBy:', retryError);
                const indexLink = error.message.match(/https:\/\/[^\s]+/);
                notifyMissingFirestoreIndex(indexLink ? indexLink[0] : null);
                return [];
            }
        } else {
            console.error('Errore caricamento attività:', error);
            return [];
        }
    }
}

// ============================================
// FUNZIONI CALCOLO STATISTICHE BASE
// ============================================

/**
 * Calcola totale terreni (allineato ai filtri della riga KPI: con terrenoId conta 0/1)
 * @param {Function} getAllTerreniCallback - Callback per ottenere tutti i terreni
 * @param {Object} [periodo] - Filtri opzionali (`terrenoId`)
 * @returns {Promise<number>} Numero terreni
 */
export async function getTotaleTerreni(getAllTerreniCallback, periodo = {}) {
    if (!getAllTerreniCallback) return 0;
    const terreni = await getAllTerreniCallback();
    const list = Array.isArray(terreni) ? terreni : [];
    if (periodo && periodo.terrenoId) {
        const id = String(periodo.terrenoId);
        return list.some((t) => String(t && t.id) === id) ? 1 : 0;
    }
    return list.length;
}

/**
 * Calcola totale ore lavorate
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @returns {Promise<number>} Totale ore
 */
export async function getTotaleOre(periodo, getAllAttivitaCallback) {
    if (!getAllAttivitaCallback) return 0;
    const attivita = await getAllAttivitaCallback(periodo);
    const totaleOre = attivita.reduce((sum, att) => sum + (att.oreNette || 0), 0);
    return parseFloat(totaleOre.toFixed(2));
}

/**
 * Calcola totale attività
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @returns {Promise<number>} Numero totale attività
 */
export async function getTotaleAttivita(periodo, getAllAttivitaCallback) {
    if (!getAllAttivitaCallback) return 0;
    const attivita = await getAllAttivitaCallback(periodo);
    return attivita.length;
}

/**
 * Calcola ore per tipo lavoro
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @returns {Promise<Array>} Array con tipoLavoro e ore
 */
export async function getOrePerTipoLavoro(periodo, getAllAttivitaCallback) {
    if (!getAllAttivitaCallback) return [];
    const attivita = await getAllAttivitaCallback(periodo);
    const orePerTipo = {};
    attivita.forEach(att => {
        const tipo = att.tipoLavoro || 'Non specificato';
        if (!orePerTipo[tipo]) {
            orePerTipo[tipo] = 0;
        }
        orePerTipo[tipo] += att.oreNette || 0;
    });
    return Object.entries(orePerTipo)
        .map(([tipoLavoro, ore]) => ({
            tipoLavoro,
            ore: parseFloat(ore.toFixed(2))
        }))
        .sort((a, b) => b.ore - a.ore);
}

/**
 * Calcola attività per terreno
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @returns {Promise<Array>} Array con terrenoNome, numeroAttivita e oreTotali
 */
export async function getAttivitaPerTerreno(periodo, getAllAttivitaCallback) {
    if (!getAllAttivitaCallback) return [];
    const attivita = await getAllAttivitaCallback(periodo);
    const attivitaPerTerreno = {};
    attivita.forEach(att => {
        const terrenoNome = att.terrenoNome || 'Non specificato';
        if (!attivitaPerTerreno[terrenoNome]) {
            attivitaPerTerreno[terrenoNome] = {
                terrenoNome,
                numeroAttivita: 0,
                oreTotali: 0
            };
        }
        attivitaPerTerreno[terrenoNome].numeroAttivita++;
        attivitaPerTerreno[terrenoNome].oreTotali += att.oreNette || 0;
    });
    return Object.values(attivitaPerTerreno)
        .map(item => ({
            ...item,
            oreTotali: parseFloat(item.oreTotali.toFixed(2))
        }))
        .sort((a, b) => b.numeroAttivita - a.numeroAttivita);
}

/**
 * Calcola ore per mese
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @returns {Promise<Array>} Array con mese e ore
 */
export async function getOrePerMese(periodo, getAllAttivitaCallback) {
    if (!getAllAttivitaCallback) return [];
    const attivita = await getAllAttivitaCallback(periodo);
    const orePerMese = {};
    attivita.forEach(att => {
        if (!att.data) return;
        const mese = att.data.substring(0, 7);
        if (!orePerMese[mese]) {
            orePerMese[mese] = 0;
        }
        orePerMese[mese] += att.oreNette || 0;
    });
    return Object.entries(orePerMese)
        .map(([mese, ore]) => ({
            mese,
            ore: parseFloat(ore.toFixed(2))
        }))
        .sort((a, b) => a.mese.localeCompare(b.mese));
}

/**
 * Calcola tipi lavoro più frequenti
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {number} limit - Numero massimo di risultati (default: 5)
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @returns {Promise<Array>} Array con tipoLavoro e frequenza
 */
export async function getTipiLavoroPiuFrequenti(periodo, limit, getAllAttivitaCallback) {
    if (!getAllAttivitaCallback) return [];
    const attivita = await getAllAttivitaCallback(periodo);
    const frequenza = {};
    attivita.forEach(att => {
        const tipo = att.tipoLavoro || 'Non specificato';
        frequenza[tipo] = (frequenza[tipo] || 0) + 1;
    });
    return Object.entries(frequenza)
        .map(([tipoLavoro, frequenza]) => ({
            tipoLavoro,
            frequenza
        }))
        .sort((a, b) => b.frequenza - a.frequenza)
        .slice(0, limit || 5);
}

// ============================================
// FUNZIONI CALCOLO STATISTICHE MACCHINE
// ============================================

/**
 * Calcola ore macchine totali (da attività e lavori)
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {boolean} hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @param {Object} dependencies - Dipendenze Firebase
 * @returns {Promise<number>} Totale ore macchine
 */
export async function getOreMacchineTotali(periodo, hasParcoMacchineModule, currentTenantId, getAllAttivitaCallback, dependencies) {
    if (!hasParcoMacchineModule) return 0;
    
    try {
        const snapshot = await loadStatisticheMacchineSnapshot(
            periodo, hasParcoMacchineModule, currentTenantId, getAllAttivitaCallback, dependencies
        );
        return aggregaOreMacchineTotali(snapshot.attivita, snapshot.oreRows);
    } catch (error) {
        console.error('Errore calcolo ore macchine totali:', error);
        return 0;
    }
}

/**
 * Calcola macchine più utilizzate
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {number} limit - Numero massimo di risultati (default: 5)
 * @param {boolean} hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Array} macchineList - Lista macchine
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @param {Function} loadMacchineCallback - Callback per caricare macchine
 * @param {Object} dependencies - Dipendenze Firebase
 * @returns {Promise<Array>} Array con macchinaId, nome, tipo e ore
 */
export async function getMacchinePiuUtilizzate(periodo, limit, hasParcoMacchineModule, currentTenantId, macchineList, getAllAttivitaCallback, loadMacchineCallback, dependencies) {
    if (!hasParcoMacchineModule) return [];
    
    try {
        const snapshot = await loadStatisticheMacchineSnapshot(
            periodo, hasParcoMacchineModule, currentTenantId, getAllAttivitaCallback, dependencies
        );
        let macchine = macchineList || [];
        if (macchine.length === 0 && loadMacchineCallback) {
            macchine = await loadMacchineCallback();
        }
        return aggregaMacchinePiuUtilizzate(snapshot.attivita, snapshot.oreRows, macchine, limit || 5);
    } catch (error) {
        console.error('Errore calcolo macchine più utilizzate:', error);
        return [];
    }
}

/**
 * Calcola manutenzioni in scadenza (prossimi 30 giorni o 50 ore)
 * @param {boolean} hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {Array} macchineList - Lista macchine
 * @returns {Promise<number>} Numero manutenzioni in scadenza
 */
export async function getManutenzioniInScadenza(hasParcoMacchineModule, macchineList) {
    if (!hasParcoMacchineModule) return 0;
    
    try {
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        const tra30Giorni = new Date(oggi);
        tra30Giorni.setDate(tra30Giorni.getDate() + 30);
        
        let count = 0;
        
        macchineList.forEach(macchina => {
            if (macchina.stato === 'dismesso') return;
            const flotta = ['furgone', 'automezzo', 'veicolo'].includes((macchina.tipoMacchina || macchina.tipo || '').toLowerCase());
            
            if (flotta && macchina.kmProssimaManutenzione != null && macchina.kmAttuali != null) {
                const kmRimanenti = macchina.kmProssimaManutenzione - macchina.kmAttuali;
                if (kmRimanenti <= 2000 && kmRimanenti > 0) {
                    count++;
                }
            } else if (!flotta && macchina.oreProssimaManutenzione && macchina.oreAttuali) {
                const oreRimanenti = macchina.oreProssimaManutenzione - macchina.oreAttuali;
                if (oreRimanenti <= 50 && oreRimanenti > 0) {
                    count++;
                }
            }
            
            // Verifica per data
            if (macchina.prossimaManutenzione) {
                const scadenza = macchina.prossimaManutenzione.toDate 
                    ? macchina.prossimaManutenzione.toDate() 
                    : new Date(macchina.prossimaManutenzione);
                scadenza.setHours(0, 0, 0, 0);
                
                if (scadenza >= oggi && scadenza <= tra30Giorni) {
                    count++;
                }
            }
        });
        
        return count;
    } catch (error) {
        console.error('Errore calcolo manutenzioni in scadenza:', error);
        return 0;
    }
}

/**
 * Calcola ore macchina per terreno
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {boolean} hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @param {Object} dependencies - Dipendenze Firebase
 * @returns {Promise<Array>} Array con terrenoNome e ore
 */
export async function getOreMacchinaPerTerreno(periodo, hasParcoMacchineModule, currentTenantId, getAllAttivitaCallback, dependencies) {
    if (!hasParcoMacchineModule) return [];
    
    try {
        const snapshot = await loadStatisticheMacchineSnapshot(
            periodo, hasParcoMacchineModule, currentTenantId, getAllAttivitaCallback, dependencies
        );
        return aggregaOreMacchinaPerTerreno(
            snapshot.attivita,
            snapshot.oreRows,
            snapshot.terreniMap,
            isTerrenoArchiviato
        );
    } catch (error) {
        console.error('Errore calcolo ore macchina per terreno:', error);
        return [];
    }
}

/**
 * Calcola ore macchina vs ore lavoratore (stesse fonti del KPI: Diario + Manodopera).
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {boolean} hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @param {string} [currentTenantId]
 * @param {Object} [dependencies]
 * @returns {Promise<Object>} Oggetto con oreLavoratore e oreMacchina
 */
export async function getOreMacchinaVsLavoratore(periodo, hasParcoMacchineModule, getAllAttivitaCallback, currentTenantId = null, dependencies = null) {
    if (!hasParcoMacchineModule) return { oreLavoratore: 0, oreMacchina: 0 };
    
    try {
        const snapshot = await loadStatisticheMacchineSnapshot(
            periodo, hasParcoMacchineModule, currentTenantId, getAllAttivitaCallback, dependencies
        );
        return aggregaOreMacchinaVsLavoratore(snapshot.attivita, snapshot.oreRows);
    } catch (error) {
        console.error('Errore calcolo ore macchina vs lavoratore:', error);
        return { oreLavoratore: 0, oreMacchina: 0 };
    }
}

/**
 * Calcola ore macchine per mese
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {boolean} hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @param {Object} dependencies - Dipendenze Firebase
 * @returns {Promise<Array>} Array con mese e ore
 */
export async function getOreMacchinePerMese(periodo, hasParcoMacchineModule, currentTenantId, getAllAttivitaCallback, dependencies) {
    if (!hasParcoMacchineModule) return [];
    
    try {
        const snapshot = await loadStatisticheMacchineSnapshot(
            periodo, hasParcoMacchineModule, currentTenantId, getAllAttivitaCallback, dependencies
        );
        return aggregaOreMacchinePerMese(snapshot.attivita, snapshot.oreRows);
    } catch (error) {
        console.error('Errore calcolo ore macchine per mese:', error);
        return [];
    }
}

// ============================================
// FUNZIONI CARICAMENTO STATISTICHE
// ============================================

/**
 * Carica e aggiorna tutte le statistiche principali
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Object} callbacks - Callbacks per funzioni (getAllTerreni, getAllAttivita, getTotale*, getOre*, getAttivita*, getTipiLavoro*, loadStatisticheTerreni, loadStatisticheMacchine, updateChart*)
 * @param {Object} utils - Funzioni utility (formatOre)
 * @param {boolean} hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 */
export async function loadStatistiche(currentTenantId, dependencies, callbacks, utils, hasParcoMacchineModule) {
    try {
        resetStatisticheIndexWarning();

        // Ottieni filtri
        const dataDa = document.getElementById('filter-data-da')?.value || '';
        const dataA = document.getElementById('filter-data-a')?.value || '';
        const terrenoId = document.getElementById('filter-terreno')?.value || '';
        const tipoLavoro = document.getElementById('filter-tipo-lavoro')?.value || '';

        const periodo = {};
        if (dataDa) periodo.dataDa = dataDa;
        if (dataA) periodo.dataA = dataA;
        if (terrenoId) periodo.terrenoId = terrenoId;
        if (tipoLavoro) periodo.tipoLavoro = tipoLavoro;

        // Calcola statistiche
        const [totaleTerreni, totaleOre, totaleAttivita, orePerTipoLavoro, attivitaPerTerreno, orePerMese, tipiLavoroPiuFrequenti] = await Promise.all([
            callbacks.getTotaleTerreni?.(periodo),
            callbacks.getTotaleOre?.(periodo),
            callbacks.getTotaleAttivita?.(periodo),
            callbacks.getOrePerTipoLavoro?.(periodo),
            callbacks.getAttivitaPerTerreno?.(periodo),
            callbacks.getOrePerMese?.(periodo),
            callbacks.getTipiLavoroPiuFrequenti?.(periodo, 5)
        ]);

        // Aggiorna metriche
        const metricTerreni = document.getElementById('metric-terreni');
        const metricOre = document.getElementById('metric-ore');
        const metricAttivita = document.getElementById('metric-attivita');
        const metricOreMese = document.getElementById('metric-ore-mese');
        
        if (metricTerreni) metricTerreni.textContent = totaleTerreni || 0;
        if (metricOre) metricOre.textContent = utils.formatOre(totaleOre || 0);
        if (metricAttivita) metricAttivita.textContent = totaleAttivita || 0;
        
        // Calcola media ore/mese
        const mediaOreMese = orePerMese && orePerMese.length > 0 ? (totaleOre / orePerMese.length).toFixed(1) : 0;
        if (metricOreMese) metricOreMese.textContent = utils.formatOre(parseFloat(mediaOreMese));

        // Aggiorna sottotitoli (gg/mm/aaaa; i filtri restano YYYY-MM-DD)
        const periodoText = formatPeriodoFiltroText(dataDa, dataA);
        const metricOreSubtitle = document.getElementById('metric-ore-subtitle');
        const metricAttivitaSubtitle = document.getElementById('metric-attivita-subtitle');
        const metricOreMeseSubtitle = document.getElementById('metric-ore-mese-subtitle');
        
        if (metricOreSubtitle) metricOreSubtitle.textContent = periodoText;
        if (metricAttivitaSubtitle) metricAttivitaSubtitle.textContent = periodoText;
        if (metricOreMeseSubtitle) metricOreMeseSubtitle.textContent = periodoText;

        // Aggiorna grafici (isolati: un fallimento non blocca il resto né le Macchine)
        safeUpdateChart(
            () => callbacks.updateChartOreTipo?.(orePerTipoLavoro || []),
            'chart-ore-tipo',
            'Ore per tipo'
        );
        safeUpdateChart(
            () => callbacks.updateChartAttivitaTerreno?.(attivitaPerTerreno || []),
            'chart-attivita-terreno',
            'Attività per terreno'
        );
        safeUpdateChart(
            () => callbacks.updateChartOreMese?.(orePerMese || []),
            'chart-ore-mese',
            'Ore per mese'
        );
        safeUpdateChart(
            () => callbacks.updateChartTopLavori?.(tipiLavoroPiuFrequenti || []),
            'chart-top-lavori',
            'Top lavori'
        );

        // Terreni e Macchine in parallelo
        const sideLoads = [];
        if (callbacks.loadStatisticheTerreni) {
            sideLoads.push(callbacks.loadStatisticheTerreni());
        }
        if (hasParcoMacchineModule && callbacks.loadStatisticheMacchine) {
            sideLoads.push(callbacks.loadStatisticheMacchine(periodo));
        }
        if (sideLoads.length) {
            await Promise.all(sideLoads);
        }
    } catch (error) {
        console.error('Errore caricamento statistiche:', error);
        alert('Errore nel caricamento delle statistiche: ' + error.message);
    }
}

/**
 * Carica statistiche terreni e aggiorna UI
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Function} getAllTerreniCallback - Callback per ottenere tutti i terreni
 * @param {Function} getTenantIdCallback - Callback per ottenere tenant ID
 * @param {Object} utils - Funzioni utility (calcolaAlertAffitto, formattaDataScadenza, escapeHtml)
 * @param {Function} updateChartDistribuzioneTerreniCallback - Callback per aggiornare grafico distribuzione terreni
 * @param {Function} updateChartDistribuzioneSuperficieCallback - Callback per aggiornare grafico distribuzione superficie
 */
export async function loadStatisticheTerreni(currentTenantId, dependencies, getAllTerreniCallback, getTenantIdCallback, utils, updateChartDistribuzioneTerreniCallback, updateChartDistribuzioneSuperficieCallback) {
    try {
        let tenantId = currentTenantId;
        if (!tenantId) {
            const { auth } = dependencies;
            const user = auth.currentUser;
            if (user && getTenantIdCallback) {
                tenantId = await getTenantIdCallback(user.uid, dependencies, null);
            }
        }
        
        if (!tenantId) return;
        
        const terreni = await getAllTerreniCallback();
        const metriche = calcolaMetricheTerreniAttivi(terreni);
        const {
            totaleTerreni,
            terreniProprieta,
            terreniAffitto,
            superficieTotale,
            superficieProprieta,
            superficieAffitto,
            canoneMensileTotale
        } = metriche;
        
        const canoneAnnuoTotale = canoneMensileTotale * 12;
        
        // Aggiorna metriche
        const statTerreniTotali = document.getElementById('stat-terreni-totali');
        const statTerreniProprieta = document.getElementById('stat-terreni-proprieta');
        const statTerreniAffitto = document.getElementById('stat-terreni-affitto');
        const statSuperficieTotale = document.getElementById('stat-superficie-totale');
        const statSuperficieProprieta = document.getElementById('stat-superficie-proprieta');
        const statSuperficieAffitto = document.getElementById('stat-superficie-affitto');
        const statCanoneMensile = document.getElementById('stat-canone-mensile');
        const statCanoneAnnuo = document.getElementById('stat-canone-annuo');
        
        if (statTerreniTotali) statTerreniTotali.textContent = totaleTerreni;
        if (statTerreniProprieta) statTerreniProprieta.textContent = terreniProprieta;
        if (statTerreniAffitto) statTerreniAffitto.textContent = terreniAffitto;
        if (statSuperficieTotale) statSuperficieTotale.textContent = superficieTotale.toFixed(2);
        if (statSuperficieProprieta) statSuperficieProprieta.textContent = superficieProprieta.toFixed(2);
        if (statSuperficieAffitto) statSuperficieAffitto.textContent = superficieAffitto.toFixed(2);
        if (statCanoneMensile) statCanoneMensile.textContent = canoneMensileTotale > 0 ? `€${canoneMensileTotale.toFixed(2)}` : '-';
        if (statCanoneAnnuo) statCanoneAnnuo.textContent = canoneAnnuoTotale > 0 ? `€${canoneAnnuoTotale.toFixed(2)}` : '-';
        
        // Aggiorna grafici
        if (updateChartDistribuzioneTerreniCallback) {
            updateChartDistribuzioneTerreniCallback(terreniProprieta, terreniAffitto);
        }
        if (updateChartDistribuzioneSuperficieCallback) {
            updateChartDistribuzioneSuperficieCallback(superficieProprieta, superficieAffitto);
        }
        
        // Carica affitti in scadenza
        const affitti = terreni
            .filter(t => t.tipoPossesso === 'affitto' && t.dataScadenzaAffitto)
            .map(t => ({
                ...t,
                alert: utils.calcolaAlertAffitto(t.dataScadenzaAffitto)
            }))
            .sort((a, b) => {
                const order = { 'red': 0, 'yellow': 1, 'green': 2, 'grey': 3 };
                const orderA = order[a.alert.colore] !== undefined ? order[a.alert.colore] : 999;
                const orderB = order[b.alert.colore] !== undefined ? order[b.alert.colore] : 999;
                if (orderA !== orderB) return orderA - orderB;
                return (a.alert.giorni || 999) - (b.alert.giorni || 999);
            });
        
        const listaEl = document.getElementById('affitti-scadenza-lista');
        if (listaEl) {
            if (affitti.length === 0) {
                listaEl.innerHTML = '<div style="text-align: center; color: #666;">Nessun terreno in affitto registrato</div>';
            } else {
                let html = '';
                affitti.forEach(affitto => {
                    const dataFormattata = utils.formattaDataScadenza(affitto.dataScadenzaAffitto);
                    const pallinoEmoji = affitto.alert.colore === 'red' ? '🔴' : affitto.alert.colore === 'yellow' ? '🟡' : affitto.alert.colore === 'green' ? '🟢' : '⚫';
                    const coloreBordo = affitto.alert.colore === 'red' ? '#dc3545' : affitto.alert.colore === 'yellow' ? '#ffc107' : affitto.alert.colore === 'green' ? '#28a745' : '#6c757d';
                    const coloreSfondo = affitto.alert.colore === 'red' ? '#f8d7da' : affitto.alert.colore === 'yellow' ? '#fff3cd' : affitto.alert.colore === 'green' ? '#d4edda' : '#e9ecef';
                    
                    html += `
                        <div style="padding: 12px; margin-bottom: 10px; background: ${coloreSfondo}; border-left: 3px solid ${coloreBordo}; border-radius: 4px;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                                <span>${pallinoEmoji}</span>
                                <span>${utils.escapeHtml(affitto.nome || 'Senza nome')}</span>
                            </div>
                            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">
                                <strong>Scade:</strong> ${dataFormattata} (${affitto.alert.testo})
                            </div>
                            ${affitto.canoneAffitto ? `
                                <div style="font-size: 12px; color: #666;">
                                    <strong>Canone:</strong> €${affitto.canoneAffitto.toFixed(2)}/mese
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
                listaEl.innerHTML = html;
            }
        }
    } catch (error) {
        console.error('Errore caricamento statistiche terreni:', error);
    }
}

/**
 * Carica e aggiorna statistiche macchine
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {boolean} hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Array} macchineList - Lista macchine
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Object} callbacks - Callbacks per funzioni (getOreMacchineTotali, getMacchinePiuUtilizzate, getManutenzioniInScadenza, getOreMacchinaPerTerreno, getOreMacchinaVsLavoratore, getOreMacchinePerMese, loadMacchine, getAllAttivita, updateChart*)
 * @param {Object} utils - Funzioni utility (formatOre)
 */
export async function loadStatisticheMacchine(periodo, hasParcoMacchineModule, currentTenantId, macchineList, dependencies, callbacks, utils) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    setMacchineKpiLoading();

    try {
        let macchine = macchineList || [];
        if (macchine.length === 0 && callbacks.loadMacchine) {
            macchine = await callbacks.loadMacchine();
        }

        const snapshot = await loadStatisticheMacchineSnapshot(
            periodo,
            hasParcoMacchineModule,
            currentTenantId,
            callbacks.getAllAttivita,
            dependencies
        );

        const oreMacchineTotali = aggregaOreMacchineTotali(snapshot.attivita, snapshot.oreRows);
        const macchinePiuUtilizzate = aggregaMacchinePiuUtilizzate(snapshot.attivita, snapshot.oreRows, macchine, 5);
        const oreMacchinaPerTerreno = aggregaOreMacchinaPerTerreno(
            snapshot.attivita,
            snapshot.oreRows,
            snapshot.terreniMap,
            isTerrenoArchiviato
        );
        const oreMacchinaVsLavoratore = aggregaOreMacchinaVsLavoratore(snapshot.attivita, snapshot.oreRows);
        const oreMacchinePerMese = aggregaOreMacchinePerMese(snapshot.attivita, snapshot.oreRows);
        const manutenzioniScadenza = callbacks.getManutenzioniInScadenza
            ? await callbacks.getManutenzioniInScadenza(hasParcoMacchineModule, macchine)
            : 0;

        const metricOreMacchineTotali = document.getElementById('metric-ore-macchine-totali');
        const metricMacchineUtilizzate = document.getElementById('metric-macchine-utilizzate');
        const metricUtilizzoMedio = document.getElementById('metric-utilizzo-medio');
        const metricManutenzioniScadenza = document.getElementById('metric-manutenzioni-scadenza');
        
        if (metricOreMacchineTotali) metricOreMacchineTotali.textContent = utils.formatOre(oreMacchineTotali || 0);
        if (metricMacchineUtilizzate) metricMacchineUtilizzate.textContent = (macchinePiuUtilizzate?.length || 0);
        
        const macchineTotali = macchine.filter(m => m.stato !== 'dismesso').length;
        const utilizzoMedio = macchineTotali > 0 ? (oreMacchineTotali / macchineTotali).toFixed(1) : 0;
        if (metricUtilizzoMedio) metricUtilizzoMedio.textContent = utils.formatOre(parseFloat(utilizzoMedio));
        if (metricManutenzioniScadenza) metricManutenzioniScadenza.textContent = manutenzioniScadenza || 0;

        const periodoText = formatPeriodoFiltroText(periodo.dataDa, periodo.dataA);
        const metricOreMacchineSubtitle = document.getElementById('metric-ore-macchine-subtitle');
        const metricMacchineUtilizzateSubtitle = document.getElementById('metric-macchine-utilizzate-subtitle');
        
        if (metricOreMacchineSubtitle) metricOreMacchineSubtitle.textContent = periodoText;
        if (metricMacchineUtilizzateSubtitle) metricMacchineUtilizzateSubtitle.textContent = periodoText;

        safeUpdateChart(
            () => callbacks.updateChartTopMacchine?.(macchinePiuUtilizzate || []),
            'chart-top-macchine',
            'Top macchine'
        );
        safeUpdateChart(
            () => callbacks.updateChartOreMacchinaTerreno?.(oreMacchinaPerTerreno || []),
            'chart-ore-macchina-terreno',
            'Ore macchina per terreno'
        );
        safeUpdateChart(
            () => callbacks.updateChartOreMacchinaVsLavoratore?.(oreMacchinaVsLavoratore || {}),
            'chart-ore-macchina-vs-lavoratore',
            'Ore macchina vs lavoratore'
        );
        safeUpdateChart(
            () => callbacks.updateChartOreMacchineMese?.(oreMacchinePerMese || []),
            'chart-ore-macchine-mese',
            'Ore macchine per mese'
        );

        const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const ms = Math.round(t1 - t0);
        console.info('[statistiche-macchine] caricamento ms=', ms, 'fetchStats=', snapshot.fetchStats);
    } catch (error) {
        console.error('Errore caricamento statistiche macchine:', error);
    }
}

/**
 * Carica dropdown filtri (terreni e tipi lavoro)
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Function} getAllTerreniCallback - Callback per ottenere tutti i terreni
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività (fallback)
 * @param {Function} getTenantIdCallback - Callback per ottenere tenant ID
 */
export async function loadFilters(currentTenantId, dependencies, getAllTerreniCallback, getAllAttivitaCallback, getTenantIdCallback) {
    try {
        let tenantId = currentTenantId;
        if (!tenantId) {
            const { auth } = dependencies;
            const user = auth.currentUser;
            if (user && getTenantIdCallback) {
                tenantId = await getTenantIdCallback(user.uid, dependencies, null);
            }
        }
        
        if (!tenantId) {
            console.warn('Tenant ID non disponibile per caricare filtri');
            return;
        }

        // Carica terreni
        const terreni = await getAllTerreniCallback();
        const selectTerreno = document.getElementById('filter-terreno');
        if (selectTerreno) {
            selectTerreno.innerHTML = '<option value="">Tutti i terreni</option>';
            terreni.forEach(terreno => {
                const option = document.createElement('option');
                option.value = terreno.id;
                option.textContent = terreno.nome;
                selectTerreno.appendChild(option);
            });
        }

        // Carica tipi lavoro usando liste-service.js (fonte unica di verità)
        try {
            const isFileProtocol = window.location.protocol === 'file:';
            let tipiLavoro = [];
            
            if (isFileProtocol) {
                // Fallback per ambiente file://: carica direttamente da Firestore
                console.warn('Ambiente file:// rilevato, uso fallback diretto da Firestore');
                const { doc, getDoc } = dependencies;
                const listeRef = doc(dependencies.db, `tenants/${tenantId}/liste`, 'personalizzate');
                const listeSnap = await getDoc(listeRef);
                
                if (listeSnap.exists()) {
                    const data = listeSnap.data();
                    tipiLavoro = data.tipiLavoro || [];
                } else {
                    // Predefiniti
                    tipiLavoro = ['Potatura', 'Raccolta', 'Trattamento', 'Semina', 'Aratura', 'Irrigazione', 'Concimazione', 'Diserbo', 'Raccolta frutta', 'Raccolta verdura'];
                }
            } else {
                // Usa servizio centralizzato
                try {
                    const { setFirebaseInstances } = await import('../services/firebase-service.js');
                    const { app, db, auth } = dependencies;
                    setFirebaseInstances({ app, db, auth });
                } catch (error) {
                    console.warn('Impossibile impostare Firebase instances nel servizio:', error);
                }
                
                try {
                    const { setCurrentTenantId } = await import('../services/tenant-service.js');
                    if (tenantId) {
                        setCurrentTenantId(tenantId);
                    }
                } catch (error) {
                    console.warn('Impossibile impostare tenantId nel servizio:', error);
                }
                
                // Usa liste-service per ottenere tipi lavoro sincronizzati
                const { getTipiLavoroNomi } = await import('../services/liste-service.js');
                tipiLavoro = await getTipiLavoroNomi();
            }
            
            const selectTipoLavoro = document.getElementById('filter-tipo-lavoro');
            if (selectTipoLavoro) {
                selectTipoLavoro.innerHTML = '<option value="">Tutti i tipi</option>';
                tipiLavoro.forEach(tipo => {
                    const option = document.createElement('option');
                    option.value = tipo;
                    option.textContent = tipo;
                    selectTipoLavoro.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Errore caricamento tipi lavoro:', error);
            // Fallback: carica dalle attività
            try {
                const attivita = await getAllAttivitaCallback();
                const tipiLavoro = [...new Set(attivita.map(a => a.tipoLavoro).filter(Boolean))].sort();
                const selectTipoLavoro = document.getElementById('filter-tipo-lavoro');
                if (selectTipoLavoro) {
                    selectTipoLavoro.innerHTML = '<option value="">Tutti i tipi</option>';
                    tipiLavoro.forEach(tipo => {
                        const option = document.createElement('option');
                        option.value = tipo;
                        option.textContent = tipo;
                        selectTipoLavoro.appendChild(option);
                    });
                }
            } catch (fallbackError) {
                console.error('Errore fallback caricamento tipi lavoro:', fallbackError);
            }
        }
    } catch (error) {
        console.error('Errore caricamento filtri:', error);
    }
}


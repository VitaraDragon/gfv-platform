/**
 * Statistiche Controller - Logica principale caricamento dati e calcolo statistiche
 * 
 * @module core/js/statistiche-controller
 */

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
export async function getAllTerreni(currentTenantId, dependencies, getTenantIdCallback) {
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
            });
    } catch (error) {
        console.error('Errore caricamento terreni:', error);
        return [];
    }
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
                
                // Mostra messaggio informativo
                const indexLink = error.message.match(/https:\/\/[^\s]+/);
                if (indexLink) {
                    console.warn('Per migliorare le prestazioni, crea l\'indice Firestore:', indexLink[0]);
                }
                
                return results;
            } catch (retryError) {
                console.error('Errore anche senza orderBy:', retryError);
                const indexLink = error.message.match(/https:\/\/[^\s]+/);
                if (indexLink) {
                    alert(`È necessario creare un indice Firestore per i filtri multipli.\n\nApri questo link per crearlo automaticamente:\n\n${indexLink[0]}\n\nDopo aver creato l'indice, attendi qualche minuto e riprova.`);
                }
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
 * Calcola totale terreni
 * @param {Function} getAllTerreniCallback - Callback per ottenere tutti i terreni
 * @returns {Promise<number>} Numero totale terreni
 */
export async function getTotaleTerreni(getAllTerreniCallback) {
    if (!getAllTerreniCallback) return 0;
    const terreni = await getAllTerreniCallback();
    return terreni.length;
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
        const attivita = await getAllAttivitaCallback(periodo);
        let totaleOre = 0;
        
        // Somma ore macchina da attività Core Base
        attivita.forEach(att => {
            if (att.oreMacchina && att.oreMacchina > 0) {
                totaleOre += att.oreMacchina;
            }
        });
        
        // Se modulo Manodopera attivo, aggiungi anche ore da lavori
        try {
            const { getDoc, doc, collection, getDocs, query, where } = dependencies;
            const tenantDoc = await getDoc(doc(dependencies.db, 'tenants', currentTenantId));
            if (tenantDoc.exists()) {
                const tenantData = tenantDoc.data();
                const hasManodoperaModule = tenantData.modules && tenantData.modules.includes('manodopera');
                
                if (hasManodoperaModule) {
                    const lavoriRef = collection(dependencies.db, `tenants/${currentTenantId}/lavori`);
                    const lavoriSnapshot = await getDocs(lavoriRef);
                    
                    for (const lavoroDoc of lavoriSnapshot.docs) {
                        const lavoro = lavoroDoc.data();
                        const lavoroId = lavoroDoc.id;
                        
                        // Filtra per periodo se necessario
                        if (periodo.dataDa || periodo.dataA) {
                            const dataInizio = lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date(lavoro.dataInizio);
                            const dataInizioString = dataInizio.toISOString().split('T')[0];
                            
                            if (periodo.dataDa && dataInizioString < periodo.dataDa) continue;
                            if (periodo.dataA && dataInizioString > periodo.dataA) continue;
                        }
                        
                        // Carica ore validate per questo lavoro
                        const oreRef = collection(dependencies.db, `tenants/${currentTenantId}/lavori/${lavoroId}/oreOperai`);
                        const oreQuery = query(oreRef, where('stato', '==', 'validate'));
                        const oreSnapshot = await getDocs(oreQuery);
                        
                        oreSnapshot.forEach(oraDoc => {
                            const ora = oraDoc.data();
                            if (ora.oreMacchina && ora.oreMacchina > 0) {
                                totaleOre += ora.oreMacchina;
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('Errore caricamento ore macchine da Manodopera:', error);
        }
        
        return parseFloat(totaleOre.toFixed(2));
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
        const attivita = await getAllAttivitaCallback(periodo);
        const orePerMacchina = {};
        
        // Conta ore per macchina da attività Core Base
        attivita.forEach(att => {
            if (att.macchinaId && att.oreMacchina && att.oreMacchina > 0) {
                if (!orePerMacchina[att.macchinaId]) {
                    orePerMacchina[att.macchinaId] = 0;
                }
                orePerMacchina[att.macchinaId] += att.oreMacchina;
            }
            if (att.attrezzoId && att.oreMacchina && att.oreMacchina > 0) {
                if (!orePerMacchina[att.attrezzoId]) {
                    orePerMacchina[att.attrezzoId] = 0;
                }
                orePerMacchina[att.attrezzoId] += att.oreMacchina;
            }
        });
        
        // Se modulo Manodopera attivo, aggiungi anche ore da lavori
        try {
            const { getDoc, doc, collection, getDocs, query, where } = dependencies;
            const tenantDoc = await getDoc(doc(dependencies.db, 'tenants', currentTenantId));
            if (tenantDoc.exists()) {
                const tenantData = tenantDoc.data();
                const hasManodoperaModule = tenantData.modules && tenantData.modules.includes('manodopera');
                
                if (hasManodoperaModule) {
                    const lavoriRef = collection(dependencies.db, `tenants/${currentTenantId}/lavori`);
                    const lavoriSnapshot = await getDocs(lavoriRef);
                    
                    for (const lavoroDoc of lavoriSnapshot.docs) {
                        const lavoro = lavoroDoc.data();
                        const lavoroId = lavoroDoc.id;
                        
                        // Filtra per periodo se necessario
                        if (periodo.dataDa || periodo.dataA) {
                            const dataInizio = lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date(lavoro.dataInizio);
                            const dataInizioString = dataInizio.toISOString().split('T')[0];
                            
                            if (periodo.dataDa && dataInizioString < periodo.dataDa) continue;
                            if (periodo.dataA && dataInizioString > periodo.dataA) continue;
                        }
                        
                        // Carica ore validate per questo lavoro
                        const oreRef = collection(dependencies.db, `tenants/${currentTenantId}/lavori/${lavoroId}/oreOperai`);
                        const oreQuery = query(oreRef, where('stato', '==', 'validate'));
                        const oreSnapshot = await getDocs(oreQuery);
                        
                        oreSnapshot.forEach(oraDoc => {
                            const ora = oraDoc.data();
                            if (ora.macchinaId && ora.oreMacchina && ora.oreMacchina > 0) {
                                if (!orePerMacchina[ora.macchinaId]) {
                                    orePerMacchina[ora.macchinaId] = 0;
                                }
                                orePerMacchina[ora.macchinaId] += ora.oreMacchina;
                            }
                            if (ora.attrezzoId && ora.oreMacchina && ora.oreMacchina > 0) {
                                if (!orePerMacchina[ora.attrezzoId]) {
                                    orePerMacchina[ora.attrezzoId] = 0;
                                }
                                orePerMacchina[ora.attrezzoId] += ora.oreMacchina;
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('Errore caricamento ore macchine da Manodopera:', error);
        }
        
        // Assicurati che le macchine siano caricate
        let macchine = macchineList;
        if (macchine.length === 0 && loadMacchineCallback) {
            macchine = await loadMacchineCallback();
        }
        
        // Crea mappa macchine
        const macchineMap = {};
        macchine.forEach(m => {
            macchineMap[m.id] = m;
        });
        
        return Object.entries(orePerMacchina)
            .map(([macchinaId, ore]) => {
                const macchina = macchineMap[macchinaId];
                return {
                    macchinaId,
                    nome: macchina?.nome || `Macchina ${macchinaId.substring(0, 8)}...`,
                    tipo: macchina?.tipoMacchina || macchina?.tipo || 'macchina',
                    ore: parseFloat(ore.toFixed(2))
                };
            })
            .sort((a, b) => b.ore - a.ore)
            .slice(0, limit || 5);
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
            
            // Verifica per ore
            if (macchina.oreProssimaManutenzione && macchina.oreAttuali) {
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
        const attivita = await getAllAttivitaCallback(periodo);
        const orePerTerreno = {};
        
        attivita.forEach(att => {
            if (att.terrenoNome && att.oreMacchina && att.oreMacchina > 0) {
                if (!orePerTerreno[att.terrenoNome]) {
                    orePerTerreno[att.terrenoNome] = 0;
                }
                orePerTerreno[att.terrenoNome] += att.oreMacchina;
            }
        });
        
        // Se modulo Manodopera attivo, aggiungi anche ore da lavori
        try {
            const { getDoc, doc, collection, getDocs, query, where } = dependencies;
            const tenantDoc = await getDoc(doc(dependencies.db, 'tenants', currentTenantId));
            if (tenantDoc.exists()) {
                const tenantData = tenantDoc.data();
                const hasManodoperaModule = tenantData.modules && tenantData.modules.includes('manodopera');
                
                if (hasManodoperaModule) {
                    const lavoriRef = collection(dependencies.db, `tenants/${currentTenantId}/lavori`);
                    const lavoriSnapshot = await getDocs(lavoriRef);
                    
                    for (const lavoroDoc of lavoriSnapshot.docs) {
                        const lavoro = lavoroDoc.data();
                        const lavoroId = lavoroDoc.id;
                        
                        // Filtra per periodo se necessario
                        if (periodo.dataDa || periodo.dataA) {
                            const dataInizio = lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date(lavoro.dataInizio);
                            const dataInizioString = dataInizio.toISOString().split('T')[0];
                            
                            if (periodo.dataDa && dataInizioString < periodo.dataDa) continue;
                            if (periodo.dataA && dataInizioString > periodo.dataA) continue;
                        }
                        
                        // Carica terreno
                        const terrenoId = lavoro.terrenoId;
                        if (!terrenoId) continue;
                        
                        const terrenoDoc = await getDoc(doc(dependencies.db, `tenants/${currentTenantId}/terreni`, terrenoId));
                        const terrenoNome = terrenoDoc.exists() ? terrenoDoc.data().nome : 'Terreno sconosciuto';
                        
                        // Carica ore validate per questo lavoro
                        const oreRef = collection(dependencies.db, `tenants/${currentTenantId}/lavori/${lavoroId}/oreOperai`);
                        const oreQuery = query(oreRef, where('stato', '==', 'validate'));
                        const oreSnapshot = await getDocs(oreQuery);
                        
                        oreSnapshot.forEach(oraDoc => {
                            const ora = oraDoc.data();
                            if (ora.oreMacchina && ora.oreMacchina > 0) {
                                if (!orePerTerreno[terrenoNome]) {
                                    orePerTerreno[terrenoNome] = 0;
                                }
                                orePerTerreno[terrenoNome] += ora.oreMacchina;
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('Errore caricamento ore macchine da Manodopera:', error);
        }
        
        return Object.entries(orePerTerreno)
            .map(([terrenoNome, ore]) => ({
                terrenoNome,
                ore: parseFloat(ore.toFixed(2))
            }))
            .sort((a, b) => b.ore - a.ore);
    } catch (error) {
        console.error('Errore calcolo ore macchina per terreno:', error);
        return [];
    }
}

/**
 * Calcola ore macchina vs ore lavoratore
 * @param {Object} periodo - Periodo con filtri opzionali
 * @param {boolean} hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {Function} getAllAttivitaCallback - Callback per ottenere tutte le attività
 * @returns {Promise<Object>} Oggetto con oreLavoratore e oreMacchina
 */
export async function getOreMacchinaVsLavoratore(periodo, hasParcoMacchineModule, getAllAttivitaCallback) {
    if (!hasParcoMacchineModule) return { oreLavoratore: 0, oreMacchina: 0 };
    
    try {
        const attivita = await getAllAttivitaCallback(periodo);
        let oreLavoratore = 0;
        let oreMacchina = 0;
        
        attivita.forEach(att => {
            if (att.oreNette) oreLavoratore += att.oreNette;
            if (att.oreMacchina) oreMacchina += att.oreMacchina;
        });
        
        return {
            oreLavoratore: parseFloat(oreLavoratore.toFixed(2)),
            oreMacchina: parseFloat(oreMacchina.toFixed(2))
        };
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
        const attivita = await getAllAttivitaCallback(periodo);
        const orePerMese = {};
        
        attivita.forEach(att => {
            if (!att.data || !att.oreMacchina) return;
            const mese = att.data.substring(0, 7);
            if (!orePerMese[mese]) {
                orePerMese[mese] = 0;
            }
            orePerMese[mese] += att.oreMacchina;
        });
        
        // Se modulo Manodopera attivo, aggiungi anche ore da lavori
        try {
            const { getDoc, doc, collection, getDocs, query, where } = dependencies;
            const tenantDoc = await getDoc(doc(dependencies.db, 'tenants', currentTenantId));
            if (tenantDoc.exists()) {
                const tenantData = tenantDoc.data();
                const hasManodoperaModule = tenantData.modules && tenantData.modules.includes('manodopera');
                
                if (hasManodoperaModule) {
                    const lavoriRef = collection(dependencies.db, `tenants/${currentTenantId}/lavori`);
                    const lavoriSnapshot = await getDocs(lavoriRef);
                    
                    for (const lavoroDoc of lavoriSnapshot.docs) {
                        const lavoro = lavoroDoc.data();
                        const lavoroId = lavoroDoc.id;
                        
                        // Carica ore validate per questo lavoro
                        const oreRef = collection(dependencies.db, `tenants/${currentTenantId}/lavori/${lavoroId}/oreOperai`);
                        const oreQuery = query(oreRef, where('stato', '==', 'validate'));
                        const oreSnapshot = await getDocs(oreQuery);
                        
                        oreSnapshot.forEach(oraDoc => {
                            const ora = oraDoc.data();
                            if (ora.data && ora.oreMacchina && ora.oreMacchina > 0) {
                                const dataOra = ora.data.toDate ? ora.data.toDate() : new Date(ora.data);
                                const mese = dataOra.toISOString().substring(0, 7);
                                
                                // Filtra per periodo se necessario
                                if (periodo.dataDa && mese < periodo.dataDa.substring(0, 7)) return;
                                if (periodo.dataA && mese > periodo.dataA.substring(0, 7)) return;
                                
                                if (!orePerMese[mese]) {
                                    orePerMese[mese] = 0;
                                }
                                orePerMese[mese] += ora.oreMacchina;
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('Errore caricamento ore macchine da Manodopera:', error);
        }
        
        return Object.entries(orePerMese)
            .map(([mese, ore]) => ({
                mese,
                ore: parseFloat(ore.toFixed(2))
            }))
            .sort((a, b) => a.mese.localeCompare(b.mese));
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
            callbacks.getTotaleTerreni?.(),
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

        // Aggiorna sottotitoli
        const periodoText = dataDa && dataA ? `${dataDa} - ${dataA}` : 'Tutti i periodi';
        const metricOreSubtitle = document.getElementById('metric-ore-subtitle');
        const metricAttivitaSubtitle = document.getElementById('metric-attivita-subtitle');
        const metricOreMeseSubtitle = document.getElementById('metric-ore-mese-subtitle');
        
        if (metricOreSubtitle) metricOreSubtitle.textContent = periodoText;
        if (metricAttivitaSubtitle) metricAttivitaSubtitle.textContent = periodoText;
        if (metricOreMeseSubtitle) metricOreMeseSubtitle.textContent = periodoText;

        // Aggiorna grafici
        if (callbacks.updateChartOreTipo) callbacks.updateChartOreTipo(orePerTipoLavoro || []);
        if (callbacks.updateChartAttivitaTerreno) callbacks.updateChartAttivitaTerreno(attivitaPerTerreno || []);
        if (callbacks.updateChartOreMese) callbacks.updateChartOreMese(orePerMese || []);
        if (callbacks.updateChartTopLavori) callbacks.updateChartTopLavori(tipiLavoroPiuFrequenti || []);

        // Carica statistiche terreni
        if (callbacks.loadStatisticheTerreni) {
            await callbacks.loadStatisticheTerreni();
        }
        
        // Carica statistiche macchine se modulo attivo
        if (hasParcoMacchineModule && callbacks.loadStatisticheMacchine) {
            await callbacks.loadStatisticheMacchine(periodo);
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
        
        // Calcola statistiche
        let totaleTerreni = terreni.length;
        let terreniProprieta = 0;
        let terreniAffitto = 0;
        let superficieTotale = 0;
        let superficieProprieta = 0;
        let superficieAffitto = 0;
        let canoneMensileTotale = 0;
        
        terreni.forEach(terreno => {
            const superficie = terreno.superficie || 0;
            superficieTotale += superficie;
            
            // Applica default 'proprieta' per retrocompatibilità
            const tipoPossesso = terreno.tipoPossesso || 'proprieta';
            
            if (tipoPossesso === 'proprieta') {
                terreniProprieta++;
                superficieProprieta += superficie;
            } else if (tipoPossesso === 'affitto') {
                terreniAffitto++;
                superficieAffitto += superficie;
                if (terreno.canoneAffitto) {
                    canoneMensileTotale += terreno.canoneAffitto;
                }
            }
        });
        
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
    try {
        // Assicurati che le macchine siano caricate
        let macchine = macchineList;
        if (macchine.length === 0 && callbacks.loadMacchine) {
            macchine = await callbacks.loadMacchine();
        }
        
        const [
            oreMacchineTotali,
            macchinePiuUtilizzate,
            manutenzioniScadenza,
            oreMacchinaPerTerreno,
            oreMacchinaVsLavoratore,
            oreMacchinePerMese
        ] = await Promise.all([
            callbacks.getOreMacchineTotali?.(periodo, hasParcoMacchineModule, currentTenantId, callbacks.getAllAttivita, dependencies),
            callbacks.getMacchinePiuUtilizzate?.(periodo, 5, hasParcoMacchineModule, currentTenantId, macchine, callbacks.getAllAttivita, callbacks.loadMacchine, dependencies),
            callbacks.getManutenzioniInScadenza?.(hasParcoMacchineModule, macchine),
            callbacks.getOreMacchinaPerTerreno?.(periodo, hasParcoMacchineModule, currentTenantId, callbacks.getAllAttivita, dependencies),
            callbacks.getOreMacchinaVsLavoratore?.(periodo, hasParcoMacchineModule, callbacks.getAllAttivita),
            callbacks.getOreMacchinePerMese?.(periodo, hasParcoMacchineModule, currentTenantId, callbacks.getAllAttivita, dependencies)
        ]);

        // Aggiorna metriche
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

        // Aggiorna sottotitoli
        const periodoText = periodo.dataDa && periodo.dataA ? `${periodo.dataDa} - ${periodo.dataA}` : 'Tutti i periodi';
        const metricOreMacchineSubtitle = document.getElementById('metric-ore-macchine-subtitle');
        const metricMacchineUtilizzateSubtitle = document.getElementById('metric-macchine-utilizzate-subtitle');
        
        if (metricOreMacchineSubtitle) metricOreMacchineSubtitle.textContent = periodoText;
        if (metricMacchineUtilizzateSubtitle) metricMacchineUtilizzateSubtitle.textContent = periodoText;

        // Aggiorna grafici
        if (callbacks.updateChartTopMacchine) callbacks.updateChartTopMacchine(macchinePiuUtilizzate || []);
        if (callbacks.updateChartOreMacchinaTerreno) callbacks.updateChartOreMacchinaTerreno(oreMacchinaPerTerreno || []);
        if (callbacks.updateChartOreMacchinaVsLavoratore) callbacks.updateChartOreMacchinaVsLavoratore(oreMacchinaVsLavoratore || {});
        if (callbacks.updateChartOreMacchineMese) callbacks.updateChartOreMacchineMese(oreMacchinePerMese || []);
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


/**
 * Gestione Lavori Controller - Logica principale gestione lavori
 * 
 * @module core/admin/js/gestione-lavori-controller
 */

// ============================================
// IMPORTS
// ============================================
// Le importazioni Firebase verranno fatte nel file HTML principale
// Questo modulo assume che db, auth, currentTenantId siano disponibili globalmente

// ============================================
// FUNZIONI HELPER
// ============================================

/**
 * Attende che le configurazioni Firebase siano caricate
 * @returns {Promise<Object>} Firebase config
 */
export function waitForConfig() {
    return new Promise((resolve, reject) => {
        if (typeof window.firebaseConfig !== 'undefined') {
            resolve(window.firebaseConfig);
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 50; // 5 secondi
        
        const checkInterval = setInterval(() => {
            attempts++;
            if (typeof window.firebaseConfig !== 'undefined') {
                clearInterval(checkInterval);
                resolve(window.firebaseConfig);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                reject(new Error('Firebase config not loaded after 5 seconds'));
            }
        }, 100);
    });
}

/**
 * Configura visibilità elementi Manodopera
 * @param {boolean} hasManodoperaModule - Se il modulo Manodopera è attivo
 */
export function setupManodoperaVisibility(hasManodoperaModule) {
    // Statistica ore validate
    const statOreValidate = document.getElementById('stat-ore-validate')?.closest('.stat-card');
    if (statOreValidate) {
        statOreValidate.style.display = hasManodoperaModule ? 'block' : 'none';
    }
    
    // Filtro caposquadra
    const filterCaposquadra = document.getElementById('filter-caposquadra')?.closest('.filter-group');
    if (filterCaposquadra) {
        filterCaposquadra.style.display = hasManodoperaModule ? 'flex' : 'none';
    }
    
    // Tab Ore nel modal dettaglio
    const tabOre = document.querySelector('button.modal-tab[onclick*="switchTab(\'ore\')"]');
    if (tabOre) {
        tabOre.style.display = hasManodoperaModule ? 'inline-block' : 'none';
    }
    const tabOreContent = document.getElementById('tab-ore');
    if (tabOreContent) {
        tabOreContent.style.display = hasManodoperaModule ? 'block' : 'none';
    }
    
    // Sezione tipo assegnazione nel form
    const tipoAssegnazioneGroup = document.querySelector('input[name="tipo-assegnazione"]')?.closest('.form-group');
    if (tipoAssegnazioneGroup) {
        tipoAssegnazioneGroup.style.display = hasManodoperaModule ? 'block' : 'none';
    }

    // Sezione stato lavoro
    const statoGroup = document.getElementById('lavoro-stato')?.closest('.form-group');
    if (statoGroup) {
        statoGroup.style.display = hasManodoperaModule ? 'block' : 'none';
    }
    
    // Campi caposquadra e operaio
    const caposquadraGroup = document.getElementById('caposquadra-group');
    if (caposquadraGroup) {
        caposquadraGroup.style.display = hasManodoperaModule ? 'block' : 'none';
    }
    const operaioGroup = document.getElementById('operaio-group');
    if (operaioGroup) {
        operaioGroup.style.display = hasManodoperaModule ? 'block' : 'none';
    }
    
    // Operatore macchina (solo se Manodopera attivo, altrimenti non ha senso)
    const operatoreMacchinaGroup = document.getElementById('operatore-macchina-group');
    if (operatoreMacchinaGroup) {
        operatoreMacchinaGroup.style.display = hasManodoperaModule ? 'block' : 'none';
    }
    
    // Rimuovi attributi required dai campi assegnazione quando Manodopera non è attivo
    const caposquadraSelect = document.getElementById('lavoro-caposquadra');
    const operaioSelect = document.getElementById('lavoro-operaio');
    const statoSelect = document.getElementById('lavoro-stato');
    if (caposquadraSelect) {
        caposquadraSelect.required = hasManodoperaModule;
    }
    if (operaioSelect) {
        operaioSelect.required = hasManodoperaModule;
    }
    if (statoSelect && !hasManodoperaModule) {
        statoSelect.value = 'in_corso';
    }
    
    // Rimuovi asterisco dai label quando Manodopera non è attivo
    const labelCaposquadra = document.getElementById('label-caposquadra');
    const labelOperaio = document.getElementById('label-operaio');
    if (labelCaposquadra) {
        labelCaposquadra.textContent = hasManodoperaModule ? 'Caposquadra *' : 'Caposquadra';
    }
    if (labelOperaio) {
        labelOperaio.textContent = hasManodoperaModule ? 'Operaio Responsabile *' : 'Operaio Responsabile';
    }
}

// ============================================
// FUNZIONI CARICAMENTO DATI
// ============================================

/**
 * Carica lista terreni da Firestore
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Array} terreniList - Array terreni (modificato in place)
 * @param {Function} populateTerrenoFilter - Callback per popolare filtro terreni
 * @param {Function} populateTerrenoDropdown - Callback per popolare dropdown terreni
 */
/**
 * Carica lista terreni usando servizio centralizzato
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Array} terreniList - Array terreni (modificato in place)
 * @param {Function} populateTerrenoFilter - Callback per popolare filtro terreni
 * @param {Function} populateTerrenoDropdown - Callback per popolare dropdown terreni
 */
export async function loadTerreni(currentTenantId, db, app, auth, terreniList, populateTerrenoFilter, populateTerrenoDropdown, isContoTerziMode = false) {
    try {
        if (!currentTenantId) {
            console.warn('loadTerreni: currentTenantId non disponibile');
            return;
        }
        
        // Usa servizio centralizzato tramite helper
        const { loadTerreniViaService } = await import('../../services/service-helper.js');
        
        let terreni = [];
        if (isContoTerziMode) {
            // In modalità conto terzi, carica direttamente da Firestore tutti i terreni
            // perché il servizio ha un default clienteId=null che filtra solo aziendali
            try {
                const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const terreniCollection = collection(db, 'tenants', currentTenantId, 'terreni');
                const querySnapshot = await getDocs(terreniCollection);
                
                const allTerreni = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    allTerreni.push({
                        id: doc.id,
                        nome: data.nome || '',
                        superficie: data.superficie || 0,
                        coordinate: data.coordinate || null,
                        polygonCoords: data.polygonCoords || null,
                        coltura: data.coltura || null,
                        colturaCategoria: data.colturaCategoria || null,
                        colturaSottocategoria: data.colturaSottocategoria || null,
                        tipoCampo: data.tipoCampo || null,
                        clienteId: data.clienteId || null, // IMPORTANTE: preserva clienteId
                        ...data // Include tutti gli altri campi
                    });
                });
                
                // Filtra solo terreni clienti (con clienteId non nullo)
                terreni = allTerreni.filter(t => t.clienteId != null && t.clienteId !== '');
                
                // Ordina per nome
                terreni.sort((a, b) => {
                    const nomeA = (a.nome || '').toLowerCase();
                    const nomeB = (b.nome || '').toLowerCase();
                    return nomeA.localeCompare(nomeB);
                });
                
                console.log(`[GESTIONE LAVORI] Modalità conto terzi: ${terreni.length} terreni clienti caricati`);
            } catch (error) {
                console.error('[GESTIONE LAVORI] Errore caricamento terreni clienti:', error);
                throw error;
            }
        } else {
            // In modalità normale, carica solo terreni aziendali
            terreni = await loadTerreniViaService({
                tenantId: currentTenantId,
                firebaseInstances: { app, db, auth },
                options: {
                    orderBy: 'nome',
                    orderDirection: 'asc',
                    clienteId: null // Solo terreni aziendali
                }
            });
        }
        
        terreniList.length = 0; // Pulisci array
        terreniList.push(...terreni);

        // Popola dropdown filtri
        if (populateTerrenoFilter) populateTerrenoFilter();
        if (populateTerrenoDropdown) populateTerrenoDropdown();
    } catch (error) {
        console.error('Errore caricamento terreni:', error);
        terreniList.length = 0;
    }
}

/**
 * Carica lista caposquadra disponibili
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Array} caposquadraList - Array caposquadra (modificato in place)
 * @param {Function} populateCaposquadraFilter - Callback per popolare filtro caposquadra
 * @param {Function} populateCaposquadraDropdown - Callback per popolare dropdown caposquadra
 */
export async function loadCaposquadra(currentTenantId, db, caposquadraList, populateCaposquadraFilter, populateCaposquadraDropdown) {
    try {
        const { collection, query, getDocs, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('tenantId', '==', currentTenantId),
            where('ruoli', 'array-contains', 'caposquadra'),
            where('stato', '==', 'attivo')
        );
        const snapshot = await getDocs(q);
        
        caposquadraList.length = 0; // Pulisci array
        snapshot.forEach(doc => {
            caposquadraList.push({ id: doc.id, ...doc.data() });
        });

        // Popola dropdown filtri
        if (populateCaposquadraFilter) populateCaposquadraFilter();
        if (populateCaposquadraDropdown) populateCaposquadraDropdown();
    } catch (error) {
        console.error('Errore caricamento caposquadra:', error);
        caposquadraList.length = 0;
    }
}

/**
 * Carica lista operai disponibili
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Array} operaiList - Array operai (modificato in place)
 * @param {Function} populateOperaiDropdown - Callback per popolare dropdown operai
 */
export async function loadOperai(currentTenantId, db, operaiList, populateOperaiDropdown) {
    try {
        const { collection, query, getDocs, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('tenantId', '==', currentTenantId),
            where('ruoli', 'array-contains', 'operaio'),
            where('stato', '==', 'attivo')
        );
        const snapshot = await getDocs(q);
        
        operaiList.length = 0; // Pulisci array
        snapshot.forEach(doc => {
            operaiList.push({ id: doc.id, ...doc.data() });
        });

        // Popola dropdown operai nel form
        if (populateOperaiDropdown) populateOperaiDropdown();
    } catch (error) {
        console.error('Errore caricamento operai:', error);
        operaiList.length = 0;
    }
}

/**
 * Carica lista squadre
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Array} squadreList - Array squadre (modificato in place)
 */
export async function loadSquadre(currentTenantId, db, squadreList) {
    try {
        if (!currentTenantId) {
            console.warn('loadSquadre: currentTenantId non disponibile');
            return;
        }
        const { collection, query, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const squadreRef = collection(db, 'tenants', currentTenantId, 'squadre');
        const q = query(squadreRef, orderBy('nome', 'asc'));
        const snapshot = await getDocs(q);
        
        squadreList.length = 0; // Pulisci array
        snapshot.forEach(doc => {
            squadreList.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Errore caricamento squadre:', error);
        squadreList.length = 0;
    }
}

/**
 * Carica progressi per un singolo lavoro
 * @param {string} lavoroId - ID lavoro
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @returns {Promise<Object>} Progressi lavoro { superficieLavorata: number }
 */
export async function loadProgressiLavoro(lavoroId, currentTenantId, db) {
    try {
        const { doc, getDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        // Prima prova a usare il campo del documento lavoro (più veloce)
        const lavoroDoc = await getDoc(doc(db, 'tenants', currentTenantId, 'lavori', lavoroId));
        if (lavoroDoc.exists()) {
            const lavoroData = lavoroDoc.data();
            if (lavoroData.superficieTotaleLavorata) {
                return { superficieLavorata: lavoroData.superficieTotaleLavorata };
            }
        }
        
        // Fallback: calcola dalle zone lavorate (più accurato ma più lento)
        const zoneRef = collection(db, 'tenants', currentTenantId, 'lavori', lavoroId, 'zoneLavorate');
        const zoneSnapshot = await getDocs(zoneRef);
        
        let superficieLavorata = 0;
        zoneSnapshot.forEach(zonaDoc => {
            const zonaData = zonaDoc.data();
            superficieLavorata += zonaData.superficieHa || 0;
        });

        return { superficieLavorata };
    } catch (error) {
        console.error('Errore caricamento progressi:', error);
        return { superficieLavorata: 0 };
    }
}

/**
 * Carica lista lavori da Firestore
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Array} lavoriList - Array lavori (modificato in place)
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 * @param {Function} correggiMacchineLavoriCompletati - Callback per correggere macchine
 * @param {Function} applyFilters - Callback per applicare filtri
 * @param {Function} showAlert - Callback per mostrare alert
 */
export async function loadLavori(currentTenantId, db, lavoriList, hasParcoMacchineModule, correggiMacchineLavoriCompletati, applyFilters, showAlert) {
    const container = document.getElementById('lavori-container');
    if (container) {
        container.innerHTML = '<div class="loading">Caricamento lavori...</div>';
    }

    try {
        const { collection, query, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const lavoriRef = collection(db, 'tenants', currentTenantId, 'lavori');
        let snapshot;
        
        // Prova prima con orderBy, se fallisce carica senza orderBy e ordina in memoria
        try {
            const q = query(lavoriRef, orderBy('dataInizio', 'desc'));
            snapshot = await getDocs(q);
        } catch (orderByError) {
            // Se fallisce per mancanza di indice o altri errori, carica senza orderBy
            console.warn('⚠️ Errore query con orderBy, carico senza orderBy:', orderByError);
            snapshot = await getDocs(lavoriRef);
        }
        
        lavoriList.length = 0; // Pulisci array
        snapshot.forEach(doc => {
            const data = doc.data();
            lavoriList.push({ 
                id: doc.id, 
                ...data,
                dataInizio: data.dataInizio?.toDate ? data.dataInizio.toDate() : (data.dataInizio ? new Date(data.dataInizio) : null)
            });
        });

        // Ordina in memoria se non è stato fatto dalla query
        lavoriList.sort((a, b) => {
            if (!a.dataInizio && !b.dataInizio) return 0;
            if (!a.dataInizio) return 1;
            if (!b.dataInizio) return -1;
            return b.dataInizio - a.dataInizio;
        });

        // Corregge macchine ancora in uso per lavori completati
        if (hasParcoMacchineModule && correggiMacchineLavoriCompletati) {
            await correggiMacchineLavoriCompletati();
        }

        // Applica filtri
        if (applyFilters) applyFilters();
    } catch (error) {
        console.error('Errore caricamento lavori:', error);
        if (container) {
            container.innerHTML = '<div class="empty-state">Errore caricamento lavori</div>';
        }
        if (showAlert) showAlert('Errore caricamento lavori', 'error');
    }
}

/**
 * Carica categorie lavori principali e sottocategorie
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Array} categorieLavoriPrincipali - Array categorie principali (modificato in place)
 * @param {Map} sottocategorieLavoriMap - Map sottocategorie (modificato in place)
 * @param {Function} populateCategoriaLavoroDropdown - Callback per popolare dropdown categorie
 */
export async function loadCategorieLavori(currentTenantId, db, categorieLavoriPrincipali, sottocategorieLavoriMap, populateCategoriaLavoroDropdown) {
    try {
        if (!currentTenantId) return;
        
        const { collection, query, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const categorieRef = collection(db, `tenants/${currentTenantId}/categorie`);
        
        // Carica tutte le categorie
        const snapshot = await getDocs(query(categorieRef, orderBy('ordine', 'asc')));
        categorieLavoriPrincipali.length = 0; // Pulisci array
        sottocategorieLavoriMap.clear(); // Pulisci map
        
        snapshot.forEach(doc => {
            const catData = { id: doc.id, ...doc.data() };

            // Escludi categorie di test (contengono "test" nel nome)
            const nomeCategoria = (catData.nome || '').toLowerCase();
            if (nomeCategoria.includes('test')) {
                return; // Salta questa categoria
            }

            // Filtra solo categorie applicabili a lavori
            if (catData.applicabileA === 'lavori' || catData.applicabileA === 'entrambi') {
                if (!catData.parentId) {
                    // Categoria principale
                    categorieLavoriPrincipali.push(catData);
                } else {
                    // Sottocategoria
                    if (!sottocategorieLavoriMap.has(catData.parentId)) {
                        sottocategorieLavoriMap.set(catData.parentId, []);
                    }
                    sottocategorieLavoriMap.get(catData.parentId).push(catData);
                }
            }
        });
        
        // Ordina sottocategorie per ordine
        sottocategorieLavoriMap.forEach((sottocat, parentId) => {
            sottocat.sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
        });
        
        if (populateCategoriaLavoroDropdown) populateCategoriaLavoroDropdown();
    } catch (error) {
        console.error('Errore caricamento categorie lavori:', error);
        categorieLavoriPrincipali.length = 0;
    }
}

/**
 * Inizializza categorie lavori predefinite usando il servizio centralizzato
 * @param {string} currentTenantId - ID tenant corrente
 */
export async function initializeCategorieLavori(currentTenantId) {
    try {
        if (!currentTenantId) return;
        
        // Usa il servizio centralizzato che contiene la lista completa e aggiornata
        // con tutte le categorie principali, sottocategorie e gestione delle obsolete
        const { initializeCategoriePredefinite } = await import('../../services/categorie-service.js');
        await initializeCategoriePredefinite();
    } catch (error) {
        console.error('Errore inizializzazione categorie lavori:', error);
    }
}

/**
 * Inizializza tipi lavoro predefiniti usando il servizio centralizzato
 * @param {string} currentTenantId - ID tenant corrente
 */
export async function initializeTipiLavoroPredefiniti(currentTenantId) {
    try {
        if (!currentTenantId) return;
        
        // Usa il servizio centralizzato che contiene la lista completa e aggiornata
        const { initializeTipiLavoroPredefiniti: initTipiLavoro } = await import('../../services/tipi-lavoro-service.js');
        await initTipiLavoro();
    } catch (error) {
        console.error('Errore inizializzazione tipi lavoro predefiniti:', error);
    }
}

/**
 * Carica tipi lavoro (filtrati per categoria se specificata)
 * @param {string} categoriaId - ID categoria (opzionale)
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Array} tipiLavoroList - Array tipi lavoro (modificato in place)
 * @param {Array} categorieLavoriPrincipali - Array categorie principali
 * @param {Map} sottocategorieLavoriMap - Map sottocategorie
 * @param {Function} populateTipoLavoroDropdownCallback - Callback per popolare dropdown tipi lavoro
 */
export async function loadTipiLavoro(
    categoriaId,
    currentTenantId,
    db,
    app,
    auth,
    tipiLavoroList,
    categorieLavoriPrincipali,
    sottocategorieLavoriMap,
    populateTipoLavoroDropdownCallback
) {
    try {
        if (!currentTenantId) return;
        
        const isFileProtocol = window.location.protocol === 'file:';
        
        if (isFileProtocol) {
            // Fallback per ambiente file://: carica direttamente da Firestore
            console.warn('Ambiente file:// rilevato, uso fallback diretto da Firestore');
            const { collection, query, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const tipiRef = collection(db, `tenants/${currentTenantId}/tipiLavoro`);
            const snapshot = await getDocs(query(tipiRef, orderBy('nome', 'asc')));
            tipiLavoroList.length = 0; // Pulisci array
            
            snapshot.forEach(doc => {
                tipiLavoroList.push({ id: doc.id, ...doc.data() });
            });
        } else {
            // Usa servizio centralizzato
            try {
                // Assicura che Firebase sia inizializzato nel servizio
                const { setFirebaseInstances } = await import('../../services/firebase-service.js');
                setFirebaseInstances({ app, db, auth });
            } catch (error) {
                console.warn('Impossibile impostare Firebase instances nel servizio:', error);
            }
            
            // Assicura che il tenantId sia impostato nel servizio
            try {
                const { setCurrentTenantId } = await import('../../services/tenant-service.js');
                if (currentTenantId) {
                    setCurrentTenantId(currentTenantId);
                }
            } catch (error) {
                console.warn('Impossibile impostare tenantId nel servizio:', error);
            }
            
            // Usa tipi-lavoro-service per ottenere tutti i tipi lavoro
            const { getAllTipiLavoro } = await import('../../services/tipi-lavoro-service.js');
            const tipiLavoro = await getAllTipiLavoro({
                orderBy: 'nome',
                orderDirection: 'asc'
            });

            // Converti in formato compatibile con il codice esistente
            tipiLavoroList.length = 0; // Pulisci array
            tipiLavoro.forEach(tipo => {
                tipiLavoroList.push({
                    id: tipo.id,
                    nome: tipo.nome,
                    categoriaId: tipo.categoriaId,
                    sottocategoriaId: tipo.sottocategoriaId,
                    descrizione: tipo.descrizione,
                    predefinito: tipo.predefinito || false,
                    ...tipo
                });
            });
            
            // Se non ci sono tipi lavoro nel tenant, inizializza i predefiniti e ricarica
            if (tipiLavoroList.length === 0) {
                try {
                    const { initializeTipiLavoroPredefiniti: initTipiLavoro } = await import('../../services/tipi-lavoro-service.js');
                    await initTipiLavoro();
                    const tipiLavoroReload = await getAllTipiLavoro({
                        orderBy: 'nome',
                        orderDirection: 'asc'
                    });
                    tipiLavoroList.length = 0; // Pulisci array
                    tipiLavoroReload.forEach(tipo => {
                        tipiLavoroList.push({
                            id: tipo.id,
                            nome: tipo.nome,
                            categoriaId: tipo.categoriaId,
                            sottocategoriaId: tipo.sottocategoriaId,
                            descrizione: tipo.descrizione,
                            predefinito: tipo.predefinito || false,
                            ...tipo
                        });
                    });
                } catch (initError) {
                    console.warn('Impossibile inizializzare tipi lavoro predefiniti:', initError);
                }
            }
        }
        
        // Se è specificata una categoria, filtra per quella categoria o le sue sottocategorie
        let tipiLavoroFiltrati = tipiLavoroList;
        if (categoriaId) {
            // Verifica se categoriaId è una sottocategoria o categoria principale
            const categoriaTrovata = [...categorieLavoriPrincipali, ...Array.from(sottocategorieLavoriMap.values()).flat()].find(c => c.id === categoriaId);
            
            if (categoriaTrovata && categoriaTrovata.parentId) {
                // È una sottocategoria: filtra per sottocategoriaId
                const parentId = categoriaTrovata.parentId;
                tipiLavoroFiltrati = tipiLavoroList.filter(tipo => {
                    return tipo.sottocategoriaId === categoriaId || 
                           tipo.categoriaId === categoriaId ||
                           (tipo.categoriaId === parentId && !tipo.sottocategoriaId);
                });
            } else {
                // È una categoria principale: include anche le sue sottocategorie
                let allCategorieIds = [categoriaId];
                const sottocat = sottocategorieLavoriMap.get(categoriaId);
                if (sottocat) {
                    sottocat.forEach(subcat => allCategorieIds.push(subcat.id));
                }
                
                // Filtra i tipi per categoria principale O per sottocategorie
                tipiLavoroFiltrati = tipiLavoroList.filter(tipo => {
                    return tipo.categoriaId === categoriaId || 
                           (tipo.sottocategoriaId && allCategorieIds.includes(tipo.sottocategoriaId)) ||
                           (allCategorieIds.includes(tipo.categoriaId) && !tipo.sottocategoriaId);
                });
            }
        }
        
        // Passa i tipi filtrati alla funzione di popolamento
        if (populateTipoLavoroDropdownCallback) {
            populateTipoLavoroDropdownCallback(categoriaId, null, tipiLavoroFiltrati);
        }
    } catch (error) {
        console.error('Errore caricamento tipi lavoro:', error);
        tipiLavoroList.length = 0;
    }
}

/**
 * Carica statistiche generali
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Array} lavoriList - Array lavori
 */
export async function loadStatistics(currentTenantId, db, lavoriList) {
    try {
        if (!currentTenantId) {
            console.warn('loadStatistics: currentTenantId non disponibile');
            return;
        }
        
        const { collection, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        let totaleLavori = lavoriList.length;
        let lavoriInCorso = lavoriList.filter(l => l.stato === 'in_corso').length;
        let totaleOreValidate = 0;
        let totaleSuperficieLavorata = 0;
        let lavoriInRitardo = 0;
        let lavoriInTempo = 0;
        let lavoriInAnticipo = 0;

        // Carica ore validate e calcola stato progresso per tutti i lavori
        for (const lavoro of lavoriList) {
            const oreRef = collection(db, 'tenants', currentTenantId, 'lavori', lavoro.id, 'oreOperai');
            const oreSnapshot = await getDocs(oreRef);
            
            oreSnapshot.forEach(oraDoc => {
                const oraData = oraDoc.data();
                if (oraData.stato === 'validate') {
                    totaleOreValidate += oraData.oreNette || 0;
                }
            });

            // Carica superficie lavorata
            const zoneRef = collection(db, 'tenants', currentTenantId, 'lavori', lavoro.id, 'zoneLavorate');
            const zoneSnapshot = await getDocs(zoneRef);
            
            let superficieLavorataLavoro = 0;
            zoneSnapshot.forEach(zonaDoc => {
                const zonaData = zonaDoc.data();
                superficieLavorataLavoro += zonaData.superficieHa || 0;
            });
            totaleSuperficieLavorata += superficieLavorataLavoro;

            // Calcola stato progresso se il lavoro ha durata prevista e data inizio
            if (lavoro.dataInizio && lavoro.durataPrevista && lavoro.stato !== 'completato' && lavoro.stato !== 'annullato') {
                const dataInizio = lavoro.dataInizio instanceof Date 
                    ? lavoro.dataInizio 
                    : (lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date(lavoro.dataInizio));
                const oggi = new Date();
                oggi.setHours(0, 0, 0, 0);
                dataInizio.setHours(0, 0, 0, 0);
                
                const giorniEffettivi = Math.max(0, Math.floor((oggi - dataInizio) / (1000 * 60 * 60 * 24)) + 1);
                
                if (giorniEffettivi > 0) {
                    // Carica terreno per ottenere superficie totale
                    const terrenoDoc = await getDoc(doc(db, 'tenants', currentTenantId, 'terreni', lavoro.terrenoId));
                    const terreno = terrenoDoc.exists() ? terrenoDoc.data() : null;
                    const superficieTotale = terreno?.superficie || 0;
                    
                    const percentualeCompletamento = superficieTotale > 0 ? (superficieLavorataLavoro / superficieTotale * 100) : 0;
                    const percentualeTempo = (giorniEffettivi / lavoro.durataPrevista) * 100;
                    const tolleranza = 10; // Tolleranza del 10%
                    
                    if (percentualeCompletamento > percentualeTempo + tolleranza) {
                        lavoriInAnticipo++;
                    } else if (percentualeCompletamento < percentualeTempo - tolleranza) {
                        lavoriInRitardo++;
                    } else {
                        lavoriInTempo++;
                    }
                }
            }
        }

        // Aggiorna UI
        const statTotaleLavori = document.getElementById('stat-totale-lavori');
        const statLavoriCorso = document.getElementById('stat-lavori-corso');
        const statOreValidate = document.getElementById('stat-ore-validate');
        const statSuperficieLavorata = document.getElementById('stat-superficie-lavorata');
        const statLavoriRitardo = document.getElementById('stat-lavori-ritardo');
        const statLavoriTempo = document.getElementById('stat-lavori-tempo');
        const statLavoriAnticipo = document.getElementById('stat-lavori-anticipo');
        
        if (statTotaleLavori) statTotaleLavori.textContent = totaleLavori;
        if (statLavoriCorso) statLavoriCorso.textContent = lavoriInCorso;
        
        // Formatta ore
        const oreFormatted = totaleOreValidate >= 1 
            ? `${Math.round(totaleOreValidate)}h`
            : `${Math.round(totaleOreValidate * 60)}min`;
        if (statOreValidate) statOreValidate.textContent = oreFormatted;
        
        if (statSuperficieLavorata) statSuperficieLavorata.textContent = `${totaleSuperficieLavorata.toFixed(2)} ha`;
        
        // Aggiorna statistiche stato progresso
        if (statLavoriRitardo) statLavoriRitardo.textContent = lavoriInRitardo;
        if (statLavoriTempo) statLavoriTempo.textContent = lavoriInTempo;
        if (statLavoriAnticipo) statLavoriAnticipo.textContent = lavoriInAnticipo;
    } catch (error) {
        console.error('Errore caricamento statistiche:', error);
    }
}

/**
 * Ottiene il nome di una categoria (attrezzi o lavori)
 * @param {string} categoriaId - ID categoria
 * @param {Array} categorieAttrezziList - Array categorie attrezzi
 * @param {Array} categorieLavoriPrincipali - Array categorie lavori principali
 * @param {Map} sottocategorieLavoriMap - Map sottocategorie lavori
 * @returns {string} Nome categoria
 */
export function getNomeCategoria(categoriaId, categorieAttrezziList, categorieLavoriPrincipali, sottocategorieLavoriMap) {
    if (!categoriaId) return 'Senza categoria';
    
    // Cerca in categorie attrezzi
    const categoriaAttrezzo = categorieAttrezziList.find(c => c.id === categoriaId);
    if (categoriaAttrezzo) {
        // Se è una sottocategoria, mostra anche il parent
        if (categoriaAttrezzo.parentId) {
            const parent = categorieAttrezziList.find(c => c.id === categoriaAttrezzo.parentId);
            return parent ? `${parent.nome} - ${categoriaAttrezzo.nome}` : categoriaAttrezzo.nome;
        }
        return categoriaAttrezzo.nome;
    }
    
    // Cerca in categorie lavori
    const categoriaLavoro = categorieLavoriPrincipali.find(c => c.id === categoriaId);
    if (categoriaLavoro) return categoriaLavoro.nome;
    
    // Cerca in sottocategorie lavori
    for (const [parentId, sottocat] of sottocategorieLavoriMap.entries()) {
        const sottocategoria = sottocat.find(sc => sc.id === categoriaId);
        if (sottocategoria) {
            const parent = categorieLavoriPrincipali.find(c => c.id === parentId);
            return parent ? `${parent.nome} - ${sottocategoria.nome}` : sottocategoria.nome;
        }
    }
    
    return 'Categoria sconosciuta';
}

/**
 * Aggiorna stato macchina
 * @param {string} macchinaId - ID macchina
 * @param {string} nuovoStato - Nuovo stato
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 */
export async function updateMacchinaStato(macchinaId, nuovoStato, currentTenantId, db) {
    try {
        if (!macchinaId) {
            console.warn('⚠️ updateMacchinaStato chiamata senza macchinaId');
            return;
        }

        const { doc, getDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const macchinaRef = doc(db, 'tenants', currentTenantId, 'macchine', macchinaId);
        
        // Verifica stato attuale prima di aggiornare
        const macchinaDoc = await getDoc(macchinaRef);
        if (!macchinaDoc.exists()) {
            console.warn(`  ⚠️ Macchina ${macchinaId} non trovata nel database`);
            return;
        }
        
        await updateDoc(macchinaRef, {
            stato: nuovoStato,
            updatedAt: serverTimestamp()
        });
        
    } catch (error) {
        console.error(`❌ Errore aggiornamento stato macchina ${macchinaId}:`, error);
        // Non bloccare il salvataggio del lavoro se c'è un errore con la macchina
    }
}

/**
 * Corregge macchine ancora in uso per lavori completati
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Array} lavoriList - Array lavori
 * @param {Function} updateMacchinaStatoCallback - Callback per aggiornare stato macchina
 */
export async function correggiMacchineLavoriCompletati(currentTenantId, db, lavoriList, updateMacchinaStatoCallback) {
    try {
        if (!currentTenantId) {
            console.warn('correggiMacchineLavoriCompletati: currentTenantId non disponibile');
            return;
        }
        
        const { doc, getDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

        const lavoriCompletati = lavoriList.filter(l => 
            (l.stato === 'completato' || l.stato === 'completato_da_approvare') && 
            (l.macchinaId || l.attrezzoId)
        );

        if (lavoriCompletati.length === 0) {
            return;
        }

        // Trova lavori attivi (non completati/annullati)
        const lavoriAttivi = lavoriList.filter(l => 
            l.stato !== 'completato' && 
            l.stato !== 'completato_da_approvare' && 
            l.stato !== 'annullato' &&
            (l.macchinaId || l.attrezzoId)
        );

        // Crea mappa delle macchine/attrezzi in uso per lavori attivi
        const macchineInUsoAttive = new Set();
        const attrezziInUsoAttivi = new Set();
        lavoriAttivi.forEach(l => {
            if (l.macchinaId) macchineInUsoAttive.add(l.macchinaId);
            if (l.attrezzoId) attrezziInUsoAttivi.add(l.attrezzoId);
        });

        let macchineCorrette = 0;
        for (const lavoro of lavoriCompletati) {
            if (lavoro.macchinaId) {
                // Verifica se la macchina è ancora in uso per altri lavori attivi
                if (macchineInUsoAttive.has(lavoro.macchinaId)) {
                    continue;
                }
                
                try {
                    const macchinaDoc = await getDoc(doc(db, 'tenants', currentTenantId, 'macchine', lavoro.macchinaId));
                    if (macchinaDoc.exists()) {
                        const macchinaData = macchinaDoc.data();

                        if (macchinaData.stato === 'in_uso') {
                            if (updateMacchinaStatoCallback) {
                                await updateMacchinaStatoCallback(lavoro.macchinaId, 'disponibile', currentTenantId, db);
                            } else {
                                await updateMacchinaStato(lavoro.macchinaId, 'disponibile', currentTenantId, db);
                            }
                            macchineCorrette++;
                        }
                    }
                } catch (error) {
                    console.error(`  ❌ Errore verifica trattore:`, error);
                }
            }
            
            if (lavoro.attrezzoId) {
                // Verifica se l'attrezzo è ancora in uso per altri lavori attivi
                if (attrezziInUsoAttivi.has(lavoro.attrezzoId)) {
                    continue;
                }
                
                try {
                    const attrezzoDoc = await getDoc(doc(db, 'tenants', currentTenantId, 'macchine', lavoro.attrezzoId));
                    if (attrezzoDoc.exists()) {
                        const attrezzoData = attrezzoDoc.data();

                        if (attrezzoData.stato === 'in_uso') {
                            await updateDoc(doc(db, 'tenants', currentTenantId, 'macchine', lavoro.attrezzoId), {
                                stato: 'disponibile',
                                updatedAt: serverTimestamp()
                            });
                        }
                    }
                } catch (error) {
                    console.error(`  ❌ Errore verifica attrezzo:`, error);
                }
            }
        }

        // Macchine corrette automaticamente
    } catch (error) {
        console.error('Errore correzione macchine lavori completati:', error);
    }
}

/**
 * Carica trattori disponibili usando servizio centralizzato
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Array} trattoriList - Array trattori (modificato in place)
 * @param {Function} populateTrattoriDropdown - Callback per popolare dropdown trattori
 */
export async function loadTrattori(currentTenantId, db, app, auth, trattoriList, populateTrattoriDropdown) {
    try {
        if (!currentTenantId) {
            console.warn('loadTrattori: currentTenantId non disponibile');
            return;
        }
        
        // Usa servizio centralizzato tramite helper
        const { loadMacchineViaService } = await import('../../services/service-helper.js');
        const macchine = await loadMacchineViaService({
            tenantId: currentTenantId,
            firebaseInstances: { app, db, auth },
            options: {
                orderBy: 'nome',
                orderDirection: 'asc'
            }
        });
        
        // Filtra in memoria: solo trattori non dismessi
        const trattori = macchine.filter(m => {
            const tipoMacchina = m.tipoMacchina || m.tipo;
            const isTrattore = tipoMacchina === 'trattore' || tipoMacchina === 'Trattore';
            const isNotDismesso = m.stato !== 'dismesso';
            return isTrattore && isNotDismesso;
        });
        
        trattoriList.length = 0; // Pulisci array
        trattoriList.push(...trattori);
        
        // Popola dropdown passando direttamente l'array trattori
        // Il callback verrà chiamato anche quando il modal si apre, ma qui assicuriamo che i dati siano disponibili
        if (populateTrattoriDropdown) {
            populateTrattoriDropdown(trattoriList);
        }
    } catch (error) {
        console.error('Errore caricamento trattori:', error);
        console.error('Stack:', error.stack);
        trattoriList.length = 0;
    }
}

/**
 * Carica attrezzi disponibili
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Array} attrezziList - Array attrezzi (modificato in place)
 */
/**
 * Carica attrezzi disponibili usando servizio centralizzato
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Array} attrezziList - Array attrezzi (modificato in place)
 */
export async function loadAttrezzi(currentTenantId, db, app, auth, attrezziList) {
    if (!currentTenantId) return;
    
    try {
        // Usa servizio centralizzato tramite helper
        const { loadMacchineViaService } = await import('../../services/service-helper.js');
        const macchine = await loadMacchineViaService({
            tenantId: currentTenantId,
            firebaseInstances: { app, db, auth },
            options: {
                orderBy: 'nome',
                orderDirection: 'asc'
            }
        });
        
        // Filtra lato client: solo attrezzi non dismessi
        const attrezzi = macchine.filter(m => {
            const tipoMacchina = m.tipoMacchina || m.tipo;
            return tipoMacchina === 'attrezzo' && m.stato !== 'dismesso';
        });
        
        attrezziList.length = 0; // Pulisci array
        attrezziList.push(...attrezzi);
    } catch (error) {
        console.error('Errore caricamento attrezzi:', error);
        attrezziList.length = 0;
    }
}

/**
 * Carica categorie attrezzi (da collezione unificata)
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Array} categorieAttrezziList - Array categorie attrezzi (modificato in place)
 */
export async function loadCategorieAttrezzi(currentTenantId, db, categorieAttrezziList) {
    try {
        const { collection, query, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const categorieRef = collection(db, `tenants/${currentTenantId}/categorie`);
        const q = query(categorieRef, orderBy('ordine', 'asc'));
        const snapshot = await getDocs(q);
        
        categorieAttrezziList.length = 0; // Pulisci array
        snapshot.forEach(doc => {
            const catData = { id: doc.id, ...doc.data() };
            // Filtra solo categorie applicabili ad attrezzi
            if (catData.applicabileA === 'attrezzi' || catData.applicabileA === 'entrambi') {
                categorieAttrezziList.push(catData);
            }
        });
    } catch (error) {
        console.error('Errore caricamento categorie attrezzi:', error);
        categorieAttrezziList.length = 0;
    }
}

// ============================================
// FUNZIONI POPOLAMENTO DROPDOWN
// ============================================

/**
 * Popola dropdown filtri terreni
 * @param {Array} terreniList - Array terreni
 */
export function populateTerrenoFilter(terreniList) {
    const select = document.getElementById('filter-terreno');
    if (!select) return;
    select.innerHTML = '<option value="">Tutti i terreni</option>';
    terreniList.forEach(terreno => {
        const option = document.createElement('option');
        option.value = terreno.id;
        option.textContent = terreno.nome || 'N/A';
        select.appendChild(option);
    });
}

/**
 * Popola dropdown filtri caposquadra
 * @param {Array} caposquadraList - Array caposquadra
 */
export function populateCaposquadraFilter(caposquadraList) {
    const select = document.getElementById('filter-caposquadra');
    if (!select) return; // Se elemento non esiste (Manodopera non attivo), esci
    select.innerHTML = '<option value="">Tutti i caposquadra</option>';
    caposquadraList.forEach(capo => {
        const option = document.createElement('option');
        option.value = capo.id;
        const nomeCompleto = `${capo.nome || ''} ${capo.cognome || ''}`.trim() || capo.email || 'N/A';
        option.textContent = nomeCompleto;
        select.appendChild(option);
    });
}

/**
 * Popola dropdown terreni nel form
 * @param {Array} terreniList - Array terreni
 * @param {string} selectedId - ID terreno selezionato (opzionale)
 */
export function populateTerrenoDropdown(terreniList, selectedId = null) {
    const select = document.getElementById('lavoro-terreno');
    if (!select) return;
    select.innerHTML = '<option value="">Seleziona terreno...</option>';
    
    if (terreniList.length === 0) {
        select.innerHTML = '<option value="">Nessun terreno disponibile</option>';
        select.disabled = true;
        return;
    }
    
    select.disabled = false;
    terreniList.forEach(terreno => {
        const option = document.createElement('option');
        option.value = terreno.id;
        // Formatta superficie con 2 decimali e virgola (formato italiano)
        const superficieFormattata = terreno.superficie 
            ? ` (${parseFloat(terreno.superficie).toFixed(2).replace('.', ',')} Ha)` 
            : '';
        option.textContent = `${terreno.nome || 'N/A'}${superficieFormattata}`;
        if (selectedId === terreno.id) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

/**
 * Popola dropdown caposquadra nel form
 * @param {Array} caposquadraList - Array caposquadra
 * @param {Array} squadreList - Array squadre
 * @param {string} selectedId - ID caposquadra selezionato (opzionale)
 */
export function populateCaposquadraDropdown(caposquadraList, squadreList, selectedId = null) {
    const select = document.getElementById('lavoro-caposquadra');
    if (!select) {
        console.error('Elemento lavoro-caposquadra non trovato');
        return;
    }
    
    const squadraInfo = document.getElementById('squadra-info');
    select.innerHTML = '<option value="">Seleziona caposquadra...</option>';
    
    if (!caposquadraList || caposquadraList.length === 0) {
        select.innerHTML = '<option value="">Nessun caposquadra disponibile</option>';
        select.disabled = true;
        if (squadraInfo) {
            squadraInfo.textContent = 'Crea prima una squadra con un caposquadra.';
        }
        return;
    }
    
    select.disabled = false;
    if (squadraInfo) {
        squadraInfo.textContent = '';
    }
    
    // Listener per mostrare info squadra quando si seleziona caposquadra
    select.onchange = function() {
        if (this.value && squadraInfo) {
            const squadra = squadreList.find(s => s.caposquadraId === this.value);
            if (squadra) {
                const operaiCount = squadra.operai ? squadra.operai.length : 0;
                squadraInfo.textContent = `Squadra: ${squadra.nome} (${operaiCount} operai)`;
                squadraInfo.style.color = '#2E8B57';
            } else {
                squadraInfo.textContent = '⚠️ Nessuna squadra assegnata a questo caposquadra';
                squadraInfo.style.color = '#856404';
            }
        } else if (squadraInfo) {
            squadraInfo.textContent = '';
        }
    };
    
    caposquadraList.forEach(capo => {
        const nomeCompleto = `${capo.nome || ''} ${capo.cognome || ''}`.trim() || capo.email || 'N/A';
        const option = document.createElement('option');
        option.value = capo.id;
        option.textContent = nomeCompleto;
        if (selectedId === capo.id) {
            option.selected = true;
            select.onchange(); // Trigger per mostrare info squadra
        }
        select.appendChild(option);
    });
}

/**
 * Popola dropdown operai nel form
 * @param {Array} operaiList - Array operai
 * @param {string} selectedId - ID operaio selezionato (opzionale)
 */
export function populateOperaiDropdown(operaiList, selectedId = null) {
    const select = document.getElementById('lavoro-operaio');
    if (!select) {
        console.error('Elemento lavoro-operaio non trovato');
        return;
    }
    
    select.innerHTML = '<option value="">Seleziona operaio...</option>';
    
    if (!operaiList || operaiList.length === 0) {
        select.innerHTML = '<option value="">Nessun operaio disponibile</option>';
        select.disabled = true;
        return;
    }
    
    select.disabled = false;
    
    // Ordina operai per nome
    const operaiOrdinati = [...operaiList].sort((a, b) => {
        const nomeA = `${a.nome || ''} ${a.cognome || ''}`.trim() || a.email || '';
        const nomeB = `${b.nome || ''} ${b.cognome || ''}`.trim() || b.email || '';
        return nomeA.localeCompare(nomeB);
    });
    
    operaiOrdinati.forEach(operaio => {
        const nomeCompleto = `${operaio.nome || ''} ${operaio.cognome || ''}`.trim() || operaio.email || 'N/A';
        const tipoOperaio = operaio.tipoOperaio ? ` (${operaio.tipoOperaio})` : '';
        const option = document.createElement('option');
        option.value = operaio.id;
        option.textContent = `${nomeCompleto}${tipoOperaio}`;
        if (selectedId === operaio.id) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

/**
 * Popola dropdown trattori
 * @param {Array} trattoriList - Array trattori
 */
export function populateTrattoriDropdown(trattoriList) {
    const select = document.getElementById('lavoro-trattore');
    if (!select) {
        return;
    }
    
    select.innerHTML = '<option value="">-- Nessun trattore --</option>';
    
    if (!trattoriList || trattoriList.length === 0) {
        return;
    }
    
    trattoriList.forEach(trattore => {
        const option = document.createElement('option');
        option.value = trattore.id;
        const nome = trattore.nome || 'Trattore senza nome';
        const cavalli = trattore.cavalli ? ` (${trattore.cavalli} CV)` : '';
        const stato = trattore.stato === 'disponibile' ? '✅' : trattore.stato === 'in_uso' ? '🔄' : '⚠️';
        option.textContent = `${stato} ${nome}${cavalli}`;
        option.disabled = trattore.stato === 'in_uso' || trattore.stato === 'in_manutenzione' || trattore.stato === 'guasto';
        select.appendChild(option);
    });
}

/**
 * Popola dropdown categoria principale lavoro
 * @param {Array} categorieLavoriPrincipali - Array categorie principali
 * @param {string} selectedValue - ID categoria selezionata (opzionale)
 */
export function populateCategoriaLavoroDropdown(categorieLavoriPrincipali, selectedValue = null) {
    const select = document.getElementById('lavoro-categoria-principale');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleziona categoria principale --</option>';
    
    categorieLavoriPrincipali.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria.id;
        option.textContent = categoria.nome;
        if (selectedValue === categoria.id) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

/**
 * Popola sottocategorie quando cambia categoria principale
 * @param {string} parentId - ID categoria principale
 * @param {Map} sottocategorieLavoriMap - Map sottocategorie
 * @param {string} selectedValue - ID sottocategoria selezionata (opzionale)
 */
export function populateSottocategorieLavoro(parentId, sottocategorieLavoriMap, selectedValue = null) {
    const sottocategoriaSelect = document.getElementById('lavoro-sottocategoria');
    const sottocategoriaGroup = document.getElementById('lavoro-sottocategoria-group');
    
    if (!sottocategoriaSelect || !sottocategoriaGroup) return;
    
    sottocategoriaSelect.innerHTML = '<option value="">-- Nessuna sottocategoria --</option>';
    
    if (!parentId) {
        sottocategoriaGroup.style.display = 'none';
        return;
    }
    
    const sottocat = sottocategorieLavoriMap.get(parentId);
    if (sottocat && sottocat.length > 0) {
        sottocategoriaGroup.style.display = 'block';
        sottocat.forEach(subcat => {
            const option = document.createElement('option');
            option.value = subcat.id;
            option.textContent = subcat.nome;
            if (selectedValue === subcat.id) {
                option.selected = true;
            }
            sottocategoriaSelect.appendChild(option);
        });
    } else {
        sottocategoriaGroup.style.display = 'none';
    }
}

/**
 * Popola dropdown tipo lavoro nel form (filtrato per categoria)
 * @param {string} categoriaId - ID categoria (opzionale)
 * @param {string} selectedValue - Nome tipo lavoro selezionato (opzionale)
 * @param {Array} tipiFiltratiPassati - Array tipi lavoro filtrati (opzionale, se non passato filtra dalla lista completa)
 * @param {Array} tipiLavoroList - Array completo tipi lavoro
 * @param {Array} categorieLavoriPrincipali - Array categorie principali
 * @param {Map} sottocategorieLavoriMap - Map sottocategorie
 */
export function populateTipoLavoroDropdown(
    categoriaId = null,
    selectedValue = null,
    tipiFiltratiPassati = null,
    tipiLavoroList = [],
    categorieLavoriPrincipali = [],
    sottocategorieLavoriMap = new Map()
) {
    const select = document.getElementById('lavoro-tipo-lavoro');
    const tipoLavoroGroup = document.getElementById('tipo-lavoro-group');
    
    if (!select || !tipoLavoroGroup) return;
    
    select.innerHTML = '<option value="">-- Seleziona tipo lavoro --</option>';
    
    if (!categoriaId) {
        tipoLavoroGroup.style.display = 'none';
        return;
    }
    
    tipoLavoroGroup.style.display = 'block';

    // Usa i tipi filtrati passati come parametro, oppure filtra dalla lista completa
    let tipiFiltrati = tipiFiltratiPassati;
    
    // FILTRO DINAMICO VENDEMMIA: Se categoria è RACCOLTA e terreno è VITE, mostra solo tipi vendemmia
    const terrenoSelect = document.getElementById('lavoro-terreno');
    const terrenoId = terrenoSelect ? terrenoSelect.value : null;
    
    console.log('[GESTIONE-LAVORI] populateTipoLavoroDropdown - categoriaId:', categoriaId, 'terrenoId:', terrenoId);
    
    // Verifica se categoria è RACCOLTA (può essere categoria principale o sottocategoria)
    const categoriaTrovata = [...categorieLavoriPrincipali, ...Array.from(sottocategorieLavoriMap.values()).flat()].find(c => c.id === categoriaId);
    const categoriaNome = categoriaTrovata ? (categoriaTrovata.nome || '').toLowerCase() : '';
    const categoriaParent = categoriaTrovata && categoriaTrovata.parentId 
        ? categorieLavoriPrincipali.find(c => c.id === categoriaTrovata.parentId)
        : null;
    const categoriaParentNome = categoriaParent ? (categoriaParent.nome || '').toLowerCase() : '';
    
    // Verifica se è RACCOLTA: può essere categoria principale "Raccolta" o sottocategoria "Raccolta Manuale/Meccanica"
    const isRaccolta = categoriaNome.includes('raccolta') || categoriaParentNome.includes('raccolta');
    
    console.log('[GESTIONE-LAVORI] Verifica categoria RACCOLTA:', {
        categoriaId,
        categoriaNome,
        categoriaParentNome,
        isRaccolta,
        categoriaTrovata: categoriaTrovata ? categoriaTrovata.nome : 'non trovata'
    });
    
    // Verifica se terreno è VITE (carica terreno se necessario)
    let isTerrenoVite = false;
    if (terrenoId && isRaccolta) {
        try {
            // Prova a recuperare terreno da terreniList se disponibile globalmente
            let terreno = null;
            if (typeof window.lavoriState !== 'undefined' && window.lavoriState.terreniList) {
                terreno = window.lavoriState.terreniList.find(t => t.id === terrenoId);
                console.log('[GESTIONE-LAVORI] Terreno trovato in lavoriState:', terreno ? terreno.nome : 'non trovato');
            }
            
            // Se non trovato, carica direttamente dal servizio (async, ma non possiamo usare await qui)
            // Per ora, se non trovato nella lista, non filtriamo (comportamento normale)
            // Il filtro verrà applicato quando la lista terreni sarà disponibile
            if (terreno && terreno.coltura) {
                const colturaLower = terreno.coltura.toLowerCase();
                // Verifica se la coltura contiene "vite" (può essere "Vite", "Vite da Vino", "Vite da Tavola", etc.)
                if (colturaLower.includes('vite')) {
                    isTerrenoVite = true;
                    console.log('[GESTIONE-LAVORI] ✓ Terreno VITE rilevato (coltura:', terreno.coltura, '), applico filtro tipi vendemmia');
                } else {
                    console.log('[GESTIONE-LAVORI] Terreno non è VITE, coltura:', terreno.coltura);
                }
            }
        } catch (error) {
            console.warn('[GESTIONE-LAVORI] Errore verifica terreno VITE:', error);
        }
    }
    if (!tipiFiltrati) {
        // Fallback: filtra dalla lista completa (per retrocompatibilità)
        // Verifica se categoriaId è una sottocategoria o categoria principale
        const categoriaTrovata = [...categorieLavoriPrincipali, ...Array.from(sottocategorieLavoriMap.values()).flat()].find(c => c.id === categoriaId);
        
        if (categoriaTrovata && categoriaTrovata.parentId) {
            // È una sottocategoria: cerca per sottocategoriaId O categoriaId
            // Includi anche tipi della categoria principale senza sottocategoria
            const parentId = categoriaTrovata.parentId;
            tipiFiltrati = tipiLavoroList.filter(tipo => 
                tipo.sottocategoriaId === categoriaId || 
                tipo.categoriaId === categoriaId ||
                (tipo.categoriaId === parentId && !tipo.sottocategoriaId)
            );
        } else {
            // È una categoria principale: cerca per categoriaId
            tipiFiltrati = tipiLavoroList.filter(tipo => tipo.categoriaId === categoriaId);
        }
    }
    
    // Se non ci sono tipi per questa categoria specifica, verifica se è una categoria principale
    // e cerca anche nelle sue sottocategorie
    if (tipiFiltrati.length === 0) {
        // Verifica se categoriaId è una sottocategoria
        const categoriaTrovata = [...categorieLavoriPrincipali, ...Array.from(sottocategorieLavoriMap.values()).flat()].find(c => c.id === categoriaId);
        
        if (categoriaTrovata && categoriaTrovata.parentId) {
            // È una sottocategoria: cerca anche per categoriaId (per retrocompatibilità)
            // e include i tipi della categoria principale senza sottocategoria
            const parentId = categoriaTrovata.parentId;
            tipiFiltrati = tipiLavoroList.filter(tipo => 
                tipo.categoriaId === categoriaId || 
                tipo.sottocategoriaId === categoriaId ||
                (tipo.categoriaId === parentId && !tipo.sottocategoriaId)
            );
        } else {
            // È una categoria principale: cerca nelle sottocategorie
            const sottocat = sottocategorieLavoriMap.get(categoriaId);
            if (sottocat && sottocat.length > 0) {
                // Cerca tipi lavoro associati alle sottocategorie
                const sottocatIds = sottocat.map(sc => sc.id);
                tipiFiltrati = tipiLavoroList.filter(tipo => 
                    sottocatIds.includes(tipo.categoriaId) || 
                    (tipo.sottocategoriaId && sottocatIds.includes(tipo.sottocategoriaId)) ||
                    (tipo.categoriaId === categoriaId && !tipo.sottocategoriaId)
                );
            }
        }
    }
    
    // Fallback: se categoria = Lavorazione del Terreno / sottocategoria = Generale,
    // aggiungi i tipi predefiniti mancanti (senza scrivere su Firestore)
    const tutteSottocategorie = Array.from(sottocategorieLavoriMap.values()).flat();
    const sottocategoriaObj = tutteSottocategorie.find(sc => sc.id === categoriaId);
    if (sottocategoriaObj && (sottocategoriaObj.nome || '').toLowerCase() === 'generale') {
        const categoriaParent = categorieLavoriPrincipali.find(cat => cat.id === sottocategoriaObj.parentId);
        if (categoriaParent && (categoriaParent.nome || '').toLowerCase() === 'lavorazione del terreno') {
            const defaultTipi = ['Erpicatura', 'Fresatura', 'Vangatura', 'Ripuntatura', 'Estirpatura', 'Rullatura'];
            defaultTipi.forEach(nomeDefault => {
                const exists = tipiFiltrati.some(t => (t.nome || '').toLowerCase() === nomeDefault.toLowerCase());
                if (!exists) {
                    tipiFiltrati.push({ nome: nomeDefault });
                }
            });
        }
    }
    
    // FILTRO VENDEMMIA: Se terreno è VITE e categoria è RACCOLTA, mostra solo tipi vendemmia
    // APPLICATO DOPO aver filtrato per categoria, così funziona correttamente con la gerarchia
    if (isTerrenoVite && isRaccolta && tipiFiltrati.length > 0) {
        console.log('[GESTIONE-LAVORI] Applicando filtro vendemmia: mostro solo Vendemmia Manuale e Vendemmia Meccanica');
        console.log('[GESTIONE-LAVORI] Tipi prima del filtro vendemmia:', tipiFiltrati.length, tipiFiltrati.map(t => t.nome));
        
        tipiFiltrati = tipiFiltrati.filter(tipo => {
            const nomeTipo = (tipo.nome || '').toLowerCase();
            const includeVendemmia = nomeTipo.includes('vendemmia');
            console.log('[GESTIONE-LAVORI] Tipo:', tipo.nome, 'include vendemmia?', includeVendemmia);
            return includeVendemmia;
        });
        
        console.log('[GESTIONE-LAVORI] Tipi dopo filtro vendemmia:', tipiFiltrati.length, tipiFiltrati.map(t => t.nome));
        
        // Se non ci sono tipi vendemmia nella lista, aggiungi i predefiniti
        if (tipiFiltrati.length === 0) {
            console.log('[GESTIONE-LAVORI] Nessun tipo vendemmia trovato, aggiungo predefiniti');
            // Trova la sottocategoria corretta per aggiungere i tipi predefiniti
            const sottocatManuale = Array.from(sottocategorieLavoriMap.values()).flat().find(sc => 
                sc.codice === 'raccolta_manuale' || sc.nome?.toLowerCase().includes('manuale')
            );
            const sottocatMeccanica = Array.from(sottocategorieLavoriMap.values()).flat().find(sc => 
                sc.codice === 'raccolta_meccanica' || sc.nome?.toLowerCase().includes('meccanica')
            );
            
            tipiFiltrati = [
                { nome: 'Vendemmia Manuale', sottocategoriaId: sottocatManuale?.id || categoriaId, categoriaId: categoriaId },
                { nome: 'Vendemmia Meccanica', sottocategoriaId: sottocatMeccanica?.id || categoriaId, categoriaId: categoriaId }
            ];
        }
    } else if (isRaccolta && !terrenoId) {
        console.log('[GESTIONE-LAVORI] Categoria RACCOLTA ma terreno non selezionato, mostro tutti i tipi raccolta');
    } else if (isRaccolta && terrenoId && !isTerrenoVite) {
        console.log('[GESTIONE-LAVORI] Categoria RACCOLTA ma terreno non è VITE, mostro tutti i tipi raccolta');
    }
    
    if (tipiFiltrati.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- Nessun tipo disponibile --';
        option.disabled = true;
        select.appendChild(option);
        return;
    }
    
    tipiFiltrati.forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo.nome; // Usa nome per retrocompatibilità con lavori esistenti
        option.textContent = tipo.nome;
        if (selectedValue === tipo.nome) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

/**
 * Renderizza la lista lavori nella UI
 * @param {Array} filteredLavoriList - Lista lavori filtrati da renderizzare
 * @param {Array} terreniList - Lista terreni
 * @param {Array} caposquadraList - Lista caposquadra
 * @param {Array} squadreList - Lista squadre
 * @param {Array} trattoriList - Lista trattori
 * @param {Array} attrezziList - Lista attrezzi
 * @param {boolean} hasManodoperaModule - Se il modulo Manodopera è attivo
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 * @param {Function} loadProgressiLavoro - Funzione per caricare progressi lavoro
 * @param {Function} escapeHtml - Funzione per escape HTML
 * @param {Function} getStatoFormattato - Funzione per formattare stato
 * @param {Function} getStatoProgressoFormattato - Funzione per formattare stato progresso
 * @param {Function} maybeAutoStartLavoriTour - Callback per avviare tour automatico
 */
export async function renderLavori(
    filteredLavoriList,
    terreniList,
    caposquadraList,
    squadreList,
    trattoriList,
    attrezziList,
    hasManodoperaModule,
    hasParcoMacchineModule,
    loadProgressiLavoro,
    escapeHtml,
    getStatoFormattato,
    getStatoProgressoFormattato,
    maybeAutoStartLavoriTour,
    operaiList = [],
    currentTenantId = null,
    db = null
) {
    const container = document.getElementById('lavori-container');
    const countEl = document.getElementById('lavori-count');

    if (!container || !countEl) {
        console.error('renderLavori: Container o countEl non trovati');
        return;
    }

    if (filteredLavoriList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>Nessun lavoro trovato</p>
                <p style="font-size: 14px; margin-top: 10px;">Clicca su "Crea Nuovo Lavoro" per iniziare</p>
            </div>
        `;
        countEl.textContent = '0 lavori';
        if (maybeAutoStartLavoriTour) maybeAutoStartLavoriTour();
        return;
    }

    // Carica dati terreno, caposquadra e operaio per ogni lavoro
    const terreniListToUse = terreniList || [];
    const caposquadraListToUse = caposquadraList || [];
    const squadreListToUse = squadreList || [];
    const trattoriListToUse = trattoriList || [];
    const attrezziListToUse = attrezziList || [];
    const operaiListToUse = operaiList || [];
    
    // Debug: verifica che i terreni siano caricati
    if (terreniListToUse.length === 0) {
    }
    
    const lavoriConDettagli = await Promise.all(
        filteredLavoriList.map(async (lavoro) => {
            let terreno = terreniListToUse.find(t => t.id === lavoro.terrenoId);
            
            // Se il terreno non è nella lista (può succedere per terreni clienti quando non siamo in modalità conto terzi),
            // caricalo direttamente da Firestore
            if (lavoro.terrenoId && !terreno && currentTenantId && db) {
                try {
                    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                    const terrenoDoc = await getDoc(doc(db, 'tenants', currentTenantId, 'terreni', lavoro.terrenoId));
                    if (terrenoDoc.exists()) {
                        const terrenoData = terrenoDoc.data();
                        terreno = {
                            id: terrenoDoc.id,
                            nome: terrenoData.nome || '',
                            superficie: terrenoData.superficie || 0,
                            coordinate: terrenoData.coordinate || null,
                            polygonCoords: terrenoData.polygonCoords || null,
                            coltura: terrenoData.coltura || null,
                            colturaCategoria: terrenoData.colturaCategoria || null,
                            colturaSottocategoria: terrenoData.colturaSottocategoria || null,
                            tipoCampo: terrenoData.tipoCampo || null,
                            clienteId: terrenoData.clienteId || null,
                            ...terrenoData
                        };
                    }
                } catch (error) {
                    console.warn(`[GESTIONE LAVORI] Errore caricamento terreno ${lavoro.terrenoId}:`, error);
                }
            }
            
            const caposquadra = caposquadraListToUse.find(c => c.id === lavoro.caposquadraId);
            const squadra = squadreListToUse.find(s => s.caposquadraId === lavoro.caposquadraId);
            const operaio = operaiListToUse.find(o => o.id === lavoro.operaioId);
            
            return { 
                ...lavoro, 
                terreno, 
                caposquadra,
                squadra,
                operaio
            };
        })
    );

    // Carica progressi per ogni lavoro
    const lavoriConProgressi = await Promise.all(
        lavoriConDettagli.map(async (lavoro) => {
            const progressi = loadProgressiLavoro ? await loadProgressiLavoro(lavoro.id) : { superficieLavorata: 0 };
            const lavoroConProgressi = { ...lavoro, ...progressi };
            
            // Calcola stato progresso se non presente o se necessario ricalcolarlo
            if (lavoroConProgressi.dataInizio && lavoroConProgressi.durataPrevista) {
                const dataInizio = lavoroConProgressi.dataInizio instanceof Date 
                    ? lavoroConProgressi.dataInizio 
                    : (lavoroConProgressi.dataInizio?.toDate ? lavoroConProgressi.dataInizio.toDate() : new Date(lavoroConProgressi.dataInizio));
                const oggi = new Date();
                oggi.setHours(0, 0, 0, 0);
                dataInizio.setHours(0, 0, 0, 0);
                
                const giorniEffettivi = Math.max(0, Math.floor((oggi - dataInizio) / (1000 * 60 * 60 * 24)) + 1);
                const giorniRimanenti = Math.max(0, lavoroConProgressi.durataPrevista - giorniEffettivi);
                
                // Calcola stato progresso se non presente
                if (!lavoroConProgressi.statoProgresso && giorniEffettivi > 0) {
                    const superficieTotale = lavoroConProgressi.terreno?.superficie || 0;
                    // Usa superficieTotaleLavorata dal documento lavoro o superficieLavorata calcolata da loadProgressiLavoro
                    const superficieLavorata = lavoroConProgressi.superficieTotaleLavorata || lavoroConProgressi.superficieLavorata || 0;
                    const percentualeCompletamento = superficieTotale > 0 ? (superficieLavorata / superficieTotale * 100) : 0;
                    const percentualeTempo = (giorniEffettivi / lavoroConProgressi.durataPrevista) * 100;
                    const tolleranza = 10; // Tolleranza del 10%
                    
                    if (percentualeCompletamento > percentualeTempo + tolleranza) {
                        lavoroConProgressi.statoProgresso = 'in_anticipo';
                    } else if (percentualeCompletamento < percentualeTempo - tolleranza) {
                        lavoroConProgressi.statoProgresso = 'in_ritardo';
                    } else {
                        lavoroConProgressi.statoProgresso = 'in_tempo';
                    }
                }
                
                lavoroConProgressi.giorniEffettivi = giorniEffettivi;
                lavoroConProgressi.giorniRimanenti = giorniRimanenti;
            }
            
            return lavoroConProgressi;
        })
    );

    // Applica filtro stato progresso se presente (dopo il calcolo)
    const progressoFilter = document.getElementById('filter-progresso')?.value || '';
    let lavoriFiltratiPerProgresso = lavoriConProgressi;
    if (progressoFilter) {
        lavoriFiltratiPerProgresso = lavoriConProgressi.filter(l => l.statoProgresso === progressoFilter);
    }
    
    // Separa lavori in attesa di approvazione dagli altri
    const lavoriInAttesa = lavoriFiltratiPerProgresso.filter(l => l.stato === 'completato_da_approvare');
    const altriLavori = lavoriFiltratiPerProgresso.filter(l => l.stato !== 'completato_da_approvare');

    let html = '';

    // Sezione lavori in attesa di approvazione
    if (lavoriInAttesa.length > 0) {
        html += `
            <div style="background: #fff3cd; padding: 20px; border-radius: 12px; margin-bottom: 30px; border-left: 5px solid #ffc107;" data-tour-section="lavori-approvazione">
                <h2 style="color: #856404; margin-bottom: 15px; font-size: 20px;">
                    ⏳ Lavori in attesa di approvazione (${lavoriInAttesa.length})
                </h2>
                <table class="lavori-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Terreno</th>
                            ${hasManodoperaModule ? '<th>Caposquadra</th>' : ''}
                            <th>Progressi Tracciati</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        lavoriInAttesa.forEach(lavoro => {
            const terrenoNome = lavoro.terreno ? lavoro.terreno.nome || 'N/A' : 'N/A';
            
            // Determina responsabile: caposquadra (lavoro squadra) o operaio autonomo
            let responsabileHtml = 'N/A';
            if (lavoro.caposquadra) {
                // Lavoro di squadra: mostra caposquadra con icona e colore blu
                const caposquadraNome = `${lavoro.caposquadra.nome || ''} ${lavoro.caposquadra.cognome || ''}`.trim() || 'N/A';
                responsabileHtml = `<span class="caposquadra-name" style="color: #1976D2; font-weight: 500;">👥 ${escapeHtml(caposquadraNome)}</span>`;
            } else if (lavoro.operaio) {
                // Lavoro autonomo: mostra operaio con icona normale
                const operaioNome = `${lavoro.operaio.nome || ''} ${lavoro.operaio.cognome || ''}`.trim() || 'N/A';
                responsabileHtml = `👤 ${escapeHtml(operaioNome)}`;
            }
            
            const superficieTotale = lavoro.terreno?.superficie || 0;
            // Usa superficieTotaleLavorata dal documento lavoro
            const superficieLavorata = lavoro.superficieTotaleLavorata || 0;
            const percentualeTracciata = lavoro.percentualeCompletamentoTracciata || 
                (superficieTotale > 0 ? Math.round((superficieLavorata / superficieTotale) * 100) : 0);
            
            // Applica stile conto terzi se presente clienteId
            const isContoTerzi = !!lavoro.clienteId;
            const rowClass = isContoTerzi ? 'lavoro-conto-terzi' : '';
            const rowStyle = isContoTerzi ? '' : 'background: #fffbf0;';
            
            html += `
                <tr class="${rowClass}" style="${rowStyle}">
                    <td><strong>${escapeHtml(lavoro.nome || 'N/A')}</strong></td>
                    <td>${escapeHtml(terrenoNome)}</td>
                    ${hasManodoperaModule ? `<td>${responsabileHtml}</td>` : ''}
                    <td>
                        <div class="progress-bar-inline">
                            <div class="progress-fill-inline" style="width: ${Math.min(percentualeTracciata, 100)}%; background: #ffc107;">
                                ${percentualeTracciata}%
                            </div>
                        </div>
                        <div class="progress-text">Superficie tracciata: ${percentualeTracciata}%</div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-primary btn-sm" onclick="approvaLavoro('${lavoro.id}')">
                                ✅ Approva
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="rifiutaLavoro('${lavoro.id}')">
                                ❌ Rifiuta
                            </button>
                            <button class="btn btn-info btn-sm" onclick="openDettaglioModal('${lavoro.id}')">
                                👁️ Dettagli
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    }

    // Tabella lavori normali
    html += `
        <table class="lavori-table">
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Terreno</th>
                    ${hasManodoperaModule ? '<th>Caposquadra</th>' : ''}
                    <th>Data Inizio</th>
                    <th>Durata</th>
                    <th>Progressi</th>
                    <th>Stato Progresso</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                </tr>
            </thead>
            <tbody>
    `;

    altriLavori.forEach(lavoro => {
        const terrenoNome = lavoro.terreno ? lavoro.terreno.nome || 'N/A' : 'N/A';
        
        // Determina responsabile: caposquadra (lavoro squadra) o operaio autonomo
        let responsabileHtml = 'N/A';
        if (lavoro.caposquadra) {
            // Lavoro di squadra: mostra caposquadra con icona e colore blu
            const caposquadraNome = `${lavoro.caposquadra.nome || ''} ${lavoro.caposquadra.cognome || ''}`.trim() || 'N/A';
            responsabileHtml = `<span class="caposquadra-name" style="color: #1976D2; font-weight: 500;">👥 ${escapeHtml(caposquadraNome)}</span>`;
        } else if (lavoro.operaio) {
            // Lavoro autonomo: mostra operaio con icona normale
            const operaioNome = `${lavoro.operaio.nome || ''} ${lavoro.operaio.cognome || ''}`.trim() || 'N/A';
            responsabileHtml = `👤 ${escapeHtml(operaioNome)}`;
        }
        
        const dataInizioFormatted = lavoro.dataInizio 
            ? new Date(lavoro.dataInizio).toLocaleDateString('it-IT')
            : 'N/A';
        const durata = lavoro.durataPrevista ? `${lavoro.durataPrevista} giorni` : 'N/A';
        const statoBadge = `<span class="badge badge-${lavoro.stato || 'assegnato'}">${getStatoFormattato(lavoro.stato)}</span>`;
        
        // Calcola progressi
        const superficieTotale = lavoro.terreno?.superficie || 0;
        // Usa superficieTotaleLavorata dal documento lavoro
        const superficieLavorata = lavoro.superficieTotaleLavorata || lavoro.superficieLavorata || 0;
        let percentuale = lavoro.percentualeCompletamento || 0;
        
        // Se lavoro è completato e percentuale è 0 o mancante, imposta a 100%
        if ((lavoro.stato === 'completato' || lavoro.stato === 'completato_da_approvare') && (!percentuale || percentuale === 0)) {
            percentuale = 100;
        } else if (!percentuale && superficieTotale > 0) {
            // Calcola percentuale da superficie lavorata / superficie totale
            percentuale = Math.round((superficieLavorata / superficieTotale) * 100);
        } else if (!percentuale && superficieLavorata > 0) {
            // Se abbiamo superficie lavorata ma non superficie totale, mostra almeno la superficie lavorata
            percentuale = 0; // Non possiamo calcolare la percentuale senza superficie totale
        }
        
        // Mostra barra di progresso se abbiamo dati, altrimenti mostra messaggio
        const progressBar = superficieTotale > 0 ? `
            <div class="progress-bar-inline">
                <div class="progress-fill-inline" style="width: ${Math.min(percentuale, 100)}%">${percentuale}%</div>
            </div>
            <div class="progress-text">${superficieLavorata.toFixed(2)} / ${superficieTotale.toFixed(2)} ha</div>
        ` : superficieLavorata > 0 ? `
            <div class="progress-text" style="color: #666;">Superficie lavorata: ${superficieLavorata.toFixed(2)} ha</div>
        ` : '<div class="progress-text" style="color: #999;">Nessun progresso</div>';

        // Badge stato progresso
        let statoProgressoBadge = '';
        if (lavoro.statoProgresso && lavoro.durataPrevista && lavoro.dataInizio) {
            statoProgressoBadge = `
                <span class="badge badge-progresso-${lavoro.statoProgresso}" style="display: inline-block; margin-bottom: 5px;">
                    ${getStatoProgressoFormattato(lavoro.statoProgresso)}
                </span>
                <div style="font-size: 11px; color: #666; margin-top: 3px;">
                    ${lavoro.giorniEffettivi || 0}/${lavoro.durataPrevista} giorni
                    ${lavoro.giorniRimanenti !== null && lavoro.giorniRimanenti >= 0 ? `(${lavoro.giorniRimanenti} rim.)` : ''}
                </div>
            `;
        } else {
            statoProgressoBadge = '<span style="color: #999; font-size: 12px;">N/A</span>';
        }

        // Info macchine (solo se modulo Parco Macchine attivo)
        let macchineInfo = '';
        if (hasParcoMacchineModule && (lavoro.macchinaId || lavoro.attrezzoId)) {
            const macchineParts = [];
            if (lavoro.macchinaId) {
                const trattore = trattoriListToUse.find(t => t.id === lavoro.macchinaId);
                if (trattore) {
                    macchineParts.push(`🚜 ${trattore.nome || 'Trattore'}`);
                }
            }
            if (lavoro.attrezzoId) {
                const attrezzo = attrezziListToUse.find(a => a.id === lavoro.attrezzoId);
                if (attrezzo) {
                    macchineParts.push(`⚙️ ${attrezzo.nome || 'Attrezzo'}`);
                }
            }
            if (macchineParts.length > 0) {
                macchineInfo = `<div style="font-size: 11px; color: #666; margin-top: 3px;">${macchineParts.join(' + ')}</div>`;
            }
        }

        // Verifica se è lavoro conto terzi
        const isContoTerzi = !!lavoro.clienteId;
        const contoTerziBadge = isContoTerzi ? '<span class="badge" style="background: #1976D2; color: white; margin-left: 5px; font-size: 10px;">💼 Conto Terzi</span>' : '';
        
        html += `
            <tr class="${isContoTerzi ? 'lavoro-conto-terzi' : ''}">
                <td><strong>${escapeHtml(lavoro.nome || 'N/A')}</strong>${contoTerziBadge}${macchineInfo}</td>
                <td>${escapeHtml(terrenoNome)}</td>
                ${hasManodoperaModule ? `<td>${responsabileHtml}</td>` : ''}
                <td>${dataInizioFormatted}</td>
                <td>${durata}</td>
                <td class="progress-cell">${progressBar}</td>
                <td style="min-width: 120px;">${statoProgressoBadge}</td>
                <td>${statoBadge}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-info btn-sm" onclick="openDettaglioModal('${lavoro.id}')">👁️ Dettagli</button>
                        <button class="btn btn-info btn-sm" onclick="openModificaModal('${lavoro.id}')">✏️ Modifica</button>
                        <button class="btn btn-danger btn-sm" onclick="openEliminaModal('${lavoro.id}')">🗑️ Elimina</button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
    countEl.textContent = `${filteredLavoriList.length} lavoro${filteredLavoriList.length !== 1 ? 'i' : ''}`;
    if (maybeAutoStartLavoriTour) maybeAutoStartLavoriTour();
}

/**
 * Popola dropdown attrezzi compatibili con trattore selezionato
 * @param {string} trattoreId - ID trattore selezionato
 * @param {Array} trattoriList - Lista trattori
 * @param {Array} attrezziList - Lista attrezzi
 * @param {Function} getNomeCategoria - Funzione per ottenere nome categoria
 */
export function populateAttrezziDropdown(trattoreId, trattoriList, attrezziList, getNomeCategoria) {
    const select = document.getElementById('lavoro-attrezzo');
    const attrezzoGroup = document.getElementById('attrezzo-group');
    
    if (!select || !attrezzoGroup) {
        return;
    }
    
    select.innerHTML = '<option value="">-- Nessun attrezzo --</option>';
    
    if (!trattoreId) {
        attrezzoGroup.style.display = 'none';
        return;
    }
    
    if (!trattoriList || trattoriList.length === 0) {
        attrezzoGroup.style.display = 'none';
        return;
    }
    
    const trattore = trattoriList.find(t => t.id === trattoreId);
    if (!trattore) {
        attrezzoGroup.style.display = 'none';
        return;
    }
    
    if (!trattore.cavalli) {
        attrezzoGroup.style.display = 'none';
        return;
    }
    
    if (!attrezziList || attrezziList.length === 0) {
        attrezzoGroup.style.display = 'block';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- Caricamento attrezzi... --';
        option.disabled = true;
        select.appendChild(option);
        return;
    }
    
    attrezzoGroup.style.display = 'block';
    
    // Filtra attrezzi compatibili
    const attrezziCompatibili = attrezziList.filter(attrezzo => {
        if (!attrezzo.cavalliMinimiRichiesti) {
            return false;
        }
        return trattore.cavalli >= attrezzo.cavalliMinimiRichiesti;
    });
    
    if (attrezziCompatibili.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- Nessun attrezzo compatibile --';
        option.disabled = true;
        select.appendChild(option);
        return;
    }
    
    attrezziCompatibili.forEach(attrezzo => {
        const option = document.createElement('option');
        option.value = attrezzo.id;
        const nome = attrezzo.nome || 'Attrezzo senza nome';
        const categoriaNome = getNomeCategoria ? getNomeCategoria(attrezzo.categoriaFunzione) : 'Senza categoria';
        const cvMin = attrezzo.cavalliMinimiRichiesti ? ` (min ${attrezzo.cavalliMinimiRichiesti} CV)` : '';
        const stato = attrezzo.stato === 'disponibile' ? '✅' : attrezzo.stato === 'in_uso' ? '🔄' : '⚠️';
        option.textContent = `${stato} ${nome} - ${categoriaNome}${cvMin}`;
        option.disabled = attrezzo.stato === 'in_uso' || attrezzo.stato === 'in_manutenzione' || attrezzo.stato === 'guasto';
        select.appendChild(option);
    });
}

/**
 * Popola dropdown operatore macchina
 * @param {Array} operaiList - Lista operai
 */
export function populateOperatoreMacchinaDropdown(operaiList) {
    const select = document.getElementById('lavoro-operatore-macchina');
    const operatoreGroup = document.getElementById('operatore-macchina-group');
    
    if (!select || !operatoreGroup) return;
    
    // Mostra solo se trattore o attrezzo selezionato
    const trattoreId = document.getElementById('lavoro-trattore')?.value;
    const attrezzoId = document.getElementById('lavoro-attrezzo')?.value;
    
    if (!trattoreId && !attrezzoId) {
        operatoreGroup.style.display = 'none';
        select.innerHTML = '<option value="">-- Nessun operatore --</option>';
        // Rimuovi suggerimento se presente
        const suggerimento = operatoreGroup.querySelector('.suggerimento-operatore');
        if (suggerimento) suggerimento.remove();
        return;
    }
    
    operatoreGroup.style.display = 'block';
    
    // Ottieni operaio responsabile del lavoro (se presente)
    const tipoAssegnazione = document.querySelector('input[name="tipo-assegnazione"]:checked')?.value;
    const operaioResponsabileId = tipoAssegnazione === 'autonomo' 
        ? document.getElementById('lavoro-operaio')?.value 
        : null;
    
    select.innerHTML = '<option value="">-- Usa operaio responsabile --</option>';
    
    // Mostra tutti gli operai attivi, evidenziando quello responsabile
    operaiList.forEach(operaio => {
        const option = document.createElement('option');
        option.value = operaio.id;
        const nomeCompleto = `${operaio.nome || ''} ${operaio.cognome || ''}`.trim() || operaio.email || 'Operaio senza nome';
        
        if (operaio.id === operaioResponsabileId) {
            option.textContent = `${nomeCompleto} (responsabile lavoro)`;
            option.style.fontWeight = 'bold';
        } else {
            option.textContent = nomeCompleto;
        }
        
        select.appendChild(option);
    });
    
    // Rimuovi suggerimento precedente se presente
    const suggerimentoPrecedente = operatoreGroup.querySelector('.suggerimento-operatore');
    if (suggerimentoPrecedente) {
        suggerimentoPrecedente.remove();
    }
    
    // Se c'è un operaio responsabile, mostra suggerimento
    if (operaioResponsabileId) {
        const operaioResponsabile = operaiList.find(o => o.id === operaioResponsabileId);
        if (operaioResponsabile) {
            const nomeOp = `${operaioResponsabile.nome || ''} ${operaioResponsabile.cognome || ''}`.trim() || operaioResponsabile.email;
            const suggerimentoDiv = document.createElement('div');
            suggerimentoDiv.className = 'suggerimento-operatore';
            suggerimentoDiv.style.cssText = 'margin-top: 5px; padding: 8px; background: #e7f3ff; border-left: 3px solid #2196F3; border-radius: 4px; font-size: 12px; color: #1976D2;';
            suggerimentoDiv.innerHTML = `💡 <strong>Suggerimento:</strong> L'operaio responsabile "<strong>${nomeOp}</strong>" sarà usato come operatore macchina se non ne selezioni uno specifico.`;
            operatoreGroup.appendChild(suggerimentoDiv);
        }
    }
}

// Flag per evitare chiamate multiple simultanee
let isLoadingOverview = false;

/**
 * Carica dettaglio overview di un lavoro
 * @param {string} lavoroId - ID lavoro
 * @param {Array} lavoriList - Lista lavori
 * @param {Array} terreniList - Lista terreni
 * @param {Array} caposquadraList - Lista caposquadra
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Function} loadProgressiLavoro - Funzione per caricare progressi lavoro
 * @param {Function} escapeHtml - Funzione per escape HTML
 * @param {Function} getStatoFormattato - Funzione per formattare stato
 */
export async function loadDettaglioOverview(
    lavoroId,
    lavoriList,
    terreniList,
    caposquadraList,
    currentTenantId,
    db,
    loadProgressiLavoro,
    escapeHtml,
    getStatoFormattato
) {
    const container = document.getElementById('dettaglio-overview-content');
    if (!container) {
        console.error('loadDettaglioOverview: Container non trovato');
        return;
    }
    
    // Evita chiamate multiple simultanee
    if (isLoadingOverview) {
        return;
    }
    
    isLoadingOverview = true;
    
    // Pulisci completamente il container per evitare duplicazioni
    // Rimuovi tutti i figli prima di aggiungere nuovo contenuto
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    container.innerHTML = '<div class="loading">Caricamento dettagli...</div>';

    try {
        const { collection, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const lavoro = lavoriList.find(l => l.id === lavoroId);
        if (!lavoro) {
            container.innerHTML = '<div class="empty-state">Lavoro non trovato</div>';
            return;
        }

        const terreno = terreniList.find(t => t.id === lavoro.terrenoId);
        const caposquadra = caposquadraList.find(c => c.id === lavoro.caposquadraId);
        const progressi = loadProgressiLavoro ? await loadProgressiLavoro(lavoroId, currentTenantId, db) : { superficieLavorata: 0 };
        
        // Carica ore e raggruppa per operaio
        const oreRef = collection(db, 'tenants', currentTenantId, 'lavori', lavoroId, 'oreOperai');
        const oreSnapshot = await getDocs(oreRef);
        let totaleOreValidate = 0;
        let totaleOreDaValidare = 0;
        let totaleOreRifiutate = 0;
        let orePerOperaio = {};
        
        oreSnapshot.forEach(oraDoc => {
            const oraData = oraDoc.data();
            const oreNette = oraData.oreNette || 0;
            const operaioId = oraData.operaioId;
            
            if (oraData.stato === 'validate') {
                totaleOreValidate += oreNette;
            } else if (oraData.stato === 'da_validare') {
                totaleOreDaValidare += oreNette;
            } else if (oraData.stato === 'rifiutate') {
                totaleOreRifiutate += oreNette;
            }
            
            // Raggruppa per operaio
            if (operaioId) {
                if (!orePerOperaio[operaioId]) {
                    orePerOperaio[operaioId] = { validate: 0, daValidare: 0, rifiutate: 0 };
                }
                
                if (oraData.stato === 'validate') {
                    orePerOperaio[operaioId].validate += oreNette;
                } else if (oraData.stato === 'da_validare') {
                    orePerOperaio[operaioId].daValidare += oreNette;
                } else if (oraData.stato === 'rifiutate') {
                    orePerOperaio[operaioId].rifiutate += oreNette;
                }
            }
        });
        
        // Carica nomi operai
        const operaiMap = {};
        for (const operaioId of Object.keys(orePerOperaio)) {
            try {
                const operaioDoc = await getDoc(doc(db, 'users', operaioId));
                if (operaioDoc.exists()) {
                    const operaioData = operaioDoc.data();
                    operaiMap[operaioId] = `${operaioData.nome || ''} ${operaioData.cognome || ''}`.trim() || operaioData.email || 'N/A';
                }
            } catch (error) {
                console.error('Errore caricamento operaio:', error);
                operaiMap[operaioId] = 'N/A';
            }
        }

        const superficieTotale = terreno?.superficie || 0;
        const superficieLavorata = progressi.superficieLavorata || 0;
        const percentuale = superficieTotale > 0 ? Math.round((superficieLavorata / superficieTotale) * 100) : 0;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px;">
                <div class="ore-stat-card">
                    <div class="ore-stat-value">${superficieLavorata.toFixed(2)} / ${superficieTotale.toFixed(2)} ha</div>
                    <div class="ore-stat-label">Superficie Lavorata</div>
                </div>
                <div class="ore-stat-card">
                    <div class="ore-stat-value">${percentuale}%</div>
                    <div class="ore-stat-label">Percentuale Completamento</div>
                </div>
                <div class="ore-stat-card">
                    <div class="ore-stat-value">${Math.round(totaleOreValidate)}h</div>
                    <div class="ore-stat-label">Ore Validate</div>
                </div>
                <div class="ore-stat-card">
                    <div class="ore-stat-value">${Math.round(totaleOreDaValidare)}h</div>
                    <div class="ore-stat-label">Ore da Validare</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px;">Progressi</h4>
                <div class="progress-bar-inline" style="height: 30px;">
                    <div class="progress-fill-inline" style="width: ${Math.min(percentuale, 100)}%; height: 30px; font-size: 14px;">${percentuale}%</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <strong>Terreno:</strong> ${terreno ? terreno.nome : 'N/A'}
                </div>
                <div>
                    <strong>Caposquadra:</strong> ${caposquadra ? `${caposquadra.nome || ''} ${caposquadra.cognome || ''}`.trim() : 'N/A'}
                </div>
                <div>
                    <strong>Data Inizio:</strong> ${lavoro.dataInizio ? new Date(lavoro.dataInizio).toLocaleDateString('it-IT') : 'N/A'}
                </div>
                <div>
                    <strong>Durata Prevista:</strong> ${lavoro.durataPrevista || 0} giorni
                </div>
                <div>
                    <strong>Stato:</strong> <span class="badge badge-${lavoro.stato || 'assegnato'}">${getStatoFormattato(lavoro.stato)}</span>
                </div>
            </div>
            
            ${lavoro.note ? `<div style="margin-top: 20px;"><strong>Note:</strong><br>${escapeHtml(lavoro.note)}</div>` : ''}
            
            <div style="margin-top: 30px;">
                <h4 style="margin-bottom: 15px;">Ore per Operaio</h4>
                ${Object.keys(orePerOperaio).length > 0 ? `
                    <div style="display: grid; gap: 10px;">
                        ${Object.keys(orePerOperaio).map(operaioId => {
                            const ore = orePerOperaio[operaioId];
                            const nomeOperaio = operaiMap[operaioId] || 'N/A';
                            return `
                                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                                    <strong>${escapeHtml(nomeOperaio)}</strong>
                                    <div style="margin-top: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                        <div><span style="color: #2E8B57;">✅ ${Math.round(ore.validate)}h</span> validate</div>
                                        <div><span style="color: #ffc107;">⏳ ${Math.round(ore.daValidare)}h</span> da validare</div>
                                        <div><span style="color: #dc3545;">❌ ${Math.round(ore.rifiutate)}h</span> rifiutate</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <div style="padding: 20px; text-align: center; color: #999; background: #f8f9fa; border-radius: 8px;">
                        Nessuna ora registrata per questo lavoro
                    </div>
                `}
            </div>
        `;
        
        // Assicurati che il container contenga solo il contenuto appena generato
        // Rimuovi eventuali elementi residui
        const currentContent = container.innerHTML;
        container.innerHTML = '';
        container.innerHTML = currentContent;
        
        // Reset flag dopo il caricamento completato
        isLoadingOverview = false;
    } catch (error) {
        console.error('Errore caricamento dettaglio:', error);
        const container = document.getElementById('dettaglio-overview-content');
        if (container) {
            container.innerHTML = '<div class="empty-state">Errore caricamento dettagli</div>';
        }
        // Reset flag anche in caso di errore
        isLoadingOverview = false;
    }
}

/**
 * Carica dettaglio ore di un lavoro
 * @param {string} lavoroId - ID lavoro
 * @param {Array} lavoriList - Lista lavori
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Function} escapeHtml - Funzione per escape HTML
 */
export async function loadDettaglioOre(
    lavoroId,
    lavoriList,
    currentTenantId,
    db,
    escapeHtml
) {
    const container = document.getElementById('dettaglio-ore-content');
    if (!container) {
        console.error('loadDettaglioOre: Container non trovato');
        return;
    }
    
    container.innerHTML = '<div class="loading">Caricamento statistiche ore...</div>';

    try {
        const { collection, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const lavoro = lavoriList.find(l => l.id === lavoroId);
        if (!lavoro) {
            container.innerHTML = '<div class="empty-state">Lavoro non trovato</div>';
            return;
        }

        // Carica ore
        const oreRef = collection(db, 'tenants', currentTenantId, 'lavori', lavoroId, 'oreOperai');
        const oreSnapshot = await getDocs(oreRef);
        
        let oreList = [];
        let totaleValidate = 0;
        let totaleDaValidare = 0;
        let totaleRifiutate = 0;
        let orePerOperaio = {};

        oreSnapshot.forEach(oraDoc => {
            const oraData = oraDoc.data();
            oreList.push({ id: oraDoc.id, ...oraData });
            
            const oreNette = oraData.oreNette || 0;
            const operaioId = oraData.operaioId;
            
            if (oraData.stato === 'validate') {
                totaleValidate += oreNette;
            } else if (oraData.stato === 'da_validare') {
                totaleDaValidare += oreNette;
            } else if (oraData.stato === 'rifiutate') {
                totaleRifiutate += oreNette;
            }
            
            if (!orePerOperaio[operaioId]) {
                orePerOperaio[operaioId] = { validate: 0, daValidare: 0, rifiutate: 0 };
            }
            
            if (oraData.stato === 'validate') {
                orePerOperaio[operaioId].validate += oreNette;
            } else if (oraData.stato === 'da_validare') {
                orePerOperaio[operaioId].daValidare += oreNette;
            } else if (oraData.stato === 'rifiutate') {
                orePerOperaio[operaioId].rifiutate += oreNette;
            }
        });

        // Carica nomi operai
        const operaiMap = {};
        for (const operaioId of Object.keys(orePerOperaio)) {
            try {
                const operaioDoc = await getDoc(doc(db, 'users', operaioId));
                if (operaioDoc.exists()) {
                    const operaioData = operaioDoc.data();
                    operaiMap[operaioId] = `${operaioData.nome || ''} ${operaioData.cognome || ''}`.trim() || operaioData.email || 'N/A';
                }
            } catch (error) {
                console.error('Errore caricamento operaio:', error);
                operaiMap[operaioId] = 'N/A';
            }
        }

        container.innerHTML = `
            <div class="ore-stats-grid">
                <div class="ore-stat-card">
                    <div class="ore-stat-value">${Math.round(totaleValidate)}h</div>
                    <div class="ore-stat-label">Ore Validate</div>
                </div>
                <div class="ore-stat-card">
                    <div class="ore-stat-value">${Math.round(totaleDaValidare)}h</div>
                    <div class="ore-stat-label">Ore da Validare</div>
                </div>
                <div class="ore-stat-card">
                    <div class="ore-stat-value">${Math.round(totaleRifiutate)}h</div>
                    <div class="ore-stat-label">Ore Rifiutate</div>
                </div>
            </div>
            
            <h4 style="margin-bottom: 15px;">Ore per Operaio</h4>
            <div style="display: grid; gap: 10px;">
                ${Object.keys(orePerOperaio).map(operaioId => {
                    const ore = orePerOperaio[operaioId];
                    const nomeOperaio = operaiMap[operaioId] || 'N/A';
                    return `
                        <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                            <strong>${escapeHtml(nomeOperaio)}</strong>
                            <div style="margin-top: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                <div><span style="color: #2E8B57;">✅ ${Math.round(ore.validate)}h</span> validate</div>
                                <div><span style="color: #ffc107;">⏳ ${Math.round(ore.daValidare)}h</span> da validare</div>
                                <div><span style="color: #dc3545;">❌ ${Math.round(ore.rifiutate)}h</span> rifiutate</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Errore caricamento statistiche ore:', error);
        const container = document.getElementById('dettaglio-ore-content');
        if (container) {
            container.innerHTML = '<div class="empty-state">Errore caricamento statistiche ore</div>';
        }
    }
}


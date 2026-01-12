/**
 * Gestione Macchine Controller - Logica principale e caricamento dati
 * 
 * @module core/admin/js/gestione-macchine-controller
 */

// ============================================
// IMPORTS
// ============================================
import { formattaData, isManutenzioneInScadenza, isManutenzioneScaduta, escapeHtml } from './gestione-macchine-utils.js';

// ============================================
// FUNZIONI CARICAMENTO CATEGORIE
// ============================================

/**
 * Migra dati esistenti da categorieAttrezzi alla collezione unificata
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze Firebase
 * @returns {Promise<void>}
 */
export async function migraCategorieAttrezziEsistenti(tenantId, dependencies) {
    const { collection, getDocs, addDoc, doc, db, Timestamp } = dependencies;
    
    try {
        if (!tenantId) return;
        
        // Verifica se esistono categorie nella vecchia collezione
        const vecchiaCollezioneRef = collection(db, `tenants/${tenantId}/categorieAttrezzi`);
        const vecchiaSnapshot = await getDocs(vecchiaCollezioneRef);
        
        if (vecchiaSnapshot.empty) {
            return; // Niente da migrare
        }
        
        // Verifica se la nuova collezione esiste già
        const nuovaCollezioneRef = collection(db, `tenants/${tenantId}/categorie`);
        const nuovaSnapshot = await getDocs(nuovaCollezioneRef);
        
        if (!nuovaSnapshot.empty) {
            // Già migrato o inizializzato
            return;
        }

        // Migra ogni categoria
        for (const docSnap of vecchiaSnapshot.docs) {
            const vecchiaData = docSnap.data();
            
            const nuovaCategoriaData = {
                nome: vecchiaData.nome,
                codice: vecchiaData.codice || vecchiaData.nome.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                descrizione: vecchiaData.descrizione || null,
                parentId: null, // Tutte le vecchie categorie sono principali
                applicabileA: 'attrezzi', // Le vecchie categorie erano solo per attrezzi
                predefinita: vecchiaData.predefinita || false,
                ordine: null,
                creatoDa: vecchiaData.creatoDa || 'system',
                createdAt: vecchiaData.createdAt || Timestamp.now(),
                updatedAt: Timestamp.now()
            };
            
            await addDoc(nuovaCollezioneRef, nuovaCategoriaData);
        }

    } catch (error) {
        console.error('Errore migrazione categorie attrezzi:', error);
        // Non bloccare il caricamento se la migrazione fallisce
    }
}

/**
 * Inizializza categorie predefinite (usando servizio unificato)
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Function} migraCategorieCallback - Callback per migrazione categorie
 * @returns {Promise<void>}
 */
export async function initializeCategorie(tenantId, dependencies, migraCategorieCallback) {
    const { collection, getDocs, addDoc, query, orderBy, db, Timestamp } = dependencies;
    
    try {
        if (!tenantId) return;
        
        // Migra prima i dati esistenti
        if (migraCategorieCallback) {
            await migraCategorieCallback();
        }
        
        // Usa codice inline per evitare problemi CORS
        const categorieRef = collection(db, `tenants/${tenantId}/categorie`);
        const snapshot = await getDocs(categorieRef);
        
        // Verifica quali categorie predefinite esistono già (per codice)
        const codiciEsistenti = new Set();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.codice) {
                codiciEsistenti.add(data.codice);
            }
        });
        
        // Categorie principali predefinite per attrezzi
        const categoriePrincipaliPredefinite = [
            { nome: 'Lavorazione del Terreno', codice: 'lavorazione_terreno', descrizione: 'Aratura, erpicatura, fresatura, vangatura, ecc.', applicabileA: 'entrambi', predefinita: true, ordine: 1 },
            { nome: 'Trattamenti', codice: 'trattamenti', descrizione: 'Fitofarmaci, concimazione, irrigazione, ecc.', applicabileA: 'entrambi', predefinita: true, ordine: 2 },
            { nome: 'Potatura', codice: 'potatura', descrizione: 'Potatura manuale e meccanica', applicabileA: 'entrambi', predefinita: true, ordine: 3 },
            { nome: 'Raccolta', codice: 'raccolta', descrizione: 'Raccolta frutta, raccolta verdura, vendemmia, ecc.', applicabileA: 'entrambi', predefinita: true, ordine: 4 },
            { nome: 'Gestione del Verde', codice: 'gestione_verde', descrizione: 'Falciatura, taglio erba, manutenzione estetica, ecc.', applicabileA: 'entrambi', predefinita: true, ordine: 5 },
            { nome: 'Diserbo', codice: 'diserbo', descrizione: 'Eliminazione delle erbe infestanti', applicabileA: 'entrambi', predefinita: true, ordine: 6 },
            { nome: 'Semina e Piantagione', codice: 'semina_piantagione', descrizione: 'Semina, trapianto, piantagione, ecc.', applicabileA: 'entrambi', predefinita: true, ordine: 7 },
            { nome: 'Trasporto', codice: 'trasporto', descrizione: 'Rimorchi, carri, carrelli, ecc.', applicabileA: 'attrezzi', predefinita: true, ordine: 8 },
            { nome: 'Altro', codice: 'altro', descrizione: 'Altri tipi non categorizzabili', applicabileA: 'entrambi', predefinita: true, ordine: 10 }
        ];
        
        const categorieMap = new Map(); // codice -> id
        
        // Crea solo le categorie principali predefinite mancanti
        for (const cat of categoriePrincipaliPredefinite) {
            if (!codiciEsistenti.has(cat.codice)) {
                const docRef = await addDoc(categorieRef, {
                    ...cat,
                    parentId: null,
                    creatoDa: 'system',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
                categorieMap.set(cat.codice, docRef.id);
                codiciEsistenti.add(cat.codice);
            } else {
                // Trova l'ID della categoria esistente
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.codice === cat.codice) {
                        categorieMap.set(cat.codice, doc.id);
                    }
                });
            }
        }
        
        // Crea sottocategorie predefinite mancanti
        const sottocategoriePredefinite = [
            { nome: 'Generale', codice: 'lavorazione_terreno_generale', parentCodice: 'lavorazione_terreno', descrizione: 'Lavorazione standard per campi aperti', applicabileA: 'entrambi', predefinita: true, ordine: 1 },
            { nome: 'Tra le File', codice: 'lavorazione_terreno_tra_file', parentCodice: 'lavorazione_terreno', descrizione: 'Lavorazione tra le file di frutteti/vigneti', applicabileA: 'entrambi', predefinita: true, ordine: 2 },
            { nome: 'Sulla Fila', codice: 'lavorazione_terreno_sulla_fila', parentCodice: 'lavorazione_terreno', descrizione: 'Lavorazione sulla fila di frutteti/vigneti', applicabileA: 'entrambi', predefinita: true, ordine: 3 },
            { nome: 'Meccanica', codice: 'potatura_meccanica', parentCodice: 'potatura', descrizione: 'Potatura eseguita con attrezzi meccanici', applicabileA: 'attrezzi', predefinita: true, ordine: 2 }
        ];
        
        for (const sottocat of sottocategoriePredefinite) {
            if (!codiciEsistenti.has(sottocat.codice)) {
                const parentId = categorieMap.get(sottocat.parentCodice);
                if (parentId) {
                    await addDoc(categorieRef, {
                        nome: sottocat.nome,
                        codice: sottocat.codice,
                        descrizione: sottocat.descrizione,
                        parentId: parentId,
                        applicabileA: sottocat.applicabileA,
                        predefinita: sottocat.predefinita,
                        ordine: sottocat.ordine,
                        creatoDa: 'system',
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                    codiciEsistenti.add(sottocat.codice);
                }
            }
        }
    } catch (error) {
        console.error('Errore inizializzazione categorie:', error);
    }
}

/**
 * Carica categorie principali e sottocategorie
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Object} state - State object con categoriePrincipali e sottocategorieMap
 * @param {Function} updateState - Funzione per aggiornare state
 * @returns {Promise<void>}
 */
export async function loadCategorie(tenantId, dependencies, state, updateState) {
    const { collection, getDocs, query, orderBy, db } = dependencies;
    
    try {
        if (!tenantId) return;
        
        const categorieRef = collection(db, `tenants/${tenantId}/categorie`);
        
        // Carica tutte le categorie
        const snapshot = await getDocs(query(categorieRef, orderBy('ordine', 'asc')));
        const categoriePrincipali = [];
        const sottocategorieMap = new Map();
        
        snapshot.forEach(doc => {
            const catData = { id: doc.id, ...doc.data() };
            
            // Filtra solo categorie applicabili ad attrezzi
            if (catData.applicabileA === 'attrezzi' || catData.applicabileA === 'entrambi') {
                if (!catData.parentId) {
                    // Categoria principale
                    categoriePrincipali.push(catData);
                } else {
                    // Sottocategoria
                    if (!sottocategorieMap.has(catData.parentId)) {
                        sottocategorieMap.set(catData.parentId, []);
                    }
                    sottocategorieMap.get(catData.parentId).push(catData);
                }
            }
        });
        
        // Ordina sottocategorie per ordine
        sottocategorieMap.forEach((sottocat, parentId) => {
            sottocat.sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
        });
        
        // Aggiorna state
        updateState({ categoriePrincipali, sottocategorieMap });
        
        // Popola dropdown categoria principale nel form
        const categoriaPrincipaleSelect = document.getElementById('macchina-categoria-principale');
        if (categoriaPrincipaleSelect) {
            categoriaPrincipaleSelect.innerHTML = '<option value="">-- Seleziona categoria principale --</option>';
            categoriePrincipali.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.nome;
                categoriaPrincipaleSelect.appendChild(option);
            });
        }
        
        // Popola dropdown filtro categoria (include anche sottocategorie)
        const filterCategoriaSelect = document.getElementById('filter-categoria');
        if (filterCategoriaSelect) {
            filterCategoriaSelect.innerHTML = '<option value="tutte">Tutte le categorie</option>';
            categoriePrincipali.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.nome;
                filterCategoriaSelect.appendChild(option);
                
                // Aggiungi sottocategorie
                const sottocat = sottocategorieMap.get(cat.id);
                if (sottocat && sottocat.length > 0) {
                    sottocat.forEach(subcat => {
                        const subOption = document.createElement('option');
                        subOption.value = subcat.id;
                        subOption.textContent = `  └ ${subcat.nome}`;
                        filterCategoriaSelect.appendChild(subOption);
                    });
                }
            });
        }
    } catch (error) {
        console.error('Errore caricamento categorie:', error);
    }
}

/**
 * Popola sottocategorie quando cambia categoria principale
 * @param {string} parentId - ID categoria principale
 * @param {string|null} selectedValue - Valore selezionato (opzionale)
 * @param {Object} state - State object con sottocategorieMap
 */
export function populateSottocategorie(parentId, selectedValue, state) {
    const { sottocategorieMap } = state;
    const sottocategoriaSelect = document.getElementById('macchina-sottocategoria');
    const sottocategoriaGroup = document.getElementById('campo-sottocategoria-group');
    
    if (!sottocategoriaSelect || !sottocategoriaGroup) return;
    
    sottocategoriaSelect.innerHTML = '<option value="">-- Nessuna sottocategoria --</option>';
    
    if (!parentId) {
        sottocategoriaGroup.style.display = 'none';
        return;
    }
    
    const sottocat = sottocategorieMap.get(parentId);
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

// ============================================
// FUNZIONI CARICAMENTO MACCHINE
// ============================================

/**
 * Setup listener real-time per macchine (aggiornamento automatico)
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Object} state - State object
 * @param {Function} updateState - Funzione per aggiornare state
 * @param {Function} filterMacchineCallback - Callback per filtrare macchine
 * @param {Function} showAlertCallback - Callback per mostrare alert
 * @returns {Promise<Function>} Funzione unsubscribe
 */
export async function setupMacchineRealtime(tenantId, dependencies, state, updateState, filterMacchineCallback, showAlertCallback) {
    const { collection, query, orderBy, onSnapshot, db } = dependencies;
    
    const container = document.getElementById('macchine-container');
    container.innerHTML = '<div class="loading">Caricamento macchine...</div>';

    try {
        if (!tenantId) {
            container.innerHTML = '<div class="empty-state">Nessun tenant trovato</div>';
            return null;
        }

        // Rimuovi listener precedente se esiste
        if (state.macchineUnsubscribe) {
            state.macchineUnsubscribe();
        }

        const macchineRef = collection(db, `tenants/${tenantId}/macchine`);
        const macchineQuery = query(macchineRef, orderBy('nome'));

        // Setup listener real-time
        const unsubscribe = onSnapshot(
            macchineQuery,
            (snapshot) => {
                const macchine = [];

                snapshot.forEach(doc => {
                    const data = doc.data();
                    macchine.push({
                        id: doc.id,
                        ...data,
                        prossimaManutenzione: data.prossimaManutenzione || null,
                        dataAcquisto: data.dataAcquisto || null
                    });
                });

                // Aggiorna state
                updateState({ macchine, macchineUnsubscribe: unsubscribe });

                // Aggiorna visualizzazione automaticamente
                if (filterMacchineCallback) {
                    filterMacchineCallback();
                }
            },
            (error) => {
                console.error('Errore listener macchine:', error);
                if (showAlertCallback) {
                    showAlertCallback('Errore aggiornamento macchine', 'error');
                }
                container.innerHTML = '<div class="empty-state">Errore caricamento macchine</div>';
            }
        );
        
        return unsubscribe;
    } catch (error) {
        console.error('Errore setup listener macchine:', error);
        if (showAlertCallback) {
            showAlertCallback('Errore caricamento macchine', 'error');
        }
        container.innerHTML = '<div class="empty-state">Errore caricamento macchine</div>';
        return null;
    }
}

/**
 * Carica macchine (funzione legacy mantenuta per compatibilità)
 * @param {Function} setupMacchineRealtimeCallback - Callback per setup real-time
 * @param {Object} state - State object
 * @returns {Promise<void>}
 */
export async function loadMacchine(setupMacchineRealtimeCallback, state) {
    // Usa setupMacchineRealtime se non è già attivo
    if (!state.macchineUnsubscribe && setupMacchineRealtimeCallback) {
        await setupMacchineRealtimeCallback();
    }
    // Se il listener è già attivo, i dati si aggiornano automaticamente
}

// ============================================
// FUNZIONI FILTRI E RENDERING
// ============================================

/**
 * Filtra macchine in base ai filtri selezionati
 * @param {Object} state - State object con macchine, categoriePrincipali, sottocategorieMap
 * @param {Function} renderMacchineCallback - Callback per renderizzare macchine
 */
export function filterMacchine(state, renderMacchineCallback) {
    const { macchine } = state;
    const filterStato = document.getElementById('filter-stato')?.value || 'tutti';
    const filterTipo = document.getElementById('filter-tipo')?.value || 'tutti';
    const filterAttive = document.getElementById('filter-attive')?.value === 'true';
    const filterCategoria = document.getElementById('filter-categoria')?.value || 'tutte';

    let filtered = macchine.filter(macchina => {
        // Filtro stato
        if (filterStato !== 'tutti' && macchina.stato !== filterStato) {
            return false;
        }

        // Filtro tipo (supporta sia tipoMacchina che tipo per retrocompatibilità)
        if (filterTipo !== 'tutti') {
            const tipoMacchina = macchina.tipoMacchina || macchina.tipo;
            if (tipoMacchina !== filterTipo) {
                return false;
            }
        }

        // Filtro categoria (solo per attrezzi)
        if (filterCategoria && filterCategoria !== 'tutte') {
            const tipoMacchina = macchina.tipoMacchina || macchina.tipo;
            // Usa categoriaId se disponibile, altrimenti categoriaFunzione (retrocompatibilità)
            const macchinaCategoriaId = macchina.categoriaId || macchina.categoriaFunzione;
            if (tipoMacchina !== 'attrezzo' || macchinaCategoriaId !== filterCategoria) {
                return false;
            }
        }

        // Filtro solo attive
        if (filterAttive && macchina.stato === 'dismesso') {
            return false;
        }

        return true;
    });

    if (renderMacchineCallback) {
        renderMacchineCallback(filtered);
    }
}

/**
 * Renderizza lista macchine
 * @param {Array} macchineList - Lista macchine da renderizzare
 * @param {Object} state - State object con categoriePrincipali e sottocategorieMap
 * @param {Function} maybeAutoStartMacchineTourCallback - Callback per avviare tour automatico
 */
export function renderMacchine(macchineList, state, maybeAutoStartMacchineTourCallback) {
    const { categoriePrincipali, sottocategorieMap, macchine } = state;
    const container = document.getElementById('macchine-container');
    const countElement = document.getElementById('macchine-count');
    
    if (countElement) {
        countElement.textContent = `${macchineList.length} macchine`;
    }

    if (macchineList.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚜</div><p>Nessuna macchina trovata</p></div>';
        if (maybeAutoStartMacchineTourCallback) {
            maybeAutoStartMacchineTourCallback();
        }
        return;
    }

    // Funzione helper per ottenere nome categoria (cerca in principali e sottocategorie)
    function getNomeCategoria(categoriaId) {
        if (!categoriaId) return '-';
        
        // Cerca in categorie principali
        const categoriaPrincipale = categoriePrincipali.find(c => c.id === categoriaId);
        if (categoriaPrincipale) return categoriaPrincipale.nome;
        
        // Cerca in sottocategorie
        for (const [parentId, sottocat] of sottocategorieMap.entries()) {
            const sottocategoria = sottocat.find(c => c.id === categoriaId);
            if (sottocategoria) {
                const parent = categoriePrincipali.find(c => c.id === parentId);
                return parent ? `${parent.nome} - ${sottocategoria.nome}` : sottocategoria.nome;
            }
        }
        
        return '-';
    }
    
    // Funzione helper per verificare compatibilità attrezzo con trattori disponibili
    function getTrattoriCompatibili(attrezzo) {
        if (!attrezzo.cavalliMinimiRichiesti) return [];
        return macchine.filter(m => {
            const tipoMacchina = m.tipoMacchina || m.tipo;
            return tipoMacchina === 'trattore' && m.cavalli && m.cavalli >= attrezzo.cavalliMinimiRichiesti && m.stato !== 'dismesso';
        });
    }

    const statoNames = {
        'disponibile': '✅ Disponibile',
        'in_uso': '🔄 In uso',
        'in_manutenzione': '🔧 In manutenzione',
        'guasto': '❌ Guasto',
        'dismesso': '🗑️ Dismesso'
    };

    let html = `
        <table class="macchine-table">
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Marca/Modello</th>
                    <th>Dettagli</th>
                    <th>Stato</th>
                    <th>Ore</th>
                    <th>Prossima Manutenzione</th>
                    <th>Azioni</th>
                </tr>
            </thead>
            <tbody>
    `;

    macchineList.forEach(macchina => {
        const tipoMacchina = macchina.tipoMacchina || macchina.tipo || '';
        const oreUtilizzate = macchina.oreAttuali && macchina.oreIniziali 
            ? (macchina.oreAttuali - macchina.oreIniziali).toFixed(1) 
            : '-';
        const oreAttuali = macchina.oreAttuali !== null && macchina.oreAttuali !== undefined 
            ? macchina.oreAttuali.toFixed(1) 
            : '-';
        
        const manutenzioneScaduta = isManutenzioneScaduta(macchina);
        const manutenzioneInScadenza = isManutenzioneInScadenza(macchina);
        
        let manutenzioneBadge = '';
        if (manutenzioneScaduta) {
            manutenzioneBadge = '<span class="badge badge-danger">⚠️ Scaduta</span>';
        } else if (manutenzioneInScadenza) {
            manutenzioneBadge = '<span class="badge badge-warning">⏰ In scadenza</span>';
        }

        const marcaModello = [macchina.marca, macchina.modello].filter(Boolean).join(' ') || '-';
        
        // Dettagli specifici per tipo
        let dettagliHTML = '';
        if (tipoMacchina === 'trattore') {
            dettagliHTML = macchina.cavalli ? `<strong>${macchina.cavalli} CV</strong>` : '-';
        } else if (tipoMacchina === 'attrezzo') {
            // Usa categoriaId se disponibile, altrimenti categoriaFunzione (retrocompatibilità)
            const macchinaCategoriaId = macchina.categoriaId || macchina.categoriaFunzione;
            const categoriaNome = getNomeCategoria(macchinaCategoriaId);
            const trattoriCompatibili = getTrattoriCompatibili(macchina);
            dettagliHTML = `
                <div><strong>Categoria:</strong> ${escapeHtml(categoriaNome)}</div>
                <div><strong>CV min:</strong> ${macchina.cavalliMinimiRichiesti || '-'}</div>
                ${trattoriCompatibili.length > 0 
                    ? `<div><small style="color: #28a745;">✅ ${trattoriCompatibili.length} trattore/i compatibile/i</small></div>`
                    : `<div><small style="color: #dc3545;">⚠️ Nessun trattore compatibile</small></div>`
                }
            `;
        }
        
        const tipoIcon = tipoMacchina === 'trattore' ? '🚜' : tipoMacchina === 'attrezzo' ? '⚙️' : '';
        const tipoLabel = tipoMacchina === 'trattore' ? 'Trattore' : tipoMacchina === 'attrezzo' ? 'Attrezzo' : tipoMacchina || '-';
        
        html += `
            <tr>
                <td><strong>${escapeHtml(macchina.nome || '-')}</strong></td>
                <td>${tipoIcon} ${escapeHtml(tipoLabel)}</td>
                <td>${escapeHtml(marcaModello)}</td>
                <td>${dettagliHTML}</td>
                <td>${statoNames[macchina.stato] || escapeHtml(macchina.stato || '-')}</td>
                <td>
                    ${oreAttuali} ore
                    ${oreUtilizzate !== '-' ? `<br><small style="color: #666;">(${oreUtilizzate} utilizzate)</small>` : ''}
                </td>
                <td>
                    ${macchina.prossimaManutenzione ? formattaData(macchina.prossimaManutenzione) : '-'}
                    ${macchina.oreProssimaManutenzione ? `<br><small style="color: #666;">${macchina.oreProssimaManutenzione} ore</small>` : ''}
                    ${manutenzioneBadge}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-info btn-sm" onclick="openMacchinaModal('${macchina.id}')">✏️ Modifica</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteMacchina('${macchina.id}')">🗑️ Elimina</button>
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
    if (maybeAutoStartMacchineTourCallback) {
        maybeAutoStartMacchineTourCallback();
    }
}


/**
 * Gestione Lavori Events - Event handlers per modal e form
 * 
 * @module core/admin/js/gestione-lavori-events
 */

// ============================================
// IMPORTS
// ============================================
import { showAlert } from './gestione-lavori-utils.js';

// ============================================
// FUNZIONI SETUP HANDLERS
// ============================================

/**
 * Setup handler per tipo assegnazione (squadra/autonomo)
 * @param {boolean} hasManodoperaModule - Se il modulo Manodopera è attivo
 */
export function setupTipoAssegnazioneHandlers(hasManodoperaModule) {
    // Se Manodopera non è attivo, non fare nulla (i campi sono già nascosti)
    if (!hasManodoperaModule) {
        const caposquadraSelect = document.getElementById('lavoro-caposquadra');
        const operaioSelect = document.getElementById('lavoro-operaio');
        if (caposquadraSelect) caposquadraSelect.required = false;
        if (operaioSelect) operaioSelect.required = false;
        return;
    }
    
    const tipoSquadra = document.getElementById('tipo-squadra');
    const tipoAutonomo = document.getElementById('tipo-autonomo');
    const caposquadraGroup = document.getElementById('caposquadra-group');
    const operaioGroup = document.getElementById('operaio-group');
    const caposquadraSelect = document.getElementById('lavoro-caposquadra');
    const operaioSelect = document.getElementById('lavoro-operaio');

    if (!tipoSquadra || !tipoAutonomo || !caposquadraGroup || !operaioGroup) {
        return;
    }

    // Usa event delegation sul form invece di listener diretti
    // Questo evita problemi quando i radio button vengono clonati o modificati
    const lavoroForm = document.getElementById('lavoro-form');
    if (!lavoroForm) {
        return;
    }
    
    function updateVisibility() {
        // Riacquista i riferimenti ogni volta per essere sicuri
        const currentTipoSquadra = document.getElementById('tipo-squadra');
        const currentTipoAutonomo = document.getElementById('tipo-autonomo');
        
        if (!currentTipoSquadra || !currentTipoAutonomo) {
            return;
        }
        
        if (currentTipoSquadra.checked) {
            caposquadraGroup.style.display = 'block';
            operaioGroup.style.display = 'none';
            if (caposquadraSelect) {
                caposquadraSelect.required = true;
            }
            if (operaioSelect) {
                operaioSelect.required = false;
                operaioSelect.value = '';
            }
        } else if (currentTipoAutonomo.checked) {
            caposquadraGroup.style.display = 'none';
            operaioGroup.style.display = 'block';
            if (caposquadraSelect) {
                caposquadraSelect.required = false;
                caposquadraSelect.value = '';
            }
            if (operaioSelect) {
                operaioSelect.required = true;
            }
        }
    }

    // Usa event delegation sul form per intercettare i cambiamenti ai radio button
    // Questo funziona anche se i radio button vengono clonati o modificati
    if (lavoroForm.dataset.tipoAssegnazioneHandlersSetup !== 'true') {
        lavoroForm.addEventListener('change', function(e) {
            if (e.target && e.target.name === 'tipo-assegnazione') {
                updateVisibility();
            }
        });
        lavoroForm.dataset.tipoAssegnazioneHandlersSetup = 'true';
    }
    
    // Inizializza visibilità
    updateVisibility();
}

/**
 * Setup handler per cambio categoria lavoro
 * @param {Function} populateSottocategorieLavoroCallback - Callback per popolare sottocategorie
 * @param {Function} loadTipiLavoroCallback - Callback per caricare tipi lavoro
 */
export function setupCategoriaLavoroHandler(populateSottocategorieLavoroCallback, loadTipiLavoroCallback) {
    const categoriaPrincipaleSelect = document.getElementById('lavoro-categoria-principale');
    const sottocategoriaSelect = document.getElementById('lavoro-sottocategoria');
    
    if (categoriaPrincipaleSelect) {
        categoriaPrincipaleSelect.addEventListener('change', function() {
            const categoriaPrincipaleId = this.value;
            if (categoriaPrincipaleId) {
                if (populateSottocategorieLavoroCallback) populateSottocategorieLavoroCallback(categoriaPrincipaleId);
                if (loadTipiLavoroCallback) loadTipiLavoroCallback(categoriaPrincipaleId);
            } else {
                const sottocategoriaGroup = document.getElementById('lavoro-sottocategoria-group');
                const tipoLavoroGroup = document.getElementById('tipo-lavoro-group');
                const tipoLavoroSelect = document.getElementById('lavoro-tipo-lavoro');
                if (sottocategoriaGroup) sottocategoriaGroup.style.display = 'none';
                if (tipoLavoroGroup) tipoLavoroGroup.style.display = 'none';
                if (tipoLavoroSelect) tipoLavoroSelect.value = '';
            }
        });
    }
    
    if (sottocategoriaSelect) {
        sottocategoriaSelect.addEventListener('change', function() {
            const sottocategoriaId = this.value;
            const categoriaPrincipaleId = document.getElementById('lavoro-categoria-principale')?.value;
            
            // Usa sottocategoria se selezionata, altrimenti categoria principale
            const categoriaId = sottocategoriaId || categoriaPrincipaleId;
            if (categoriaId && loadTipiLavoroCallback) {
                loadTipiLavoroCallback(categoriaId);
            }
        });
    }
}

/**
 * Setup handler per macchine (trattore, attrezzo, operatore)
 * @param {Function} populateAttrezziDropdownCallback - Callback per popolare dropdown attrezzi
 * @param {Function} populateOperatoreMacchinaDropdownCallback - Callback per popolare dropdown operatore macchina
 */
export function setupMacchineHandlers(
    populateAttrezziDropdownCallback,
    populateOperatoreMacchinaDropdownCallback
) {
    const trattoreSelect = document.getElementById('lavoro-trattore');
    const attrezzoSelect = document.getElementById('lavoro-attrezzo');
    const operaioSelect = document.getElementById('lavoro-operaio');
    const tipoAssegnazioneRadios = document.querySelectorAll('input[name="tipo-assegnazione"]');
    const attrezzoGroup = document.getElementById('attrezzo-group');
    const operatoreMacchinaGroup = document.getElementById('operatore-macchina-group');
    
    if (trattoreSelect) {
        // Rimuovi listener esistenti per evitare duplicati
        const newTrattoreSelect = trattoreSelect.cloneNode(true);
        trattoreSelect.parentNode.replaceChild(newTrattoreSelect, trattoreSelect);
        
        const handleTrattoreChange = function() {
            const trattoreId = this.value;
            
            // Popola dropdown attrezzi compatibili
            if (populateAttrezziDropdownCallback && trattoreId) {
                populateAttrezziDropdownCallback(trattoreId);
            }
            
            // Mostra/nascondi gruppo attrezzo
            if (attrezzoGroup) {
                if (trattoreId) {
                    attrezzoGroup.style.display = 'block';
                } else {
                    attrezzoGroup.style.display = 'none';
                    if (attrezzoSelect) attrezzoSelect.value = '';
                }
            }
            
            // Mostra/nascondi gruppo operatore macchina
            if (operatoreMacchinaGroup) {
                if (trattoreId || (attrezzoSelect && attrezzoSelect.value)) {
                    operatoreMacchinaGroup.style.display = 'block';
                } else {
                    operatoreMacchinaGroup.style.display = 'none';
                }
            }
            
            // Aggiorna dropdown operatore macchina
            if (populateOperatoreMacchinaDropdownCallback) {
                populateOperatoreMacchinaDropdownCallback();
            }
        };
        
        newTrattoreSelect.addEventListener('change', handleTrattoreChange);
        
        // Se c'è già un trattore selezionato (ad esempio quando si modifica un lavoro esistente),
        // popola gli attrezzi immediatamente
        if (newTrattoreSelect.value) {
            // Usa setTimeout per assicurarsi che il DOM sia completamente pronto
            setTimeout(() => {
                handleTrattoreChange.call(newTrattoreSelect);
            }, 100);
        }
    }
    
    if (attrezzoSelect) {
        // Rimuovi listener esistenti per evitare duplicati
        const newAttrezzoSelect = attrezzoSelect.cloneNode(true);
        attrezzoSelect.parentNode.replaceChild(newAttrezzoSelect, attrezzoSelect);
        
        newAttrezzoSelect.addEventListener('change', function() {
            // Mostra/nascondi gruppo operatore macchina
            if (operatoreMacchinaGroup) {
                const trattoreId = document.getElementById('lavoro-trattore')?.value;
                if (trattoreId || this.value) {
                    operatoreMacchinaGroup.style.display = 'block';
                } else {
                    operatoreMacchinaGroup.style.display = 'none';
                }
            }
            
            // Aggiorna dropdown operatore macchina
            if (populateOperatoreMacchinaDropdownCallback) {
                populateOperatoreMacchinaDropdownCallback();
            }
        });
    }
    
    // Aggiorna operatore macchina quando cambia l'operaio responsabile
    if (operaioSelect) {
        // Rimuovi listener esistenti per evitare duplicati
        const newOperaioSelect = operaioSelect.cloneNode(true);
        operaioSelect.parentNode.replaceChild(newOperaioSelect, operaioSelect);
        
        newOperaioSelect.addEventListener('change', function() {
            if (populateOperatoreMacchinaDropdownCallback) {
                populateOperatoreMacchinaDropdownCallback();
            }
        });
    }
    
    // Aggiorna operatore macchina quando cambia tipo assegnazione
    tipoAssegnazioneRadios.forEach(radio => {
        // Rimuovi listener esistenti per evitare duplicati
        const newRadio = radio.cloneNode(true);
        radio.parentNode.replaceChild(newRadio, radio);
        
        newRadio.addEventListener('change', function() {
            // Aspetta che setupTipoAssegnazioneHandlers aggiorni i dropdown
            setTimeout(() => {
                if (populateOperatoreMacchinaDropdownCallback) {
                    populateOperatoreMacchinaDropdownCallback();
                }
            }, 100);
        });
    });
}

// ============================================
// FUNZIONI FILTRI
// ============================================

/**
 * Applica filtri alla lista lavori
 * @param {Array} lavoriList - Array lavori completo
 * @param {Array} filteredLavoriList - Array lavori filtrati (modificato in place)
 * @param {boolean} hasManodoperaModule - Se il modulo Manodopera è attivo
 * @param {Function} renderLavoriCallback - Callback per renderizzare lavori
 */
export function applyFilters(lavoriList, filteredLavoriList, hasManodoperaModule, renderLavoriCallback) {
    const statoFilter = document.getElementById('filter-stato')?.value || '';
    const caposquadraFilterEl = document.getElementById('filter-caposquadra');
    const caposquadraFilter = caposquadraFilterEl ? caposquadraFilterEl.value : '';
    const terrenoFilter = document.getElementById('filter-terreno')?.value || '';
    const tipoFilter = document.getElementById('filter-tipo')?.value || '';

    filteredLavoriList.length = 0; // Pulisci array
    lavoriList.forEach(lavoro => {
        if (statoFilter && lavoro.stato !== statoFilter) return;
        // Filtro caposquadra solo se Manodopera attivo e filtro selezionato
        if (hasManodoperaModule && caposquadraFilter && lavoro.caposquadraId !== caposquadraFilter) return;
        if (terrenoFilter && lavoro.terrenoId !== terrenoFilter) return;
        if (tipoFilter === 'conto_terzi' && !lavoro.clienteId) return;
        if (tipoFilter === 'interno' && lavoro.clienteId) return;
        filteredLavoriList.push(lavoro);
    });

    // Il filtro stato progresso viene applicato in renderLavori dopo il calcolo
    if (renderLavoriCallback) renderLavoriCallback();
}

/**
 * Pulisci filtri e mostra tutti i lavori
 * @param {Array} lavoriList - Array lavori completo
 * @param {Array} filteredLavoriList - Array lavori filtrati (modificato in place)
 * @param {boolean} hasManodoperaModule - Se il modulo Manodopera è attivo
 * @param {Function} applyFiltersCallback - Callback per applicare filtri
 */
export function clearFilters(lavoriList, filteredLavoriList, hasManodoperaModule, applyFiltersCallback) {
    const filterStato = document.getElementById('filter-stato');
    const filterProgresso = document.getElementById('filter-progresso');
    const filterCaposquadra = document.getElementById('filter-caposquadra');
    const filterTerreno = document.getElementById('filter-terreno');
    const filterTipo = document.getElementById('filter-tipo');
    
    if (filterStato) filterStato.value = '';
    if (filterProgresso) filterProgresso.value = '';
    if (filterCaposquadra) filterCaposquadra.value = '';
    if (filterTerreno) filterTerreno.value = '';
    if (filterTipo) filterTipo.value = '';
    
    if (applyFiltersCallback) applyFiltersCallback();
}

// ============================================
// FUNZIONI MODAL LAVORO
// ============================================

/**
 * Apre modal per creare nuovo lavoro
 * @param {Object} state - State object con { currentLavoroId }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {boolean} hasManodoperaModule - Se il modulo Manodopera è attivo
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 * @param {Function} loadCategorieLavoriCallback - Callback per caricare categorie
 * @param {Function} loadTipiLavoroCallback - Callback per caricare tipi lavoro
 * @param {Function} populateTerrenoDropdownCallback - Callback per popolare dropdown terreni
 * @param {Function} populateCategoriaLavoroDropdownCallback - Callback per popolare dropdown categorie
 * @param {Function} populateCaposquadraDropdownCallback - Callback per popolare dropdown caposquadra
 * @param {Function} populateOperaiDropdownCallback - Callback per popolare dropdown operai
 * @param {Function} populateTrattoriDropdownCallback - Callback per popolare dropdown trattori
 * @param {Function} setupTipoAssegnazioneHandlersCallback - Callback per setup tipo assegnazione
 */
export async function openCreaModal(
    state,
    updateState,
    hasManodoperaModule,
    hasParcoMacchineModule,
    loadCategorieLavoriCallback,
    loadTipiLavoroCallback,
    populateTerrenoDropdownCallback,
    populateCategoriaLavoroDropdownCallback,
    populateCaposquadraDropdownCallback,
    populateOperaiDropdownCallback,
    populateTrattoriDropdownCallback,
    setupTipoAssegnazioneHandlersCallback,
    populateAttrezziDropdownCallback,
    populateOperatoreMacchinaDropdownCallback,
    setupMacchineHandlersCallback
) {
    updateState({ currentLavoroId: null });
    const modalTitle = document.getElementById('modal-title');
    const lavoroForm = document.getElementById('lavoro-form');
    const lavoroIdInput = document.getElementById('lavoro-id');
    const lavoroStatoSelect = document.getElementById('lavoro-stato');
    
    if (modalTitle) modalTitle.textContent = 'Crea Nuovo Lavoro';
    if (lavoroForm) lavoroForm.reset();
    if (lavoroIdInput) lavoroIdInput.value = '';
    if (lavoroStatoSelect) lavoroStatoSelect.value = hasManodoperaModule ? 'assegnato' : 'in_corso';
    
    // Assicura che categorie e tipi lavoro siano caricati
    if (loadCategorieLavoriCallback) await loadCategorieLavoriCallback();
    if (loadTipiLavoroCallback) await loadTipiLavoroCallback();
    
    if (populateTerrenoDropdownCallback) populateTerrenoDropdownCallback();
    if (populateCategoriaLavoroDropdownCallback) populateCategoriaLavoroDropdownCallback();
    
    const sottocategoriaGroup = document.getElementById('lavoro-sottocategoria-group');
    const tipoLavoroGroup = document.getElementById('tipo-lavoro-group');
    const tipoLavoroSelect = document.getElementById('lavoro-tipo-lavoro');
    if (sottocategoriaGroup) sottocategoriaGroup.style.display = 'none';
    if (tipoLavoroGroup) tipoLavoroGroup.style.display = 'none';
    if (tipoLavoroSelect) tipoLavoroSelect.value = '';
    
    // Popola dropdown Manodopera solo se modulo attivo
    if (hasManodoperaModule) {
        if (populateCaposquadraDropdownCallback) {
            populateCaposquadraDropdownCallback();
        }
        if (populateOperaiDropdownCallback) {
            populateOperaiDropdownCallback();
        }
        // Imposta tipo assegnazione default a "squadra"
        const tipoSquadra = document.getElementById('tipo-squadra');
        const tipoAutonomo = document.getElementById('tipo-autonomo');
        if (tipoSquadra) tipoSquadra.checked = true;
        if (tipoAutonomo) tipoAutonomo.checked = false;
    }
    
    // Reset e popola campi macchine se modulo Parco Macchine attivo
    if (hasParcoMacchineModule) {
        if (populateTrattoriDropdownCallback) {
            populateTrattoriDropdownCallback();
        }
        const lavoroTrattore = document.getElementById('lavoro-trattore');
        const lavoroAttrezzo = document.getElementById('lavoro-attrezzo');
        const lavoroOperatoreMacchina = document.getElementById('lavoro-operatore-macchina');
        const attrezzoGroup = document.getElementById('attrezzo-group');
        const operatoreMacchinaGroup = document.getElementById('operatore-macchina-group');
        if (lavoroTrattore) lavoroTrattore.value = '';
        if (lavoroAttrezzo) lavoroAttrezzo.value = '';
        if (lavoroOperatoreMacchina) lavoroOperatoreMacchina.value = '';
        if (attrezzoGroup) attrezzoGroup.style.display = 'none';
        if (operatoreMacchinaGroup) operatoreMacchinaGroup.style.display = 'none';
        
        // Setup handler per macchine (deve essere chiamato dopo aver popolato i dropdown)
        if (setupMacchineHandlersCallback) {
            setupMacchineHandlersCallback(
                populateAttrezziDropdownCallback,
                populateOperatoreMacchinaDropdownCallback
            );
        }
        
        // NOTA: Non popoliamo gli attrezzi qui perché il trattore è stato appena resettato a ''
        // Gli attrezzi verranno popolati quando l'utente seleziona un trattore
    }
    
    // Aggiorna visibilità dropdown (solo se Manodopera attivo)
    if (hasManodoperaModule && setupTipoAssegnazioneHandlersCallback) {
        setupTipoAssegnazioneHandlersCallback();
    }
    
    const lavoroModal = document.getElementById('lavoro-modal');
    if (lavoroModal) lavoroModal.classList.add('active');
}

/**
 * Chiude modal lavoro
 * @param {Object} state - State object con { currentLavoroId }
 * @param {Function} updateState - Funzione per aggiornare lo state
 */
export function closeLavoroModal(state, updateState) {
    const lavoroModal = document.getElementById('lavoro-modal');
    if (lavoroModal) lavoroModal.classList.remove('active');
    updateState({ currentLavoroId: null });
}

/**
 * Cambia tab nel modal dettaglio
 * @param {string} tabName - Nome tab da attivare
 * @param {Object} state - State object con { currentLavoroId }
 * @param {Function} loadDettaglioOverviewCallback - Callback per caricare overview
 * @param {Function} loadDettaglioMapCallback - Callback per caricare mappa
 * @param {Function} loadDettaglioOreCallback - Callback per caricare ore (opzionale)
 */
export async function switchTab(
    tabName,
    state,
    loadDettaglioOverviewCallback,
    loadDettaglioMapCallback,
    loadDettaglioOreCallback
) {
    // Aggiorna tab attivi
    document.querySelectorAll('.modal-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        // Assicurati che i tab non attivi siano nascosti
        if (!content.classList.contains('active')) {
            content.style.display = 'none';
        }
    });
    
    const tabButton = document.querySelector(`[onclick*="switchTab('${tabName}')"]`);
    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabButton) tabButton.classList.add('active');
    if (tabContent) {
        tabContent.classList.add('active');
        tabContent.style.display = 'block';
    }
    
    // Carica contenuto del tab se necessario
    if (tabName === 'map' && state.currentLavoroId && loadDettaglioMapCallback) {
        await loadDettaglioMapCallback(state.currentLavoroId);
    } else if (tabName === 'ore' && state.currentLavoroId && loadDettaglioOreCallback) {
        await loadDettaglioOreCallback(state.currentLavoroId);
    } else if (tabName === 'overview' && state.currentLavoroId && loadDettaglioOverviewCallback) {
        // Pulisci completamente il container della Panoramica prima di ricaricare
        const overviewContainer = document.getElementById('dettaglio-overview-content');
        if (overviewContainer) {
            overviewContainer.innerHTML = '';
        }
        await loadDettaglioOverviewCallback(state.currentLavoroId);
    }
}

/**
 * Apri modal dettaglio lavoro
 * @param {string} lavoroId - ID lavoro
 * @param {Object} state - State object con { currentLavoroId }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Array} lavoriList - Array lavori
 * @param {Function} loadDettaglioOverviewCallback - Callback per caricare overview
 * @param {Function} switchTabCallback - Callback per cambiare tab
 */
export async function openDettaglioModal(
    lavoroId,
    state,
    updateState,
    lavoriList,
    loadDettaglioOverviewCallback,
    switchTabCallback
) {
    const lavoro = lavoriList.find(l => l.id === lavoroId);
    if (!lavoro) {
        showAlert('Lavoro non trovato', 'error');
        return;
    }

    updateState({ currentLavoroId: lavoroId });
    const dettaglioTitle = document.getElementById('dettaglio-title');
    const dettaglioModal = document.getElementById('dettaglio-modal');
    
    if (dettaglioTitle) dettaglioTitle.textContent = `Dettaglio: ${lavoro.nome}`;
    if (dettaglioModal) dettaglioModal.classList.add('active');
    
    // Reset tabs - switchTabCallback già chiama loadDettaglioOverviewCallback
    if (switchTabCallback) await switchTabCallback('overview');
}

/**
 * Chiudi modal dettaglio
 * @param {Object} state - State object con { dettaglioMap, dettaglioMapMarkers, dettaglioMapPolygons, currentLavoroId }
 * @param {Function} updateState - Funzione per aggiornare lo state
 */
export function closeDettaglioModal(state, updateState) {
    const dettaglioModal = document.getElementById('dettaglio-modal');
    if (dettaglioModal) dettaglioModal.classList.remove('active');
    
    // Pulisci mappa
    if (state.dettaglioMapMarkers) {
        state.dettaglioMapMarkers.forEach(m => m.setMap(null));
    }
    if (state.dettaglioMapPolygons) {
        state.dettaglioMapPolygons.forEach(p => p.setMap(null));
    }
    
    updateState({ 
        currentLavoroId: null,
        dettaglioMapMarkers: [],
        dettaglioMapPolygons: []
    });
}

/**
 * Apri modal modifica lavoro
 * @param {string} lavoroId - ID lavoro da modificare
 * @param {Object} state - State object con { currentLavoroId }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Array} lavoriList - Array lavori
 * @param {Array} tipiLavoroList - Array tipi lavoro
 * @param {boolean} hasManodoperaModule - Se il modulo Manodopera è attivo
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 * @param {Function} populateTerrenoDropdownCallback - Callback per popolare dropdown terreni
 * @param {Function} populateCategoriaLavoroDropdownCallback - Callback per popolare dropdown categorie
 * @param {Function} populateTipoLavoroDropdownCallback - Callback per popolare dropdown tipi lavoro
 * @param {Function} populateCaposquadraDropdownCallback - Callback per popolare dropdown caposquadra
 * @param {Function} populateOperaiDropdownCallback - Callback per popolare dropdown operai
 * @param {Function} populateTrattoriDropdownCallback - Callback per popolare dropdown trattori
 * @param {Function} populateAttrezziDropdownCallback - Callback per popolare dropdown attrezzi
 * @param {Function} populateOperatoreMacchinaDropdownCallback - Callback per popolare dropdown operatore macchina
 * @param {Function} loadTipiLavoroCallback - Callback per caricare tipi lavoro
 * @param {Function} setupTipoAssegnazioneHandlersCallback - Callback per setup tipo assegnazione
 */
export async function openModificaModal(
    lavoroId,
    state,
    updateState,
    lavoriList,
    tipiLavoroList,
    hasManodoperaModule,
    hasParcoMacchineModule,
    populateTerrenoDropdownCallback,
    populateCategoriaLavoroDropdownCallback,
    populateTipoLavoroDropdownCallback,
    populateCaposquadraDropdownCallback,
    populateOperaiDropdownCallback,
    populateTrattoriDropdownCallback,
    populateAttrezziDropdownCallback,
    populateOperatoreMacchinaDropdownCallback,
    loadTipiLavoroCallback,
    setupTipoAssegnazioneHandlersCallback,
    setupMacchineHandlersCallback
) {
    updateState({ currentLavoroId: lavoroId });
    const lavoro = lavoriList.find(l => l.id === lavoroId);
    
    if (!lavoro) {
        showAlert('Lavoro non trovato', 'error');
        return;
    }

    const modalTitle = document.getElementById('modal-title');
    const lavoroIdInput = document.getElementById('lavoro-id');
    const lavoroNomeInput = document.getElementById('lavoro-nome');
    const lavoroNoteInput = document.getElementById('lavoro-note');
    const lavoroStatoSelect = document.getElementById('lavoro-stato');
    const lavoroDurataInput = document.getElementById('lavoro-durata');
    const lavoroDataInizioInput = document.getElementById('lavoro-data-inizio');
    
    if (modalTitle) modalTitle.textContent = 'Modifica Lavoro';
    if (lavoroIdInput) lavoroIdInput.value = lavoroId;
    if (lavoroNomeInput) lavoroNomeInput.value = lavoro.nome || '';
    if (lavoroNoteInput) lavoroNoteInput.value = lavoro.note || '';
    if (lavoroStatoSelect) lavoroStatoSelect.value = lavoro.stato || 'assegnato';
    if (lavoroDurataInput) lavoroDurataInput.value = lavoro.durataPrevista || '';
    
    // Formatta data per input date
    if (lavoro.dataInizio && lavoroDataInizioInput) {
        const dataInizio = lavoro.dataInizio instanceof Date 
            ? lavoro.dataInizio 
            : new Date(lavoro.dataInizio);
        lavoroDataInizioInput.value = dataInizio.toISOString().split('T')[0];
    }
    
    // Determina tipo assegnazione in base ai dati del lavoro (solo se Manodopera attivo)
    if (hasManodoperaModule) {
        const tipoAutonomo = document.getElementById('tipo-autonomo');
        const tipoSquadra = document.getElementById('tipo-squadra');
        if (lavoro.operaioId && !lavoro.caposquadraId) {
            // Lavoro autonomo
            if (tipoAutonomo) tipoAutonomo.checked = true;
            if (tipoSquadra) tipoSquadra.checked = false;
        } else {
            // Lavoro di squadra (default o se caposquadraId presente)
            if (tipoSquadra) tipoSquadra.checked = true;
            if (tipoAutonomo) tipoAutonomo.checked = false;
        }
        
        if (populateCaposquadraDropdownCallback) populateCaposquadraDropdownCallback(lavoro.caposquadraId || null);
        if (populateOperaiDropdownCallback) populateOperaiDropdownCallback(lavoro.operaioId || null);
    }
    
    if (populateTerrenoDropdownCallback) populateTerrenoDropdownCallback(lavoro.terrenoId);
    
    // Popola categoria e tipo lavoro (se struttura gerarchica disponibile)
    if (lavoro.tipoLavoro) {
        // Cerca il tipo lavoro per nome per ottenere categoriaId
        const tipoLavoroObj = tipiLavoroList.find(t => t.nome === lavoro.tipoLavoro);
        if (tipoLavoroObj && tipoLavoroObj.categoriaId) {
            if (populateCategoriaLavoroDropdownCallback) populateCategoriaLavoroDropdownCallback(tipoLavoroObj.categoriaId);
            // Carica tipi lavoro per quella categoria e poi seleziona
            if (loadTipiLavoroCallback) {
                await loadTipiLavoroCallback(tipoLavoroObj.categoriaId);
            }
            if (populateTipoLavoroDropdownCallback) populateTipoLavoroDropdownCallback(tipoLavoroObj.categoriaId, lavoro.tipoLavoro);
        } else {
            // Fallback: usa lista piatta se tipo non trovato nella struttura gerarchica
            if (populateCategoriaLavoroDropdownCallback) populateCategoriaLavoroDropdownCallback();
            if (populateTipoLavoroDropdownCallback) populateTipoLavoroDropdownCallback(null, lavoro.tipoLavoro);
        }
    } else {
        if (populateCategoriaLavoroDropdownCallback) populateCategoriaLavoroDropdownCallback();
        if (populateTipoLavoroDropdownCallback) populateTipoLavoroDropdownCallback();
    }
    
    // Popola campi macchine se modulo Parco Macchine attivo
    if (hasParcoMacchineModule) {
        if (populateTrattoriDropdownCallback) populateTrattoriDropdownCallback();
        const macchinaId = lavoro.macchinaId || null;
        const attrezzoId = lavoro.attrezzoId || null;
        const operatoreMacchinaId = lavoro.operatoreMacchinaId || null;
        
        const lavoroTrattore = document.getElementById('lavoro-trattore');
        const lavoroAttrezzo = document.getElementById('lavoro-attrezzo');
        const lavoroOperatoreMacchina = document.getElementById('lavoro-operatore-macchina');
        
        if (macchinaId && lavoroTrattore) {
            lavoroTrattore.value = macchinaId;
            if (populateAttrezziDropdownCallback) populateAttrezziDropdownCallback(macchinaId);
        }
        
        if (attrezzoId && lavoroAttrezzo) {
            lavoroAttrezzo.value = attrezzoId;
        }
        
        if (operatoreMacchinaId && lavoroOperatoreMacchina) {
            lavoroOperatoreMacchina.value = operatoreMacchinaId;
        }
        
        if (populateOperatoreMacchinaDropdownCallback) populateOperatoreMacchinaDropdownCallback();
    }
    
    // Aggiorna visibilità dropdown
    if (setupTipoAssegnazioneHandlersCallback) setupTipoAssegnazioneHandlersCallback();
    
    const lavoroModal = document.getElementById('lavoro-modal');
    if (lavoroModal) lavoroModal.classList.add('active');
}

/**
 * Apri modal elimina lavoro
 * @param {string} lavoroId - ID lavoro da eliminare
 * @param {Array} lavoriList - Array lavori
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 * @param {Function} updateMacchinaStatoCallback - Callback per aggiornare stato macchina
 * @param {Function} loadTrattoriCallback - Callback per ricaricare trattori
 * @param {Function} loadAttrezziCallback - Callback per ricaricare attrezzi
 * @param {Function} loadLavoriCallback - Callback per ricaricare lavori
 */
export async function openEliminaModal(
    lavoroId,
    lavoriList,
    currentTenantId,
    db,
    hasParcoMacchineModule,
    updateMacchinaStatoCallback,
    loadTrattoriCallback,
    loadAttrezziCallback,
    loadLavoriCallback
) {
    const lavoro = lavoriList.find(l => l.id === lavoroId);
    
    if (!lavoro) {
        showAlert('Lavoro non trovato', 'error');
        return;
    }
    
    if (confirm(`Sei sicuro di voler eliminare il lavoro "${lavoro.nome}"?\n\nQuesta azione non può essere annullata.`)) {
        try {
            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            // Libera macchine se assegnate (solo se modulo Parco Macchine attivo)
            if (hasParcoMacchineModule && updateMacchinaStatoCallback) {
                if (lavoro.macchinaId) {
                    await updateMacchinaStatoCallback(lavoro.macchinaId, 'disponibile');
                }
                if (lavoro.attrezzoId) {
                    await updateMacchinaStatoCallback(lavoro.attrezzoId, 'disponibile');
                }
            }
            
            await deleteDoc(doc(db, 'tenants', currentTenantId, 'lavori', lavoroId));
            showAlert('Lavoro eliminato con successo!', 'success');
            
            // Ricarica macchine per aggiornare stati
            if (hasParcoMacchineModule) {
                if (loadTrattoriCallback) await loadTrattoriCallback();
                if (loadAttrezziCallback) await loadAttrezziCallback();
            }
            
            if (loadLavoriCallback) await loadLavoriCallback();
        } catch (error) {
            console.error('Errore eliminazione lavoro:', error);
            showAlert(`Errore: ${error.message}`, 'error');
        }
    }
}

/**
 * Approva lavoro completato dal caposquadra
 * @param {string} lavoroId - ID lavoro da approvare
 * @param {Array} lavoriList - Array lavori
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} currentUserData - Dati utente corrente
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 * @param {boolean} hasContoTerziModule - Se il modulo Conto Terzi è attivo
 * @param {Function} updateMacchinaStatoCallback - Callback per aggiornare stato macchina
 * @param {Function} loadTrattoriCallback - Callback per ricaricare trattori
 * @param {Function} loadAttrezziCallback - Callback per ricaricare attrezzi
 * @param {Function} loadLavoriCallback - Callback per ricaricare lavori
 * @param {Function} generaVoceDiarioContoTerziCallback - Callback per generare voce diario (opzionale)
 */
export async function approvaLavoro(
    lavoroId,
    lavoriList,
    currentTenantId,
    db,
    currentUserData,
    hasParcoMacchineModule,
    hasContoTerziModule,
    updateMacchinaStatoCallback,
    loadTrattoriCallback,
    loadAttrezziCallback,
    loadLavoriCallback,
    generaVoceDiarioContoTerziCallback
) {
    const lavoro = lavoriList.find(l => l.id === lavoroId);
    if (!lavoro) {
        showAlert('Lavoro non trovato', 'error');
        return;
    }
    
    const conferma = confirm(
        `Sei sicuro di voler approvare questo lavoro?\n\n` +
        `Lavoro: ${lavoro.nome}\n` +
        `Il lavoro sarà marcato come completato al 100%.`
    );
    
    if (!conferma) return;
    
    try {
        const { doc, getDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const lavoroRef = doc(db, 'tenants', currentTenantId, 'lavori', lavoroId);
        const terrenoDoc = await getDoc(doc(db, 'tenants', currentTenantId, 'terreni', lavoro.terrenoId));
        const terreno = terrenoDoc.exists() ? terrenoDoc.data() : null;
        const superficieTotale = terreno?.superficie || 0;
        
        // Aggiorna stato a "completato" e forza percentuale a 100%
        const lavoroCompletatoData = {
            stato: 'completato',
            superficieTotaleLavorata: superficieTotale, // Forza a superficie totale
            superficieRimanente: 0,
            percentualeCompletamento: 100,
            approvatoDa: currentUserData.id,
            approvatoIl: serverTimestamp(),
            aggiornatoIl: serverTimestamp()
        };
        await updateDoc(lavoroRef, lavoroCompletatoData);
        
        // Genera voce diario automatica se lavoro conto terzi completato
        if (hasContoTerziModule && lavoro.clienteId && generaVoceDiarioContoTerziCallback) {
            const lavoroAggiornato = { ...lavoro, ...lavoroCompletatoData };
            await generaVoceDiarioContoTerziCallback(lavoroId, lavoroAggiornato);
        }
        
        // Libera macchine se modulo Parco Macchine attivo
        if (hasParcoMacchineModule && updateMacchinaStatoCallback) {
            if (lavoro.macchinaId) {
                await updateMacchinaStatoCallback(lavoro.macchinaId, 'disponibile');
            }
            if (lavoro.attrezzoId) {
                await updateMacchinaStatoCallback(lavoro.attrezzoId, 'disponibile');
            }
            
            // Ricarica trattori e attrezzi per aggiornare dropdown
            if (loadTrattoriCallback) await loadTrattoriCallback();
            if (loadAttrezziCallback) await loadAttrezziCallback();
        }
        
        showAlert('Lavoro approvato con successo!', 'success');
        if (loadLavoriCallback) await loadLavoriCallback(); // Ricarica lavori
    } catch (error) {
        console.error('Errore approvazione lavoro:', error);
        showAlert(`Errore: ${error.message}`, 'error');
    }
}

/**
 * Rifiuta lavoro completato dal caposquadra
 * @param {string} lavoroId - ID lavoro da rifiutare
 * @param {Array} lavoriList - Array lavori
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} currentUserData - Dati utente corrente
 * @param {Function} loadLavoriCallback - Callback per ricaricare lavori
 */
export async function rifiutaLavoro(
    lavoroId,
    lavoriList,
    currentTenantId,
    db,
    currentUserData,
    loadLavoriCallback
) {
    const lavoro = lavoriList.find(l => l.id === lavoroId);
    if (!lavoro) {
        showAlert('Lavoro non trovato', 'error');
        return;
    }
    
    const motivo = prompt(
        `Inserisci il motivo del rifiuto (opzionale):\n\n` +
        `Lavoro: ${lavoro.nome}`
    );
    
    if (motivo === null) return; // Utente ha annullato
    
    try {
        const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const lavoroRef = doc(db, 'tenants', currentTenantId, 'lavori', lavoroId);
        
        // Riporta stato a "in_corso" per permettere al caposquadra di continuare
        await updateDoc(lavoroRef, {
            stato: 'in_corso',
            rifiutatoDa: currentUserData.id,
            rifiutatoIl: serverTimestamp(),
            motivoRifiuto: motivo || '',
            aggiornatoIl: serverTimestamp()
        });
        
        showAlert('Lavoro rifiutato. Il caposquadra può continuare a tracciare zone.', 'success');
        if (loadLavoriCallback) await loadLavoriCallback(); // Ricarica lavori
    } catch (error) {
        console.error('Errore rifiuto lavoro:', error);
        showAlert(`Errore: ${error.message}`, 'error');
    }
}

// ============================================
// FUNZIONI MODAL CATEGORIA E TIPO LAVORO
// ============================================

/**
 * Apre modal per creare nuova categoria lavoro
 */
export function openCategoriaLavoroModal() {
    const form = document.getElementById('categoria-lavoro-form');
    const modal = document.getElementById('categoria-lavoro-modal');
    if (form) form.reset();
    if (modal) modal.classList.add('active');
}

/**
 * Chiude modal categoria lavoro
 */
export function closeCategoriaLavoroModal() {
    const modal = document.getElementById('categoria-lavoro-modal');
    const form = document.getElementById('categoria-lavoro-form');
    if (modal) modal.classList.remove('active');
    if (form) form.reset();
}

/**
 * Gestisce salvataggio categoria lavoro
 * @param {Event} event - Evento submit del form
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} currentUserData - Dati utente corrente
 * @param {Function} loadCategorieLavoriCallback - Callback per ricaricare categorie
 */
export async function handleSalvaCategoriaLavoro(
    event,
    currentTenantId,
    db,
    currentUserData,
    loadCategorieLavoriCallback
) {
    event.preventDefault();

    const nome = document.getElementById('categoria-lavoro-nome').value.trim();
    const descrizione = document.getElementById('categoria-lavoro-descrizione').value.trim() || null;

    if (!nome || nome.length < 3) {
        showAlert('Il nome categoria deve essere di almeno 3 caratteri', 'error');
        return;
    }

    try {
        const { collection, query, where, getDocs, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Genera codice dal nome
        const codice = nome
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        
        // Verifica che il codice non esista già
        const categorieRef = collection(db, `tenants/${currentTenantId}/categorie`);
        const snapshot = await getDocs(query(categorieRef, where('codice', '==', codice)));
        
        if (!snapshot.empty) {
            showAlert('Una categoria con questo nome esiste già', 'error');
            return;
        }
        
        const categoriaData = {
            nome,
            codice,
            descrizione,
            parentId: null, // Categoria principale
            applicabileA: 'lavori', // Di default per lavori
            predefinita: false,
            ordine: null,
            creatoDa: currentUserData.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        const categoriaDoc = await addDoc(categorieRef, categoriaData);
        
        showAlert('Categoria creata con successo', 'success');
        closeCategoriaLavoroModal();
        
        if (loadCategorieLavoriCallback) await loadCategorieLavoriCallback();
        
        // Seleziona la nuova categoria nel form lavoro
        const categoriaSelect = document.getElementById('lavoro-categoria-principale');
        if (categoriaSelect) {
            categoriaSelect.value = categoriaDoc.id;
            categoriaSelect.dispatchEvent(new Event('change'));
        }
    } catch (error) {
        console.error('Errore salvataggio categoria:', error);
        showAlert('Errore salvataggio categoria: ' + error.message, 'error');
    }
}

/**
 * Apre modal per creare nuovo tipo lavoro
 * @param {Array} categorieLavoriPrincipali - Array categorie principali
 * @param {Map} sottocategorieLavoriMap - Map sottocategorie per categoria
 */
export function openTipoLavoroModal(categorieLavoriPrincipali, sottocategorieLavoriMap) {
    const categoriaPrincipaleId = document.getElementById('lavoro-categoria-principale')?.value;
    const sottocategoriaId = document.getElementById('lavoro-sottocategoria')?.value;
    
    if (!categoriaPrincipaleId) {
        showAlert('Seleziona prima una categoria principale lavoro', 'error');
        return;
    }

    // Usa sottocategoria se selezionata, altrimenti categoria principale
    const categoriaId = sottocategoriaId || categoriaPrincipaleId;

    const form = document.getElementById('tipo-lavoro-form');
    const categoriaSelectModal = document.getElementById('tipo-lavoro-categoria');
    
    if (form) form.reset();
    if (categoriaSelectModal) {
        categoriaSelectModal.value = categoriaId;
        
        // Popola dropdown categoria nel modal (include principali e sottocategorie)
        categoriaSelectModal.innerHTML = '<option value="">-- Seleziona categoria --</option>';
        
        // Aggiungi categorie principali
        if (categorieLavoriPrincipali && Array.isArray(categorieLavoriPrincipali)) {
            categorieLavoriPrincipali.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.nome;
                if (cat.id === categoriaId) {
                    option.selected = true;
                }
                categoriaSelectModal.appendChild(option);
                
                // Aggiungi sottocategorie
                if (sottocategorieLavoriMap && sottocategorieLavoriMap.has(cat.id)) {
                    const sottocat = sottocategorieLavoriMap.get(cat.id);
                    if (Array.isArray(sottocat)) {
                        sottocat.forEach(subcat => {
                            const subOption = document.createElement('option');
                            subOption.value = subcat.id;
                            subOption.textContent = `  └ ${subcat.nome}`;
                            if (subcat.id === categoriaId) {
                                subOption.selected = true;
                            }
                            categoriaSelectModal.appendChild(subOption);
                        });
                    }
                }
            });
        }
    }
    
    const modal = document.getElementById('tipo-lavoro-modal');
    if (modal) modal.classList.add('active');
}

/**
 * Chiude modal tipo lavoro
 */
export function closeTipoLavoroModal() {
    const modal = document.getElementById('tipo-lavoro-modal');
    const form = document.getElementById('tipo-lavoro-form');
    if (modal) modal.classList.remove('active');
    if (form) form.reset();
}

/**
 * Gestisce salvataggio tipo lavoro
 * @param {Event} event - Evento submit del form
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} currentUserData - Dati utente corrente
 * @param {Array} categorieLavoriPrincipali - Array categorie principali
 * @param {Map} sottocategorieLavoriMap - Map sottocategorie per categoria
 * @param {Function} loadTipiLavoroCallback - Callback per ricaricare tipi lavoro
 */
export async function handleSalvaTipoLavoro(
    event,
    currentTenantId,
    db,
    currentUserData,
    categorieLavoriPrincipali,
    sottocategorieLavoriMap,
    loadTipiLavoroCallback
) {
    event.preventDefault();

    const nome = document.getElementById('tipo-lavoro-nome')?.value.trim();
    const categoriaId = document.getElementById('tipo-lavoro-categoria')?.value;
    const descrizione = document.getElementById('tipo-lavoro-descrizione')?.value.trim() || null;

    if (!nome || nome.length < 2) {
        showAlert('Il nome tipo lavoro deve essere di almeno 2 caratteri', 'error');
        return;
    }

    if (!categoriaId) {
        showAlert('Seleziona una categoria', 'error');
        return;
    }

    try {
        const { doc, getDoc, collection, getDocs, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Verifica che la categoria esista (nella collezione unificata)
        const categoriaDoc = await getDoc(doc(db, `tenants/${currentTenantId}/categorie`, categoriaId));
        if (!categoriaDoc.exists()) {
            showAlert('Categoria lavoro non trovata', 'error');
            return;
        }
        
        // Verifica che non esista già un tipo con lo stesso nome (case-insensitive)
        // Cerca in tutta la collection per evitare duplicati
        const tipiRef = collection(db, `tenants/${currentTenantId}/tipiLavoro`);
        const tipiSnapshot = await getDocs(tipiRef);
        
        const nomeLower = nome.toLowerCase();
        const tipoEsistente = tipiSnapshot.docs.find(doc => {
            const data = doc.data();
            const nomeTipo = (data.nome || '').toLowerCase();
            return nomeTipo === nomeLower;
        });
        
        if (tipoEsistente) {
            const dataEsistente = tipoEsistente.data();
            // Verifica se è nella stessa categoria/sottocategoria
            const stessaCategoria = dataEsistente.categoriaId === categoriaId || 
                                   dataEsistente.sottocategoriaId === categoriaId;
            
            if (stessaCategoria) {
                showAlert(`Un tipo lavoro con nome "${nome}" esiste già in questa categoria/sottocategoria`, 'error');
            } else {
                showAlert(`Un tipo lavoro con nome "${nome}" esiste già in un'altra categoria. Scegli un nome diverso o usa quello esistente.`, 'error');
            }
            return;
        }
        
        // Determina se categoriaId è una sottocategoria o categoria principale
        const allCategorie = [...(categorieLavoriPrincipali || []), ...Array.from((sottocategorieLavoriMap || new Map()).values()).flat()];
        const categoriaTrovata = allCategorie.find(c => c.id === categoriaId);
        const isSottocategoria = categoriaTrovata && categoriaTrovata.parentId;
        
        const tipoLavoroData = {
            nome,
            categoriaId: isSottocategoria ? categoriaTrovata.parentId : categoriaId, // Se è sottocategoria, usa parentId come categoriaId
            sottocategoriaId: isSottocategoria ? categoriaId : null, // Se è sottocategoria, salva l'ID come sottocategoriaId
            descrizione,
            predefinito: false,
            creatoDa: currentUserData.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        const tipoDoc = await addDoc(tipiRef, tipoLavoroData);
        
        showAlert('Tipo lavoro creato con successo', 'success');
        closeTipoLavoroModal();
        
        // Ricarica tipi lavoro per aggiornare la lista
        // Usa la categoria principale se è stata selezionata una sottocategoria
        const categoriaPrincipaleId = document.getElementById('lavoro-categoria-principale')?.value;
        const sottocategoriaId = document.getElementById('lavoro-sottocategoria')?.value;
        const categoriaIdPerRicarica = sottocategoriaId || categoriaPrincipaleId || categoriaId;
        
        if (loadTipiLavoroCallback) await loadTipiLavoroCallback(categoriaIdPerRicarica);
        
        // Seleziona il nuovo tipo nel form lavoro
        const tipoSelect = document.getElementById('lavoro-tipo-lavoro');
        if (tipoSelect) {
            tipoSelect.value = nome;
        }
    } catch (error) {
        console.error('Errore salvataggio tipo lavoro:', error);
        showAlert('Errore salvataggio tipo lavoro: ' + error.message, 'error');
    }
}

/**
 * Genera automaticamente una voce diario quando un lavoro conto terzi viene completato
 * @param {string} lavoroId - ID del lavoro completato
 * @param {Object} lavoroData - Dati del lavoro completato
 * @param {Object} orariOpzionali - Orari opzionali dalla attività appena salvata {orarioInizio, orarioFine, pauseMinuti, oreNette}
 * @param {boolean} hasContoTerziModule - Se il modulo Conto Terzi è attivo
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} currentUserData - Dati utente corrente
 */
export async function generaVoceDiarioContoTerzi(
    lavoroId,
    lavoroData,
    orariOpzionali,
    hasContoTerziModule,
    currentTenantId,
    db,
    currentUserData
) {
    // Verifica se modulo Conto Terzi è attivo e se lavoro è conto terzi
    if (!hasContoTerziModule || !lavoroData.clienteId) {
        return; // Non è un lavoro conto terzi o modulo non attivo
    }

    // Verifica se già esiste una voce diario per questo lavoro
    try {
        const { query, collection, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const attivitaQuery = query(
            collection(db, 'tenants', currentTenantId, 'attivita'),
            where('lavoroId', '==', lavoroId)
        );
        const attivitaSnapshot = await getDocs(attivitaQuery);
        
        if (!attivitaSnapshot.empty) {
            return; // Già esiste una voce diario
        }
    } catch (error) {
        console.warn('Errore verifica voce diario esistente:', error);
    }

    try {
        const { doc, getDoc, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Carica dati terreno
        const terrenoDoc = await getDoc(doc(db, 'tenants', currentTenantId, 'terreni', lavoroData.terrenoId));
        if (!terrenoDoc.exists()) {
            console.warn('Terreno non trovato per lavoro conto terzi:', lavoroData.terrenoId);
            return;
        }
        const terreno = terrenoDoc.data();

        // Carica dati cliente
        let clienteNome = 'Cliente';
        if (lavoroData.clienteId) {
            try {
                const clienteDoc = await getDoc(doc(db, 'tenants', currentTenantId, 'clienti', lavoroData.clienteId));
                if (clienteDoc.exists()) {
                    clienteNome = clienteDoc.data().ragioneSociale || 'Cliente';
                }
            } catch (error) {
                console.warn('Errore caricamento cliente:', error);
            }
        }

        // Calcola data completamento (usa data approvazione se presente, altrimenti oggi)
        const dataCompletamento = lavoroData.approvatoIl?.toDate 
            ? lavoroData.approvatoIl.toDate() 
            : new Date();
        const dataAttivita = dataCompletamento.toISOString().split('T')[0];

        // Usa orari dalla attività se disponibili, altrimenti default
        const orarioInizio = orariOpzionali?.orarioInizio || '08:00';
        const orarioFine = orariOpzionali?.orarioFine || '17:00';
        const pauseMinuti = orariOpzionali?.pauseMinuti !== undefined ? orariOpzionali.pauseMinuti : 60;
        const oreNette = orariOpzionali?.oreNette !== undefined ? orariOpzionali.oreNette : 8.0;

        // Crea voce diario precompilata
        const attivitaData = {
            data: dataAttivita,
            terrenoId: lavoroData.terrenoId,
            terrenoNome: terreno.nome || 'Terreno Cliente',
            tipoLavoro: lavoroData.tipoLavoro || 'Lavoro Conto Terzi',
            coltura: terreno.coltura || lavoroData.coltura || '',
            orarioInizio: orarioInizio,
            orarioFine: orarioFine,
            pauseMinuti: pauseMinuti,
            oreNette: oreNette,
            note: `Lavoro conto terzi completato: ${lavoroData.nome || ''}\nCliente: ${clienteNome}\n${lavoroData.note || ''}`.trim(),
            clienteId: lavoroData.clienteId,
            lavoroId: lavoroId,
            creatoDa: currentUserData.id,
            creatoIl: serverTimestamp(),
            aggiornatoIl: serverTimestamp()
        };

        // Salva voce diario
        await addDoc(collection(db, 'tenants', currentTenantId, 'attivita'), attivitaData);

    } catch (error) {
        console.error('Errore generazione voce diario conto terzi:', error);
        // Non bloccare il flusso se la generazione fallisce
    }
}

/**
 * Gestisce salvataggio lavoro (crea/modifica)
 * @param {Event} event - Evento submit del form
 * @param {Object} state - State object con lavoriList, currentLavoroId, hasManodoperaModule, hasParcoMacchineModule, hasContoTerziModule
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} currentUserData - Dati utente corrente
 * @param {Function} closeLavoroModalCallback - Callback per chiudere il modal
 * @param {Function} loadLavoriCallback - Callback per ricaricare lavori
 * @param {Function} loadStatisticsCallback - Callback per ricaricare statistiche
 * @param {Function} loadTrattoriCallback - Callback per ricaricare trattori
 * @param {Function} loadAttrezziCallback - Callback per ricaricare attrezzi
 * @param {Function} updateMacchinaStatoCallback - Callback per aggiornare stato macchina
 * @param {Function} generaVoceDiarioContoTerziCallback - Callback per generare voce diario conto terzi
 */
export async function handleSalvaLavoro(
    event,
    state,
    updateState,
    currentTenantId,
    db,
    currentUserData,
    closeLavoroModalCallback,
    loadLavoriCallback,
    loadStatisticsCallback,
    loadTrattoriCallback,
    loadAttrezziCallback,
    updateMacchinaStatoCallback,
    generaVoceDiarioContoTerziCallback
) {
    event.preventDefault();
    
    const nome = document.getElementById('lavoro-nome').value.trim();
    const terrenoId = document.getElementById('lavoro-terreno').value;
    const categoriaPrincipaleId = document.getElementById('lavoro-categoria-principale').value;
    const sottocategoriaId = document.getElementById('lavoro-sottocategoria').value;
    const tipoLavoro = document.getElementById('lavoro-tipo-lavoro').value.trim();
    const dataInizio = document.getElementById('lavoro-data-inizio').value;
    
    // Usa sottocategoria se selezionata, altrimenti categoria principale
    const categoriaLavoroId = sottocategoriaId || categoriaPrincipaleId;
    const durataPrevista = parseInt(document.getElementById('lavoro-durata').value);
    const statoSelect = document.getElementById('lavoro-stato');
    let stato = state.hasManodoperaModule ? (statoSelect?.value || 'assegnato') : 'in_corso';
    const note = document.getElementById('lavoro-note').value.trim();
    
    // Determina tipo assegnazione (solo se Manodopera attivo)
    let tipoAssegnazione = null;
    let caposquadraId = null;
    let operaioId = null;
    
    if (state.hasManodoperaModule) {
        tipoAssegnazione = document.querySelector('input[name="tipo-assegnazione"]:checked')?.value;
        caposquadraId = document.getElementById('lavoro-caposquadra')?.value || null;
        operaioId = document.getElementById('lavoro-operaio')?.value || null;
    }
    
    if (!nome || nome.length < 3) {
        showAlert('Il nome lavoro deve essere di almeno 3 caratteri', 'error');
        return;
    }
    
    if (!categoriaPrincipaleId) {
        showAlert('Seleziona una categoria principale lavoro', 'error');
        return;
    }
    
    if (!tipoLavoro) {
        showAlert('Seleziona un tipo lavoro specifico', 'error');
        return;
    }
    
    if (!terrenoId) {
        showAlert('Seleziona un terreno', 'error');
        return;
    }
    
    // Validazione assegnazione (solo se Manodopera attivo)
    if (state.hasManodoperaModule) {
        if (tipoAssegnazione === 'squadra') {
            if (!caposquadraId) {
                showAlert('Seleziona un caposquadra per lavori di squadra', 'error');
                return;
            }
        } else if (tipoAssegnazione === 'autonomo') {
            if (!operaioId) {
                showAlert('Seleziona un operaio per lavori autonomi', 'error');
                return;
            }
        } else {
            showAlert('Seleziona un tipo di assegnazione', 'error');
            return;
        }
    }
    
    if (!dataInizio) {
        showAlert('Seleziona una data di inizio', 'error');
        return;
    }
    
    if (!durataPrevista || durataPrevista < 1) {
        showAlert('La durata deve essere di almeno 1 giorno', 'error');
        return;
    }
    
    try {
        const { Timestamp, serverTimestamp, doc, collection, addDoc, updateDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Se il lavoro era "da_pianificare" e ora ha tutti i campi necessari, passa automaticamente a "assegnato"
        const lavoroOriginale = state.currentLavoroId ? state.lavoriList.find(l => l.id === state.currentLavoroId) : null;
        const eraDaPianificare = lavoroOriginale?.stato === 'da_pianificare';
        
        // Verifica se la pianificazione è completa
        // Se Manodopera attivo: richiede caposquadra/operaio e terreno
        // Se Manodopera non attivo: richiede solo terreno
        const pianificazioneCompleta = state.hasManodoperaModule 
            ? ((tipoAssegnazione === 'squadra' && caposquadraId) || (tipoAssegnazione === 'autonomo' && operaioId)) && terrenoId
            : terrenoId;
        
        // Se era da_pianificare e ora è completo, passa automaticamente a "assegnato" (solo con Manodopera)
        // Senza Manodopera, stato forzato a in_corso per mostrarlo subito tra i lavori attivi
        let nuovoStato = state.hasManodoperaModule ? stato : 'in_corso';
        if (state.hasManodoperaModule && eraDaPianificare && pianificazioneCompleta && terrenoId) {
            nuovoStato = 'assegnato';
            showAlert('Pianificazione completata! Il lavoro è stato assegnato.', 'success');
        }
        
        const lavoroData = {
            nome,
            terrenoId,
            tipoLavoro,
            dataInizio: Timestamp.fromDate(new Date(dataInizio)),
            durataPrevista,
            stato: nuovoStato,
            note: note || '',
            aggiornatoIl: serverTimestamp()
        };
        
        // Assegnazione flessibile: O caposquadra O operaio (non entrambi) - solo se Manodopera attivo
        if (state.hasManodoperaModule) {
            if (tipoAssegnazione === 'squadra') {
                lavoroData.caposquadraId = caposquadraId;
                lavoroData.operaioId = null;
            } else {
                lavoroData.operaioId = operaioId;
                lavoroData.caposquadraId = null;
            }
        } else {
            // Senza Manodopera: nessuna assegnazione
            lavoroData.caposquadraId = null;
            lavoroData.operaioId = null;
        }
        
        // Campi macchine (solo se modulo Parco Macchine attivo)
        if (state.hasParcoMacchineModule) {
            const macchinaId = document.getElementById('lavoro-trattore')?.value || null;
            const attrezzoId = document.getElementById('lavoro-attrezzo')?.value || null;
            let operatoreMacchinaId = null;
            
            // Operatore macchina solo se Manodopera attivo
            if (state.hasManodoperaModule) {
                operatoreMacchinaId = document.getElementById('lavoro-operatore-macchina')?.value || null;
                
                // Se operatore macchina non specificato ma c'è un operaio responsabile, usa quello
                if (!operatoreMacchinaId && tipoAssegnazione === 'autonomo' && operaioId) {
                    operatoreMacchinaId = operaioId;
                }
            }
            
            lavoroData.macchinaId = macchinaId || null;
            lavoroData.attrezzoId = attrezzoId || null;
            lavoroData.operatoreMacchinaId = operatoreMacchinaId || null;
            
            // Gestisci stato macchine (aggiorna solo se macchina assegnata/rimossa)
            if (state.currentLavoroId) {
                // Modifica: verifica se macchina è cambiata
                const lavoroEsistente = state.lavoriList.find(l => l.id === state.currentLavoroId);
                if (lavoroEsistente) {
                    // Libera macchina vecchia se cambiata
                    if (lavoroEsistente.macchinaId && lavoroEsistente.macchinaId !== macchinaId) {
                        if (updateMacchinaStatoCallback) await updateMacchinaStatoCallback(lavoroEsistente.macchinaId, 'disponibile');
                    }
                    if (lavoroEsistente.attrezzoId && lavoroEsistente.attrezzoId !== attrezzoId) {
                        if (updateMacchinaStatoCallback) await updateMacchinaStatoCallback(lavoroEsistente.attrezzoId, 'disponibile');
                    }
                }
            }
            
            // Imposta macchine come in_uso se assegnate e lavoro non completato/annullato
            const statiCompletati = ['completato', 'completato_da_approvare', 'annullato'];
            const lavoroNonCompletato = !statiCompletati.includes(nuovoStato);

            if (macchinaId && lavoroNonCompletato) {
                if (updateMacchinaStatoCallback) await updateMacchinaStatoCallback(macchinaId, 'in_uso');
            }
            
            if (attrezzoId && lavoroNonCompletato) {
                if (updateMacchinaStatoCallback) await updateMacchinaStatoCallback(attrezzoId, 'in_uso');
            }
            
            // Libera macchine se lavoro completato/annullato
            if (statiCompletati.includes(nuovoStato)) {
                if (macchinaId && updateMacchinaStatoCallback) {
                    await updateMacchinaStatoCallback(macchinaId, 'disponibile');
                }
                if (attrezzoId && updateMacchinaStatoCallback) {
                    await updateMacchinaStatoCallback(attrezzoId, 'disponibile');
                }
            }
        }
        
        let nuovoLavoroId = state.currentLavoroId;
        let lavoroEraCompletato = false;
        
        if (state.currentLavoroId) {
            // Modifica lavoro esistente
            const lavoroOriginale = state.lavoriList.find(l => l.id === state.currentLavoroId);
            lavoroEraCompletato = lavoroOriginale?.stato === 'completato';
            
            lavoroData.aggiornatoIl = serverTimestamp();
            
            await updateDoc(doc(db, 'tenants', currentTenantId, 'lavori', state.currentLavoroId), lavoroData);
            showAlert('Lavoro modificato con successo!', 'success');
        } else {
            // Crea nuovo lavoro
            lavoroData.creatoDa = currentUserData.id;
            lavoroData.creatoIl = serverTimestamp();
            
            const nuovoLavoroRef = await addDoc(collection(db, 'tenants', currentTenantId, 'lavori'), lavoroData);
            nuovoLavoroId = nuovoLavoroRef.id;
            showAlert('Lavoro creato con successo!', 'success');
        }
        
        // Genera voce diario automatica se lavoro conto terzi completato
        const lavoroCompletatoOra = nuovoStato === 'completato';
        if (lavoroCompletatoOra && !lavoroEraCompletato && lavoroData.clienteId && generaVoceDiarioContoTerziCallback) {
            // Carica dati completi del lavoro appena salvato
            const lavoroCompletatoDoc = await getDoc(doc(db, 'tenants', currentTenantId, 'lavori', nuovoLavoroId));
            if (lavoroCompletatoDoc.exists()) {
                const lavoroCompletatoData = { id: nuovoLavoroId, ...lavoroCompletatoDoc.data() };
                await generaVoceDiarioContoTerziCallback(nuovoLavoroId, lavoroCompletatoData, null);
            }
        }
        
        if (closeLavoroModalCallback) closeLavoroModalCallback();
        
        // Resetta filtro stato se Manodopera non è attivo, per mostrare subito i nuovi lavori
        if (!state.hasManodoperaModule) {
            const filterStatoEl = document.getElementById('filter-stato');
            if (filterStatoEl) {
                filterStatoEl.value = '';
            }
        }
        
        // Ricarica macchine se modulo Parco Macchine attivo (per aggiornare stati)
        if (state.hasParcoMacchineModule) {
            if (loadTrattoriCallback) await loadTrattoriCallback();
            if (loadAttrezziCallback) await loadAttrezziCallback();
        }
        
        if (loadLavoriCallback) await loadLavoriCallback();
        if (loadStatisticsCallback) await loadStatisticsCallback();
    } catch (error) {
        console.error('Errore salvataggio lavoro:', error);
        showAlert(`Errore: ${error.message}`, 'error');
    }
}
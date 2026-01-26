/**
 * Attività Events - Event handlers per modal, form e filtri
 * 
 * @module core/js/attivita-events
 */

// ============================================
// IMPORTS
// ============================================
// Le importazioni Firebase verranno fatte nel file HTML principale
// Questo modulo assume che db, auth, currentTenantId siano disponibili globalmente

// ============================================
// FUNZIONI FILTRI
// ============================================

/**
 * Applica filtri alle attività
 * @param {Array} attivita - Array attività completo
 * @param {Array} filteredAttivita - Array attività filtrate (modificato in place)
 * @param {Array} lavoriList - Array lavori (per modalità Conto Terzi)
 * @param {Array} tipiLavoroList - Array tipi lavoro
 * @param {Array} categorieLavoriPrincipali - Array categorie principali
 * @param {boolean} isContoTerziMode - Se è modalità Conto Terzi
 * @param {Function} mapColturaToCategoria - Funzione per mappare coltura a categoria
 * @param {Function} renderAttivitaCallback - Callback per renderizzare attività
 */
export function applyFilters(
    attivita,
    filteredAttivita,
    lavoriList,
    tipiLavoroList,
    categorieLavoriPrincipali,
    isContoTerziMode,
    mapColturaToCategoria,
    renderAttivitaCallback
) {
    const urlParams = new URLSearchParams(window.location.search);
    const statoFiltro = urlParams.get('stato');
    const isModalitaCompletati = isContoTerziMode && statoFiltro === 'completato';
    
    const dataDa = document.getElementById('filter-data-da')?.value || '';
    const dataA = document.getElementById('filter-data-a')?.value || '';
    const clienteId = document.getElementById('filter-cliente')?.value || '';
    const terrenoId = document.getElementById('filter-terreno')?.value || '';
    const tipoLavoro = document.getElementById('filter-tipo-lavoro')?.value || '';
    const coltura = document.getElementById('filter-coltura')?.value || '';
    const ricerca = document.getElementById('filter-ricerca')?.value.toLowerCase() || '';
    
    // Se modalità completati, applica filtri base e poi filtra per lavori completati
    if (isModalitaCompletati) {
        // Filtra attività base
        let attivitaFiltrate = attivita.filter(att => {
            if (dataDa && att.data < dataDa) return false;
            if (dataA && att.data > dataA) return false;
            if (clienteId && att.clienteId !== clienteId) return false;
            if (terrenoId && att.terrenoId !== terrenoId) return false;
            
            // Filtro tipo lavoro per CATEGORIA
            if (tipoLavoro) {
                const tipoLavoroObj = tipiLavoroList.find(t => t.nome === att.tipoLavoro);
                if (!tipoLavoroObj || !tipoLavoroObj.categoriaId) {
                    return false;
                }
                const categoriaObj = categorieLavoriPrincipali.find(cat => cat.id === tipoLavoroObj.categoriaId);
                if (!categoriaObj || categoriaObj.nome !== tipoLavoro) {
                    return false;
                }
            }
            
            // Filtro coltura per CATEGORIA
            if (coltura && mapColturaToCategoria) {
                const categoriaColturaAtt = mapColturaToCategoria(att.coltura);
                if (categoriaColturaAtt !== coltura) {
                    return false;
                }
            }
            
            if (ricerca && att.note && !att.note.toLowerCase().includes(ricerca)) return false;
            return true;
        });
        
        // Filtra per lavori completati
        let lavoriCompletati = lavoriList.filter(l => l.stato === 'completato');
        
        // Se c'è filtro cliente, filtra anche i lavori
        if (clienteId) {
            lavoriCompletati = lavoriCompletati.filter(l => l.clienteId === clienteId);
        }
        
        // Se c'è filtro terreno, filtra anche i lavori
        if (terrenoId) {
            lavoriCompletati = lavoriCompletati.filter(l => l.terrenoId === terrenoId);
        }
        
        const lavoriIds = lavoriCompletati.map(l => l.id);
        filteredAttivita.length = 0;
        filteredAttivita.push(...attivitaFiltrate.filter(a => {
            return a.clienteId != null && a.clienteId !== '' && a.lavoroId && lavoriIds.includes(a.lavoroId);
        }));
    } else {
        // Filtri normali
        filteredAttivita.length = 0;
        filteredAttivita.push(...attivita.filter(att => {
            if (dataDa && att.data < dataDa) return false;
            if (dataA && att.data > dataA) return false;
            if (clienteId && att.clienteId !== clienteId) return false;
            if (terrenoId && att.terrenoId !== terrenoId) return false;
            
            // Filtro tipo lavoro per CATEGORIA
            if (tipoLavoro) {
                const tipoLavoroObj = tipiLavoroList.find(t => t.nome === att.tipoLavoro);
                if (!tipoLavoroObj || !tipoLavoroObj.categoriaId) {
                    return false;
                }
                const categoriaObj = categorieLavoriPrincipali.find(cat => cat.id === tipoLavoroObj.categoriaId);
                if (!categoriaObj || categoriaObj.nome !== tipoLavoro) {
                    return false;
                }
            }
            
            // Filtro coltura per CATEGORIA
            if (coltura && mapColturaToCategoria) {
                const categoriaColturaAtt = mapColturaToCategoria(att.coltura);
                if (categoriaColturaAtt !== coltura) {
                    return false;
                }
            }
            
            if (ricerca && att.note && !att.note.toLowerCase().includes(ricerca)) return false;
            return true;
        }));
    }
    
    // Renderizza attività
    if (renderAttivitaCallback) renderAttivitaCallback();
}

/**
 * Pulisci tutti i filtri
 */
export function clearFilters() {
    const filterDataDa = document.getElementById('filter-data-da');
    const filterDataA = document.getElementById('filter-data-a');
    const filterCliente = document.getElementById('filter-cliente');
    const filterTerreno = document.getElementById('filter-terreno');
    const filterTipoLavoro = document.getElementById('filter-tipo-lavoro');
    const filterColtura = document.getElementById('filter-coltura');
    const filterRicerca = document.getElementById('filter-ricerca');
    
    if (filterDataDa) filterDataDa.value = '';
    if (filterDataA) filterDataA.value = '';
    if (filterCliente) filterCliente.value = '';
    if (filterTerreno) filterTerreno.value = '';
    if (filterTipoLavoro) filterTipoLavoro.value = '';
    if (filterColtura) filterColtura.value = '';
    if (filterRicerca) filterRicerca.value = '';
}

/**
 * Applica filtro automatico su attività per lavori conto terzi
 * @param {string} statoFiltro - Stato filtro (es: 'completato', 'in_corso')
 * @param {Array} attivita - Array attività completo
 * @param {Array} filteredAttivita - Array attività filtrate (modificato in place)
 * @param {Array} lavoriList - Array lavori
 * @param {Function} renderAttivitaCallback - Callback per renderizzare attività
 */
export function applyContoTerziFilter(
    statoFiltro,
    attivita,
    filteredAttivita,
    lavoriList,
    renderAttivitaCallback
) {
    // Filtra le attività mostrate per lavori conto terzi con stato specificato
    const lavoriFiltrati = lavoriList.filter(l => l.stato === statoFiltro);
    const lavoriIds = lavoriFiltrati.map(l => l.id);
    
    // Filtra attività per lavoriId (solo attività conto terzi)
    filteredAttivita.length = 0;
    filteredAttivita.push(...attivita.filter(a => {
        // Deve essere un'attività conto terzi (ha clienteId) e appartenere a un lavoro con lo stato specificato
        return a.clienteId != null && a.clienteId !== '' && a.lavoroId && lavoriIds.includes(a.lavoroId);
    }));
    
    // Renderizza attività
    if (renderAttivitaCallback) renderAttivitaCallback();
}

// ============================================
// FUNZIONI MODAL
// ============================================

/**
 * Chiude modal attività
 */
export function closeAttivitaModal() {
    const modal = document.getElementById('attivita-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Modifica attività (apre modal in modifica)
 * @param {string} attivitaId - ID attività da modificare
 * @param {Function} openAttivitaModalCallback - Callback per aprire modal
 */
export function editAttivita(attivitaId, openAttivitaModalCallback) {
    if (openAttivitaModalCallback) {
        openAttivitaModalCallback(attivitaId);
    }
}

/**
 * Conferma eliminazione attività
 * @param {string} attivitaId - ID attività da eliminare
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Function} getAttivitaCollectionCallback - Callback per ottenere collection
 * @param {Function} loadAttivitaCallback - Callback per ricaricare attività
 * @param {Function} showAlertCallback - Callback per mostrare alert
 */
export async function confirmDeleteAttivita(
    attivitaId,
    currentTenantId,
    db,
    getAttivitaCollectionCallback,
    loadAttivitaCallback,
    showAlertCallback
) {
    if (!confirm('Sei sicuro di voler eliminare questa attività?')) {
        return;
    }
    
    if (!currentTenantId) {
        if (showAlertCallback) showAlertCallback('Errore: Tenant ID non disponibile', 'error');
        return;
    }
    
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Gestione vendemmia collegata (se modulo vigneto attivo)
        try {
            const { hasModuleAccess } = await import('../../core/services/tenant-service.js');
            const hasVignetoModule = await hasModuleAccess('vigneto');
            
            if (hasVignetoModule) {
                const { findVendemmiaByAttivitaId, deleteVendemmia } = await import('../../modules/vigneto/services/vendemmia-service.js');
                const vendemmiaCollegata = await findVendemmiaByAttivitaId(attivitaId);
                
                if (vendemmiaCollegata) {
                    console.log('[ATTIVITA-EVENTS] Attività collegata a vendemmia, elimino vendemmia:', vendemmiaCollegata.vendemmiaId);
                    await deleteVendemmia(vendemmiaCollegata.vignetoId, vendemmiaCollegata.vendemmiaId);
                    console.log('[ATTIVITA-EVENTS] ✓ Vendemmia eliminata');
                }
            }
        } catch (error) {
            console.warn('[ATTIVITA-EVENTS] Errore eliminazione vendemmia collegata:', error);
            // Non blocchiamo l'operazione principale
        }
        
        const attivitaCollection = await getAttivitaCollectionCallback(currentTenantId);
        const attivitaRef = doc(attivitaCollection, attivitaId);
        await deleteDoc(attivitaRef);
        if (showAlertCallback) showAlertCallback('Attività eliminata con successo!', 'success');
        if (loadAttivitaCallback) await loadAttivitaCallback();
    } catch (error) {
        console.error('Errore eliminazione attività:', error);
        if (showAlertCallback) showAlertCallback('Errore nell\'eliminazione: ' + error.message, 'error');
    }
}

/**
 * Toggle form rapido per lavoro
 * @param {string} lavoroId - ID lavoro
 */
export function toggleFormRapido(lavoroId) {
    const form = document.getElementById(`form-rapido-${lavoroId}`);
    const btn = document.getElementById(`btn-toggle-${lavoroId}`);
    
    if (form && btn) {
        if (form.style.display === 'none' || !form.style.display) {
            form.style.display = 'block';
            btn.textContent = '❌ Annulla';
        } else {
            form.style.display = 'none';
            btn.textContent = '➕ Aggiungi Attività';
            // Reset form
            form.reset();
            const today = new Date().toISOString().split('T')[0];
            const dataInput = document.getElementById(`rapido-data-${lavoroId}`);
            if (dataInput) {
                dataInput.value = today;
            }
        }
    }
}

/**
 * Setup handler per cambio categoria lavoro
 * @param {Function} populateSottocategorieLavoroCallback - Callback per popolare sottocategorie
 * @param {Function} loadTipiLavoroCallback - Callback per caricare tipi lavoro
 */
export function setupCategoriaLavoroHandler(populateSottocategorieLavoroCallback, loadTipiLavoroCallback) {
    const categoriaPrincipaleSelect = document.getElementById('attivita-categoria-principale');
    const sottocategoriaSelect = document.getElementById('attivita-sottocategoria');
    
    if (categoriaPrincipaleSelect) {
        categoriaPrincipaleSelect.addEventListener('change', function() {
            const categoriaPrincipaleId = this.value;
            if (categoriaPrincipaleId) {
                if (populateSottocategorieLavoroCallback) populateSottocategorieLavoroCallback(categoriaPrincipaleId);
                if (loadTipiLavoroCallback) {
                    console.log('[ATTIVITA-EVENTS] Categoria principale cambiata, ricarico tipi lavoro per applicare filtro vendemmia se necessario');
                    loadTipiLavoroCallback(categoriaPrincipaleId);
                }
            } else {
                const sottocategoriaGroup = document.getElementById('attivita-sottocategoria-group');
                const tipoLavoroGroup = document.getElementById('attivita-tipo-lavoro-gerarchico-group');
                if (sottocategoriaGroup) sottocategoriaGroup.style.display = 'none';
                if (tipoLavoroGroup) tipoLavoroGroup.style.display = 'none';
                const tipoLavoroSelect = document.getElementById('attivita-tipo-lavoro-gerarchico');
                if (tipoLavoroSelect) tipoLavoroSelect.value = '';
            }
        });
    }
    
    if (sottocategoriaSelect) {
        sottocategoriaSelect.addEventListener('change', function() {
            const sottocategoriaId = this.value;
            const categoriaPrincipaleId = document.getElementById('attivita-categoria-principale')?.value;
            
            // Usa sottocategoria se selezionata, altrimenti categoria principale
            const categoriaId = sottocategoriaId || categoriaPrincipaleId;
            if (categoriaId && loadTipiLavoroCallback) {
                console.log('[ATTIVITA-EVENTS] Sottocategoria cambiata, ricarico tipi lavoro per applicare filtro vendemmia se necessario');
                loadTipiLavoroCallback(categoriaId);
            }
        });
    }
}

// ============================================
// MODAL ATTIVITÀ
// ============================================

/**
 * Apre il modal per creare o modificare un'attività
 * @param {Object} params - Parametri della funzione
 * @param {string|null} params.attivitaId - ID attività da modificare (null per nuova attività)
 * @param {Function} params.setCurrentAttivitaId - Funzione per impostare currentAttivitaId
 * @param {Array} params.filteredAttivita - Array attività filtrate
 * @param {Array} params.tipiLavoroList - Array tipi lavoro
 * @param {Array} params.categorieLavoriPrincipali - Array categorie principali
 * @param {Object} params.sottocategorieLavoriMap - Mappa sottocategorie lavori
 * @param {boolean} params.hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {Array} params.macchineList - Array macchine
 * @param {Array} params.terreni - Array terreni
 * @param {Function} params.loadMacchine - Funzione caricamento macchine
 * @param {Function} params.loadCategorieLavori - Funzione caricamento categorie lavori
 * @param {Function} params.loadTipiLavoro - Funzione caricamento tipi lavoro
 * @param {Function} params.loadListe - Funzione caricamento liste
 * @param {Function} params.loadTerreni - Funzione caricamento terreni
 * @param {Function} params.populateCategoriaLavoroDropdown - Funzione popolamento dropdown categoria lavoro
 * @param {Function} params.populateSottocategorieLavoro - Funzione popolamento sottocategorie
 * @param {Function} params.populateTipoLavoroDropdown - Funzione popolamento tipo lavoro
 * @param {Function} params.populateColtureFromTerreni - Funzione popolamento colture da terreni
 * @param {Function} params.updateColtureDropdownAttivita - Funzione aggiornamento dropdown colture
 * @param {Function} params.populateTrattoriDropdown - Funzione popolamento dropdown trattori
 * @param {Function} params.populateAttrezziDropdown - Funzione popolamento dropdown attrezzi
 * @param {Function} params.setupCategoriaLavoroHandler - Funzione setup handler categoria lavoro
 * @param {Function} params.updateOreNette - Funzione aggiornamento ore nette
 * @param {Function} params.updateOreMacchinaDisplay - Funzione aggiornamento display ore macchina
 */
export async function openAttivitaModal(params) {
    const {
        attivitaId,
        setCurrentAttivitaId,
        filteredAttivita,
        tipiLavoroList,
        categorieLavoriPrincipali,
        sottocategorieLavoriMap,
        hasParcoMacchineModule,
        macchineList,
        terreni,
        loadMacchine,
        loadCategorieLavori,
        loadTipiLavoro,
        loadListe,
        loadTerreni,
        populateCategoriaLavoroDropdown,
        populateSottocategorieLavoro,
        populateTipoLavoroDropdown,
        populateColtureFromTerreni,
        updateColtureDropdownAttivita,
        populateTrattoriDropdown,
        populateAttrezziDropdown,
        setupCategoriaLavoroHandler,
        updateOreNette,
        updateOreMacchinaDisplay
    } = params;

    setCurrentAttivitaId(attivitaId);
    const modal = document.getElementById('attivita-modal');
    const form = document.getElementById('attivita-form');
    const title = document.getElementById('modal-title');
    
    // Carica PRIMA le categorie e i dati necessari, POI resetta il form
    // Questo evita che form.reset() cancelli i dropdown appena popolati
    
    // Ricarica macchine se modulo attivo e non ancora caricate
    if (hasParcoMacchineModule && macchineList.length === 0) {
        await loadMacchine();
    }
    
    // Carica sempre categorie e tipi lavoro gerarchici (sempre attiva)
    // Variabile per salvare le categorie caricate
    // IMPORTANTE: Non usare il parametro categorieLavoriPrincipali perché è passato per valore
    // e non si aggiorna quando la variabile globale viene aggiornata dal callback
    let categorieCaricate = null;
    
    if (categorieLavoriPrincipali.length === 0) {
        // loadCategorieLavori ora restituisce le categorie caricate
        const categorieCaricateDaLoad = await loadCategorieLavori();
        categorieCaricate = (categorieCaricateDaLoad && Array.isArray(categorieCaricateDaLoad)) ? categorieCaricateDaLoad : [];
    } else {
        // Se le categorie sono già caricate, le leggiamo dal dropdown che è stato popolato
        const categoriaSelect = document.getElementById('attivita-categoria-principale');
        if (categoriaSelect && categoriaSelect.options.length > 1) {
            // Leggi le categorie dal dropdown già popolato
            categorieCaricate = Array.from(categoriaSelect.options)
                .slice(1) // Salta la prima opzione (placeholder)
                .map(opt => ({ id: opt.value, nome: opt.textContent }));
        } else {
            // Se il dropdown non è popolato, ricarica le categorie per essere sicuri
            const categorieCaricateDaLoad = await loadCategorieLavori();
            categorieCaricate = (categorieCaricateDaLoad && Array.isArray(categorieCaricateDaLoad)) ? categorieCaricateDaLoad : [];
        }
    }
    
    // Se è una nuova attività, resetta il form DOPO aver caricato le categorie
    if (!attivitaId) {
        // Salva le categorie PRIMA di resettare il form (form.reset() potrebbe resettare anche il dropdown)
        const categorieDaUsare = categorieCaricate && Array.isArray(categorieCaricate) ? [...categorieCaricate] : null;
        
        form.reset();
        
        // Reset esplicito dei dropdown categoria e coltura (ma NON categoria principale lavoro)
        const categoriaSelect = document.getElementById('attivita-coltura-categoria');
        const colturaGerarchicaSelect = document.getElementById('attivita-coltura-gerarchica');
        if (categoriaSelect) {
            categoriaSelect.value = '';
        }
        if (colturaGerarchicaSelect) {
            colturaGerarchicaSelect.innerHTML = '<option value="">-- Seleziona coltura --</option>';
        }
        
        // Popola il dropdown categoria principale lavoro DOPO il reset
        // Usa le categorie salvate PRIMA del reset
        // Popola dropdown categoria dopo reset
        if (categorieDaUsare && Array.isArray(categorieDaUsare) && categorieDaUsare.length > 0) {
            populateCategoriaLavoroDropdown(null, categorieDaUsare);
        } else {
            // Se non abbiamo le categorie salvate, aspetta e riprova leggendo dalla variabile globale
            console.warn('⚠️ [openAttivitaModal] Categorie non disponibili, aspetto e riprovo dalla variabile globale...');
            setTimeout(() => {
                populateCategoriaLavoroDropdown();
            }, 100);
        }
    } else {
        // Se modifica, popola comunque i dropdown
        if (categorieCaricate && categorieCaricate.length > 0) {
            populateCategoriaLavoroDropdown(null, categorieCaricate);
        } else {
            populateCategoriaLavoroDropdown();
        }
    }
    if (tipiLavoroList.length === 0) {
        await loadTipiLavoro();
    }
    // Assicura che gli handler siano configurati
    setupCategoriaLavoroHandler();
    
    // Assicura che le categorie colture siano caricate e il dropdown popolato
    // Chiama sempre loadListe() per assicurarsi che i dropdown siano popolati
    try {
        await loadListe();
    } catch (error) {
        console.error('Errore caricamento liste:', error);
    }
    
    // Verifica che il dropdown categoria sia popolato
    const categoriaSelect = document.getElementById('attivita-coltura-categoria');
    if (categoriaSelect && categoriaSelect.options.length <= 1) {
        // Se il dropdown è ancora vuoto, prova a popolarlo manualmente
        const categorieColture = window.categorieColture || [];
        if (categorieColture.length > 0) {
            categoriaSelect.innerHTML = '<option value="">-- Seleziona categoria --</option>';
            categorieColture.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.nome;
                categoriaSelect.appendChild(option);
            });
        }
    }
    
    // Popola colture dai terreni SEMPRE quando si apre il modal (se non c'è categoria selezionata)
    // Questo popola il dropdown colture con tutte le colture dei terreni
    // Se poi viene selezionata una categoria, updateColtureDropdownAttivita() lo aggiornerà
    const categoriaSelectCheck = document.getElementById('attivita-coltura-categoria');
    if (!categoriaSelectCheck || !categoriaSelectCheck.value) {
        // Assicura che i terreni siano caricati
        if (!terreni || terreni.length === 0) {
            await loadTerreni();
        }
        // Popola sempre il dropdown colture quando non c'è categoria selezionata
        if (terreni && terreni.length > 0) {
            populateColtureFromTerreni();
        } else {
            console.warn('Nessun terreno disponibile per popolare il dropdown colture');
        }
    }
    
    // Imposta required correttamente quando si apre il modal (sempre struttura gerarchica)
    const tipoLavoroSelect = document.getElementById('attivita-tipo-lavoro');
    const tipoLavoroGerarchicoSelect = document.getElementById('attivita-tipo-lavoro-gerarchico');
    const categoriaPrincipaleSelect = document.getElementById('attivita-categoria-principale');
    const colturaSelect = document.getElementById('attivita-coltura');
    const colturaGerarchicaSelect = document.getElementById('attivita-coltura-gerarchica');
    
    if (tipoLavoroSelect) {
        tipoLavoroSelect.removeAttribute('required');
    }
    
    if (tipoLavoroGerarchicoSelect) {
        tipoLavoroGerarchicoSelect.setAttribute('required', 'required');
    }
    
    if (categoriaPrincipaleSelect) {
        categoriaPrincipaleSelect.setAttribute('required', 'required');
    }
    
    if (colturaSelect) {
        colturaSelect.removeAttribute('required');
    }
    
    if (colturaGerarchicaSelect) {
        colturaGerarchicaSelect.setAttribute('required', 'required');
    }
    
    if (attivitaId) {
        title.textContent = 'Modifica Attività';
        // Carica dati attività
        const attivita = filteredAttivita.find(a => a.id === attivitaId);
        if (attivita) {
            document.getElementById('attivita-data').value = attivita.data || '';
            document.getElementById('attivita-terreno').value = attivita.terrenoId || '';
            document.getElementById('attivita-coltura').value = attivita.coltura || '';
            document.getElementById('attivita-orario-inizio').value = attivita.orarioInizio || '';
            document.getElementById('attivita-orario-fine').value = attivita.orarioFine || '';
            document.getElementById('attivita-pause').value = attivita.pauseMinuti || 0;
            document.getElementById('attivita-note').value = attivita.note || '';
            
            // Popola categoria e coltura gerarchica se presenti
            if (attivita.coltura) {
                // Trova la categoria della coltura
                let categoriaTrovata = null;
                if (window.colturePerCategoriaAttivita) {
                    for (const [categoriaId, coltureList] of Object.entries(window.colturePerCategoriaAttivita)) {
                        const colturaTrovata = coltureList.find(c => (c.nome || c) === attivita.coltura);
                        if (colturaTrovata) {
                            categoriaTrovata = categoriaId;
                            break;
                        }
                    }
                }
                
                // Imposta categoria e coltura gerarchica
                const categoriaColturaSelect = document.getElementById('attivita-coltura-categoria');
                const colturaGerarchicaSelect = document.getElementById('attivita-coltura-gerarchica');
                
                if (categoriaTrovata && categoriaColturaSelect) {
                    categoriaColturaSelect.value = categoriaTrovata;
                    // Aggiorna dropdown colture
                    updateColtureDropdownAttivita();
                    // Aspetta che il dropdown sia aggiornato prima di selezionare la coltura
                    setTimeout(() => {
                        if (colturaGerarchicaSelect) {
                            colturaGerarchicaSelect.value = attivita.coltura;
                        }
                    }, 100);
                } else if (colturaGerarchicaSelect) {
                    // Se non troviamo la categoria, popola dal dropdown terreni e seleziona la coltura
                    if (colturaGerarchicaSelect.querySelector(`option[value="${attivita.coltura}"]`)) {
                        colturaGerarchicaSelect.value = attivita.coltura;
                    }
                }
            }
            
            // Gestione tipo lavoro (sempre struttura gerarchica)
            // Cerca il tipo lavoro nella struttura gerarchica
            const tipoLavoroObj = tipiLavoroList.find(t => t.nome === attivita.tipoLavoro);
            if (tipoLavoroObj && tipoLavoroObj.categoriaId) {
                // Trova categoria principale
                let categoriaPrincipaleId = tipoLavoroObj.categoriaId;
                const categoriaTrovata = categorieLavoriPrincipali.find(c => c.id === categoriaPrincipaleId);
                if (!categoriaTrovata) {
                    // È una sottocategoria, trova la principale
                    for (const [parentId, sottocat] of sottocategorieLavoriMap.entries()) {
                        if (sottocat.find(sc => sc.id === categoriaPrincipaleId)) {
                            categoriaPrincipaleId = parentId;
                            break;
                        }
                    }
                }
                populateCategoriaLavoroDropdown(categoriaPrincipaleId);
                populateSottocategorieLavoro(categoriaPrincipaleId);
                await loadTipiLavoro(tipoLavoroObj.categoriaId);
                document.getElementById('attivita-tipo-lavoro-gerarchico').value = attivita.tipoLavoro || '';
            } else {
                populateCategoriaLavoroDropdown();
            }
            
            // Carica dati macchina se presenti
            if (hasParcoMacchineModule) {
                const macchinaId = attivita.macchinaId || null;
                const attrezzoId = attivita.attrezzoId || null;
                const oreMacchina = attivita.oreMacchina || null;
                
                populateTrattoriDropdown(macchinaId);
                populateAttrezziDropdown(macchinaId, attrezzoId);
                
                if (macchinaId || attrezzoId) {
                    const oreMacchinaGroup = document.getElementById('attivita-ore-macchina-group');
                    if (oreMacchinaGroup) oreMacchinaGroup.style.display = 'block';
                    if (oreMacchina) {
                        document.getElementById('attivita-ore-macchina').value = oreMacchina;
                    }
                }
            }
            
            updateOreNette();
            updateOreMacchinaDisplay();
        }
    } else {
        title.textContent = 'Aggiungi Attività';
        // NON resettare il form qui - viene fatto all'inizio della funzione
        // form.reset() resetta anche i dropdown che abbiamo appena popolato!
        // Imposta data di default a oggi
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('attivita-data').value = today;
        document.getElementById('attivita-pause').value = 0;
        
        // Popola struttura gerarchica (sempre attiva) - NON resettare, solo popolare
        // Le categorie sono già state caricate sopra, quindi popola direttamente
        populateCategoriaLavoroDropdown();
        const sottocategoriaGroup = document.getElementById('attivita-sottocategoria-group');
        const tipoLavoroGroup = document.getElementById('attivita-tipo-lavoro-gerarchico-group');
        if (sottocategoriaGroup) sottocategoriaGroup.style.display = 'none';
        if (tipoLavoroGroup) tipoLavoroGroup.style.display = 'none';
        
        // Reset e popola macchine se modulo attivo
        if (hasParcoMacchineModule) {
            // Assicurati che le macchine siano caricate
            if (macchineList.length === 0) {
                await loadMacchine();
            }
            // Passa esplicitamente macchineList per evitare problemi di scope
            populateTrattoriDropdown(macchineList);
            populateAttrezziDropdown(null);
            const oreMacchinaGroup = document.getElementById('attivita-ore-macchina-group');
            if (oreMacchinaGroup) oreMacchinaGroup.style.display = 'none';
        }
        
        updateOreNette();
        updateOreMacchinaDisplay();
    }
    
    // Se c'è un terreno già selezionato, trigghera l'evento change per popolare categoria e coltura
    const terrenoSelect = document.getElementById('attivita-terreno');
    if (terrenoSelect && terrenoSelect.value) {
        // Aspetta un attimo per assicurarsi che i dropdown siano pronti
        setTimeout(() => {
            terrenoSelect.dispatchEvent(new Event('change'));
        }, 150);
    }
    
    // Verifica che il dropdown categoria sia popolato prima di mostrare il modal
    // (categoriaPrincipaleSelect è già dichiarato sopra alla riga 471)
    if (categoriaPrincipaleSelect) {
        if (categoriaPrincipaleSelect.options.length <= 1) {
            console.warn('⚠️ [openAttivitaModal] Dropdown categoria vuoto! Ripopolo...');
            populateCategoriaLavoroDropdown();
        }
    }
    
    modal.classList.add('active');
}

// ============================================
// SALVATAGGIO ATTIVITÀ
// ============================================

/**
 * Gestisce il salvataggio di un'attività (creazione o modifica)
 * @param {Object} params - Parametri della funzione
 * @param {Event} params.event - Evento submit del form
 * @param {string} params.currentTenantId - Tenant ID corrente
 * @param {string|null} params.currentAttivitaId - ID attività corrente (null per nuova attività)
 * @param {Function} params.setCurrentAttivitaId - Funzione per impostare currentAttivitaId
 * @param {boolean} params.isContoTerziMode - Se è modalità Conto Terzi
 * @param {boolean} params.hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {Array} params.lavoriList - Array lavori (per modalità Conto Terzi)
 * @param {Array} params.clientiList - Array clienti
 * @param {Array} params.terreni - Array terreni
 * @param {Array} params.attivita - Array attività completo
 * @param {Function} params.showAlert - Funzione mostra alert
 * @param {Function} params.verificaConflittiMacchine - Funzione verifica conflitti macchine
 * @param {Function} params.calculateOreNette - Funzione calcolo ore nette
 * @param {Function} params.updateMacchinaStato - Funzione aggiornamento stato macchina
 * @param {Function} params.getAttivitaCollection - Funzione ottenimento collection attività
 * @param {Object} params.db - Istanza Firestore
 * @param {Function} params.serverTimestamp - Funzione server timestamp Firebase
 * @param {Function} params.doc - Funzione doc Firestore
 * @param {Function} params.updateDoc - Funzione updateDoc Firestore
 * @param {Function} params.addDoc - Funzione addDoc Firestore
 * @param {Function} params.closeAttivitaModal - Funzione chiusura modal
 * @param {Function} params.loadAttivita - Funzione caricamento attività
 * @param {Function} params.loadMacchine - Funzione caricamento macchine
 */
export async function handleSaveAttivita(params) {
    const {
        event,
        currentTenantId,
        currentAttivitaId,
        setCurrentAttivitaId,
        isContoTerziMode,
        hasParcoMacchineModule,
        lavoriList,
        clientiList,
        terreni,
        attivita,
        showAlert,
        verificaConflittiMacchine,
        calculateOreNette,
        updateMacchinaStato,
        getAttivitaCollection,
        db,
        serverTimestamp,
        doc,
        updateDoc,
        addDoc,
        closeAttivitaModal,
        loadAttivita,
        loadMacchine
    } = params;

    event.preventDefault();
    
    if (!currentTenantId) {
        showAlert('Errore: Tenant ID non disponibile', 'error');
        return;
    }
    
    const data = document.getElementById('attivita-data').value;
    
    // Se modalità Conto Terzi, usa campi specifici
    let terrenoId, tipoLavoro, coltura, orarioInizio, orarioFine, pauseMinuti;
    let clienteId = null;
    let lavoroId = null;
    
    if (isContoTerziMode) {
        clienteId = document.getElementById('attivita-cliente').value;
        lavoroId = document.getElementById('attivita-lavoro').value;
        orarioInizio = document.getElementById('attivita-ora-inizio-ct').value;
        orarioFine = document.getElementById('attivita-ora-fine-ct').value;
        pauseMinuti = parseInt(document.getElementById('attivita-pause-ct').value) || 0;
        
        // Trova lavoro per ottenere terreno e tipo lavoro
        const lavoro = lavoriList.find(l => l.id === lavoroId);
        if (!lavoro) {
            showAlert('Lavoro non trovato', 'error');
            return;
        }
        terrenoId = lavoro.terrenoId;
        tipoLavoro = lavoro.tipoLavoro || '';
        coltura = ''; // Non obbligatorio in modalità Conto Terzi
    } else {
        terrenoId = document.getElementById('attivita-terreno').value;
        // Sempre usa struttura gerarchica
        tipoLavoro = document.getElementById('attivita-tipo-lavoro-gerarchico').value;
        coltura = document.getElementById('attivita-coltura-gerarchica').value;
        orarioInizio = document.getElementById('attivita-orario-inizio').value;
        orarioFine = document.getElementById('attivita-orario-fine').value;
        pauseMinuti = parseInt(document.getElementById('attivita-pause').value) || 0;
    }
    
    const note = document.getElementById('attivita-note').value.trim();
    
    // Validazioni
    if (!data) {
        showAlert('La data è obbligatoria', 'error');
        return;
    }
    
    // Verifica data non futura (accetta oggi e passato)
    // Usa la data locale invece di UTC per evitare problemi di fuso orario
    const oggi = new Date();
    const oggiString = oggi.getFullYear() + '-' + 
                      String(oggi.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(oggi.getDate()).padStart(2, '0');
    // Permette oggi (data <= oggiString) e rifiuta solo date future (data > oggiString)
    if (data > oggiString) {
        showAlert('La data non può essere futura', 'error');
        return;
    }
    
    if (!terrenoId) {
        showAlert('Il terreno è obbligatorio', 'error');
        return;
    }
    
    // Validazioni specifiche per modalità Conto Terzi
    if (isContoTerziMode) {
        if (!clienteId) {
            showAlert('Il cliente è obbligatorio', 'error');
            return;
        }
        if (!lavoroId) {
            showAlert('Il lavoro è obbligatorio', 'error');
            return;
        }
        // Validazione orari già fatta sopra
    } else {
        // Validazioni standard
        if (!tipoLavoro) {
            showAlert('Il tipo lavoro è obbligatorio', 'error');
            return;
        }
        
        if (!coltura) {
            showAlert('La coltura è obbligatoria', 'error');
            return;
        }
        
        if (!orarioInizio) {
            showAlert('L\'orario inizio è obbligatorio', 'error');
            return;
        }
    }
    
    // Se c'è orario fine, valida che sia maggiore di inizio (solo se non modalità Conto Terzi)
    if (!isContoTerziMode && orarioFine) {
        const [inizioOre, inizioMinuti] = orarioInizio.split(':').map(Number);
        const [fineOre, fineMinuti] = orarioFine.split(':').map(Number);
        const inizioMinutiTotali = inizioOre * 60 + inizioMinuti;
        const fineMinutiTotali = fineOre * 60 + fineMinuti;
        
        if (fineMinutiTotali <= inizioMinutiTotali) {
            showAlert('L\'orario fine deve essere maggiore dell\'orario inizio', 'error');
            return;
        }
        
        const minutiLavoro = fineMinutiTotali - inizioMinutiTotali;
        if (pauseMinuti < 0) {
            showAlert('Le pause non possono essere negative', 'error');
            return;
        }
        if (pauseMinuti >= minutiLavoro) {
            showAlert('Le pause non possono essere maggiori o uguali al tempo di lavoro', 'error');
            return;
        }
    } else if (!isContoTerziMode) {
        // Se non c'è orario fine, valida solo che le pause non siano negative (solo se non modalità Conto Terzi)
        if (pauseMinuti < 0) {
            showAlert('Le pause non possono essere negative', 'error');
            return;
        }
    }
    
    // Trova nome terreno
    const terreno = terreni.find(t => t.id === terrenoId);
    if (!terreno) {
        showAlert('Terreno non trovato', 'error');
        return;
    }
    
    // Campi macchina (solo se modulo Parco Macchine attivo)
    const macchinaId = hasParcoMacchineModule ? document.getElementById('attivita-macchina').value || null : null;
    const attrezzoId = hasParcoMacchineModule ? document.getElementById('attivita-attrezzo').value || null : null;
    
    // Verifica conflitti di orario per macchine/attrezzi
    if (hasParcoMacchineModule && (macchinaId || attrezzoId)) {
        const conflitto = verificaConflittiMacchine(
            macchinaId, 
            attrezzoId, 
            data, 
            orarioInizio, 
            orarioFine, 
            currentAttivitaId
        );
        
        if (conflitto) {
            showAlert(conflitto.messaggio, 'error');
            return;
        }
    }
    
    // Calcola ore nette (in formato decimale per salvataggio)
    // Se modalità Conto Terzi, usa ore manuali
    // Calcola ore nette
    let oreNette;
    if (isContoTerziMode) {
        // Calcola ore nette da orari per modalità Conto Terzi
        const [inizioOre, inizioMinuti] = orarioInizio.split(':').map(Number);
        const [fineOre, fineMinuti] = orarioFine.split(':').map(Number);
        const inizioMinutiTotali = inizioOre * 60 + inizioMinuti;
        const fineMinutiTotali = fineOre * 60 + fineMinuti;
        let minutiTotali = fineMinutiTotali - inizioMinutiTotali - pauseMinuti;
        if (minutiTotali < 0) minutiTotali = 0;
        oreNette = parseFloat((minutiTotali / 60).toFixed(2));
    } else {
        oreNette = calculateOreNette().decimali;
    }
    
    const oreMacchinaInput = hasParcoMacchineModule ? document.getElementById('attivita-ore-macchina').value : null;
    const oreMacchina = oreMacchinaInput ? parseFloat(oreMacchinaInput) : (oreNette || null); // Default = ore nette se non specificato
    
    // Prepara dati
    const attivitaData = {
        data: data,
        terrenoId: terrenoId,
        terrenoNome: terreno.nome,
        tipoLavoro: tipoLavoro,
        coltura: coltura || null,
        orarioInizio: orarioInizio || null,
        orarioFine: orarioFine || null,
        pauseMinuti: pauseMinuti,
        oreNette: oreNette,
        note: note || null,
        updatedAt: serverTimestamp()
    };
    
    // Aggiungi campi Conto Terzi se modalità attiva
    if (isContoTerziMode) {
        attivitaData.clienteId = clienteId;
        attivitaData.lavoroId = lavoroId;
        // Trova nome cliente
        const cliente = clientiList.find(c => c.id === clienteId);
        if (cliente) {
            attivitaData.clienteNome = cliente.ragioneSociale || cliente.nome || 'Cliente senza nome';
        }
    }
    
    // Aggiungi campi macchina solo se modulo attivo e se presenti
    if (hasParcoMacchineModule) {
        if (macchinaId) attivitaData.macchinaId = macchinaId;
        if (attrezzoId) attivitaData.attrezzoId = attrezzoId;
        if (oreMacchina !== null) attivitaData.oreMacchina = oreMacchina;
    }
    
    try {
        const attivitaCollection = await getAttivitaCollection(currentTenantId, params.db);
        
        if (currentAttivitaId) {
            // Aggiorna
            // Gestione vendemmia collegata (se modulo vigneto attivo)
            try {
                const { hasModuleAccess } = await import('../../core/services/tenant-service.js');
                const hasVignetoModule = await hasModuleAccess('vigneto');
                
                if (hasVignetoModule) {
                    const { findVendemmiaByAttivitaId, deleteVendemmia, updateVendemmia } = await import('../../modules/vigneto/services/vendemmia-service.js');
                    const vendemmiaCollegata = await findVendemmiaByAttivitaId(currentAttivitaId);
                    
                    if (vendemmiaCollegata) {
                        const attivitaOriginale = attivita.find(a => a.id === currentAttivitaId);
                        const tipoLavoroOriginale = attivitaOriginale?.tipoLavoro || '';
                        const tipoLavoroNuovo = attivitaData.tipoLavoro || '';
                        const terrenoOriginaleId = attivitaOriginale?.terrenoId;
                        const terrenoNuovoId = attivitaData.terrenoId;
                        
                        // Verifica se terreno originale era VITE
                        let terrenoOriginaleEraVite = false;
                        if (terrenoOriginaleId) {
                            const terrenoOriginale = terreni.find(t => t.id === terrenoOriginaleId);
                            terrenoOriginaleEraVite = terrenoOriginale?.coltura?.toLowerCase().includes('vite') || false;
                        }
                        
                        // Verifica se terreno nuovo è VITE
                        let terrenoNuovoEVite = false;
                        if (terrenoNuovoId) {
                            const terrenoNuovo = terreni.find(t => t.id === terrenoNuovoId);
                            terrenoNuovoEVite = terrenoNuovo?.coltura?.toLowerCase().includes('vite') || false;
                        }
                        
                        // Caso 1: Tipo lavoro cambiato da vendemmia a altro → elimina vendemmia
                        if (tipoLavoroOriginale.toLowerCase().includes('vendemmia') && 
                            !tipoLavoroNuovo.toLowerCase().includes('vendemmia')) {
                            console.log('[ATTIVITA-EVENTS] Tipo lavoro cambiato da vendemmia a altro, elimino vendemmia collegata');
                            await deleteVendemmia(vendemmiaCollegata.vignetoId, vendemmiaCollegata.vendemmiaId);
                            console.log('[ATTIVITA-EVENTS] ✓ Vendemmia eliminata');
                        }
                        // Caso 2: Terreno cambiato da VITE a altro → scollega vendemmia
                        else if (terrenoOriginaleEraVite && !terrenoNuovoEVite) {
                            console.log('[ATTIVITA-EVENTS] Terreno cambiato da VITE a altro, scollego vendemmia');
                            await updateVendemmia(vendemmiaCollegata.vignetoId, vendemmiaCollegata.vendemmiaId, {
                                attivitaId: null
                            });
                            console.log('[ATTIVITA-EVENTS] ✓ Vendemmia scollegata dall\'attività');
                        }
                    }
                }
            } catch (error) {
                console.warn('[ATTIVITA-EVENTS] Errore gestione vendemmia collegata:', error);
                // Non blocchiamo l'operazione principale
            }
            
            const attivitaRef = doc(attivitaCollection, currentAttivitaId);
            await updateDoc(attivitaRef, attivitaData);
            showAlert('Attività aggiornata con successo!', 'success');
        } else {
            // Crea
            attivitaData.createdAt = serverTimestamp();
            const attivitaDocRef = await addDoc(attivitaCollection, attivitaData);
            const attivitaId = attivitaDocRef.id;
            
            // Rilevamento automatico vendemmia: crea vendemmia se attività è di tipo vendemmia su terreno VITE
            // Funziona sia per attività con lavoroId che per attività dirette (senza lavoroId)
            console.log('[ATTIVITA-EVENTS] Verifica rilevamento vendemmia:', {
                terrenoId,
                tipoLavoro,
                lavoroId,
                attivitaId,
                terrenoColtura: terreni.find(t => t.id === terrenoId)?.coltura
            });
            
            if (terrenoId && tipoLavoro) {
                try {
                    const tipoLavoroLower = (tipoLavoro || '').toLowerCase();
                    if (tipoLavoroLower.includes('vendemmia')) {
                        console.log('[ATTIVITA-EVENTS] ✓ Rilevata attività vendemmia, verifica terreno VITE...');
                        
                        const { hasModuleAccess } = await import('../../core/services/tenant-service.js');
                        const hasVignetoModule = await hasModuleAccess('vigneto');
                        console.log('[ATTIVITA-EVENTS] Modulo vigneto attivo?', hasVignetoModule);
                        
                        if (hasVignetoModule) {
                            // Verifica coltura terreno
                            const terreno = terreni.find(t => t.id === terrenoId);
                            if (terreno && terreno.coltura && terreno.coltura.toLowerCase().includes('vite')) {
                                console.log('[ATTIVITA-EVENTS] ✓ Terreno VITE confermato (coltura:', terreno.coltura, '), creo vendemmia automatica...');
                                
                                // Se l'attività ha un lavoroId, usa quello, altrimenti crea vendemmia da attività diretta
                                if (lavoroId) {
                                    // Attività collegata a lavoro: crea vendemmia dal lavoro
                                    console.log('[ATTIVITA-EVENTS] Attività collegata a lavoro (lavoroId:', lavoroId, '), creo vendemmia dal lavoro...');
                                    const { createVendemmiaFromLavoro } = await import('../../modules/vigneto/services/vendemmia-service.js');
                                    const vendemmiaId = await createVendemmiaFromLavoro(lavoroId);
                                    
                                    if (vendemmiaId) {
                                        console.log('[ATTIVITA-EVENTS] ✓✓✓ Vendemmia creata automaticamente da lavoro:', vendemmiaId);
                                    } else {
                                        console.warn('[ATTIVITA-EVENTS] ⚠ Vendemmia non creata (vigneto non trovato?)');
                                    }
                                } else {
                                    // Attività diretta: crea vendemmia direttamente dall'attività
                                    console.log('[ATTIVITA-EVENTS] Attività diretta vendemmia (senza lavoroId, attivitaId:', attivitaId, '), creo vendemmia dall\'attività...');
                                    const { createVendemmiaFromAttivita } = await import('../../modules/vigneto/services/vendemmia-service.js');
                                    const vendemmiaId = await createVendemmiaFromAttivita(attivitaId);
                                    
                                    if (vendemmiaId) {
                                        console.log('[ATTIVITA-EVENTS] ✓✓✓ Vendemmia creata automaticamente dall\'attività:', vendemmiaId);
                                    } else {
                                        console.warn('[ATTIVITA-EVENTS] ⚠ Vendemmia non creata (vigneto non trovato?)');
                                    }
                                }
                            } else {
                                console.log('[ATTIVITA-EVENTS] Terreno non è VITE:', terreno?.coltura);
                            }
                        } else {
                            console.log('[ATTIVITA-EVENTS] Modulo vigneto non attivo, skip rilevamento vendemmia');
                        }
                    } else {
                        console.log('[ATTIVITA-EVENTS] Tipo lavoro non è vendemmia:', tipoLavoro);
                    }
                } catch (error) {
                    console.error('[ATTIVITA-EVENTS] Errore rilevamento automatico vendemmia:', error);
                    console.error('[ATTIVITA-EVENTS] Stack:', error.stack);
                    // Non blocchiamo l'operazione principale
                }
            } else {
                console.log('[ATTIVITA-EVENTS] Skip rilevamento vendemmia:', {
                    hasTerrenoId: !!terrenoId,
                    hasTipoLavoro: !!tipoLavoro
                });
            }
            
            showAlert('Attività creata con successo!', 'success');
        }
        
        // Gestisci stato macchine e aggiorna ore (solo se modulo attivo)
        if (hasParcoMacchineModule && (macchinaId || attrezzoId)) {
            // Se si sta modificando un'attività esistente, verifica se le macchine sono cambiate
            if (currentAttivitaId) {
                const attivitaEsistente = attivita.find(a => a.id === currentAttivitaId);
                if (attivitaEsistente) {
                    // Se l'attività esistente aveva macchine diverse, libera quelle vecchie
                    if (attivitaEsistente.macchinaId && attivitaEsistente.macchinaId !== macchinaId) {
                        await updateMacchinaStato(attivitaEsistente.macchinaId, 'disponibile', currentTenantId, params.db, params.app, params.auth);
                    }
                    if (attivitaEsistente.attrezzoId && attivitaEsistente.attrezzoId !== attrezzoId) {
                        await updateMacchinaStato(attivitaEsistente.attrezzoId, 'disponibile', currentTenantId, params.db, params.app, params.auth);
                    }
                    
                    // Se l'attività esistente non aveva "ora fine" ma ora ce l'ha, libera le macchine
                    if (!attivitaEsistente.orarioFine && orarioFine) {
                        if (attivitaEsistente.macchinaId) {
                            await updateMacchinaStato(attivitaEsistente.macchinaId, 'disponibile', currentTenantId, params.db, params.app, params.auth);
                        }
                        if (attivitaEsistente.attrezzoId) {
                            await updateMacchinaStato(attivitaEsistente.attrezzoId, 'disponibile', currentTenantId, params.db, params.app, params.auth);
                        }
                    }
                    // Se l'attività esistente aveva "ora fine" ma ora non ce l'ha più, imposta come in_uso
                    if (attivitaEsistente.orarioFine && !orarioFine) {
                        if (macchinaId) {
                            await updateMacchinaStato(macchinaId, 'in_uso', currentTenantId, params.db, params.app, params.auth);
                        }
                        if (attrezzoId) {
                            await updateMacchinaStato(attrezzoId, 'in_uso', currentTenantId, params.db, params.app, params.auth);
                        }
                    }
                }
            }
            
            // Se c'è orario fine, libera le macchine (attività completata)
            if (orarioFine) {
                if (macchinaId) {
                    await updateMacchinaStato(macchinaId, 'disponibile', currentTenantId, params.db, params.app, params.auth);
                }
                if (attrezzoId) {
                    await updateMacchinaStato(attrezzoId, 'disponibile', currentTenantId, params.db, params.app, params.auth);
                }
                
                // Aggiorna ore macchine solo se ci sono ore da aggiungere
                if (oreMacchina > 0) {
                    try {
                        const service = await window.loadMacchineUtilizzoService();
                        if (service && service.aggiornaOreMacchinaDaUtilizzo) {
                            await service.aggiornaOreMacchinaDaUtilizzo({
                                macchinaId: macchinaId,
                                attrezzoId: attrezzoId,
                                oreMacchina: oreMacchina,
                                tenantId: currentTenantId,
                                showAlertCallback: showAlert
                            });
                        } else {
                            // Service non disponibile (probabilmente ambiente file://)
                            // L'attività è stata salvata correttamente, ma le ore macchina non sono state aggiornate automaticamente
                        }
                    } catch (error) {
                        // Non loggare errori se il service non è disponibile (ambiente file://)
                        if (window.location.protocol !== 'file:') {
                            console.error('Errore aggiornamento ore macchina:', error);
                        }
                    }
                }
            } else {
                // Se NON c'è orario fine, imposta macchine come "in_uso" (attività in corso)
                if (macchinaId) {
                    await updateMacchinaStato(macchinaId, 'in_uso', currentTenantId, params.db, params.app, params.auth);
                }
                if (attrezzoId) {
                    await updateMacchinaStato(attrezzoId, 'in_uso', currentTenantId, params.db, params.app, params.auth);
                }
            }
            
            // Ricarica macchine per aggiornare dropdown con stati aggiornati
            await loadMacchine();
        }
        
        closeAttivitaModal();
        // loadAttivita è il wrapper che non richiede parametri
        if (loadAttivita) {
            await loadAttivita();
        } else {
            console.error('❌ [handleSaveAttivita] loadAttivita non definito!');
        }
    } catch (error) {
        console.error('Errore salvataggio attività:', error);
        showAlert('Errore nel salvataggio: ' + error.message, 'error');
    }
}

// ============================================
// SALVATAGGIO ATTIVITÀ RAPIDA
// ============================================

/**
 * Salva attività rapida da form lavoro (modalità Conto Terzi)
 * @param {Object} params - Parametri della funzione
 * @param {string} params.lavoroId - ID del lavoro
 * @param {string} params.currentTenantId - Tenant ID corrente
 * @param {Array} params.clientiList - Array clienti
 * @param {Array} params.terreni - Array terreni
 * @param {boolean} params.hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {Array} params.macchineList - Array macchine (se modulo attivo)
 * @param {Array} params.lavoriList - Array lavori
 * @param {boolean} params.hasContoTerziModule - Se modulo Conto Terzi è attivo
 * @param {boolean} params.isContoTerziMode - Se è modalità Conto Terzi
 * @param {Array} params.attivita - Array attività completo
 * @param {Array} params.filteredAttivita - Array attività filtrate (modificato in place)
 * @param {Function} params.showAlert - Funzione mostra alert
 * @param {Function} params.serverTimestamp - Funzione server timestamp Firebase
 * @param {Function} params.getAttivitaCollection - Funzione ottenimento collection attività
 * @param {Function} params.addDoc - Funzione addDoc Firestore
 * @param {Function} params.doc - Funzione doc Firestore
 * @param {Function} params.updateDoc - Funzione updateDoc Firestore
 * @param {Function} params.getDoc - Funzione getDoc Firestore
 * @param {Object} params.db - Istanza Firestore
 * @param {Function} params.updateMacchinaStato - Funzione aggiornamento stato macchina
 * @param {Function} params.generaVoceDiarioContoTerzi - Callback per generare voce diario conto terzi
 * @param {Function} params.loadLavoriContoTerzi - Callback per ricaricare lavori conto terzi
 * @param {Function} params.loadAttivita - Callback per ricaricare attività
 * @param {Function} params.applyContoTerziFilter - Callback per applicare filtro conto terzi
 * @param {Function} params.renderAttivita - Callback per renderizzare attività
 * @param {Function} params.toggleFormRapido - Callback per chiudere form rapido
 */
export async function salvaAttivitaRapida({
    lavoroId,
    currentTenantId,
    clientiList,
    terreni,
    hasParcoMacchineModule,
    macchineList,
    lavoriList,
    hasContoTerziModule,
    isContoTerziMode,
    attivita,
    filteredAttivita,
    showAlert,
    serverTimestamp,
    getAttivitaCollection,
    addDoc,
    doc,
    updateDoc,
    getDoc,
    db,
    updateMacchinaStato,
    generaVoceDiarioContoTerzi,
    loadLavoriContoTerzi,
    loadAttivita,
    applyContoTerziFilter,
    renderAttivita,
    toggleFormRapido
}) {
    try {
        if (!currentTenantId) {
            showAlert('Errore: Tenant ID non disponibile', 'error');
            return;
        }
        
        const clienteId = document.getElementById(`rapido-cliente-${lavoroId}`).value;
        const lavoroIdValue = document.getElementById(`rapido-lavoro-${lavoroId}`).value;
        const terrenoId = document.getElementById(`rapido-terreno-${lavoroId}`).value;
        const tipoLavoro = document.getElementById(`rapido-tipo-lavoro-${lavoroId}`).value;
        const data = document.getElementById(`rapido-data-${lavoroId}`).value;
        const orarioInizio = document.getElementById(`rapido-ora-inizio-${lavoroId}`).value;
        const orarioFine = document.getElementById(`rapido-ora-fine-${lavoroId}`).value;
        const pauseMinuti = parseInt(document.getElementById(`rapido-pause-${lavoroId}`).value) || 0;
        const note = document.getElementById(`rapido-note-${lavoroId}`).value.trim();
        const lavoroTerminato = document.getElementById(`rapido-lavoro-terminato-${lavoroId}`).checked;
        
        // Validazioni
        if (!data) {
            showAlert('La data è obbligatoria', 'error');
            return;
        }
        
        const oggi = new Date();
        const oggiString = oggi.getFullYear() + '-' + 
                          String(oggi.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(oggi.getDate()).padStart(2, '0');
        if (data > oggiString) {
            showAlert('La data non può essere futura', 'error');
            return;
        }
        
        if (!orarioInizio || !orarioFine) {
            showAlert('Ora inizio e ora fine sono obbligatorie', 'error');
            return;
        }
        
        // Validazione logica orari
        const [inizioOre, inizioMinuti] = orarioInizio.split(':').map(Number);
        const [fineOre, fineMinuti] = orarioFine.split(':').map(Number);
        const inizioMinutiTotali = inizioOre * 60 + inizioMinuti;
        const fineMinutiTotali = fineOre * 60 + fineMinuti;
        
        if (fineMinutiTotali <= inizioMinutiTotali) {
            showAlert('L\'ora fine deve essere maggiore dell\'ora inizio', 'error');
            return;
        }
        
        // Calcola ore nette
        let minutiTotali = fineMinutiTotali - inizioMinutiTotali - pauseMinuti;
        if (minutiTotali < 0) minutiTotali = 0;
        const oreNette = parseFloat((minutiTotali / 60).toFixed(2));
        
        if (oreNette <= 0) {
            showAlert('Le ore nette devono essere maggiori di 0', 'error');
            return;
        }
        
        // Trova terreno e cliente
        const terreno = terreni.find(t => t.id === terrenoId);
        if (!terreno) {
            showAlert('Terreno non trovato', 'error');
            return;
        }
        
        const cliente = clientiList.find(c => c.id === clienteId);
        const clienteNome = cliente ? (cliente.ragioneSociale || cliente.nome || 'Cliente sconosciuto') : 'Cliente sconosciuto';
        
        // Campi macchina (solo se modulo attivo)
        let macchinaId = null;
        let attrezzoId = null;
        if (hasParcoMacchineModule) {
            macchinaId = document.getElementById(`rapido-trattore-${lavoroId}`).value || null;
            attrezzoId = document.getElementById(`rapido-attrezzo-${lavoroId}`).value || null;
        }
        
        // Prepara dati attività
        const attivitaData = {
            data: data,
            terrenoId: terrenoId,
            terrenoNome: terreno.nome,
            tipoLavoro: tipoLavoro,
            coltura: terreno.coltura || null,
            orarioInizio: orarioInizio,
            orarioFine: orarioFine,
            pauseMinuti: pauseMinuti,
            oreNette: oreNette,
            note: note || null,
            clienteId: clienteId,
            lavoroId: lavoroIdValue,
            clienteNome: clienteNome,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        // Aggiungi campi macchina se presenti
        if (macchinaId) attivitaData.macchinaId = macchinaId;
        if (attrezzoId) attivitaData.attrezzoId = attrezzoId;
        
        // Salva attività
        const attivitaCollection = getAttivitaCollection(currentTenantId, db);
        const attivitaDocRef = await addDoc(attivitaCollection, attivitaData);
        const attivitaId = attivitaDocRef.id;
        
        // Rilevamento automatico vendemmia: crea vendemmia se attività è di tipo vendemmia su terreno VITE
        // Funziona sia per attività con lavoroId che per attività dirette (senza lavoroId)
        console.log('[ATTIVITA-EVENTS] Verifica rilevamento vendemmia:', {
            terrenoId,
            tipoLavoro,
            lavoroIdValue,
            attivitaId,
            terrenoColtura: terreno?.coltura
        });
        
        if (terrenoId && tipoLavoro) {
            try {
                const tipoLavoroLower = (tipoLavoro || '').toLowerCase();
                if (tipoLavoroLower.includes('vendemmia')) {
                    console.log('[ATTIVITA-EVENTS] ✓ Rilevata attività vendemmia, verifica terreno VITE...');
                    
                    const { hasModuleAccess } = await import('../../core/services/tenant-service.js');
                    const hasVignetoModule = await hasModuleAccess('vigneto');
                    console.log('[ATTIVITA-EVENTS] Modulo vigneto attivo?', hasVignetoModule);
                    
                    if (hasVignetoModule) {
                        // Verifica coltura terreno (già caricato sopra)
                        if (terreno && terreno.coltura && terreno.coltura.toLowerCase().includes('vite')) {
                            console.log('[ATTIVITA-EVENTS] Terreno VITE confermato (coltura:', terreno.coltura, '), creo vendemmia automatica...');
                            
                            // Se l'attività ha un lavoroId, usa quello, altrimenti crea vendemmia da attività diretta
                            if (lavoroIdValue) {
                                // Attività collegata a lavoro: crea vendemmia dal lavoro
                                const { createVendemmiaFromLavoro } = await import('../../modules/vigneto/services/vendemmia-service.js');
                                const vendemmiaId = await createVendemmiaFromLavoro(lavoroIdValue);
                                
                                if (vendemmiaId) {
                                    console.log('[ATTIVITA-EVENTS] Vendemmia creata automaticamente da lavoro:', vendemmiaId);
                                } else {
                                    console.warn('[ATTIVITA-EVENTS] Vendemmia non creata (vigneto non trovato?)');
                                }
                            } else {
                                // Attività diretta: crea vendemmia direttamente dall'attività
                                console.log('[ATTIVITA-EVENTS] Attività diretta vendemmia (senza lavoroId, attivitaId:', attivitaId, '), creo vendemmia dall\'attività...');
                                const { createVendemmiaFromAttivita } = await import('../../modules/vigneto/services/vendemmia-service.js');
                                const vendemmiaId = await createVendemmiaFromAttivita(attivitaId);
                                
                                if (vendemmiaId) {
                                    console.log('[ATTIVITA-EVENTS] ✓✓✓ Vendemmia creata automaticamente dall\'attività:', vendemmiaId);
                                } else {
                                    console.warn('[ATTIVITA-EVENTS] ⚠ Vendemmia non creata (vigneto non trovato?)');
                                }
                            }
                        } else {
                            console.log('[ATTIVITA-EVENTS] Terreno non è VITE:', terreno?.coltura);
                        }
                    } else {
                        console.log('[ATTIVITA-EVENTS] Modulo vigneto non attivo, skip rilevamento vendemmia');
                    }
                } else {
                    console.log('[ATTIVITA-EVENTS] Tipo lavoro non è vendemmia:', tipoLavoro);
                }
            } catch (error) {
                console.error('[ATTIVITA-EVENTS] Errore rilevamento automatico vendemmia:', error);
                console.error('[ATTIVITA-EVENTS] Stack:', error.stack);
                // Non blocchiamo l'operazione principale
            }
        } else {
            console.log('[ATTIVITA-EVENTS] Skip rilevamento vendemmia:', {
                hasTerrenoId: !!terrenoId,
                hasTipoLavoro: !!tipoLavoro
            });
        }
        
        // Se checkbox "lavoro terminato" è selezionato, aggiorna stato lavoro
        if (lavoroTerminato) {
            try {
                const lavoroRef = doc(db, 'tenants', currentTenantId, 'lavori', lavoroIdValue);
                const lavoroOriginale = lavoriList.find(l => l.id === lavoroIdValue);
                const lavoroEraCompletato = lavoroOriginale?.stato === 'completato';
                
                const lavoroData = {
                    stato: 'completato',
                    aggiornatoIl: serverTimestamp()
                };
                await updateDoc(lavoroRef, lavoroData);
                
                // Genera voce diario automatica se lavoro conto terzi completato
                if (!lavoroEraCompletato && lavoroOriginale?.clienteId && hasContoTerziModule) {
                    const lavoroCompletatoDoc = await getDoc(lavoroRef);
                    if (lavoroCompletatoDoc.exists()) {
                        const lavoroCompletatoData = { id: lavoroIdValue, ...lavoroCompletatoDoc.data() };
                        // Passa orari dalla attività appena salvata
                        // La callback generaVoceDiarioContoTerzi accetta (lavoroId, lavoroData, orariOpzionali)
                        await generaVoceDiarioContoTerzi(lavoroIdValue, lavoroCompletatoData, {
                            orarioInizio: orarioInizio,
                            orarioFine: orarioFine,
                            pauseMinuti: pauseMinuti,
                            oreNette: oreNette
                        });
                    }
                }
                
                // Se Parco Macchine attivo, libera macchine assegnate al lavoro
                if (hasParcoMacchineModule) {
                    const lavoro = lavoriList.find(l => l.id === lavoroIdValue);
                    if (lavoro) {
                        if (lavoro.macchinaId) {
                            await updateMacchinaStato(lavoro.macchinaId, 'disponibile', currentTenantId, params.db, params.app, params.auth);
                        }
                        if (lavoro.attrezzoId) {
                            await updateMacchinaStato(lavoro.attrezzoId, 'disponibile', currentTenantId, params.db, params.app, params.auth);
                        }
                    }
                }
                
                // Aggiorna vigneti se modulo Vigneto attivo
                try {
                    const { hasModuleAccess } = await import('../../core/services/tenant-service.js');
                    const hasVignetoModule = await hasModuleAccess('vigneto');
                    
                    if (hasVignetoModule && lavoroOriginale?.terrenoId) {
                        const { aggiornaVignetiDaTerreno } = await import('../../modules/vigneto/services/lavori-vigneto-service.js');
                        const annoLavoro = lavoroOriginale.dataInizio?.toDate 
                            ? lavoroOriginale.dataInizio.toDate().getFullYear() 
                            : new Date().getFullYear();
                        await aggiornaVignetiDaTerreno(lavoroOriginale.terrenoId, annoLavoro);
                    }
                } catch (error) {
                    console.warn('[ATTIVITA-EVENTS] Errore aggiornamento vigneti:', error);
                    // Non blocchiamo l'operazione principale
                }
                
                showAlert('Attività creata e lavoro segnato come completato!', 'success');
                
                // Ricarica lavori per aggiornare lista
                await loadLavoriContoTerzi();
            } catch (error) {
                console.error('Errore aggiornamento stato lavoro:', error);
                showAlert('Attività creata, ma errore nell\'aggiornamento stato lavoro', 'warning');
            }
        } else {
            showAlert('Attività creata con successo!', 'success');
        }
        
        // Reset form
        document.getElementById(`form-rapido-${lavoroId}`).reset();
        const today = new Date().toISOString().split('T')[0];
        document.getElementById(`rapido-data-${lavoroId}`).value = today;
        toggleFormRapido(lavoroId); // Chiudi form
        
        // Ricarica attività e lavori
        await loadAttivita();
        if (isContoTerziMode) {
            await loadLavoriContoTerzi();
            // Se c'è un filtro stato, riapplica
            const urlParams = new URLSearchParams(window.location.search);
            const statoFiltro = urlParams.get('stato');
            if (statoFiltro) {
                applyContoTerziFilter(statoFiltro);
            } else {
                // Filtra solo attività conto terzi
                filteredAttivita.length = 0;
                filteredAttivita.push(...attivita.filter(a => a.clienteId != null && a.clienteId !== ''));
                renderAttivita();
            }
        } else {
            renderAttivita();
        }
        
    } catch (error) {
        console.error('Errore salvataggio attività rapida:', error);
        showAlert(`Errore: ${error.message}`, 'error');
    }
}

// ============================================
// MODAL CATEGORIA LAVORO
// ============================================

/**
 * Apre il modal per creare una nuova categoria lavoro
 */
export function openCategoriaLavoroModal() {
    const form = document.getElementById('categoria-lavoro-form');
    const modal = document.getElementById('categoria-lavoro-modal');
    if (form) form.reset();
    if (modal) modal.classList.add('active');
}

/**
 * Chiude il modal categoria lavoro
 */
export function closeCategoriaLavoroModal() {
    const modal = document.getElementById('categoria-lavoro-modal');
    const form = document.getElementById('categoria-lavoro-form');
    if (modal) modal.classList.remove('active');
    if (form) form.reset();
}

/**
 * Gestisce il salvataggio di una nuova categoria lavoro
 * @param {Object} params - Parametri della funzione
 * @param {Event} params.event - Evento submit del form
 * @param {string} params.currentTenantId - Tenant ID corrente
 * @param {Object} params.currentUserData - Dati utente corrente
 * @param {Object} params.db - Istanza Firestore
 * @param {Function} params.collection - Funzione collection Firestore
 * @param {Function} params.query - Funzione query Firestore
 * @param {Function} params.getDocs - Funzione getDocs Firestore
 * @param {Function} params.where - Funzione where Firestore
 * @param {Function} params.addDoc - Funzione addDoc Firestore
 * @param {Function} params.serverTimestamp - Funzione server timestamp Firebase
 * @param {Function} params.showAlert - Funzione mostra alert
 * @param {Function} params.closeCategoriaLavoroModal - Callback per chiudere modal
 * @param {Function} params.loadCategorieLavori - Callback per ricaricare categorie
 */
export async function handleSalvaCategoriaLavoro({
    event,
    currentTenantId,
    currentUserData,
    db,
    collection,
    query,
    getDocs,
    where,
    addDoc,
    serverTimestamp,
    showAlert,
    closeCategoriaLavoroModal,
    loadCategorieLavori
}) {
    event.preventDefault();

    const nome = document.getElementById('categoria-lavoro-nome').value.trim();
    const descrizione = document.getElementById('categoria-lavoro-descrizione').value.trim() || null;

    if (!nome || nome.length < 3) {
        showAlert('Il nome categoria deve essere di almeno 3 caratteri', 'error');
        return;
    }

    try {
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
        
        await loadCategorieLavori();
        
        // Seleziona la nuova categoria nel form attività
        const categoriaSelect = document.getElementById('attivita-categoria-principale');
        if (categoriaSelect) {
            categoriaSelect.value = categoriaDoc.id;
            categoriaSelect.dispatchEvent(new Event('change'));
        }
    } catch (error) {
        console.error('Errore salvataggio categoria:', error);
        showAlert('Errore salvataggio categoria: ' + error.message, 'error');
    }
}

// ============================================
// MODAL TIPO LAVORO
// ============================================

/**
 * Apre il modal per creare un nuovo tipo lavoro
 * @param {Object} params - Parametri della funzione
 * @param {Array} params.categorieLavoriPrincipali - Array categorie principali
 * @param {Map} params.sottocategorieLavoriMap - Mappa sottocategorie
 * @param {Function} params.showAlert - Funzione mostra alert
 */
export function openTipoLavoroModal({
    categorieLavoriPrincipali,
    sottocategorieLavoriMap,
    showAlert
}) {
    const categoriaPrincipaleId = document.getElementById('attivita-categoria-principale')?.value;
    const sottocategoriaId = document.getElementById('attivita-sottocategoria')?.value;
    
    if (!categoriaPrincipaleId) {
        showAlert('Seleziona prima una categoria principale lavoro', 'error');
        return;
    }

    // Usa sottocategoria se selezionata, altrimenti categoria principale
    const categoriaId = sottocategoriaId || categoriaPrincipaleId;

    const form = document.getElementById('tipo-lavoro-form');
    const categoriaSelectModal = document.getElementById('tipo-lavoro-categoria');
    const modal = document.getElementById('tipo-lavoro-modal');
    
    if (form) form.reset();
    if (categoriaSelectModal) {
        categoriaSelectModal.value = categoriaId;
        categoriaSelectModal.innerHTML = '<option value="">-- Seleziona categoria --</option>';
        
        // Aggiungi categorie principali
        categorieLavoriPrincipali.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.nome;
            if (cat.id === categoriaId) {
                option.selected = true;
            }
            categoriaSelectModal.appendChild(option);
            
            // Aggiungi sottocategorie
            const sottocat = sottocategorieLavoriMap.get(cat.id);
            if (sottocat) {
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
        });
    }
    
    if (modal) modal.classList.add('active');
}

/**
 * Chiude il modal tipo lavoro
 */
export function closeTipoLavoroModal() {
    const modal = document.getElementById('tipo-lavoro-modal');
    const form = document.getElementById('tipo-lavoro-form');
    if (modal) modal.classList.remove('active');
    if (form) form.reset();
}

/**
 * Gestisce il salvataggio di un nuovo tipo lavoro
 * @param {Object} params - Parametri della funzione
 * @param {Event} params.event - Evento submit del form
 * @param {string} params.currentTenantId - Tenant ID corrente
 * @param {Object} params.currentUserData - Dati utente corrente
 * @param {Object} params.db - Istanza Firestore
 * @param {Function} params.collection - Funzione collection Firestore
 * @param {Function} params.query - Funzione query Firestore
 * @param {Function} params.getDocs - Funzione getDocs Firestore
 * @param {Function} params.where - Funzione where Firestore
 * @param {Function} params.doc - Funzione doc Firestore
 * @param {Function} params.getDoc - Funzione getDoc Firestore
 * @param {Function} params.addDoc - Funzione addDoc Firestore
 * @param {Function} params.serverTimestamp - Funzione server timestamp Firebase
 * @param {Function} params.showAlert - Funzione mostra alert
 * @param {Function} params.closeTipoLavoroModal - Callback per chiudere modal
 * @param {Function} params.loadTipiLavoro - Callback per ricaricare tipi lavoro
 */
export async function handleSalvaTipoLavoro({
    event,
    currentTenantId,
    currentUserData,
    db,
    collection,
    query,
    getDocs,
    where,
    doc,
    getDoc,
    addDoc,
    serverTimestamp,
    showAlert,
    closeTipoLavoroModal,
    loadTipiLavoro
}) {
    event.preventDefault();

    const nome = document.getElementById('tipo-lavoro-nome').value.trim();
    const categoriaId = document.getElementById('tipo-lavoro-categoria').value;
    const descrizione = document.getElementById('tipo-lavoro-descrizione').value.trim() || null;

    if (!nome || nome.length < 2) {
        showAlert('Il nome tipo lavoro deve essere di almeno 2 caratteri', 'error');
        return;
    }

    if (!categoriaId) {
        showAlert('Seleziona una categoria', 'error');
        return;
    }

    try {
        // Verifica che la categoria esista (nella collezione unificata)
        const categoriaDoc = await getDoc(doc(db, `tenants/${currentTenantId}/categorie`, categoriaId));
        if (!categoriaDoc.exists()) {
            showAlert('Categoria lavoro non trovata', 'error');
            return;
        }
        
        // Verifica che non esista già un tipo con lo stesso nome nella stessa categoria
        const tipiRef = collection(db, `tenants/${currentTenantId}/tipiLavoro`);
        const tipiSnapshot = await getDocs(query(tipiRef, where('categoriaId', '==', categoriaId)));
        
        const tipoEsistente = tipiSnapshot.docs.find(doc => {
            const data = doc.data();
            return data.nome && data.nome.toLowerCase() === nome.toLowerCase();
        });
        
        if (tipoEsistente) {
            showAlert(`Un tipo lavoro con nome "${nome}" esiste già in questa categoria`, 'error');
            return;
        }
        
        const tipoLavoroData = {
            nome,
            categoriaId,
            descrizione,
            predefinito: false,
            creatoDa: currentUserData.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        const tipoDoc = await addDoc(tipiRef, tipoLavoroData);
        
        showAlert('Tipo lavoro creato con successo', 'success');
        closeTipoLavoroModal();
        
        // Ricarica tipi lavoro per la categoria selezionata
        await loadTipiLavoro(categoriaId);
        
        // Seleziona il nuovo tipo nel form attività
        const tipoSelect = document.getElementById('attivita-tipo-lavoro-gerarchico');
        if (tipoSelect) {
            tipoSelect.value = nome;
        }
    } catch (error) {
        console.error('Errore salvataggio tipo lavoro:', error);
        showAlert('Errore salvataggio tipo lavoro: ' + error.message, 'error');
    }
}


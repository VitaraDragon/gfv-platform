/**
 * Gestione Macchine Events - Event handlers per modal e form
 * 
 * @module core/admin/js/gestione-macchine-events
 */

// ============================================
// IMPORTS
// ============================================
import { showAlert, escapeHtml } from './gestione-macchine-utils.js';

// ============================================
// FUNZIONI SETUP HANDLERS
// ============================================

/**
 * Setup form dinamico (mostra/nascondi campi in base a trattore/attrezzo)
 * @param {Function} populateSottocategorieCallback - Callback per popolare sottocategorie
 * @param {Function} filterMacchineCallback - Callback per filtrare macchine
 */
export function setupFormDinamico(populateSottocategorieCallback, filterMacchineCallback) {
    const tipoTrattore = document.getElementById('tipo-trattore');
    const tipoAttrezzo = document.getElementById('tipo-attrezzo');
    const campoCavalli = document.getElementById('campo-cavalli-group');
    const campoCategoria = document.getElementById('campo-categoria-group');
    const campoCavalliMinimi = document.getElementById('campo-cavalli-minimi-group');
    
    function updateFormFields() {
        const isTrattore = tipoTrattore?.checked || false;
        const isAttrezzo = tipoAttrezzo?.checked || false;
        
        // Mostra/nascondi campi
        if (campoCavalli) campoCavalli.style.display = isTrattore ? 'block' : 'none';
        if (campoCategoria) campoCategoria.style.display = isAttrezzo ? 'block' : 'none';
        if (campoCavalliMinimi) campoCavalliMinimi.style.display = isAttrezzo ? 'block' : 'none';
        
        // Aggiorna required
        const cavalliInput = document.getElementById('macchina-cavalli');
        const categoriaSelect = document.getElementById('macchina-categoria');
        const cavalliMinimiInput = document.getElementById('macchina-cavalli-minimi');
        
        if (cavalliInput) {
            cavalliInput.required = isTrattore;
            if (!isTrattore) cavalliInput.value = '';
        }
        if (categoriaSelect) {
            categoriaSelect.required = isAttrezzo;
            if (!isAttrezzo) categoriaSelect.value = '';
        }
        if (cavalliMinimiInput) {
            cavalliMinimiInput.required = isAttrezzo;
            if (!isAttrezzo) cavalliMinimiInput.value = '';
        }
    }
    
    if (tipoTrattore) tipoTrattore.addEventListener('change', updateFormFields);
    if (tipoAttrezzo) tipoAttrezzo.addEventListener('change', updateFormFields);
    
    // Event listener per cambio categoria principale (mostra sottocategorie)
    const categoriaPrincipaleSelect = document.getElementById('macchina-categoria-principale');
    if (categoriaPrincipaleSelect) {
        categoriaPrincipaleSelect.addEventListener('change', function() {
            const categoriaPrincipaleId = this.value;
            if (populateSottocategorieCallback) {
                populateSottocategorieCallback(categoriaPrincipaleId);
            }
        });
    }
    
    // Aggiorna anche filtro categoria quando cambia tipo
    const filterTipo = document.getElementById('filter-tipo');
    if (filterTipo) {
        filterTipo.addEventListener('change', function() {
            const filterCategoriaGroup = document.getElementById('filter-categoria-group');
            if (filterCategoriaGroup) {
                filterCategoriaGroup.style.display = this.value === 'attrezzo' ? 'block' : 'none';
                if (this.value !== 'attrezzo') {
                    const filterCategoria = document.getElementById('filter-categoria');
                    if (filterCategoria) filterCategoria.value = 'tutte';
                }
                if (filterMacchineCallback) {
                    filterMacchineCallback();
                }
            }
        });
    }
}

/**
 * Setup filtri
 * @param {Function} filterMacchineCallback - Callback per filtrare macchine
 */
export function setupFilters(filterMacchineCallback) {
    const filterStato = document.getElementById('filter-stato');
    const filterTipo = document.getElementById('filter-tipo');
    const filterAttive = document.getElementById('filter-attive');
    const filterCategoria = document.getElementById('filter-categoria');
    const filterCategoriaGroup = document.getElementById('filter-categoria-group');
    
    if (filterStato) filterStato.addEventListener('change', () => {
        if (filterMacchineCallback) filterMacchineCallback();
    });
    if (filterAttive) filterAttive.addEventListener('change', () => {
        if (filterMacchineCallback) filterMacchineCallback();
    });
    
    if (filterTipo) {
        filterTipo.addEventListener('change', () => {
            if (filterCategoriaGroup) {
                filterCategoriaGroup.style.display = filterTipo.value === 'attrezzo' ? 'block' : 'none';
                if (filterTipo.value !== 'attrezzo' && filterCategoria) {
                    filterCategoria.value = 'tutte';
                }
            }
            if (filterMacchineCallback) filterMacchineCallback();
        });
    }
    
    if (filterCategoria) {
        filterCategoria.addEventListener('change', () => {
            if (filterMacchineCallback) filterMacchineCallback();
        });
    }
}

/**
 * Reset filtri
 * @param {Function} filterMacchineCallback - Callback per filtrare macchine
 */
export function resetFilters(filterMacchineCallback) {
    const filterStato = document.getElementById('filter-stato');
    const filterTipo = document.getElementById('filter-tipo');
    const filterAttive = document.getElementById('filter-attive');
    const filterCategoria = document.getElementById('filter-categoria');
    const filterCategoriaGroup = document.getElementById('filter-categoria-group');
    
    if (filterStato) filterStato.value = 'tutti';
    if (filterTipo) filterTipo.value = 'tutti';
    if (filterAttive) filterAttive.value = 'false';
    if (filterCategoria) filterCategoria.value = 'tutte';
    if (filterCategoriaGroup) filterCategoriaGroup.style.display = 'none';
    
    if (filterMacchineCallback) filterMacchineCallback();
}

// ============================================
// FUNZIONI MODAL MACCHINA
// ============================================

/**
 * Apri modal macchina
 * @param {string|null} macchinaId - ID macchina (null per nuova)
 * @param {Object} state - State object con macchine, categoriePrincipali, sottocategorieMap
 * @param {Function} setupFormDinamicoCallback - Callback per setup form dinamico
 * @param {Function} populateSottocategorieCallback - Callback per popolare sottocategorie
 * @param {Function} loadStoricoGuastiCallback - Callback per caricare storico guasti
 */
export async function openMacchinaModal(macchinaId, state, setupFormDinamicoCallback, populateSottocategorieCallback, loadStoricoGuastiCallback) {
    const { macchine, categoriePrincipali, sottocategorieMap } = state;
    const form = document.getElementById('macchina-form');
    const modalTitle = document.getElementById('modal-title');
    const macchinaIdInput = document.getElementById('macchina-id');
    const tipoTrattore = document.getElementById('tipo-trattore');
    const tipoAttrezzo = document.getElementById('tipo-attrezzo');
    
    if (form) form.reset();
    if (macchinaIdInput) macchinaIdInput.value = macchinaId || '';
    
    // Reset radio buttons
    if (tipoTrattore) tipoTrattore.checked = false;
    if (tipoAttrezzo) tipoAttrezzo.checked = false;

    if (macchinaId) {
        const macchina = macchine.find(m => m.id === macchinaId);
        if (!macchina) return;

        if (modalTitle) modalTitle.textContent = 'Modifica Macchina';
        
        const tipoMacchina = macchina.tipoMacchina || macchina.tipo || '';
        
        // Imposta tipo macchina
        if (tipoMacchina === 'trattore' && tipoTrattore) {
            tipoTrattore.checked = true;
        } else if (tipoMacchina === 'attrezzo' && tipoAttrezzo) {
            tipoAttrezzo.checked = true;
        }
        
        // Aggiorna campi dinamici
        if (setupFormDinamicoCallback) setupFormDinamicoCallback();
        const updateFields = () => {
            const campoCavalli = document.getElementById('campo-cavalli-group');
            const campoCategoria = document.getElementById('campo-categoria-group');
            const campoCavalliMinimi = document.getElementById('campo-cavalli-minimi-group');
            
            if (campoCavalli) campoCavalli.style.display = tipoTrattore?.checked ? 'block' : 'none';
            if (campoCategoria) campoCategoria.style.display = tipoAttrezzo?.checked ? 'block' : 'none';
            if (campoCavalliMinimi) campoCavalliMinimi.style.display = tipoAttrezzo?.checked ? 'block' : 'none';
        };
        updateFields();
        
        // Popola campi form
        const nomeInput = document.getElementById('macchina-nome');
        const statoSelect = document.getElementById('macchina-stato');
        const marcaInput = document.getElementById('macchina-marca');
        const modelloInput = document.getElementById('macchina-modello');
        const targaInput = document.getElementById('macchina-targa');
        const numeroTelaioInput = document.getElementById('macchina-numero-telaio');
        
        if (nomeInput) nomeInput.value = macchina.nome || '';
        if (statoSelect) statoSelect.value = macchina.stato || 'disponibile';
        if (marcaInput) marcaInput.value = macchina.marca || '';
        if (modelloInput) modelloInput.value = macchina.modello || '';
        if (targaInput) targaInput.value = macchina.targa || '';
        if (numeroTelaioInput) numeroTelaioInput.value = macchina.numeroTelaio || '';
        
        // Campi trattore
        if (tipoMacchina === 'trattore') {
            const cavalliInput = document.getElementById('macchina-cavalli');
            if (cavalliInput) cavalliInput.value = macchina.cavalli || '';
        }
        
        // Campi attrezzo
        if (tipoMacchina === 'attrezzo') {
            // Usa categoriaId se disponibile, altrimenti categoriaFunzione (retrocompatibilità)
            const categoriaId = macchina.categoriaId || macchina.categoriaFunzione;
            
            // Trova se è una sottocategoria o categoria principale
            let categoriaPrincipaleId = null;
            let sottocategoriaId = null;
            
            // Cerca in tutte le categorie
            const allCategorie = [...categoriePrincipali];
            sottocategorieMap.forEach(sottocat => {
                allCategorie.push(...sottocat);
            });
            
            const categoriaTrovata = allCategorie.find(c => c.id === categoriaId);
            if (categoriaTrovata) {
                if (categoriaTrovata.parentId) {
                    // È una sottocategoria
                    sottocategoriaId = categoriaTrovata.id;
                    categoriaPrincipaleId = categoriaTrovata.parentId;
                } else {
                    // È una categoria principale
                    categoriaPrincipaleId = categoriaTrovata.id;
                }
            }
            
            if (categoriaPrincipaleId) {
                const categoriaPrincipaleSelect = document.getElementById('macchina-categoria-principale');
                if (categoriaPrincipaleSelect) {
                    categoriaPrincipaleSelect.value = categoriaPrincipaleId;
                    if (populateSottocategorieCallback) {
                        populateSottocategorieCallback(categoriaPrincipaleId, sottocategoriaId);
                    }
                }
            }
            
            const cavalliMinimiInput = document.getElementById('macchina-cavalli-minimi');
            if (cavalliMinimiInput) cavalliMinimiInput.value = macchina.cavalliMinimiRichiesti || '';
        }
        
        // Campi comuni
        if (macchina.dataAcquisto) {
            const dataAcquistoInput = document.getElementById('macchina-data-acquisto');
            if (dataAcquistoInput) {
                const dataAcquisto = macchina.dataAcquisto.toDate ? macchina.dataAcquisto.toDate() : new Date(macchina.dataAcquisto);
                dataAcquistoInput.value = dataAcquisto.toISOString().split('T')[0];
            }
        }
        
        const oreInizialiInput = document.getElementById('macchina-ore-iniziali');
        const oreAttualiInput = document.getElementById('macchina-ore-attuali');
        const costoOraInput = document.getElementById('macchina-costo-ora');
        const prossimaManutenzioneInput = document.getElementById('macchina-prossima-manutenzione');
        const oreProssimaManutenzioneInput = document.getElementById('macchina-ore-prossima-manutenzione');
        const noteTextarea = document.getElementById('macchina-note');
        
        if (oreInizialiInput) oreInizialiInput.value = macchina.oreIniziali || 0;
        if (oreAttualiInput) oreAttualiInput.value = macchina.oreAttuali || '';
        if (costoOraInput) costoOraInput.value = macchina.costoOra || '';
        
        if (macchina.prossimaManutenzione) {
            if (prossimaManutenzioneInput) {
                const prossimaManutenzione = macchina.prossimaManutenzione.toDate ? macchina.prossimaManutenzione.toDate() : new Date(macchina.prossimaManutenzione);
                prossimaManutenzioneInput.value = prossimaManutenzione.toISOString().split('T')[0];
            }
        }
        
        if (oreProssimaManutenzioneInput) oreProssimaManutenzioneInput.value = macchina.oreProssimaManutenzione || '';
        if (noteTextarea) noteTextarea.value = macchina.note || '';
        
        // Carica storico guasti
        if (loadStoricoGuastiCallback) {
            await loadStoricoGuastiCallback(macchinaId);
        }
    } else {
        if (modalTitle) modalTitle.textContent = 'Nuova Macchina';
        const oreInizialiInput = document.getElementById('macchina-ore-iniziali');
        const costoOraInput = document.getElementById('macchina-costo-ora');
        const storicoSection = document.getElementById('storico-guasti-section');
        
        if (oreInizialiInput) oreInizialiInput.value = 0;
        if (costoOraInput) costoOraInput.value = '';
        if (storicoSection) storicoSection.style.display = 'none';
    }

    const modal = document.getElementById('macchina-modal');
    if (modal) modal.classList.add('active');
}

/**
 * Chiudi modal macchina
 */
export function closeMacchinaModal() {
    const modal = document.getElementById('macchina-modal');
    const form = document.getElementById('macchina-form');
    const storicoSection = document.getElementById('storico-guasti-section');
    
    if (modal) modal.classList.remove('active');
    if (form) form.reset();
    if (storicoSection) storicoSection.style.display = 'none';
}

/**
 * Salva macchina
 * @param {Event} e - Event object
 * @param {string} tenantId - ID tenant
 * @param {string} userId - ID utente corrente
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Function} showAlertCallback - Callback per mostrare alert
 * @param {Function} closeMacchinaModalCallback - Callback per chiudere modal
 */
export async function handleSalvaMacchina(e, tenantId, userId, dependencies, showAlertCallback, closeMacchinaModalCallback) {
    e.preventDefault();
    const { doc, collection, addDoc, updateDoc, Timestamp, db } = dependencies;

    const macchinaIdInput = document.getElementById('macchina-id');
    const nomeInput = document.getElementById('macchina-nome');
    const tipoTrattore = document.getElementById('tipo-trattore');
    const tipoAttrezzo = document.getElementById('tipo-attrezzo');
    const statoSelect = document.getElementById('macchina-stato');
    const marcaInput = document.getElementById('macchina-marca');
    const modelloInput = document.getElementById('macchina-modello');
    const targaInput = document.getElementById('macchina-targa');
    const numeroTelaioInput = document.getElementById('macchina-numero-telaio');
    const dataAcquistoInput = document.getElementById('macchina-data-acquisto');
    const oreInizialiInput = document.getElementById('macchina-ore-iniziali');
    const oreAttualiInput = document.getElementById('macchina-ore-attuali');
    const costoOraInput = document.getElementById('macchina-costo-ora');
    const prossimaManutenzioneInput = document.getElementById('macchina-prossima-manutenzione');
    const oreProssimaManutenzioneInput = document.getElementById('macchina-ore-prossima-manutenzione');
    const noteTextarea = document.getElementById('macchina-note');

    const macchinaId = macchinaIdInput?.value || '';
    const nome = nomeInput?.value.trim() || '';
    const tipoTrattoreChecked = tipoTrattore?.checked || false;
    const tipoAttrezzoChecked = tipoAttrezzo?.checked || false;
    const tipoMacchina = tipoTrattoreChecked ? 'trattore' : tipoAttrezzoChecked ? 'attrezzo' : null;
    const stato = statoSelect?.value || 'disponibile';
    const marca = marcaInput?.value.trim() || null;
    const modello = modelloInput?.value.trim() || null;
    const targa = targaInput?.value.trim() || null;
    const numeroTelaio = numeroTelaioInput?.value.trim() || null;
    const dataAcquisto = dataAcquistoInput?.value || null;
    const oreIniziali = parseFloat(oreInizialiInput?.value) || 0;
    const oreAttualiInputValue = oreAttualiInput?.value || '';
    const oreAttuali = oreAttualiInputValue ? parseFloat(oreAttualiInputValue) : oreIniziali;
    const costoOraInputValue = costoOraInput?.value || '';
    const costoOra = costoOraInputValue ? parseFloat(costoOraInputValue) : null;
    const prossimaManutenzione = prossimaManutenzioneInput?.value || null;
    const oreProssimaManutenzioneInputValue = oreProssimaManutenzioneInput?.value || '';
    const oreProssimaManutenzione = oreProssimaManutenzioneInputValue ? parseFloat(oreProssimaManutenzioneInputValue) : null;
    const note = noteTextarea?.value.trim() || null;

    // Validazione
    if (!nome || nome.length < 3) {
        if (showAlertCallback) showAlertCallback('Il nome deve essere di almeno 3 caratteri', 'error');
        return;
    }

    if (!tipoMacchina) {
        if (showAlertCallback) showAlertCallback('Seleziona un tipo macchina (Trattore o Attrezzo)', 'error');
        return;
    }

    // Validazioni specifiche trattore
    if (tipoMacchina === 'trattore') {
        const cavalliInput = document.getElementById('macchina-cavalli');
        const cavalli = parseFloat(cavalliInput?.value);
        if (!cavalli || cavalli <= 0) {
            if (showAlertCallback) showAlertCallback('Inserisci la potenza del trattore in CV (maggiore di 0)', 'error');
            return;
        }
        if (cavalli > 1000) {
            if (showAlertCallback) showAlertCallback('I cavalli non possono superare 1000 CV', 'error');
            return;
        }
    }

    // Validazioni specifiche attrezzo e preparazione categoriaId
    let categoriaId = null;
    if (tipoMacchina === 'attrezzo') {
        const categoriaPrincipaleSelect = document.getElementById('macchina-categoria-principale');
        const sottocategoriaSelect = document.getElementById('macchina-sottocategoria');
        const categoriaPrincipaleId = categoriaPrincipaleSelect?.value;
        const sottocategoriaId = sottocategoriaSelect?.value;
        
        if (!categoriaPrincipaleId) {
            if (showAlertCallback) showAlertCallback('Seleziona una categoria principale per l\'attrezzo', 'error');
            return;
        }
        
        // Usa sottocategoria se selezionata, altrimenti categoria principale
        categoriaId = sottocategoriaId || categoriaPrincipaleId;
        
        const cavalliMinimiInput = document.getElementById('macchina-cavalli-minimi');
        if (!cavalliMinimiInput) {
            if (showAlertCallback) showAlertCallback('Campo cavalli minimi non trovato', 'error');
            return;
        }
        const cavalliMinimi = parseFloat(cavalliMinimiInput.value);
        
        if (!cavalliMinimi || cavalliMinimi <= 0) {
            if (showAlertCallback) showAlertCallback('Inserisci i cavalli minimi richiesti (maggiore di 0)', 'error');
            return;
        }
        if (cavalliMinimi > 1000) {
            if (showAlertCallback) showAlertCallback('I cavalli minimi richiesti non possono superare 1000 CV', 'error');
            return;
        }
    }

    if (oreAttuali < oreIniziali) {
        if (showAlertCallback) showAlertCallback('Le ore attuali non possono essere inferiori alle ore iniziali', 'error');
        return;
    }

    try {
        const macchinaData = {
            nome,
            tipoMacchina,
            tipo: tipoMacchina, // Manteniamo anche tipo per retrocompatibilità
            stato,
            marca,
            modello,
            targa,
            numeroTelaio,
            dataAcquisto: dataAcquisto ? Timestamp.fromDate(new Date(dataAcquisto)) : null,
            oreIniziali,
            oreAttuali,
            prossimaManutenzione: prossimaManutenzione ? Timestamp.fromDate(new Date(prossimaManutenzione)) : null,
            oreProssimaManutenzione,
            costoOra,
            note,
            creatoDa: userId
        };
        
        // Campi specifici trattore
        if (tipoMacchina === 'trattore') {
            const cavalliInput = document.getElementById('macchina-cavalli');
            macchinaData.cavalli = parseFloat(cavalliInput?.value);
            macchinaData.categoriaId = null;
            macchinaData.categoriaFunzione = null; // Mantenuto per retrocompatibilità
            macchinaData.cavalliMinimiRichiesti = null;
        }
        
        // Campi specifici attrezzo
        if (tipoMacchina === 'attrezzo') {
            macchinaData.categoriaId = categoriaId;
            macchinaData.categoriaFunzione = categoriaId; // Mantenuto per retrocompatibilità
            const cavalliMinimiInput = document.getElementById('macchina-cavalli-minimi');
            macchinaData.cavalliMinimiRichiesti = parseFloat(cavalliMinimiInput?.value);
            macchinaData.cavalli = null;
        }

        if (macchinaId) {
            // Aggiorna
            const macchinaRef = doc(db, `tenants/${tenantId}/macchine`, macchinaId);
            await updateDoc(macchinaRef, macchinaData);
            if (showAlertCallback) showAlertCallback('Macchina aggiornata con successo', 'success');
        } else {
            // Crea nuova
            macchinaData.createdAt = Timestamp.now();
            macchinaData.updatedAt = Timestamp.now();
            await addDoc(collection(db, `tenants/${tenantId}/macchine`), macchinaData);
            if (showAlertCallback) showAlertCallback('Macchina creata con successo', 'success');
        }

        if (closeMacchinaModalCallback) closeMacchinaModalCallback();
        // Non serve ricaricare, il listener real-time aggiorna automaticamente
    } catch (error) {
        console.error('Errore salvataggio macchina:', error);
        if (showAlertCallback) showAlertCallback('Errore salvataggio macchina: ' + error.message, 'error');
    }
}

/**
 * Elimina macchina
 * @param {string} macchinaId - ID macchina
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Function} showAlertCallback - Callback per mostrare alert
 */
export async function deleteMacchina(macchinaId, tenantId, dependencies, showAlertCallback) {
    const { collection, getDocs, query, where, deleteDoc, doc, db } = dependencies;
    
    if (!confirm('Sei sicuro di voler eliminare questa macchina?')) {
        return;
    }

    try {
        // Verifica se macchina è usata in lavori
        const lavoriRef = collection(db, `tenants/${tenantId}/lavori`);
        const lavoriSnapshot = await getDocs(query(lavoriRef, where('macchinaId', '==', macchinaId)));
        
        if (!lavoriSnapshot.empty) {
            if (!confirm(`Questa macchina è utilizzata in ${lavoriSnapshot.size} lavoro/i. Vuoi eliminarla comunque?`)) {
                return;
            }
        }

        await deleteDoc(doc(db, `tenants/${tenantId}/macchine`, macchinaId));
        if (showAlertCallback) showAlertCallback('Macchina eliminata con successo', 'success');
        // Non serve ricaricare, il listener real-time aggiorna automaticamente
    } catch (error) {
        console.error('Errore eliminazione macchina:', error);
        if (showAlertCallback) showAlertCallback('Errore eliminazione macchina: ' + error.message, 'error');
    }
}

// ============================================
// FUNZIONI MODAL CATEGORIA
// ============================================

/**
 * Apri modal categoria
 */
export function openCategoriaModal() {
    const form = document.getElementById('categoria-form');
    const modal = document.getElementById('categoria-modal');
    
    if (form) form.reset();
    if (modal) modal.classList.add('active');
}

/**
 * Chiudi modal categoria
 */
export function closeCategoriaModal() {
    const modal = document.getElementById('categoria-modal');
    const form = document.getElementById('categoria-form');
    
    if (modal) modal.classList.remove('active');
    if (form) form.reset();
}

/**
 * Salva categoria
 * @param {Event} e - Event object
 * @param {string} tenantId - ID tenant
 * @param {string} userId - ID utente corrente
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Object} state - State object con categoriePrincipali
 * @param {Function} showAlertCallback - Callback per mostrare alert
 * @param {Function} closeCategoriaModalCallback - Callback per chiudere modal
 * @param {Function} loadCategorieCallback - Callback per ricaricare categorie
 * @param {Function} populateSottocategorieCallback - Callback per popolare sottocategorie
 */
export async function handleSalvaCategoria(e, tenantId, userId, dependencies, state, showAlertCallback, closeCategoriaModalCallback, loadCategorieCallback, populateSottocategorieCallback) {
    e.preventDefault();
    const { collection, getDocs, query, where, addDoc, Timestamp, db } = dependencies;
    const { categoriePrincipali } = state;

    const nomeInput = document.getElementById('categoria-nome');
    const descrizioneTextarea = document.getElementById('categoria-descrizione');
    
    const nome = nomeInput?.value.trim() || '';
    const descrizione = descrizioneTextarea?.value.trim() || null;

    // Validazione
    if (!nome || nome.length < 3) {
        if (showAlertCallback) showAlertCallback('Il nome categoria deve essere di almeno 3 caratteri', 'error');
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
        const categorieRef = collection(db, `tenants/${tenantId}/categorie`);
        const snapshot = await getDocs(query(categorieRef, where('codice', '==', codice)));
        
        if (!snapshot.empty) {
            if (showAlertCallback) showAlertCallback('Una categoria con questo nome esiste già', 'error');
            return;
        }

        const categoriaData = {
            nome,
            codice,
            descrizione,
            parentId: null,
            applicabileA: 'attrezzi',
            predefinita: false,
            creatoDa: userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        await addDoc(categorieRef, categoriaData);
        if (showAlertCallback) showAlertCallback('Categoria creata con successo', 'success');
        
        if (closeCategoriaModalCallback) closeCategoriaModalCallback();
        if (loadCategorieCallback) await loadCategorieCallback();
        
        // Seleziona la nuova categoria nel form macchina
        const categoriaPrincipaleSelect = document.getElementById('macchina-categoria-principale');
        if (categoriaPrincipaleSelect && loadCategorieCallback) {
            // Ricarica categorie per includere la nuova
            await loadCategorieCallback();
            // Trova la categoria appena creata
            const nuovaCategoria = categoriePrincipali.find(c => c.codice === codice);
            if (nuovaCategoria && populateSottocategorieCallback) {
                categoriaPrincipaleSelect.value = nuovaCategoria.id;
                populateSottocategorieCallback(nuovaCategoria.id);
            }
        }
    } catch (error) {
        console.error('Errore salvataggio categoria:', error);
        if (showAlertCallback) showAlertCallback('Errore salvataggio categoria: ' + error.message, 'error');
    }
}

// ============================================
// FUNZIONI STORICO GUASTI
// ============================================

/**
 * Carica storico guasti per macchina
 * @param {string} macchinaId - ID macchina
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze Firebase
 * @param {Object} state - State object con macchine e usersMap
 * @param {Function} updateState - Funzione per aggiornare state
 */
export async function loadStoricoGuasti(macchinaId, tenantId, dependencies, state, updateState) {
    const { collection, getDocs, getDoc, doc, db } = dependencies;
    const { macchine, usersMap } = state;
    
    try {
        const storicoSection = document.getElementById('storico-guasti-section');
        const storicoList = document.getElementById('storico-guasti-list');
        
        if (!storicoSection || !storicoList || !tenantId) {
            console.warn('loadStoricoGuasti: elementi DOM o tenantId mancanti');
            return;
        }

        storicoSection.style.display = 'block';
        storicoList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Caricamento storico guasti...</div>';

        // Determina il tipo di macchina per sapere se cercare per macchinaId o attrezzoId
        const macchina = macchine.find(m => m.id === macchinaId);
        const tipoMacchina = macchina?.tipoMacchina || macchina?.tipo || '';
        const isAttrezzo = tipoMacchina === 'attrezzo';

        // Carica tutti i guasti e filtra in memoria
        const allGuastiRef = collection(db, `tenants/${tenantId}/guasti`);
        const allGuastiSnapshot = await getDocs(allGuastiRef);
        const guastiArray = [];
        
        allGuastiSnapshot.forEach(doc => {
            const data = doc.data();
            const tipoGuasto = data.tipoGuasto || 'macchina'; // Default per retrocompatibilità
            
            // Filtra solo guasti tipo macchina (escludi generici)
            if (tipoGuasto !== 'macchina') return;
            
            const componenteGuasto = data.componenteGuasto || 'trattore'; // Default per retrocompatibilità
            
            if (isAttrezzo) {
                // Per attrezzi: cerca dove attrezzoId corrisponde E componenteGuasto è 'attrezzo' o 'entrambi'
                if (data.attrezzoId === macchinaId && 
                    (componenteGuasto === 'attrezzo' || componenteGuasto === 'entrambi')) {
                    guastiArray.push({ id: doc.id, ...data });
                }
            } else {
                // Per trattori: cerca dove macchinaId corrisponde E componenteGuasto è 'trattore' o 'entrambi'
                if (data.macchinaId === macchinaId && 
                    (componenteGuasto === 'trattore' || componenteGuasto === 'entrambi')) {
                    guastiArray.push({ id: doc.id, ...data });
                }
            }
        });
        
        const guastiCount = guastiArray.length;
        
        guastiArray.sort((a, b) => {
            const dateA = a.segnalatoIl?.toDate ? a.segnalatoIl.toDate() : new Date(a.segnalatoIl || 0);
            const dateB = b.segnalatoIl?.toDate ? b.segnalatoIl.toDate() : new Date(b.segnalatoIl || 0);
            return dateB - dateA;
        });
        
        const guastiSnapshot = {
            empty: guastiArray.length === 0,
            size: guastiArray.length,
            forEach: (callback) => {
                guastiArray.forEach(item => {
                    callback({ id: item.id, data: () => item });
                });
            }
        };

        if (guastiSnapshot.empty || guastiCount === 0) {
            storicoList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Nessun guasto segnalato per questa macchina</div>';
            return;
        }

        // Estrai tutti gli ID utente unici dai guasti e caricali
        const userIds = new Set();
        guastiSnapshot.forEach(doc => {
            const guasto = doc.data();
            if (guasto.segnalatoDa) userIds.add(guasto.segnalatoDa);
            if (guasto.risoltoDa) userIds.add(guasto.risoltoDa);
        });

        // Carica solo gli utenti necessari (tollerante ai permessi)
        const updatedUsersMap = new Map(usersMap);
        if (userIds.size > 0) {
            const userPromises = Array.from(userIds).map(async (userId) => {
                // Controlla se già in cache
                if (updatedUsersMap.has(userId)) return;
                
                try {
                    const userDoc = await getDoc(doc(db, 'users', userId));
                    if (userDoc.exists()) {
                        updatedUsersMap.set(userId, userDoc.data());
                    }
                } catch (error) {
                    // Ignora errori di permesso per singoli utenti
                }
            });
            
            await Promise.all(userPromises);
        }
        
        // Aggiorna state con usersMap aggiornato
        updateState({ usersMap: updatedUsersMap });

        let html = '';
        guastiSnapshot.forEach(doc => {
            const guasto = doc.data();
            const operaio = updatedUsersMap.get(guasto.segnalatoDa);
            const operaioNome = operaio ? `${operaio.nome || ''} ${operaio.cognome || ''}`.trim() || operaio.email : 'Operaio sconosciuto';
            
            const risoltoDa = guasto.risoltoDa ? updatedUsersMap.get(guasto.risoltoDa) : null;
            const risoltoDaNome = risoltoDa ? `${risoltoDa.nome || ''} ${risoltoDa.cognome || ''}`.trim() || risoltoDa.email : null;

            const dataSegnalazione = guasto.segnalatoIl?.toDate 
                ? guasto.segnalatoIl.toDate().toLocaleString('it-IT')
                : new Date(guasto.segnalatoIl).toLocaleString('it-IT');

            const dataRisoluzione = guasto.risoltoIl?.toDate 
                ? guasto.risoltoIl.toDate().toLocaleString('it-IT')
                : guasto.risoltoIl ? new Date(guasto.risoltoIl).toLocaleString('it-IT') : null;

            const componenteGuasto = guasto.componenteGuasto || 'trattore'; // Default per retrocompatibilità
            const componenteBadge = componenteGuasto === 'trattore' 
                ? '<span style="background: #007bff; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">🚜 Trattore</span>'
                : componenteGuasto === 'attrezzo'
                ? '<span style="background: #6f42c1; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">⚙️ Attrezzo</span>'
                : '<span style="background: #fd7e14; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">🚜⚙️ Entrambi</span>';

            const gravitaBadge = guasto.gravita === 'grave' 
                ? '<span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">🔴 Grave</span>'
                : '<span style="background: #ffc107; color: #856404; padding: 2px 8px; border-radius: 12px; font-size: 11px;">🟡 Non grave</span>';

            const statoBadge = guasto.stato === 'risolto'
                ? '<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">✅ Risolto</span>'
                : guasto.stato === 'approvato-continuazione'
                ? '<span style="background: #17a2b8; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">✅ Continuazione approvata</span>'
                : guasto.stato === 'sospeso'
                ? '<span style="background: #6c757d; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">⛔ Sospeso</span>'
                : '<span style="background: #6c757d; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">⏳ In attesa</span>';

            html += `
                <div style="background: white; padding: 12px; margin-bottom: 10px; border-left: 3px solid ${guasto.stato === 'risolto' ? '#28a745' : guasto.gravita === 'grave' ? '#dc3545' : '#ffc107'}; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="font-weight: 600; color: #333;">${escapeHtml(dataSegnalazione)}</div>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            ${componenteBadge}
                            ${gravitaBadge}
                            ${statoBadge}
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #666; margin-bottom: 6px;">
                        <strong>Segnalato da:</strong> ${escapeHtml(operaioNome)}
                    </div>
                    <div style="font-size: 13px; color: #333; margin-bottom: 6px;">
                        <strong>Dettagli:</strong> ${escapeHtml(guasto.dettagli || '-')}
                    </div>
                    ${guasto.stato === 'risolto' ? `
                        <div style="font-size: 13px; color: #155724; margin-top: 8px; padding-top: 8px; border-top: 1px solid #c3e6cb;">
                            <div><strong>Risolto il:</strong> ${escapeHtml(dataRisoluzione || '-')}</div>
                            <div><strong>Risolto da:</strong> ${escapeHtml(risoltoDaNome || 'Sconosciuto')}</div>
                            <div><strong>Note risoluzione:</strong> ${escapeHtml(guasto.noteRisoluzione || '-')}</div>
                            ${guasto.costoRiparazione ? `<div><strong>Costo riparazione:</strong> €${guasto.costoRiparazione.toFixed(2)}</div>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        });

        storicoList.innerHTML = html || '<div style="text-align: center; padding: 20px; color: #666;">Nessun guasto segnalato per questa macchina</div>';
    } catch (error) {
        console.error('Errore caricamento storico guasti:', error);
        const storicoList = document.getElementById('storico-guasti-list');
        if (storicoList) {
            storicoList.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">Errore caricamento storico guasti</div>';
        }
    }
}


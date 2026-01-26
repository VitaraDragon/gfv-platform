/**
 * Terreni Events - Event handlers per modal e form
 * 
 * @module core/js/terreni-events
 */

// ============================================
// IMPORTS
// ============================================
import { showAlert } from './terreni-utils.js';

// ============================================
// FUNZIONI EVENT HANDLERS
// ============================================

/**
 * Apre modal per creare/modificare terreno
 * @param {string|null} terrenoId - ID terreno da modificare (null per creare nuovo)
 * @param {Object} state - State object con { currentTerrenoId, terreni, colturePerCategoriaTerreni, map, polygon, currentPolygonCoords, isDrawing }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Function} loadColtureCallback - Callback per caricare colture
 * @param {Function} populatePoderiDropdownCallback - Callback per popolare dropdown poderi
 * @param {Function} updateColtureDropdownTerreniCallback - Callback per aggiornare dropdown colture
 * @param {Function} toggleDataScadenzaAffittoCallback - Callback per toggle campi affitto
 * @param {Function} initMapCallback - Callback per inizializzare mappa
 * @param {Function} loadExistingPolygonCallback - Callback per caricare poligono esistente
 */
export async function openTerrenoModal(
    terrenoId,
    state,
    updateState,
    loadColtureCallback,
    populatePoderiDropdownCallback,
    updateColtureDropdownTerreniCallback,
    toggleDataScadenzaAffittoCallback,
    initMapCallback,
    loadExistingPolygonCallback
) {
    updateState({ currentTerrenoId: terrenoId });
    const modal = document.getElementById('terreno-modal');
    const form = document.getElementById('terreno-form');
    const title = document.getElementById('modal-title');
    
    if (!modal || !form || !title) return;
    
    // IMPORTANTE: Carica colture e popola dropdown PRIMA di impostare i valori
    // Ricarica colture per assicurarsi che siano aggiornate
    if (loadColtureCallback) {
        await loadColtureCallback();
    }
    if (populatePoderiDropdownCallback) {
        populatePoderiDropdownCallback();
    }
    
    if (terrenoId) {
        title.textContent = 'Modifica Terreno';
        // Carica dati terreno
        const terreno = state.terreni.find(t => t.id === terrenoId);
        if (terreno) {
            const nomeInput = document.getElementById('terreno-nome');
            const superficieInput = document.getElementById('terreno-superficie');
            if (nomeInput) nomeInput.value = terreno.nome || '';
            if (superficieInput) superficieInput.value = terreno.superficie || '';
            
            // Trova la categoria della coltura selezionata
            const colturaNome = terreno.coltura || '';
            if (colturaNome) {
                // Cerca la coltura nelle categorie caricate
                let categoriaIdTrovata = null;
                for (const [catId, coltureList] of Object.entries(state.colturePerCategoriaTerreni || {})) {
                    const colturaTrovata = coltureList.find(c => c.nome === colturaNome);
                    if (colturaTrovata) {
                        categoriaIdTrovata = catId;
                        break;
                    }
                }
                
                // Imposta la categoria se trovata
                const categoriaSelect = document.getElementById('terreno-coltura-categoria');
                if (categoriaSelect && categoriaIdTrovata) {
                    categoriaSelect.value = categoriaIdTrovata;
                    // Aggiorna il dropdown delle colture
                    if (updateColtureDropdownTerreniCallback) {
                        updateColtureDropdownTerreniCallback();
                    }
                }
                
                // Imposta la coltura dopo aver aggiornato il dropdown
                setTimeout(() => {
                    const colturaSelect = document.getElementById('terreno-coltura');
                    if (colturaSelect) colturaSelect.value = colturaNome;
                }, 100);
            }
            
            const podereValue = terreno.podere || '';
            const podereSelect = document.getElementById('terreno-podere');
            if (podereSelect) podereSelect.value = podereValue;
            
            const noteInput = document.getElementById('terreno-note');
            if (noteInput) noteInput.value = terreno.note || '';
            
            // Carica tipo possesso e campi affitto
            const tipoPossesso = terreno.tipoPossesso || 'proprieta';
            const tipoPossessoSelect = document.getElementById('terreno-tipo-possesso');
            if (tipoPossessoSelect) tipoPossessoSelect.value = tipoPossesso;
            
            if (tipoPossesso === 'affitto' && terreno.dataScadenzaAffitto) {
                const scadenza = terreno.dataScadenzaAffitto.toDate ? terreno.dataScadenzaAffitto.toDate() : new Date(terreno.dataScadenzaAffitto);
                const scadenzaStr = scadenza.toISOString().split('T')[0];
                const dataScadenzaInput = document.getElementById('terreno-data-scadenza-affitto');
                if (dataScadenzaInput) dataScadenzaInput.value = scadenzaStr;
                
                const canoneInput = document.getElementById('terreno-canone-affitto');
                if (canoneInput) canoneInput.value = terreno.canoneAffitto || '';
            }
            
            // Mostra/nascondi campi affitto
            if (toggleDataScadenzaAffittoCallback) {
                toggleDataScadenzaAffittoCallback();
            }
            
            // Inizializza mappa se disponibile
            if (window.googleMapsReady) {
                setTimeout(() => {
                    if (initMapCallback) {
                        initMapCallback(state, updateState);
                    }
                    if (terreno.polygonCoords && terreno.polygonCoords.length > 0) {
                        if (loadExistingPolygonCallback) {
                            loadExistingPolygonCallback(terreno.polygonCoords, state, updateState);
                        }
                        // Calcola superficie dalla mappa esistente e aggiorna il campo
                        setTimeout(() => {
                            if (state.polygon && state.currentPolygonCoords && state.currentPolygonCoords.length >= 3) {
                                const area = google.maps.geometry.spherical.computeArea(state.currentPolygonCoords);
                                const areaHectares = area / 10000;
                                const superficieInput = document.getElementById('terreno-superficie');
                                if (superficieInput) superficieInput.value = areaHectares.toFixed(2);
                            }
                        }, 500);
                    } else if (terreno.coordinate && state.map) {
                        state.map.setCenter(terreno.coordinate);
                        state.map.setZoom(15);
                    }
                }, 300);
            }
        }
    } else {
        title.textContent = 'Aggiungi Terreno';
        form.reset();
        // Reset dropdown categoria colture
        const categoriaSelect = document.getElementById('terreno-coltura-categoria');
        if (categoriaSelect) categoriaSelect.value = '';
        // Reset dropdown colture mantenendo solo l'opzione iniziale
        const colturaSelect = document.getElementById('terreno-coltura');
        if (colturaSelect) {
            colturaSelect.innerHTML = '<option value="">-- Seleziona prima la categoria --</option>';
        }
        const podereSelect = document.getElementById('terreno-podere');
        if (podereSelect) podereSelect.value = '';
        const tipoPossessoSelect = document.getElementById('terreno-tipo-possesso');
        if (tipoPossessoSelect) tipoPossessoSelect.value = 'proprieta';
        
        if (toggleDataScadenzaAffittoCallback) {
            toggleDataScadenzaAffittoCallback(); // Nascondi campi affitto
        }
        
        updateState({ currentPolygonCoords: [], polygon: null });
        
        if (window.googleMapsReady) {
            setTimeout(() => {
                if (initMapCallback) {
                    initMapCallback(state, updateState);
                }
            }, 300);
        }
    }
    
    // Le colture vengono caricate automaticamente quando si seleziona una categoria
    modal.classList.add('active');
}

/**
 * Chiude modal e pulisce stato
 * @param {Object} state - State object con { currentTerrenoId, polygon, currentPolygonCoords, isDrawing, map }
 * @param {Function} updateState - Funzione per aggiornare lo state
 */
export function closeTerrenoModal(state, updateState) {
    const modal = document.getElementById('terreno-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Pulisci mappa
    if (state.polygon) {
        state.polygon.setMap(null);
    }
    
    updateState({ 
        currentTerrenoId: null,
        polygon: null,
        currentPolygonCoords: [],
        isDrawing: false,
        map: null
    });
}

/**
 * Gestisce salvataggio terreno (crea/modifica)
 * @param {Event} e - Event submit form
 * @param {Object} state - State object con { currentTerrenoId, currentTenantId, currentPolygonCoords, polygon }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Function} getTerreniCollectionCallback - Callback per ottenere collection terreni
 * @param {Function} loadTerreniCallback - Callback per ricaricare terreni dopo salvataggio
 */
export async function handleSaveTerreno(
    e,
    state,
    updateState,
    getTerreniCollectionCallback,
    loadTerreniCallback
) {
    e.preventDefault();
    
    if (!state.currentTenantId) {
        showAlert('Errore: Tenant ID non disponibile', 'error');
        return;
    }
    
    const nomeInput = document.getElementById('terreno-nome');
    const nome = nomeInput ? nomeInput.value.trim() : '';
    if (!nome) {
        showAlert('Il nome terreno è obbligatorio', 'error');
        return;
    }
    
    const colturaInput = document.getElementById('terreno-coltura');
    const coltura = colturaInput ? colturaInput.value.trim() || null : null;
    
    const podereInput = document.getElementById('terreno-podere');
    const podere = podereInput ? podereInput.value.trim() || null : null;
    
    const noteInput = document.getElementById('terreno-note');
    const note = noteInput ? noteInput.value.trim() : '';
    
    const tipoPossessoInput = document.getElementById('terreno-tipo-possesso');
    const tipoPossesso = tipoPossessoInput ? tipoPossessoInput.value : 'proprieta';
    
    const dataScadenzaInput = document.getElementById('terreno-data-scadenza-affitto');
    const dataScadenzaAffitto = dataScadenzaInput ? dataScadenzaInput.value : '';
    
    const canoneInput = document.getElementById('terreno-canone-affitto');
    const canoneAffitto = canoneInput ? canoneInput.value : '';
    
    const { serverTimestamp, Timestamp, doc, setDoc, addDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    // Prepara dati terreno
    const terrenoData = {
        nome,
        superficie: null,
        coltura: coltura || null,
        podere: podere || null,
        note: note || null,
        tipoPossesso: tipoPossesso || 'proprieta',
        updatedAt: serverTimestamp()
    };
    
    // Aggiungi campi affitto solo se tipo possesso è affitto
    if (tipoPossesso === 'affitto') {
        if (!dataScadenzaAffitto) {
            showAlert('Data scadenza affitto obbligatoria per terreni in affitto', 'error');
            return;
        }
        terrenoData.dataScadenzaAffitto = Timestamp.fromDate(new Date(dataScadenzaAffitto));
        terrenoData.canoneAffitto = canoneAffitto ? parseFloat(canoneAffitto) : null;
    } else {
        // Se è proprietà, rimuovi eventuali campi affitto esistenti
        terrenoData.dataScadenzaAffitto = null;
        terrenoData.canoneAffitto = null;
    }
    
    // Aggiungi coordinate se disponibili
    if (state.currentPolygonCoords && state.currentPolygonCoords.length > 0) {
        // Funzione helper per estrarre lat/lng da oggetto LatLng o oggetto semplice
        const getLatLng = (coord) => {
            if (!coord) return null;
            // Se coord ha metodi lat() e lng(), è un oggetto LatLng di Google Maps
            if (typeof coord.lat === 'function' && typeof coord.lng === 'function') {
                return { lat: coord.lat(), lng: coord.lng() };
            }
            // Altrimenti è già un oggetto semplice con lat e lng
            if (typeof coord.lat === 'number' && typeof coord.lng === 'number') {
                return { lat: coord.lat, lng: coord.lng };
            }
            return null;
        };
        
        // Calcola punto centrale dal poligono
        let sumLat = 0, sumLng = 0;
        let validCoords = 0;
        state.currentPolygonCoords.forEach(coord => {
            const latLng = getLatLng(coord);
            if (latLng) {
                sumLat += latLng.lat;
                sumLng += latLng.lng;
                validCoords++;
            }
        });
        
        if (validCoords > 0) {
            terrenoData.coordinate = {
                lat: sumLat / validCoords,
                lng: sumLng / validCoords
            };
            
            // Converti coordinate poligono in formato serializzabile
            terrenoData.polygonCoords = state.currentPolygonCoords
                .map(coord => getLatLng(coord))
                .filter(coord => coord !== null);
            
            // Calcola superficie dalla mappa (sempre, se mappa tracciata)
            if (window.googleMapsReady && state.polygon && terrenoData.polygonCoords.length >= 3) {
                // Converti in LatLng per il calcolo dell'area se necessario
                const coordsForArea = state.currentPolygonCoords.map(coord => {
                    const latLng = getLatLng(coord);
                    if (latLng && google && google.maps) {
                        return new google.maps.LatLng(latLng.lat, latLng.lng);
                    }
                    return coord;
                }).filter(coord => coord !== null);
                
                if (coordsForArea.length >= 3) {
                    const area = google.maps.geometry.spherical.computeArea(coordsForArea);
                    terrenoData.superficie = area / 10000; // Converti da m² a ettari
                }
            }
        }
    } else {
        // Se non c'è mappa, usa superficie manuale se inserita
        const superficieInput = document.getElementById('terreno-superficie');
        const superficie = superficieInput ? parseFloat(superficieInput.value) || null : null;
        terrenoData.superficie = superficie;
    }
    
    try {
        // IMPORTANTE: getTerreniCollectionCallback è async, quindi serve await
        const terreniCollection = await getTerreniCollectionCallback(state.currentTenantId);
        
        if (!terreniCollection) {
            throw new Error('Collection terreni non disponibile. Verifica che il tenant ID sia corretto.');
        }
        
        // Rimuovi createdAt se presente (per update)
        const dataToSave = { ...terrenoData };
        if (state.currentTerrenoId) {
            delete dataToSave.createdAt;
        }
        
        // Verifica che non ci siano valori undefined che causano problemi
        const cleanedData = {};
        for (const [key, value] of Object.entries(dataToSave)) {
            if (value !== undefined && value !== null) {
                cleanedData[key] = value;
            }
        }
        
        if (state.currentTerrenoId) {
            // Aggiorna usando setDoc con merge per garantire che tutti i campi vengano salvati
            const terrenoRef = doc(terreniCollection, state.currentTerrenoId);
            await setDoc(terrenoRef, cleanedData, { merge: true });
            showAlert('Terreno aggiornato con successo!', 'success');
        } else {
            // Crea
            cleanedData.createdAt = serverTimestamp();
            await addDoc(terreniCollection, cleanedData);
            showAlert('Terreno creato con successo!', 'success');
        }
        
        closeTerrenoModal(state, updateState);
        if (loadTerreniCallback) {
            await loadTerreniCallback();
        }
    } catch (error) {
        console.error('Errore salvataggio terreno:', error);
        showAlert('Errore nel salvataggio: ' + error.message, 'error');
    }
}

/**
 * Apre modal in modalità modifica
 * @param {string} terrenoId - ID terreno da modificare
 * @param {Function} openTerrenoModalCallback - Callback per aprire modal
 */
export function editTerreno(terrenoId, openTerrenoModalCallback) {
    if (openTerrenoModalCallback) {
        openTerrenoModalCallback(terrenoId);
    }
}

/**
 * Conferma ed elimina terreno
 * @param {string} terrenoId - ID terreno da eliminare
 * @param {Object} state - State object con { terreni, currentTenantId }
 * @param {Function} getTerreniCollectionCallback - Callback per ottenere collection terreni
 * @param {Function} loadTerreniCallback - Callback per ricaricare terreni dopo eliminazione
 */
export async function confirmDeleteTerreno(
    terrenoId,
    state,
    getTerreniCollectionCallback,
    loadTerreniCallback
) {
    const terreno = state.terreni.find(t => t.id === terrenoId);
    if (!terreno) return;
    
    if (!state.currentTenantId) {
        showAlert('Errore: Tenant ID non disponibile', 'error');
        return;
    }
    
    try {
        const { collection, query, where, getDocs, doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Verifica se terreno è usato in attività usando il servizio
        let numAttivita = 0;
        try {
            // Usa il servizio terreni-service invece di Firebase direttamente
            const { getNumeroAttivitaTerreno } = await import('../services/terreni-service.js');
            numAttivita = await getNumeroAttivitaTerreno(terrenoId);
        } catch (e) {
            console.warn('Errore verifica attività:', e);
            // Continua comunque, ma senza verifica
        }
        
        let message = `Sei sicuro di voler eliminare il terreno "${terreno.nome}"?`;
        let forceDelete = false;
        
        if (numAttivita > 0) {
            message += `\n\n⚠️ ATTENZIONE: Questo terreno è utilizzato in ${numAttivita} attività.`;
            message += `\n\nSe elimini il terreno, le attività rimarranno con un riferimento a un terreno inesistente.`;
            message += `\n\nVuoi eliminare comunque?`;
            
            // Prima conferma: avviso
            if (!confirm(message)) {
                return; // Utente ha annullato
            }
            
            // Seconda conferma: conferma forzata
            forceDelete = confirm(
                `⚠️ CONFERMA FINALE\n\nStai per eliminare un terreno utilizzato in ${numAttivita} attività.\n\n` +
                `Questa operazione non può essere annullata.\n\n` +
                `Sei sicuro di voler procedere?`
            );
            
            if (!forceDelete) {
                return; // Utente ha annullato
            }
        } else {
            // Nessuna attività associata, conferma normale
            if (!confirm(message)) {
                return; // Utente ha annullato
            }
        }
        
        // Elimina usando Firebase direttamente
        // IMPORTANTE: getTerreniCollectionCallback è async, quindi serve await
        const terreniCollection = await getTerreniCollectionCallback(state.currentTenantId);
        
        if (!terreniCollection) {
            throw new Error('Collection terreni non disponibile. Verifica che il tenant ID sia corretto.');
        }
        
        const terrenoRef = doc(terreniCollection, terrenoId);
        await deleteDoc(terrenoRef);
        showAlert('Terreno eliminato con successo!', 'success');
        
        if (loadTerreniCallback) {
            await loadTerreniCallback();
        }
        
    } catch (error) {
        console.error('Errore eliminazione terreno:', error);
        showAlert('Errore nell\'eliminazione: ' + error.message, 'error');
    }
}

/**
 * Mostra/nasconde campi affitto in base a tipo possesso
 */
export function toggleDataScadenzaAffitto() {
    const tipoPossessoSelect = document.getElementById('terreno-tipo-possesso');
    const affittoFields = document.getElementById('affitto-fields');
    const affittoCanoneField = document.getElementById('affitto-canone-field');
    const dataScadenzaInput = document.getElementById('terreno-data-scadenza-affitto');
    
    if (!tipoPossessoSelect) return;
    
    const tipoPossesso = tipoPossessoSelect.value;
    
    if (tipoPossesso === 'affitto') {
        if (affittoFields) affittoFields.style.display = 'block';
        if (affittoCanoneField) affittoCanoneField.style.display = 'block';
        if (dataScadenzaInput) dataScadenzaInput.required = true;
    } else {
        if (affittoFields) affittoFields.style.display = 'none';
        if (affittoCanoneField) affittoCanoneField.style.display = 'none';
        if (dataScadenzaInput) {
            dataScadenzaInput.required = false;
            dataScadenzaInput.value = '';
        }
        const canoneInput = document.getElementById('terreno-canone-affitto');
        if (canoneInput) canoneInput.value = '';
    }
}

/**
 * Aggiorna dropdown colture in base alla categoria selezionata
 * @param {Object} state - State object con { colturePerCategoriaTerreni, polygon, isDrawing }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Function} getColturaColorCallback - Callback per ottenere colore coltura
 */
export function updateColtureDropdownTerreni(state, updateState, getColturaColorCallback) {
    const categoriaSelect = document.getElementById('terreno-coltura-categoria');
    const colturaSelect = document.getElementById('terreno-coltura');
    
    // Aggiorna colore poligono se sta tracciando
    if (state.polygon && state.isDrawing && getColturaColorCallback) {
        const colors = getColturaColorCallback();
        state.polygon.setOptions({
            fillColor: colors.fill + '80',
            strokeColor: colors.stroke
        });
    }
    
    if (!categoriaSelect || !colturaSelect) {
        console.warn('⚠️ updateColtureDropdownTerreni: dropdown non trovati');
        return;
    }
    
    const categoriaId = categoriaSelect.value;
    
    // Reset dropdown colture
    colturaSelect.innerHTML = '<option value="">-- Seleziona coltura --</option>';
    
    if (!categoriaId) {
        colturaSelect.innerHTML = '<option value="">-- Seleziona prima la categoria --</option>';
        return;
    }
    
    // Popola con le colture della categoria selezionata
    const coltureCategoria = state.colturePerCategoriaTerreni?.[categoriaId] || [];
    
    if (coltureCategoria.length === 0) {
        colturaSelect.innerHTML = '<option value="">-- Nessuna coltura disponibile per questa categoria --</option>';
        return;
    }
    
    // Ordina per nome
    coltureCategoria.sort((a, b) => {
        const nomeA = (a.nome || '').toLowerCase();
        const nomeB = (b.nome || '').toLowerCase();
        return nomeA.localeCompare(nomeB);
    });
    
    coltureCategoria.forEach((coltura) => {
        const nomeColtura = coltura.nome || coltura;
        const option = document.createElement('option');
        option.value = nomeColtura;
        option.textContent = nomeColtura;
        colturaSelect.appendChild(option);
    });
}

/**
 * Setup listener per aggiornare colore poligono quando cambia coltura
 * @param {Object} state - State object con { polygon, isDrawing }
 * @param {Function} getColturaColorCallback - Callback per ottenere colore coltura
 */
export function setupColturaColorListener(state, getColturaColorCallback) {
    const colturaSelect = document.getElementById('terreno-coltura');
    if (colturaSelect && getColturaColorCallback) {
        colturaSelect.addEventListener('change', function() {
            if (state.polygon && state.isDrawing) {
                const colors = getColturaColorCallback();
                state.polygon.setOptions({
                    fillColor: colors.fill + '80',
                    strokeColor: colors.stroke
                });
            }
        });
    }
}




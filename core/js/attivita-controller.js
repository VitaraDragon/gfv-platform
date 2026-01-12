/**
 * Attività Controller - Logica principale gestione attività
 * 
 * @module core/js/attivita-controller
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
 * Ottiene tenant ID dall'utente
 * @param {string} userId - ID utente
 * @param {Object} db - Istanza Firestore
 * @param {string} currentTenantId - Tenant ID corrente (se già disponibile)
 * @returns {Promise<string|null>}
 */
export async function getTenantId(userId, db, currentTenantId = null) {
    if (currentTenantId) return currentTenantId;
    
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
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
 * Ottiene riferimento collection attività per tenant
 * @param {string} tenantId - ID tenant
 * @param {Object} db - Istanza Firestore
 * @returns {Object} Collection reference
 */
/**
 * Ottiene riferimento collection attività per tenant
 * @param {string} tenantId - ID tenant
 * @param {Object} db - Istanza Firestore
 * @returns {Promise<Object>} Collection reference
 */
export async function getAttivitaCollection(tenantId, db) {
    if (!tenantId) throw new Error('Tenant ID non disponibile');
    const { collection } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    return collection(db, `tenants/${tenantId}/attivita`);
}

/**
 * Ottiene riferimento collection terreni per tenant
 * @param {string} tenantId - ID tenant
 * @param {Object} db - Istanza Firestore
 * @returns {Promise<Object>} Collection reference
 */
export async function getTerreniCollection(tenantId, db) {
    if (!tenantId) throw new Error('Tenant ID non disponibile');
    const { collection } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    return collection(db, `tenants/${tenantId}/terreni`);
}

/**
 * Genera automaticamente una voce diario quando un lavoro conto terzi viene completato
 * @param {string} lavoroId - ID del lavoro completato
 * @param {Object} lavoroData - Dati del lavoro completato
 * @param {Object} orariOpzionali - Orari opzionali dalla attività appena salvata {orarioInizio, orarioFine, pauseMinuti, oreNette}
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} currentUserData - Dati utente corrente
 * @param {boolean} hasContoTerziModule - Se il modulo Conto Terzi è attivo
 */
export async function generaVoceDiarioContoTerzi(
    lavoroId, 
    lavoroData, 
    orariOpzionali = null,
    currentTenantId,
    db,
    currentUserData,
    hasContoTerziModule
) {
    // Verifica se modulo Conto Terzi è attivo e se lavoro è conto terzi
    if (!hasContoTerziModule || !lavoroData.clienteId) {
        return; // Non è un lavoro conto terzi o modulo non attivo
    }

    // Verifica se già esiste una voce diario per questo lavoro
    try {
        const { collection, query, getDocs, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
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
            creatoDa: currentUserData?.id || null,
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
 * Aggiorna stato macchina (disponibile/in_uso)
 * @param {string} macchinaId - ID macchina
 * @param {string} nuovoStato - Nuovo stato
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 */
/**
 * Aggiorna stato macchina (disponibile/in_uso) usando servizio centralizzato
 * @param {string} macchinaId - ID macchina
 * @param {string} nuovoStato - Nuovo stato
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 */
export async function updateMacchinaStato(macchinaId, nuovoStato, currentTenantId, db, app, auth) {
    try {
        if (!macchinaId || !currentTenantId || !db) {
            console.warn('updateMacchinaStato: parametri mancanti', { macchinaId, currentTenantId, hasDb: !!db });
            return;
        }
        
        // Usa servizio centralizzato se disponibile
        try {
            const { setFirebaseInstances } = await import('../services/firebase-service.js');
            setFirebaseInstances({ app, db, auth });
            
            const { setCurrentTenantId } = await import('../services/tenant-service.js');
            setCurrentTenantId(currentTenantId);
            
            const { updateMacchina } = await import('../../modules/parco-macchine/services/macchine-service.js');
            const macchina = await updateMacchina(macchinaId, { stato: nuovoStato });
            return macchina;
        } catch (serviceError) {
            // Fallback: aggiorna direttamente da Firestore
            console.warn('Fallback: aggiornamento diretto Firestore per macchina', serviceError);
            const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const macchinaRef = doc(db, 'tenants', currentTenantId, 'macchine', macchinaId);
            await updateDoc(macchinaRef, {
                stato: nuovoStato,
                updatedAt: serverTimestamp()
            });
        }
    } catch (error) {
        console.error(`Errore aggiornamento stato macchina ${macchinaId}:`, error);
        // Non bloccare il salvataggio attività se c'è un errore con la macchina
    }
}

/**
 * Verifica conflitti di orario per macchine/attrezzi
 * @param {string} macchinaId - ID trattore
 * @param {string} attrezzoId - ID attrezzo
 * @param {string} data - Data attività
 * @param {string} orarioInizio - Orario inizio
 * @param {string} orarioFine - Orario fine (opzionale)
 * @param {string} attivitaIdEsclusa - ID attività da escludere dal controllo (se modifica)
 * @param {Array} attivita - Array attività esistenti
 * @param {Array} macchineList - Array macchine disponibili
 * @returns {Object|null} Oggetto con messaggio di conflitto o null se nessun conflitto
 */
export function verificaConflittiMacchine(
    macchinaId, 
    attrezzoId, 
    data, 
    orarioInizio, 
    orarioFine, 
    attivitaIdEsclusa = null,
    attivita = [],
    macchineList = []
) {
    if (!macchinaId && !attrezzoId) {
        return null; // Nessun controllo se non ci sono macchine
    }

    // Converte orario in minuti totali dalla mezzanotte
    function orarioToMinuti(orario) {
        if (!orario) return null;
        const [ore, minuti] = orario.split(':').map(Number);
        return ore * 60 + minuti;
    }

    const inizioMinuti = orarioToMinuti(orarioInizio);
    if (inizioMinuti === null) {
        return null; // Se non c'è orario inizio, non possiamo verificare
    }

    const fineMinuti = orarioFine ? orarioToMinuti(orarioFine) : null;
    // Se non c'è orario fine per la nuova attività, considera fino alla fine della giornata (23:59)
    const fineEffettiva = fineMinuti !== null ? fineMinuti : 23 * 60 + 59;

    // Cerca conflitti nelle attività esistenti
    for (const attivitaEsistente of attivita) {
        // Escludi l'attività corrente se si sta modificando
        if (attivitaIdEsclusa && attivitaEsistente.id === attivitaIdEsclusa) {
            continue;
        }

        // Controlla solo attività della stessa data
        if (attivitaEsistente.data !== data) {
            continue;
        }

        // Verifica conflitto trattore
        if (macchinaId && attivitaEsistente.macchinaId === macchinaId) {
            const esistenteInizio = orarioToMinuti(attivitaEsistente.orarioInizio);
            if (esistenteInizio === null) continue; // Skip se non ha orario inizio
            
            // Se l'attività esistente ha orario fine, usa quello, altrimenti considera fino fine giornata
            const esistenteFine = attivitaEsistente.orarioFine 
                ? orarioToMinuti(attivitaEsistente.orarioFine) 
                : 23 * 60 + 59; // Se non ha ora fine, considera fino fine giornata

            // Verifica sovrapposizione: due intervalli si sovrappongono se:
            // nuovoInizio < esistenteFine E nuovoFine > esistenteInizio
            // Ma dobbiamo anche considerare che se l'attività esistente è completata (ha orario fine),
            // la nuova attività può iniziare esattamente quando finisce quella esistente
            const siSovrappongono = inizioMinuti < esistenteFine && fineEffettiva > esistenteInizio;
            
            // Se l'attività esistente è completata (ha orario fine) e la nuova inizia quando finisce o dopo, non c'è conflitto
            const iniziaQuandoFinisceEsistente = attivitaEsistente.orarioFine && inizioMinuti >= esistenteFine;
            
            if (siSovrappongono && !iniziaQuandoFinisceEsistente) {
                const macchinaNome = macchineList.find(m => m.id === macchinaId)?.nome || 'Trattore';
                return {
                    tipo: 'trattore',
                    macchinaNome: macchinaNome,
                    conflitto: attivitaEsistente,
                    messaggio: `Il trattore "${macchinaNome}" è già in uso dalle ${attivitaEsistente.orarioInizio}${attivitaEsistente.orarioFine ? ` alle ${attivitaEsistente.orarioFine}` : ' (attività in corso)'} per "${attivitaEsistente.tipoLavoro}" sul terreno "${attivitaEsistente.terrenoNome}"`
                };
            }
        }

        // Verifica conflitto attrezzo
        if (attrezzoId && attivitaEsistente.attrezzoId === attrezzoId) {
            const esistenteInizio = orarioToMinuti(attivitaEsistente.orarioInizio);
            if (esistenteInizio === null) continue; // Skip se non ha orario inizio
            
            const esistenteFine = attivitaEsistente.orarioFine 
                ? orarioToMinuti(attivitaEsistente.orarioFine) 
                : 23 * 60 + 59;

            const siSovrappongono = inizioMinuti < esistenteFine && fineEffettiva > esistenteInizio;
            // Se l'attività esistente è completata (ha orario fine) e la nuova inizia quando finisce o dopo, non c'è conflitto
            const iniziaQuandoFinisceEsistente = attivitaEsistente.orarioFine && inizioMinuti >= esistenteFine;
            
            if (siSovrappongono && !iniziaQuandoFinisceEsistente) {
                const attrezzoNome = macchineList.find(m => m.id === attrezzoId)?.nome || 'Attrezzo';
                return {
                    tipo: 'attrezzo',
                    attrezzoNome: attrezzoNome,
                    conflitto: attivitaEsistente,
                    messaggio: `L'attrezzo "${attrezzoNome}" è già in uso dalle ${attivitaEsistente.orarioInizio}${attivitaEsistente.orarioFine ? ` alle ${attivitaEsistente.orarioFine}` : ' (attività in corso)'} per "${attivitaEsistente.tipoLavoro}" sul terreno "${attivitaEsistente.terrenoNome}"`
                };
            }
        }
    }

    return null; // Nessun conflitto
}

/**
 * Libera automaticamente macchine di attività del giorno precedente senza "ora fine"
 * @param {Array} attivita - Array attività esistenti
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 */
export async function liberaMacchineAttivitaPrecedenti(
    attivita,
    currentTenantId,
    db,
    hasParcoMacchineModule
) {
    if (!hasParcoMacchineModule) return;
    
    try {
        const oggi = new Date();
        const oggiString = oggi.toISOString().split('T')[0];
        
        // Trova attività del giorno precedente senza orario fine
        const attivitaPrecedenti = attivita.filter(att => {
            if (!att.data || att.data >= oggiString) return false;
            if (att.orarioFine) return false; // Ha orario fine, quindi completata
            return att.macchinaId || att.attrezzoId;
        });
        
        // Libera macchine
        for (const att of attivitaPrecedenti) {
            if (att.macchinaId) {
                await updateMacchinaStato(att.macchinaId, 'disponibile', currentTenantId, db);
            }
            if (att.attrezzoId) {
                await updateMacchinaStato(att.attrezzoId, 'disponibile', currentTenantId, db);
            }
        }
    } catch (error) {
        console.error('Errore liberazione macchine attività precedenti:', error);
    }
}

// ============================================
// FUNZIONI CARICAMENTO DATI
// ============================================

/**
 * Carica macchine usando servizio centralizzato o fallback diretto
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 * @param {Array} macchineList - Array macchine (modificato in place)
 * @param {Function} populateTrattoriDropdownCallback - Callback per popolare dropdown trattori
 */
/**
 * Carica macchine usando servizio centralizzato
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 * @param {Array} macchineList - Array macchine (modificato in place)
 * @param {Function} populateTrattoriDropdownCallback - Callback per popolare dropdown trattori
 */
export async function loadMacchine(
    currentTenantId,
    db,
    app,
    auth,
    hasParcoMacchineModule,
    macchineList,
    populateTrattoriDropdownCallback
) {
    if (!hasParcoMacchineModule || !currentTenantId) return;
    
    try {
        // Usa servizio centralizzato tramite helper
        const { loadMacchineViaService } = await import('../services/service-helper.js');
        const macchine = await loadMacchineViaService({
            tenantId: currentTenantId,
            firebaseInstances: { app, db, auth },
            options: {
                orderBy: 'nome',
                orderDirection: 'asc'
            }
        });
        
        // Filtra lato client: solo macchine non dismesse
        const macchineAttive = macchine.filter(m => m.stato !== 'dismesso');
        
        // Aggiorna array macchine
        macchineList.length = 0; // Pulisci array
        macchineList.push(...macchineAttive);
        
        // Popola dropdown trattori
        if (populateTrattoriDropdownCallback) {
            populateTrattoriDropdownCallback();
        }
    } catch (error) {
        console.error('Errore caricamento macchine:', error);
        macchineList.length = 0;
    }
}

/**
 * Popola dropdown trattori
 * @param {Array} macchineList - Array macchine disponibili
 * @param {string} selectedTrattoreId - ID trattore selezionato (opzionale)
 */
export function populateTrattoriDropdown(macchineList = [], selectedTrattoreId = null) {
    const select = document.getElementById('attivita-macchina');
    if (!select) {
        console.warn('[populateTrattoriDropdown] Dropdown attivita-macchina non trovato');
        return;
    }
    
    select.innerHTML = '<option value="">-- Seleziona trattore --</option>';
    
    if (!macchineList || macchineList.length === 0) {
        return;
    }
    
    const trattori = macchineList
        .filter(m => {
            const tipo = m.tipoMacchina || m.tipo;
            return tipo === 'trattore' && m.stato !== 'dismesso';
        })
        .sort((a, b) => {
            const nomeA = (a.nome || '').toLowerCase();
            const nomeB = (b.nome || '').toLowerCase();
            return nomeA.localeCompare(nomeB);
        });
    
    trattori.forEach(trattore => {
        const option = document.createElement('option');
        option.value = trattore.id;
        const nome = trattore.nome || 'Trattore senza nome';
        const cavalli = trattore.cavalli ? ` (${trattore.cavalli} CV)` : '';
        const stato = trattore.stato === 'disponibile' ? '✅' : 
                     trattore.stato === 'in_uso' ? '🔄' : 
                     trattore.stato === 'in_manutenzione' ? '🔧' : 
                     trattore.stato === 'guasto' ? '❌' : '';
        option.textContent = `${stato} ${nome}${cavalli}`;
        if (trattore.id === selectedTrattoreId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

/**
 * Popola dropdown attrezzi compatibili con trattore selezionato
 * @param {string} trattoreId - ID trattore selezionato
 * @param {Array} macchineList - Array macchine disponibili
 * @param {string} selectedAttrezzoId - ID attrezzo selezionato (opzionale)
 */
export function populateAttrezziDropdown(trattoreId, macchineList = [], selectedAttrezzoId = null) {
    const select = document.getElementById('attivita-attrezzo');
    const group = document.getElementById('attivita-attrezzo-group');
    if (!select || !group) return;
    
    // Pulisci opzioni esistenti
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    if (!trattoreId) {
        group.style.display = 'none';
        return;
    }
    
    group.style.display = 'block';
    
    // Trova trattore selezionato
    const trattore = macchineList.find(m => m.id === trattoreId);
    if (!trattore || !trattore.cavalli) {
        return;
    }
    
    // Filtra e ordina attrezzi compatibili (escludi solo quelli dismessi)
    const attrezziCompatibili = macchineList
        .filter(macchina => {
            const tipoMacchina = macchina.tipoMacchina || macchina.tipo;
            if (tipoMacchina !== 'attrezzo' || macchina.stato === 'dismesso') {
                return false;
            }
            const cavalliMinimi = macchina.cavalliMinimiRichiesti || 0;
            return trattore.cavalli >= cavalliMinimi;
        })
        .sort((a, b) => {
            const nomeA = (a.nome || '').toLowerCase();
            const nomeB = (b.nome || '').toLowerCase();
            return nomeA.localeCompare(nomeB);
        });
    
    // Aggiungi attrezzi compatibili al dropdown
    attrezziCompatibili.forEach(macchina => {
        const option = document.createElement('option');
        option.value = macchina.id;
        const nome = macchina.nome || 'Attrezzo senza nome';
        const stato = macchina.stato === 'disponibile' ? '✅' : 
                     macchina.stato === 'in_uso' ? '🔄' : 
                     macchina.stato === 'in_manutenzione' ? '🔧' : 
                     macchina.stato === 'guasto' ? '❌' : '';
        option.textContent = `${stato} ${nome}`;
        // NON disabilitiamo gli attrezzi: il controllo di conflitto al salvataggio gestirà tutto
        // Questo permette di selezionare attrezzi anche se sono in_uso per altre attività in orari diversi
        option.disabled = false;
        if (macchina.id === selectedAttrezzoId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

/**
 * Carica terreni usando servizio centralizzato
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} app - Istanza Firebase App
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Array} terreni - Array terreni (modificato in place)
 * @param {boolean} isContoTerziMode - Se è modalità Conto Terzi
 * @param {Function} populateColtureFromTerreniCallback - Callback per popolare colture
 */
export async function loadTerreni(
    currentTenantId,
    db,
    app,
    auth,
    terreni,
    isContoTerziMode,
    populateColtureFromTerreniCallback
) {
    try {
        if (!currentTenantId) return;

        // Usa servizio centralizzato tramite helper
        // Carica TUTTI i terreni (sia aziendali che clienti) perché poi filtriamo lato client
        const { loadTerreniViaService } = await import('../services/service-helper.js');
        
        // Carica terreni aziendali
        const terreniAziendali = await loadTerreniViaService({
            tenantId: currentTenantId,
            firebaseInstances: { app, db, auth },
            options: {
                orderBy: 'nome',
                orderDirection: 'asc',
                clienteId: null // Solo terreni aziendali
            }
        });
        
        // Carica terreni clienti (se necessario per modalità Conto Terzi)
        // Nota: il servizio terreni-service potrebbe non supportare direttamente "tutti i clienti"
        // Quindi carichiamo solo aziendali e aggiungiamo clienti se necessario
        // Per ora carichiamo solo aziendali e gestiamo clienti separatamente se serve
        
        terreni.length = 0; // Pulisci array
        
        // Aggiungi terreni aziendali
        terreni.push(...terreniAziendali);
        
        // Se in modalità Conto Terzi, dobbiamo anche caricare terreni clienti
        // Per ora manteniamo compatibilità: se il servizio non supporta "tutti i clienti",
        // carichiamo anche direttamente i terreni clienti (fallback)
        if (isContoTerziMode) {
            try {
                const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const terreniCollection = await getTerreniCollection(currentTenantId, db);
                const querySnapshot = await getDocs(terreniCollection);
                
                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    // Aggiungi solo terreni clienti (con clienteId)
                    if (data.clienteId && data.clienteId !== '') {
                        terreni.push({
                            id: docSnap.id,
                            nome: data.nome || '',
                            coltura: data.coltura || null,
                            clienteId: data.clienteId,
                            superficie: data.superficie || 0,
                            coordinate: data.coordinate || null,
                            polygonCoords: data.polygonCoords || null
                        });
                    }
                });
            } catch (error) {
                console.warn('Errore caricamento terreni clienti:', error);
            }
        }
        
        // Ordina client-side per nome
        terreni.sort((a, b) => {
            const nomeA = (a.nome || '').toLowerCase();
            const nomeB = (b.nome || '').toLowerCase();
            return nomeA.localeCompare(nomeB);
        });

        // Popola dropdown terreni
        const terrenoSelect = document.getElementById('attivita-terreno');
        const filterTerrenoSelect = document.getElementById('filter-terreno');
        
        if (terrenoSelect) terrenoSelect.innerHTML = '<option value="">-- Seleziona terreno --</option>';
        if (filterTerrenoSelect) filterTerrenoSelect.innerHTML = '<option value="">Tutti i terreni</option>';
        
        // Filtra terreni in base alla modalità
        let terreniDaMostrare = terreni;
        if (isContoTerziMode) {
            // In modalità conto terzi, mostra solo terreni clienti (con clienteId)
            terreniDaMostrare = terreni.filter(t => t.clienteId != null && t.clienteId !== '');
        } else {
            // In modalità normale (core), mostra solo terreni aziendali (senza clienteId)
            terreniDaMostrare = terreni.filter(t => !t.clienteId || t.clienteId === '');
        }
        
        terreniDaMostrare.forEach(terreno => {
            if (terrenoSelect) {
                const option1 = document.createElement('option');
                option1.value = terreno.id;
                option1.textContent = terreno.nome;
                terrenoSelect.appendChild(option1);
            }

            if (filterTerrenoSelect) {
                const option2 = document.createElement('option');
                option2.value = terreno.id;
                option2.textContent = terreno.nome;
                filterTerrenoSelect.appendChild(option2);
            }
        });
        
        // Popola colture dai terreni (per campo gerarchico)
        if (populateColtureFromTerreniCallback) populateColtureFromTerreniCallback();
    } catch (error) {
        console.error('Errore caricamento terreni:', error);
    }
}

/**
 * Carica lavori conto terzi (solo se modalità Conto Terzi)
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {boolean} isContoTerziMode - Se è modalità Conto Terzi
 * @param {Array} lavoriList - Array lavori (modificato in place)
 * @param {Function} populateLavoriDropdownCallback - Callback per popolare dropdown lavori
 */
export async function loadLavoriContoTerzi(
    currentTenantId,
    db,
    isContoTerziMode,
    lavoriList,
    populateLavoriDropdownCallback
) {
    try {
        if (!currentTenantId || !isContoTerziMode) return;

        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        // Carica tutti i lavori e filtra client-side per evitare indice composto
        const lavoriRef = collection(db, 'tenants', currentTenantId, 'lavori');
        const snapshot = await getDocs(lavoriRef);
        
        lavoriList.length = 0; // Pulisci array
        snapshot.forEach(doc => {
            const data = doc.data();
            // Filtra solo lavori con clienteId (conto terzi)
            if (data.clienteId != null && data.clienteId !== '') {
                lavoriList.push({
                    id: doc.id,
                    ...data,
                    terrenoId: data.terrenoId || null,
                    clienteId: data.clienteId || null
                });
            }
        });
        
        // Ordina client-side per nome
        lavoriList.sort((a, b) => {
            const nomeA = (a.nome || '').toLowerCase();
            const nomeB = (b.nome || '').toLowerCase();
            return nomeA.localeCompare(nomeB);
        });

        // Popola dropdown lavori nel form (solo lavori in corso se statoFiltro specificato)
        if (populateLavoriDropdownCallback) populateLavoriDropdownCallback();
    } catch (error) {
        console.error('Errore caricamento lavori conto terzi:', error);
        lavoriList.length = 0;
    }
}

/**
 * Carica clienti (solo se modalità Conto Terzi)
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {boolean} isContoTerziMode - Se è modalità Conto Terzi
 * @param {Array} clientiList - Array clienti (modificato in place)
 * @param {Function} populateClientiDropdownCallback - Callback per popolare dropdown clienti
 */
export async function loadClienti(
    currentTenantId,
    db,
    isContoTerziMode,
    clientiList,
    populateClientiDropdownCallback
) {
    try {
        if (!currentTenantId || !isContoTerziMode) return;

        const { collection, query, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const clientiRef = collection(db, 'tenants', currentTenantId, 'clienti');
        const q = query(clientiRef, orderBy('ragioneSociale', 'asc'));
        const snapshot = await getDocs(q);
        
        clientiList.length = 0; // Pulisci array
        snapshot.forEach(doc => {
            clientiList.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Popola dropdown clienti nel form
        if (populateClientiDropdownCallback) populateClientiDropdownCallback();
    } catch (error) {
        console.error('Errore caricamento clienti:', error);
        clientiList.length = 0;
    }
}

/**
 * Carica attività da Firestore
 * @param {string} currentTenantId - ID tenant corrente
 * @param {Object} db - Istanza Firestore
 * @param {Object} auth - Istanza Firebase Auth
 * @param {Array} attivita - Array attività (modificato in place)
 * @param {Array} filteredAttivita - Array attività filtrate (modificato in place)
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 * @param {Function} getTenantIdCallback - Callback per ottenere tenant ID
 * @param {Function} liberaMacchineCallback - Callback per liberare macchine
 * @param {Function} renderAttivitaCallback - Callback per renderizzare attività
 * @param {Function} showAlertCallback - Callback per mostrare alert
 */
export async function loadAttivita(
    currentTenantId,
    db,
    auth,
    attivita,
    filteredAttivita,
    hasParcoMacchineModule,
    getTenantIdCallback,
    liberaMacchineCallback,
    renderAttivitaCallback,
    showAlertCallback
) {
    try {
        // Verifica che auth sia definito
        if (!auth) {
            console.error('❌ [loadAttivita] auth non definito!');
            return;
        }
        
        let tenantId = currentTenantId;
        if (!tenantId) {
            const user = auth.currentUser;
            if (user && getTenantIdCallback) {
                tenantId = await getTenantIdCallback(user.uid);
            }
        }
        
        if (!tenantId) {
            throw new Error('Tenant ID non disponibile');
        }

        const { query, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const attivitaCollection = await getAttivitaCollection(tenantId, db);
        // Usa solo orderBy su data per evitare bisogno di indice composito
        const q = query(attivitaCollection, orderBy('data', 'desc'));
        const querySnapshot = await getDocs(q);
        
        attivita.length = 0; // Pulisci array
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            attivita.push({
                id: docSnap.id,
                data: data.data || '',
                terrenoId: data.terrenoId || '',
                terrenoNome: data.terrenoNome || '',
                tipoLavoro: data.tipoLavoro || '',
                coltura: data.coltura || '',
                orarioInizio: data.orarioInizio || '',
                orarioFine: data.orarioFine || '',
                pauseMinuti: data.pauseMinuti || 0,
                oreNette: data.oreNette || 0,
                note: data.note || '',
                // Campi conto terzi (opzionali)
                clienteId: data.clienteId || null,
                clienteNome: data.clienteNome || null,
                lavoroId: data.lavoroId || null,
                // Campi macchina (opzionali)
                macchinaId: data.macchinaId || null,
                attrezzoId: data.attrezzoId || null,
                oreMacchina: data.oreMacchina !== null && data.oreMacchina !== undefined ? data.oreMacchina : null
            });
        });
        
        // Ordina per data (discendente) e poi per orario inizio (discendente)
        attivita.sort((a, b) => {
            if (a.data !== b.data) {
                return b.data.localeCompare(a.data); // Data discendente
            }
            // Se stessa data, ordina per orario inizio discendente
            return (b.orarioInizio || '').localeCompare(a.orarioInizio || '');
        });
        
        filteredAttivita.length = 0;
        filteredAttivita.push(...attivita);
        
        // Libera automaticamente macchine di attività del giorno precedente senza "ora fine"
        if (hasParcoMacchineModule && liberaMacchineCallback) {
            await liberaMacchineCallback(attivita, tenantId, db, hasParcoMacchineModule);
        }
        
        // Renderizza attività
        if (renderAttivitaCallback) renderAttivitaCallback();
    } catch (error) {
        console.error('Errore caricamento attività:', error);
        if (showAlertCallback) {
            showAlertCallback('Errore nel caricamento delle attività: ' + error.message, 'error');
        }
        const container = document.getElementById('attivita-container');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-error">
                    <strong>Errore:</strong> ${error.message}
                </div>
            `;
        }
    }
}

/**
 * Popola dropdown lavori nel form (solo lavori conto terzi in corso)
 * @param {Array} lavoriList - Array lavori disponibili
 */
export function populateLavoriDropdown(lavoriList = []) {
    const select = document.getElementById('attivita-lavoro');
    if (!select) return;

    // Filtra solo lavori in corso se statoFiltro specificato
    const urlParams = new URLSearchParams(window.location.search);
    const statoFiltro = urlParams.get('stato');
    const lavoriFiltrati = statoFiltro 
        ? lavoriList.filter(l => l.stato === statoFiltro)
        : lavoriList.filter(l => l.stato === 'in_corso'); // Default: solo in corso

    select.innerHTML = '<option value="">-- Seleziona lavoro --</option>';
    lavoriFiltrati.forEach(lavoro => {
        const option = document.createElement('option');
        option.value = lavoro.id;
        // Badge Conto Terzi se presente
        const isContoTerzi = lavoro.clienteId != null && lavoro.clienteId !== '';
        const nomeLavoro = lavoro.nome || 'Lavoro senza nome';
        option.textContent = isContoTerzi ? `${nomeLavoro} 💼 Conto Terzi` : nomeLavoro;
        option.dataset.terrenoId = lavoro.terrenoId || '';
        option.dataset.clienteId = lavoro.clienteId || '';
        select.appendChild(option);
    });
}

/**
 * Popola dropdown clienti nel form
 * @param {Array} clientiList - Array clienti disponibili
 */
export function populateClientiDropdown(clientiList = []) {
    const select = document.getElementById('attivita-cliente');
    if (!select) return;

    select.innerHTML = '<option value="">-- Seleziona cliente --</option>';
    clientiList.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.ragioneSociale || cliente.nome || 'Cliente senza nome';
        select.appendChild(option);
    });
    
    // Popola anche il filtro clienti se esiste
    const filterClienteSelect = document.getElementById('filter-cliente');
    if (filterClienteSelect) {
        filterClienteSelect.innerHTML = '<option value="">Tutti i clienti</option>';
        clientiList.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = cliente.ragioneSociale || cliente.nome || 'Cliente senza nome';
            filterClienteSelect.appendChild(option);
        });
    }
}

/**
 * Aggiorna dropdown colture nel form attività in base alla categoria selezionata
 * @param {string} categoriaId - ID categoria selezionata
 * @param {Object} colturePerCategoria - Oggetto con colture per categoria (window.colturePerCategoriaAttivita)
 */
export function updateColtureDropdownAttivita(categoriaId, colturePerCategoria = {}) {
    const categoriaSelect = document.getElementById('attivita-coltura-categoria');
    const colturaSelect = document.getElementById('attivita-coltura-gerarchica');
    
    if (!categoriaSelect || !colturaSelect) {
        return;
    }
    
    // Reset dropdown colture
    colturaSelect.innerHTML = '<option value="">-- Seleziona coltura --</option>';
    
    if (!categoriaId) {
        colturaSelect.innerHTML = '<option value="">-- Seleziona prima la categoria --</option>';
        return;
    }
    
    // Popola con le colture della categoria selezionata
    const coltureCategoria = colturePerCategoria[categoriaId] || [];
    
    if (coltureCategoria.length === 0) {
        colturaSelect.innerHTML = '<option value="">-- Nessuna coltura disponibile per questa categoria --</option>';
        return;
    }
    
    // Ordina per nome
    coltureCategoria.sort((a, b) => {
        const nomeA = (a.nome || a || '').toLowerCase();
        const nomeB = (b.nome || b || '').toLowerCase();
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
 * Popola dropdown sottocategorie lavori
 * @param {string} parentId - ID categoria principale
 * @param {Map} sottocategorieLavoriMap - Map con sottocategorie per categoria
 * @param {string} selectedValue - Valore selezionato (opzionale)
 */
export function populateSottocategorieLavoro(parentId, sottocategorieLavoriMap, selectedValue = null) {
    const sottocategoriaSelect = document.getElementById('attivita-sottocategoria');
    const sottocategoriaGroup = document.getElementById('attivita-sottocategoria-group');
    
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
 * Popola dropdown categoria principale lavoro
 * @param {Array} categorieLavoriPrincipali - Array categorie principali
 * @param {string} selectedValue - Valore selezionato (opzionale)
 */
export function populateCategoriaLavoroDropdown(categorieLavoriPrincipali = [], selectedValue = null) {
    // Assicura che categorieLavoriPrincipali sia sempre un array
    if (!categorieLavoriPrincipali || !Array.isArray(categorieLavoriPrincipali)) {
        console.warn('⚠️ [populateCategoriaLavoroDropdown] categorieLavoriPrincipali non è un array, uso array vuoto');
        categorieLavoriPrincipali = [];
    }
    
    const select = document.getElementById('attivita-categoria-principale');
    if (!select) {
        console.error('❌ [populateCategoriaLavoroDropdown] Dropdown attivita-categoria-principale non trovato!');
        return;
    }
    
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
 * Popola dropdown tipo lavoro nel form (filtrato per categoria)
 * @param {string} categoriaId - ID categoria
 * @param {Array} tipiLavoroList - Array completo tipi lavoro
 * @param {Map} sottocategorieLavoriMap - Map con sottocategorie
 * @param {string} selectedValue - Valore selezionato (opzionale)
 * @param {Array} tipiLavoroFiltratiParam - Tipi già filtrati (opzionale)
 */
export function populateTipoLavoroDropdown(
    categoriaId,
    tipiLavoroList = [],
    sottocategorieLavoriMap = new Map(),
    selectedValue = null,
    tipiLavoroFiltratiParam = null
) {
    const select = document.getElementById('attivita-tipo-lavoro-gerarchico');
    const tipoLavoroGroup = document.getElementById('attivita-tipo-lavoro-gerarchico-group');
    
    if (!select || !tipoLavoroGroup) return;
    
    select.innerHTML = '<option value="">-- Seleziona tipo lavoro --</option>';
    
    if (!categoriaId) {
        tipoLavoroGroup.style.display = 'none';
        return;
    }
    
    tipoLavoroGroup.style.display = 'block';
    
    // Se sono stati passati tipi già filtrati, usali direttamente
    let tipiFiltrati = tipiLavoroFiltratiParam;
    
    // Altrimenti, filtra tipi lavoro per categoria (include anche sottocategorie se categoriaId è principale)
    if (!tipiFiltrati) {
        tipiFiltrati = tipiLavoroList.filter(tipo => tipo.categoriaId === categoriaId);
        
        // Se non ci sono tipi per questa categoria specifica, verifica se è una categoria principale
        // e cerca anche nelle sue sottocategorie
        if (tipiFiltrati.length === 0) {
            const sottocat = sottocategorieLavoriMap.get(categoriaId);
            if (sottocat && sottocat.length > 0) {
                // Cerca tipi lavoro associati alle sottocategorie
                const sottocatIds = sottocat.map(sc => sc.id);
                tipiFiltrati = tipiLavoroList.filter(tipo => sottocatIds.includes(tipo.categoriaId));
            }
        }
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
        option.value = tipo.nome; // Usa nome per retrocompatibilità con attività esistenti
        option.textContent = tipo.nome;
        if (selectedValue === tipo.nome) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

/**
 * Popola dropdown colture estraendole dai terreni esistenti
 * @param {Array} terreni - Array terreni disponibili
 */
export function populateColtureFromTerreni(terreni = []) {
    // Estrai colture uniche dai terreni
    const coltureUniche = new Set();
    terreni.forEach(terreno => {
        if (terreno.coltura && terreno.coltura.trim()) {
            coltureUniche.add(terreno.coltura.trim());
        }
    });
    
    // Ordina le colture
    const coltureOrdinate = Array.from(coltureUniche).sort();
    
    // Popola il campo coltura gerarchica
    const colturaGerarchicaSelect = document.getElementById('attivita-coltura-gerarchica');
    if (colturaGerarchicaSelect) {
        // Mantieni l'opzione vuota se esiste, altrimenti creala
        if (colturaGerarchicaSelect.options.length === 0 || colturaGerarchicaSelect.options[0].value !== '') {
            colturaGerarchicaSelect.innerHTML = '<option value="">-- Seleziona coltura --</option>';
        } else {
            // Rimuovi tutte le opzioni tranne la prima (vuota)
            while (colturaGerarchicaSelect.options.length > 1) {
                colturaGerarchicaSelect.remove(1);
            }
        }
        
        // Aggiungi le colture
        coltureOrdinate.forEach(coltura => {
            const option = document.createElement('option');
            option.value = coltura;
            option.textContent = coltura;
            colturaGerarchicaSelect.appendChild(option);
        });
    }
    
    // Popola anche il campo coltura piatta se non è già stato popolato da loadListe
    const colturaSelect = document.getElementById('attivita-coltura');
    if (colturaSelect && colturaSelect.options.length <= 1) {
        // Se il campo è vuoto (solo opzione vuota), popolalo anche qui
        coltureOrdinate.forEach(coltura => {
            // Verifica che non esista già
            const esiste = Array.from(colturaSelect.options).some(opt => opt.value === coltura);
            if (!esiste) {
                const option = document.createElement('option');
                option.value = coltura;
                option.textContent = coltura;
                colturaSelect.appendChild(option);
            }
        });
    }
}

// ============================================
// RENDERING ATTIVITÀ
// ============================================

/**
 * Renderizza la lista delle attività
 * @param {Object} params - Parametri della funzione
 * @param {Array} params.filteredAttivita - Array attività filtrate
 * @param {Array} params.attivita - Array attività completo
 * @param {Array} params.lavoriList - Array lavori (per modalità Conto Terzi)
 * @param {Array} params.clientiList - Array clienti
 * @param {Array} params.terreni - Array terreni
 * @param {Array} params.macchineList - Array macchine
 * @param {boolean} params.isContoTerziMode - Se è modalità Conto Terzi
 * @param {boolean} params.hasParcoMacchineModule - Se modulo Parco Macchine è attivo
 * @param {boolean} params.hasManodoperaModule - Se modulo Manodopera è attivo
 * @param {Function} params.escapeHtml - Funzione escape HTML
 * @param {Function} params.formatOreNette - Funzione formattazione ore nette
 * @param {Function} params.populateTrattoriRapido - Funzione popolamento dropdown trattori rapido
 * @param {Function} params.initCalcoloOreNetteRapido - Funzione inizializzazione calcolo ore nette rapido
 * @param {Function} params.caricaDettagliLavoriCompletati - Funzione caricamento dettagli lavori completati
 */
export async function renderAttivita(params) {
    const {
        filteredAttivita,
        attivita,
        lavoriList,
        clientiList,
        terreni,
        macchineList,
        isContoTerziMode,
        hasParcoMacchineModule,
        hasManodoperaModule,
        escapeHtml,
        formatOreNette,
        populateTrattoriRapido,
        initCalcoloOreNetteRapido,
        caricaDettagliLavoriCompletati
    } = params;

    const container = document.getElementById('attivita-container');
    if (!container) return;
    
    // Determina se è modalità completati
    const urlParams = new URLSearchParams(window.location.search);
    const statoFiltro = urlParams.get('stato');
    const isModalitaCompletati = isContoTerziMode && statoFiltro === 'completato';

    let html = '';
    
    // Se modalità Conto Terzi, mostra prima i lavori (in corso o completati) con form rapido o solo consultazione
    if (isContoTerziMode && lavoriList.length > 0) {
        const urlParams = new URLSearchParams(window.location.search);
        const statoFiltro = urlParams.get('stato');
        
        // Se filtro è "completato", mostra lavori completati (solo consultazione)
        if (statoFiltro === 'completato') {
            // Applica filtri anche ai lavori
            const clienteId = document.getElementById('filter-cliente') ? document.getElementById('filter-cliente').value : '';
            const terrenoId = document.getElementById('filter-terreno') ? document.getElementById('filter-terreno').value : '';
            
            let lavoriCompletati = lavoriList.filter(l => l.stato === 'completato');
            
            // Filtra per cliente se specificato
            if (clienteId) {
                lavoriCompletati = lavoriCompletati.filter(l => l.clienteId === clienteId);
            }
            
            // Filtra per terreno se specificato
            if (terrenoId) {
                lavoriCompletati = lavoriCompletati.filter(l => l.terrenoId === terrenoId);
            }
            
            if (lavoriCompletati.length > 0) {
                html += `
                    <div style="background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 2px solid #1976D2;">
                        <h2 style="color: #1976D2; margin-bottom: 20px; font-size: 20px;">✅ Lavori Completati</h2>
                        <div style="display: grid; gap: 15px;" id="lavori-completati-container">
                            <div style="text-align: center; padding: 20px; color: #666;">Caricamento dettagli...</div>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div style="background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 2px solid #1976D2;">
                        <div class="empty-state">
                            <div class="empty-state-icon">✅</div>
                            <h3 style="color: #1976D2;">Nessun lavoro completato</h3>
                            <p>Non ci sono ancora lavori conto terzi completati.</p>
                        </div>
                    </div>
                `;
            }
        } else {
            // Mostra lavori in corso con form rapido
            const lavoriInCorso = lavoriList.filter(l => l.stato === 'in_corso');
            
            if (lavoriInCorso.length > 0) {
            html += `
                <div style="background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 2px solid #1976D2;">
                    <h2 style="color: #1976D2; margin-bottom: 20px; font-size: 20px;">💼 Lavori in Corso - Aggiungi Attività</h2>
                        <div style="display: grid; gap: 15px;">
            `;
            
            lavoriInCorso.forEach(lavoro => {
                const cliente = clientiList.find(c => c.id === lavoro.clienteId);
                const terreno = terreni.find(t => t.id === lavoro.terrenoId);
                const clienteNome = cliente ? (cliente.ragioneSociale || cliente.nome || 'Cliente sconosciuto') : 'Cliente sconosciuto';
                const terrenoNome = terreno ? terreno.nome : 'Terreno sconosciuto';
                
                html += `
                    <div class="lavoro-rapido-card" style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #BBDEFB;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                            <div>
                                <h3 style="color: #1976D2; margin: 0 0 5px 0; font-size: 16px;">${escapeHtml(lavoro.nome || 'Lavoro senza nome')}</h3>
                                <div style="font-size: 13px; color: #666;">
                                    <strong>Cliente:</strong> ${escapeHtml(clienteNome)} | 
                                    <strong>Terreno:</strong> ${escapeHtml(terrenoNome)} | 
                                    <strong>Tipo:</strong> ${escapeHtml(lavoro.tipoLavoro || '-')}
                                </div>
                            </div>
                            <button onclick="toggleFormRapido('${lavoro.id}')" class="btn btn-primary btn-sm" id="btn-toggle-${lavoro.id}">
                                ➕ Aggiungi Attività
                            </button>
                        </div>
                        
                        <form id="form-rapido-${lavoro.id}" class="form-rapido-lavoro" style="display: none; padding-top: 15px; border-top: 1px solid #E0E0E0;">
                            <input type="hidden" id="rapido-cliente-${lavoro.id}" value="${lavoro.clienteId}">
                            <input type="hidden" id="rapido-lavoro-${lavoro.id}" value="${lavoro.id}">
                            <input type="hidden" id="rapido-terreno-${lavoro.id}" value="${lavoro.terrenoId}">
                            <input type="hidden" id="rapido-tipo-lavoro-${lavoro.id}" value="${escapeHtml(lavoro.tipoLavoro || '')}">
                            
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                                <div>
                                    <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Data *</label>
                                    <input type="date" id="rapido-data-${lavoro.id}" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Ora Inizio *</label>
                                    <input type="time" id="rapido-ora-inizio-${lavoro.id}" required value="08:00" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Ora Fine *</label>
                                    <input type="time" id="rapido-ora-fine-${lavoro.id}" required value="17:00" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Pause (minuti)</label>
                                    <input type="number" id="rapido-pause-${lavoro.id}" min="0" value="60" placeholder="60" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Ore Nette</label>
                                    <input type="text" id="rapido-ore-nette-${lavoro.id}" readonly value="8.0" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f5f5f5; cursor: not-allowed;">
                                    <small style="display: block; margin-top: 3px; font-size: 11px; color: #666;">Calcolate automaticamente</small>
                                </div>
                                ${hasParcoMacchineModule ? `
                                <div>
                                    <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Trattore</label>
                                    <select id="rapido-trattore-${lavoro.id}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                        <option value="">-- Nessun trattore --</option>
                                    </select>
                                </div>
                                <div id="rapido-attrezzo-group-${lavoro.id}" style="display: none;">
                                    <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Attrezzo</label>
                                    <select id="rapido-attrezzo-${lavoro.id}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                        <option value="">-- Nessun attrezzo --</option>
                                    </select>
                                </div>
                                ` : ''}
                            </div>
                            
                            <div style="margin-top: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #666;">Note</label>
                                <textarea id="rapido-note-${lavoro.id}" placeholder="Note aggiuntive..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 60px; resize: vertical;"></textarea>
                            </div>
                            
                            <div style="margin-top: 15px; padding: 12px; background: #f8f9fa; border-radius: 6px; border: 1px solid #E0E0E0;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: #333;">
                                    <input type="checkbox" id="rapido-lavoro-terminato-${lavoro.id}" style="width: 18px; height: 18px; cursor: pointer;">
                                    <strong style="color: #1976D2;">✅ Segna lavoro come completato</strong>
                                </label>
                                <small style="display: block; margin-top: 5px; margin-left: 26px; color: #666; font-size: 12px;">
                                    Se selezionato, il lavoro passerà automaticamente da "In corso" a "Completato"
                                </small>
                            </div>
                            
                            <div style="display: flex; gap: 10px; margin-top: 15px;">
                                <button type="button" onclick="salvaAttivitaRapida('${lavoro.id}')" class="btn btn-success" style="flex: 1;">💾 Salva Attività</button>
                                <button type="button" onclick="toggleFormRapido('${lavoro.id}')" class="btn btn-secondary">Annulla</button>
                            </div>
                        </form>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
            } else {
                // Nessun lavoro in corso
                html += `
                    <div style="background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 2px solid #1976D2;">
                        <div class="empty-state">
                            <div class="empty-state-icon">✅</div>
                            <h3 style="color: #1976D2;">Nessun lavoro in corso</h3>
                            <p>Tutti i lavori conto terzi sono stati completati o non ci sono lavori da pianificare.</p>
                        </div>
                    </div>
                `;
            }
        }
    }
    
    // Sezione attività esistenti
    if (filteredAttivita.length === 0 && !isContoTerziMode) {
        html += `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <h3>Nessuna attività trovata</h3>
                <p>Aggiungi la prima attività utilizzando il pulsante "Aggiungi Attività".</p>
            </div>
        `;
        container.innerHTML = html;
        return;
    }
    
    // Se modalità conto terzi e non è modalità completati
    if (isContoTerziMode && !isModalitaCompletati) {
        const lavoriInCorso = lavoriList.filter(l => l.stato === 'in_corso');
        if (lavoriInCorso.length === 0) {
            // Non ci sono lavori in corso, mostra solo messaggio
            html += `
                <div style="margin-top: 20px;">
                    <div class="empty-state">
                        <div class="empty-state-icon">✅</div>
                        <h3>Nessun lavoro in corso</h3>
                        <p>Tutti i lavori conto terzi sono stati completati o non ci sono lavori da pianificare.</p>
                    </div>
                </div>
            `;
            container.innerHTML = html;
            return;
        }
        
        // Se ci sono lavori in corso ma nessuna attività, mostra messaggio
        if (filteredAttivita.length === 0) {
            html += `
                <div style="margin-top: 20px;">
                    <h3 style="color: #1976D2; margin-bottom: 15px;">📋 Attività Registrate</h3>
                    <div class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <h3>Nessuna attività registrata</h3>
                        <p>Usa i form rapidi sopra per aggiungere attività ai lavori in corso.</p>
                    </div>
                </div>
            `;
            container.innerHTML = html;
            return;
        }
    }
    
    // Se modalità completati, non mostrare la sezione attività esistenti (già mostrate nei lavori)
    if (isModalitaCompletati) {
        container.innerHTML = html;

        // Carica dettagli lavori completati dopo che l'HTML è stato aggiunto
        const clienteId = document.getElementById('filter-cliente') ? document.getElementById('filter-cliente').value : '';
        const terrenoId = document.getElementById('filter-terreno') ? document.getElementById('filter-terreno').value : '';
        
        let lavoriCompletati = lavoriList.filter(l => l.stato === 'completato');
        
        if (clienteId) {
            lavoriCompletati = lavoriCompletati.filter(l => l.clienteId === clienteId);
        }
        
        if (terrenoId) {
            lavoriCompletati = lavoriCompletati.filter(l => l.terrenoId === terrenoId);
        }
        
        if (lavoriCompletati.length > 0) {
            // Chiama la funzione dopo che il DOM è stato aggiornato
            setTimeout(() => {
                const containerCheck = document.getElementById('lavori-completati-container');
                if (!containerCheck) {
                    console.error('❌ Container non trovato dopo timeout');
                    return;
                }

                caricaDettagliLavoriCompletati(lavoriCompletati).catch(error => {
                    console.error('❌ Errore caricamento dettagli lavori completati:', error);
                    console.error('Stack:', error.stack);
                    const dettagliContainer = document.getElementById('lavori-completati-container');
                    if (dettagliContainer) {
                        dettagliContainer.innerHTML = `<div style="color: #d32f2f; padding: 20px; text-align: center;">
                            <strong>Errore caricamento dettagli:</strong><br>
                            ${error.message}<br>
                            <small style="color: #999; margin-top: 10px; display: block;">Controlla la console per maggiori dettagli</small>
                        </div>`;
                    }
                });
            }, 100);
        }
        
        return;
    }
    
    // Mostra attività esistenti
    html += `
        <div style="margin-top: 20px;">
            <h3 style="color: ${isContoTerziMode ? '#1976D2' : '#2E8B57'}; margin-bottom: 15px;">📋 Attività Registrate</h3>
    `;

    // Crea mappa macchine per visualizzazione
    let macchineMap = {};
    if (hasParcoMacchineModule) {
        try {
            macchineList.forEach(m => {
                macchineMap[m.id] = m.nome || 'Macchina senza nome';
            });
        } catch (error) {
            console.warn('Errore creazione mappa macchine:', error);
        }
    }

    html += `
        <div class="attivita-table">
            <div class="attivita-header">
                <div class="col-data">Data</div>
                ${isContoTerziMode ? '<div class="col-cliente">Cliente</div>' : ''}
                <div class="col-terreno">Terreno</div>
                <div class="col-tipo-lavoro">Tipo Lavoro</div>
                ${!isContoTerziMode ? '<div class="col-coltura">Coltura</div>' : ''}
                ${!isContoTerziMode ? '<div class="col-orari">Inizio</div>' : ''}
                ${!isContoTerziMode ? '<div class="col-orari">Fine</div>' : ''}
                ${!isContoTerziMode ? '<div class="col-orari">Pause</div>' : ''}
                <div class="col-ore">Ore Nette</div>
                ${hasParcoMacchineModule ? '<div class="col-macchina">Macchina</div>' : ''}
                <div class="col-azioni">Azioni</div>
            </div>
            ${filteredAttivita.map(att => {
                const dataFormatted = att.data ? new Date(att.data + 'T00:00:00').toLocaleDateString('it-IT') : '';
                const pauseFormatted = `${att.pauseMinuti} min`;
                const oreFormatted = formatOreNette(att.oreNette || 0);
                
                // Badge Conto Terzi se presente (sempre se ha clienteId)
                const isContoTerzi = att.clienteId != null && att.clienteId !== '';
                const contoTerziBadge = isContoTerzi ? '<span class="badge" style="background: #1976D2; color: white; margin-left: 5px; font-size: 10px; padding: 2px 6px; border-radius: 3px;">💼 Conto Terzi</span>' : '';
                const contoTerziStyle = isContoTerzi ? 'style="background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); border-left: 4px solid #1976D2;"' : '';
                
                return `
                <div class="attivita-row" ${contoTerziStyle}>
                    <div class="col-data" data-label="Data">
                        ${escapeHtml(dataFormatted)}
                    </div>
                    ${isContoTerziMode ? `
                    <div class="col-cliente" data-label="Cliente">
                        ${escapeHtml(att.clienteNome || '-')}${contoTerziBadge}
                    </div>
                    ` : ''}
                    <div class="col-terreno" data-label="Terreno">
                        ${escapeHtml(att.terrenoNome || '-')}
                    </div>
                    <div class="col-tipo-lavoro" data-label="Tipo Lavoro">
                        ${escapeHtml(att.tipoLavoro || '-')}${contoTerziBadge}
                    </div>
                    ${!isContoTerziMode ? `
                    <div class="col-coltura" data-label="Coltura">
                        ${escapeHtml(att.coltura || '-')}
                    </div>
                    <div class="col-orari" data-label="Inizio">
                        ${escapeHtml(att.orarioInizio || '-')}
                    </div>
                    <div class="col-orari" data-label="Fine">
                        ${escapeHtml(att.orarioFine || '-')}
                    </div>
                    <div class="col-orari" data-label="Pause">
                        ${pauseFormatted}
                    </div>
                    ` : ''}
                    <div class="col-ore" data-label="Ore Nette">
                        ${oreFormatted}
                    </div>
                    ${hasParcoMacchineModule ? `
                    <div class="col-macchina" data-label="Macchina" style="font-size: 12px; color: #666;">
                        ${(() => {
                            const macchinaNome = att.macchinaId ? macchineMap[att.macchinaId] : null;
                            const attrezzoNome = att.attrezzoId ? macchineMap[att.attrezzoId] : null;
                            const oreMacchina = att.oreMacchina !== null && att.oreMacchina !== undefined ? att.oreMacchina : null;
                            
                            if (!macchinaNome && !attrezzoNome) {
                                return '-';
                            }
                            
                            const parts = [];
                            if (macchinaNome) parts.push(`🚜 ${escapeHtml(macchinaNome)}`);
                            if (attrezzoNome) parts.push(`⚙️ ${escapeHtml(attrezzoNome)}`);
                            
                            let result = parts.join('<br>');
                            if (oreMacchina !== null && oreMacchina !== att.oreNette) {
                                result += `<br><small style="color: #999;">Ore macchina: ${formatOreNette(oreMacchina)}</small>`;
                            }
                            
                            return result;
                        })()}
                    </div>
                    ` : ''}
                    <div class="col-azioni" data-label="Azioni">
                        <button onclick="editAttivita('${att.id}')" class="btn-edit-small" title="Modifica">✏️</button>
                        <button onclick="confirmDeleteAttivita('${att.id}')" class="btn-delete-small" title="Elimina">🗑️</button>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;
    
    html += `</div>`;
    container.innerHTML = html;

    // Se ci sono lavori completati, carica i dettagli dopo che l'HTML è stato aggiunto al DOM
    const urlParamsCheck = new URLSearchParams(window.location.search);
    const statoFiltroCheck = urlParamsCheck.get('stato');
    const isModalitaCompletatiCheck = isContoTerziMode && statoFiltroCheck === 'completato';

    if (isContoTerziMode && isModalitaCompletatiCheck && lavoriList.length > 0) {
        const clienteId = document.getElementById('filter-cliente') ? document.getElementById('filter-cliente').value : '';
        const terrenoId = document.getElementById('filter-terreno') ? document.getElementById('filter-terreno').value : '';
        
        let lavoriCompletati = lavoriList.filter(l => l.stato === 'completato');
        
        if (clienteId) {
            lavoriCompletati = lavoriCompletati.filter(l => l.clienteId === clienteId);
        }
        
        if (terrenoId) {
            lavoriCompletati = lavoriCompletati.filter(l => l.terrenoId === terrenoId);
        }
        
        if (lavoriCompletati.length > 0) {
            // Chiama la funzione dopo che il DOM è stato aggiornato
            setTimeout(() => {
                const containerCheck = document.getElementById('lavori-completati-container');
                if (!containerCheck) {
                    console.error('❌ Container non trovato dopo timeout');
                    return;
                }

                caricaDettagliLavoriCompletati(lavoriCompletati).catch(error => {
                    console.error('❌ Errore caricamento dettagli lavori completati:', error);
                    console.error('Stack:', error.stack);
                    const dettagliContainer = document.getElementById('lavori-completati-container');
                    if (dettagliContainer) {
                        dettagliContainer.innerHTML = `<div style="color: #d32f2f; padding: 20px; text-align: center;">
                            <strong>Errore caricamento dettagli:</strong><br>
                            ${error.message}<br>
                            <small style="color: #999; margin-top: 10px; display: block;">Controlla la console per maggiori dettagli</small>
                        </div>`;
                    }
                });
            }, 100);
        }
    }
    
    // Inizializza calcolo automatico ore nette per tutti i form rapidi
    if (isContoTerziMode && lavoriList.length > 0) {
        const lavoriInCorso = lavoriList.filter(l => l.stato === 'in_corso');
        lavoriInCorso.forEach(lavoro => {
            setTimeout(() => initCalcoloOreNetteRapido(lavoro.id), 200);
        });
    }
    
    // Popola dropdown macchine per form rapidi se Parco Macchine attivo
    if (isContoTerziMode && hasParcoMacchineModule && lavoriList.length > 0) {
        const lavoriInCorso = lavoriList.filter(l => l.stato === 'in_corso');
        lavoriInCorso.forEach(lavoro => {
            populateTrattoriRapido(lavoro.id);
        });
    }
    
    // Imposta data di default a oggi per tutti i form rapidi
    const today = new Date().toISOString().split('T')[0];
    const lavoriInCorso = isContoTerziMode ? lavoriList.filter(l => l.stato === 'in_corso') : [];
    lavoriInCorso.forEach(lavoro => {
        const dataInput = document.getElementById(`rapido-data-${lavoro.id}`);
        if (dataInput) {
            dataInput.value = today;
            dataInput.max = today;
        }
    });
}

/**
 * Carica dettagli completi per lavori completati (zone lavorate e ore validate)
 * @param {Object} params - Parametri della funzione
 * @param {Array} params.lavoriCompletati - Array lavori completati
 * @param {Array} params.attivita - Array attività completo
 * @param {Array} params.filteredAttivita - Array attività filtrate
 * @param {Array} params.clientiList - Array clienti
 * @param {Array} params.terreni - Array terreni
 * @param {string} params.currentTenantId - Tenant ID corrente
 * @param {Object} params.db - Istanza Firestore
 * @param {Function} params.collection - Funzione collection Firestore
 * @param {Function} params.getDocs - Funzione getDocs Firestore
 * @param {boolean} params.hasManodoperaModule - Se modulo Manodopera è attivo
 * @param {Function} params.escapeHtml - Funzione escape HTML
 * @param {Function} params.formatOreNette - Funzione formattazione ore nette
 */
export async function caricaDettagliLavoriCompletati(params) {
    const {
        lavoriCompletati,
        attivita,
        filteredAttivita,
        clientiList,
        terreni,
        currentTenantId,
        db,
        collection,
        getDocs,
        hasManodoperaModule,
        escapeHtml,
        formatOreNette
    } = params;

    const container = document.getElementById('lavori-completati-container');
    if (!container) {
        console.error('Container lavori-completati-container non trovato');
        return;
    }

    try {
        let html = '';
        
        if (!currentTenantId) {
            throw new Error('Tenant ID non disponibile');
        }
        
        if (!db) {
            throw new Error('Database Firestore non inizializzato');
        }
        
        for (const lavoro of lavoriCompletati) {
            const cliente = clientiList.find(c => c.id === lavoro.clienteId);
            const terreno = terreni.find(t => t.id === lavoro.terrenoId);
            const clienteNome = cliente ? (cliente.ragioneSociale || cliente.nome || 'Cliente sconosciuto') : 'Cliente sconosciuto';
            const terrenoNome = terreno ? terreno.nome : 'Terreno sconosciuto';
            
            // Trova attività per questo lavoro
            const attivitaLavoro = attivita.filter(a => a.lavoroId === lavoro.id);
            const totaleOreAttivita = attivitaLavoro.reduce((sum, a) => sum + (a.oreNette || 0), 0);
            
            // Raggruppa ore attività per data (per dettagli giornalieri)
            const oreAttivitaPerData = {};
            attivitaLavoro.forEach(att => {
                if (!att.data) return;
                const dataKey = att.data instanceof Date 
                    ? att.data.toISOString().split('T')[0]
                    : (typeof att.data === 'string' ? att.data : new Date(att.data).toISOString().split('T')[0]);
                
                if (!oreAttivitaPerData[dataKey]) {
                    oreAttivitaPerData[dataKey] = {
                        validate: att.oreNette || 0,
                        daValidare: 0,
                        totale: att.oreNette || 0
                    };
                } else {
                    oreAttivitaPerData[dataKey].validate += att.oreNette || 0;
                    oreAttivitaPerData[dataKey].totale += att.oreNette || 0;
                }
            });
            
            // Carica zone lavorate
            const zoneRef = collection(db, 'tenants', currentTenantId, 'lavori', lavoro.id, 'zoneLavorate');
            const zoneSnapshot = await getDocs(zoneRef);
            const zoneLavorate = [];
            let superficieTotaleLavorata = 0;
            const zonePerData = {};
            
            zoneSnapshot.forEach(zonaDoc => {
                const zonaData = zonaDoc.data();
                let dataZona;
                if (zonaData.data?.toDate) {
                    dataZona = zonaData.data.toDate();
                } else if (zonaData.data) {
                    dataZona = new Date(zonaData.data);
                } else {
                    dataZona = new Date();
                }
                
                const dataKey = new Date(dataZona.getFullYear(), dataZona.getMonth(), dataZona.getDate());
                const dataKeyString = dataKey.toISOString().split('T')[0];
                
                const zona = {
                    id: zonaDoc.id,
                    ...zonaData,
                    dataNormalizzata: dataKey,
                    dataKeyString: dataKeyString
                };
                
                zoneLavorate.push(zona);
                superficieTotaleLavorata += zona.superficieHa || 0;
                
                if (!zonePerData[dataKeyString]) {
                    zonePerData[dataKeyString] = [];
                }
                zonePerData[dataKeyString].push(zona);
            });
            
            // Carica ore validate e raggruppa per data
            const oreRef = collection(db, 'tenants', currentTenantId, 'lavori', lavoro.id, 'oreOperai');
            const oreSnapshot = await getDocs(oreRef);
            let totaleOreValidate = 0;
            let totaleOreDaValidare = 0;
            const orePerData = {}; // Raggruppa ore per data
            
            oreSnapshot.forEach(oraDoc => {
                const oraData = oraDoc.data();
                const oreNette = oraData.oreNette || 0;
                
                if (oraData.stato === 'validate') {
                    totaleOreValidate += oreNette;
                } else if (oraData.stato === 'da_validare') {
                    totaleOreDaValidare += oreNette;
                }
                
                // Raggruppa per data
                let dataOra;
                if (oraData.data?.toDate) {
                    dataOra = oraData.data.toDate();
                } else if (oraData.data) {
                    dataOra = new Date(oraData.data);
                } else {
                    return; // Salta se non ha data
                }
                
                const dataKey = new Date(dataOra.getFullYear(), dataOra.getMonth(), dataOra.getDate());
                const dataKeyString = dataKey.toISOString().split('T')[0];
                
                if (!orePerData[dataKeyString]) {
                    orePerData[dataKeyString] = {
                        validate: 0,
                        daValidare: 0,
                        totale: 0
                    };
                }
                
                if (oraData.stato === 'validate') {
                    orePerData[dataKeyString].validate += oreNette;
                } else if (oraData.stato === 'da_validare') {
                    orePerData[dataKeyString].daValidare += oreNette;
                }
                orePerData[dataKeyString].totale += oreNette;
            });
            
            // Usa superficie dal documento lavoro se disponibile, altrimenti calcolata
            const superficieLavorata = lavoro.superficieTotaleLavorata || superficieTotaleLavorata;
            const superficieTotale = terreno?.superficie || 0;
            
            // Calcola percentuale: se lavoro è completato e non ci sono zone tracciate, considera 100%
            let percentuale;
            if (lavoro.stato === 'completato' && zoneLavorate.length === 0 && superficieLavorata === 0) {
                // Lavoro completato senza zone tracciate (solo Core+Conto Terzi) → 100%
                percentuale = 100;
            } else {
                percentuale = superficieTotale > 0 ? Math.round((superficieLavorata / superficieTotale) * 100) : 0;
            }
            
            // Determina quale totale ore usare: se Manodopera attivo usa ore validate, altrimenti ore attività
            const oreDaMostrare = hasManodoperaModule && totaleOreValidate > 0 
                ? totaleOreValidate 
                : totaleOreAttivita;
            
            // Unisci orePerData con oreAttivitaPerData (priorità a orePerData se esistono)
            Object.keys(oreAttivitaPerData).forEach(dataKey => {
                if (!orePerData[dataKey]) {
                    orePerData[dataKey] = oreAttivitaPerData[dataKey];
                } else {
                    // Se esistono già dati per questa data, aggiungi le ore attività
                    orePerData[dataKey].totale += oreAttivitaPerData[dataKey].totale;
                    orePerData[dataKey].validate += oreAttivitaPerData[dataKey].validate;
                }
            });
            
            // Ordina date zone lavorate (più recenti prima)
            const dateZone = Object.keys(zonePerData).sort((a, b) => new Date(b) - new Date(a));
            
            html += `
                <div class="lavoro-completato-card" style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #BBDEFB; cursor: pointer;" onclick="toggleDettagliLavoro('${lavoro.id}')">
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <h3 style="color: #1976D2; margin: 0 0 5px 0; font-size: 16px;">${escapeHtml(lavoro.nome || 'Lavoro senza nome')}</h3>
                                <div style="font-size: 13px; color: #666; margin-bottom: 10px;">
                                    <strong>Cliente:</strong> ${escapeHtml(clienteNome)} | 
                                    <strong>Terreno:</strong> ${escapeHtml(terrenoNome)} | 
                                    <strong>Tipo:</strong> ${escapeHtml(lavoro.tipoLavoro || '-')}
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">
                                    ${superficieTotale > 0 ? `
                                    <div style="font-size: 13px; color: #1976D2;">
                                        <strong>📊 Superficie:</strong> ${superficieLavorata > 0 ? `${superficieLavorata.toFixed(2)} / ${superficieTotale.toFixed(2)} ha` : `${superficieTotale.toFixed(2)} ha`}
                                    </div>
                                    ` : ''}
                                    <div style="font-size: 13px; color: #1976D2;">
                                        <strong>✅ Completamento:</strong> ${percentuale}%
                                    </div>
                                    <div style="font-size: 13px; color: #1976D2;">
                                        <strong>⏱️ Ore ${hasManodoperaModule && totaleOreValidate > 0 ? 'Validate' : 'Lavorate'}:</strong> ${formatOreNette(oreDaMostrare)}
                                    </div>
                                    ${hasManodoperaModule ? `
                                    <div style="font-size: 13px; color: #1976D2;">
                                        <strong>📝 Zone:</strong> ${zoneLavorate.length}
                                    </div>
                                    ` : ''}
                                </div>
                                ${superficieTotale > 0 ? `
                                <div style="margin-top: 10px;">
                                    <div style="background: #E0E0E0; height: 8px; border-radius: 4px; overflow: hidden;">
                                        <div style="background: linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%); height: 100%; width: ${Math.min(percentuale, 100)}%; transition: width 0.3s;"></div>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                            <div style="margin-left: 10px; color: #1976D2; font-size: 20px;" id="icon-toggle-${lavoro.id}">
                                ▼
                            </div>
                        </div>
                    </div>
                    
                    <div id="dettagli-lavoro-${lavoro.id}" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px solid #E0E0E0;" onclick="event.stopPropagation();">
                        ${dateZone.length > 0 || Object.keys(orePerData).length > 0 ? `
                        <h4 style="color: #1976D2; font-size: 14px; margin-bottom: 10px;">📅 Dettagli Giornalieri (Zone e Ore):</h4>
                        <div style="display: grid; gap: 10px; margin-bottom: 15px;">
                            ${dateZone.map(dataKey => {
                                const zoneGiorno = zonePerData[dataKey] || [];
                                const oreGiorno = orePerData[dataKey] || { validate: 0, daValidare: 0, totale: 0 };
                                const dataObj = new Date(dataKey);
                                const dataFormatted = dataObj.toLocaleDateString('it-IT', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                });
                                const superficieGiorno = zoneGiorno.reduce((sum, z) => sum + (z.superficieHa || 0), 0);
                                
                                return `
                                    <div style="background: #E3F2FD; padding: 12px; border-radius: 6px; border-left: 4px solid #1976D2;">
                                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                            <div style="flex: 1;">
                                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
                                                    <strong style="color: #1976D2;">📅 ${escapeHtml(dataFormatted)}</strong>
                                                    ${zoneGiorno.length > 0 ? `
                                                        <span style="color: #666; font-size: 12px;">
                                                            🗺️ ${zoneGiorno.length} ${zoneGiorno.length === 1 ? 'zona' : 'zone'}, ${superficieGiorno.toFixed(2)} ha
                                                        </span>
                                                    ` : ''}
                                                    ${oreGiorno.totale > 0 ? `
                                                        <span style="color: #1976D2; font-size: 12px; font-weight: bold;">
                                                            ⏱️ ${formatOreNette(oreGiorno.totale)}
                                                            ${oreGiorno.validate > 0 ? `<span style="color: #4CAF50;">(${formatOreNette(oreGiorno.validate)} validate)</span>` : ''}
                                                            ${oreGiorno.daValidare > 0 ? `<span style="color: #FF9800;">(${formatOreNette(oreGiorno.daValidare)} da validare)</span>` : ''}
                                                        </span>
                                                    ` : ''}
                                                </div>
                                                ${zoneGiorno.length === 0 && oreGiorno.totale === 0 ? `
                                                    <span style="color: #999; font-size: 12px; font-style: italic;">Nessun dato disponibile per questo giorno</span>
                                                ` : ''}
                                            </div>
                                            ${zoneGiorno.length > 0 ? `
                                                <button onclick="mostraMappaZonaLavorata('${lavoro.id}', '${dataKey}', '${escapeHtml(dataFormatted)}')" 
                                                        style="background: #1976D2; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; white-space: nowrap;"
                                                        onmouseover="this.style.background='#1565C0'" 
                                                        onmouseout="this.style.background='#1976D2'"
                                                        title="Visualizza zone lavorate di questo giorno">
                                                    🗺️ Mappa
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                            
                            ${Object.keys(orePerData).filter(dataKey => !dateZone.includes(dataKey)).map(dataKey => {
                                const oreGiorno = orePerData[dataKey];
                                const dataObj = new Date(dataKey);
                                const dataFormatted = dataObj.toLocaleDateString('it-IT', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                });
                                
                                return `
                                    <div style="background: #E3F2FD; padding: 12px; border-radius: 6px; border-left: 4px solid #1976D2;">
                                        <div style="display: flex; justify-content: space-between; align-items: start;">
                                            <div style="flex: 1;">
                                                <div style="display: flex; align-items: center; gap: 10px;">
                                                    <strong style="color: #1976D2;">📅 ${escapeHtml(dataFormatted)}</strong>
                                                    ${oreGiorno.totale > 0 ? `
                                                        <span style="color: #1976D2; font-size: 12px; font-weight: bold;">
                                                            ⏱️ ${formatOreNette(oreGiorno.totale)}
                                                            ${oreGiorno.validate > 0 ? `<span style="color: #4CAF50;">(${formatOreNette(oreGiorno.validate)} validate)</span>` : ''}
                                                            ${oreGiorno.daValidare > 0 ? `<span style="color: #FF9800;">(${formatOreNette(oreGiorno.daValidare)} da validare)</span>` : ''}
                                                        </span>
                                                    ` : ''}
                                                </div>
                                                <span style="color: #999; font-size: 12px; font-style: italic; margin-top: 4px; display: block;">Nessuna zona tracciata per questo giorno</span>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        ` : ''}
                        
                        ${attivitaLavoro.length > 0 ? `
                        <h4 style="color: #1976D2; font-size: 14px; margin-bottom: 10px;">📝 Attività registrate:</h4>
                        <div style="display: grid; gap: 8px;">
                            ${attivitaLavoro
                                .filter(att => {
                                    if (filteredAttivita.length === 0 && attivita.length > 0) {
                                        return false;
                                    }
                                    if (filteredAttivita.length > 0) {
                                        return filteredAttivita.some(fa => fa.id === att.id);
                                    }
                                    return true;
                                })
                                .map(att => {
                                    const dataFormatted = att.data ? new Date(att.data + 'T00:00:00').toLocaleDateString('it-IT') : '';
                                    const oreFormatted = formatOreNette(att.oreNette || 0);
                                    return `
                                        <div style="background: #F5F5F5; padding: 10px; border-radius: 6px; border-left: 3px solid #1976D2;">
                                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                                <div style="flex: 1;">
                                                    <strong style="color: #1976D2;">${escapeHtml(dataFormatted)}</strong>
                                                    <span style="color: #666; margin-left: 10px;">${escapeHtml(oreFormatted)}</span>
                                                    ${att.note ? `<div style="color: #666; font-size: 12px; margin-top: 4px;">${escapeHtml(att.note)}</div>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                        </div>
                        ` : '<div style="color: #999; font-size: 13px; font-style: italic;">Nessuna attività registrata</div>'}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;

    } catch (error) {
        console.error('❌ Errore caricamento dettagli lavori completati:', error);
        console.error('Stack trace:', error.stack);
        if (container) {
            container.innerHTML = `<div style="color: #d32f2f; padding: 20px; text-align: center;">
                <strong>Errore caricamento dettagli:</strong><br>
                ${error.message}<br>
                <small style="color: #999; margin-top: 10px; display: block;">Controlla la console per maggiori dettagli</small>
            </div>`;
        }
    }
}

/**
 * Carica liste personalizzate (tipi lavoro e colture)
 * Gestisce fallback per ambiente file:// e uso servizi centralizzati
 * @param {Object} params - Parametri funzione
 * @param {string} params.currentTenantId - ID tenant corrente
 * @param {Object} params.db - Istanza Firestore
 * @param {Object} params.app - Istanza Firebase App
 * @param {Object} params.auth - Istanza Firebase Auth
 * @param {Object} params.collection - Funzione collection Firestore
 * @param {Object} params.getDocs - Funzione getDocs Firestore
 * @param {Object} params.query - Funzione query Firestore
 * @param {Object} params.orderBy - Funzione orderBy Firestore
 * @param {Object} params.doc - Funzione doc Firestore
 * @param {Object} params.getDoc - Funzione getDoc Firestore
 * @param {Function} params.updateTipiLavoro - Callback per aggiornare tipiLavoro globale
 * @param {Function} params.updateColture - Callback per aggiornare colture globale
 * @param {Function} params.updateColturePerCategoria - Callback per aggiornare colturePerCategoria globale
 * @param {Function} params.updateCategorieColture - Callback per aggiornare categorieColture globale
 * @param {Function} params.loadCategorieLavoriCallback - Callback per caricare categorie lavori
 * @param {Function} params.loadTipiLavoroCallback - Callback per caricare tipi lavoro
 * @param {Function} params.populateFiltroTipoLavoroCallback - Callback per popolare filtro tipo lavoro
 * @param {Function} params.populateFiltroColtureCallback - Callback per popolare filtro colture
 * @param {Function} params.updateColtureDropdownAttivitaCallback - Callback per aggiornare dropdown colture
 * @param {Function} params.getTipiLavoro - Callback per leggere tipiLavoro globale
 * @param {Function} params.getColture - Callback per leggere colture globale
 */
export async function loadListe(params) {
    const {
        currentTenantId,
        db,
        app,
        auth,
        collection,
        getDocs,
        query,
        orderBy,
        doc: docFn,
        getDoc,
        updateTipiLavoro,
        updateColture,
        updateColturePerCategoria,
        updateCategorieColture,
        loadCategorieLavoriCallback,
        loadTipiLavoroCallback,
        populateFiltroTipoLavoroCallback,
        populateFiltroColtureCallback,
        updateColtureDropdownAttivitaCallback
    } = params;

    try {
        if (!currentTenantId) return;
        
        // Prova sempre a caricare da tipiLavoro (fonte unica di verità)
        try {
            const isFileProtocol = window.location.protocol === 'file:';
            let tipiLavoro = [];
            
            if (isFileProtocol) {
                // Fallback per ambiente file://
                const tipiRef = collection(db, `tenants/${currentTenantId}/tipiLavoro`);
                const snapshot = await getDocs(query(tipiRef, orderBy('nome', 'asc')));
                const tipiLavoroList = [];
                snapshot.forEach(doc => {
                    tipiLavoroList.push(doc.data().nome);
                });
                
                if (tipiLavoroList.length > 0) {
                    tipiLavoro = tipiLavoroList;
                } else {
                    throw new Error('tipiLavoro vuoto, uso ListePersonalizzate');
                }
            } else {
                // Usa servizio centralizzato per lista piatta
                // Assicura che Firebase sia inizializzato nel servizio
                try {
                    const { setFirebaseInstances } = await import('../services/firebase-service.js');
                    setFirebaseInstances({ app, db, auth });
                } catch (error) {
                    console.warn('Impossibile impostare Firebase instances nel servizio:', error);
                }
                
                // Assicura che il tenantId sia impostato nel servizio
                try {
                    const { setCurrentTenantId } = await import('../services/tenant-service.js');
                    if (currentTenantId) {
                        setCurrentTenantId(currentTenantId);
                    }
                } catch (error) {
                    console.warn('Impossibile impostare tenantId nel servizio:', error);
                }
                
                const { getTipiLavoroNomi } = await import('../services/liste-service.js');
                tipiLavoro = await getTipiLavoroNomi();
            }
            
            if (tipiLavoro.length > 0) {
                // Aggiorna variabile globale
                if (updateTipiLavoro) updateTipiLavoro(tipiLavoro);
                
                // Sempre usa struttura gerarchica completa (coerente con colture)
                if (loadCategorieLavoriCallback) await loadCategorieLavoriCallback();
                if (loadTipiLavoroCallback) await loadTipiLavoroCallback();
                // NON USCIRE QUI - continua per caricare anche le colture!
            } else {
                // Se tipiLavoro vuoto, fallback a ListePersonalizzate
                throw new Error('tipiLavoro vuoto, uso ListePersonalizzate');
            }
        } catch (error) {
            // Fallback: usa ListePersonalizzate se tipiLavoro non disponibile o vuoto
            console.warn('Impossibile caricare da tipiLavoro, uso ListePersonalizzate:', error.message);
            
            const listeRef = docFn(db, `tenants/${currentTenantId}/liste`, 'personalizzate');
            const listeSnap = await getDoc(listeRef);
            
            let tipiLavoro = [];
            if (listeSnap.exists()) {
                const data = listeSnap.data();
                tipiLavoro = data.tipiLavoro || [];
            } else {
                // Predefiniti solo per tipi lavoro (colture gestite nel blocco successivo)
                tipiLavoro = ['Potatura', 'Raccolta', 'Trattamento', 'Semina', 'Aratura', 'Irrigazione', 'Concimazione', 'Diserbo', 'Raccolta frutta', 'Raccolta verdura'];
            }
            
            if (updateTipiLavoro) updateTipiLavoro(tipiLavoro);
        }
        
        // Carica categorie e colture da collection colture (fonte unica di verità)
        try {
            const isFileProtocol = window.location.protocol === 'file:';
            let categorieColture = [];
            let colturePerCategoria = {};
            
            if (isFileProtocol) {
                // Fallback per ambiente file://
                // Carica categorie
                const categorieRef = collection(db, `tenants/${currentTenantId}/categorie`);
                const categorieSnapshot = await getDocs(categorieRef);
                
                categorieSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.applicabileA === 'colture' || data.applicabileA === 'entrambi') {
                        categorieColture.push({ id: doc.id, ...data });
                    }
                });
                
                // Ordina per ordine (client-side)
                categorieColture.sort((a, b) => {
                    const ordineA = a.ordine || 999;
                    const ordineB = b.ordine || 999;
                    return ordineA - ordineB;
                });
                
                // Carica colture organizzate per categoria
                const coltureRef = collection(db, `tenants/${currentTenantId}/colture`);
                const coltureSnapshot = await getDocs(query(coltureRef, orderBy('nome', 'asc')));
                
                coltureSnapshot.forEach(doc => {
                    const data = doc.data();
                    const categoriaId = data.categoriaId || 'senza_categoria';
                    if (!colturePerCategoria[categoriaId]) {
                        colturePerCategoria[categoriaId] = [];
                    }
                    colturePerCategoria[categoriaId].push({ id: doc.id, nome: data.nome, ...data });
                });
            } else {
                // Usa servizi centralizzati
                // Assicura che Firebase sia inizializzato nel servizio
                try {
                    const { setFirebaseInstances } = await import('../services/firebase-service.js');
                    setFirebaseInstances({ app, db, auth });
                } catch (error) {
                    console.warn('Impossibile impostare Firebase instances nel servizio:', error);
                }
                
                // Assicura che il tenantId sia impostato nel servizio
                try {
                    const { setCurrentTenantId } = await import('../services/tenant-service.js');
                    if (currentTenantId) {
                        setCurrentTenantId(currentTenantId);
                    }
                } catch (error) {
                    console.warn('Impossibile impostare tenantId nel servizio:', error);
                }
                
                // Carica categorie usando categorie-service
                const { getAllCategorie } = await import('../services/categorie-service.js');
                categorieColture = await getAllCategorie({
                    applicabileA: 'colture',
                    orderBy: 'ordine',
                    orderDirection: 'asc'
                });
                
                // Carica colture usando colture-service
                const { getAllColture } = await import('../services/colture-service.js');
                const coltureList = await getAllColture({
                    orderBy: 'nome',
                    orderDirection: 'asc'
                });
                
                // Organizza colture per categoria
                coltureList.forEach(coltura => {
                    const categoriaId = coltura.categoriaId || 'senza_categoria';
                    if (!colturePerCategoria[categoriaId]) {
                        colturePerCategoria[categoriaId] = [];
                    }
                    colturePerCategoria[categoriaId].push({
                        id: coltura.id,
                        nome: coltura.nome,
                        ...coltura
                    });
                });
            }
            
            // Popola dropdown categoria (sia quando si carica la pagina che quando si apre il modal)
            const categoriaSelect = document.getElementById('attivita-coltura-categoria');
            if (categoriaSelect) {
                // Salva il valore selezionato se esiste
                const valoreSelezionato = categoriaSelect.value;
                
                categoriaSelect.innerHTML = '<option value="">-- Seleziona categoria --</option>';
                categorieColture.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.nome;
                    categoriaSelect.appendChild(option);
                });
                
                // Ripristina il valore selezionato se esisteva
                if (valoreSelezionato) {
                    categoriaSelect.value = valoreSelezionato;
                }
            }
            
            // Salva in variabile globale per uso nelle funzioni
            if (updateColturePerCategoria) updateColturePerCategoria(colturePerCategoria);
            if (updateCategorieColture) updateCategorieColture(categorieColture);
            
            // Estrai tutte le colture per retrocompatibilità
            const colture = [];
            Object.values(colturePerCategoria).forEach(coltureList => {
                coltureList.forEach(c => colture.push(c.nome));
            });
            
            if (updateColture) updateColture(colture);
            
            // Aggiorna dropdown colture se categoria già selezionata
            if (categoriaSelect && categoriaSelect.value) {
                if (updateColtureDropdownAttivitaCallback) updateColtureDropdownAttivitaCallback();
            }
        } catch (error) {
            // Fallback: usa ListePersonalizzate se colture non disponibile
            console.warn('Impossibile caricare da colture, uso ListePersonalizzate:', error.message);
            // Non assegnare colture qui, viene già gestita dalla struttura gerarchica
            // Se il caricamento fallisce, colture rimane vuota o con valori precedenti
        }
        
        // Popola dropdown
        const tipoLavoroSelect = document.getElementById('attivita-tipo-lavoro');
        const colturaSelect = document.getElementById('attivita-coltura');
        const filterTipoLavoroSelect = document.getElementById('filter-tipo-lavoro');
        const filterColturaSelect = document.getElementById('filter-coltura');
        
        if (tipoLavoroSelect) {
            tipoLavoroSelect.innerHTML = '<option value="">-- Seleziona tipo lavoro --</option>';
        }
        if (colturaSelect) {
            colturaSelect.innerHTML = '<option value="">-- Seleziona coltura --</option>';
        }
        // Popola anche il campo coltura gerarchica se esiste
        const colturaGerarchicaSelect = document.getElementById('attivita-coltura-gerarchica');
        if (colturaGerarchicaSelect) {
            colturaGerarchicaSelect.innerHTML = '<option value="">-- Seleziona coltura --</option>';
        }
        
        // Popola filtro tipo lavoro con CATEGORIE invece di tipi specifici
        if (populateFiltroTipoLavoroCallback) populateFiltroTipoLavoroCallback();
        
        // Popola filtro colture con CATEGORIE invece di colture specifiche
        if (populateFiltroColtureCallback) populateFiltroColtureCallback();
        
        // Popola dropdown form (non filtri) con valori specifici come prima
        // Leggi i valori aggiornati dalle variabili globali tramite i callback
        const tipiLavoro = params.getTipiLavoro ? params.getTipiLavoro() : [];
        const colture = params.getColture ? params.getColture() : [];
        
        tipiLavoro.forEach(item => {
            if (tipoLavoroSelect) {
                const option1 = document.createElement('option');
                option1.value = item;
                option1.textContent = item;
                tipoLavoroSelect.appendChild(option1);
            }
        });
        
        colture.forEach(item => {
            if (colturaSelect) {
                const option1 = document.createElement('option');
                option1.value = item;
                option1.textContent = item;
                colturaSelect.appendChild(option1);
            }
            
            // Popola anche il campo coltura gerarchica se esiste
            if (colturaGerarchicaSelect) {
                const optionGerarchica = document.createElement('option');
                optionGerarchica.value = item;
                optionGerarchica.textContent = item;
                colturaGerarchicaSelect.appendChild(optionGerarchica);
            }
        });
    } catch (error) {
        console.error('Errore caricamento liste:', error);
    }
}

/**
 * Carica categorie lavori principali e sottocategorie (da collezione unificata)
 * @param {Object} params - Parametri funzione
 * @param {string} params.currentTenantId - ID tenant corrente
 * @param {Object} params.db - Istanza Firestore
 * @param {Object} params.app - Istanza Firebase App
 * @param {Object} params.auth - Istanza Firebase Auth
 * @param {Object} params.collection - Funzione collection Firestore
 * @param {Object} params.getDocs - Funzione getDocs Firestore
 * @param {Object} params.query - Funzione query Firestore
 * @param {Object} params.orderBy - Funzione orderBy Firestore
 * @param {Function} params.updateCategorieLavoriPrincipali - Callback per aggiornare categorieLavoriPrincipali globale
 * @param {Function} params.updateSottocategorieLavoriMap - Callback per aggiornare sottocategorieLavoriMap globale
 * @param {Function} params.populateCategoriaLavoroDropdownCallback - Callback per popolare dropdown categoria
 * @param {Function} params.populateFiltroTipoLavoroCallback - Callback per popolare filtro tipo lavoro
 */
export async function loadCategorieLavori(params) {
    const {
        currentTenantId,
        db,
        app,
        auth,
        collection,
        getDocs,
        query,
        orderBy,
        updateCategorieLavoriPrincipali,
        updateSottocategorieLavoriMap,
        populateCategoriaLavoroDropdownCallback,
        populateFiltroTipoLavoroCallback
    } = params;

    try {
        if (!currentTenantId) {
            console.warn('⚠️ [loadCategorieLavori] currentTenantId non definito');
            return [];
        }
        
        const isFileProtocol = window.location.protocol === 'file:';
        let categorieLavoriPrincipali = [];
        let sottocategorieLavoriMap = new Map();
        
        if (isFileProtocol) {
            // Fallback per ambiente file://
            const categorieRef = collection(db, `tenants/${currentTenantId}/categorie`);
            const snapshot = await getDocs(query(categorieRef, orderBy('ordine', 'asc')));
            
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
        } else {
            // Usa servizio centralizzato
            // Assicura che Firebase sia inizializzato nel servizio
            try {
                const { setFirebaseInstances } = await import('../services/firebase-service.js');
                setFirebaseInstances({ app, db, auth });
            } catch (error) {
                console.warn('Impossibile impostare Firebase instances nel servizio:', error);
            }
            
            // Assicura che il tenantId sia impostato nel servizio
            try {
                const { setCurrentTenantId } = await import('../services/tenant-service.js');
                if (currentTenantId) {
                    setCurrentTenantId(currentTenantId);
                }
            } catch (error) {
                console.warn('Impossibile impostare tenantId nel servizio:', error);
            }
            
            const { getAllCategorie } = await import('../services/categorie-service.js');
            const categorie = await getAllCategorie({
                applicabileA: 'lavori',
                orderBy: 'ordine',
                orderDirection: 'asc'
            });
            
            categorie.forEach(catData => {
                // Escludi categorie di test (contengono "test" nel nome)
                const nomeCategoria = (catData.nome || '').toLowerCase();
                if (nomeCategoria.includes('test')) {
                    return; // Salta questa categoria
                }
                
                // Filtra solo categorie applicabili a lavori (già filtrato dal servizio, ma manteniamo controllo)
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
        }
        
        // Ordina sottocategorie per ordine
        sottocategorieLavoriMap.forEach((sottocat, parentId) => {
            sottocat.sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
        });
        
        // Aggiorna variabili globali PRIMA di chiamare i callback
        if (updateCategorieLavoriPrincipali) {
            updateCategorieLavoriPrincipali(categorieLavoriPrincipali);
        }
        if (updateSottocategorieLavoriMap) updateSottocategorieLavoriMap(sottocategorieLavoriMap);
        
        // Popola dropdown e filtri (chiama dopo aver aggiornato le variabili globali)
        // Passa le categorie direttamente al callback per evitare problemi di timing
        if (populateCategoriaLavoroDropdownCallback) {
            // Chiama con le categorie appena caricate come parametro
            populateCategoriaLavoroDropdownCallback(null, categorieLavoriPrincipali);
        } else {
            console.warn('⚠️ [loadCategorieLavori] populateCategoriaLavoroDropdownCallback non definito!');
        }
        // Aggiorna filtro tipo lavoro dopo caricamento categorie
        if (populateFiltroTipoLavoroCallback) populateFiltroTipoLavoroCallback();
        
        // Restituisci le categorie caricate per uso diretto
        return categorieLavoriPrincipali;
    } catch (error) {
        console.error('Errore caricamento categorie lavori:', error);
        if (updateCategorieLavoriPrincipali) updateCategorieLavoriPrincipali([]);
        return [];
    }
}

/**
 * Carica tipi lavoro (filtrati per categoria se specificata)
 * @param {Object} params - Parametri funzione
 * @param {string} params.currentTenantId - ID tenant corrente
 * @param {string} params.categoriaId - ID categoria per filtrare (opzionale)
 * @param {Object} params.db - Istanza Firestore
 * @param {Object} params.app - Istanza Firebase App
 * @param {Object} params.auth - Istanza Firebase Auth
 * @param {Object} params.collection - Funzione collection Firestore
 * @param {Object} params.getDocs - Funzione getDocs Firestore
 * @param {Object} params.query - Funzione query Firestore
 * @param {Object} params.orderBy - Funzione orderBy Firestore
 * @param {Array} params.categorieLavoriPrincipali - Array categorie lavori principali
 * @param {Map} params.sottocategorieLavoriMap - Map sottocategorie lavori
 * @param {Function} params.updateTipiLavoroList - Callback per aggiornare tipiLavoroList globale
 * @param {Function} params.populateTipoLavoroDropdownCallback - Callback per popolare dropdown tipo lavoro
 */
export async function loadTipiLavoro(params) {
    const {
        currentTenantId,
        categoriaId = null,
        db,
        app,
        auth,
        collection,
        getDocs,
        query,
        orderBy,
        categorieLavoriPrincipali = [],
        sottocategorieLavoriMap = new Map(),
        updateTipiLavoroList,
        populateTipoLavoroDropdownCallback
    } = params;

    try {
        if (!currentTenantId) return;
        
        const isFileProtocol = window.location.protocol === 'file:';
        let tipiLavoroList = [];
        
        if (isFileProtocol) {
            // Fallback per ambiente file://
            const tipiRef = collection(db, `tenants/${currentTenantId}/tipiLavoro`);
            const snapshot = await getDocs(query(tipiRef, orderBy('nome', 'asc')));
            
            snapshot.forEach(doc => {
                tipiLavoroList.push({ id: doc.id, ...doc.data() });
            });
        } else {
            // Usa servizio centralizzato
            // Assicura che Firebase sia inizializzato nel servizio
            try {
                const { setFirebaseInstances } = await import('../services/firebase-service.js');
                setFirebaseInstances({ app, db, auth });
            } catch (error) {
                console.warn('Impossibile impostare Firebase instances nel servizio:', error);
            }
            
            // Assicura che il tenantId sia impostato nel servizio
            try {
                const { setCurrentTenantId } = await import('../services/tenant-service.js');
                if (currentTenantId) {
                    setCurrentTenantId(currentTenantId);
                }
            } catch (error) {
                console.warn('Impossibile impostare tenantId nel servizio:', error);
            }
            
            const { getAllTipiLavoro, initializeTipiLavoroPredefiniti } = await import('../services/tipi-lavoro-service.js');
            let tipiLavoro = await getAllTipiLavoro({
                orderBy: 'nome',
                orderDirection: 'asc'
            });
            
            // Se non ci sono tipi di lavoro, inizializza quelli predefiniti
            if (tipiLavoro.length === 0) {
                try {
                    await initializeTipiLavoroPredefiniti();
                    // Ricarica i tipi dopo l'inizializzazione
                    tipiLavoro = await getAllTipiLavoro({
                        orderBy: 'nome',
                        orderDirection: 'asc'
                    });
                } catch (initError) {
                    console.error('Errore durante inizializzazione tipi predefiniti:', initError);
                }
            }
            
            // Converti in formato compatibile con il codice esistente
            tipiLavoroList = tipiLavoro.map(tipo => ({
                id: tipo.id,
                nome: tipo.nome,
                categoriaId: tipo.categoriaId,
                sottocategoriaId: tipo.sottocategoriaId,
                descrizione: tipo.descrizione,
                predefinito: tipo.predefinito || false,
                ...tipo
            }));
        }
        
        // Aggiorna variabile globale
        if (updateTipiLavoroList) updateTipiLavoroList(tipiLavoroList);
        
        // Se è specificata una categoria, filtra per quella categoria o le sue sottocategorie
        // NOTA: Non modificare tipiLavoroList direttamente, usa una variabile locale per il filtro
        let tipiLavoroFiltrati = tipiLavoroList;
        if (categoriaId) {
            // Verifica se categoriaId è una sottocategoria o categoria principale
            const categoriaTrovata = [...categorieLavoriPrincipali, ...Array.from(sottocategorieLavoriMap.values()).flat()].find(c => c.id === categoriaId);
            
            if (categoriaTrovata && categoriaTrovata.parentId) {
                // È una sottocategoria: filtra per sottocategoriaId
                tipiLavoroFiltrati = tipiLavoroList.filter(tipo => tipo.sottocategoriaId === categoriaId);
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
                           (tipo.sottocategoriaId && allCategorieIds.includes(tipo.sottocategoriaId));
                });
            }
        }
        
        // Passa i tipi filtrati alla funzione di popolamento
        if (populateTipoLavoroDropdownCallback) {
            populateTipoLavoroDropdownCallback(categoriaId, null, tipiLavoroFiltrati);
        }
    } catch (error) {
        console.error('Errore caricamento tipi lavoro:', error);
        if (updateTipiLavoroList) updateTipiLavoroList([]);
    }
}


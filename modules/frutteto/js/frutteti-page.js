/**
 * Pagina Anagrafica frutteti.
 * L'HTML in views/ resta la struttura; qui c'è il comportamento.
 * Gli import dinamici via resolvePath restano relativi all'URL della pagina.
 * @module modules/frutteto/js/frutteti-page
 */

import { resolvePath, getBasePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';

try {
    await window.GFVStandaloneReady;
} catch (err) {
    console.error('[frutteti] Bootstrap failed:', err);
    throw err;
}

// Import servizi modulo frutteto
import { getAllFrutteti, createFrutteto, updateFrutteto, deleteFrutteto } from '../services/frutteti-service.js';

// Import dinamici servizi core
const terreniServiceModule = await import(resolvePath('../../../core/services/terreni-service.js'));
const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
const authServiceModule = await import(resolvePath('../../../core/services/auth-service.js'));
const coltureServiceModule = await import(resolvePath('../../../core/services/colture-service.js'));
const categorieServiceModule = await import(resolvePath('../../../core/services/categorie-service.js'));
const varietaFruttetoServiceModule = await import(resolvePath('../../../core/services/varieta-frutteto-service.js'));

// Import configurazione forme di allevamento frutteto
const specieFruttifereConfigModule = await import('../config/specie-fruttifere.js');
const { FORME_ALLEVAMENTO_FRUTTETO } = specieFruttifereConfigModule;

const { getAllTerreni } = terreniServiceModule;
const { populateVarietaDropdown, addVarietaPersonalizzata } = varietaFruttetoServiceModule;
const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = firebaseServiceModule;
const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenantServiceModule;
const { initializeAuthService } = authServiceModule;
const { getAllColture } = coltureServiceModule;
const { getAllCategorie } = categorieServiceModule;

let terreni = [];
let allFrutteti = [];
let frutteti = [];
let currentEditingId = null;

// Carica valori personalizzati da localStorage
function loadCustomValues() {
    return {
        varieta: JSON.parse(localStorage.getItem('frutteto_varieta_custom') || '[]'),
        formaAllevamento: JSON.parse(localStorage.getItem('frutteto_forma_allevamento_custom') || '[]')
    };
}

// Salva valori personalizzati in localStorage
function saveCustomValue(type, value) {
    const key = `frutteto_${type}_custom`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    if (!current.includes(value)) {
        current.push(value);
        localStorage.setItem(key, JSON.stringify(current));
    }
}

// Popola dropdown
function populateDropdown(selectId, predefiniti, customKey) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const custom = loadCustomValues();
    const customValues = custom[customKey] || [];
    const allValues = [...predefiniti, ...customValues].sort();
    
    // Mantieni solo la prima opzione (placeholder)
    const firstOption = select.querySelector('option');
    select.innerHTML = '';
    if (firstOption) {
        select.appendChild(firstOption);
    }
    
    allValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
}

async function init() {
    try {
        const auth = getAuthInstance();
        const db = getDb();

        initializeAuthService();
        initializeTenantService();

        onAuthStateChanged(auth, async (user) => {
            if (!user) user = await resolveAuthUser(auth);
            if (!user) {
                window.location.href = await loginPageUrl(resolvePath('../../../core/auth/login-standalone.html'));
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists()) {
                    window.location.href = await loginPageUrl(resolvePath('../../../core/auth/login-standalone.html'));
                    return;
                }

                const tenantId = getCurrentTenantId();
                if (tenantId) {
                    const tenant = await getCurrentTenant();
                    const modules = Array.isArray(tenant?.modules) ? tenant.modules : [];
                    
                    // Inizializza context Tony con i moduli attivi usando helper
                    if (window.Tony && window.Tony.initContextWithModules) {
                        window.Tony.initContextWithModules(modules);
                    } else {
                        // Fallback se helper non disponibile (retry manuale)
                        var initTonyContext = function(retries) {
                            retries = retries || 0;
                            if (window.Tony && typeof window.Tony.setContext === 'function') {
                                window.Tony.setContext('dashboard', {
                                    info_azienda: { moduli_attivi: modules },
                                    moduli_attivi: modules
                                });
                                console.log('[Frutteti] Context Tony inizializzato con moduli:', modules);
                            } else if (retries < 10) {
                                setTimeout(function() { initTonyContext(retries + 1); }, 500);
                            }
                        };
                        initTonyContext();
                    }
                    
                    if (!modules.includes('frutteto')) {
                        alert('Il modulo Frutteto non è attivo. Attivalo dalla pagina Abbonamento.');
                        window.location.href = resolvePath('../../../core/admin/abbonamento-standalone.html');
                        return;
                    }
                }

                await loadTerreni();
                await populateSpecieSelects();
                setupEventListeners();
                
                // Popola dropdown forma allevamento
                populateDropdown('formaAllevamento', FORME_ALLEVAMENTO_FRUTTETO, 'formaAllevamento');
                
                await loadFrutteti();
                
                // Ricalcolo automatico delle spese in background (non blocca l'interfaccia)
                ricalcolaSpeseAutomatico();

                // Gestione parametri URL: apri modal se terrenoId presente
                const urlParams = new URLSearchParams(window.location.search);
                const terrenoIdParam = urlParams.get('terrenoId');
                const fruttetoIdParam = urlParams.get('fruttetoId');

                if (fruttetoIdParam) {
                    // Apri modal modifica frutteto esistente
                    const frutteto = allFrutteti.find(f => f.id === fruttetoIdParam);
                    if (frutteto) {
                        editFrutteto(fruttetoIdParam);
                    }
                } else if (terrenoIdParam) {
                    // Verifica se esiste già un frutteto per questo terreno
                    const fruttetoEsistente = allFrutteti.find(f => f.terrenoId === terrenoIdParam);
                    if (fruttetoEsistente) {
                        // Apri modal modifica frutteto esistente
                        editFrutteto(fruttetoEsistente.id);
                    } else {
                        // Apri modal creazione nuovo frutteto con terreno pre-selezionato
                        document.getElementById('frutteto-modal').classList.add('active');
                        document.getElementById('frutteto-form').reset();
                        currentEditingId = null;
                        document.getElementById('statoImpianto').value = 'attivo';
                        
                        // Pre-seleziona terreno
                        const terrenoSelect = document.getElementById('terrenoId');
                        const terreno = terreni.find(t => t.id === terrenoIdParam);
                        
                        if (terrenoSelect) {
                            terrenoSelect.value = terrenoIdParam;
                            // Trigger evento change per precompilare superficie
                            terrenoSelect.dispatchEvent(new Event('change'));
                            
                            // Precompila specie se il terreno ha una coltura frutteto
                            if (terreno && terreno.coltura) {
                                await precompilaSpecieDaTerreno(terreno.coltura);
                                // Le varietà vengono popolate automaticamente da precompilaSpecieDaTerreno
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('[FRUTTETI] Errore in onAuthStateChanged:', error);
                alert('Errore nel caricamento dei dati: ' + error.message);
            }
        });
    } catch (error) {
        console.error('[FRUTTETI] Errore inizializzazione:', error);
        alert('Errore nel caricamento dei dati: ' + error.message);
    }
}

function getTerrenoLabel(t) {
    if (!t) return '-';
    const nome = (t.nome || '').trim();
    const podere = (t.podere || '').trim();
    if (nome && podere) return `${nome} – ${podere}`;
    if (nome) return nome;
    if (podere) return podere;
    return 'Terreno senza nome';
}

async function loadTerreni() {
    try {
        terreni = await getAllTerreni();
        const terrenoSelect = document.getElementById('terrenoId');
        const filterTerrenoSelect = document.getElementById('filter-terreno');

        const optionsHtml = ['<option value="">Seleziona terreno</option>']
            .concat(terreni.map(t => `<option value="${t.id}">${getTerrenoLabel(t)}</option>`))
            .join('');
        terrenoSelect.innerHTML = optionsHtml;

        const filterOptionsHtml = ['<option value="">Tutti i terreni</option>']
            .concat(terreni.map(t => `<option value="${t.id}">${getTerrenoLabel(t)}</option>`))
            .join('');
        filterTerrenoSelect.innerHTML = filterOptionsHtml;
    } catch (error) {
        console.error('[FRUTTETI] Errore caricamento terreni:', error);
    }
}

// Variabile globale per memorizzare le specie frutteto caricate
let specieFruttetoDisponibili = [];

async function populateSpecieSelects() {
    try {
        const specieSelect = document.getElementById('specie');
        const filterSpecieSelect = document.getElementById('filter-specie');

        // Ottieni categoria 'frutteto'
        const categorie = await getAllCategorie({ 
            applicabileA: 'colture',
            orderBy: 'ordine'
        });
        const categoriaFrutteto = categorie.find(c => c.codice === 'frutteto');
        
        if (!categoriaFrutteto) {
            console.warn('[FRUTTETI] Categoria frutteto non trovata');
            return;
        }

        // Carica tutte le colture e filtra per categoria frutteto (evita indice composito categoriaId+nome)
        const tutteColture = await getAllColture({ 
            orderBy: 'nome',
            orderDirection: 'asc'
        });
        const coltureFrutteto = tutteColture.filter(c => c.categoriaId === categoriaFrutteto.id);

        // Estrai i nomi delle specie e salva in variabile globale
        specieFruttetoDisponibili = coltureFrutteto.map(c => c.nome).filter(Boolean).sort();

        specieSelect.innerHTML = '<option value="">Seleziona specie</option>' +
            specieFruttetoDisponibili.map(s => `<option value="${s}">${s}</option>`).join('');

        filterSpecieSelect.innerHTML = '<option value="">Tutte le specie</option>' +
            specieFruttetoDisponibili.map(s => `<option value="${s}">${s}</option>`).join('');
    } catch (error) {
        console.error('[FRUTTETI] Errore caricamento specie:', error);
        // Fallback: usa lista vuota
        const specieSelect = document.getElementById('specie');
        const filterSpecieSelect = document.getElementById('filter-specie');
        if (specieSelect) specieSelect.innerHTML = '<option value="">Seleziona specie</option>';
        if (filterSpecieSelect) filterSpecieSelect.innerHTML = '<option value="">Tutte le specie</option>';
    }
}

/**
 * Precompila la specie dal terreno se la coltura corrisponde a una specie frutteto
 * @param {string} colturaTerreno - Nome della coltura del terreno
 */
async function precompilaSpecieDaTerreno(colturaTerreno) {
    if (!colturaTerreno) return;
    
    try {
        // Se le specie non sono ancora caricate, caricale
        if (specieFruttetoDisponibili.length === 0) {
            await populateSpecieSelects();
        }
        
        // Verifica se la coltura del terreno corrisponde a una specie frutteto
        const specieCorrispondente = specieFruttetoDisponibili.find(s => 
            s.toLowerCase() === colturaTerreno.toLowerCase()
        );
        
        if (specieCorrispondente) {
            const specieSelect = document.getElementById('specie');
            if (specieSelect) {
                specieSelect.value = specieCorrispondente;
                // Popola anche le varietà per questa specie
                await populateVarietaDropdown('varieta', specieCorrispondente);
            }
        }
    } catch (error) {
        console.warn('[FRUTTETI] Errore precompilazione specie da terreno:', error);
    }
}

async function loadFrutteti() {
    try {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('frutteti-table').style.display = 'none';
        document.getElementById('empty-state').style.display = 'none';

        allFrutteti = await getAllFrutteti();
        
        // Popola filtro varietà con tutte le varietà disponibili
        const varietaSet = new Set(allFrutteti.map(f => f.varieta).filter(Boolean));
        const filterVarieta = document.getElementById('filter-varieta');
        if (filterVarieta) {
            filterVarieta.innerHTML = '<option value="">Tutte le varietà</option>';
            varietaSet.forEach(varieta => {
                filterVarieta.innerHTML += `<option value="${varieta}">${varieta}</option>`;
            });
        }
        
        // Applica filtri (o mostra tutti se nessun filtro attivo)
        applyFilters();
    } catch (error) {
        console.error('[FRUTTETI] Errore caricamento frutteti:', error);
        alert('Errore nel caricamento frutteti: ' + error.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}


window.applyFilters = function() {
    const filterTerreno = document.getElementById('filter-terreno')?.value || '';
    const filterSpecie = document.getElementById('filter-specie')?.value || '';
    const filterVarieta = document.getElementById('filter-varieta')?.value || '';
    const filterStato = document.getElementById('filter-stato')?.value || '';
    
    // Filtra frutteti
    frutteti = allFrutteti.filter(frutteto => {
        // Filtro terreno
        if (filterTerreno && frutteto.terrenoId !== filterTerreno) {
            return false;
        }
        
        // Filtro specie
        if (filterSpecie && frutteto.specie !== filterSpecie) {
            return false;
        }
        
        // Filtro varietà
        if (filterVarieta && frutteto.varieta !== filterVarieta) {
            return false;
        }
        
        // Filtro stato
        if (filterStato && frutteto.statoImpianto !== filterStato) {
            return false;
        }
        
        return true;
    });
    
    // Renderizza frutteti filtrati
    renderFrutteti();
};

window.resetFilters = function() {
    document.getElementById('filter-terreno').value = '';
    document.getElementById('filter-specie').value = '';
    document.getElementById('filter-varieta').value = '';
    document.getElementById('filter-stato').value = '';
    applyFilters();
};

function getStatoBadgeClass(stato) {
    const classes = {
        'attivo': 'badge-success',
        'in_riposo': 'badge-warning',
        'da_rimuovere': 'badge-danger'
    };
    return classes[stato] || 'badge-secondary';
}

function getStatoLabel(stato) {
    const labels = {
        'attivo': 'Attivo',
        'in_riposo': 'In riposo',
        'da_rimuovere': 'Da rimuovere'
    };
    return labels[stato] || stato;
}

function getTerrenoNome(terrenoId) {
    const t = terreni.find(tt => tt.id === terrenoId);
    return getTerrenoLabel(t);
}

function renderFrutteti() {
    const tbody = document.getElementById('frutteti-table-body');
    const emptyState = document.getElementById('empty-state');
    const loadingDiv = document.getElementById('loading');
    const table = document.getElementById('frutteti-table');

    if (!frutteti || frutteti.length === 0) {
        tbody.innerHTML = '';
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (table) table.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (loadingDiv) loadingDiv.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (table) table.style.display = 'table';

    tbody.innerHTML = '';
    frutteti.forEach(f => {
        const resaKgHa = f.superficieEttari && f.superficieEttari > 0 && f.produzioneTotaleAnno
            ? (f.produzioneTotaleAnno / f.superficieEttari)
            : null;

        const row = `
            <tr>
                <td><strong>${f.specie || '-'}</strong></td>
                <td><strong>${f.varieta || '-'}</strong></td>
                <td>${getTerrenoNome(f.terrenoId)}</td>
                <td>${f.superficieEttari ? f.superficieEttari.toFixed(2) : '-'}</td>
                <td>${f.annataImpianto || '-'}</td>
                <td>${f.produzioneTotaleAnno ? f.produzioneTotaleAnno.toFixed(2) : '0.00'}</td>
                <td>${resaKgHa ? resaKgHa.toFixed(2) : '-'}</td>
                <td>${f.costoTotaleAnno ? f.costoTotaleAnno.toFixed(2) : '0.00'}</td>
                <td>
                    <span class="badge ${getStatoBadgeClass(f.statoImpianto)}">
                        ${getStatoLabel(f.statoImpianto)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="showDettaglioSpese('${f.id}', '${f.specie || 'Frutteto'} - ${f.varieta || ''}')" title="Vedi dettaglio spese">
                        📊 Dettaglio
                    </button>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-primary" onclick="editFrutteto('${f.id}')">✏️ Modifica</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteFruttetoConfirm('${f.id}')">🗑️ Elimina</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function setupEventListeners() {
    // Gestione form frutteto
    document.getElementById('frutteto-form').addEventListener('submit', onFruttetoSubmit);
    
    // Chiudi modali cliccando fuori
    ['add-varieta-modal', 'add-forma-allevamento-modal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === modalId || e.target.classList.contains('modal')) {
                    closeAddModal(modalId);
                }
            });
        }
    });
    
    // Chiudi modal cliccando fuori
    document.getElementById('frutteto-modal').addEventListener('click', (e) => {
        if (e.target.id === 'frutteto-modal') {
            closeFruttetoModal();
        }
    });
    
    // Chiudi modali aggiungi valori cliccando fuori
    ['add-varieta-modal', 'add-forma-allevamento-modal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === modalId || e.target.classList.contains('modal')) {
                    closeAddModal(modalId);
                }
            });
        }
    });

    // Calcolo automatico densità in base alle distanze
    const distanzaFileInput = document.getElementById('distanzaFile');
    const distanzaUnitaInput = document.getElementById('distanzaUnita');
    distanzaFileInput.addEventListener('input', calcolaDensita);
    distanzaUnitaInput.addEventListener('input', calcolaDensita);
    
    // Listener per tipo impianto: se modificato manualmente, non sovrascrivere più
    const tipoImpiantoSelect = document.getElementById('tipoImpianto');
    if (tipoImpiantoSelect) {
        tipoImpiantoSelect.addEventListener('change', function() {
            if (this.value) {
                // Se l'utente seleziona manualmente, segna come non auto-filled
                this.dataset.autoFilled = 'false';
            }
        });
    }

    document.getElementById('terrenoId').addEventListener('change', async () => {
        const terrenoId = document.getElementById('terrenoId').value;
        const superficieInput = document.getElementById('superficieEttari');
        if (terrenoId) {
            const terreno = terreni.find(t => t.id === terrenoId);
            if (terreno) {
                // Precompila superficie se disponibile
                if (terreno.superficie && terreno.superficie > 0) {
                    superficieInput.value = parseFloat(terreno.superficie).toFixed(2);
                }
                // Precompila specie se la coltura del terreno corrisponde a una specie frutteto
                if (terreno.coltura) {
                    await precompilaSpecieDaTerreno(terreno.coltura);
                }
            }
        } else {
            // Se nessun terreno selezionato, svuota superficie
            superficieInput.value = '';
        }
    });

    // Listener per cambio specie: popola dropdown varietà
    const specieSelect = document.getElementById('specie');
    if (specieSelect) {
        specieSelect.addEventListener('change', async function() {
            const specie = this.value;
            console.log(`[FRUTTETI] Cambio specie selezionata: "${specie}"`);
            if (specie) {
                // Mostra loading nel dropdown varietà
                const varietaSelect = document.getElementById('varieta');
                if (varietaSelect) {
                    varietaSelect.innerHTML = '<option value="">Caricamento varietà...</option>';
                    varietaSelect.disabled = true;
                }
                
                try {
                    await populateVarietaDropdown('varieta', specie);
                } catch (error) {
                    console.error('[FRUTTETI] Errore popolamento varietà:', error);
                    if (varietaSelect) {
                        varietaSelect.innerHTML = '<option value="">Errore caricamento</option>';
                    }
                } finally {
                    if (varietaSelect) {
                        varietaSelect.disabled = false;
                    }
                }
            } else {
                // Svuota dropdown varietà se nessuna specie selezionata
                const varietaSelect = document.getElementById('varieta');
                if (varietaSelect) {
                    varietaSelect.innerHTML = '<option value="">Seleziona varietà</option>';
                }
            }
        });
    }
}

// Funzioni per aprire modali
window.openAddVarietaModal = function() {
    const specie = document.getElementById('specie').value;
    if (!specie) {
        alert('Seleziona prima una specie');
        return;
    }
    document.getElementById('add-varieta-modal').classList.add('active');
    setTimeout(() => document.getElementById('new-varieta').focus(), 100);
};

window.openAddFormaAllevamentoModal = function() {
    document.getElementById('add-forma-allevamento-modal').classList.add('active');
    setTimeout(() => document.getElementById('new-forma-allevamento').focus(), 100);
};

// Funzioni per chiudere modali
window.closeAddModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
    const form = document.querySelector(`#${modalId} form`);
    if (form) form.reset();
};

window.handleAddVarieta = async function(event) {
    event.preventDefault();
    const specie = document.getElementById('specie').value;
    const nuovaVarieta = document.getElementById('new-varieta').value.trim();
    
    if (!specie) {
        alert('Seleziona prima una specie');
        return;
    }
    
    if (!nuovaVarieta) {
        alert('Inserisci il nome della varietà');
        return;
    }
    
    try {
        const success = await addVarietaPersonalizzata(specie, nuovaVarieta);
        if (success) {
            // Ricarica dropdown varietà
            await populateVarietaDropdown('varieta', specie);
            // Seleziona la varietà appena aggiunta
            document.getElementById('varieta').value = nuovaVarieta;
            closeAddModal('add-varieta-modal');
        } else {
            alert('Errore nell\'aggiunta della varietà');
        }
    } catch (error) {
        console.error('[FRUTTETI] Errore aggiunta varietà:', error);
        alert('Errore nell\'aggiunta della varietà: ' + error.message);
    }
};

window.addNewFormaAllevamento = function(e) {
    e.preventDefault();
    const value = document.getElementById('new-forma-allevamento').value.trim();
    if (value) {
        saveCustomValue('formaAllevamento', value);
        populateDropdown('formaAllevamento', FORME_ALLEVAMENTO_FRUTTETO, 'formaAllevamento');
        document.getElementById('formaAllevamento').value = value;
        closeAddModal('add-forma-allevamento-modal');
    }
};

// Calcolo automatico densità piante e tipo impianto
function calcolaDensita() {
    const distanzaFile = parseFloat(document.getElementById('distanzaFile').value);
    const distanzaPiante = parseFloat(document.getElementById('distanzaUnita').value);
    const densitaInput = document.getElementById('densita');
    const tipoImpiantoSelect = document.getElementById('tipoImpianto');
    
    if (distanzaFile > 0 && distanzaPiante > 0) {
        // Formula: 10.000 m² (1 ettaro) / (distanza file × distanza piante)
        const densita = 10000 / (distanzaFile * distanzaPiante);
        const densitaArrotondata = Math.round(densita * 100) / 100; // Arrotonda a 2 decimali
        densitaInput.value = densitaArrotondata;
        
        // Precompila tipo impianto in base alla densità
        if (tipoImpiantoSelect) {
            // Salva il valore precedente per verificare se era stato selezionato manualmente
            const valorePrecedente = tipoImpiantoSelect.value;
            
            // Determina tipo impianto in base alla densità (soglie per frutteto)
            // Basate su classificazione pomacee/drupacee: tradizionale < 1000, intensivo 1000-3000, superintensivo > 3000
            let nuovoTipoImpianto = '';
            if (densitaArrotondata < 1000) {
                nuovoTipoImpianto = 'tradizionale';
            } else if (densitaArrotondata >= 1000 && densitaArrotondata <= 3000) {
                nuovoTipoImpianto = 'intensivo';
            } else if (densitaArrotondata > 3000) {
                nuovoTipoImpianto = 'superintensivo';
            }
            
            // Aggiorna solo se:
            // 1. Non c'era un valore precedente (prima volta)
            // 2. Il valore precedente era stato precompilato automaticamente (autoFilled)
            // 3. Il nuovo valore è diverso e coerente con la densità
            if (!valorePrecedente || tipoImpiantoSelect.dataset.autoFilled === 'true') {
                tipoImpiantoSelect.value = nuovoTipoImpianto;
                tipoImpiantoSelect.dataset.autoFilled = 'true';
            } else if (nuovoTipoImpianto && nuovoTipoImpianto !== valorePrecedente) {
                // Se il valore manuale non corrisponde alla densità, aggiorna comunque
                // ma segna come auto-filled per permettere override futuro
                tipoImpiantoSelect.value = nuovoTipoImpianto;
                tipoImpiantoSelect.dataset.autoFilled = 'true';
            }
        }
    } else {
        densitaInput.value = '';
        // Se le distanze non sono valide, resetta tipo impianto solo se era stato precompilato automaticamente
        if (tipoImpiantoSelect && tipoImpiantoSelect.dataset.autoFilled === 'true') {
            tipoImpiantoSelect.value = '';
            tipoImpiantoSelect.dataset.autoFilled = 'false';
        }
    }
}

window.openCreateModal = function() {
    currentEditingId = null;
    document.getElementById('frutteto-modal-title').textContent = 'Nuovo Frutteto';
    document.getElementById('frutteto-form').reset();
    document.getElementById('statoImpianto').value = 'attivo';
    
    // Ripopola dropdown quando si apre il modal
    populateDropdown('formaAllevamento', FORME_ALLEVAMENTO_FRUTTETO, 'formaAllevamento');
    
    document.getElementById('frutteto-modal').classList.add('active');
    
    // Se c'è già una specie selezionata, popola le varietà
    const specieSelect = document.getElementById('specie');
    if (specieSelect && specieSelect.value) {
        // Piccolo delay per assicurarsi che il DOM sia pronto
        setTimeout(async () => {
            await populateVarietaDropdown('varieta', specieSelect.value);
        }, 100);
    }
};

window.editFrutteto = async function(fruttetoId) {
    const frutteto = allFrutteti.find(f => f.id === fruttetoId);
    if (!frutteto) return;

    currentEditingId = fruttetoId;
    document.getElementById('frutteto-modal-title').textContent = 'Modifica Frutteto';

    document.getElementById('terrenoId').value = frutteto.terrenoId || '';
    
    // Imposta specie e popola varietà
    const specieSelect = document.getElementById('specie');
    if (specieSelect && frutteto.specie) {
        specieSelect.value = frutteto.specie;
        // Popola dropdown varietà per questa specie
        await populateVarietaDropdown('varieta', frutteto.specie);
    }
    
    // Imposta varietà dopo aver popolato il dropdown
    setTimeout(() => {
        document.getElementById('varieta').value = frutteto.varieta || '';
    }, 100);
    
    document.getElementById('annataImpianto').value = frutteto.annataImpianto || '';
    
    // Popola dropdown forma allevamento prima di impostare il valore
    populateDropdown('formaAllevamento', FORME_ALLEVAMENTO_FRUTTETO, 'formaAllevamento');
    setTimeout(() => {
        document.getElementById('formaAllevamento').value = frutteto.formaAllevamento || '';
    }, 50);
    
    document.getElementById('distanzaFile').value = frutteto.distanzaFile != null ? frutteto.distanzaFile : '';
    document.getElementById('distanzaUnita').value = frutteto.distanzaUnita != null ? frutteto.distanzaUnita : '';
    
    // Calcola densità se ci sono le distanze
    if (frutteto.distanzaFile && frutteto.distanzaUnita) {
        calcolaDensita();
    } else {
        document.getElementById('densita').value = frutteto.densita != null ? frutteto.densita : '';
    }
    
    document.getElementById('superficieEttari').value = frutteto.superficieEttari != null ? frutteto.superficieEttari : '';
    document.getElementById('tipoImpianto').value = frutteto.tipoImpianto || '';
    // Se tipoImpianto non è stato impostato manualmente, segna come auto-filled
    if (!frutteto.tipoImpianto) {
        document.getElementById('tipoImpianto').dataset.autoFilled = 'true';
    }
    document.getElementById('orientamentoFilari').value = frutteto.orientamentoFilari || '';
    document.getElementById('statoImpianto').value = frutteto.statoImpianto || 'attivo';
    document.getElementById('note').value = frutteto.note || '';

    document.getElementById('frutteto-modal').classList.add('active');
};

window.closeFruttetoModal = function() {
    document.getElementById('frutteto-modal').classList.remove('active');
    currentEditingId = null;
};

async function onFruttetoSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.densita = data.densita ? parseFloat(data.densita) : null;
    data.distanzaFile = data.distanzaFile ? parseFloat(data.distanzaFile) : null;
    data.distanzaUnita = data.distanzaUnita ? parseFloat(data.distanzaUnita) : null;
    data.superficieEttari = data.superficieEttari ? parseFloat(data.superficieEttari) : null;
    data.annataImpianto = data.annataImpianto ? parseInt(data.annataImpianto, 10) : null;
    data.tipoImpianto = data.tipoImpianto || null;
    data.orientamentoFilari = data.orientamentoFilari || null;

    try {
        if (currentEditingId) {
            await updateFrutteto(currentEditingId, data);
            alert('Frutteto aggiornato con successo');
        } else {
            await createFrutteto(data);
            alert('Frutteto creato con successo');
        }
        closeFruttetoModal();
        await loadFrutteti();
    } catch (error) {
        console.error('[FRUTTETI] Errore salvataggio frutteto:', error);
        alert('Errore nel salvataggio del frutteto: ' + error.message);
        // Non chiudere il modal in caso di errore, così l'utente può correggere
    }
}

function deleteFruttetoConfirm(fruttetoId) {
    if (confirm('Sei sicuro di voler eliminare questo frutteto?')) {
        deleteFruttetoAction(fruttetoId);
    }
}

async function deleteFruttetoAction(fruttetoId) {
    try {
        await deleteFrutteto(fruttetoId);
        await loadFrutteti();
        alert('Frutteto eliminato con successo');
    } catch (error) {
        console.error('[FRUTTETI] Errore eliminazione frutteto:', error);
        alert('Errore nell\'eliminazione del frutteto: ' + error.message);
    }
}

function goToRaccolta(fruttetoId) {
    if (!fruttetoId) return;
    const basePath = getBasePath();
    // Percorso relativo da modules/frutteto/views/
    const relative = 'raccolta-frutta-standalone.html?fruttetoId=' + encodeURIComponent(fruttetoId);
    const url = resolvePath(relative);
    window.location.href = url;
}

// Import servizio ricalcolo spese
let ricalcolaSpeseFruttetoAnno = null;
let lavoriFruttetoServiceLoaded = false;

// Carica servizio in modo asincrono per gestire errori
import('../services/lavori-frutteto-service.js').then(module => {
    ricalcolaSpeseFruttetoAnno = module.ricalcolaSpeseFruttetoAnno;
    lavoriFruttetoServiceLoaded = true;
    console.log('[FRUTTETI] Servizio lavori-frutteto-service caricato correttamente');
}).catch(error => {
    console.warn('[FRUTTETI] Servizio lavori-frutteto-service non disponibile:', error);
});

// Funzione per ricalcolo automatico in background (senza alert, senza bloccare UI)
async function ricalcolaSpeseAutomatico() {
    try {
        // Verifica che il servizio sia caricato
        if (!lavoriFruttetoServiceLoaded || !ricalcolaSpeseFruttetoAnno) {
            return;
        }

        const annoCorrente = new Date().getFullYear();
        const fruttetiList = await getAllFrutteti();
        
        if (fruttetiList.length === 0) {
            return;
        }

        // Ricalcola in background senza bloccare l'interfaccia
        // Non mostriamo alert o messaggi per non disturbare l'utente
        let completati = 0;
        let errori = 0;

        for (const frutteto of fruttetiList) {
            try {
                await ricalcolaSpeseFruttetoAnno(frutteto.id, annoCorrente);
                completati++;
            } catch (error) {
                console.error(`[FRUTTETI] Errore ricalcolo automatico frutteto ${frutteto.id}:`, error);
                errori++;
            }
        }
        
        // Ricarica la lista solo se ci sono stati aggiornamenti
        if (completati > 0) {
            // Ricarica in modo silenzioso (senza mostrare loading)
            await loadFrutteti();
        }
    } catch (error) {
        console.error('[FRUTTETI] Errore ricalcolo automatico spese:', error);
        // Non mostriamo alert per non disturbare l'utente
    }
}

// Funzione per ricalcolare le spese di tutti i frutteti (manuale, con conferma)
window.ricalcolaSpeseTuttiFrutteti = async function(event) {
    if (!lavoriFruttetoServiceLoaded || !ricalcolaSpeseFruttetoAnno) {
        alert('Servizio ricalcolo spese non ancora disponibile. Verrà implementato prossimamente.');
        console.warn('[FRUTTETI] Servizio non disponibile');
        return;
    }
    
    if (!confirm('Vuoi ricalcolare le spese di tutti i frutteti basandoti sui lavori completati?\n\nQuesta operazione potrebbe richiedere alcuni secondi.')) {
        return;
    }

    try {
        const annoCorrente = new Date().getFullYear();
        const fruttetiList = await getAllFrutteti();
        
        if (fruttetiList.length === 0) {
            alert('Nessun frutteto trovato');
            return;
        }

        // Mostra indicatore di caricamento
        const loadingMsg = `Ricalcolo in corso... (0/${fruttetiList.length})`;
        const originalBtn = event?.target || document.querySelector('button[onclick*="ricalcolaSpeseTuttiFrutteti"]');
        if (!originalBtn) {
            console.error('[FRUTTETI] Pulsante non trovato!');
            alert('Errore: pulsante non trovato');
            return;
        }
        
        const originalText = originalBtn.textContent;
        originalBtn.disabled = true;
        originalBtn.textContent = loadingMsg;

        let completati = 0;
        let errori = 0;

        // Ricalcola ogni frutteto
        for (const frutteto of fruttetiList) {
            try {
                await ricalcolaSpeseFruttetoAnno(frutteto.id, annoCorrente);
                completati++;
                originalBtn.textContent = `Ricalcolo in corso... (${completati}/${fruttetiList.length})`;
            } catch (error) {
                console.error(`[FRUTTETI] Errore ricalcolo frutteto ${frutteto.id}:`, error);
                errori++;
            }
        }

        // Ripristina pulsante
        originalBtn.disabled = false;
        originalBtn.textContent = originalText;

        // Mostra risultato
        if (errori === 0) {
            alert(`✅ Ricalcolo completato con successo!\n\n${completati} frutteti aggiornati per l'anno ${annoCorrente}.`);
        } else {
            alert(`⚠️ Ricalcolo completato con alcuni errori.\n\n✅ ${completati} frutteti aggiornati\n❌ ${errori} errori`);
        }

        // Ricarica la lista per mostrare i dati aggiornati
        await loadFrutteti();
    } catch (error) {
        console.error('[FRUTTETI] Errore ricalcolo spese:', error);
        alert('Errore durante il ricalcolo: ' + error.message);
        
        // Ripristina pulsante in caso di errore
        const originalBtn = event?.target || document.querySelector('button[onclick*="ricalcolaSpeseTuttiFrutteti"]');
        if (originalBtn) {
            originalBtn.disabled = false;
            originalBtn.textContent = '🔄 Ricalcola Spese';
        }
    }
};

// Variabile globale per memorizzare fruttetoId corrente nel modal dettaglio
let currentDettaglioFruttetoId = null;

// Funzione per mostrare modal dettaglio spese
window.showDettaglioSpese = function(fruttetoId, fruttetoNome) {
    currentDettaglioFruttetoId = fruttetoId;
    document.getElementById('dettaglio-spese-title').textContent = `📊 Dettaglio Spese - ${fruttetoNome}`;
    
    // Popola dropdown anno (ultimi 5 anni + anno corrente)
    const annoSelect = document.getElementById('dettaglio-spese-anno');
    const annoCorrente = new Date().getFullYear();
    annoSelect.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const anno = annoCorrente - i;
        const option = document.createElement('option');
        option.value = anno;
        option.textContent = anno;
        if (i === 0) option.selected = true;
        annoSelect.appendChild(option);
    }
    
    // Mostra modal e carica dettagli
    document.getElementById('dettaglio-spese-modal').classList.add('active');
    loadDettaglioSpese();
};

// Funzione per chiudere modal dettaglio spese
window.closeDettaglioSpeseModal = function() {
    document.getElementById('dettaglio-spese-modal').classList.remove('active');
    currentDettaglioFruttetoId = null;
};

// Funzione per caricare e mostrare dettagli spese
window.loadDettaglioSpese = async function() {
    if (!currentDettaglioFruttetoId) return;
    
    const anno = parseInt(document.getElementById('dettaglio-spese-anno').value);
    const loadingDiv = document.getElementById('dettaglio-spese-loading');
    const bodyDiv = document.getElementById('dettaglio-spese-body');
    
    loadingDiv.style.display = 'block';
    bodyDiv.style.display = 'none';
    
    try {
        // TODO: Implementare quando servizio sarà disponibile
        // const { getDettaglioSpeseFruttetoAnno } = await import('../services/lavori-frutteto-service.js');
        // const dettaglio = await getDettaglioSpeseFruttetoAnno(currentDettaglioFruttetoId, anno);
        
        // Per ora mostra messaggio placeholder
        bodyDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6c757d;">
                <h3>Servizio in sviluppo</h3>
                <p>Il servizio per il dettaglio spese sarà disponibile prossimamente.</p>
                <p style="font-size: 12px; margin-top: 20px; color: #999;">Frutteto ID: ${currentDettaglioFruttetoId}<br>Anno: ${anno}</p>
            </div>
        `;
        
        loadingDiv.style.display = 'none';
        bodyDiv.style.display = 'block';
    } catch (error) {
        console.error('[FRUTTETI] Errore caricamento dettaglio spese:', error);
        loadingDiv.innerHTML = `<div style="color: red; padding: 20px;">Errore nel caricamento dei dettagli: ${error.message}</div>`;
    }
};

// Cambio anno: ricarica automaticamente i dettagli spese (senza dover cliccare "Aggiorna")
document.getElementById('dettaglio-spese-anno').addEventListener('change', function() {
    if (currentDettaglioFruttetoId) loadDettaglioSpese();
});

// Avvio
init();

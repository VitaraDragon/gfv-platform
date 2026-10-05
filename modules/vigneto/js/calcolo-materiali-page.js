/**
 * Pagina Calcolo materiali vigneto.
 * L'HTML in views/ resta la struttura; qui c'è il comportamento.
 * Gli import dinamici via resolvePath restano relativi all'URL della pagina.
 * @module modules/vigneto/js/calcolo-materiali-page
 */

import { formatDateLikeToItalianLongLocal } from '../../../core/js/date-format-it.js';
import { showAlert } from '../../../core/js/gfv-page-utils.js';
import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { getAllPianificazioni, deletePianificazione, confermaPianificazione } from '../services/pianificazione-impianto-service.js';

try {
    await window.GFVStandaloneReady;
} catch (err) {
    console.error('[calcolo-materiali] Bootstrap failed:', err);
    throw err;
}
import { calcolaMateriali, formattaMaterialiPerTabella, TIPI_IMPIANTO, getTipiImpiantoPerColtura, getDefaultTipoImpiantoPerColtura, normalizeFormaAllevamentoToKey } from '../services/calcolo-materiali-service.js';
import { getFormeAllevamentoList, getChiaveTecnica, getNomeVisualizzato, getConfigurazioneImpianto } from '../config/forme-allevamento.js';
import { getConfigColtura, isColturaValida } from '../../../shared/config/pianificazione-impianto-colture.js';

// Import dinamici dei servizi core con risoluzione percorsi per GitHub Pages
const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
const terreniServiceModule = await import(resolvePath('../../../core/services/terreni-service.js'));

const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = firebaseServiceModule;
const { getCurrentTenantId, getCurrentTenant } = tenantServiceModule;
const { getAllTerreni } = terreniServiceModule;

let db, auth;
let pianificazioni = [];
let terreni = [];
let pianificazioneSelezionata = null;
let materialiCalcolati = null; // Memorizza i materiali calcolati per l'export PDF
let currentColtura = 'vigneto'; // coltura da URL (?coltura=)
let currentConfig = null;      // config da shared (backPath, moduloRequired, theme)

async function init() {
    try {
        const { initializeTenantService } = await import(resolvePath('../../../core/services/tenant-service.js'));
        auth = getAuthInstance();
        db = getDb();
        initializeTenantService();

        onAuthStateChanged(auth, async (user) => {
            if (!user) user = await resolveAuthUser(auth);
            if (!user) {
                window.location.href = await loginPageUrl('../../../core/auth/login-standalone.html');
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists()) {
                    window.location.href = await loginPageUrl('../../../core/auth/login-standalone.html');
                    return;
                }

                const userData = userDoc.data();

                // Leggi parametro coltura (default vigneto) e carica config
                const urlParams = new URLSearchParams(window.location.search);
                const colturaFromUrl = (urlParams.get('coltura') || 'vigneto').toLowerCase();
                currentColtura = isColturaValida(colturaFromUrl) ? colturaFromUrl : 'vigneto';
                currentConfig = getConfigColtura(currentColtura);

                // Link Dashboard dalla config (backPath)
                const linkDash = document.getElementById('linkDashboard');
                if (linkDash && currentConfig && currentConfig.backPath) {
                    linkDash.href = currentConfig.backPath;
                }

                // Verifica modulo della coltura attivo
                let tenantId = getCurrentTenantId();
                if (!tenantId && userData.tenantId) tenantId = userData.tenantId;
                if (!tenantId) {
                    for (let i = 0; i < 10; i++) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        tenantId = getCurrentTenantId();
                        if (tenantId) break;
                    }
                }
                if (tenantId) {
                    const tenant = await getCurrentTenant();
                    if (!tenant) {
                        showAlert('Errore: tenant non trovato', 'error');
                        setTimeout(() => { window.location.href = '../../../core/dashboard-standalone.html'; }, 2000);
                        return;
                    }
                    const moduloRichiesto = currentConfig.moduloRequired;
                    const modules = tenant.modules || [];
                    const hasModule = modules.some(m => m && m.toLowerCase() === moduloRichiesto.toLowerCase());
                    if (!hasModule) {
                        const nomeModulo = moduloRichiesto === 'vigneto' ? 'Vigneto' : moduloRichiesto === 'frutteto' ? 'Frutteto' : 'Oliveto';
                        showAlert('Il modulo ' + nomeModulo + ' non è attivo. Attivalo dalla pagina Abbonamento.', 'error');
                        setTimeout(() => { window.location.href = '../../../core/admin/abbonamento-standalone.html'; }, 3000);
                        return;
                    }
                } else {
                    showAlert('Nessun tenant disponibile', 'error');
                    setTimeout(() => { window.location.href = '../../../core/dashboard-standalone.html'; }, 2000);
                    return;
                }

                // Popola dropdown tipo impianto in base alla coltura
                await populateTipoImpiantoSelect(currentColtura);

                // Applica etichette del modal Calcolo Materiali (vigneto vs frutteto/oliveto)
                applyCalcoloMaterialiLabels(currentConfig);

                // Carica dati
                await loadTerreni();
                await loadPianificazioni();

                // Event listeners
                setupEventListeners();
            } catch (error) {
                console.error('Errore inizializzazione:', error);
                showAlert('Errore durante l\'inizializzazione: ' + error.message, 'error');
            }
        });
    } catch (error) {
        console.error('Errore caricamento configurazione:', error);
        showAlert('Errore caricamento configurazione Firebase', 'error');
    }
}

/** Popola il dropdown Tipo impianto con la stessa lista usata in Pianificazione nuovo impianto (vigneto/frutteto) per coerenza UX. */
async function populateTipoImpiantoSelect(coltura) {
    const select = document.getElementById('tipoImpianto');
    if (!select) return;
    select.innerHTML = '<option value="">Seleziona tipo impianto</option>';

    if (coltura === 'vigneto') {
        const formeList = getFormeAllevamentoList();
        formeList.forEach(nome => {
            const opt = document.createElement('option');
            opt.value = nome;
            opt.textContent = nome;
            select.appendChild(opt);
        });
    } else if (coltura === 'frutteto') {
        const { FORME_ALLEVAMENTO_FRUTTETO } = await import('../../frutteto/config/specie-fruttifere.js');
        const custom = JSON.parse(localStorage.getItem('frutteto_forma_allevamento_custom') || '[]');
        const allValues = [...FORME_ALLEVAMENTO_FRUTTETO, ...custom].sort();
        allValues.forEach(nome => {
            const opt = document.createElement('option');
            opt.value = nome;
            opt.textContent = nome;
            select.appendChild(opt);
        });
    } else {
        const tipiImpianto = getTipiImpiantoPerColtura(coltura);
        const defaultKey = getDefaultTipoImpiantoPerColtura(coltura);
        Object.keys(tipiImpianto).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = tipiImpianto[key].nome;
            select.appendChild(opt);
        });
    }
    select.value = '';
}

/** Applica etichette e descrizioni del modal Calcolo Materiali dalla config coltura (vigneto/frutteto/oliveto). */
function applyCalcoloMaterialiLabels(config) {
    if (!config || !config.calcoloMateriali) return;
    const cm = config.calcoloMateriali;
    const set = (id, text) => { const el = document.getElementById(id); if (el && text != null) el.textContent = text; };
    set('labelTipoImpianto', cm.labelTipoImpianto);
    set('labelNumeroFiliPortata', cm.labelFiliPortata);
    set('labelNumeroFiliVegetazione', cm.labelFiliVegetazione);
    set('smallNumeroFiliPortata', cm.smallFiliPortata);
    set('smallNumeroFiliVegetazione', cm.smallFiliVegetazione);
    set('labelDiametroFiloPortata', cm.labelDiametroPortata);
    set('labelDiametroFiloVegetazione', cm.labelDiametroVegetazione);
    set('smallDiametroFiloPortata', cm.smallDiametroPortata);
    set('smallDiametroFiloVegetazione', cm.smallDiametroVegetazione);
    set('labelUsaTutori', cm.labelBraccetti);
    set('smallUsaTutori', cm.smallBraccetti);
    set('labelUsaAncore', cm.labelAncore);
    set('smallUsaAncore', cm.smallAncore);
    set('labelFissaggioTutori', cm.labelFissaggioTutori);
    set('smallFissaggioTutori', cm.smallFissaggioTutori);
}

async function loadTerreni() {
    try {
        terreni = await getAllTerreni();
    } catch (error) {
        console.error('Errore caricamento terreni:', error);
        terreni = [];
    }
}

async function loadPianificazioni() {
    console.log('[CALCOLO-MATERIALI] Inizio caricamento pianificazioni...');
    try {
        console.log('[CALCOLO-MATERIALI] Chiamata getAllPianificazioni con opzioni:', {
            tipoColtura: currentColtura,
            orderBy: 'createdAt',
            orderDirection: 'desc'
        });
        
        pianificazioni = await getAllPianificazioni({
            tipoColtura: currentColtura,
            orderBy: 'createdAt',
            orderDirection: 'desc'
        });
        
        console.log('[CALCOLO-MATERIALI] Pianificazioni caricate:', pianificazioni);
        console.log('[CALCOLO-MATERIALI] Numero pianificazioni:', pianificazioni.length);
        
        if (pianificazioni.length > 0) {
            console.log('[CALCOLO-MATERIALI] Prima pianificazione esempio:', {
                id: pianificazioni[0].id,
                terrenoId: pianificazioni[0].terrenoId,
                tipoColtura: pianificazioni[0].tipoColtura,
                numeroFile: pianificazioni[0].numeroFile,
                numeroUnitaTotale: pianificazioni[0].numeroUnitaTotale,
                stato: pianificazioni[0].stato
            });
        } else {
            console.warn('[CALCOLO-MATERIALI] Nessuna pianificazione trovata con filtro tipoColtura=' + currentColtura);
            console.log('[CALCOLO-MATERIALI] Provo a caricare tutte le pianificazioni senza filtro...');
            
            // Prova senza filtro tipoColtura per vedere se ci sono pianificazioni
            const tuttePianificazioni = await getAllPianificazioni({
                orderBy: 'createdAt',
                orderDirection: 'desc'
            });
            console.log('[CALCOLO-MATERIALI] Pianificazioni senza filtro:', tuttePianificazioni.length);
            if (tuttePianificazioni.length > 0) {
                console.log('[CALCOLO-MATERIALI] Esempio pianificazione senza filtro:', {
                    id: tuttePianificazioni[0].id,
                    tipoColtura: tuttePianificazioni[0].tipoColtura,
                    terrenoId: tuttePianificazioni[0].terrenoId
                });
            }
        }
        
        renderPianificazioni();
        console.log('[CALCOLO-MATERIALI] Render pianificazioni completato');
    } catch (error) {
        console.error('[CALCOLO-MATERIALI] Errore caricamento pianificazioni:', error);
        console.error('[CALCOLO-MATERIALI] Stack trace:', error.stack);
        showAlert('Errore caricamento pianificazioni: ' + error.message, 'error');
        pianificazioni = [];
        renderPianificazioni();
    }
}

function renderPianificazioni() {
    const tbody = document.querySelector('#table-pianificazioni tbody');
    
    if (!tbody) {
        console.error('Errore: tbody non trovato!');
        return;
    }
    
        if (pianificazioni.length === 0) {
        const linkPianifica = 'pianifica-impianto-standalone.html?coltura=' + encodeURIComponent(currentColtura);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>Nessuna pianificazione salvata</p>
                    <p style="margin-top: 10px; font-size: 12px;">
                        <a href="${linkPianifica}" style="color: var(--theme-accent);">Crea una nuova pianificazione</a>
                    </p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pianificazioni.map((p, index) => {
        const terreno = terreni.find(t => t.id === p.terrenoId);
        const terrenoNome = terreno ? terreno.nome : 'Terreno non trovato';
        
        const dataCreazione = p.createdAt ? (formatDateLikeToItalianLongLocal(p.createdAt) || '-') : '-';
        const statoBadge = getStatoBadge(p.stato);
        
        // Verifica se la pianificazione ha dati completi
        const hasCompleteData = p.numeroFile > 0 && p.numeroUnitaTotale > 0 && p.superficieNettaImpianto > 0;
        const warningIcon = hasCompleteData ? '' : ' ⚠️';
        const buttonDisabled = hasCompleteData ? '' : ' disabled';
        const buttonTitle = hasCompleteData ? '' : ' title="Pianificazione incompleta - completa prima di calcolare"';
        
        return `
            <tr>
                <td>${terrenoNome}${warningIcon}</td>
                <td>${dataCreazione}</td>
                <td>${statoBadge}</td>
                <td>${p.numeroFile || 0}</td>
                <td>${(p.numeroUnitaTotale || 0).toLocaleString('it-IT')}</td>
                <td>${(p.superficieNettaImpianto || 0).toFixed(2)}</td>
                <td>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                        <button class="btn btn-success" onclick="selezionaPianificazione('${p.id}')" 
                                style="padding: 5px 10px; font-size: 12px;"${buttonDisabled}${buttonTitle}>
                            ${hasCompleteData ? 'Calcola Materiali' : 'Dati Incompleti'}
                        </button>
                        <button class="btn btn-primary" onclick="modificaPianificazione('${p.id}')" 
                                style="padding: 5px 10px; font-size: 12px;" title="Modifica pianificazione">
                            ✏️ Modifica
                        </button>
                        ${p.stato === 'bozza' ? `
                        <button class="btn btn-info" onclick="confermaPianificazioneConfirm('${p.id}')" 
                                style="padding: 5px 10px; font-size: 12px;" title="Conferma pianificazione">
                            ✅ Conferma
                        </button>
                        ` : ''}
                        <button class="btn btn-danger" onclick="eliminaPianificazioneConfirm('${p.id}')" 
                                style="padding: 5px 10px; font-size: 12px;" title="Elimina pianificazione">
                            🗑️ Elimina
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatoBadge(stato) {
    const badges = {
        'bozza': '<span class="badge badge-bozza">📝 Bozza</span>',
        'confermato': '<span class="badge badge-confermato">✅ Confermato</span>',
        'impiantato': '<span class="badge badge-impiantato">🌱 Impiantato</span>'
    };
    return badges[stato] || stato;
}

window.selezionaPianificazione = function(pianificazioneId) {
    pianificazioneSelezionata = pianificazioni.find(p => p.id === pianificazioneId);
    if (!pianificazioneSelezionata) {
        showAlert('Pianificazione non trovata', 'error');
        return;
    }

    // Verifica se la pianificazione ha dati completi
    const hasCompleteData = pianificazioneSelezionata.numeroFile > 0 && 
                           pianificazioneSelezionata.numeroUnitaTotale > 0 &&
                           pianificazioneSelezionata.superficieNettaImpianto > 0;

    if (!hasCompleteData) {
        showAlert('⚠️ Questa pianificazione non ha dati completi (numeroFile o numeroUnitaTotale = 0). ' +
                 'Completa la pianificazione nella pagina di pianificazione impianto prima di calcolare i materiali.', 
                 'warning');
        // Mostra comunque le info ma disabilita il calcolo
        const terreno = terreni.find(t => t.id === pianificazioneSelezionata.terrenoId);
        const terrenoNome = terreno ? terreno.nome : 'Terreno non trovato';
        document.getElementById('pianificazione-nome').textContent = 
            `${terrenoNome} - Pianificazione incompleta (bozza)`;
        document.getElementById('info-pianificazione-selezionata').style.display = 'block';
        document.getElementById('config-section').style.display = 'block';
        document.getElementById('risultati-section').style.display = 'none';
        
        // Disabilita il pulsante calcola
        const calcolaBtn = document.querySelector('#config-section button.btn-success');
        if (calcolaBtn) {
            calcolaBtn.disabled = true;
            calcolaBtn.title = 'Completa la pianificazione prima di calcolare i materiali';
        }
        
        // Scroll alla sezione configurazione
        document.getElementById('config-section').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    // Mostra sezione configurazione
    document.getElementById('config-section').style.display = 'block';
    document.getElementById('risultati-section').style.display = 'none';

    // Mostra info pianificazione
    const terreno = terreni.find(t => t.id === pianificazioneSelezionata.terrenoId);
    const terrenoNome = terreno ? terreno.nome : 'Terreno non trovato';
    document.getElementById('pianificazione-nome').textContent = 
        `${terrenoNome} - ${pianificazioneSelezionata.numeroFile} file - ${(pianificazioneSelezionata.numeroUnitaTotale || 0).toLocaleString('it-IT')} unità`;
    document.getElementById('info-pianificazione-selezionata').style.display = 'block';

    // Abilita il pulsante calcola
    const calcolaBtn = document.querySelector('#config-section button.btn-success');
    if (calcolaBtn) {
        calcolaBtn.disabled = false;
        calcolaBtn.title = '';
    }
    
    // Pre-compila forma di allevamento dalla pianificazione (stesso valore salvato in Pianificazione nuovo impianto)
    const tipoImpiantoSelect = document.getElementById('tipoImpianto');
    if (tipoImpiantoSelect && pianificazioneSelezionata.formaAllevamento) {
        const displayName = pianificazioneSelezionata.formaAllevamento;
        const optionExists = Array.from(tipoImpiantoSelect.options).some(o => o.value === displayName);
        if (optionExists) {
            tipoImpiantoSelect.value = displayName;
            tipoImpiantoSelect.dispatchEvent(new Event('change'));
        } else {
            // Valore custom o non in lista: aggiungi opzione così l'utente vede lo stesso testo
            const opt = document.createElement('option');
            opt.value = displayName;
            opt.textContent = displayName;
            tipoImpiantoSelect.appendChild(opt);
            tipoImpiantoSelect.value = displayName;
            tipoImpiantoSelect.dispatchEvent(new Event('change'));
        }
    }
    
    // Scroll alla sezione configurazione
    document.getElementById('config-section').scrollIntoView({ behavior: 'smooth' });
};

function setupEventListeners() {
    const tipiImpianto = getTipiImpiantoPerColtura(currentColtura);
    const defaultKey = getDefaultTipoImpiantoPerColtura(currentColtura);
    // Aggiorna descrizione e precompila valori quando cambia tipo impianto (valore = label per vigneto/frutteto, key per oliveto)
    document.getElementById('tipoImpianto').addEventListener('change', function() {
        const rawTipo = this.value;
        const key = currentColtura === 'vigneto' ? getChiaveTecnica(rawTipo) : (currentColtura === 'frutteto' ? normalizeFormaAllevamentoToKey(rawTipo) : rawTipo);
        const config = currentColtura === 'vigneto' ? getConfigurazioneImpianto(rawTipo) : (tipiImpianto[key] || tipiImpianto[defaultKey]);
        const descEl = document.getElementById('tipo-impianto-desc');
        
        if (rawTipo && config) {
            descEl.textContent = config.descrizione;
            
            // Elementi del form
            const numFiliPortataEl = document.getElementById('numeroFiliPortata');
            const numFiliVegetazioneEl = document.getElementById('numeroFiliVegetazione');
            const diamFiloPortataEl = document.getElementById('diametroFiloPortata');
            const diamFiloVegetazioneEl = document.getElementById('diametroFiloVegetazione');
            const usaTutoriEl = document.getElementById('usaTutori');
            const usaAncoreEl = document.getElementById('usaAncore');
            
            // Precompila sempre i valori quando si seleziona un tipo impianto
            // Numero Fili Portata
            if (config.numeroFiliPortata !== undefined) {
                numFiliPortataEl.value = config.numeroFiliPortata;
                numFiliPortataEl.placeholder = `Default: ${config.numeroFiliPortata}`;
            }
            
            // Abilita/disabilita campo numero fili portata in base al tipo impianto
            if (config.numeroFiliPortata === 0) {
                numFiliPortataEl.disabled = true;
                numFiliPortataEl.placeholder = 'Non applicabile (sistema senza fili)';
            } else {
                numFiliPortataEl.disabled = false;
            }
            
            // Numero Fili Vegetazione
            if (config.numeroFiliVegetazione !== undefined) {
                numFiliVegetazioneEl.value = config.numeroFiliVegetazione;
                numFiliVegetazioneEl.placeholder = `Default: ${config.numeroFiliVegetazione}`;
            }
            
            // Diametro Fili Portata
            if (config.numeroFiliPortata > 0 && config.diametroFiloPortata) {
                diamFiloPortataEl.value = config.diametroFiloPortata;
                diamFiloPortataEl.placeholder = `Default: ${config.diametroFiloPortata}mm`;
                diamFiloPortataEl.disabled = false;
            } else {
                diamFiloPortataEl.value = '';
                diamFiloPortataEl.placeholder = 'Non applicabile (nessun filo portata)';
                diamFiloPortataEl.disabled = true;
            }
            
            // Diametro Fili Vegetazione
            if (config.numeroFiliVegetazione > 0 && config.diametroFiloVegetazione) {
                diamFiloVegetazioneEl.value = config.diametroFiloVegetazione;
                diamFiloVegetazioneEl.placeholder = `Default: ${config.diametroFiloVegetazione}mm`;
                diamFiloVegetazioneEl.disabled = false;
            } else {
                diamFiloVegetazioneEl.value = '';
                diamFiloVegetazioneEl.placeholder = 'Non applicabile (nessun filo vegetazione)';
                diamFiloVegetazioneEl.disabled = true;
            }
            
            // Precompila Braccetti
            if (config.necessitaTutori !== undefined) {
                usaTutoriEl.value = config.necessitaTutori ? 'true' : 'false';
            }
            
            // Precompila Ancore
            if (config.necessitaAncore !== undefined) {
                usaAncoreEl.value = config.necessitaAncore ? 'true' : 'false';
            }
            // Frutteto/oliveto: precompila distanza e altezza pali dalla forma di allevamento
            if (currentColtura === 'frutteto' || currentColtura === 'oliveto') {
                if (config.distanzaPali != null) {
                    const distEl = document.getElementById('distanzaPali');
                    if (distEl) distEl.value = config.distanzaPali;
                }
                if (config.altezzaPali != null) {
                    const altEl = document.getElementById('altezzaPali');
                    if (altEl) altEl.value = config.altezzaPali;
                }
            }
        } else {
            descEl.textContent = '';
            // Reset campi se nessun tipo selezionato
            document.getElementById('numeroFiliPortata').value = '';
            document.getElementById('numeroFiliVegetazione').value = '';
            document.getElementById('diametroFiloPortata').value = '';
            document.getElementById('diametroFiloVegetazione').value = '';
            document.getElementById('usaTutori').value = '';
            document.getElementById('usaAncore').value = '';
        }
    });
    
    // Abilita/disabilita campo diametro portata quando cambia numero fili portata
    document.getElementById('numeroFiliPortata').addEventListener('change', function() {
        const numFili = parseInt(this.value) || 0;
        const diamFiloPortataEl = document.getElementById('diametroFiloPortata');
        
        if (numFili > 0) {
            diamFiloPortataEl.disabled = false;
            if (!diamFiloPortataEl.value) {
                const rawTipo = document.getElementById('tipoImpianto').value;
                const key = currentColtura === 'vigneto' ? getChiaveTecnica(rawTipo) : (currentColtura === 'frutteto' ? normalizeFormaAllevamentoToKey(rawTipo) : rawTipo);
                const configForPlaceholder = currentColtura === 'vigneto' ? getConfigurazioneImpianto(rawTipo) : (tipiImpianto[key] || null);
                if (rawTipo && configForPlaceholder && configForPlaceholder.diametroFiloPortata) {
                    diamFiloPortataEl.placeholder = `Default: ${configForPlaceholder.diametroFiloPortata}mm`;
                } else {
                    diamFiloPortataEl.placeholder = 'Auto (da tipo impianto)';
                }
            }
        } else {
            diamFiloPortataEl.disabled = true;
            diamFiloPortataEl.value = '';
            diamFiloPortataEl.placeholder = 'Non applicabile (nessun filo portata)';
        }
    });
    
    // Abilita/disabilita campo diametro vegetazione quando cambia numero fili vegetazione
    document.getElementById('numeroFiliVegetazione').addEventListener('change', function() {
        const numFili = parseInt(this.value) || 0;
        const diamFiloVegetazioneEl = document.getElementById('diametroFiloVegetazione');
        
        if (numFili > 0) {
            diamFiloVegetazioneEl.disabled = false;
            if (!diamFiloVegetazioneEl.value) {
                const rawTipo = document.getElementById('tipoImpianto').value;
                const key = currentColtura === 'vigneto' ? getChiaveTecnica(rawTipo) : (currentColtura === 'frutteto' ? normalizeFormaAllevamentoToKey(rawTipo) : rawTipo);
                const configForPlaceholder = currentColtura === 'vigneto' ? getConfigurazioneImpianto(rawTipo) : (tipiImpianto[key] || null);
                if (rawTipo && configForPlaceholder && configForPlaceholder.diametroFiloVegetazione) {
                    diamFiloVegetazioneEl.placeholder = `Default: ${configForPlaceholder.diametroFiloVegetazione}mm`;
                } else {
                    diamFiloVegetazioneEl.placeholder = 'Auto (da tipo impianto)';
                }
            }
        } else {
            diamFiloVegetazioneEl.disabled = true;
            diamFiloVegetazioneEl.value = '';
            diamFiloVegetazioneEl.placeholder = 'Non applicabile (nessun filo vegetazione)';
        }
    });

    // Checkbox reti antigrandine: mostra/nascondi sottosezione
    const usaAntigrandineEl = document.getElementById('usaAntigrandine');
    const configAntigrandineEl = document.getElementById('config-antigrandine');
    if (usaAntigrandineEl && configAntigrandineEl) {
        usaAntigrandineEl.addEventListener('change', function() {
            configAntigrandineEl.style.display = this.checked ? 'block' : 'none';
        });
    }

    // Tipo struttura antigrandine: aggiorna default distanza e altezza
    const tipoStrutturaAntigrandineEl = document.getElementById('tipoStrutturaAntigrandine');
    const antigrandineDefaults = { rete_piana: { distanza: 8, altezza: 4 }, capannina: { distanza: 10, altezza: 4.5 }, sistema_v: { distanza: 8, altezza: 4 } };
    if (tipoStrutturaAntigrandineEl) {
        tipoStrutturaAntigrandineEl.addEventListener('change', function() {
            const def = antigrandineDefaults[this.value] || antigrandineDefaults.rete_piana;
            const distEl = document.getElementById('distanzaPaliAntigrandine');
            const altEl = document.getElementById('altezzaPaliAntigrandine');
            if (distEl) distEl.value = def.distanza;
            if (altEl) altEl.value = def.altezza;
        });
    }
}

window.calcolaMateriali = function() {
    if (!pianificazioneSelezionata) {
        showAlert('Seleziona una pianificazione prima di calcolare i materiali', 'warning');
        return;
    }

    // Verifica se la pianificazione ha dati completi
    const hasCompleteData = pianificazioneSelezionata.numeroFile > 0 && 
                           pianificazioneSelezionata.numeroUnitaTotale > 0 &&
                           pianificazioneSelezionata.superficieNettaImpianto > 0;

    if (!hasCompleteData) {
        showAlert('⚠️ Impossibile calcolare i materiali: questa pianificazione non ha dati completi. ' +
                 'Completa la pianificazione nella pagina di pianificazione impianto (calcola il reticolato) prima di procedere.', 
                 'error');
        return;
    }

    const tipoImpiantoRaw = document.getElementById('tipoImpianto').value;
    if (!tipoImpiantoRaw) {
        showAlert('Seleziona un tipo di impianto', 'warning');
        return;
    }
    // Passa al service la chiave tecnica (vigneto/frutteto dalla lista condivisa usano il label come value)
    const tipoImpianto = currentColtura === 'vigneto' ? (getChiaveTecnica(tipoImpiantoRaw) || tipoImpiantoRaw)
        : (currentColtura === 'frutteto' ? normalizeFormaAllevamentoToKey(tipoImpiantoRaw) : tipoImpiantoRaw);

    const distanzaPali = parseFloat(document.getElementById('distanzaPali').value);
    const altezzaPali = parseFloat(document.getElementById('altezzaPali').value);
    
    // Fili di portata
    const numeroFiliPortata = document.getElementById('numeroFiliPortata').value ? 
        parseInt(document.getElementById('numeroFiliPortata').value) : null;
    const diametroFiloPortata = document.getElementById('diametroFiloPortata').value ? 
        parseFloat(document.getElementById('diametroFiloPortata').value) : null;
    
    // Fili di vegetazione
    const numeroFiliVegetazione = document.getElementById('numeroFiliVegetazione').value ? 
        parseInt(document.getElementById('numeroFiliVegetazione').value) : null;
    const diametroFiloVegetazione = document.getElementById('diametroFiloVegetazione').value ? 
        parseFloat(document.getElementById('diametroFiloVegetazione').value) : null;
    
    // Supporti
    const usaTutori = document.getElementById('usaTutori').value === '' ? null : 
        document.getElementById('usaTutori').value === 'true';
    const usaAncore = document.getElementById('usaAncore').value === '' ? null : 
        document.getElementById('usaAncore').value === 'true';
    
    // Fissaggio tutori
    const fissaggioTutori = document.getElementById('fissaggioTutori').value || 'legacci';

    const usaAntigrandine = document.getElementById('usaAntigrandine') && document.getElementById('usaAntigrandine').checked;
    let antigrandine = null;
    if (usaAntigrandine) {
        const v = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : '';
        const n = (id, def) => { const val = v(id); return val === '' ? def : parseFloat(val); };
        const ni = (id) => { const val = v(id); return val === '' ? null : parseInt(val, 10); };
        antigrandine = {
            attivo: true,
            tipoStruttura: (document.getElementById('tipoStrutturaAntigrandine') && document.getElementById('tipoStrutturaAntigrandine').value) || 'rete_piana',
            distanzaPali: n('distanzaPaliAntigrandine', 8),
            altezzaPali: n('altezzaPaliAntigrandine', 4),
            diametroCavi: document.getElementById('diametroCaviAntigrandine') ? parseInt(document.getElementById('diametroCaviAntigrandine').value, 10) : 6,
            usaTiranti: document.getElementById('usaTirantiAntigrandine') ? document.getElementById('usaTirantiAntigrandine').value === 'true' : true,
            marginePercentuale: n('marginePercentualeAntigrandine', 10)
        };
        const supOverride = ni('overrideSuperficieReteAntigrandine');
        if (supOverride != null) antigrandine.superficieReteOverride = supOverride;
        const copOverride = ni('overrideCopripaliAntigrandine');
        if (copOverride != null) antigrandine.copripaliOverride = copOverride;
        const placOverride = ni('overridePlacchetteAntigrandine');
        if (placOverride != null) antigrandine.placchetteOverride = placOverride;
        const staffOverride = ni('overrideStaffeAntigrandine');
        if (staffOverride != null) antigrandine.staffeFermafuneOverride = staffOverride;
        const tendOverride = ni('overrideTendifuniAntigrandine');
        if (tendOverride != null) antigrandine.tendifuniOverride = tendOverride;
    }

    const configurazione = {
        tipoImpianto,
        coltura: currentColtura,
        distanzaPali,
        altezzaPali,
        numeroFiliPortata,
        numeroFiliVegetazione,
        diametroFiloPortata,
        diametroFiloVegetazione,
        usaTutori,
        usaAncore,
        fissaggioTutori,
        antigrandine
    };

    try {
        const materiali = calcolaMateriali(pianificazioneSelezionata, configurazione);
        materialiCalcolati = materiali; // Salva per export PDF
        renderMateriali(materiali);
        
        // Mostra sezione risultati
        document.getElementById('risultati-section').style.display = 'block';
        document.getElementById('risultati-section').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Errore calcolo materiali:', error);
        showAlert('Errore durante il calcolo: ' + error.message, 'error');
    }
};

function renderMateriali(materiali) {
    const container = document.getElementById('materiali-container');
    const righe = formattaMaterialiPerTabella(materiali);
    
    // Raggruppa per categoria
    const perCategoria = {};
    righe.forEach(riga => {
        if (!perCategoria[riga.categoria]) {
            perCategoria[riga.categoria] = [];
        }
        perCategoria[riga.categoria].push(riga);
    });

    let html = '<div class="table-container">';
    html += '<table>';
    html += '<thead><tr><th>Categoria</th><th>Materiale</th><th>Quantità</th><th>Unità</th><th>Descrizione</th></tr></thead>';
    html += '<tbody>';

    Object.keys(perCategoria).forEach(categoria => {
        perCategoria[categoria].forEach((riga, index) => {
            const isTotal = riga.isTotal;
            html += `
                <tr ${isTotal ? 'class="total-row"' : ''}>
                    <td>${index === 0 ? categoria : ''}</td>
                    <td>${riga.materiale}</td>
                    <td>${riga.quantita}</td>
                    <td>${riga.unitaMisura}</td>
                    <td>${riga.descrizione}</td>
                </tr>
            `;
        });
    });

    html += '</tbody></table>';
    html += '</div>';

    // Aggiungi riepilogo
    html += `
        <div class="riepilogo-pianificazione">
            <h3>Riepilogo Pianificazione</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <strong>Tipo Impianto:</strong><br>
                    ${materiali.riepilogo.tipoImpianto}
                </div>
                <div>
                    <strong>Numero File:</strong><br>
                    ${materiali.riepilogo.numeroFile}
                </div>
                <div>
                    <strong>Unità Totali:</strong><br>
                    ${materiali.riepilogo.numeroUnitaTotale.toLocaleString('it-IT')}
                </div>
                <div>
                    <strong>Lunghezza Filari:</strong><br>
                    ${materiali.riepilogo.lunghezzaFilariTotale.toFixed(2)} m
                </div>
                <div>
                    <strong>Distanza Pali:</strong><br>
                    ${materiali.riepilogo.distanzaPali} m
                </div>
                ${materiali.riepilogo.numeroFiliPortata > 0 ? `
                <div>
                    <strong>Fili di Portata:</strong><br>
                    ${materiali.riepilogo.numeroFiliPortata} fili (${materiali.riepilogo.diametroFiloPortata}mm)
                </div>
                ` : '<div><strong>Fili di Portata:</strong><br>Nessuno (sistema senza fili)</div>'}
                ${materiali.riepilogo.numeroFiliVegetazione > 0 ? `
                <div>
                    <strong>Fili di Vegetazione:</strong><br>
                    ${materiali.riepilogo.numeroFiliVegetazione} fili (${materiali.riepilogo.diametroFiloVegetazione}mm)
                </div>
                ` : ''}
            </div>
            <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                <button class="btn btn-danger" onclick="esportaPDF()" style="display: inline-flex; align-items: center; gap: 8px;">
                    📄 Esporta PDF
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Funzione per esportare in PDF
window.esportaPDF = function() {
    if (typeof window.jspdf === 'undefined') {
        showAlert('Libreria PDF non caricata. Ricarica la pagina.', 'error');
        return;
    }

    if (!materialiCalcolati || !pianificazioneSelezionata) {
        showAlert('Nessun calcolo disponibile. Calcola prima i materiali.', 'error');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configurazione
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let yPos = margin;
        const lineHeight = 7;
        const titleSize = 16;
        const subtitleSize = 12;
        const normalSize = 10;

        // Titolo
        doc.setFontSize(titleSize);
        doc.setFont(undefined, 'bold');
        doc.text('Lista Materiali Impianto Vigneto', pageWidth / 2, yPos, { align: 'center' });
        yPos += lineHeight * 2;

        // Dati Pianificazione
        const terreno = terreni.find(t => t.id === pianificazioneSelezionata.terrenoId);
        const terrenoNome = terreno ? terreno.nome : 'Terreno sconosciuto';
        
        doc.setFontSize(subtitleSize);
        doc.setFont(undefined, 'bold');
        doc.text('Dati Pianificazione', margin, yPos);
        yPos += lineHeight;

        doc.setFontSize(normalSize);
        doc.setFont(undefined, 'normal');
        doc.text(`Terreno: ${terrenoNome}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Tipo Impianto: ${String(materialiCalcolati.riepilogo.tipoImpianto || '')}`, margin, yPos);
        yPos += lineHeight;
        doc.text(`Numero File: ${String(materialiCalcolati.riepilogo.numeroFile || 0)}`, margin, yPos);
        yPos += lineHeight;
        const unitaTotaliStr = materialiCalcolati.riepilogo.numeroUnitaTotale ? 
            String(materialiCalcolati.riepilogo.numeroUnitaTotale.toLocaleString('it-IT')) : '0';
        doc.text(`Unità Totali: ${unitaTotaliStr}`, margin, yPos);
        yPos += lineHeight;
        const superficieStr = String((pianificazioneSelezionata.superficieNettaImpianto || 0).toFixed(2));
        doc.text(`Superficie Netta: ${superficieStr} Ha`, margin, yPos);
        yPos += lineHeight;
        const lunghezzaFilariStr = String(materialiCalcolati.riepilogo.lunghezzaFilariTotale.toFixed(2));
        doc.text(`Lunghezza Filari Totale: ${lunghezzaFilariStr} m`, margin, yPos);
        yPos += lineHeight;
        const distanzaPaliStr = String(materialiCalcolati.riepilogo.distanzaPali || '');
        doc.text(`Distanza Pali: ${distanzaPaliStr} m`, margin, yPos);
        yPos += lineHeight * 1.5;

        // Tabella Materiali
        const righe = formattaMaterialiPerTabella(materialiCalcolati);
        
        // Raggruppa per categoria
        const perCategoria = {};
        righe.forEach(riga => {
            if (!perCategoria[riga.categoria]) {
                perCategoria[riga.categoria] = [];
            }
            perCategoria[riga.categoria].push(riga);
        });

        // Intestazione tabella
        doc.setFontSize(subtitleSize);
        doc.setFont(undefined, 'bold');
        doc.text('Materiali Necessari', margin, yPos);
        yPos += lineHeight * 1.5;

        // Colonne tabella - ricalcolate per distribuire meglio lo spazio
        const usableWidth = pageWidth - (margin * 2);
        // Larghezze: Categoria (30mm), Materiale (45mm), Quantità (25mm), Unità (20mm), Descrizione (resto ~70mm)
        const colWidths = [30, 45, 25, 20, usableWidth - 30 - 45 - 25 - 20];
        const colPositions = [
            margin, 
            margin + colWidths[0], 
            margin + colWidths[0] + colWidths[1], 
            margin + colWidths[0] + colWidths[1] + colWidths[2],
            margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]
        ];

        // Intestazione colonne
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('Categoria', colPositions[0], yPos);
        doc.text('Materiale', colPositions[1], yPos);
        doc.text('Quantità', colPositions[2], yPos);
        doc.text('Unità', colPositions[3], yPos);
        doc.text('Descrizione', colPositions[4], yPos);
        yPos += lineHeight;

        // Linea separatrice
        doc.setLineWidth(0.5);
        doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
        yPos += lineHeight * 0.5;

        // Righe tabella
        doc.setFontSize(normalSize);
        doc.setFont(undefined, 'normal');
        
        Object.keys(perCategoria).forEach(categoria => {
            perCategoria[categoria].forEach((riga, index) => {
                // Controlla se serve una nuova pagina
                if (yPos > pageHeight - margin - lineHeight * 3) {
                    doc.addPage();
                    yPos = margin;
                }

                const isTotal = riga.isTotal;
                if (isTotal) {
                    doc.setFont(undefined, 'bold');
                }

                // Salva yPos iniziale per questa riga
                const yPosIniziale = yPos;
                let maxRighe = 1;
                
                // Categoria (solo prima riga del gruppo)
                if (index === 0) {
                    const categoriaText = String(riga.categoria || '');
                    const catLines = doc.splitTextToSize(categoriaText, colWidths[0] - 2);
                    doc.text(catLines, colPositions[0], yPos, { maxWidth: colWidths[0] - 2 });
                    maxRighe = Math.max(maxRighe, catLines.length);
                }
                
                // Materiale
                const materialeText = String(riga.materiale || '');
                const matLines = doc.splitTextToSize(materialeText, colWidths[1] - 2);
                doc.text(matLines, colPositions[1], yPos, { maxWidth: colWidths[1] - 2 });
                maxRighe = Math.max(maxRighe, matLines.length);
                
                // Quantità (converti in stringa, gestisci null/undefined)
                let quantitaStr = '';
                if (riga.quantita != null) {
                    if (typeof riga.quantita === 'number') {
                        quantitaStr = riga.quantita.toString();
                    } else if (typeof riga.quantita === 'string') {
                        quantitaStr = riga.quantita;
                    } else {
                        quantitaStr = String(riga.quantita);
                    }
                }
                const qtyLines = doc.splitTextToSize(quantitaStr, colWidths[2] - 2);
                doc.text(qtyLines, colPositions[2], yPos, { maxWidth: colWidths[2] - 2 });
                maxRighe = Math.max(maxRighe, qtyLines.length);
                
                // Unità
                const unitaText = String(riga.unitaMisura || '');
                const unitLines = doc.splitTextToSize(unitaText, colWidths[3] - 2);
                doc.text(unitLines, colPositions[3], yPos, { maxWidth: colWidths[3] - 2 });
                maxRighe = Math.max(maxRighe, unitLines.length);
                
                // Descrizione - usa splitTextToSize per wrappare il testo su più righe
                const descrizione = String(riga.descrizione || '');
                const descLines = doc.splitTextToSize(descrizione, colWidths[4] - 2);
                doc.text(descLines, colPositions[4], yPos, { maxWidth: colWidths[4] - 2 });
                maxRighe = Math.max(maxRighe, descLines.length);
                
                // Aumenta yPos in base al numero massimo di righe
                if (maxRighe > 1) {
                    yPos += lineHeight * (maxRighe - 1);
                }

                if (isTotal) {
                    doc.setFont(undefined, 'normal');
                }

                yPos += lineHeight;
            });
        });

        // Riepilogo finale
        yPos += lineHeight;
        if (yPos > pageHeight - margin - lineHeight * 8) {
            doc.addPage();
            yPos = margin;
        }

        doc.setFontSize(subtitleSize);
        doc.setFont(undefined, 'bold');
        doc.text('Riepilogo Configurazione', margin, yPos);
        yPos += lineHeight * 1.5;

        doc.setFontSize(normalSize);
        doc.setFont(undefined, 'normal');
        const filiPortataText = materialiCalcolati.riepilogo.numeroFiliPortata > 0 ? 
            `${String(materialiCalcolati.riepilogo.numeroFiliPortata)} fili (${String(materialiCalcolati.riepilogo.diametroFiloPortata)}mm)` : 
            'Nessuno';
        doc.text(`Fili di Portata: ${filiPortataText}`, margin, yPos);
        yPos += lineHeight;
        
        if (materialiCalcolati.riepilogo.numeroFiliVegetazione > 0) {
            doc.text(`Fili di Vegetazione: ${String(materialiCalcolati.riepilogo.numeroFiliVegetazione)} fili (${String(materialiCalcolati.riepilogo.diametroFiloVegetazione)}mm)`, margin, yPos);
            yPos += lineHeight;
        }

        // Data e firma
        yPos += lineHeight;
        const dataOggi = formatDateLikeToItalianLongLocal(new Date()) || '';
        doc.text(`Documento generato il: ${dataOggi}`, margin, yPos);
        yPos += lineHeight;
        doc.text('GFV Platform - Calcolo Materiali Impianto', pageWidth / 2, yPos, { align: 'center' });

        // Salva PDF
        const fileName = `materiali-impianto-${terrenoNome.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        showAlert('PDF esportato con successo!', 'success');
    } catch (error) {
        console.error('Errore esportazione PDF:', error);
        showAlert('Errore durante l\'esportazione PDF: ' + error.message, 'error');
    }
};

window.resetConfigurazione = function() {
    document.getElementById('tipoImpianto').value = '';
    document.getElementById('distanzaPali').value = '5.0';
    document.getElementById('altezzaPali').value = '2.5';
    
    // Reset campi fili
    const numFiliPortataEl = document.getElementById('numeroFiliPortata');
    const numFiliVegetazioneEl = document.getElementById('numeroFiliVegetazione');
    const diamFiloPortataEl = document.getElementById('diametroFiloPortata');
    const diamFiloVegetazioneEl = document.getElementById('diametroFiloVegetazione');
    
    numFiliPortataEl.value = '';
    numFiliVegetazioneEl.value = '';
    diamFiloPortataEl.value = '';
    diamFiloVegetazioneEl.value = '';
    
    // Abilita tutti i campi
    numFiliPortataEl.disabled = false;
    numFiliVegetazioneEl.disabled = false;
    diamFiloPortataEl.disabled = false;
    diamFiloVegetazioneEl.disabled = false;
    
    // Reset placeholder
    numFiliPortataEl.placeholder = 'Auto (da tipo impianto)';
    numFiliVegetazioneEl.placeholder = 'Auto (da tipo impianto)';
    diamFiloPortataEl.placeholder = 'Auto (da tipo impianto)';
    diamFiloVegetazioneEl.placeholder = 'Auto (da tipo impianto)';
    
    // Reset braccetti, ancore e fissaggio tutori
    document.getElementById('usaTutori').value = '';
    document.getElementById('usaAncore').value = '';
    document.getElementById('fissaggioTutori').value = 'legacci';

    // Reset reti antigrandine
    const usaAntigrandineEl = document.getElementById('usaAntigrandine');
    const configAntigrandineEl = document.getElementById('config-antigrandine');
    if (usaAntigrandineEl) { usaAntigrandineEl.checked = false; }
    if (configAntigrandineEl) { configAntigrandineEl.style.display = 'none'; }
    if (document.getElementById('tipoStrutturaAntigrandine')) document.getElementById('tipoStrutturaAntigrandine').value = 'rete_piana';
    if (document.getElementById('distanzaPaliAntigrandine')) document.getElementById('distanzaPaliAntigrandine').value = '8';
    if (document.getElementById('altezzaPaliAntigrandine')) document.getElementById('altezzaPaliAntigrandine').value = '4';
    if (document.getElementById('diametroCaviAntigrandine')) document.getElementById('diametroCaviAntigrandine').value = '6';
    if (document.getElementById('usaTirantiAntigrandine')) document.getElementById('usaTirantiAntigrandine').value = 'true';
    if (document.getElementById('marginePercentualeAntigrandine')) document.getElementById('marginePercentualeAntigrandine').value = '10';
    if (document.getElementById('overrideCopripaliAntigrandine')) document.getElementById('overrideCopripaliAntigrandine').value = '';
    if (document.getElementById('overridePlacchetteAntigrandine')) document.getElementById('overridePlacchetteAntigrandine').value = '';
    if (document.getElementById('overrideStaffeAntigrandine')) document.getElementById('overrideStaffeAntigrandine').value = '';
    if (document.getElementById('overrideTendifuniAntigrandine')) document.getElementById('overrideTendifuniAntigrandine').value = '';
    if (document.getElementById('overrideSuperficieReteAntigrandine')) document.getElementById('overrideSuperficieReteAntigrandine').value = '';
    
    // Reset descrizione
    document.getElementById('tipo-impianto-desc').textContent = '';
    
    // Nascondi risultati
    document.getElementById('risultati-section').style.display = 'none';
};

// Funzione per modificare una pianificazione
window.modificaPianificazione = function(pianificazioneId) {
    if (!pianificazioneId) {
        showAlert('ID pianificazione non valido', 'error');
        return;
    }
    // Reindirizza alla pagina di pianificazione con parametro URL
    window.location.href = `pianifica-impianto-standalone.html?coltura=${encodeURIComponent(currentColtura)}&pianificazioneId=${pianificazioneId}`;
};

// Funzione per confermare eliminazione pianificazione
window.eliminaPianificazioneConfirm = function(pianificazioneId) {
    if (!pianificazioneId) {
        showAlert('ID pianificazione non valido', 'error');
        return;
    }

    const pianificazione = pianificazioni.find(p => p.id === pianificazioneId);
    if (!pianificazione) {
        showAlert('Pianificazione non trovata', 'error');
        return;
    }

    const terreno = terreni.find(t => t.id === pianificazione.terrenoId);
    const terrenoNome = terreno ? terreno.nome : 'Terreno non trovato';
    const dataCreazione = pianificazione.createdAt
        ? (formatDateLikeToItalianLongLocal(pianificazione.createdAt) || '-')
        : '-';

    const messaggio = `Sei sicuro di voler eliminare questa pianificazione?\n\n` +
                    `Terreno: ${terrenoNome}\n` +
                    `Data creazione: ${dataCreazione}\n` +
                    `Stato: ${pianificazione.stato || 'bozza'}\n\n` +
                    `L'operazione non può essere annullata.`;

    if (confirm(messaggio)) {
        eliminaPianificazioneAction(pianificazioneId);
    }
};

// Funzione per eseguire l'eliminazione
async function eliminaPianificazioneAction(pianificazioneId) {
    try {
        await deletePianificazione(pianificazioneId);
        showAlert('Pianificazione eliminata con successo', 'info');
        
        // Ricarica la lista
        await loadPianificazioni();
        
        // Se la pianificazione eliminata era selezionata, nascondi sezioni
        if (pianificazioneSelezionata && pianificazioneSelezionata.id === pianificazioneId) {
            pianificazioneSelezionata = null;
            document.getElementById('config-section').style.display = 'none';
            document.getElementById('risultati-section').style.display = 'none';
        }
    } catch (error) {
        console.error('Errore eliminazione pianificazione:', error);
        showAlert('Errore nell\'eliminazione: ' + error.message, 'error');
    }
}

// Funzione per confermare pianificazione (con dialog di conferma)
window.confermaPianificazioneConfirm = function(pianificazioneId) {
    const pianificazione = pianificazioni.find(p => p.id === pianificazioneId);
    if (!pianificazione) {
        showAlert('Pianificazione non trovata', 'error');
        return;
    }

    const terreno = terreni.find(t => t.id === pianificazione.terrenoId);
    const terrenoNome = terreno ? terreno.nome : 'Terreno sconosciuto';
    
    const conferma = confirm(
        `Sei sicuro di voler confermare questa pianificazione?\n\n` +
        `Terreno: ${terrenoNome}\n` +
        `File: ${pianificazione.numeroFile || 0}\n` +
        `Unità: ${(pianificazione.numeroUnitaTotale || 0).toLocaleString('it-IT')}\n` +
        `Superficie: ${(pianificazione.superficieNettaImpianto || 0).toFixed(2)} Ha\n\n` +
        `La pianificazione passerà da "BOZZA" a "CONFERMATO" e potrà essere utilizzata per creare lavori di impianto.`
    );

    if (conferma) {
        confermaPianificazioneAction(pianificazioneId);
    }
};

// Funzione per eseguire la conferma
async function confermaPianificazioneAction(pianificazioneId) {
    try {
        await confermaPianificazione(pianificazioneId);
        showAlert('Pianificazione confermata con successo', 'success');
        
        // Ricarica la lista
        await loadPianificazioni();
    } catch (error) {
        console.error('Errore conferma pianificazione:', error);
        showAlert('Errore nella conferma: ' + error.message, 'error');
    }
}

// Avvia inizializzazione
init();

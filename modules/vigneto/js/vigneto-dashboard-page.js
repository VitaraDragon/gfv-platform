/**
 * Pagina Dashboard vigneto.
 * L'HTML in views/ resta la struttura; qui c'è il comportamento.
 * Gli import dinamici via resolvePath restano relativi all'URL della pagina.
 * @module modules/vigneto/js/vigneto-dashboard-page
 */

import { formatDateLikeToItalianLongLocal } from '../../../core/js/date-format-it.js';
import { showAlert } from '../../../core/js/gfv-page-utils.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';

try {
    await window.GFVStandaloneReady;
} catch (err) {
    console.error('[vigneto-dashboard] Bootstrap failed:', err);
    throw err;
}

const firebaseService = await import('../../../core/services/firebase-service.js');
const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = firebaseService;
const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = await import('../../../core/services/tenant-service.js');

const auth = getAuthInstance();
const db = getDb();
initializeTenantService();

let currentUser = null;
let currentTenantId = null;
let currentVignetoId = null;
let currentAnno = null;

// Verifica autenticazione
onAuthStateChanged(auth, async (user) => {
    if (!user) user = await resolveAuthUser(auth);
    if (user) {
        currentUser = user;
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                currentTenantId = getCurrentTenantId();

                // Verifica permessi (solo Manager o Amministratore)
                const ruoli = userData.ruoli || [];
                const isManager = ruoli.some(r => {
                    const roleLower = r.toLowerCase();
                    return roleLower.includes('manager') || roleLower.includes('amministratore');
                });

                if (!isManager) {
                    showAlert('Non hai i permessi per accedere a questa pagina', 'error');
                    setTimeout(() => {
                        window.location.href = '../../../core/dashboard-standalone.html';
                    }, 2000);
                    return;
                }

                // Verifica accesso modulo vigneto
                // Attendi che il tenant service sia inizializzato (con retry)
                let tenantId = getCurrentTenantId();
                
                // Se non disponibile, prova a usare tenantId dall'utente (fallback)
                if (!tenantId && userData.tenantId) {
                    tenantId = userData.tenantId;
                }
                
                // Retry per ottenere tenantId dal servizio (se non disponibile)
                if (!tenantId) {
                    for (let i = 0; i < 10; i++) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        tenantId = getCurrentTenantId();
                        if (tenantId) break;
                    }
                }
                
                currentTenantId = tenantId;
                
                if (tenantId) {
                    const tenant = await getCurrentTenant();
                    console.log('[VIGNETO-DASHBOARD] Tenant ID:', tenantId);
                    console.log('[VIGNETO-DASHBOARD] Tenant:', tenant);
                    console.log('[VIGNETO-DASHBOARD] Tenant modules:', tenant?.modules);
                    
                    if (!tenant) {
                        console.error('[VIGNETO-DASHBOARD] Tenant non trovato per ID:', tenantId);
                        showAlert('Errore: tenant non trovato', 'error');
                        setTimeout(() => {
                            window.location.href = '../../../core/dashboard-standalone.html';
                        }, 2000);
                        return;
                    }
                    
                    // Verifica modulo vigneto (case-insensitive)
                    const modules = Array.isArray(tenant?.modules) ? tenant.modules : [];
                    
                    // Sincronizza moduli attivi con Tony (helper unico per tutte le pagine standalone; retry se widget non ancora pronto)
                    const tonyCtxPayload = {
                        moduli_attivi: modules,
                        tenantId: tenantId,
                        utente_corrente: { ruoli: ruoli },
                    };
                    if (typeof window.syncTonyModules === 'function') {
                        window.syncTonyModules(modules);
                        if (typeof window.setTonyContext === 'function') {
                            window.setTonyContext(tonyCtxPayload);
                        }
                    } else if (window.setTonyContext) {
                        window.setTonyContext(tonyCtxPayload);
                    } else {
                        window.dispatchEvent(new CustomEvent('tony-module-updated', { detail: { modules: modules } }));
                    }
                    const hasVignetoModule = modules.some(m => m && m.toLowerCase() === 'vigneto');
                    
                    if (!hasVignetoModule) {
                        console.warn('[VIGNETO-DASHBOARD] Modulo vigneto non trovato. Modules disponibili:', modules);
                        showAlert('Il modulo Vigneto non è attivo. Attivalo dalla pagina Abbonamento.', 'error');
                        setTimeout(() => {
                            window.location.href = '../../../core/admin/abbonamento-standalone.html';
                        }, 3000);
                        return;
                    }
                    
                    console.log('[VIGNETO-DASHBOARD] Modulo vigneto verificato con successo');
                } else {
                    console.error('[VIGNETO-DASHBOARD] Nessun tenant ID disponibile');
                    showAlert('Nessun tenant disponibile', 'error');
                    setTimeout(() => {
                        window.location.href = '../../../core/dashboard-standalone.html';
                    }, 2000);
                    return;
                }

                // Inizializza filtri
                await initFilters();
                
                // Carica statistiche iniziali
                await loadStats();
            } else {
                window.location.href = await loginPageUrl('../../../core/auth/login-standalone.html');
            }
        } catch (error) {
            console.error('Errore:', error);
            const offline = /offline|Could not reach/i.test(String(error.message || error));
            const simHint = offline
                ? ' Firestore non raggiungibile: avvia npm run sim:emulators, apri core/dev/simulator-dev-standalone.html?emulator=1, Entra su un\'azienda, poi Vigneto.'
                : '';
            showAlert('Errore caricamento dati: ' + error.message + simHint, 'error');
        }
    } else {
        window.location.href = await loginPageUrl('../../../core/auth/login-standalone.html');
    }
});

// Inizializza filtri
async function initFilters() {
    try {
        // Popola dropdown vigneti
        const { getAllVigneti } = await import('../services/vigneti-service.js');
        const vigneti = await getAllVigneti();
        
        const vignetoSelect = document.getElementById('filtro-vigneto');
        vignetoSelect.innerHTML = '<option value="">Tutti i vigneti</option>';
        
        vigneti.forEach(vigneto => {
            const option = document.createElement('option');
            option.value = vigneto.id;
            option.textContent = vigneto.varieta || 'Vigneto';
            vignetoSelect.appendChild(option);
        });

        // Popola dropdown anni (ultimi 5 anni + anno corrente)
        const annoSelect = document.getElementById('filtro-anno');
        const annoCorrente = new Date().getFullYear();
        annoSelect.innerHTML = '';
        
        for (let i = 0; i < 5; i++) {
            const anno = annoCorrente - i;
            const option = document.createElement('option');
            option.value = anno;
            option.textContent = anno;
            if (i === 0) {
                option.selected = true;
                currentAnno = anno;
            }
            annoSelect.appendChild(option);
        }

        // Event listeners per filtri
        vignetoSelect.addEventListener('change', async (e) => {
            currentVignetoId = e.target.value || null;
            await loadStats();
        });

        annoSelect.addEventListener('change', async (e) => {
            currentAnno = parseInt(e.target.value);
            await loadStats();
        });
    } catch (error) {
        console.error('Errore inizializzazione filtri:', error);
        showAlert('Errore caricamento filtri: ' + error.message, 'error');
    }
}

// Carica statistiche
async function loadStats() {
    try {
        if (!currentTenantId) {
            resetStats();
            return;
        }

        const { getStatisticheVigneto, getVendemmieRecenti, getLavoriVigneto } = await import('../services/vigneto-statistiche-service.js');
        
        // Carica statistiche aggregate
        const statistiche = await getStatisticheVigneto(currentVignetoId, currentAnno);
        
        // Aggiorna card statistiche
        document.getElementById('stat-produzione').textContent = statistiche.produzioneTotaleQli.toFixed(2);
        document.getElementById('stat-resa').textContent = statistiche.resaMediaQliHa.toFixed(2);
        document.getElementById('stat-spese-vendemmia').textContent = statistiche.speseVendemmiaAnno.toFixed(2);
        const costoTotale = statistiche.costoTotaleAnno ?? 0;
        document.getElementById('stat-spese-totali').textContent = costoTotale > 0 ? costoTotale.toFixed(2) : '-';
        document.getElementById('stat-numero-vigneti').textContent = statistiche.numeroVigneti;
        document.getElementById('stat-numero-vendemmie').textContent = statistiche.numeroVendemmie;
        
        // Ultima vendemmia
        if (statistiche.dataUltimaVendemmia) {
            const dataFormattata = formatDateLikeToItalianLongLocal(statistiche.dataUltimaVendemmia) || '';
            document.getElementById('stat-ultima-vendemmia').textContent = dataFormattata;
            
            // Link alla vendemmia (se disponibile)
            const linkUltima = document.getElementById('link-ultima-vendemmia');
            // TODO: Aggiungere link quando avremo l'ID vendemmia
        } else {
            document.getElementById('stat-ultima-vendemmia').textContent = 'Nessuna';
            document.getElementById('link-ultima-vendemmia').style.pointerEvents = 'none';
            document.getElementById('link-ultima-vendemmia').style.opacity = '0.6';
        }

        // Sottotitoli statistiche
        if (statistiche.produzionePerMese && Object.keys(statistiche.produzionePerMese).length > 0) {
            const mesi = Object.keys(statistiche.produzionePerMese).sort();
            const ultimoMese = mesi[mesi.length - 1];
            const produzioneUltimoMese = statistiche.produzionePerMese[ultimoMese];
            document.getElementById('stat-produzione-subtitle').textContent = `Ultimo mese: ${produzioneUltimoMese.toFixed(2)} Qli`;
        } else {
            document.getElementById('stat-produzione-subtitle').textContent = '';
        }

        if (statistiche.resaPerVarieta && Object.keys(statistiche.resaPerVarieta).length > 0) {
            const varieta = Object.keys(statistiche.resaPerVarieta);
            if (varieta.length === 1) {
                document.getElementById('stat-resa-subtitle').textContent = varieta[0];
            } else {
                document.getElementById('stat-resa-subtitle').textContent = `${varieta.length} varietà`;
            }
        } else {
            document.getElementById('stat-resa-subtitle').textContent = '';
        }

        if (statistiche.spesePerMese && Object.keys(statistiche.spesePerMese).length > 0) {
            const mesi = Object.keys(statistiche.spesePerMese).sort();
            const ultimoMese = mesi[mesi.length - 1];
            const speseUltimoMese = statistiche.spesePerMese[ultimoMese];
            document.getElementById('stat-spese-subtitle').textContent = `Ultimo mese: ${speseUltimoMese.toFixed(2)} €`;
        } else {
            document.getElementById('stat-spese-subtitle').textContent = '';
        }

        // Carica vendemmie recenti
        await loadVendemmieRecenti();
        
        // Carica lavori vigneto
        await loadLavoriVigneto();
    } catch (error) {
        console.error('Errore caricamento statistiche:', error);
        showAlert('Errore caricamento statistiche: ' + error.message, 'error');
        resetStats();
    }
}

// Carica vendemmie recenti
async function loadVendemmieRecenti() {
    try {
        const { getVendemmieRecenti } = await import('../services/vigneto-statistiche-service.js');
        const vendemmie = await getVendemmieRecenti(currentVignetoId, currentAnno, 10);
        
        const tbody = document.querySelector('#table-vendemmie tbody');
        tbody.innerHTML = '';
        
        if (vendemmie.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <div class="empty-state-icon">🍇</div>
                        <div>Nessuna vendemmia trovata per i filtri selezionati</div>
                    </td>
                </tr>
            `;
            return;
        }
        
        vendemmie.forEach(vendemmia => {
            const dataFormattata = formatDateLikeToItalianLongLocal(vendemmia.data) || '-';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${dataFormattata}</td>
                <td>${vendemmia.vignetoNome || vendemmia.varieta || 'Vigneto'}</td>
                <td>${(vendemmia.quantitaQli || 0).toFixed(2)}</td>
                <td>${(vendemmia.resaQliHa || 0).toFixed(2)}</td>
                <td>${(vendemmia.costoTotale || 0).toFixed(2)}</td>
                <td>
                    <a href="vendemmia-standalone.html?vignetoId=${vendemmia.vignetoId}&vendemmiaId=${vendemmia.id}" class="btn-link">Dettaglio</a>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Errore caricamento vendemmie recenti:', error);
        const tbody = document.querySelector('#table-vendemmie tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div>Errore caricamento vendemmie</div>
                </td>
            </tr>
        `;
    }
}

// Carica lavori vigneto
async function loadLavoriVigneto() {
    try {
        const { getLavoriVigneto } = await import('../services/vigneto-statistiche-service.js');
        
        // Carica lavori completati
        const lavoriCompletati = await getLavoriVigneto(currentVignetoId, currentAnno, 'completato', 10);
        
        const tbody = document.querySelector('#table-lavori tbody');
        tbody.innerHTML = '';
        
        if (lavoriCompletati.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <div class="empty-state-icon">📋</div>
                        <div>Nessun lavoro completato trovato per i filtri selezionati</div>
                    </td>
                </tr>
            `;
            return;
        }
        
        lavoriCompletati.forEach(lavoro => {
            const dataVal = lavoro.dataInizio || lavoro.data;
            const dataInizio = dataVal instanceof Date 
                ? dataVal 
                : new Date(dataVal || 0);
            const dataFormattata = !isNaN(dataInizio.getTime()) 
                ? (formatDateLikeToItalianLongLocal(dataVal) || '-')
                : (lavoro.data || '-');
            const statoFormattato = lavoro.stato === 'completato' ? '✅ Completato' : lavoro.stato;
            const isDiario = lavoro.source === 'diario';
            const dettaglioCell = isDiario 
                ? '<span class="badge-diario" title="Attività registrata dal Diario">Da diario</span>' 
                : `<a href="../../../core/admin/gestione-lavori-standalone.html?lavoroId=${lavoro.id}" class="btn-link">Dettaglio</a>`;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${dataFormattata}</td>
                <td>${lavoro.vignetoNome || 'Vigneto'}</td>
                <td>${lavoro.tipoLavoro || 'N/A'}</td>
                <td>${statoFormattato}</td>
                <td>${dettaglioCell}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Errore caricamento lavori vigneto:', error);
        const tbody = document.querySelector('#table-lavori tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <div>Errore caricamento lavori</div>
                </td>
            </tr>
        `;
    }
}

// Reset statistiche
function resetStats() {
    document.getElementById('stat-produzione').textContent = '0';
    document.getElementById('stat-resa').textContent = '0';
    document.getElementById('stat-spese-vendemmia').textContent = '0';
    document.getElementById('stat-spese-totali').textContent = '-';
    document.getElementById('stat-numero-vigneti').textContent = '0';
    document.getElementById('stat-numero-vendemmie').textContent = '0';
    document.getElementById('stat-ultima-vendemmia').textContent = '-';
}


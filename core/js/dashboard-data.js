/**
 * Dashboard Data - Funzioni di caricamento dati Firebase per dashboard
 * 
 * @module core/js/dashboard-data
 */

import { query, where } from '../services/firebase-service.js';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calcola alert scadenza affitto
 * @param {Object} dataScadenza - Timestamp Firestore
 * @returns {Object} Alert con colore, testo, giorni
 */
export function calcolaAlertAffitto(dataScadenza) {
    if (!dataScadenza) {
        return { colore: null, testo: '', giorni: null };
    }

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    
    const scadenza = dataScadenza.toDate ? dataScadenza.toDate() : new Date(dataScadenza);
    scadenza.setHours(0, 0, 0, 0);

    const giorniRimanenti = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
    const mesiRimanenti = giorniRimanenti / 30;

    if (giorniRimanenti < 0) {
        return { colore: 'grey', testo: 'Scaduto', giorni: giorniRimanenti, mesi: null };
    } else if (giorniRimanenti <= 30) {
        return { colore: 'red', testo: `${giorniRimanenti} giorni`, giorni: giorniRimanenti, mesi: mesiRimanenti };
    } else if (giorniRimanenti <= 180) {
        const mesi = Math.floor(mesiRimanenti);
        return { colore: 'yellow', testo: `~${mesi} mesi`, giorni: giorniRimanenti, mesi: mesiRimanenti };
    } else {
        const mesi = Math.floor(mesiRimanenti);
        return { colore: 'green', testo: `~${mesi} mesi`, giorni: giorniRimanenti, mesi: mesiRimanenti };
    }
}

/**
 * Formatta data scadenza
 * @param {Object} data - Timestamp Firestore
 * @returns {string} Data formattata
 */
export function formattaDataScadenza(data) {
    if (!data) return '';
    const d = data.toDate ? data.toDate() : new Date(data);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Formatta ore in formato leggibile
 * @param {number} ore - Ore decimali
 * @returns {string} Ore formattate (es. "5h 30min")
 */
export function formattaOre(ore) {
    const oreInt = Math.floor(ore);
    const minuti = Math.round((ore - oreInt) * 60);
    return minuti === 0 ? `${oreInt}h` : `${oreInt}h ${minuti}min`;
}

// ============================================
// ADMIN / AMMINISTRAZIONE
// ============================================

/**
 * Carica statistiche amministrazione
 * @param {Array} availableModules - Moduli disponibili
 * @param {Object} dependencies - Dipendenze { db, auth, getDoc, doc, collection, getDocs, query, where }
 */
export async function loadAmministrazioneStats(availableModules, dependencies) {
    const { db, auth, getDoc, doc, collection, getDocs, query, where } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        
        const userData = userDoc.data();
        const tenantId = userData.tenantId;
        if (!tenantId) return;
        
        // Carica utenti del tenant
        const usersCollection = collection(db, 'users');
        const usersQuery = query(usersCollection, where('tenantId', '==', tenantId));
        const usersSnapshot = await getDocs(usersQuery);
        const totaleUtenti = usersSnapshot.size;
        const statUtentiEl = document.getElementById('stat-utenti-amministrazione');
        if (statUtentiEl) statUtentiEl.textContent = totaleUtenti;
        
        // Carica dati tenant per moduli e piano
        const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
        if (tenantDoc.exists()) {
            const tenantData = tenantDoc.data();
            const moduli = tenantData.modules || [];
            const piano = tenantData.piano || 'starter';
            
            const statModuliEl = document.getElementById('stat-moduli-amministrazione');
            if (statModuliEl) {
                const moduliAvanzati = moduli.filter(m => m !== 'core');
                const moduliCount = moduliAvanzati.length;
                if (moduliCount > 0) {
                    statModuliEl.textContent = `${moduliCount} moduli`;
                } else {
                    statModuliEl.textContent = 'Solo Core';
                }
            }
            
            const statPianoEl = document.getElementById('stat-piano-amministrazione');
            if (statPianoEl) {
                const pianoNames = {
                    'starter': 'Starter',
                    'professional': 'Professional',
                    'enterprise': 'Enterprise'
                };
                statPianoEl.textContent = pianoNames[piano] || piano;
            }
        }
    } catch (error) {
        console.error('Errore caricamento statistiche amministrazione:', error);
    }
}

/**
 * Carica statistiche amministratore (legacy, mantenuta per compatibilità)
 * @param {Array} availableModules - Moduli disponibili
 * @param {Object} dependencies - Dipendenze { db, auth, getDoc, doc, collection, getDocs, query, where }
 */
export async function loadAdminStats(availableModules, dependencies) {
    const { db, auth, getDoc, doc, collection, getDocs, query, where } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        
        const userData = userDoc.data();
        const tenantId = userData.tenantId;
        if (!tenantId) return;
        
        // Carica utenti del tenant
        const usersCollection = collection(db, 'users');
        const usersQuery = query(usersCollection, where('tenantId', '==', tenantId));
        const usersSnapshot = await getDocs(usersQuery);
        const totaleUtenti = usersSnapshot.size;
        const statUtentiEl = document.getElementById('stat-utenti-admin');
        if (statUtentiEl) statUtentiEl.textContent = totaleUtenti;
        
        // Carica dati tenant per moduli e piano
        const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
        if (tenantDoc.exists()) {
            const tenantData = tenantDoc.data();
            const moduli = tenantData.modules || [];
            const piano = tenantData.piano || 'starter';
            
            const statModuliEl = document.getElementById('stat-moduli-admin');
            if (statModuliEl) {
                const moduliCount = moduli.length;
                statModuliEl.textContent = moduliCount > 0 ? `${moduliCount} moduli` : 'Solo Core';
            }
            
            const statPianoEl = document.getElementById('stat-piano-admin');
            if (statPianoEl) {
                const pianoNames = {
                    'starter': 'Starter',
                    'professional': 'Professional',
                    'enterprise': 'Enterprise'
                };
                statPianoEl.textContent = pianoNames[piano] || piano;
            }
        }
    } catch (error) {
        console.error('Errore caricamento statistiche admin:', error);
    }
}

/**
 * Carica affitti in scadenza per la card dashboard
 * @param {Object} dependencies - Dipendenze { db, auth, getDoc, doc, collection, getDocs, escapeHtml }
 */
export async function loadAffittiInScadenza(dependencies) {
    const { db, auth, getDoc, doc, collection, getDocs, escapeHtml } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        
        const userData = userDoc.data();
        const tenantId = userData.tenantId;
        if (!tenantId) return;
        
        const contentEl = document.getElementById('affitti-scadenza-content');
        if (!contentEl) return;
        
        // Carica terreni
        const terreniCollection = collection(db, `tenants/${tenantId}/terreni`);
        const terreniSnapshot = await getDocs(terreniCollection);
        
        const affitti = [];
        terreniSnapshot.forEach(doc => {
            const terreno = doc.data();
            // Escludi terreni clienti (solo terreni aziendali)
            if (terreno.clienteId && terreno.clienteId !== '') return;
            
            if (terreno.tipoPossesso === 'affitto' && terreno.dataScadenzaAffitto) {
                const alert = calcolaAlertAffitto(terreno.dataScadenzaAffitto);
                affitti.push({
                    id: doc.id,
                    nome: terreno.nome || 'Senza nome',
                    dataScadenza: terreno.dataScadenzaAffitto,
                    alert: alert,
                    canone: terreno.canoneAffitto || null
                });
            }
        });
        
        // Ordina per urgenza: rosso prima, poi giallo, poi verde, poi grigio
        affitti.sort((a, b) => {
            const order = { 'red': 0, 'yellow': 1, 'green': 2, 'grey': 3 };
            const orderA = order[a.alert.colore] !== undefined ? order[a.alert.colore] : 999;
            const orderB = order[b.alert.colore] !== undefined ? order[b.alert.colore] : 999;
            if (orderA !== orderB) return orderA - orderB;
            return (a.alert.giorni || 999) - (b.alert.giorni || 999);
        });
        
        // Prendi solo quelli urgenti (rosso e giallo) - massimo 5
        const affittiUrgenti = affitti.filter(a => a.alert.colore === 'red' || a.alert.colore === 'yellow').slice(0, 5);
        
        if (affitti.length === 0) {
            contentEl.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <p>Nessun terreno in affitto registrato</p>
                </div>
            `;
            return;
        }
        
        if (affittiUrgenti.length === 0) {
            contentEl.innerHTML = `
                <div style="text-align: center; padding: 15px; color: #28a745;">
                    <p style="font-size: 14px; margin-bottom: 8px;">✅ Tutti in regola</p>
                    <p style="font-size: 12px; color: #666;">
                        ${affitti.length} terreno${affitti.length !== 1 ? 'i' : ''} in affitto
                    </p>
                    <a href="terreni-standalone.html" style="display: inline-block; margin-top: 10px; color: #2E8B57; text-decoration: underline; font-size: 12px;">
                        → Vai a Terreni
                    </a>
                </div>
            `;
            return;
        }
        
        let html = `
            <div style="margin-bottom: 10px;">
                <p style="color: #666; font-size: 12px; margin-bottom: 8px;">
                    <strong>${affittiUrgenti.length}</strong> urgente${affittiUrgenti.length !== 1 ? 'i' : ''}
                    ${affitti.length > affittiUrgenti.length ? `(${affitti.length} totali)` : ''}
                </p>
            </div>
        `;
        
        affittiUrgenti.forEach(affitto => {
            const dataFormattata = formattaDataScadenza(affitto.dataScadenza);
            const pallinoEmoji = affitto.alert.colore === 'red' ? '🔴' : affitto.alert.colore === 'yellow' ? '🟡' : '🟢';
            const coloreBordo = affitto.alert.colore === 'red' ? '#dc3545' : '#ffc107';
            const coloreSfondo = affitto.alert.colore === 'red' ? '#f8d7da' : '#fff3cd';
            
            html += `
                <div style="padding: 10px; margin-bottom: 8px; background: ${coloreSfondo}; border-left: 3px solid ${coloreBordo}; border-radius: 4px;">
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; font-size: 13px;">
                        <span>${pallinoEmoji}</span>
                        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(affitto.nome)}</span>
                    </div>
                    <div style="font-size: 11px; color: #666;">
                        ${dataFormattata} (${affitto.alert.testo})
                    </div>
                </div>
            `;
        });
        
        html += `
            <div style="margin-top: 10px; text-align: center;">
                <a href="terreni-standalone.html" style="color: #2E8B57; text-decoration: underline; font-size: 12px;">
                    → Vedi tutti
                </a>
            </div>
        `;
        
        contentEl.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento affitti in scadenza:', error);
        const contentEl = document.getElementById('affitti-scadenza-content');
        if (contentEl) {
            contentEl.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #dc3545;">
                    <p>Errore nel caricamento degli affitti</p>
                </div>
            `;
        }
    }
}

// ============================================
// MANAGER
// ============================================

/**
 * Carica statistiche core per manager
 * @param {Object} dependencies - Dipendenze { db, auth, getDoc, doc, collection, getDocs, query, where }
 */
export async function loadCoreStatsForManager(dependencies) {
    const { db, auth, getDoc, doc, collection, getDocs, query, where } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        
        const userData = userDoc.data();
        const tenantId = userData.tenantId;
        if (!tenantId) return;
        
        // Carica terreni (solo aziendali, escludi terreni clienti)
        const terreniCollection = collection(db, `tenants/${tenantId}/terreni`);
        const terreniSnapshot = await getDocs(terreniCollection);
        // Filtra solo terreni aziendali
        const totaleTerreni = terreniSnapshot.docs.filter(doc => {
            const terreno = doc.data();
            return !terreno.clienteId || terreno.clienteId === '';
        }).length;
        const statTerreniEl = document.getElementById('stat-terreni-manager');
        if (statTerreniEl) statTerreniEl.textContent = totaleTerreni;
        
        // Carica attività del mese corrente
        const oggi = new Date();
        const primoGiornoMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
        const dataInizioMese = primoGiornoMese.toISOString().split('T')[0];
        const dataFineMese = oggi.toISOString().split('T')[0];
        
        const attivitaCollection = collection(db, `tenants/${tenantId}/attivita`);
        const attivitaQuery = query(
            attivitaCollection,
            where('data', '>=', dataInizioMese),
            where('data', '<=', dataFineMese)
        );
        const attivitaSnapshot = await getDocs(attivitaQuery);
        
        let totaleOre = 0;
        attivitaSnapshot.forEach(doc => {
            const data = doc.data();
            totaleOre += data.oreNette || 0;
        });
        
        const totaleAttivita = attivitaSnapshot.size;
        const statAttivitaEl = document.getElementById('stat-attivita-manager');
        if (statAttivitaEl) statAttivitaEl.textContent = totaleAttivita;
        
        // Formatta ore
        const oreFormatted = formattaOre(totaleOre);
        const statOreEl = document.getElementById('stat-ore-manager');
        if (statOreEl) statOreEl.textContent = oreFormatted;
    } catch (error) {
        console.error('Errore caricamento statistiche core:', error);
    }
}

/**
 * Carica statistiche Manodopera complete per Manager
 * @param {Object} dependencies - Dipendenze { db, auth, getDoc, doc, collection, getDocs, setupManutenzioniRealtime, setupGuastiRealtime }
 */
export async function loadManagerManodoperaStats(dependencies) {
    const { db, auth, getDoc, doc, collection, getDocs, setupManutenzioniRealtime, setupGuastiRealtime } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        // Usa getCurrentTenantId() invece di userData.tenantId per supportare multi-tenant
        const { getCurrentTenantId } = await import('../services/tenant-service.js');
        const tenantId = getCurrentTenantId();
        if (!tenantId) {
            return;
        }
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        
        const userData = userDoc.data();
        
        // 1. Carica lavori
        const lavoriCollection = collection(db, `tenants/${tenantId}/lavori`);
        const lavoriSnapshot = await getDocs(lavoriCollection);
        
        let totali = 0;
        let attivi = 0;
        let daPianificare = 0;
        let superficieLavorata = 0;
        
        const lavoriIds = [];
        lavoriSnapshot.forEach(doc => {
            totali++;
            const lavoro = doc.data();
            const stato = lavoro.stato || 'pianificato';
            // Lavori attivi: in_corso o assegnato (non ancora completati/annullati)
            if (stato === 'in_corso' || stato === 'assegnato') {
                attivi++;
            }
            if (stato === 'da_pianificare') daPianificare++;
            lavoriIds.push(doc.id);
            
            if (lavoro.superficieTotaleLavorata) {
                superficieLavorata += lavoro.superficieTotaleLavorata;
            }
        });
        
        // 2. Carica ore validate del mese corrente
        const oggi = new Date();
        const primoGiornoMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
        primoGiornoMese.setHours(0, 0, 0, 0); // Imposta a inizio giornata per confronto corretto
        let oreValidateTotali = 0;
        
        for (const lavoroId of lavoriIds) {
            try {
                const oreRef = collection(db, `tenants/${tenantId}/lavori/${lavoroId}/oreOperai`);
                const oreSnapshot = await getDocs(oreRef);
                
                oreSnapshot.forEach(oraDoc => {
                    const ora = oraDoc.data();
                    if (ora.stato === 'validate' && ora.data) {
                        try {
                            let dataOra;
                            if (ora.data && ora.data.toDate) {
                                dataOra = ora.data.toDate();
                            } else if (ora.data instanceof Date) {
                                dataOra = ora.data;
                            } else if (ora.data) {
                                dataOra = new Date(ora.data);
                            } else {
                                return; // Salta se non c'è data valida
                            }
                            
                            // Imposta a inizio giornata per confronto corretto
                            dataOra.setHours(0, 0, 0, 0);
                            
                            if (dataOra >= primoGiornoMese && !isNaN(dataOra.getTime())) {
                                const oreNette = parseFloat(ora.oreNette) || 0;
                                if (!isNaN(oreNette) && oreNette > 0) {
                                    oreValidateTotali += oreNette;
                                }
                            }
                        } catch (e) {
                            console.warn('Errore conversione data ora:', e, ora);
                            // Ignora errori di conversione data
                        }
                    }
                });
            } catch (error) {
                // Se la sub-collection non esiste, continua
                console.warn(`Sub-collection oreOperai non trovata per lavoro ${lavoroId}:`, error);
            }
        }
        
        // 3. Carica squadre attive
        const squadreCollection = collection(db, `tenants/${tenantId}/squadre`);
        const squadreSnapshot = await getDocs(squadreCollection);
        let squadreAttive = 0;
        
        squadreSnapshot.forEach(doc => {
            const squadra = doc.data();
            if (squadra.operai && squadra.operai.length > 0) {
                squadreAttive++;
            }
        });
        
        // 4. Conta operai online (TUTTI gli operai del tenant, non solo quelli in squadre)
        let operaiOnline = 0;
        try {
            const usersRef = collection(db, 'users');
            const operaiQuery = query(
                usersRef,
                where('tenantId', '==', tenantId),
                where('ruoli', 'array-contains', 'operaio'),
                where('stato', '==', 'attivo')
            );
            const operaiSnapshot = await getDocs(operaiQuery);
            
            operaiSnapshot.forEach(operaioDoc => {
                const operaioData = operaioDoc.data();
                if (operaioData.isOnline === true) {
                    operaiOnline++;
                }
            });
        } catch (error) {
            console.warn('Errore caricamento operai per conteggio online:', error);
            // Fallback: conta solo operai in squadre (comportamento precedente)
            const operaiIds = new Set();
            squadreSnapshot.forEach(doc => {
                const squadra = doc.data();
                if (squadra.operai && squadra.operai.length > 0) {
                    squadra.operai.forEach(operaioId => operaiIds.add(operaioId));
                }
            });
            for (const operaioId of operaiIds) {
                try {
                    const operaioDoc = await getDoc(doc(db, 'users', operaioId));
                    if (operaioDoc.exists()) {
                        const operaioData = operaioDoc.data();
                        if (operaioData.isOnline === true) {
                            operaiOnline++;
                        }
                    }
                } catch (e) {
                    // Ignora errori
                }
            }
        }
        
        // Aggiorna UI
        const statTotali = document.getElementById('stat-lavori-totali-manodopera');
        const statAttivi = document.getElementById('stat-lavori-attivi-manodopera');
        const statDaPianificare = document.getElementById('stat-lavori-da-pianificare');
        const statOre = document.getElementById('stat-ore-validate-manodopera');
        const statSuperficie = document.getElementById('stat-superficie-lavorata-manodopera');
        const statSquadre = document.getElementById('stat-squadre-attive-manodopera');
        const statOperai = document.getElementById('stat-operai-online-manodopera');
        
        // Carica manutenzioni in scadenza e guasti segnalati con listener real-time (solo se modulo Parco Macchine attivo)
        const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
        let hasContoTerzi = false;
        if (tenantDoc.exists()) {
            const tenantData = tenantDoc.data();
            hasContoTerzi = tenantData.modules && tenantData.modules.includes('contoTerzi');
            const hasParcoMacchine = tenantData.modules && tenantData.modules.includes('parcoMacchine');
            if (hasParcoMacchine && setupManutenzioniRealtime && setupGuastiRealtime) {
                setTimeout(() => {
                    setupManutenzioniRealtime(tenantId);
                    setupGuastiRealtime(tenantId);
                }, 100);
            }
        }
        
        if (statTotali) statTotali.textContent = totali;
        if (statAttivi) statAttivi.textContent = attivi;
        // Aggiorna card "Da Pianificare" solo se modulo Conto Terzi è attivo (la card esiste solo in quel caso)
        if (statDaPianificare && hasContoTerzi) {
            statDaPianificare.textContent = daPianificare;
        }
        
        // Formatta ore
        const oreFormatted = formattaOre(oreValidateTotali);
        if (statOre) statOre.textContent = oreFormatted;
        
        // Formatta superficie (in ettari, 2 decimali)
        if (statSuperficie) statSuperficie.textContent = superficieLavorata.toFixed(2);
        if (statSquadre) statSquadre.textContent = squadreAttive;
        if (statOperai) statOperai.textContent = operaiOnline;
        
        // 5. Carica ore da validare (solo lavori autonomi per manager)
        await loadOreDaValidareManager(tenantId, dependencies);
    } catch (error) {
        console.error('Errore caricamento statistiche Manodopera:', error);
    }
}

/**
 * Carica e aggiorna contatore ore da validare per manager (lavori autonomi)
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze Firebase
 */
async function loadOreDaValidareManager(tenantId, dependencies) {
    const { db, collection, getDocs } = dependencies;
    
    try {
        // Carica tutti i lavori del tenant
        const lavoriCollection = collection(db, `tenants/${tenantId}/lavori`);
        const lavoriSnapshot = await getDocs(lavoriCollection);
        
        let conteggioOreDaValidare = 0;
        
        // Per ogni lavoro, verifica se è autonomo e conta ore da validare
        for (const lavoroDoc of lavoriSnapshot.docs) {
            const lavoroData = lavoroDoc.data();
            const lavoroId = lavoroDoc.id;
            
            // Manager può validare solo lavori autonomi (operaioId presente, caposquadraId null)
            if (lavoroData.operaioId && !lavoroData.caposquadraId) {
                try {
                    const oreRef = collection(db, `tenants/${tenantId}/lavori/${lavoroId}/oreOperai`);
                    const oreQuery = query(oreRef, where('stato', '==', 'da_validare'));
                    const oreSnapshot = await getDocs(oreQuery);
                    
                    // Conta il numero di record (non le ore effettive, ma il numero di "ore da validare")
                    conteggioOreDaValidare += oreSnapshot.size;
                } catch (error) {
                    // Se la sub-collection non esiste o c'è un errore, continua
                    console.warn(`Errore caricamento ore da validare per lavoro ${lavoroId}:`, error);
                }
            }
        }
        
        // Aggiorna badge
        const badge = document.getElementById('ore-da-validare-badge');
        if (badge) {
            if (conteggioOreDaValidare > 0) {
                badge.textContent = conteggioOreDaValidare;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Errore caricamento ore da validare:', error);
        // In caso di errore, nascondi il badge
        const badge = document.getElementById('ore-da-validare-badge');
        if (badge) {
            badge.style.display = 'none';
        }
    }
}

// ============================================
// MANAGER - LAVORI RECENTI E STATISTICHE
// ============================================

/**
 * Carica lavori recenti per Manager con Manodopera
 * @param {Object} dependencies - Dipendenze { db, auth, getDoc, doc, collection, getDocs, query, orderBy, limit, escapeHtml }
 */
export async function loadRecentLavoriManagerManodopera(dependencies) {
    const { db, auth, getDoc, doc, collection, getDocs, query, orderBy, limit, escapeHtml } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        
        const userData = userDoc.data();
        const tenantId = userData.tenantId;
        if (!tenantId) return;
        
        const lavoriCollection = collection(db, `tenants/${tenantId}/lavori`);
        let lavoriSnapshot;
        
        try {
            const lavoriQuery = query(lavoriCollection, orderBy('createdAt', 'desc'), limit(5));
            lavoriSnapshot = await getDocs(lavoriQuery);
        } catch (error) {
            const allLavoriSnapshot = await getDocs(lavoriCollection);
            const lavoriArray = [];
            allLavoriSnapshot.forEach(doc => {
                lavoriArray.push({ id: doc.id, ...doc.data() });
            });
            lavoriArray.sort((a, b) => {
                if (a.createdAt && b.createdAt) {
                    return b.createdAt.toMillis() - a.createdAt.toMillis();
                }
                return b.id.localeCompare(a.id);
            });
            lavoriSnapshot = {
                empty: lavoriArray.length === 0,
                forEach: (callback) => {
                    lavoriArray.slice(0, 5).forEach(item => {
                        callback({ id: item.id, data: () => item });
                    });
                }
            };
        }
        
        const recentLavoriEl = document.getElementById('recent-lavori-manager-manodopera');
        if (!recentLavoriEl) return;
        
        if (lavoriSnapshot.empty) {
            recentLavoriEl.innerHTML = `
                <li class="recent-item">
                    <div>
                        <div class="recent-item-title">Nessun lavoro trovato</div>
                    </div>
                </li>
            `;
            return;
        }
        
        const terreniRef = collection(db, `tenants/${tenantId}/terreni`);
        const terreniSnapshot = await getDocs(terreniRef);
        const terreniMap = new Map();
        terreniSnapshot.forEach(doc => {
            terreniMap.set(doc.id, doc.data());
        });
        
        let html = '';
        lavoriSnapshot.forEach(doc => {
            const lavoro = doc.data();
            const nome = lavoro.nome || 'Senza nome';
            const stato = lavoro.stato || 'pianificato';
            const statoLabels = {
                'pianificato': '📅 Pianificato',
                'attivo': '🟢 Attivo',
                'completato': '✅ Completato',
                'sospeso': '⏸️ Sospeso'
            };
            const statoLabel = statoLabels[stato] || stato;
            
            let percentuale = lavoro.percentualeCompletamento || 0;
            const terreno = terreniMap.get(lavoro.terrenoId);
            
            if (stato === 'completato' && (!percentuale || percentuale === 0)) {
                percentuale = 100;
            } else if (!percentuale && terreno) {
                const superficieTotale = terreno.superficie || 0;
                const superficieLavorata = lavoro.superficieTotaleLavorata || 0;
                if (superficieTotale > 0) {
                    percentuale = Math.round((superficieLavorata / superficieTotale) * 100);
                }
            }
            
            const isContoTerzi = !!lavoro.clienteId;
            const contoTerziBadge = isContoTerzi ? '<span style="background: #1976D2; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px; font-weight: 500;">💼 Conto Terzi</span>' : '';
            
            const progressBar = percentuale > 0 ? `
                <div style="margin-top: 8px;">
                    <div style="background: #e0e0e0; border-radius: 4px; height: 20px; overflow: hidden; position: relative;">
                        <div style="background: ${stato === 'completato' ? '#4CAF50' : '#2E8B57'}; height: 100%; width: ${Math.min(percentuale, 100)}%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 600; transition: width 0.3s;">
                            ${percentuale}%
                        </div>
                    </div>
                </div>
            ` : '';
            
            html += `
                <li class="recent-item">
                    <div style="width: 100%;">
                        <div class="recent-item-title">
                            ${escapeHtml(nome)}${contoTerziBadge}
                        </div>
                        <div class="recent-item-meta">${statoLabel}</div>
                        ${progressBar}
                    </div>
                </li>
            `;
        });
        
        recentLavoriEl.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento lavori recenti:', error);
        const recentLavoriEl = document.getElementById('recent-lavori-manager-manodopera');
        if (recentLavoriEl) {
            recentLavoriEl.innerHTML = `
                <li class="recent-item">
                    <div>
                        <div class="recent-item-title">Errore caricamento lavori</div>
                    </div>
                </li>
            `;
        }
    }
}

/**
 * Carica statistiche lavori per Manager
 * @param {Object} dependencies - Dipendenze { db, auth, getDoc, doc, collection, getDocs }
 */
export async function loadManagerLavoriStats(dependencies) {
    const { db, auth, getDoc, doc, collection, getDocs } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        
        const userData = userDoc.data();
        const tenantId = userData.tenantId;
        if (!tenantId) return;
        
        const lavoriCollection = collection(db, `tenants/${tenantId}/lavori`);
        const lavoriSnapshot = await getDocs(lavoriCollection);
        
        let totali = 0;
        let attivi = 0;
        let completati = 0;
        let pianificati = 0;
        let daPianificare = 0;
        
        lavoriSnapshot.forEach(doc => {
            totali++;
            const lavoro = doc.data();
            const stato = lavoro.stato || 'pianificato';
            
            // Lavori attivi: in_corso o assegnato (non ancora completati/annullati)
            if (stato === 'in_corso' || stato === 'assegnato') {
                attivi++;
            } else if (stato === 'completato') {
                completati++;
            } else if (stato === 'pianificato') {
                pianificati++;
            } else if (stato === 'da_pianificare') {
                daPianificare++;
                pianificati++;
            }
        });
        
        const statTotali = document.getElementById('stat-lavori-totali');
        const statAttivi = document.getElementById('stat-lavori-attivi');
        const statCompletati = document.getElementById('stat-lavori-completati');
        const statPianificati = document.getElementById('stat-lavori-pianificati');
        
        // Verifica se modulo Conto Terzi è attivo (per aggiornare card "Lavori Pianificati")
        let hasContoTerzi = false;
        try {
            const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
            if (tenantDoc.exists()) {
                const tenantData = tenantDoc.data();
                hasContoTerzi = tenantData.modules && tenantData.modules.includes('contoTerzi');
            }
        } catch (e) {
            // Ignora errori
        }
        
        if (statTotali) statTotali.textContent = totali;
        if (statAttivi) statAttivi.textContent = attivi;
        if (statCompletati) statCompletati.textContent = completati;
        // Aggiorna card "Lavori Pianificati" solo se modulo Conto Terzi è attivo (la card esiste solo in quel caso)
        if (statPianificati && hasContoTerzi) {
            statPianificati.textContent = pianificati;
        }
    } catch (error) {
        console.error('Errore caricamento statistiche lavori:', error);
    }
}

/**
 * Carica lavori recenti per Manager (versione base)
 * @param {Object} dependencies - Dipendenze { db, auth, getDoc, doc, collection, getDocs, query, orderBy, limit, escapeHtml }
 */
export async function loadRecentLavori(dependencies) {
    const { db, auth, getDoc, doc, collection, getDocs, query, orderBy, limit, escapeHtml } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        
        const userData = userDoc.data();
        const tenantId = userData.tenantId;
        if (!tenantId) return;
        
        const lavoriCollection = collection(db, `tenants/${tenantId}/lavori`);
        let lavoriSnapshot;
        
        try {
            const lavoriQuery = query(lavoriCollection, orderBy('createdAt', 'desc'), limit(5));
            lavoriSnapshot = await getDocs(lavoriQuery);
        } catch (error) {
            const allLavoriSnapshot = await getDocs(lavoriCollection);
            const lavoriArray = [];
            allLavoriSnapshot.forEach(doc => {
                lavoriArray.push({ id: doc.id, ...doc.data() });
            });
            lavoriArray.sort((a, b) => {
                if (a.createdAt && b.createdAt) {
                    return b.createdAt.toMillis() - a.createdAt.toMillis();
                }
                return b.id.localeCompare(a.id);
            });
            lavoriSnapshot = {
                empty: lavoriArray.length === 0,
                forEach: (callback) => {
                    lavoriArray.slice(0, 5).forEach(item => {
                        callback({ id: item.id, data: () => item });
                    });
                }
            };
        }
        
        const recentLavoriEl = document.getElementById('recent-lavori-manager');
        if (!recentLavoriEl) return;
        
        if (lavoriSnapshot.empty) {
            recentLavoriEl.innerHTML = `
                <li class="recent-item">
                    <div>
                        <div class="recent-item-title">Nessun lavoro trovato</div>
                    </div>
                </li>
            `;
            return;
        }
        
        const terreniRef = collection(db, `tenants/${tenantId}/terreni`);
        const terreniSnapshot = await getDocs(terreniRef);
        const terreniMap = new Map();
        terreniSnapshot.forEach(doc => {
            terreniMap.set(doc.id, doc.data());
        });
        
        let html = '';
        lavoriSnapshot.forEach(doc => {
            const lavoro = doc.data();
            const nome = lavoro.nome || 'Senza nome';
            const stato = lavoro.stato || 'pianificato';
            const statoLabels = {
                'pianificato': '📅 Pianificato',
                'attivo': '🟢 Attivo',
                'completato': '✅ Completato',
                'sospeso': '⏸️ Sospeso'
            };
            const statoLabel = statoLabels[stato] || stato;
            
            let percentuale = lavoro.percentualeCompletamento || 0;
            const terreno = terreniMap.get(lavoro.terrenoId);
            
            if (stato === 'completato' && (!percentuale || percentuale === 0)) {
                percentuale = 100;
            } else if (!percentuale && terreno) {
                const superficieTotale = terreno.superficie || 0;
                const superficieLavorata = lavoro.superficieTotaleLavorata || 0;
                if (superficieTotale > 0) {
                    percentuale = Math.round((superficieLavorata / superficieTotale) * 100);
                }
            }
            
            const isContoTerzi = !!lavoro.clienteId;
            const contoTerziBadge = isContoTerzi ? '<span style="background: #1976D2; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px; font-weight: 500;">💼 Conto Terzi</span>' : '';
            
            const progressBar = percentuale > 0 ? `
                <div style="margin-top: 8px;">
                    <div style="background: #e0e0e0; border-radius: 4px; height: 20px; overflow: hidden; position: relative;">
                        <div style="background: ${stato === 'completato' ? '#4CAF50' : '#2E8B57'}; height: 100%; width: ${Math.min(percentuale, 100)}%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 600; transition: width 0.3s;">
                            ${percentuale}%
                        </div>
                    </div>
                </div>
            ` : '';
            
            html += `
                <li class="recent-item">
                    <div style="width: 100%;">
                        <div class="recent-item-title">
                            ${escapeHtml(nome)}${contoTerziBadge}
                        </div>
                        <div class="recent-item-meta">${statoLabel}</div>
                        ${progressBar}
                    </div>
                </li>
            `;
        });
        
        recentLavoriEl.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento lavori recenti:', error);
        const recentLavoriEl = document.getElementById('recent-lavori-manager');
        if (recentLavoriEl) {
            recentLavoriEl.innerHTML = `
                <li class="recent-item">
                    <div>
                        <div class="recent-item-title">Errore caricamento lavori</div>
                    </div>
                </li>
            `;
        }
    }
}

// ============================================
// MANAGER - DIARIO DA LAVORI
// ============================================

/**
 * Carica attività generate automaticamente dalle ore validate
 * @param {Object} userData - Dati utente
 * @param {Object} dependencies - Dipendenze { db, auth, collection, getDocs, escapeHtml }
 */
export async function loadDiarioDaLavori(userData, dependencies) {
    const { db, auth, collection, getDocs, escapeHtml } = dependencies;
    
    const container = document.getElementById('diario-lavori-container');
    if (!container) {
        console.error('Container diario-lavori-container non trovato');
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user || !userData || !userData.tenantId) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545;">
                    <div style="font-size: 18px; margin-bottom: 10px;">Errore: dati utente non disponibili</div>
                </div>
            `;
            return;
        }
        
        const tenantId = userData.tenantId;
        
        const lavoriRef = collection(db, `tenants/${tenantId}/lavori`);
        const lavoriSnapshot = await getDocs(lavoriRef);
        
        const attivitaMap = new Map();
        
        const terreniRef = collection(db, `tenants/${tenantId}/terreni`);
        const terreniSnapshot = await getDocs(terreniRef);
        const terreniMap = new Map();
        terreniSnapshot.forEach(doc => {
            terreniMap.set(doc.id, doc.data());
        });
        
        for (const lavoroDoc of lavoriSnapshot.docs) {
            const lavoro = lavoroDoc.data();
            const lavoroId = lavoroDoc.id;
            
            try {
                const oreRef = collection(db, `tenants/${tenantId}/lavori/${lavoroId}/oreOperai`);
                const oreSnapshot = await getDocs(oreRef);
                
                const orePerData = new Map();
                
                oreSnapshot.forEach(oraDoc => {
                    const ora = oraDoc.data();
                    if (ora.stato !== 'validate') return;
                    if (!ora.data) return;
                    
                    try {
                        const dataOra = ora.data.toDate ? ora.data.toDate() : new Date(ora.data);
                        if (isNaN(dataOra.getTime())) return;
                        
                        const dataKey = dataOra.toISOString().split('T')[0];
                        
                        if (!orePerData.has(dataKey)) {
                            orePerData.set(dataKey, []);
                        }
                        orePerData.get(dataKey).push(ora);
                    } catch (error) {
                        console.warn('Errore processamento ora:', oraDoc.id, error);
                    }
                });
                
                orePerData.forEach((oreGiorno, dataKey) => {
                    let orarioInizio = null;
                    let orarioFine = null;
                    let pauseTotali = 0;
                    let oreNetteTotali = 0;
                    const operaiSet = new Set();
                    
                    oreGiorno.forEach(ora => {
                        if (ora.orarioInizio) {
                            if (!orarioInizio || ora.orarioInizio < orarioInizio) {
                                orarioInizio = ora.orarioInizio;
                            }
                        }
                        if (ora.orarioFine) {
                            if (!orarioFine || ora.orarioFine > orarioFine) {
                                orarioFine = ora.orarioFine;
                            }
                        }
                        pauseTotali += ora.pauseMinuti || 0;
                        oreNetteTotali += ora.oreNette || 0;
                        if (ora.operaioId) {
                            operaiSet.add(ora.operaioId);
                        }
                    });
                    
                    if (!orarioInizio || !orarioFine) return;
                    
                    const terreno = terreniMap.get(lavoro.terrenoId);
                    const terrenoNome = terreno ? terreno.nome : 'Terreno non trovato';
                    const coltura = terreno ? terreno.coltura : '';
                    
                    const attivitaKey = `${dataKey}-${lavoroId}`;
                    
                    attivitaMap.set(attivitaKey, {
                        data: new Date(dataKey),
                        dataKey: dataKey,
                        lavoroId: lavoroId,
                        lavoroNome: lavoro.nome || 'Lavoro senza nome',
                        terrenoId: lavoro.terrenoId,
                        terrenoNome: terrenoNome,
                        tipoLavoro: lavoro.tipoLavoro || 'Non specificato',
                        coltura: coltura,
                        orarioInizio: orarioInizio,
                        orarioFine: orarioFine,
                        pauseMinuti: pauseTotali,
                        oreNette: oreNetteTotali,
                        numOperai: operaiSet.size,
                        clienteId: lavoro.clienteId || null,
                        note: `Lavoro: ${lavoro.nome || 'Senza nome'} - ${operaiSet.size} operaio${operaiSet.size !== 1 ? 'i' : ''}`
                    });
                });
            } catch (error) {
                console.warn(`Errore caricamento ore per lavoro ${lavoroId}:`, error);
            }
        }
        
        const attivitaArray = Array.from(attivitaMap.values());
        attivitaArray.sort((a, b) => {
            if (!a.data || !b.data) return 0;
            return b.data.getTime() - a.data.getTime();
        });
        
        if (attivitaArray.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📋</div>
                    <div style="font-size: 18px; margin-bottom: 10px;">Nessuna attività generata</div>
                    <div style="font-size: 14px; color: #999;">
                        Le attività verranno generate automaticamente quando ci saranno ore validate dai caposquadra.
                    </div>
                </div>
            `;
            return;
        }
        
        const attivitaMostrate = attivitaArray.slice(0, 20);
        
        let html = `
            <style>
                .lavoro-conto-terzi-dashboard {
                    background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%) !important;
                    border-left: 4px solid #1976D2;
                }
                .lavoro-conto-terzi-dashboard:hover {
                    background: linear-gradient(135deg, #BBDEFB 0%, #90CAF9 100%) !important;
                }
            </style>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Data</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Terreno</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Tipo Lavoro</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Coltura</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Orario</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Ore</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Operai</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Lavoro</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        attivitaMostrate.forEach(att => {
            const dataFormatted = att.data.toLocaleDateString('it-IT', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
            });
            const oreFormatted = formattaOre(att.oreNette);
            const isContoTerzi = !!att.clienteId;
            const rowClass = isContoTerzi ? 'lavoro-conto-terzi-dashboard' : '';
            
            html += `
                <tr class="${rowClass}" style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 12px;">${dataFormatted}</td>
                    <td style="padding: 12px;">${escapeHtml(att.terrenoNome)}</td>
                    <td style="padding: 12px;">${escapeHtml(att.tipoLavoro)}</td>
                    <td style="padding: 12px;">${escapeHtml(att.coltura)}</td>
                    <td style="padding: 12px;">${att.orarioInizio} - ${att.orarioFine}</td>
                    <td style="padding: 12px;">${oreFormatted}</td>
                    <td style="padding: 12px;">${att.numOperai}</td>
                    <td style="padding: 12px;">${escapeHtml(att.lavoroNome)}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento diario da lavori:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc3545;">
                <div style="font-size: 18px; margin-bottom: 10px;">Errore caricamento attività</div>
            </div>
        `;
    }
}

// ============================================
// CAPOSQUADRA
// ============================================

/**
 * Carica statistiche caposquadra
 * @param {Object} userData - Dati utente
 * @param {Object} dependencies - Dipendenze { db, auth, getDoc, doc, collection, getDocs, query, where }
 */
export async function loadCaposquadraStats(userData, dependencies) {
    const { db, auth, getDoc, doc, collection, getDocs, query, where } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user || !userData) return;
        
        const tenantId = userData.tenantId;
        if (!tenantId) return;
        
        const caposquadraId = userData.id || user.uid;
        
        const lavoriRef = collection(db, `tenants/${tenantId}/lavori`);
        const lavoriQuery = query(lavoriRef, where('caposquadraId', '==', caposquadraId));
        const lavoriSnapshot = await getDocs(lavoriQuery);
        
        let lavoriAssegnati = 0;
        const lavoriIds = [];
        
        lavoriSnapshot.forEach(doc => {
            const lavoro = doc.data();
            const stato = lavoro.stato || 'assegnato';
            if (stato !== 'completato' && stato !== 'annullato' && stato !== 'completato_da_approvare') {
                lavoriAssegnati++;
            }
            lavoriIds.push(doc.id);
        });
        
        let oreDaValidare = 0;
        for (const lavoroId of lavoriIds) {
            try {
                const oreRef = collection(db, `tenants/${tenantId}/lavori/${lavoroId}/oreOperai`);
                const oreQuery = query(oreRef, where('stato', '==', 'da_validare'));
                const oreSnapshot = await getDocs(oreQuery);
                oreDaValidare += oreSnapshot.size;
            } catch (error) {
                console.warn(`Errore caricamento ore per lavoro ${lavoroId}:`, error);
            }
        }
        
        let dimensioneSquadra = 0;
        try {
            const squadreRef = collection(db, `tenants/${tenantId}/squadre`);
            const squadreQuery = query(squadreRef, where('caposquadraId', '==', caposquadraId));
            const squadreSnapshot = await getDocs(squadreQuery);
            
            if (!squadreSnapshot.empty) {
                const squadraDoc = squadreSnapshot.docs[0];
                const squadraData = squadraDoc.data();
                dimensioneSquadra = squadraData.operai ? squadraData.operai.length : 0;
            }
        } catch (error) {
            console.warn('Errore caricamento squadra:', error);
        }
        
        const statLavori = document.getElementById('stat-lavori-assegnati-capo');
        const statOre = document.getElementById('stat-ore-da-validare-capo');
        const statSquadra = document.getElementById('stat-squadra-capo');
        
        if (statLavori) statLavori.textContent = lavoriAssegnati;
        if (statOre) statOre.textContent = oreDaValidare;
        if (statSquadra) statSquadra.textContent = dimensioneSquadra;
    } catch (error) {
        console.error('Errore caricamento statistiche caposquadra:', error);
    }
}

/**
 * Carica lavori recenti per caposquadra
 * @param {Object} userData - Dati utente
 * @param {Object} dependencies - Dipendenze { db, auth, getDoc, doc, collection, getDocs, query, where, escapeHtml }
 */
export async function loadRecentLavoriCaposquadra(userData, dependencies) {
    const { db, auth, getDoc, doc, collection, getDocs, query, where, escapeHtml } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user || !userData) return;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        
        const tenantId = userData.tenantId;
        if (!tenantId) return;
        
        const caposquadraId = userData.id || user.uid;
        
        const lavoriRef = collection(db, `tenants/${tenantId}/lavori`);
        const lavoriQuery = query(lavoriRef, where('caposquadraId', '==', caposquadraId));
        const lavoriSnapshot = await getDocs(lavoriQuery);
        
        const recentLavoriEl = document.getElementById('recent-lavori-capo');
        if (!recentLavoriEl) return;
        
        if (lavoriSnapshot.empty) {
            recentLavoriEl.innerHTML = `
                <li class="recent-item">
                    <div>
                        <div class="recent-item-title">Nessun lavoro assegnato</div>
                    </div>
                </li>
            `;
            return;
        }
        
        const lavoriArray = [];
        lavoriSnapshot.forEach(doc => {
            const lavoro = doc.data();
            lavoriArray.push({
                id: doc.id,
                nome: lavoro.nome || 'Senza nome',
                stato: lavoro.stato || 'assegnato',
                createdAt: lavoro.createdAt || lavoro.creatoIl
            });
        });
        
        lavoriArray.sort((a, b) => {
            if (a.createdAt && b.createdAt) {
                const dateA = a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
                const dateB = b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
                return dateB - dateA;
            }
            return 0;
        });
        
        const lavoriRecenti = lavoriArray.slice(0, 5);
        
        if (lavoriRecenti.length === 0) {
            recentLavoriEl.innerHTML = `
                <li class="recent-item">
                    <div>
                        <div class="recent-item-title">Nessun lavoro recente</div>
                    </div>
                </li>
            `;
            return;
        }
        
        const statoLabels = {
            'assegnato': '📋 Assegnato',
            'in_corso': '🔄 In corso',
            'completato': '✅ Completato',
            'completato_da_approvare': '⏳ In attesa approvazione',
            'annullato': '❌ Annullato'
        };
        
        let html = '';
        lavoriRecenti.forEach(lavoro => {
            const statoLabel = statoLabels[lavoro.stato] || lavoro.stato;
            html += `
                <li class="recent-item">
                    <div>
                        <div class="recent-item-title">${escapeHtml(lavoro.nome)}</div>
                        <div class="recent-item-meta">${statoLabel}</div>
                    </div>
                </li>
            `;
        });
        
        recentLavoriEl.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento lavori recenti caposquadra:', error);
        const recentLavoriEl = document.getElementById('recent-lavori-capo');
        if (recentLavoriEl) {
            recentLavoriEl.innerHTML = `
                <li class="recent-item">
                    <div>
                        <div class="recent-item-title">Errore caricamento lavori</div>
                    </div>
                </li>
            `;
        }
    }
}

// ============================================
// OPERAIO
// ============================================

/**
 * Carica comunicazioni per operaio
 * @param {Object} userData - Dati utente
 * @param {Object} dependencies - Dipendenze { db, auth, collection, getDocs, query, where, escapeHtml }
 */
export async function loadComunicazioniOperaio(userData, dependencies) {
    const { db, auth, collection, getDocs, query, where, escapeHtml } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user || !userData || !userData.tenantId) return;
        
        const comunicazioniCollection = collection(db, `tenants/${userData.tenantId}/comunicazioni`);
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        
        const q = query(
            comunicazioniCollection,
            where('stato', '==', 'attiva')
        );
        const querySnapshot = await getDocs(q);
        
        const container = document.getElementById('comunicazioni-operaio-list');
        if (!container) return;
        
        const comunicazioniAttive = [];
        querySnapshot.forEach(docSnap => {
            const comm = docSnap.data();
            const dataCom = comm.data?.toDate ? comm.data.toDate() : new Date(comm.data);
            
            const destinatari = comm.destinatari || [];
            if (destinatari.includes(user.uid)) {
                if (dataCom >= oggi) {
                    const haConfermato = comm.conferme?.some(c => c.userId === user.uid) || false;
                    comunicazioniAttive.push({
                        id: docSnap.id,
                        ...comm,
                        dataCom: dataCom,
                        haConfermato: haConfermato
                    });
                }
            }
        });
        
        comunicazioniAttive.sort((a, b) => a.dataCom - b.dataCom);
        
        if (comunicazioniAttive.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666; background: #f8f9fa; border-radius: 8px;">
                    Nessuna comunicazione attiva
                </div>
            `;
            return;
        }
        
        container.innerHTML = comunicazioniAttive.map(comm => {
            const dataFormatted = comm.dataCom.toLocaleDateString('it-IT', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const oraFormatted = comm.orario || '07:00';
            
            const confermaButton = comm.haConfermato ? 
                '<button class="btn btn-success" disabled style="background: #28a745; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: not-allowed;">✅ Confermato</button>' :
                `<button class="btn btn-primary" onclick="confermaComunicazione('${comm.id}')" style="background: #2E8B57; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;">✓ Conferma Ricezione</button>`;
            
            const linkMaps = comm.coordinatePodere ? 
                `<a href="https://www.google.com/maps/dir/?api=1&destination=${comm.coordinatePodere.lat},${comm.coordinatePodere.lng}" target="_blank" style="color: #2E8B57; text-decoration: none; font-size: 14px; margin-left: 10px;">📍 Indicazioni</a>` : '';
            
            return `
                <div style="background: white; border: 2px solid ${comm.haConfermato ? '#28a745' : '#ffc107'}; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <div style="flex: 1;">
                            <div style="font-size: 18px; font-weight: 600; color: #2E8B57; margin-bottom: 8px;">
                                📍 ${escapeHtml(comm.podere)} - ${escapeHtml(comm.terreno)}
                            </div>
                            <div style="font-size: 14px; color: #666; margin-bottom: 5px;">
                                📅 <strong>${dataFormatted}</strong> alle <strong>${oraFormatted}</strong>
                            </div>
                            <div style="font-size: 13px; color: #999; margin-top: 5px;">
                                Da: ${escapeHtml(comm.caposquadraNome || 'Caposquadra')}
                            </div>
                            ${comm.note ? `<div style="font-size: 13px; color: #666; margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px;">${escapeHtml(comm.note)}</div>` : ''}
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid #e9ecef;">
                        ${confermaButton}
                        ${linkMaps}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Errore caricamento comunicazioni operaio:', error);
        const container = document.getElementById('comunicazioni-operaio-list');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #dc3545; background: #f8d7da; border-radius: 8px;">
                    Errore caricamento comunicazioni
                </div>
            `;
        }
    }
}

/**
 * Carica lavori di oggi per operaio (diretti + squadra)
 * @param {Object} userData - Dati utente
 * @param {Object} dependencies - Dipendenze { db, auth, collection, getDocs, escapeHtml }
 */
export async function loadLavoriOggiOperaio(userData, dependencies) {
    const { db, auth, collection, getDocs, escapeHtml } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user || !userData || !userData.tenantId) return;
        
        const operaioId = userData.id || user.uid;
        const tenantId = userData.tenantId;
        
        const terreniRef = collection(db, `tenants/${tenantId}/terreni`);
        const terreniSnapshot = await getDocs(terreniRef);
        const terreniMap = new Map();
        terreniSnapshot.forEach(doc => {
            terreniMap.set(doc.id, doc.data());
        });
        
        const lavoriRef = collection(db, `tenants/${tenantId}/lavori`);
        const lavoriSnapshot = await getDocs(lavoriRef);
        
        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        
        const lavoriOggi = [];
        const lavoriIdsSet = new Set();
        
        // LAVORI DIRETTI
        lavoriSnapshot.forEach(doc => {
            const lavoro = doc.data();
            if (lavoro.operaioId === operaioId && !lavoro.caposquadraId) {
                const stato = lavoro.stato || 'assegnato';
                if (stato !== 'completato' && stato !== 'annullato' && stato !== 'completato_da_approvare') {
                    const dataInizio = lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date(lavoro.dataInizio);
                    const dataInizioSenzaOra = new Date(dataInizio);
                    dataInizioSenzaOra.setHours(0, 0, 0, 0);
                    
                    const deveMostrare = (stato === 'assegnato') || (dataInizioSenzaOra <= oggi);
                    
                    if (deveMostrare) {
                        const terreno = lavoro.terrenoId ? terreniMap.get(lavoro.terrenoId) : null;
                        const terrenoNome = terreno ? terreno.nome : null;
                        
                        lavoriOggi.push({
                            id: doc.id,
                            ...lavoro,
                            dataInizio: dataInizio,
                            tipoAssegnazione: 'autonomo',
                            terreno: terrenoNome
                        });
                        lavoriIdsSet.add(doc.id);
                    }
                }
            }
        });
        
        // LAVORI DI SQUADRA
        const squadreRef = collection(db, `tenants/${tenantId}/squadre`);
        const squadreSnapshot = await getDocs(squadreRef);
        
        let caposquadraId = null;
        squadreSnapshot.forEach(doc => {
            const squadra = doc.data();
            if (squadra.operai && squadra.operai.includes(operaioId)) {
                caposquadraId = squadra.caposquadraId;
            }
        });
        
        if (caposquadraId) {
            lavoriSnapshot.forEach(doc => {
                if (lavoriIdsSet.has(doc.id)) return;
                
                const lavoro = doc.data();
                if (lavoro.caposquadraId === caposquadraId && !lavoro.operaioId) {
                    const stato = lavoro.stato || 'assegnato';
                    if (stato !== 'completato' && stato !== 'annullato' && stato !== 'completato_da_approvare') {
                        const dataInizio = lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date(lavoro.dataInizio);
                        const dataInizioSenzaOra = new Date(dataInizio);
                        dataInizioSenzaOra.setHours(0, 0, 0, 0);
                        
                        const deveMostrare = (stato === 'assegnato') || (dataInizioSenzaOra <= oggi);
                        
                        if (deveMostrare) {
                            const terreno = lavoro.terrenoId ? terreniMap.get(lavoro.terrenoId) : null;
                            const terrenoNome = terreno ? terreno.nome : null;
                            
                            lavoriOggi.push({
                                id: doc.id,
                                ...lavoro,
                                dataInizio: dataInizio,
                                tipoAssegnazione: 'squadra',
                                terreno: terrenoNome
                            });
                            lavoriIdsSet.add(doc.id);
                        }
                    }
                }
            });
        }
        
        lavoriOggi.sort((a, b) => {
            const dateA = a.dataInizio instanceof Date ? a.dataInizio : new Date(a.dataInizio);
            const dateB = b.dataInizio instanceof Date ? b.dataInizio : new Date(b.dataInizio);
            return dateB - dateA;
        });
        
        const statElement = document.getElementById('stat-lavori-oggi-operaio');
        if (statElement) {
            statElement.textContent = lavoriOggi.length;
        }
        
        const container = document.getElementById('lavori-oggi-operaio');
        if (!container) return;
        
        if (lavoriOggi.length === 0) {
            let message = 'Nessun lavoro assegnato per oggi';
            if (!caposquadraId && lavoriOggi.length === 0) {
                message = 'Nessun lavoro assegnato. Contatta il manager per essere assegnato a una squadra o per ricevere lavori autonomi.';
            }
            
            container.innerHTML = `
                <li class="recent-item">
                    <div>
                        <div class="recent-item-title">${message}</div>
                    </div>
                </li>
            `;
            return;
        }
        
        container.innerHTML = lavoriOggi.slice(0, 5).map(lavoro => {
            const dataFormatted = lavoro.dataInizio.toLocaleDateString('it-IT', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
            });
            const statoLabel = {
                'assegnato': 'Assegnato',
                'in_corso': 'In Corso',
                'completato': 'Completato',
                'completato_da_approvare': 'In attesa approvazione'
            }[lavoro.stato] || lavoro.stato;
            
            const tipoBadge = lavoro.tipoAssegnazione === 'autonomo' 
                ? '<span style="background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 5px;">Autonomo</span>'
                : '<span style="background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 5px;">Squadra</span>';
            
            const checkboxCompletato = lavoro.tipoAssegnazione === 'autonomo' && 
                lavoro.stato !== 'completato' && 
                lavoro.stato !== 'completato_da_approvare' && 
                lavoro.stato !== 'annullato'
                ? `
                    <div style="margin-top: 8px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #666;">
                            <input type="checkbox" 
                                   class="checkbox-completato-lavoro" 
                                   data-lavoro-id="${lavoro.id}"
                                   ${lavoro.stato === 'completato_da_approvare' ? 'checked disabled' : ''}
                                   onchange="segnaLavoroCompletato('${lavoro.id}', this.checked)">
                            <span>Segna come completato</span>
                        </label>
                    </div>
                `
                : lavoro.stato === 'completato_da_approvare'
                ? '<div style="margin-top: 8px; color: #ffc107; font-size: 12px;">⏳ In attesa approvazione Manager</div>'
                : lavoro.stato === 'completato'
                ? '<div style="margin-top: 8px; color: #4CAF50; font-size: 12px;">✅ Completato</div>'
                : '';
            
            return `
                <li class="recent-item">
                    <div style="width: 100%;">
                        <div class="recent-item-title">
                            ${escapeHtml(lavoro.nome || 'Lavoro senza nome')}
                            ${tipoBadge}
                        </div>
                        <div class="recent-item-description">
                            ${escapeHtml(lavoro.terreno || 'Terreno non specificato')} • ${dataFormatted} • ${statoLabel}
                        </div>
                        ${checkboxCompletato}
                    </div>
                </li>
            `;
        }).join('');
    } catch (error) {
        console.error('Errore caricamento lavori oggi operaio:', error);
    }
}

/**
 * Carica statistiche ore operaio
 * @param {Object} userData - Dati utente
 * @param {Object} dependencies - Dipendenze { db, auth, collection, getDocs, query, where, escapeHtml }
 */
export async function loadStatisticheOreOperaio(userData, dependencies) {
    const { db, auth, collection, getDocs, query, where, escapeHtml } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user || !userData || !userData.tenantId) return;
        
        const operaioId = userData.id || user.uid;
        const tenantId = userData.tenantId;
        
        const lavoriRef = collection(db, `tenants/${tenantId}/lavori`);
        const lavoriSnapshot = await getDocs(lavoriRef);
        
        let totaleOreMinuti = 0;
        let oreValidate = 0;
        let oreDaValidare = 0;
        let oreRifiutate = 0;
        const oreRecenti = [];
        
        for (const lavoroDoc of lavoriSnapshot.docs) {
            const lavoroId = lavoroDoc.id;
            
            try {
                const oreRef = collection(db, `tenants/${tenantId}/lavori/${lavoroId}/oreOperai`);
                const oreQuery = query(oreRef, where('operaioId', '==', operaioId));
                const oreSnapshot = await getDocs(oreQuery);
                
                oreSnapshot.forEach(oraDoc => {
                    const ora = oraDoc.data();
                    const oreNette = ora.oreNette || 0;
                    const stato = ora.stato || 'da_validare';
                    
                    const oreMinuti = Math.round(oreNette * 60);
                    totaleOreMinuti += oreMinuti;
                    
                    if (stato === 'validate') {
                        oreValidate += oreMinuti;
                    } else if (stato === 'da_validare') {
                        oreDaValidare += oreMinuti;
                    } else if (stato === 'rifiutate') {
                        oreRifiutate += oreMinuti;
                    }
                    
                    const dataOra = ora.data?.toDate ? ora.data.toDate() : new Date(ora.data);
                    oreRecenti.push({
                        id: oraDoc.id,
                        lavoroId: lavoroId,
                        lavoroNome: lavoroDoc.data().nome || 'Lavoro',
                        data: dataOra,
                        oreNette: oreNette,
                        stato: stato,
                        note: ora.note || ''
                    });
                });
            } catch (error) {
                console.warn(`Errore caricamento ore per lavoro ${lavoroId}:`, error);
            }
        }
        
        const oreTotali = Math.floor(totaleOreMinuti / 60);
        const minutiTotali = totaleOreMinuti % 60;
        const oreFormatted = minutiTotali === 0 ? `${oreTotali}h` : `${oreTotali}h ${minutiTotali}min`;
        
        document.getElementById('stat-ore-segnate-operaio').textContent = oreFormatted;
        
        let statoLabel = 'In attesa';
        if (oreDaValidare > 0) {
            statoLabel = 'Da validare';
        } else if (oreValidate > 0) {
            statoLabel = 'Validate';
        }
        document.getElementById('stat-stato-operaio').textContent = statoLabel;
        
        oreRecenti.sort((a, b) => b.data - a.data);
        
        const container = document.getElementById('mie-ore-operaio-section');
        if (!container) return;
        
        if (oreRecenti.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666; background: #f8f9fa; border-radius: 8px;">
                    Nessuna ora segnata ancora
                </div>
            `;
            return;
        }
        
        const oreValidateFormatted = Math.floor(oreValidate / 60) + 'h ' + (oreValidate % 60) + 'min';
        const oreDaValidareFormatted = Math.floor(oreDaValidare / 60) + 'h ' + (oreDaValidare % 60) + 'min';
        const oreRifiutateFormatted = Math.floor(oreRifiutate / 60) + 'h ' + (oreRifiutate % 60) + 'min';
        
        let html = `
            <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h4 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Riepilogo Ore</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 15px; background: #e8f5e9; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: 600; color: #2e7d32;">${oreValidateFormatted}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">Validate</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #fff3e0; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: 600; color: #f57c00;">${oreDaValidareFormatted}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">Da Validare</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #ffebee; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: 600; color: #c62828;">${oreRifiutateFormatted}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">Rifiutate</div>
                    </div>
                </div>
            </div>
            
            <h4 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Ultime Ore Segnate</h4>
            <ul class="recent-items">
        `;
        
        oreRecenti.slice(0, 5).forEach(ora => {
            const dataFormatted = ora.data.toLocaleDateString('it-IT', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
            });
            const oreFormatted = Math.floor(ora.oreNette) + 'h ' + Math.round((ora.oreNette % 1) * 60) + 'min';
            const statoBadge = {
                'validate': '<span style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px;">✅ Validate</span>',
                'da_validare': '<span style="background: #ff9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px;">⏳ Da validare</span>',
                'rifiutate': '<span style="background: #f44336; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px;">❌ Rifiutate</span>'
            }[ora.stato] || '';
            
            html += `
                <li class="recent-item">
                    <div>
                        <div class="recent-item-title">${escapeHtml(ora.lavoroNome)} ${statoBadge}</div>
                        <div class="recent-item-description">
                            ${dataFormatted} • ${oreFormatted}${ora.note ? ' • ' + escapeHtml(ora.note) : ''}
                        </div>
                    </div>
                </li>
            `;
        });
        
        html += '</ul>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento statistiche ore operaio:', error);
        const container = document.getElementById('mie-ore-operaio-section');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #dc3545; background: #f8d7da; border-radius: 8px;">
                    Errore caricamento statistiche ore
                </div>
            `;
        }
    }
}

// ============================================
// CAPOSQUADRA - COMUNICAZIONE RAPIDA
// ============================================

// Variabile globale per lavori attivi caposquadra (necessaria per comunicazione rapida)
// Esposta globalmente per compatibilità con attributi HTML onclick/onchange
window.lavoriAttiviCaposquadra = [];

/**
 * Carica comunicazione rapida
 * @param {Object} userData - Dati utente
 * @param {Object} dependencies - Dipendenze { db, auth, collection, getDocs, query, where, escapeHtml, loadDettagliTerreniPerLavori, renderComunicazioneRapidaForm }
 */
export async function loadComunicazioneRapida(userData, dependencies) {
    const { db, auth, collection, getDocs, query, where, escapeHtml } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user || !userData || !userData.tenantId) return;
        
        const caposquadraId = userData.id || user.uid;
        
        const lavoriCollection = collection(db, `tenants/${userData.tenantId}/lavori`);
        const q = query(
            lavoriCollection,
            where('caposquadraId', '==', caposquadraId)
        );
        const querySnapshot = await getDocs(q);
        
        window.lavoriAttiviCaposquadra = [];
        querySnapshot.forEach((docSnap) => {
            const lavoro = docSnap.data();
            const stato = lavoro.stato || 'assegnato';
            
            if (stato !== 'completato' && stato !== 'annullato' && stato !== 'completato_da_approvare') {
                window.lavoriAttiviCaposquadra.push({
                    id: docSnap.id,
                    ...lavoro
                });
            }
        });
        
        const container = document.getElementById('comunicazione-rapida-content');
        if (!container) return;
        
        if (window.lavoriAttiviCaposquadra.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <p style="margin-bottom: 10px;">Nessun lavoro attivo disponibile.</p>
                    <p style="font-size: 14px; color: #999;">Usa la <a href="admin/impostazioni-standalone.html" style="color: #2E8B57;">versione completa nelle Impostazioni</a> per inviare comunicazioni personalizzate.</p>
                </div>
            `;
            return;
        }
        
        await loadDettagliTerreniPerLavori(userData.tenantId, dependencies);
        
        // Renderizza form (la funzione renderComunicazioneRapidaForm deve essere disponibile globalmente)
        // È definita nel file HTML originale, quindi la chiamiamo se disponibile
        if (typeof window.renderComunicazioneRapidaForm === 'function') {
            window.renderComunicazioneRapidaForm();
        }
    } catch (error) {
        console.error('Errore caricamento comunicazione rapida:', error);
        const container = document.getElementById('comunicazione-rapida-content');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #dc3545;">
                    Errore caricamento lavori
                </div>
            `;
        }
    }
}

/**
 * Carica dettagli terreni per i lavori
 * @param {string} tenantId - ID tenant
 * @param {Object} dependencies - Dipendenze { db, collection, getDocs }
 */
export async function loadDettagliTerreniPerLavori(tenantId, dependencies) {
    const { db, collection, getDocs } = dependencies;
    
    try {
        const terreniCollection = collection(db, `tenants/${tenantId}/terreni`);
        const querySnapshot = await getDocs(terreniCollection);
        
        const terreniMap = {};
        querySnapshot.forEach((docSnap) => {
            terreniMap[docSnap.id] = docSnap.data();
        });
        
        window.lavoriAttiviCaposquadra.forEach(lavoro => {
            if (lavoro.terrenoId && terreniMap[lavoro.terrenoId]) {
                lavoro.terreno = terreniMap[lavoro.terrenoId];
            }
        });
    } catch (error) {
        console.error('Errore caricamento terreni:', error);
    }
}

/**
 * Escape caratteri HTML per sicurezza
 * @param {string} text - Testo da escapare
 * @returns {string} Testo escapato
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Carica comunicazioni inviate dal caposquadra per la dashboard
 * @param {Object} userData - Dati utente
 * @param {Object} dependencies - Dipendenze { db, auth, collection, getDocs, query, where, escapeHtml }
 */
export async function loadComunicazioniInviateCaposquadra(userData, dependencies) {
    const { db, auth, collection, getDocs, query, where, escapeHtml } = dependencies;
    
    try {
        const user = auth.currentUser;
        if (!user || !userData || !userData.tenantId) return;
        
        const caposquadraId = userData.id || user.uid;
        const comunicazioniCollection = collection(db, `tenants/${userData.tenantId}/comunicazioni`);
        const q = query(
            comunicazioniCollection,
            where('caposquadraId', '==', caposquadraId)
        );
        const querySnapshot = await getDocs(q);
        
        // Converti in array e ordina per createdAt in memoria
        const comunicazioniArray = [];
        querySnapshot.forEach((docSnap) => {
            const comm = docSnap.data();
            comunicazioniArray.push({
                id: docSnap.id,
                ...comm,
                createdAtValue: comm.createdAt?.toDate ? comm.createdAt.toDate() : new Date(comm.createdAt || 0)
            });
        });
        
        // Ordina per data creazione (più recenti prima) - mostra solo l'ultima
        comunicazioniArray.sort((a, b) => {
            const dateA = a.createdAtValue || new Date(0);
            const dateB = b.createdAtValue || new Date(0);
            return dateB - dateA; // Ordine decrescente
        });
        
        const container = document.getElementById('comunicazioni-inviate-content');
        if (!container) return;
        
        if (comunicazioniArray.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 15px; color: #666; font-size: 14px;">
                    Nessuna comunicazione inviata ancora.
                </div>
            `;
            return;
        }
        
        // Mostra solo l'ultima comunicazione
        const comm = comunicazioniArray[0];
        const dataCom = comm.data?.toDate ? comm.data.toDate() : new Date(comm.data);
        const dataFormatted = dataCom.toLocaleDateString('it-IT', { 
            day: 'numeric',
            month: 'short'
        });
        const oraFormatted = comm.orario || '07:00';
        
        const numDestinatari = comm.destinatari?.length || 0;
        const numConferme = comm.conferme?.length || 0;
        const percentualeConferme = numDestinatari > 0 ? Math.round((numConferme / numDestinatari) * 100) : 0;
        
        // Colore in base alla percentuale di conferme
        let confermeColor = '#dc3545'; // Rosso se < 50%
        if (percentualeConferme === 100) {
            confermeColor = '#28a745'; // Verde se 100%
        } else if (percentualeConferme >= 50) {
            confermeColor = '#ffc107'; // Giallo se >= 50%
        }
        
        const statoBadge = comm.stato === 'attiva' ? 
            '<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Attiva</span>' :
            '<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Completata</span>';
        
        let htmlContent = `
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #2E8B57; font-size: 14px; margin-bottom: 4px;">
                            ${escapeHtml(comm.podere)} - ${escapeHtml(comm.terreno)}
                        </div>
                        <div style="font-size: 12px; color: #666;">
                            📅 ${dataFormatted} alle ${oraFormatted}
                        </div>
                    </div>
                    ${statoBadge}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #f0f0f0;">
                    <div style="font-size: 12px; color: ${confermeColor}; font-weight: 500;">
                        ✅ Conferme: ${numConferme}/${numDestinatari} (${percentualeConferme}%)
                    </div>
                    ${comm.coordinatePodere ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${comm.coordinatePodere.lat},${comm.coordinatePodere.lng}" target="_blank" style="color: #2E8B57; text-decoration: none; font-size: 11px;">📍 Mappa</a>` : ''}
                </div>
            </div>
        `;
        
        // Aggiungi link per vedere tutte le comunicazioni se ce ne sono più di una
        if (comunicazioniArray.length > 1) {
            htmlContent += `
                <div style="text-align: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e9ecef;">
                    <a href="admin/impostazioni-standalone.html" style="color: #2E8B57; text-decoration: none; font-size: 13px; font-weight: 500;">
                        Vedi tutte le comunicazioni (${comunicazioniArray.length}) →
                    </a>
                </div>
            `;
        }
        
        container.innerHTML = htmlContent;
    } catch (error) {
        console.error('Errore caricamento comunicazioni inviate:', error);
        const container = document.getElementById('comunicazioni-inviate-content');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 15px; color: #dc3545; font-size: 14px;">
                    Errore caricamento comunicazioni.
                </div>
            `;
        }
    }
}

/**
 * Renderizza il form di comunicazione rapida
 * Questa funzione crea il form HTML per inviare comunicazioni rapide alla squadra
 * Pre-compila automaticamente podere, campo e lavoro dal primo lavoro attivo
 */
export function renderComunicazioneRapidaForm() {
    const container = document.getElementById('comunicazione-rapida-content');
    if (!container) return;
    
    const lavori = window.lavoriAttiviCaposquadra || [];
    
    if (lavori.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <p style="margin-bottom: 10px;">Nessun lavoro attivo disponibile.</p>
                <p style="font-size: 14px; color: #999;">Usa la <a href="admin/impostazioni-standalone.html" style="color: #2E8B57;">versione completa nelle Impostazioni</a> per inviare comunicazioni personalizzate.</p>
            </div>
        `;
        return;
    }
    
    // Prendi il primo lavoro come default
    const primoLavoro = lavori[0];
    const podere = primoLavoro.terreno?.podere || 'Non specificato';
    const terrenoNome = primoLavoro.terreno?.nome || primoLavoro.nome || 'Non specificato';
    const lavoroNome = primoLavoro.nome || 'Senza nome';
    
    // Se c'è più di un lavoro, mostra dropdown, altrimenti solo il nome
    const lavoroSelectHTML = lavori.length > 1 ? `
        <div style="margin-bottom: 15px;">
            <label for="rapida-lavoro-select" style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Seleziona Lavoro</label>
            <select id="rapida-lavoro-select" onchange="handleRapidaLavoroChange()" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                ${lavori.map(l => `<option value="${l.id}" ${l.id === primoLavoro.id ? 'selected' : ''}>${escapeHtml(l.nome || 'Senza nome')}</option>`).join('')}
            </select>
        </div>
    ` : `
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Lavoro</label>
            <div id="rapida-lavoro-nome" style="padding: 10px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; color: #333;">${escapeHtml(lavoroNome)}</div>
        </div>
    `;
    
    container.innerHTML = `
        <form id="form-comunicazione-rapida" onsubmit="handleSendComunicazioneRapida(event)" style="display: flex; flex-direction: column; gap: 15px;">
            ${lavoroSelectHTML}
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Podere</label>
                    <div id="rapida-podere" style="padding: 10px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; color: #666;">${escapeHtml(podere)}</div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Campo/Terreno</label>
                    <div id="rapida-terreno" style="padding: 10px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; color: #666;">${escapeHtml(terrenoNome)}</div>
                </div>
            </div>
            
            <div>
                <label for="rapida-orario" style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Orario di Ritrovo *</label>
                <input type="time" id="rapida-orario" value="07:00" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
            </div>
            
            <div>
                <label for="rapida-note" style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Note (opzionale)</label>
                <textarea id="rapida-note" placeholder="Aggiungi note o istruzioni per la squadra..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; min-height: 80px; resize: vertical; font-family: inherit;"></textarea>
            </div>
            
            <div id="rapida-message"></div>
            
            <button type="submit" style="background: #2E8B57; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-size: 16px; font-weight: 500; cursor: pointer; transition: background 0.2s;">
                📢 Invia Comunicazione
            </button>
        </form>
    `;
}

/**
 * Carica il numero di prodotti sotto scorta minima (modulo Prodotti e Magazzino)
 * Per mostrare l'alert nella dashboard Manager
 * @param {Object} dependencies - db, auth, getDoc, doc, collection, getDocs
 * @returns {Promise<number>} Numero di prodotti sotto scorta minima (0 se modulo non attivo o errore)
 */
export async function loadMagazzinoSottoScortaCount(dependencies) {
    try {
        const { db, auth, getDoc, doc, collection, getDocs } = dependencies;
        const user = auth?.currentUser;
        if (!user) return 0;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return 0;
        const userData = userDoc.data();
        const tenantId = userData.tenantId || (userData.tenantMemberships && Object.keys(userData.tenantMemberships || {})[0]);
        if (!tenantId) return 0;
        const prodottiRef = collection(db, 'tenants', tenantId, 'prodotti');
        const snapshot = await getDocs(prodottiRef);
        let count = 0;
        snapshot.forEach((d) => {
            const data = d.data();
            if (data.attivo === false) return;
            const scortaMinima = data.scortaMinima != null ? parseFloat(data.scortaMinima) : 0;
            if (scortaMinima <= 0) return;
            const giacenza = data.giacenza != null ? parseFloat(data.giacenza) : 0;
            if (giacenza < scortaMinima) count++;
        });
        return count;
    } catch (err) {
        console.warn('loadMagazzinoSottoScortaCount:', err);
        return 0;
    }
}

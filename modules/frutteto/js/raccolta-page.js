/**
 * Pagina Raccolta frutteto.
 * L'HTML in views/ resta la struttura; qui c'è il comportamento.
 * Gli import dinamici via resolvePath restano relativi all'URL della pagina.
 * @module modules/frutteto/js/raccolta-page
 */

import { formatDateLikeToItalianLongLocal } from '../../../core/js/date-format-it.js';
import { getCurrentPositionGeo, geolocationErrorMessage } from '../../../core/js/geo-capture.js';
import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';

try {
    await window.GFVStandaloneReady;
} catch (err) {
    console.error('[raccolta-frutta] Bootstrap failed:', err);
    throw err;
}

// Import servizi modulo frutteto
import { getRaccolte, createRaccolta, updateRaccolta, deleteRaccolta } from '../services/raccolta-frutta-service.js';
import { getFrutteto, getAllFrutteti } from '../services/frutteti-service.js';

// Import dinamici servizi core
const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
const authServiceModule = await import(resolvePath('../../../core/services/auth-service.js'));

const { getAuthInstance, getDb, dateToTimestamp, timestampToDate, onAuthStateChanged, getDoc, doc, collection, query, where, getDocs } = firebaseServiceModule;
const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenantServiceModule;
const { initializeAuthService } = authServiceModule;

let frutteti = [];
let terreni = [];
let allRaccolte = [];
let raccolte = [];
let currentEditing = { fruttetoId: null, raccoltaId: null };
let operai = [];
let macchine = [];
let poligonoCoords = [];
let mappaRaccolta = null;
let poligonoRaccoltaPoly = null;
let terrenoPolygon = null;
let terrenoBoundaryCoords = [];
let currentFruttetoForMap = null;
let isDrawingPolygon = false;
let firstPoint = null;
let posizioneRilevamentoForm = null; // {lat, lng, accuracyMeters, source}

const SNAP_DISTANCE_METERS = 5;
const VERTEX_SNAP_DISTANCE_METERS = 8;

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

window.onFruttetoChange = function() {
    const fruttetoId = document.getElementById('fruttetoId')?.value;
    const specieEl = document.getElementById('specie');
    const varietaEl = document.getElementById('varieta');
    if (!fruttetoId || !specieEl || !varietaEl) return;
    const f = frutteti.find(x => x.id === fruttetoId);
    if (f) {
        specieEl.value = f.specie || '';
        varietaEl.value = f.varieta || '';
    } else {
        specieEl.value = '';
        varietaEl.value = '';
    }
};

window.calcolaResa = function() {
    const q = parseFloat(document.getElementById('quantitaKg')?.value) || 0;
    const ha = parseFloat(document.getElementById('quantitaEttari')?.value) || 0;
    const resaInfo = document.getElementById('resa-info');
    const resaCalcolata = document.getElementById('resa-calcolata');
    if (ha > 0 && q >= 0) {
        const resa = (q / ha).toFixed(2);
        if (resaInfo) resaInfo.style.display = 'block';
        if (resaCalcolata) resaCalcolata.textContent = resa;
    } else {
        if (resaInfo) resaInfo.style.display = 'none';
        if (resaCalcolata) resaCalcolata.textContent = '-';
    }
};

window.aggiornaScartoCategorie = function() {
    const ids = ['scartoDannoFisico', 'scartoCalibroFuoriNorma', 'scartoMarciume', 'scartoMaturazioneNonIdonea', 'scartoAltro'];
    let sum = 0;
    ids.forEach(id => {
        const v = parseFloat(document.getElementById(id)?.value) || 0;
        sum += v;
    });
    const totEl = document.getElementById('scartoTotaleKg');
    if (totEl) {
        if (sum > 0) {
            totEl.value = sum.toFixed(2);
            totEl.readOnly = true;
            totEl.title = 'Totale calcolato dalla somma delle categorie';
        } else {
            totEl.readOnly = false;
            totEl.title = 'Somma automatica dalle categorie sotto, oppure inserisci solo il totale';
        }
    }
};

async function loadMacchine() {
    try {
        const mod = await import(resolvePath('../../../modules/parco-macchine/services/macchine-service.js'));
        macchine = await mod.getAllMacchine();
    } catch (e) {
        macchine = [];
    }
}

window.aggiungiRigaOperaio = function() {
    const tbody = document.getElementById('operai-tabella-body');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = '<td><input type="date" class="input-data-operaio"></td><td><input type="text" placeholder="Nome" class="input-nome-operaio"></td><td><input type="number" step="0.01" min="0" value="0" class="input-ore-operaio"></td><td><button type="button" class="btn btn-danger btn-sm" onclick="this.closest(\'tr\').remove(); aggiornaTotaleOreOperai();">Elimina</button></td>';
    tbody.appendChild(tr);
    tr.querySelector('.input-ore-operaio').addEventListener('input', aggiornaTotaleOreOperai);
    aggiornaTotaleOreOperai();
};

function aggiornaTotaleOreOperai() {
    const tbody = document.getElementById('operai-tabella-body');
    const footer = document.getElementById('operai-tabella-footer');
    if (!tbody) return;
    const righe = tbody.querySelectorAll('tr');
    let tot = 0;
    righe.forEach(r => {
        const inp = r.querySelector('.input-ore-operaio');
        if (inp) tot += parseFloat(inp.value) || 0;
    });
    const totEl = document.getElementById('totale-ore-operai');
    if (totEl) totEl.textContent = tot.toFixed(1);
    if (footer) footer.style.display = righe.length > 0 ? 'table-footer-group' : 'none';
}

function popolaTabellaOperai(operaiData) {
    const tbody = document.getElementById('operai-tabella-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    (operaiData || []).forEach(op => {
        const tr = document.createElement('tr');
        const dataStr = op.data ? (op.data instanceof Date ? op.data.toISOString().slice(0, 10) : op.data) : '';
        tr.innerHTML = '<td><input type="date" class="input-data-operaio" value="' + dataStr + '"></td><td><input type="text" placeholder="Nome" class="input-nome-operaio" value="' + (op.nome || '') + '"></td><td><input type="number" step="0.01" min="0" class="input-ore-operaio" value="' + (op.ore || 0) + '"></td><td><button type="button" class="btn btn-danger btn-sm">Elimina</button></td>';
        tr.querySelector('button').addEventListener('click', function() { tr.remove(); aggiornaTotaleOreOperai(); });
        tr.querySelector('.input-ore-operaio').addEventListener('input', aggiornaTotaleOreOperai);
        tbody.appendChild(tr);
    });
    if (operaiData.length === 0) window.aggiungiRigaOperaio();
    else aggiornaTotaleOreOperai();
}

function popolaTabellaMacchine(macchineData) {
    const tbody = document.getElementById('macchine-tabella-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    (macchineData || []).forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (m.tipo || '-') + '</td><td>' + (m.nome || '-') + '</td><td>' + (m.ore !== undefined ? Number(m.ore).toFixed(2) : '-') + '</td>';
        tbody.appendChild(tr);
    });
}

/**
 * Carica la prima zona chiusa (poligono) tracciata nel lavoro (operaio/caposquadra).
 * Usata per sync: se la raccolta è collegata a un lavoro e non ha ancora poligono, mostra la zona del lavoro.
 * @param {string} lavoroId - ID lavoro
 * @returns {Promise<Array<{lat: number, lng: number}>|null>} Coordinate della prima zona chiusa o null
 */
async function loadPoligonoFromZoneLavorate(lavoroId) {
    const db = getDb();
    const tenantId = getCurrentTenantId();
    if (!tenantId || !lavoroId) return null;
    try {
        const zoneRef = collection(db, 'tenants', tenantId, 'lavori', lavoroId, 'zoneLavorate');
        const snap = await getDocs(zoneRef);
        for (const doc of snap.docs) {
            const data = doc.data();
            if (!data.coordinate || data.coordinate.length < 3) continue;
            const isChiuso = data.isChiuso === true || data.tipo === 'poligono';
            if (!isChiuso) continue;
            const coords = data.coordinate.map(c => {
                const lat = typeof c.lat === 'function' ? c.lat() : (c.lat ?? c._lat);
                const lng = typeof c.lng === 'function' ? c.lng() : (c.lng ?? c._lng);
                return { lat: Number(lat), lng: Number(lng) };
            });
            if (coords.length >= 3) return coords;
        }
    } catch (e) {
        console.warn('[RACCOLTA-FRUTTA] loadPoligonoFromZoneLavorate:', e);
    }
    return null;
}

async function loadDatiLavoro(lavoroId) {
    const db = getDb();
    const tenantId = getCurrentTenantId();
    if (!tenantId || !lavoroId) return null;
    const { getLavoro } = await import(resolvePath('../../../core/services/lavori-service.js'));
    const { getTerreno } = await import(resolvePath('../../../core/services/terreni-service.js'));
    const lavoro = await getLavoro(lavoroId);
    if (!lavoro) return null;
    const linkEl = document.getElementById('link-lavoro');
    if (linkEl) linkEl.href = resolvePath('../../../core/admin/gestione-lavori-standalone.html') + '?lavoroId=' + lavoroId;
    let superficie = null;
    if (lavoro.superficieTotaleLavorata && lavoro.superficieTotaleLavorata > 0) superficie = lavoro.superficieTotaleLavorata;
    else if (lavoro.terrenoId && lavoro.percentualeCompletamento) {
        const terrenoDoc = await getDoc(doc(db, 'tenants/' + tenantId + '/terreni', lavoro.terrenoId));
        if (terrenoDoc.exists()) {
            const supTot = terrenoDoc.data().superficie || 0;
            if (supTot > 0) superficie = (lavoro.percentualeCompletamento / 100) * supTot;
        }
    }
    const oreRef = collection(db, 'tenants/' + tenantId + '/lavori/' + lavoroId + '/oreOperai');
    const q = query(oreRef, where('stato', '==', 'validate'));
    const snap = await getDocs(q);
    const operaiMap = {};
    const macchineMap = {};
    for (const oraDoc of snap.docs) {
        const ora = oraDoc.data();
        if (ora.operaioId) {
            const userDoc = await getDoc(doc(db, 'users', ora.operaioId));
            if (userDoc.exists()) {
                const u = userDoc.data();
                const nome = (u.nome || '') + ' ' + (u.cognome || '').trim() || u.email || ora.operaioId;
                if (!operaiMap[ora.operaioId]) operaiMap[ora.operaioId] = { nome, oreTotali: 0 };
                operaiMap[ora.operaioId].oreTotali += ora.oreNette || 0;
            }
        }
        const oreMac = ora.oreMacchina || 0;
        if (ora.macchinaId && oreMac > 0) {
            const m = macchine.find(x => x.id === ora.macchinaId);
            if (!macchineMap[ora.macchinaId]) macchineMap[ora.macchinaId] = { tipo: 'Trattore', nome: m ? (m.nome || m.marca) : ora.macchinaId, oreTotali: 0 };
            macchineMap[ora.macchinaId].oreTotali += oreMac;
        }
        if (ora.attrezzoId && oreMac > 0) {
            const a = macchine.find(x => x.id === ora.attrezzoId);
            if (!macchineMap[ora.attrezzoId]) macchineMap[ora.attrezzoId] = { tipo: 'Attrezzo', nome: a ? (a.nome || a.marca) : ora.attrezzoId, oreTotali: 0 };
            macchineMap[ora.attrezzoId].oreTotali += oreMac;
        }
    }
    let html = '';
    if (Object.keys(operaiMap).length > 0) {
        html += '<h4 style="margin-top:15px;margin-bottom:10px;">Operai coinvolti</h4><table><thead><tr><th>Nome</th><th>Ore</th></tr></thead><tbody>';
        Object.values(operaiMap).forEach(op => { html += '<tr><td>' + (op.nome || '') + '</td><td>' + (op.oreTotali || 0).toFixed(2) + 'h</td></tr>'; });
        html += '</tbody></table>';
    }
    const macchineList = Object.values(macchineMap);
    if (macchineList.length > 0) {
        html += '<h4 style="margin-top:15px;margin-bottom:10px;">Macchine utilizzate</h4><table><thead><tr><th>Tipo</th><th>Nome</th><th>Ore</th></tr></thead><tbody>';
        macchineList.forEach(m => { html += '<tr><td>' + (m.tipo || '') + '</td><td>' + (m.nome || '') + '</td><td>' + (m.oreTotali || 0).toFixed(2) + 'h</td></tr>'; });
        html += '</tbody></table>';
    }
    const container = document.getElementById('dati-lavoro-tabelle');
    if (container) container.innerHTML = html;
    return superficie;
}

async function caricaMacchinePerRaccolta(raccolta) {
    await loadMacchine();
    let macchineData = [];
    const { getAttivita } = await import(resolvePath('../../../core/services/attivita-service.js'));
    if (raccolta.attivitaId) {
        const att = await getAttivita(raccolta.attivitaId);
        if (att) {
            if (att.macchinaId) {
                const m = macchine.find(x => x.id === att.macchinaId);
                macchineData.push({ tipo: 'Trattore', nome: m ? (m.nome || m.marca) : att.macchinaId, ore: att.oreMacchina || att.oreNette || 0 });
            }
            if (att.attrezzoId) {
                const a = macchine.find(x => x.id === att.attrezzoId);
                macchineData.push({ tipo: 'Attrezzo', nome: a ? (a.nome || a.marca) : att.attrezzoId, ore: att.oreMacchina || att.oreNette || 0 });
            }
        }
    } else if (raccolta.macchine && Array.isArray(raccolta.macchine) && raccolta.macchine.length > 0) {
        raccolta.macchine.forEach(m => {
            if (typeof m === 'object' && m.nome) macchineData.push({ tipo: m.tipo || 'Trattore', nome: m.nome, ore: m.ore || m.oreTotali || 0 });
        });
    }
    popolaTabellaMacchine(macchineData);
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
                        var initTonyContext = function(retries) {
                            retries = retries || 0;
                            if (window.Tony && typeof window.Tony.setContext === 'function') {
                                window.Tony.setContext('dashboard', {
                                    info_azienda: { moduli_attivi: modules },
                                    moduli_attivi: modules
                                });
                                console.log('[Raccolta Frutta] Context Tony inizializzato con moduli:', modules);
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

                await loadFrutteti();
                await loadMacchine();
                populateAnnoFilter();
                setupEventListeners();

                const fruttetoIdFromQuery = getQueryParam('fruttetoId');
                if (fruttetoIdFromQuery) {
                    document.getElementById('filter-frutteto').value = fruttetoIdFromQuery;
                    document.getElementById('fruttetoId').value = fruttetoIdFromQuery;
                }

                await loadRaccolte();

                const openModal = getQueryParam('openModal');
                const raccoltaIdFromQuery = getQueryParam('raccoltaId');
                if (openModal === '1' && raccoltaIdFromQuery && fruttetoIdFromQuery) {
                    openEditRaccolta(fruttetoIdFromQuery, raccoltaIdFromQuery);
                    if (window.history && window.history.replaceState) {
                        const cleanUrl = window.location.pathname + '?fruttetoId=' + encodeURIComponent(fruttetoIdFromQuery);
                        window.history.replaceState({}, '', cleanUrl);
                    }
                }
            } catch (error) {
                console.error('[RACCOLTA-FRUTTA] Errore in onAuthStateChanged:', error);
                alert('Errore nel caricamento dei dati: ' + error.message);
            }
        });
    } catch (error) {
        console.error('[RACCOLTA-FRUTTA] Errore inizializzazione:', error);
        alert('Errore nel caricamento dei dati: ' + error.message);
    }
}

function getTerrenoLabel(t) {
    if (!t) return '';
    const nome = (t.nome || '').trim();
    const podere = (t.podere || '').trim();
    if (nome && podere) return `${nome} – ${podere}`;
    if (nome) return nome;
    if (podere) return podere;
    return 'Terreno senza nome';
}

function getFruttetoOptionLabel(f) {
    const terreno = terreni.find(t => t.id === f.terrenoId);
    const terrenoLabel = getTerrenoLabel(terreno) || 'Terreno sconosciuto';
    const specieVarieta = `${(f.specie || '').trim()} ${(f.varieta || '').trim()}`.trim();
    if (specieVarieta) return `${specieVarieta} – ${terrenoLabel}`;
    return terrenoLabel;
}

async function loadFrutteti() {
    try {
        frutteti = await getAllFrutteti();
        const terreniModule = await import(resolvePath('../../../core/services/terreni-service.js'));
        terreni = await terreniModule.getAllTerreni();
        const filterFruttetoSelect = document.getElementById('filter-frutteto');
        const fruttetoSelect = document.getElementById('fruttetoId');

        const options = frutteti.map(f => `<option value="${f.id}">${getFruttetoOptionLabel(f)}</option>`);

        filterFruttetoSelect.innerHTML = '<option value="">Tutti i frutteti</option>' + options.join('');
        fruttetoSelect.innerHTML = '<option value="">Seleziona frutteto</option>' + options.join('');
    } catch (error) {
        console.error('[RACCOLTA-FRUTTA] Errore caricamento frutteti:', error);
    }
}

function populateAnnoFilter() {
    const select = document.getElementById('filter-anno');
    const annoCorrente = new Date().getFullYear();
    let options = '<option value="">Tutti</option>';
    for (let i = 0; i < 6; i++) {
        const anno = annoCorrente - i;
        options += `<option value="${anno}">${anno}</option>`;
    }
    select.innerHTML = options;
}

async function loadRaccolte() {
    const loadingEl = document.getElementById('loading-raccolte');
    const emptyState = document.getElementById('empty-state');
    const tableContainer = document.getElementById('table-container-raccolte');
    try {
        if (loadingEl) loadingEl.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'none';

        const fruttetoIdFilter = document.getElementById('filter-frutteto').value;
        const annoFilter = document.getElementById('filter-anno').value;

        allRaccolte = [];

        if (fruttetoIdFilter) {
            const options = {};
            if (annoFilter) options.anno = parseInt(annoFilter, 10);
            const raccolteFrutteto = await getRaccolte(fruttetoIdFilter, options);
            allRaccolte = raccolteFrutteto.map(r => ({ ...r, fruttetoId: fruttetoIdFilter }));
        } else {
            for (const f of frutteti) {
                const options = {};
                if (annoFilter) options.anno = parseInt(annoFilter, 10);
                const raccolteFrutteto = await getRaccolte(f.id, options);
                allRaccolte = allRaccolte.concat(raccolteFrutteto.map(r => ({ ...r, fruttetoId: f.id })));
            }
        }

        raccolte = [...allRaccolte];
        applyFilters(); // include filtro varietà
    } catch (error) {
        console.error('[RACCOLTA-FRUTTA] Errore caricamento raccolte:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            const p = emptyState.querySelector('p');
            if (p) p.textContent = 'Errore nel caricamento: ' + (error.message || error) + '. Riprova o registra una nuova raccolta.';
        }
        alert('Errore nel caricamento raccolte: ' + error.message);
    }
}

function applyFilters() {
    const fruttetoId = document.getElementById('filter-frutteto').value;
    const anno = document.getElementById('filter-anno').value;
    const varieta = document.getElementById('filter-varieta').value.trim().toLowerCase();

    raccolte = allRaccolte.filter(r => {
        if (fruttetoId && r.fruttetoId !== fruttetoId) return false;

        if (anno) {
            const d = r.data instanceof Date
                ? r.data
                : (r.data && r.data.toDate ? r.data.toDate() : new Date(r.data));
            const y = d.getFullYear();
            if (y.toString() !== anno) return false;
        }

        if (varieta && !(r.varieta || '').toLowerCase().includes(varieta)) return false;

        return true;
    });

    renderRaccolte();
}

function resetFilters() {
    document.getElementById('filter-frutteto').value = '';
    document.getElementById('filter-anno').value = '';
    document.getElementById('filter-varieta').value = '';
    raccolte = [...allRaccolte];
    renderRaccolte();
}

function getFruttetoLabel(fruttetoId) {
    const f = frutteti.find(ff => ff.id === fruttetoId);
    if (!f) return '-';
    return getFruttetoOptionLabel(f);
}

function formatDate(d) {
    if (!d) return '-';
    const s = formatDateLikeToItalianLongLocal(d);
    return s || '-';
}

function renderRaccolte() {
    const tbody = document.getElementById('raccolte-table-body');
    const emptyState = document.getElementById('empty-state');
    const tableContainer = document.getElementById('table-container-raccolte');
    const loadingEl = document.getElementById('loading-raccolte');
    if (loadingEl) loadingEl.style.display = 'none';

    if (!raccolte || raccolte.length === 0) {
        tbody.innerHTML = '';
        if (tableContainer) tableContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';

    const basePath = resolvePath('../../../core/admin/gestione-lavori-standalone.html');
    tbody.innerHTML = raccolte.map(r => {
        const linkLavoro = r.lavoroId
            ? `<a href="${basePath}?lavoroId=${encodeURIComponent(r.lavoroId)}" class="link-lavoro" target="_blank" rel="noopener">🔗 Vedi Lavoro</a>`
            : '-';
        const pos = r.posizioneRilevamento;
        const posLabel = (pos && typeof pos.lat === 'number' && typeof pos.lng === 'number')
            ? (() => {
                const source = pos.source === 'map' ? 'MAPPA' : 'GPS';
                const sourceColor = source === 'MAPPA' ? '#1976D2' : '#2E7D32';
                const acc = pos.accuracyMeters != null ? ` (±${Math.round(pos.accuracyMeters)} m)` : '';
                return `<a href="https://www.google.com/maps?q=${pos.lat},${pos.lng}" target="_blank" rel="noopener">📍 ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}</a>${acc}<br><span style="display:inline-block;margin-top:4px;padding:2px 6px;border-radius:10px;font-size:11px;background:${sourceColor};color:#fff;font-weight:600;">${source}</span>`;
            })()
            : '-';
        return `<tr>
            <td>${formatDate(r.data)}</td>
            <td>${getFruttetoLabel(r.fruttetoId)}</td>
            <td>${r.specie || '-'}</td>
            <td>${r.varieta || '-'}</td>
            <td>${r.quantitaKg != null ? Number(r.quantitaKg).toFixed(2) : '-'}</td>
            <td>${r.quantitaEttari != null ? Number(r.quantitaEttari).toFixed(2) : '-'}</td>
            <td>${r.resaKgHa != null ? Number(r.resaKgHa).toFixed(2) : '-'}</td>
            <td style="font-size:12px;line-height:1.35;">${posLabel}</td>
            <td>${linkLavoro}</td>
            <td>
                <button class="btn btn-secondary btn-sm" data-action="edit" data-frutteto="${r.fruttetoId}" data-id="${r.id}">Modifica</button>
                <button class="btn btn-danger btn-sm" data-action="delete" data-frutteto="${r.fruttetoId}" data-id="${r.id}">Elimina</button>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => openEditRaccolta(btn.dataset.frutteto, btn.dataset.id));
    });
    tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', () => deleteRaccoltaConfirm(btn.dataset.frutteto, btn.dataset.id));
    });
}

function setupEventListeners() {
    document.getElementById('back-dashboard-btn').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = resolvePath('./frutteto-dashboard-standalone.html');
    });
    document.getElementById('back-frutteti-btn').addEventListener('click', () => {
        window.location.href = resolvePath('./frutteti-standalone.html');
    });

    document.getElementById('new-raccolta-btn').addEventListener('click', openNewRaccolta);
    document.getElementById('empty-new-raccolta-btn').addEventListener('click', openNewRaccolta);
    document.getElementById('close-raccolta-modal').addEventListener('click', closeRaccoltaModal);
    document.getElementById('cancel-raccolta-btn').addEventListener('click', closeRaccoltaModal);
    document.getElementById('raccolta-form').addEventListener('submit', onRaccoltaSubmit);

    document.getElementById('filter-frutteto').addEventListener('change', loadRaccolte);
    document.getElementById('filter-anno').addEventListener('change', loadRaccolte);
    document.getElementById('apply-filters-btn').addEventListener('click', (e) => {
        e.preventDefault();
        applyFilters();
    });
    document.getElementById('reset-filters-btn').addEventListener('click', (e) => {
        e.preventDefault();
        resetFilters();
    });

    document.getElementById('quantitaKg').addEventListener('input', window.calcolaResa);
    document.getElementById('quantitaEttari').addEventListener('input', window.calcolaResa);
    const btnGps = document.getElementById('btn-raccolta-posizione-gps');
    if (btnGps) {
        btnGps.addEventListener('click', async () => {
            await acquisisciPosizioneRaccolta();
        });
    }
}

function updatePosizioneRaccoltaStatus() {
    const statusEl = document.getElementById('raccolta-posizione-status');
    if (!statusEl) return;
    if (!posizioneRilevamentoForm || typeof posizioneRilevamentoForm.lat !== 'number' || typeof posizioneRilevamentoForm.lng !== 'number') {
        statusEl.textContent = 'Nessuna posizione acquisita.';
        statusEl.style.color = '#666';
        return;
    }
    const acc = posizioneRilevamentoForm.accuracyMeters != null
        ? ` (±${Math.round(posizioneRilevamentoForm.accuracyMeters)} m)`
        : '';
    statusEl.textContent = `Posizione pronta: ${posizioneRilevamentoForm.lat.toFixed(6)}, ${posizioneRilevamentoForm.lng.toFixed(6)}${acc}`;
    statusEl.style.color = '#2e7d32';
}

async function acquisisciPosizioneRaccolta() {
    const btnGps = document.getElementById('btn-raccolta-posizione-gps');
    try {
        if (btnGps) {
            btnGps.disabled = true;
            btnGps.textContent = '⌛ Rilevamento...';
        }
        const pos = await getCurrentPositionGeo();
        posizioneRilevamentoForm = {
            lat: pos.lat,
            lng: pos.lng,
            accuracyMeters: pos.accuracyMeters || null,
            source: 'gps'
        };
        updatePosizioneRaccoltaStatus();
    } catch (err) {
        alert(geolocationErrorMessage(err));
    } finally {
        if (btnGps) {
            btnGps.disabled = false;
            btnGps.textContent = '📍 Acquisisci posizione GPS';
        }
    }
}

function openNewRaccolta() {
    const modal = document.getElementById('raccolta-modal');
    if (!modal) {
        console.error('[RACCOLTA-FRUTTA] Modal non trovato');
        alert('Impossibile aprire il form. Ricarica la pagina.');
        return;
    }
    currentEditing = { fruttetoId: null, raccoltaId: null };
    document.getElementById('raccolta-modal-title').textContent = 'Nuova raccolta';
    document.getElementById('raccolta-form').reset();
    document.getElementById('raccolta-id').value = '';
    document.getElementById('frutteto-id-hidden').value = '';
    document.getElementById('lavoro-id-hidden').value = '';
    document.getElementById('attivita-id-hidden').value = '';
    aggiornaScartoCategorie();
    document.getElementById('dati-lavoro-section').style.display = 'none';
    document.getElementById('resa-info').style.display = 'none';
    posizioneRilevamentoForm = null;
    const inclPos = document.getElementById('raccolta-includi-posizione');
    if (inclPos) inclPos.checked = false;
    updatePosizioneRaccoltaStatus();
    poligonoCoords = [];
    if (poligonoRaccoltaPoly) { poligonoRaccoltaPoly.setMap(null); poligonoRaccoltaPoly = null; }
    document.getElementById('poligono-info').style.display = 'none';
    const tbodyOp = document.getElementById('operai-tabella-body');
    if (tbodyOp) { tbodyOp.innerHTML = ''; window.aggiungiRigaOperaio(); }
    document.getElementById('operai-tabella-section').style.display = 'block';
    document.getElementById('macchine-tabella-section').style.display = 'none';
    const qKg = document.getElementById('quantitaKg');
    const qHa = document.getElementById('quantitaEttari');
    if (qKg) qKg.setAttribute('required', 'required');
    if (qHa) qHa.setAttribute('required', 'required');
    const fruttetoId = document.getElementById('filter-frutteto').value || getQueryParam('fruttetoId');
    if (fruttetoId) document.getElementById('fruttetoId').value = fruttetoId;
    window.onFruttetoChange();
    modal.classList.add('active');
    modal.style.display = 'flex';
}

async function openEditRaccolta(fruttetoId, raccoltaId) {
    try {
        const raccolta = await getRaccoltaForEdit(fruttetoId, raccoltaId);
        if (!raccolta) return;

        currentEditing = { fruttetoId, raccoltaId };
        document.getElementById('raccolta-modal-title').textContent = 'Modifica raccolta';
        document.getElementById('raccolta-id').value = raccoltaId;
        document.getElementById('frutteto-id-hidden').value = fruttetoId;
        document.getElementById('lavoro-id-hidden').value = raccolta.lavoroId || '';
        document.getElementById('attivita-id-hidden').value = raccolta.attivitaId || '';

        const datiLavoroSection = document.getElementById('dati-lavoro-section');
        const operaiTabellaSection = document.getElementById('operai-tabella-section');
        const macchineTabellaSection = document.getElementById('macchine-tabella-section');

        let superficieDalLavoro = null;
        if (raccolta.lavoroId) {
            datiLavoroSection.style.display = 'block';
            await loadMacchine();
            superficieDalLavoro = await loadDatiLavoro(raccolta.lavoroId);
            operaiTabellaSection.style.display = 'none';
        } else {
            datiLavoroSection.style.display = 'none';
            operaiTabellaSection.style.display = 'block';
            if (raccolta.operai && Array.isArray(raccolta.operai) && raccolta.operai.length > 0) {
                const opData = raccolta.operai.map(op => typeof op === 'object' && op.nome !== undefined ? op : { nome: '', data: null, ore: 0 });
                popolaTabellaOperai(opData);
            } else window.aggiungiRigaOperaio();
        }

        if (raccolta.lavoroId || raccolta.attivitaId) {
            macchineTabellaSection.style.display = 'block';
            await caricaMacchinePerRaccolta(raccolta);
            document.getElementById('quantitaKg').removeAttribute('required');
            document.getElementById('quantitaEttari').removeAttribute('required');
        } else {
            macchineTabellaSection.style.display = 'none';
            document.getElementById('quantitaKg').setAttribute('required', 'required');
            document.getElementById('quantitaEttari').setAttribute('required', 'required');
        }

        document.getElementById('fruttetoId').value = fruttetoId;
        window.onFruttetoChange();

        const d = raccolta.data instanceof Date ? raccolta.data : (raccolta.data?.toDate ? raccolta.data.toDate() : new Date(raccolta.data));
        document.getElementById('data').value = d.toISOString().slice(0, 10);
        document.getElementById('specie').value = raccolta.specie || '';
        document.getElementById('varieta').value = raccolta.varieta || '';
        document.getElementById('quantitaKg').value = raccolta.quantitaKg != null ? raccolta.quantitaKg : '';
        let supVal = raccolta.quantitaEttari != null ? raccolta.quantitaEttari : '';
        if ((!supVal || supVal === 0) && superficieDalLavoro) supVal = superficieDalLavoro;
        const supFormatted = (supVal !== '' && supVal != null && !isNaN(parseFloat(supVal))) ? parseFloat(supVal).toFixed(2) : (supVal !== '' && supVal != null ? String(supVal) : '');
        document.getElementById('quantitaEttari').value = supFormatted;
        document.getElementById('note').value = raccolta.note || '';
        document.getElementById('calibro').value = raccolta.calibro || '';
        document.getElementById('gradoMaturazione').value = raccolta.gradoMaturazione || '';
        document.getElementById('colore').value = raccolta.colore || '';
        document.getElementById('scartoTotaleKg').value = (raccolta.scartoTotaleKg != null && raccolta.scartoTotaleKg !== '') ? parseFloat(raccolta.scartoTotaleKg) : '';
        const spc = raccolta.scartoPerCategoria || {};
        document.getElementById('scartoDannoFisico').value = spc.dannoFisico != null ? parseFloat(spc.dannoFisico) : '';
        document.getElementById('scartoCalibroFuoriNorma').value = spc.calibroFuoriNorma != null ? parseFloat(spc.calibroFuoriNorma) : '';
        document.getElementById('scartoMarciume').value = spc.marciume != null ? parseFloat(spc.marciume) : '';
        document.getElementById('scartoMaturazioneNonIdonea').value = spc.maturazioneNonIdonea != null ? parseFloat(spc.maturazioneNonIdonea) : '';
        document.getElementById('scartoAltro').value = spc.altro != null ? parseFloat(spc.altro) : '';
        aggiornaScartoCategorie();
        posizioneRilevamentoForm = raccolta.posizioneRilevamento && typeof raccolta.posizioneRilevamento.lat === 'number'
            ? {
                lat: raccolta.posizioneRilevamento.lat,
                lng: raccolta.posizioneRilevamento.lng,
                accuracyMeters: raccolta.posizioneRilevamento.accuracyMeters || null,
                source: raccolta.posizioneRilevamento.source || 'gps'
            }
            : null;
        const inclPos = document.getElementById('raccolta-includi-posizione');
        if (inclPos) inclPos.checked = !!posizioneRilevamentoForm;
        updatePosizioneRaccoltaStatus();

        poligonoCoords = [];
        if (raccolta.poligonoRaccolta && raccolta.poligonoRaccolta.length >= 3) {
            poligonoCoords = raccolta.poligonoRaccolta.map(c => ({ lat: c.lat, lng: c.lng }));
            document.getElementById('poligono-info').style.display = 'block';
        } else {
            document.getElementById('poligono-info').style.display = 'none';
            if (raccolta.lavoroId) {
                const fromLavoro = await loadPoligonoFromZoneLavorate(raccolta.lavoroId);
                if (fromLavoro && fromLavoro.length >= 3) {
                    poligonoCoords = fromLavoro;
                    document.getElementById('poligono-info').style.display = 'block';
                }
            }
        }

        window.calcolaResa();
        const modal = document.getElementById('raccolta-modal');
        if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
    } catch (error) {
        console.error('[RACCOLTA-FRUTTA] Errore apertura modifica:', error);
        alert('Errore nel caricamento della raccolta: ' + error.message);
    }
}

async function getRaccoltaForEdit(fruttetoId, raccoltaId) {
    try {
        // Usiamo il servizio dedicato
        const { getRaccolta } = await import('../services/raccolta-frutta-service.js');
        return await getRaccolta(fruttetoId, raccoltaId);
    } catch (error) {
        console.error('[RACCOLTA-FRUTTA] Errore getRaccoltaForEdit:', error);
        return null;
    }
}

function closeRaccoltaModal() {
    const modal = document.getElementById('raccolta-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    currentEditing = { fruttetoId: null, raccoltaId: null };
}

async function onRaccoltaSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (!data.fruttetoId) {
        alert('Seleziona un frutteto');
        return;
    }

    const rawDate = data.data;
    let dateObj = null;
    if (rawDate) {
        const [y, m, d] = rawDate.split('-').map(Number);
        dateObj = new Date(y, m - 1, d);
    }

    let operaiPayload = [];
    const opSection = document.getElementById('operai-tabella-section');
    if (opSection && opSection.style.display !== 'none') {
        const tbody = document.getElementById('operai-tabella-body');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const dataInp = tr.querySelector('.input-data-operaio');
                const nomeInp = tr.querySelector('.input-nome-operaio');
                const oreInp = tr.querySelector('.input-ore-operaio');
                const nome = nomeInp ? nomeInp.value.trim() : '';
                const ore = oreInp ? parseFloat(oreInp.value) || 0 : 0;
                if (nome || ore > 0) {
                    let dataVal = null;
                    if (dataInp && dataInp.value) {
                        const [yy, mm, dd] = dataInp.value.split('-').map(Number);
                        dataVal = new Date(yy, mm - 1, dd);
                    }
                    operaiPayload.push({ data: dataVal, nome, ore });
                }
            });
        }
    }

    let poligonoRaccoltaPayload = null;
    if (poligonoCoords && poligonoCoords.length >= 3) {
        poligonoRaccoltaPayload = poligonoCoords.map(c => typeof c.lat === 'function' ? { lat: c.lat(), lng: c.lng() } : { lat: c.lat, lng: c.lng });
    }

    const scartoTotale = data.scartoTotaleKg !== '' && data.scartoTotaleKg != null ? parseFloat(data.scartoTotaleKg) : null;
    const scartoPerCategoria = {};
    ['dannoFisico', 'calibroFuoriNorma', 'marciume', 'maturazioneNonIdonea', 'altro'].forEach(key => {
        const id = 'scarto' + key.charAt(0).toUpperCase() + key.slice(1);
        const val = document.getElementById(id)?.value;
        if (val !== '' && val != null && !isNaN(parseFloat(val))) scartoPerCategoria[key] = parseFloat(val);
    });
    const hasScarto = scartoTotale != null && scartoTotale > 0 || Object.keys(scartoPerCategoria).length > 0;

    const raccoltaData = {
        data: dateObj,
        specie: data.specie,
        varieta: data.varieta,
        quantitaKg: data.quantitaKg ? parseFloat(data.quantitaKg) : null,
        quantitaEttari: data.quantitaEttari ? parseFloat(data.quantitaEttari) : null,
        resaKgHa: (data.quantitaKg && data.quantitaEttari) ? parseFloat(data.quantitaKg) / parseFloat(data.quantitaEttari) : null,
        calibro: (data.calibro || '').trim() || null,
        gradoMaturazione: (data.gradoMaturazione || '').trim() || null,
        colore: (data.colore || '').trim() || null,
        scartoTotaleKg: hasScarto ? (scartoTotale != null ? scartoTotale : Object.values(scartoPerCategoria).reduce((a, b) => a + b, 0)) : null,
        scartoPerCategoria: hasScarto && Object.keys(scartoPerCategoria).length > 0 ? scartoPerCategoria : null,
        operai: operaiPayload,
        poligonoRaccolta: poligonoRaccoltaPayload,
        note: data.note || ''
    };

    const includePosizione = !!document.getElementById('raccolta-includi-posizione')?.checked;
    if (includePosizione) {
        if (!posizioneRilevamentoForm) {
            try {
                const pos = await getCurrentPositionGeo();
                posizioneRilevamentoForm = {
                    lat: pos.lat,
                    lng: pos.lng,
                    accuracyMeters: pos.accuracyMeters || null,
                    source: 'gps'
                };
                updatePosizioneRaccoltaStatus();
            } catch (err) {
                alert(geolocationErrorMessage(err));
                return;
            }
        }
        raccoltaData.posizioneRilevamento = {
            lat: posizioneRilevamentoForm.lat,
            lng: posizioneRilevamentoForm.lng,
            accuracyMeters: posizioneRilevamentoForm.accuracyMeters || null,
            source: posizioneRilevamentoForm.source || 'gps'
        };
    } else {
        raccoltaData.posizioneRilevamento = null;
    }

    const lavoroId = document.getElementById('lavoro-id-hidden').value;
    const attivitaId = document.getElementById('attivita-id-hidden').value;
    if (lavoroId) raccoltaData.lavoroId = lavoroId;
    if (attivitaId) raccoltaData.attivitaId = attivitaId;

    try {
        if (currentEditing && currentEditing.raccoltaId) {
            await updateRaccolta(currentEditing.fruttetoId, currentEditing.raccoltaId, raccoltaData);
        } else {
            await createRaccolta(data.fruttetoId, raccoltaData);
        }
        closeRaccoltaModal();
        await loadRaccolte();
    } catch (error) {
        console.error('[RACCOLTA-FRUTTA] Errore salvataggio raccolta:', error);
        alert('Errore nel salvataggio della raccolta: ' + error.message);
    }
}

window.apriMappaTracciamento = async function() {
    if (typeof google === 'undefined' || !google.maps) {
        alert('Google Maps non è ancora caricato. Attendi e riprova.');
        return;
    }
    const fruttetoId = document.getElementById('fruttetoId')?.value;
    if (!fruttetoId) { alert('Seleziona prima un frutteto'); return; }
    const frutteto = frutteti.find(f => f.id === fruttetoId);
    if (!frutteto) { alert('Frutteto non trovato'); return; }
    const { getTerreno } = await import(resolvePath('../../../core/services/terreni-service.js'));
    const terreno = await getTerreno(frutteto.terrenoId);
    if (!terreno || !terreno.polygonCoords || terreno.polygonCoords.length === 0) {
        alert('Il terreno del frutteto non ha confini tracciati. Traccia prima i confini del terreno.');
        return;
    }
    currentFruttetoForMap = frutteto;
    document.getElementById('modal-mappa-raccolta').classList.add('active');
    document.getElementById('modal-mappa-raccolta').style.display = 'flex';
    if (!mappaRaccolta) await initMappaRaccolta(terreno);
    else await caricaTerrenoSullaMappa(terreno);
    if (poligonoCoords.length >= 3) aggiornaPoligonoSullaMappa();
    aggiornaInfoPoligono();
};

function applicaCursoreCrosshair() {
    const mapContainer = document.querySelector('#modal-mappa-raccolta .modal-mappa-body');
    if (mapContainer) {
        mapContainer.classList.add('drawing-mode');
        const mappaElement = document.getElementById('mappa-raccolta-container');
        if (mappaElement) {
            mappaElement.style.cursor = 'crosshair';
            setTimeout(() => {
                mappaElement.querySelectorAll('div').forEach(div => { div.style.cursor = 'crosshair'; });
                mappaElement.querySelectorAll('canvas').forEach(canvas => { canvas.style.cursor = 'crosshair'; });
            }, 100);
        }
    }
}

function rimuoviCursoreCrosshair() {
    const mapContainer = document.querySelector('#modal-mappa-raccolta .modal-mappa-body');
    if (mapContainer) {
        mapContainer.classList.remove('drawing-mode');
        const mappaElement = document.getElementById('mappa-raccolta-container');
        if (mappaElement) {
            mappaElement.style.cursor = '';
            mappaElement.querySelectorAll('div').forEach(div => { div.style.cursor = ''; });
            mappaElement.querySelectorAll('canvas').forEach(canvas => { canvas.style.cursor = ''; });
        }
    }
}

window.chiudiMappaTracciamento = function() {
    if (isDrawingPolygon) {
        isDrawingPolygon = false;
        rimuoviCursoreCrosshair();
        const btn = document.getElementById('btn-draw-polygon');
        if (btn) { btn.textContent = '✏️ Traccia poligono'; }
        if (mappaRaccolta && mappaRaccolta.clickListener) {
            google.maps.event.removeListener(mappaRaccolta.clickListener);
            mappaRaccolta.clickListener = null;
        }
    }
    document.getElementById('modal-mappa-raccolta').classList.remove('active');
    document.getElementById('modal-mappa-raccolta').style.display = 'none';
};

async function initMappaRaccolta(terreno) {
    const container = document.getElementById('mappa-raccolta-container');
    if (!container) return;
    const center = terreno.polygonCoords && terreno.polygonCoords[0] ? { lat: terreno.polygonCoords[0].lat, lng: terreno.polygonCoords[0].lng } : { lat: 43.7228, lng: 10.4017 };
    mappaRaccolta = new google.maps.Map(container, { center, zoom: 15, mapTypeId: 'satellite', mapTypeControl: true });
    await caricaTerrenoSullaMappa(terreno);
}

async function caricaTerrenoSullaMappa(terreno) {
    if (!mappaRaccolta || !terreno || !terreno.polygonCoords || terreno.polygonCoords.length === 0) return;
    if (terrenoPolygon) { terrenoPolygon.setMap(null); terrenoPolygon = null; }
    const coords = terreno.polygonCoords.map(c => new google.maps.LatLng(c.lat, c.lng));
    terrenoBoundaryCoords = coords;
    terrenoPolygon = new google.maps.Polygon({ paths: coords, fillColor: '#2E8B57', fillOpacity: 0.2, strokeColor: '#2E8B57', strokeWeight: 3, editable: false, clickable: false });
    terrenoPolygon.setMap(mappaRaccolta);
    const bounds = new google.maps.LatLngBounds();
    coords.forEach(c => bounds.extend(c));
    mappaRaccolta.fitBounds(bounds);
}

function aggiornaPoligonoSullaMappa() {
    if (poligonoRaccoltaPoly) { poligonoRaccoltaPoly.setMap(null); poligonoRaccoltaPoly = null; }
    if (poligonoCoords.length < 3) return;
    const path = poligonoCoords.map(c => c.lat ? new google.maps.LatLng(c.lat, c.lng) : c);
    poligonoRaccoltaPoly = new google.maps.Polygon({ paths: path, fillColor: '#FF6F00', fillOpacity: 0.35, strokeColor: '#FF6F00', strokeWeight: 2, editable: true });
    poligonoRaccoltaPoly.setMap(mappaRaccolta);
    poligonoRaccoltaPoly.getPath().addListener('set_at', aggiornaInfoPoligono);
    poligonoRaccoltaPoly.getPath().addListener('insert_at', aggiornaInfoPoligono);
    poligonoRaccoltaPoly.getPath().addListener('remove_at', aggiornaInfoPoligono);
}

function aggiornaInfoPoligono() {
    const infoEl = document.getElementById('mappa-info');
    const supEl = document.getElementById('superficie-calcolata');
    const puntiEl = document.getElementById('punti-tracciati');
    let path = [];
    if (poligonoRaccoltaPoly) {
        const p = poligonoRaccoltaPoly.getPath();
        for (let i = 0; i < p.getLength(); i++) path.push(p.getAt(i));
    } else if (poligonoCoords.length >= 3) {
        path = poligonoCoords.map(c => c.lat ? new google.maps.LatLng(c.lat, c.lng) : c);
    }
    if (path.length >= 3) {
        if (infoEl) infoEl.style.display = 'block';
        let areaM2 = 0;
        if (typeof google !== 'undefined' && google.maps && google.maps.geometry) {
            areaM2 = google.maps.geometry.spherical.computeArea(path);
        }
        const areaHa = (areaM2 / 10000).toFixed(2);
        if (supEl) supEl.textContent = areaHa + ' ha';
        if (puntiEl) puntiEl.textContent = path.length;
        document.getElementById('btn-clear-polygon').style.display = 'inline-block';
        document.getElementById('btn-save-polygon').style.display = 'inline-block';
        document.getElementById('btn-conferma-polygon').style.display = 'inline-block';
    } else {
        if (infoEl) infoEl.style.display = 'none';
        if (supEl) supEl.textContent = '0.00 ha';
        if (puntiEl) puntiEl.textContent = String(poligonoCoords.length);
        document.getElementById('btn-clear-polygon').style.display = 'none';
        document.getElementById('btn-save-polygon').style.display = 'none';
        document.getElementById('btn-conferma-polygon').style.display = 'none';
    }
}

function findNearestVertex(point, boundaryCoords, maxDistance) {
    let nearestVertex = null;
    let minDistance = maxDistance;
    boundaryCoords.forEach(vertex => {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point, vertex);
        if (distance < minDistance) {
            minDistance = distance;
            nearestVertex = vertex;
        }
    });
    return nearestVertex;
}

function findNearestPointOnBoundary(point, boundaryCoords, maxDistance) {
    let nearestPoint = null;
    let minDistance = maxDistance;
    for (let i = 0; i < boundaryCoords.length; i++) {
        const start = boundaryCoords[i];
        const end = boundaryCoords[(i + 1) % boundaryCoords.length];
        const closestPoint = getClosestPointOnSegment(point, start, end);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point, closestPoint);
        if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = closestPoint;
        }
    }
    return nearestPoint;
}

function getClosestPointOnSegment(point, segmentStart, segmentEnd) {
    const A = point.lat();
    const B = point.lng();
    const C = segmentStart.lat();
    const D = segmentStart.lng();
    const E = segmentEnd.lat();
    const F = segmentEnd.lng();
    const dx = E - C;
    const dy = F - D;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return segmentStart;
    const t = Math.max(0, Math.min(1, ((A - C) * dx + (B - D) * dy) / lengthSquared));
    return new google.maps.LatLng(C + t * dx, D + t * dy);
}

function getDistanceToBoundary(point, boundaryCoords) {
    let minDistance = Infinity;
    for (let i = 0; i < boundaryCoords.length; i++) {
        const start = boundaryCoords[i];
        const end = boundaryCoords[(i + 1) % boundaryCoords.length];
        const closestPoint = getClosestPointOnSegment(point, start, end);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point, closestPoint);
        minDistance = Math.min(minDistance, distance);
    }
    return minDistance;
}

function movePointInsideBoundary(point, boundaryCoords) {
    const nearestBoundaryPoint = findNearestPointOnBoundary(point, boundaryCoords, 100);
    if (!nearestBoundaryPoint) return point;
    const center = getPolygonCenterRaccolta(boundaryCoords);
    const dx = center.lat() - nearestBoundaryPoint.lat();
    const dy = center.lng() - nearestBoundaryPoint.lng();
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return point;
    const moveDistance = 1 / 111000;
    const normalizedDx = dx / length;
    const normalizedDy = dy / length;
    return new google.maps.LatLng(
        nearestBoundaryPoint.lat() + normalizedDx * moveDistance,
        nearestBoundaryPoint.lng() + normalizedDy * moveDistance
    );
}

function getPolygonCenterRaccolta(coords) {
    let sumLat = 0, sumLng = 0;
    coords.forEach(coord => {
        sumLat += coord.lat();
        sumLng += coord.lng();
    });
    return new google.maps.LatLng(sumLat / coords.length, sumLng / coords.length);
}

window.iniziaTracciamentoPoligono = function() {
    if (!mappaRaccolta) return;
    if (isDrawingPolygon) {
        isDrawingPolygon = false;
        rimuoviCursoreCrosshair();
        document.getElementById('btn-draw-polygon').textContent = '✏️ Traccia poligono';
        if (mappaRaccolta.clickListener) {
            google.maps.event.removeListener(mappaRaccolta.clickListener);
            mappaRaccolta.clickListener = null;
        }
        return;
    }
    if (poligonoRaccoltaPoly) { poligonoRaccoltaPoly.setMap(null); poligonoRaccoltaPoly = null; }
    poligonoCoords = [];
    firstPoint = null;
    if (mappaRaccolta.clickListener) { google.maps.event.removeListener(mappaRaccolta.clickListener); mappaRaccolta.clickListener = null; }
    isDrawingPolygon = true;
    document.getElementById('btn-draw-polygon').textContent = '⏸️ Pausa tracciamento';
    applicaCursoreCrosshair();
    let clickTimeout = null;
    mappaRaccolta.clickListener = mappaRaccolta.addListener('click', (event) => {
        if (!isDrawingPolygon || !event.latLng) return;
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
            if (poligonoCoords.length >= 3) {
                isDrawingPolygon = false;
                rimuoviCursoreCrosshair();
                if (mappaRaccolta.clickListener) { google.maps.event.removeListener(mappaRaccolta.clickListener); mappaRaccolta.clickListener = null; }
                document.getElementById('btn-draw-polygon').textContent = '✏️ Traccia poligono';
                alert('Tracciamento completato. Puoi modificare il poligono trascinando i punti.');
            }
            return;
        }
        clickTimeout = setTimeout(() => {
            clickTimeout = null;
            const disableSnap = event.domEvent && event.domEvent.shiftKey;
            let snappedPoint = event.latLng;
            let snapApplied = false;
            if (!disableSnap && terrenoBoundaryCoords.length > 0) {
                const vertexSnap = findNearestVertex(snappedPoint, terrenoBoundaryCoords, VERTEX_SNAP_DISTANCE_METERS);
                if (vertexSnap && google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, vertexSnap) <= VERTEX_SNAP_DISTANCE_METERS) {
                    snappedPoint = vertexSnap;
                    snapApplied = true;
                }
                if (!snapApplied) {
                    const boundarySnap = findNearestPointOnBoundary(snappedPoint, terrenoBoundaryCoords, SNAP_DISTANCE_METERS);
                    if (boundarySnap && google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, boundarySnap) <= SNAP_DISTANCE_METERS) {
                        snappedPoint = boundarySnap;
                        snapApplied = true;
                    }
                }
            }
            if (snapApplied) {
                const snapMarker = new google.maps.Marker({
                    position: snappedPoint,
                    map: mappaRaccolta,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#00ff00', fillOpacity: 0.8, strokeColor: '#ffffff', strokeWeight: 2 },
                    zIndex: 2000
                });
                setTimeout(() => { if (snapMarker) snapMarker.setMap(null); }, 1000);
            }
            if (terrenoPolygon) {
                const isInside = google.maps.geometry.poly.containsLocation(snappedPoint, terrenoPolygon);
                const distanceToBoundary = getDistanceToBoundary(snappedPoint, terrenoBoundaryCoords);
                if (!isInside && distanceToBoundary > 3) {
                    alert('Il punto deve essere dentro i confini del terreno!');
                    return;
                }
                if (!isInside && distanceToBoundary <= 3) {
                    snappedPoint = movePointInsideBoundary(snappedPoint, terrenoBoundaryCoords);
                }
            }
            if (poligonoCoords.length === 0) firstPoint = snappedPoint;
            if (firstPoint && poligonoCoords.length >= 3 && google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, firstPoint) < 20) {
                poligonoCoords.push({ lat: firstPoint.lat(), lng: firstPoint.lng() });
                isDrawingPolygon = false;
                rimuoviCursoreCrosshair();
                if (mappaRaccolta.clickListener) { google.maps.event.removeListener(mappaRaccolta.clickListener); mappaRaccolta.clickListener = null; }
                document.getElementById('btn-draw-polygon').textContent = '✏️ Traccia poligono';
                aggiornaPoligonoSullaMappa();
                aggiornaInfoPoligono();
                alert('Poligono chiuso! Puoi modificarlo trascinando i punti.');
                return;
            }
            poligonoCoords.push({ lat: snappedPoint.lat(), lng: snappedPoint.lng() });
            aggiornaPoligonoSullaMappa();
            aggiornaInfoPoligono();
        }, 300);
    });
};

window.eliminaPoligono = function() {
    if (poligonoRaccoltaPoly) { poligonoRaccoltaPoly.setMap(null); poligonoRaccoltaPoly = null; }
    poligonoCoords = [];
    isDrawingPolygon = false;
    rimuoviCursoreCrosshair();
    const btn = document.getElementById('btn-draw-polygon');
    if (btn) { btn.textContent = '✏️ Traccia poligono'; }
    if (mappaRaccolta && mappaRaccolta.clickListener) {
        google.maps.event.removeListener(mappaRaccolta.clickListener);
        mappaRaccolta.clickListener = null;
    }
    aggiornaInfoPoligono();
    document.getElementById('btn-clear-polygon').style.display = 'none';
    document.getElementById('btn-save-polygon').style.display = 'none';
    document.getElementById('btn-conferma-polygon').style.display = 'none';
};

window.salvaPoligono = function() {
    if (poligonoRaccoltaPoly) {
        const path = poligonoRaccoltaPoly.getPath();
        poligonoCoords = [];
        for (let i = 0; i < path.getLength(); i++) {
            const p = path.getAt(i);
            poligonoCoords.push({ lat: p.lat(), lng: p.lng() });
        }
    }
    aggiornaInfoPoligono();
};

window.confermaPoligono = function() {
    if (poligonoRaccoltaPoly) {
        const path = poligonoRaccoltaPoly.getPath();
        poligonoCoords = [];
        for (let i = 0; i < path.getLength(); i++) {
            const p = path.getAt(i);
            poligonoCoords.push({ lat: p.lat(), lng: p.lng() });
        }
    }
    if (poligonoCoords.length < 3) { alert('Traccia almeno 3 punti'); return; }
    let areaM2 = 0;
    if (typeof google !== 'undefined' && google.maps.geometry) {
        const path = poligonoCoords.map(c => new google.maps.LatLng(c.lat, c.lng));
        areaM2 = google.maps.geometry.spherical.computeArea(path);
    }
    const areaHa = (areaM2 / 10000).toFixed(2);
    document.getElementById('quantitaEttari').value = areaHa;
    window.calcolaResa();
    document.getElementById('poligono-info').style.display = 'block';
    window.chiudiMappaTracciamento();
};

function deleteRaccoltaConfirm(fruttetoId, raccoltaId) {
    if (confirm('Sei sicuro di voler eliminare questa raccolta?')) {
        deleteRaccoltaAction(fruttetoId, raccoltaId);
    }
}

async function deleteRaccoltaAction(fruttetoId, raccoltaId) {
    try {
        await deleteRaccolta(fruttetoId, raccoltaId);
        await loadRaccolte();
        alert('Raccolta eliminata con successo');
    } catch (error) {
        console.error('[RACCOLTA-FRUTTA] Errore eliminazione raccolta:', error);
        alert('Errore nell\'eliminazione della raccolta: ' + error.message);
    }
}

// Avvio
init();

/**
 * Pagina Potatura frutteto.
 * L'HTML in views/ resta la struttura; qui c'è il comportamento.
 * Gli import dinamici via resolvePath restano relativi all'URL della pagina.
 * @module modules/frutteto/js/potatura-page
 */

import { formatDateLikeToItalianLongLocal } from '../../../core/js/date-format-it.js';
import { showAlert } from '../../../core/js/gfv-page-utils.js';
import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';

try {
    await window.GFVStandaloneReady;
} catch (err) {
    console.error('[potatura-frutteto] Bootstrap failed:', err);
    throw err;
}

function formatDate(d) {
    if (!d) return '-';
    const s = formatDateLikeToItalianLongLocal(d);
    return s || '-';
}

function findNearestVertexFrutteto(point, boundaryCoords, maxDistance) {
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

let frutteti = [];
let potature = [];
let currentFruttetoId = null;
let currentAnno = null;
let potaturaFromAttivitaOnly = false;
let poligonoCoords = [];
let mappaPotaturaFrutteto = null;
let poligonoPotaturaPolyFrutteto = null;
let terrenoPolygonFrutteto = null;
let terrenoBoundaryCoordsFrutteto = [];
let firstPointFrutteto = null;
let isDrawingPolygonFrutteto = false;
const SNAP_DISTANCE_METERS_F = 5;
const VERTEX_SNAP_DISTANCE_METERS_F = 8;
let hasManodoperaModule = false;

// Trova il punto più vicino sul confine del terreno (su un segmento di linea)
function findNearestPointOnBoundaryFrutteto(point, boundaryCoords, maxDistance) {
    let nearestPoint = null;
    let minDistance = maxDistance;
    
    // Itera su tutti i segmenti del confine
    for (let i = 0; i < boundaryCoords.length; i++) {
        const start = boundaryCoords[i];
        const end = boundaryCoords[(i + 1) % boundaryCoords.length]; // Ultimo punto si collega al primo
        
        // Calcola punto più vicino su questo segmento
        const closestPoint = getClosestPointOnSegmentFrutteto(point, start, end);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point, closestPoint);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = closestPoint;
        }
    }
    
    return nearestPoint;
}

// Calcola il punto più vicino su un segmento di linea
function getClosestPointOnSegmentFrutteto(point, segmentStart, segmentEnd) {
    const A = point.lat();
    const B = point.lng();
    const C = segmentStart.lat();
    const D = segmentStart.lng();
    const E = segmentEnd.lat();
    const F = segmentEnd.lng();
    
    // Calcola vettore del segmento
    const dx = E - C;
    const dy = F - D;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
        // Segmento degenere (punto)
        return segmentStart;
    }
    
    // Calcola parametro t (0 = start, 1 = end)
    const t = Math.max(0, Math.min(1, ((A - C) * dx + (B - D) * dy) / lengthSquared));
    
    // Calcola punto più vicino
    const closestLat = C + t * dx;
    const closestLng = D + t * dy;
    
    return new google.maps.LatLng(closestLat, closestLng);
}

// Calcola distanza minima da un punto al confine del terreno
function getDistanceToBoundaryFrutteto(point, boundaryCoords) {
    let minDistance = Infinity;
    
    for (let i = 0; i < boundaryCoords.length; i++) {
        const start = boundaryCoords[i];
        const end = boundaryCoords[(i + 1) % boundaryCoords.length];
        const closestPoint = getClosestPointOnSegmentFrutteto(point, start, end);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point, closestPoint);
        minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
}

// Sposta un punto leggermente dentro il confine del terreno
function movePointInsideBoundaryFrutteto(point, boundaryCoords) {
    // Trova il punto più vicino sul confine
    const nearestBoundaryPoint = findNearestPointOnBoundaryFrutteto(point, boundaryCoords, 100);
    if (!nearestBoundaryPoint) return point;
    
    // Calcola vettore dal confine verso il centro del terreno
    const center = getPolygonCenterFrutteto(boundaryCoords);
    const dx = center.lat() - nearestBoundaryPoint.lat();
    const dy = center.lng() - nearestBoundaryPoint.lng();
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return point;
    
    // Normalizza e sposta di 1 metro verso l'interno
    const moveDistance = 1 / 111000; // Circa 1 metro in gradi (approssimazione)
    const normalizedDx = dx / length;
    const normalizedDy = dy / length;
    
    return new google.maps.LatLng(
        nearestBoundaryPoint.lat() + normalizedDx * moveDistance,
        nearestBoundaryPoint.lng() + normalizedDy * moveDistance
    );
}

// Calcola centro di un poligono
function getPolygonCenterFrutteto(coords) {
    let sumLat = 0, sumLng = 0;
    coords.forEach(coord => {
        sumLat += coord.lat();
        sumLng += coord.lng();
    });
    return new google.maps.LatLng(sumLat / coords.length, sumLng / coords.length);
}

async function loadPoligonoFromZoneLavoratePotaturaFrutteto(lavoroId) {
    const tenantId = (await import(resolvePath('../../../core/services/tenant-service.js'))).getCurrentTenantId();
    const { getDb, collection, getDocs } = await import(resolvePath('../../../core/services/firebase-service.js'));
    const db = getDb();
    if (!tenantId || !lavoroId || !db) return null;
    try {
        const zoneRef = collection(db, 'tenants', tenantId, 'lavori', lavoroId, 'zoneLavorate');
        const snap = await getDocs(zoneRef);
        for (const docSnap of snap.docs) {
            const data = docSnap.data();
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
    } catch (e) { console.warn('[POTATURA-FRUTTETO] loadPoligonoFromZoneLavorate:', e); }
    return null;
}

async function loadDatiLavoroPotaturaFrutteto(lavoroId) {
    const { getCurrentTenantId } = await import(resolvePath('../../../core/services/tenant-service.js'));
    const { getLavoro } = await import(resolvePath('../../../core/services/lavori-service.js'));
    const { getTerreno } = await import(resolvePath('../../../core/services/terreni-service.js'));
    const firebaseService = await import(resolvePath('../../../core/services/firebase-service.js'));
    const { getDb, collection, query, where, getDocs, getDoc, doc } = firebaseService;
    const tenantId = getCurrentTenantId();
    if (!tenantId || !lavoroId) return null;
    const db = getDb();
    if (!db) return null;
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
    let macchine = [];
    try {
        const macchineService = await import(resolvePath('../../../modules/parco-macchine/services/macchine-service.js'));
        macchine = await macchineService.getAllMacchine();
    } catch (e) { console.warn('[POTATURA-FRUTTETO] loadMacchine:', e); }
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

async function loadMacchinePotatura() {
    try {
        const mod = await import(resolvePath('../../../modules/parco-macchine/services/macchine-service.js'));
        return await mod.getAllMacchine();
    } catch (e) {
        return [];
    }
}

window.aggiungiRigaOperaioPotatura = function() {
    const tbody = document.getElementById('operai-tabella-body-potatura');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = '<td><input type="date" class="input-data-operaio-potatura"></td><td><input type="text" placeholder="Nome" class="input-nome-operaio-potatura"></td><td><input type="number" step="0.01" min="0" value="0" class="input-ore-operaio-potatura"></td><td><button type="button" class="btn btn-danger btn-sm" onclick="this.closest(\'tr\').remove(); aggiornaTotaleOreOperaiPotatura();">Elimina</button></td>';
    tbody.appendChild(tr);
    tr.querySelector('.input-ore-operaio-potatura').addEventListener('input', aggiornaTotaleOreOperaiPotatura);
    aggiornaTotaleOreOperaiPotatura();
};

function aggiornaTotaleOreOperaiPotatura() {
    const tbody = document.getElementById('operai-tabella-body-potatura');
    const footer = document.getElementById('operai-tabella-footer-potatura');
    if (!tbody) return;
    const righe = tbody.querySelectorAll('tr');
    let tot = 0;
    righe.forEach(r => {
        const inp = r.querySelector('.input-ore-operaio-potatura');
        if (inp) tot += parseFloat(inp.value) || 0;
    });
    const totEl = document.getElementById('totale-ore-operai-potatura');
    if (totEl) totEl.textContent = tot.toFixed(1);
    if (footer) footer.style.display = righe.length > 0 ? 'table-footer-group' : 'none';
}

function popolaTabellaOperaiPotatura(operaiData) {
    const tbody = document.getElementById('operai-tabella-body-potatura');
    if (!tbody) return;
    tbody.innerHTML = '';
    (operaiData || []).forEach(op => {
        const tr = document.createElement('tr');
        const dataStr = op.data ? (op.data instanceof Date ? op.data.toISOString().slice(0, 10) : op.data) : '';
        tr.innerHTML = '<td><input type="date" class="input-data-operaio-potatura" value="' + dataStr + '"></td><td><input type="text" placeholder="Nome" class="input-nome-operaio-potatura" value="' + (op.nome || '') + '"></td><td><input type="number" step="0.01" min="0" class="input-ore-operaio-potatura" value="' + (op.ore || 0) + '"></td><td><button type="button" class="btn btn-danger btn-sm">Elimina</button></td>';
        tr.querySelector('button').addEventListener('click', function() { tr.remove(); aggiornaTotaleOreOperaiPotatura(); });
        tr.querySelector('.input-ore-operaio-potatura').addEventListener('input', aggiornaTotaleOreOperaiPotatura);
        tbody.appendChild(tr);
    });
    if (operaiData.length === 0) window.aggiungiRigaOperaioPotatura();
    else aggiornaTotaleOreOperaiPotatura();
}

function popolaTabellaMacchinePotatura(macchineData) {
    const tbody = document.getElementById('macchine-tabella-body-potatura');
    if (!tbody) return;
    tbody.innerHTML = '';
    (macchineData || []).forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (m.tipo || '-') + '</td><td>' + (m.nome || '-') + '</td><td>' + (m.ore !== undefined ? Number(m.ore).toFixed(2) : '-') + '</td>';
        tbody.appendChild(tr);
    });
}

async function caricaMacchinePerPotatura(potatura) {
    await loadMacchinePotatura();
    let macchine = await loadMacchinePotatura();
    let macchineData = [];
    
    // Se c'è un lavoro collegato, carica macchine dal lavoro
    if (potatura.lavoroId) {
        try {
            const { getCurrentTenantId } = await import(resolvePath('../../../core/services/tenant-service.js'));
            const { getDb, collection, query, where, getDocs } = await import(resolvePath('../../../core/services/firebase-service.js'));
            const tenantId = getCurrentTenantId();
            const db = getDb();
            if (tenantId && db) {
                const oreRef = collection(db, `tenants/${tenantId}/lavori/${potatura.lavoroId}/oreOperai`);
                const q = query(oreRef, where('stato', '==', 'validate'));
                const snap = await getDocs(q);
                const macchineMap = {};
                snap.forEach(oraDoc => {
                    const ora = oraDoc.data();
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
                });
                macchineData = Object.values(macchineMap);
            }
        } catch (e) {
            console.warn('[POTATURA-FRUTTETO] caricaMacchinePerPotatura da lavoro:', e);
        }
    }
    
    // Se c'è un'attività collegata (senza lavoro), carica macchine dall'attività
    if (potatura.attivitaId && !potatura.lavoroId) {
        const { getAttivita } = await import(resolvePath('../../../core/services/attivita-service.js'));
        const att = await getAttivita(potatura.attivitaId);
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
    }
    
    // Se ci sono macchine salvate direttamente nella potatura
    if (potatura.macchine && Array.isArray(potatura.macchine) && potatura.macchine.length > 0 && macchineData.length === 0) {
        potatura.macchine.forEach(m => {
            if (typeof m === 'object' && m.nome) macchineData.push({ tipo: m.tipo || 'Trattore', nome: m.nome, ore: m.ore || m.oreTotali || 0 });
        });
    }
    
    popolaTabellaMacchinePotatura(macchineData);
}

async function loadFrutteti() {
    const { getAllFrutteti } = await import(resolvePath('../services/frutteti-service.js'));
    frutteti = await getAllFrutteti();
    const selFilter = document.getElementById('filter-frutteto');
    const selModal = document.getElementById('potatura-frutteto');
    [selFilter, selModal].forEach(sel => {
        if (!sel) return;
        sel.innerHTML = sel === selFilter ? '<option value="">Tutti i frutteti</option>' : '<option value="">Seleziona frutteto</option>';
        frutteti.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.specie || f.varieta || f.nome || f.id;
            sel.appendChild(opt);
        });
    });
    const annoCorrente = new Date().getFullYear();
    const annoSel = document.getElementById('filter-anno');
    annoSel.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const y = annoCorrente - i;
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (i === 0) opt.selected = true;
        annoSel.appendChild(opt);
    }
}

async function loadPotature() {
    const fid = document.getElementById('filter-frutteto').value || null;
    const annoVal = document.getElementById('filter-anno').value;
    const anno = annoVal ? parseInt(annoVal, 10) : null;
    currentFruttetoId = fid;
    currentAnno = anno;

    const loading = document.getElementById('loading');
    const tableWrap = document.getElementById('table-wrap');
    const empty = document.getElementById('empty-state');
    const tbody = document.getElementById('tbody-potature');

    loading.style.display = 'block';
    tableWrap.style.display = 'none';
    empty.style.display = 'none';

    try {
        const { getAllPotatureFrutteti } = await import(resolvePath('../services/potatura-frutteto-service.js'));
        potature = await getAllPotatureFrutteti({
            anno: anno || new Date().getFullYear(),
            fruttetoId: fid || null
        });
    } catch (e) {
        console.error(e);
        potature = [];
    }

    loading.style.display = 'none';
    if (potature.length === 0) {
        empty.style.display = 'block';
        empty.innerHTML = '<p>Nessuna potatura per l\'anno selezionato. Crea un lavoro o un\'attività con categoria Potatura (Gestione lavori o Diario) su un terreno con frutteto.</p>';
        return;
    }

    try {
        const { getDatiPrecompilazionePotatura } = await import(resolvePath('../services/potatura-frutteto-service.js'));
        const potatureConDisplay = await Promise.all(potature.map(async (p) => {
            let tipoDisplay = p.tipo;
            let pianteDisplay = p.piantePotate;
            let costoDisplay = p.costoTotale;
            if (p.lavoroId || p.attivitaId) {
                try {
                    const prefill = await getDatiPrecompilazionePotatura(p.fruttetoId, p);
                    if (prefill.tipoPotatura) tipoDisplay = prefill.tipoPotatura;
                    if (prefill.piantePotate != null) pianteDisplay = prefill.piantePotate;
                    if (prefill.costoManodopera != null || prefill.costoMacchina != null) {
                        costoDisplay = (prefill.costoManodopera || 0) + (prefill.costoMacchina || 0);
                    }
                } catch (e) {
                    console.warn('[Potatura frutteto lista] prefill per', p.id, e);
                }
            }
            return { ...p, tipoDisplay, pianteDisplay, costoDisplay };
        }));

        empty.style.display = 'none';
        tableWrap.style.display = 'block';
        const tipoLabels = { invernale: '❄️ Invernale', verde: '🌿 Verde', formazione: '🌱 Formazione', rinnovo: '🔄 Rinnovo', diradamento: '✂️ Diradamento' };
        const gestioneLavoriUrl = resolvePath('../../../core/admin/gestione-lavori-standalone.html');
        const attivitaUrl = resolvePath('../../../core/attivita-standalone.html');
        tbody.innerHTML = potatureConDisplay.map(p => {
            const fruttetoNome = frutteti.find(f => f.id === p.fruttetoId);
            const fruttetoLabel = fruttetoNome ? (fruttetoNome.specie || fruttetoNome.varieta || fruttetoNome.nome || p.fruttetoId) : p.fruttetoId || '-';
            const tipoLabel = tipoLabels[p.tipoDisplay] || p.tipoDisplay || '-';
            const costo = (p.costoDisplay != null && p.costoDisplay !== '') ? Number(p.costoDisplay).toFixed(2) : '-';
            let lavoroCell = '-';
            if (p.lavoroId) {
                lavoroCell = `<a href="${gestioneLavoriUrl}?lavoroId=${encodeURIComponent(p.lavoroId)}" target="_blank" class="link-lavoro">🔗 Vedi Lavoro</a>`;
            } else if (p.attivitaId) {
                lavoroCell = `<a href="${attivitaUrl}?attivitaId=${encodeURIComponent(p.attivitaId)}" target="_blank" class="link-lavoro">🔗 Vedi Attività</a>`;
            }
            const fruttetoId = p.fruttetoId;
            return `<tr>
                <td>${formatDate(p.data)}</td>
                <td>${fruttetoLabel}</td>
                <td>${tipoLabel}</td>
                <td>${(p.pianteDisplay != null && p.pianteDisplay !== '') ? Number(p.pianteDisplay) : '-'}</td>
                <td>${p.oreImpiegate != null ? p.oreImpiegate : '-'}</td>
                <td>${costo}</td>
                <td>${lavoroCell}</td>
                <td>
                    <button type="button" class="btn btn-secondary btn-sm" data-edit="${p.id}" data-frutteto-id="${fruttetoId}">Modifica</button>
                    <button type="button" class="btn btn-danger btn-sm" data-delete="${p.id}" data-frutteto-id="${fruttetoId}">Elimina</button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openModalEdit(btn.getAttribute('data-frutteto-id'), btn.getAttribute('data-edit'))));
        tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deletePotaturaConfirm(btn.getAttribute('data-frutteto-id'), btn.getAttribute('data-delete'))));
    } catch (err) {
        console.error('Errore rendering elenco potature:', err);
        tableWrap.style.display = 'none';
        empty.style.display = 'block';
        empty.innerHTML = '<p>Errore nel caricamento dell\'elenco. Controlla la console per dettagli.</p>';
    }
}

let currentPotaturaOperaiIds = null;

function openModalNew() {
    currentPotaturaOperaiIds = null;
    potaturaFromAttivitaOnly = true;
    document.getElementById('modal-title').textContent = 'Nuova potatura';
    document.getElementById('potatura-id').value = '';
    document.getElementById('potatura-frutteto-id').value = currentFruttetoId || '';
    document.getElementById('lavoro-id-hidden').value = '';
    document.getElementById('dati-lavoro-section').style.display = 'none';
    poligonoCoords = [];
    const poligonoInfo = document.getElementById('poligono-info-potatura');
    if (poligonoInfo) poligonoInfo.style.display = 'none';
    const sel = document.getElementById('potatura-frutteto');
    sel.value = currentFruttetoId || (frutteti.length ? frutteti[0].id : '');
    document.getElementById('potatura-data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('potatura-tipo').value = '';
    document.getElementById('potatura-piante').value = '';
    const supHa = document.getElementById('potatura-superficie-ha');
    if (supHa) supHa.value = '';
    const pianteInfo = document.getElementById('potatura-piante-info');
    if (pianteInfo) pianteInfo.style.display = 'none';
    const tbodyOp = document.getElementById('operai-tabella-body-potatura');
    if (tbodyOp) { tbodyOp.innerHTML = ''; window.aggiungiRigaOperaioPotatura(); }
    document.getElementById('operai-tabella-section').style.display = 'block';
    document.getElementById('macchine-tabella-section').style.display = 'none';
    document.getElementById('potatura-ore').value = '';
    document.getElementById('potatura-costo-mano').value = '0';
    document.getElementById('potatura-costo-macchina').value = '0';
    document.getElementById('potatura-note').value = '';
    const btnTracciaF = document.getElementById('btn-traccia-area');
    if (btnTracciaF) { btnTracciaF.textContent = 'Traccia'; btnTracciaF.title = 'Traccia area potata sulla mappa'; }
    document.getElementById('modal-potatura').classList.add('active');
}

async function openModalEdit(fruttetoId, potaturaId) {
    const { getPotatura, getDatiPrecompilazionePotatura } = await import(resolvePath('../services/potatura-frutteto-service.js'));
    const p = await getPotatura(fruttetoId, potaturaId);
    if (!p) { showAlert('Potatura non trovata', 'error'); return; }
    document.getElementById('modal-title').textContent = 'Modifica potatura';
    document.getElementById('potatura-id').value = potaturaId;
    document.getElementById('potatura-frutteto-id').value = fruttetoId;
    document.getElementById('potatura-frutteto').value = fruttetoId;
    const dataVal = p.data instanceof Date ? p.data : (p.data?.toDate ? p.data.toDate() : new Date(p.data));
    document.getElementById('potatura-data').value = dataVal.toISOString ? dataVal.toISOString().slice(0, 10) : '';
    document.getElementById('potatura-tipo').value = p.tipo || '';
    document.getElementById('potatura-piante').value = p.piantePotate ?? '';
    document.getElementById('potatura-ore').value = p.oreImpiegate ?? '';
    document.getElementById('potatura-costo-mano').value = p.costoManodopera ?? 0;
    document.getElementById('potatura-costo-macchina').value = p.costoMacchina ?? 0;
    document.getElementById('potatura-note').value = p.note || '';

    document.getElementById('lavoro-id-hidden').value = p.lavoroId || '';
    document.getElementById('attivita-id-hidden').value = p.attivitaId || '';

    const datiLavoroSection = document.getElementById('dati-lavoro-section');
    const operaiTabellaSection = document.getElementById('operai-tabella-section');
    const macchineTabellaSection = document.getElementById('macchine-tabella-section');

    let superficieDalLavoro = null;
    if (p.lavoroId) {
        datiLavoroSection.style.display = 'block';
        await loadMacchinePotatura();
        superficieDalLavoro = await loadDatiLavoroPotaturaFrutteto(p.lavoroId);
        operaiTabellaSection.style.display = 'none';
    } else {
        datiLavoroSection.style.display = 'none';
        operaiTabellaSection.style.display = 'block';
        if (p.operai && Array.isArray(p.operai) && p.operai.length > 0) {
            const opData = p.operai.map(op => typeof op === 'object' && op.nome !== undefined ? op : { nome: '', data: null, ore: 0 });
            popolaTabellaOperaiPotatura(opData);
        } else window.aggiungiRigaOperaioPotatura();
    }

    if (p.lavoroId || p.attivitaId) {
        macchineTabellaSection.style.display = 'block';
        await caricaMacchinePerPotatura(p);
    } else {
        macchineTabellaSection.style.display = 'none';
    }

    potaturaFromAttivitaOnly = !!(p.attivitaId && !p.lavoroId);
    const btnTracciaF = document.getElementById('btn-traccia-area');
    if (btnTracciaF) {
        btnTracciaF.textContent = p.lavoroId ? 'Visualizza zona' : 'Traccia';
        btnTracciaF.title = p.lavoroId ? 'Visualizza zona tracciata nel lavoro collegato (sola consultazione)' : 'Traccia area potata sulla mappa';
    }
    const supHaInput = document.getElementById('potatura-superficie-ha');
    const pianteInfoBox = document.getElementById('potatura-piante-info');
    if (p.poligonoPotatura && p.poligonoPotatura.length >= 3) {
        poligonoCoords = p.poligonoPotatura.map(c => ({ lat: c.lat, lng: c.lng }));
        const poligonoInfo = document.getElementById('poligono-info-potatura');
        if (poligonoInfo) poligonoInfo.style.display = 'block';
        if (typeof google !== 'undefined' && google.maps && google.maps.geometry) {
            const path = poligonoCoords.map(c => new google.maps.LatLng(c.lat, c.lng));
            const areaMq = google.maps.geometry.spherical.computeArea(path);
            const areaHa = areaMq / 10000;
            if (supHaInput) supHaInput.value = areaHa.toFixed(2);
            updatePianteFromSuperficieFrutteto();
        }
    } else if (p.lavoroId) {
        const fromLavoro = await loadPoligonoFromZoneLavoratePotaturaFrutteto(p.lavoroId);
        if (fromLavoro && fromLavoro.length >= 3) {
            poligonoCoords = fromLavoro;
            const poligonoInfo = document.getElementById('poligono-info-potatura');
            if (poligonoInfo) poligonoInfo.style.display = 'block';
            if (typeof google !== 'undefined' && google.maps && google.maps.geometry && supHaInput) {
                const path = poligonoCoords.map(c => new google.maps.LatLng(c.lat, c.lng));
                const areaMq = google.maps.geometry.spherical.computeArea(path);
                supHaInput.value = (areaMq / 10000).toFixed(2);
                updatePianteFromSuperficieFrutteto();
            }
        } else {
            poligonoCoords = [];
            const poligonoInfo = document.getElementById('poligono-info-potatura');
            if (poligonoInfo) poligonoInfo.style.display = 'none';
            if (pianteInfoBox) pianteInfoBox.style.display = 'none';
        }
    } else {
        poligonoCoords = [];
        const poligonoInfo = document.getElementById('poligono-info-potatura');
        if (poligonoInfo) poligonoInfo.style.display = 'none';
        if (pianteInfoBox) pianteInfoBox.style.display = 'none';
    }

    try {
        const prefill = await getDatiPrecompilazionePotatura(fruttetoId, p, { hasManodoperaModule });
        if (prefill.tipoPotatura) document.getElementById('potatura-tipo').value = prefill.tipoPotatura;
        if (prefill.piantePotate != null) document.getElementById('potatura-piante').value = prefill.piantePotate;
        document.getElementById('potatura-costo-mano').value = prefill.costoManodopera ?? 0;
        document.getElementById('potatura-costo-macchina').value = prefill.costoMacchina ?? 0;
    } catch (e) { console.warn('Precompilazione potatura frutteto:', e); }

    currentPotaturaOperaiIds = Array.isArray(p.operai) ? p.operai : null;
    document.getElementById('modal-potatura').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-potatura').classList.remove('active');
}

async function savePotatura(e) {
    e.preventDefault();
    const id = document.getElementById('potatura-id').value.trim();
    const fruttetoId = document.getElementById('potatura-frutteto').value;
    if (!fruttetoId) { showAlert('Seleziona un frutteto', 'error'); return; }

    let operaiPayload = [];
    const opSection = document.getElementById('operai-tabella-section');
    if (opSection && opSection.style.display !== 'none') {
        const tbody = document.getElementById('operai-tabella-body-potatura');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const dataInp = tr.querySelector('.input-data-operaio-potatura');
                const nomeInp = tr.querySelector('.input-nome-operaio-potatura');
                const oreInp = tr.querySelector('.input-ore-operaio-potatura');
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
    } else if (currentPotaturaOperaiIds && currentPotaturaOperaiIds.length > 0) {
        operaiPayload = currentPotaturaOperaiIds;
    }

    const lavoroIdVal = document.getElementById('lavoro-id-hidden').value.trim();
    const attivitaIdVal = document.getElementById('attivita-id-hidden').value.trim();
    let costoManodopera = parseFloat(document.getElementById('potatura-costo-mano').value) || 0;
    let costoMacchina = parseFloat(document.getElementById('potatura-costo-macchina').value) || 0;
    
    // Se costo manodopera o macchina è 0 ma c'è un lavoro collegato, ricalcola automaticamente
    if (lavoroIdVal && (costoManodopera === 0 || costoMacchina === 0)) {
        try {
            const { calcolaCostiLavoro } = await import(resolvePath('../../../modules/vigneto/services/lavori-vigneto-service.js'));
            const { getLavoro } = await import(resolvePath('../../../core/services/lavori-service.js'));
            const lavoro = await getLavoro(lavoroIdVal);
            if (lavoro) {
                const costi = await calcolaCostiLavoro(lavoroIdVal, lavoro);
                if (costoManodopera === 0 && costi.costoManodopera) {
                    costoManodopera = costi.costoManodopera;
                }
                if (costoMacchina === 0 && costi.costoMacchine) {
                    costoMacchina = costi.costoMacchine;
                }
            }
        } catch (e) {
            console.warn('[POTATURA-FRUTTETO] Ricalcolo costo da lavoro:', e);
        }
    }
    
    // Se costo manodopera è 0 ma c'è un'attività collegata, ricalcola automaticamente
    if (costoManodopera === 0 && attivitaIdVal && !lavoroIdVal) {
        try {
            const { getAttivita } = await import(resolvePath('../../../core/services/attivita-service.js'));
            const attivita = await getAttivita(attivitaIdVal);
            if (attivita) {
                const oreNette = attivita.oreNette || 0;
                if (oreNette > 0) {
                    const { getTariffaProprietario } = await import(resolvePath('../../../core/services/calcolo-compensi-service.js'));
                    const { getCurrentTenantId } = await import(resolvePath('../../../core/services/tenant-service.js'));
                    const tenantId = getCurrentTenantId();
                    const tariffaProprietario = await getTariffaProprietario(tenantId);
                    costoManodopera = oreNette * tariffaProprietario;
                }
                
                // Ricalcola anche costo macchina se presente
                const oreMacchina = attivita.oreMacchina || 0;
                if (oreMacchina > 0 && costoMacchina === 0 && (attivita.macchinaId || attivita.attrezzoId)) {
                    try {
                        const { hasModuleAccess } = await import(resolvePath('../../../core/services/tenant-service.js'));
                        const hasParcoMacchineModule = await hasModuleAccess('parcoMacchine');
                        if (hasParcoMacchineModule) {
                            const { getMacchina } = await import(resolvePath('../../../modules/parco-macchine/services/macchine-service.js'));
                            const macchinaId = attivita.macchinaId || attivita.attrezzoId;
                            if (macchinaId) {
                                const macchina = await getMacchina(macchinaId);
                                if (macchina && macchina.costoOra) {
                                    costoMacchina = oreMacchina * parseFloat(macchina.costoOra);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[POTATURA-FRUTTETO] Ricalcolo costo macchina:', e);
                    }
                }
            }
        } catch (e) {
            console.warn('[POTATURA-FRUTTETO] Ricalcolo costo da attività:', e);
        }
    }
    
    const data = {
        data: new Date(document.getElementById('potatura-data').value),
        tipo: document.getElementById('potatura-tipo').value,
        parcella: null,
        piantePotate: parseInt(document.getElementById('potatura-piante').value, 10),
        operai: operaiPayload,
        oreImpiegate: parseFloat(document.getElementById('potatura-ore').value),
        costoManodopera,
        costoMacchina,
        note: document.getElementById('potatura-note').value.trim() || null
    };
    if (lavoroIdVal) data.lavoroId = lavoroIdVal;
    if (attivitaIdVal) data.attivitaId = attivitaIdVal;
    if (poligonoCoords && poligonoCoords.length >= 3) {
        data.poligonoPotatura = poligonoCoords.map(c => typeof c.lat === 'function' ? { lat: c.lat(), lng: c.lng() } : { lat: c.lat, lng: c.lng });
    }

    try {
        const { createPotatura, updatePotatura } = await import(resolvePath('../services/potatura-frutteto-service.js'));
        if (id) {
            await updatePotatura(fruttetoId, id, data);
            showAlert('Potatura aggiornata.', 'success');
        } else {
            await createPotatura(fruttetoId, data);
            showAlert('Potatura registrata.', 'success');
        }
        closeModal();
        await loadPotature();
    } catch (err) {
        showAlert(err.message || 'Errore salvataggio', 'error');
    }
}

async function deletePotaturaConfirm(fruttetoId, potaturaId) {
    if (!confirm('Eliminare questa potatura?')) return;
    try {
        const { deletePotatura } = await import(resolvePath('../services/potatura-frutteto-service.js'));
        await deletePotatura(fruttetoId, potaturaId);
        showAlert('Potatura eliminata.', 'success');
        await loadPotature();
    } catch (err) {
        showAlert(err.message || 'Errore eliminazione', 'error');
    }
}

function loadGoogleMapsPotaturaFrutteto() {
    return new Promise((resolve) => {
        if (typeof google !== 'undefined' && google.maps) { resolve(); return; }
        if (document.querySelector('script[src*="maps.googleapis.com"]')) {
            let n = 0;
            const t = setInterval(() => {
                if (typeof google !== 'undefined' && google.maps) { clearInterval(t); resolve(); }
                else if (++n > 50) { clearInterval(t); resolve(); }
            }, 100);
            return;
        }
        const key = window.GOOGLE_MAPS_API_KEY || 'AIzaSyDno2cpcMHfs_FqhD4-hi_esj6pBixyJBk';
        const s = document.createElement('script');
        s.src = 'https://maps.googleapis.com/maps/api/js?key=' + key + '&libraries=geometry&loading=async';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => resolve();
        document.head.appendChild(s);
    });
}

async function initMappaPotaturaFrutteto(terreno) {
    if (!terreno || !terreno.polygonCoords || terreno.polygonCoords.length === 0) return;
    const container = document.getElementById('mappa-potatura-frutteto-container');
    if (!container) return;
    const center = { lat: terreno.polygonCoords[0].lat, lng: terreno.polygonCoords[0].lng };
    mappaPotaturaFrutteto = new google.maps.Map(container, {
        center,
        zoom: 15,
        mapTypeId: 'satellite',
        mapTypeControl: true,
        streetViewControl: false
    });
    const terrenoCoords = terreno.polygonCoords.map(c => new google.maps.LatLng(c.lat, c.lng));
    if (terrenoPolygonFrutteto) terrenoPolygonFrutteto.setMap(null);
    terrenoPolygonFrutteto = new google.maps.Polygon({
        paths: terrenoCoords,
        fillColor: '#2E8B57',
        fillOpacity: 0.2,
        strokeColor: '#2E8B57',
        strokeWeight: 3,
        strokeOpacity: 0.8,
        editable: false,
        clickable: false,
        zIndex: 1
    });
    terrenoPolygonFrutteto.setMap(mappaPotaturaFrutteto);
    terrenoBoundaryCoordsFrutteto = terrenoCoords;
    const bounds = new google.maps.LatLngBounds();
    terrenoCoords.forEach(c => bounds.extend(c));
    mappaPotaturaFrutteto.fitBounds(bounds);
}

function aggiornaInfoPoligonoPotaturaFrutteto() {
    const infoEl = document.getElementById('mappa-info-potatura-frutteto');
    const supEl = document.getElementById('superficie-calcolata-potatura-frutteto');
    const puntiEl = document.getElementById('punti-tracciati-potatura-frutteto');
    const btnClear = document.getElementById('btn-clear-polygon-potatura-frutteto');
    const btnConferma = document.getElementById('btn-conferma-polygon-potatura-frutteto');
    const btnSave = document.getElementById('btn-save-polygon-potatura-frutteto');
    if (poligonoPotaturaPolyFrutteto) {
        const path = poligonoPotaturaPolyFrutteto.getPath();
        poligonoCoords = [];
        for (let i = 0; i < path.getLength(); i++) poligonoCoords.push({ lat: path.getAt(i).lat(), lng: path.getAt(i).lng() });
    }
    if (poligonoCoords.length >= 3) {
        if (infoEl) infoEl.style.display = 'block';
        if (puntiEl) puntiEl.textContent = String(poligonoCoords.length);
        if (poligonoPotaturaPolyFrutteto && google.maps.geometry) {
            const areaMq = google.maps.geometry.spherical.computeArea(poligonoPotaturaPolyFrutteto.getPath());
            if (supEl) supEl.textContent = (areaMq / 10000).toFixed(2) + ' ha';
        } else if (supEl) supEl.textContent = '-';
        if (btnClear) btnClear.style.display = 'inline-block';
        if (btnConferma) btnConferma.style.display = 'inline-block';
        if (btnSave) btnSave.style.display = 'inline-block';
    } else {
        if (infoEl) infoEl.style.display = 'none';
        if (btnClear) btnClear.style.display = 'none';
        if (btnConferma) btnConferma.style.display = 'none';
        if (btnSave) btnSave.style.display = 'none';
    }
}

function aggiornaPoligonoSullaMappaPotaturaFrutteto() {
    if (!mappaPotaturaFrutteto || poligonoCoords.length < 2) return;
    if (poligonoPotaturaPolyFrutteto) poligonoPotaturaPolyFrutteto.setMap(null);
    const path = poligonoCoords.map(c => typeof c.lat === 'function' ? c : new google.maps.LatLng(c.lat, c.lng));
    poligonoPotaturaPolyFrutteto = new google.maps.Polygon({
        paths: path,
        fillColor: '#FF6F00',
        fillOpacity: 0.4,
        strokeColor: '#E65100',
        strokeWeight: 4,
        strokeOpacity: 1.0,
        editable: true,
        draggable: false,
        map: mappaPotaturaFrutteto
    });
    google.maps.event.addListener(poligonoPotaturaPolyFrutteto.getPath(), 'set_at', function() {
        poligonoCoords = [];
        const p = poligonoPotaturaPolyFrutteto.getPath();
        for (let i = 0; i < p.getLength(); i++) poligonoCoords.push({ lat: p.getAt(i).lat(), lng: p.getAt(i).lng() });
        aggiornaInfoPoligonoPotaturaFrutteto();
    });
    google.maps.event.addListener(poligonoPotaturaPolyFrutteto.getPath(), 'insert_at', function() {
        poligonoCoords = [];
        const p = poligonoPotaturaPolyFrutteto.getPath();
        for (let i = 0; i < p.getLength(); i++) poligonoCoords.push({ lat: p.getAt(i).lat(), lng: p.getAt(i).lng() });
        aggiornaInfoPoligonoPotaturaFrutteto();
    });
    google.maps.event.addListener(poligonoPotaturaPolyFrutteto.getPath(), 'remove_at', function() {
        poligonoCoords = [];
        const p = poligonoPotaturaPolyFrutteto.getPath();
        for (let i = 0; i < p.getLength(); i++) poligonoCoords.push({ lat: p.getAt(i).lat(), lng: p.getAt(i).lng() });
        aggiornaInfoPoligonoPotaturaFrutteto();
    });
    aggiornaInfoPoligonoPotaturaFrutteto();
}

function caricaPoligonoEsistentePotaturaFrutteto(coords, soloConsultazione) {
    if (!mappaPotaturaFrutteto || !coords || coords.length < 3) return;
    poligonoCoords = coords.map(c => c.lat != null ? { lat: c.lat, lng: c.lng } : { lat: c.lat(), lng: c.lng() });
    if (soloConsultazione) {
        if (poligonoPotaturaPolyFrutteto) poligonoPotaturaPolyFrutteto.setMap(null);
        const path = poligonoCoords.map(c => new google.maps.LatLng(c.lat, c.lng));
        poligonoPotaturaPolyFrutteto = new google.maps.Polygon({
            paths: path,
            fillColor: '#FF6F00',
            fillOpacity: 0.4,
            strokeColor: '#E65100',
            strokeWeight: 4,
            strokeOpacity: 1.0,
            editable: false,
            draggable: false,
            map: mappaPotaturaFrutteto
        });
        aggiornaInfoPoligonoPotaturaFrutteto();
        return;
    }
    aggiornaPoligonoSullaMappaPotaturaFrutteto();
}

window.apriMappaTracciamentoPotaturaFrutteto = async function apriMappaTracciamentoPotaturaFrutteto() {
    if (typeof google === 'undefined' || !google.maps) {
        // Aspetta che Google Maps sia caricato (max 5 secondi)
        let attempts = 0;
        const maxAttempts = 50;
        while (attempts < maxAttempts && (typeof google === 'undefined' || !google.maps)) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (typeof google === 'undefined' || !google.maps) {
            alert('Google Maps non è ancora caricato. Attendi qualche secondo e riprova.');
            return;
        }
    }
    
    const lavoroId = document.getElementById('lavoro-id-hidden').value.trim();
    const soloConsultazione = lavoroId !== '' && !potaturaFromAttivitaOnly;
    window.potaturaMappaSoloConsultazioneFrutteto = soloConsultazione;

    const fruttetoId = document.getElementById('potatura-frutteto').value;
    if (!fruttetoId) {
        alert('Seleziona prima un frutteto');
        return;
    }
    
    const frutteto = frutteti.find(f => f.id === fruttetoId);
    if (!frutteto || !frutteto.terrenoId) {
        alert('Frutteto senza terreno associato');
        return;
    }
    
    // Carica terreno per visualizzare confini
    const { getTerreno } = await import(resolvePath('../../../core/services/terreni-service.js'));
    const terreno = await getTerreno(frutteto.terrenoId);
    if (!terreno || !terreno.polygonCoords || terreno.polygonCoords.length === 0) {
        alert('Il terreno selezionato non ha confini tracciati. Traccia prima i confini del terreno.');
        return;
    }
    
    // Apri modal mappa
    document.getElementById('modal-mappa-potatura-frutteto').classList.add('active');
    
    // Inizializza mappa se non già inizializzata
    if (!mappaPotaturaFrutteto) {
        await initMappaPotaturaFrutteto(terreno);
    } else {
        // Ricarica terreno se necessario
        await caricaTerrenoSullaMappaPotaturaFrutteto(terreno);
    }
    
    // Carica poligono esistente se presente
    // Priorità: 1) poligono tracciato nella sessione corrente, 2) poligono salvato nella potatura
    setTimeout(async () => {
        if (!mappaPotaturaFrutteto) return;
        
        // Se c'è già un poligono tracciato nella sessione, usalo
        if (poligonoCoords && poligonoCoords.length >= 3) {
            // Converti in LatLng se necessario
            if (typeof poligonoCoords[0] === 'object' && poligonoCoords[0].lat !== undefined && typeof poligonoCoords[0].lat !== 'function') {
                // Sono oggetti {lat, lng}, converti in LatLng
                poligonoCoords = poligonoCoords.map(c => new google.maps.LatLng(c.lat, c.lng));
            }
            caricaPoligonoEsistentePotaturaFrutteto(poligonoCoords, soloConsultazione);
            aggiornaInfoPoligonoPotaturaFrutteto();
        } else {
            // Altrimenti, carica poligono salvato nella potatura (se si sta modificando)
            const potaturaId = document.getElementById('potatura-id').value;
            if (potaturaId && fruttetoId) {
                try {
                    const { getPotatura } = await import(resolvePath('../services/potatura-frutteto-service.js'));
                    const potaturaEsistente = await getPotatura(fruttetoId, potaturaId);
                    if (potaturaEsistente && potaturaEsistente.poligonoPotatura && potaturaEsistente.poligonoPotatura.length > 0) {
                        caricaPoligonoEsistentePotaturaFrutteto(potaturaEsistente.poligonoPotatura, soloConsultazione);
                    }
                } catch (error) {
                    console.error('Errore caricamento potatura esistente:', error);
                }
            }
        }
    }, 500);

    if (soloConsultazione) {
        document.getElementById('mappa-potatura-frutteto-solo-consultazione').style.display = 'block';
        document.getElementById('btn-draw-polygon-potatura-frutteto').style.display = 'none';
        document.getElementById('btn-clear-polygon-potatura-frutteto').style.display = 'none';
        document.getElementById('btn-save-polygon-potatura-frutteto').style.display = 'none';
        document.getElementById('btn-conferma-polygon-potatura-frutteto').style.display = 'none';
    } else {
        document.getElementById('mappa-potatura-frutteto-solo-consultazione').style.display = 'none';
        document.getElementById('btn-draw-polygon-potatura-frutteto').style.display = 'inline-block';
    }
};

window.chiudiMappaTracciamentoPotaturaFrutteto = function() {
    if (isDrawingPolygonFrutteto && mappaPotaturaFrutteto) {
        isDrawingPolygonFrutteto = false;
        const mapContainer = document.querySelector('#modal-mappa-potatura-frutteto .modal-mappa-body');
        if (mapContainer) mapContainer.classList.remove('drawing-mode');
        const mappaEl = document.getElementById('mappa-potatura-frutteto-container');
        if (mappaEl) {
            mappaEl.style.cursor = '';
            mappaEl.querySelectorAll('div').forEach(d => { d.style.cursor = ''; });
            mappaEl.querySelectorAll('canvas').forEach(c => { c.style.cursor = ''; });
        }
        const btn = document.getElementById('btn-draw-polygon-potatura-frutteto');
        if (btn) { btn.textContent = '✏️ Traccia Poligono'; btn.style.background = '#17a2b8'; }
        if (mappaPotaturaFrutteto.clickListenerPotaturaFrutteto) {
            google.maps.event.removeListener(mappaPotaturaFrutteto.clickListenerPotaturaFrutteto);
            mappaPotaturaFrutteto.clickListenerPotaturaFrutteto = null;
        }
    }
    document.getElementById('modal-mappa-potatura-frutteto').classList.remove('active');
};

function updatePianteFromSuperficieFrutteto() {
    const supInput = document.getElementById('potatura-superficie-ha');
    const pianteInput = document.getElementById('potatura-piante');
    const infoBox = document.getElementById('potatura-piante-info');
    const calcolateSpan = document.getElementById('potatura-piante-calcolate');
    if (!supInput || !pianteInput || !infoBox || !calcolateSpan) return;
    const areaHa = parseFloat(supInput.value);
    if (isNaN(areaHa) || areaHa <= 0) {
        infoBox.style.display = 'none';
        return;
    }
    const fruttetoId = document.getElementById('potatura-frutteto').value;
    const frutteto = frutteti.find(f => f.id === fruttetoId);
    const densita = frutteto ? (frutteto.densita != null ? Number(frutteto.densita) : null) : null;
    if (densita != null && densita > 0) {
        const piante = Math.round(areaHa * densita);
        pianteInput.value = piante > 0 ? piante : '';
        calcolateSpan.textContent = piante + ' (da superficie ' + areaHa.toFixed(2) + ' ha × ' + densita + ' piante/ha)';
        infoBox.style.display = 'block';
    } else {
        calcolateSpan.textContent = '-';
        infoBox.style.display = 'none';
    }
}

window.confermaPoligonoPotaturaFrutteto = function() {
    if (poligonoCoords.length < 3) return;
    document.getElementById('poligono-info-potatura').style.display = 'block';
    const supInput = document.getElementById('potatura-superficie-ha');
    if (typeof google !== 'undefined' && google.maps && google.maps.geometry && supInput) {
        const path = poligonoCoords.map(c => typeof c.lat === 'function' ? new google.maps.LatLng(c.lat(), c.lng()) : new google.maps.LatLng(c.lat, c.lng));
        const areaMq = google.maps.geometry.spherical.computeArea(path);
        const areaHa = areaMq / 10000;
        supInput.value = areaHa.toFixed(2);
        updatePianteFromSuperficieFrutteto();
    }
    chiudiMappaTracciamentoPotaturaFrutteto();
};

window.salvaPoligonoPotaturaFrutteto = function() {
    alert('Poligono tracciato! Clicca "Conferma e Applica" per salvare e applicare la superficie.');
};

window.eliminaPoligonoPotaturaFrutteto = function() {
    if (poligonoPotaturaPolyFrutteto) { poligonoPotaturaPolyFrutteto.setMap(null); poligonoPotaturaPolyFrutteto = null; }
    poligonoCoords = [];
    firstPointFrutteto = null;
    aggiornaInfoPoligonoPotaturaFrutteto();
};

window.iniziaTracciamentoPoligonoPotaturaFrutteto = function() {
    if (!mappaPotaturaFrutteto) return;
    const mapContainer = document.querySelector('#modal-mappa-potatura-frutteto .modal-mappa-body');
    const mappaEl = document.getElementById('mappa-potatura-frutteto-container');
    const btn = document.getElementById('btn-draw-polygon-potatura-frutteto');

    function rimuoviDrawingMode() {
        isDrawingPolygonFrutteto = false;
        if (mapContainer) mapContainer.classList.remove('drawing-mode');
        if (mappaEl) {
            mappaEl.style.cursor = '';
            mappaEl.querySelectorAll('div').forEach(d => { d.style.cursor = ''; });
            mappaEl.querySelectorAll('canvas').forEach(c => { c.style.cursor = ''; });
        }
        if (btn) { btn.textContent = '✏️ Traccia Poligono'; btn.style.background = '#17a2b8'; }
        if (mappaPotaturaFrutteto.clickListenerPotaturaFrutteto) {
            google.maps.event.removeListener(mappaPotaturaFrutteto.clickListenerPotaturaFrutteto);
            mappaPotaturaFrutteto.clickListenerPotaturaFrutteto = null;
        }
    }

    if (isDrawingPolygonFrutteto) {
        rimuoviDrawingMode();
        return;
    }

    if (poligonoPotaturaPolyFrutteto) { poligonoPotaturaPolyFrutteto.setMap(null); poligonoPotaturaPolyFrutteto = null; }
    poligonoCoords = [];
    firstPointFrutteto = null;
    if (mappaPotaturaFrutteto.clickListenerPotaturaFrutteto) {
        google.maps.event.removeListener(mappaPotaturaFrutteto.clickListenerPotaturaFrutteto);
        mappaPotaturaFrutteto.clickListenerPotaturaFrutteto = null;
    }
    isDrawingPolygonFrutteto = true;
    if (mapContainer) mapContainer.classList.add('drawing-mode');
    if (btn) { btn.textContent = '⏸️ Pausa Tracciamento'; btn.style.background = '#dc3545'; }
    if (mappaEl) {
        mappaEl.style.cursor = 'crosshair';
        setTimeout(() => {
            mappaEl.querySelectorAll('div').forEach(d => { d.style.cursor = 'crosshair'; });
            mappaEl.querySelectorAll('canvas').forEach(c => { c.style.cursor = 'crosshair'; });
        }, 100);
    }

    let clickTimeout = null;
    mappaPotaturaFrutteto.clickListenerPotaturaFrutteto = mappaPotaturaFrutteto.addListener('click', (event) => {
        if (!isDrawingPolygonFrutteto || !event.latLng) return;
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
            if (poligonoCoords.length >= 3) {
                rimuoviDrawingMode();
                aggiornaPoligonoSullaMappaPotaturaFrutteto();
                aggiornaInfoPoligonoPotaturaFrutteto();
                alert('Tracciamento completato. Puoi modificare il poligono trascinando i punti.');
            }
            return;
        }
        clickTimeout = setTimeout(() => {
            clickTimeout = null;
            const disableSnap = event.domEvent && event.domEvent.shiftKey;
            let snappedPoint = event.latLng;
            let snapApplied = false;
            if (!disableSnap && terrenoBoundaryCoordsFrutteto.length > 0) {
                const vertexSnap = findNearestVertexFrutteto(snappedPoint, terrenoBoundaryCoordsFrutteto, VERTEX_SNAP_DISTANCE_METERS_F);
                if (vertexSnap && google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, vertexSnap) <= VERTEX_SNAP_DISTANCE_METERS_F) {
                    snappedPoint = vertexSnap;
                    snapApplied = true;
                }
                if (!snapApplied) {
                    const boundarySnap = findNearestPointOnBoundaryFrutteto(snappedPoint, terrenoBoundaryCoordsFrutteto, SNAP_DISTANCE_METERS_F);
                    if (boundarySnap && google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, boundarySnap) <= SNAP_DISTANCE_METERS_F) {
                        snappedPoint = boundarySnap;
                        snapApplied = true;
                    }
                }
            }
            if (snapApplied) {
                const snapMarker = new google.maps.Marker({
                    position: snappedPoint,
                    map: mappaPotaturaFrutteto,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#00ff00', fillOpacity: 0.8, strokeColor: '#ffffff', strokeWeight: 2 },
                    zIndex: 2000
                });
                setTimeout(() => { if (snapMarker) snapMarker.setMap(null); }, 1000);
            }
            if (terrenoPolygonFrutteto) {
                const isInside = google.maps.geometry.poly.containsLocation(snappedPoint, terrenoPolygonFrutteto);
                const distanceToBoundary = getDistanceToBoundaryFrutteto(snappedPoint, terrenoBoundaryCoordsFrutteto);
                if (!isInside && distanceToBoundary > 3) {
                    alert('Il punto deve essere dentro i confini del terreno!');
                    return;
                }
                if (!isInside && distanceToBoundary <= 3) {
                    snappedPoint = movePointInsideBoundaryFrutteto(snappedPoint, terrenoBoundaryCoordsFrutteto);
                }
            }
            if (poligonoCoords.length === 0) firstPointFrutteto = snappedPoint;
            if (firstPointFrutteto && poligonoCoords.length >= 3 && google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, firstPointFrutteto) < 20) {
                poligonoCoords.push({ lat: firstPointFrutteto.lat(), lng: firstPointFrutteto.lng() });
                rimuoviDrawingMode();
                aggiornaPoligonoSullaMappaPotaturaFrutteto();
                aggiornaInfoPoligonoPotaturaFrutteto();
                alert('Poligono chiuso! Puoi modificarlo trascinando i punti.');
                return;
            }
            poligonoCoords.push({ lat: snappedPoint.lat(), lng: snappedPoint.lng() });
            aggiornaPoligonoSullaMappaPotaturaFrutteto();
            aggiornaInfoPoligonoPotaturaFrutteto();
        }, 300);
    });
};

async function init() {
    const { getAuthInstance, onAuthStateChanged } = await import(resolvePath('../../../core/services/firebase-service.js'));
    const { initializeTenantService, getCurrentTenantId } = await import(resolvePath('../../../core/services/tenant-service.js'));
    initializeTenantService();
    const auth = getAuthInstance();
    onAuthStateChanged(auth, async (user) => {
        const loadingEl = document.getElementById('loading');
        const emptyEl = document.getElementById('empty-state');
        const tableWrapEl = document.getElementById('table-wrap');
        if (!user) user = await resolveAuthUser(auth);
        if (!user) {
            window.location.href = await loginPageUrl(resolvePath('../../../core/auth/login-standalone.html'));
            return;
        }
        const tenantId = getCurrentTenantId();
        if (!tenantId) {
            if (loadingEl) loadingEl.style.display = 'none';
            if (tableWrapEl) tableWrapEl.style.display = 'none';
            if (emptyEl) {
                emptyEl.style.display = 'block';
                emptyEl.innerHTML = '<p>Nessun tenant selezionato. Seleziona un tenant per vedere l\'elenco potature.</p>';
            }
            showAlert('Nessun tenant selezionato.', 'error');
            return;
        }
        try {
            const { getDb, getDoc, doc } = await import(resolvePath('../../../core/services/firebase-service.js'));
            const db = getDb();
            if (db) {
                const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
                if (tenantDoc.exists()) {
                    const tenantData = tenantDoc.data();
                    const modules = Array.isArray(tenantData?.modules) ? tenantData.modules : [];
                    hasManodoperaModule = modules.includes('manodopera');
                    
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
                                console.log('[Frutteto Potatura] Context Tony inizializzato con moduli:', modules);
                            } else if (retries < 10) {
                                setTimeout(function() { initTonyContext(retries + 1); }, 500);
                            }
                        };
                        initTonyContext();
                    }
                }
            }
        } catch (err) { console.warn('Verifica modulo manodopera:', err); }
        await loadFrutteti();
        document.getElementById('filter-frutteto').addEventListener('change', loadPotature);
        document.getElementById('filter-anno').addEventListener('change', loadPotature);
        const btnNuova = document.getElementById('btn-nuova-potatura');
        if (btnNuova) btnNuova.addEventListener('click', openModalNew);
        document.getElementById('close-modal').addEventListener('click', closeModal);
        document.getElementById('cancel-btn').addEventListener('click', closeModal);
        document.getElementById('form-potatura').addEventListener('submit', savePotatura);
        const supHaEl = document.getElementById('potatura-superficie-ha');
        if (supHaEl) supHaEl.addEventListener('input', updatePianteFromSuperficieFrutteto);
        if (supHaEl) supHaEl.addEventListener('change', updatePianteFromSuperficieFrutteto);
        await loadPotature();
    });
}
init();

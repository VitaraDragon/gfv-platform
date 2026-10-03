/**
 * Pagina Potatura vigneto.
 * L'HTML in views/ resta la struttura; qui c'è il comportamento.
 * Gli import dinamici via resolvePath restano relativi all'URL della pagina.
 * @module modules/vigneto/js/potatura-page
 */

import { formatDateLikeToItalianLongLocal } from '../../../core/js/date-format-it.js';
import { showAlert } from '../../../core/js/gfv-page-utils.js';
import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';

try {
    await window.GFVStandaloneReady;
} catch (err) {
    console.error('[potatura] Bootstrap failed:', err);
    throw err;
}

function formatDate(d) {
    if (!d) return '-';
    const s = formatDateLikeToItalianLongLocal(d);
    return s || '-';
}

function findNearestVertexPotatura(point, boundaryCoords, maxDistance) {
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

let vigneti = [];
let potature = [];
let currentVignetoId = null;
let currentAnno = null;
let potaturaFromAttivitaOnly = false;
let poligonoCoords = [];
let mappaPotatura = null;
let poligonoPotaturaPoly = null;
let terrenoPolygonPotatura = null;
let terrenoBoundaryCoordsPotatura = [];
let firstPointPotatura = null;
let isDrawingPolygonPotatura = false;
const SNAP_DISTANCE_METERS = 5;
const VERTEX_SNAP_DISTANCE_METERS = 8;
let hasManodoperaModule = false;

// Trova il punto più vicino sul confine del terreno (su un segmento di linea)
function findNearestPointOnBoundaryPotatura(point, boundaryCoords, maxDistance) {
    let nearestPoint = null;
    let minDistance = maxDistance;
    
    // Itera su tutti i segmenti del confine
    for (let i = 0; i < boundaryCoords.length; i++) {
        const start = boundaryCoords[i];
        const end = boundaryCoords[(i + 1) % boundaryCoords.length]; // Ultimo punto si collega al primo
        
        // Calcola punto più vicino su questo segmento
        const closestPoint = getClosestPointOnSegmentPotatura(point, start, end);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point, closestPoint);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = closestPoint;
        }
    }
    
    return nearestPoint;
}

// Calcola il punto più vicino su un segmento di linea
function getClosestPointOnSegmentPotatura(point, segmentStart, segmentEnd) {
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
function getDistanceToBoundaryPotatura(point, boundaryCoords) {
    let minDistance = Infinity;
    
    for (let i = 0; i < boundaryCoords.length; i++) {
        const start = boundaryCoords[i];
        const end = boundaryCoords[(i + 1) % boundaryCoords.length];
        const closestPoint = getClosestPointOnSegmentPotatura(point, start, end);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point, closestPoint);
        minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
}

// Sposta un punto leggermente dentro il confine del terreno
function movePointInsideBoundaryPotatura(point, boundaryCoords) {
    // Trova il punto più vicino sul confine
    const nearestBoundaryPoint = findNearestPointOnBoundaryPotatura(point, boundaryCoords, 100);
    if (!nearestBoundaryPoint) return point;
    
    // Calcola vettore dal confine verso il centro del terreno
    const center = getPolygonCenterPotatura(boundaryCoords);
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
function getPolygonCenterPotatura(coords) {
    let sumLat = 0, sumLng = 0;
    coords.forEach(coord => {
        sumLat += coord.lat();
        sumLng += coord.lng();
    });
    return new google.maps.LatLng(sumLat / coords.length, sumLng / coords.length);
}

async function loadPoligonoFromZoneLavoratePotatura(lavoroId) {
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
    } catch (e) { console.warn('[POTATURA] loadPoligonoFromZoneLavorate:', e); }
    return null;
}

async function loadDatiLavoroPotatura(lavoroId) {
    const { getCurrentTenantId } = await import(resolvePath('../../../core/services/tenant-service.js'));
    const { getLavoro } = await import(resolvePath('../../../core/services/lavori-service.js'));
    const { getTerreno } = await import(resolvePath('../../../core/services/terreni-service.js'));
    const { getDb, collection, query, where, getDocs, getDoc, doc } = await import(resolvePath('../../../core/services/firebase-service.js'));
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
        const { getAllMacchine } = await import(resolvePath('../../../modules/parco-macchine/services/macchine-service.js'));
        macchine = await getAllMacchine();
    } catch (e) { console.warn('[POTATURA-VIGNETO] loadMacchine:', e); }
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

async function loadMacchinePotaturaVigneto() {
    try {
        const mod = await import(resolvePath('../../../modules/parco-macchine/services/macchine-service.js'));
        return await mod.getAllMacchine();
    } catch (e) {
        return [];
    }
}

window.aggiungiRigaOperaioPotaturaVigneto = function() {
    const tbody = document.getElementById('operai-tabella-body-potatura-vigneto');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = '<td><input type="date" class="input-data-operaio-potatura-vigneto"></td><td><input type="text" placeholder="Nome" class="input-nome-operaio-potatura-vigneto"></td><td><input type="number" step="0.01" min="0" value="0" class="input-ore-operaio-potatura-vigneto"></td><td><button type="button" class="btn btn-danger btn-sm" onclick="this.closest(\'tr\').remove(); aggiornaTotaleOreOperaiPotaturaVigneto();">Elimina</button></td>';
    tbody.appendChild(tr);
    tr.querySelector('.input-ore-operaio-potatura-vigneto').addEventListener('input', aggiornaTotaleOreOperaiPotaturaVigneto);
    aggiornaTotaleOreOperaiPotaturaVigneto();
};

function aggiornaTotaleOreOperaiPotaturaVigneto() {
    const tbody = document.getElementById('operai-tabella-body-potatura-vigneto');
    const footer = document.getElementById('operai-tabella-footer-potatura-vigneto');
    if (!tbody) return;
    const righe = tbody.querySelectorAll('tr');
    let tot = 0;
    righe.forEach(r => {
        const inp = r.querySelector('.input-ore-operaio-potatura-vigneto');
        if (inp) tot += parseFloat(inp.value) || 0;
    });
    const totEl = document.getElementById('totale-ore-operai-potatura-vigneto');
    if (totEl) totEl.textContent = tot.toFixed(1);
    if (footer) footer.style.display = righe.length > 0 ? 'table-footer-group' : 'none';
}

function popolaTabellaOperaiPotaturaVigneto(operaiData) {
    const tbody = document.getElementById('operai-tabella-body-potatura-vigneto');
    if (!tbody) return;
    tbody.innerHTML = '';
    (operaiData || []).forEach(op => {
        const tr = document.createElement('tr');
        const dataStr = op.data ? (op.data instanceof Date ? op.data.toISOString().slice(0, 10) : op.data) : '';
        tr.innerHTML = '<td><input type="date" class="input-data-operaio-potatura-vigneto" value="' + dataStr + '"></td><td><input type="text" placeholder="Nome" class="input-nome-operaio-potatura-vigneto" value="' + (op.nome || '') + '"></td><td><input type="number" step="0.01" min="0" class="input-ore-operaio-potatura-vigneto" value="' + (op.ore || 0) + '"></td><td><button type="button" class="btn btn-danger btn-sm">Elimina</button></td>';
        tr.querySelector('button').addEventListener('click', function() { tr.remove(); aggiornaTotaleOreOperaiPotaturaVigneto(); });
        tr.querySelector('.input-ore-operaio-potatura-vigneto').addEventListener('input', aggiornaTotaleOreOperaiPotaturaVigneto);
        tbody.appendChild(tr);
    });
    if (operaiData.length === 0) window.aggiungiRigaOperaioPotaturaVigneto();
    else aggiornaTotaleOreOperaiPotaturaVigneto();
}

function popolaTabellaMacchinePotaturaVigneto(macchineData) {
    const tbody = document.getElementById('macchine-tabella-body-potatura-vigneto');
    if (!tbody) return;
    tbody.innerHTML = '';
    (macchineData || []).forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (m.tipo || '-') + '</td><td>' + (m.nome || '-') + '</td><td>' + (m.ore !== undefined ? Number(m.ore).toFixed(2) : '-') + '</td>';
        tbody.appendChild(tr);
    });
}

async function caricaMacchinePerPotaturaVigneto(potatura) {
    await loadMacchinePotaturaVigneto();
    let macchine = await loadMacchinePotaturaVigneto();
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
            console.warn('[POTATURA-VIGNETO] caricaMacchinePerPotaturaVigneto da lavoro:', e);
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
    
    popolaTabellaMacchinePotaturaVigneto(macchineData);
}

async function loadVigneti() {
    const { getAllVigneti } = await import(resolvePath('../services/vigneti-service.js'));
    vigneti = await getAllVigneti();
    const selFilter = document.getElementById('filter-vigneto');
    const selModal = document.getElementById('potatura-vigneto');
    [selFilter, selModal].forEach(sel => {
        if (!sel) return;
        sel.innerHTML = sel === selFilter ? '<option value="">Tutti i vigneti</option>' : '<option value="">Seleziona vigneto</option>';
        vigneti.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.varieta || v.nome || v.id;
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
    const vid = document.getElementById('filter-vigneto').value || null;
    const annoVal = document.getElementById('filter-anno').value;
    const anno = annoVal ? parseInt(annoVal, 10) : null;
    currentVignetoId = vid;
    currentAnno = anno;

    const loading = document.getElementById('loading');
    const tableWrap = document.getElementById('table-wrap');
    const empty = document.getElementById('empty-state');
    const tbody = document.getElementById('tbody-potature');

    loading.style.display = 'block';
    tableWrap.style.display = 'none';
    empty.style.display = 'none';

    try {
        const { getAllPotatureVigneti } = await import(resolvePath('../services/potatura-vigneto-service.js'));
        potature = await getAllPotatureVigneti({
            anno: anno || new Date().getFullYear(),
            vignetoId: vid || null
        });
    } catch (e) {
        console.error(e);
        potature = [];
    }

    loading.style.display = 'none';
    if (potature.length === 0) {
        empty.style.display = 'block';
        empty.innerHTML = '<p>Nessuna potatura per l\'anno selezionato. Crea un lavoro o un\'attività con categoria Potatura (Gestione lavori o Diario) su un terreno con vigneto.</p>';
        return;
    }

    try {
        const { getDatiPrecompilazionePotatura } = await import(resolvePath('../services/potatura-vigneto-service.js'));
        const potatureConDisplay = await Promise.all(potature.map(async (p) => {
            let tipoDisplay = p.tipo;
            let ceppiDisplay = p.ceppiPotati;
            let costoDisplay = p.costoTotale;
            if (p.lavoroId || p.attivitaId) {
                try {
                    const prefill = await getDatiPrecompilazionePotatura(p.vignetoId, p);
                    if (prefill.tipoPotatura) tipoDisplay = prefill.tipoPotatura;
                    if (prefill.ceppiPotati != null) ceppiDisplay = prefill.ceppiPotati;
                    if (prefill.costoManodopera != null || prefill.costoMacchina != null) {
                        costoDisplay = (prefill.costoManodopera || 0) + (prefill.costoMacchina || 0);
                    }
                } catch (e) {
                    console.warn('[Potatura lista] prefill per', p.id, e);
                }
            }
            return { ...p, tipoDisplay, ceppiDisplay, costoDisplay };
        }));

        empty.style.display = 'none';
        tableWrap.style.display = 'block';
        const tipoLabels = { invernale: '❄️ Invernale', verde: '🌿 Verde', rinnovo: '🔄 Rinnovo', spollonatura: '🌱 Spollonatura' };
        const gestioneLavoriUrl = resolvePath('../../../core/admin/gestione-lavori-standalone.html');
        const attivitaUrl = resolvePath('../../../core/attivita-standalone.html');
        tbody.innerHTML = potatureConDisplay.map(p => {
            const vignetoNome = vigneti.find(v => v.id === p.vignetoId);
            const vignetoLabel = vignetoNome ? (vignetoNome.varieta || vignetoNome.nome || p.vignetoId) : p.vignetoId || '-';
            const tipoLabel = tipoLabels[p.tipoDisplay] || p.tipoDisplay || '-';
            const costo = (p.costoDisplay != null && p.costoDisplay !== '') ? Number(p.costoDisplay).toFixed(2) : '-';
            let lavoroCell = '-';
            if (p.lavoroId) {
                lavoroCell = `<a href="${gestioneLavoriUrl}?lavoroId=${encodeURIComponent(p.lavoroId)}" target="_blank" class="link-lavoro">🔗 Vedi Lavoro</a>`;
            } else if (p.attivitaId) {
                lavoroCell = `<a href="${attivitaUrl}?attivitaId=${encodeURIComponent(p.attivitaId)}" target="_blank" class="link-lavoro">🔗 Vedi Attività</a>`;
            }
            const vignetoId = p.vignetoId;
            return `<tr>
                <td>${formatDate(p.data)}</td>
                <td>${vignetoLabel}</td>
                <td>${tipoLabel}</td>
                <td>${(p.ceppiDisplay != null && p.ceppiDisplay !== '') ? Number(p.ceppiDisplay) : '-'}</td>
                <td>${p.oreImpiegate != null ? p.oreImpiegate : '-'}</td>
                <td>${costo}</td>
                <td>${lavoroCell}</td>
                <td>
                    <button type="button" class="btn btn-secondary btn-sm" data-edit="${p.id}" data-vigneto-id="${vignetoId}">Modifica</button>
                    <button type="button" class="btn btn-danger btn-sm" data-delete="${p.id}" data-vigneto-id="${vignetoId}">Elimina</button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openModalEdit(btn.getAttribute('data-vigneto-id'), btn.getAttribute('data-edit'))));
        tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deletePotaturaConfirm(btn.getAttribute('data-vigneto-id'), btn.getAttribute('data-delete'))));
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
    document.getElementById('potatura-vigneto-id').value = currentVignetoId || '';
    document.getElementById('lavoro-id-hidden').value = '';
    document.getElementById('attivita-id-hidden').value = '';
    document.getElementById('dati-lavoro-section').style.display = 'none';
    poligonoCoords = [];
    const poligonoInfo = document.getElementById('poligono-info-potatura');
    if (poligonoInfo) poligonoInfo.style.display = 'none';
    const sel = document.getElementById('potatura-vigneto');
    sel.value = currentVignetoId || (vigneti.length ? vigneti[0].id : '');
    document.getElementById('potatura-data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('potatura-tipo').value = '';
    document.getElementById('potatura-ceppi').value = '';
    const tbodyOp = document.getElementById('operai-tabella-body-potatura-vigneto');
    if (tbodyOp) { tbodyOp.innerHTML = ''; window.aggiungiRigaOperaioPotaturaVigneto(); }
    document.getElementById('operai-tabella-section').style.display = 'block';
    document.getElementById('macchine-tabella-section').style.display = 'none';
    document.getElementById('potatura-ore').value = '';
    document.getElementById('potatura-costo-mano').value = '0';
    document.getElementById('potatura-costo-macchina').value = '0';
    document.getElementById('potatura-note').value = '';
    const btnTraccia = document.getElementById('btn-traccia-area-potatura');
    if (btnTraccia) { btnTraccia.textContent = 'Traccia'; btnTraccia.title = 'Traccia area potata sulla mappa'; }
    document.getElementById('modal-potatura').classList.add('active');
}

async function openModalEdit(vignetoId, potaturaId) {
    const { getPotatura, getDatiPrecompilazionePotatura } = await import(resolvePath('../services/potatura-vigneto-service.js'));
    const p = await getPotatura(vignetoId, potaturaId);
    if (!p) { showAlert('Potatura non trovata', 'error'); return; }
    document.getElementById('modal-title').textContent = 'Modifica potatura';
    document.getElementById('potatura-id').value = potaturaId;
    document.getElementById('potatura-vigneto-id').value = vignetoId;
    document.getElementById('potatura-vigneto').value = vignetoId;
    const dataVal = p.data instanceof Date ? p.data : (p.data?.toDate ? p.data.toDate() : new Date(p.data));
    document.getElementById('potatura-data').value = dataVal.toISOString ? dataVal.toISOString().slice(0, 10) : '';
    document.getElementById('potatura-tipo').value = p.tipo || '';
    document.getElementById('potatura-ceppi').value = p.ceppiPotati ?? '';
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
        await loadMacchinePotaturaVigneto();
        superficieDalLavoro = await loadDatiLavoroPotatura(p.lavoroId);
        operaiTabellaSection.style.display = 'none';
    } else {
        datiLavoroSection.style.display = 'none';
        operaiTabellaSection.style.display = 'block';
        if (p.operai && Array.isArray(p.operai) && p.operai.length > 0) {
            const opData = p.operai.map(op => typeof op === 'object' && op.nome !== undefined ? op : { nome: '', data: null, ore: 0 });
            popolaTabellaOperaiPotaturaVigneto(opData);
        } else window.aggiungiRigaOperaioPotaturaVigneto();
    }

    if (p.lavoroId || p.attivitaId) {
        macchineTabellaSection.style.display = 'block';
        await caricaMacchinePerPotaturaVigneto(p);
    } else {
        macchineTabellaSection.style.display = 'none';
    }

    potaturaFromAttivitaOnly = !!(p.attivitaId && !p.lavoroId);
    const btnTraccia = document.getElementById('btn-traccia-area-potatura');
    if (btnTraccia) {
        btnTraccia.textContent = p.lavoroId ? 'Visualizza zona' : 'Traccia';
        btnTraccia.title = p.lavoroId ? 'Visualizza zona tracciata nel lavoro collegato (sola consultazione)' : 'Traccia area potata sulla mappa';
    }
    if (p.poligonoPotatura && p.poligonoPotatura.length >= 3) {
        poligonoCoords = p.poligonoPotatura.map(c => ({ lat: c.lat, lng: c.lng }));
        const poligonoInfo = document.getElementById('poligono-info-potatura');
        if (poligonoInfo) poligonoInfo.style.display = 'block';
    } else if (p.lavoroId) {
        const fromLavoro = await loadPoligonoFromZoneLavoratePotatura(p.lavoroId);
        if (fromLavoro && fromLavoro.length >= 3) {
            poligonoCoords = fromLavoro;
            const poligonoInfo = document.getElementById('poligono-info-potatura');
            if (poligonoInfo) poligonoInfo.style.display = 'block';
        } else {
            poligonoCoords = [];
            const poligonoInfo = document.getElementById('poligono-info-potatura');
            if (poligonoInfo) poligonoInfo.style.display = 'none';
        }
    } else {
        poligonoCoords = [];
        const poligonoInfo = document.getElementById('poligono-info-potatura');
        if (poligonoInfo) poligonoInfo.style.display = 'none';
    }

    try {
        const prefill = await getDatiPrecompilazionePotatura(vignetoId, p, { hasManodoperaModule });
        if (prefill.tipoPotatura) document.getElementById('potatura-tipo').value = prefill.tipoPotatura;
        if (prefill.ceppiPotati != null) document.getElementById('potatura-ceppi').value = prefill.ceppiPotati;
        document.getElementById('potatura-costo-mano').value = prefill.costoManodopera ?? 0;
        document.getElementById('potatura-costo-macchina').value = prefill.costoMacchina ?? 0;
    } catch (e) { console.warn('Precompilazione potatura:', e); }

    currentPotaturaOperaiIds = Array.isArray(p.operai) ? p.operai : null;
    document.getElementById('modal-potatura').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-potatura').classList.remove('active');
}

async function savePotatura(e) {
    e.preventDefault();
    const id = document.getElementById('potatura-id').value.trim();
    const vignetoId = document.getElementById('potatura-vigneto').value;
    if (!vignetoId) { showAlert('Seleziona un vigneto', 'error'); return; }

    let operaiPayload = [];
    const opSection = document.getElementById('operai-tabella-section');
    if (opSection && opSection.style.display !== 'none') {
        const tbody = document.getElementById('operai-tabella-body-potatura-vigneto');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const dataInp = tr.querySelector('.input-data-operaio-potatura-vigneto');
                const nomeInp = tr.querySelector('.input-nome-operaio-potatura-vigneto');
                const oreInp = tr.querySelector('.input-ore-operaio-potatura-vigneto');
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
            const { calcolaCostiLavoro } = await import(resolvePath('../services/lavori-vigneto-service.js'));
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
            console.warn('[POTATURA-VIGNETO] Ricalcolo costo da lavoro:', e);
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
                        console.warn('[POTATURA-VIGNETO] Ricalcolo costo macchina:', e);
                    }
                }
            }
        } catch (e) {
            console.warn('[POTATURA-VIGNETO] Ricalcolo costo da attività:', e);
        }
    }
    
    const data = {
        data: new Date(document.getElementById('potatura-data').value),
        tipo: document.getElementById('potatura-tipo').value,
        parcella: null,
        ceppiPotati: parseInt(document.getElementById('potatura-ceppi').value, 10),
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
        const { createPotatura, updatePotatura } = await import(resolvePath('../services/potatura-vigneto-service.js'));
        if (id) {
            await updatePotatura(vignetoId, id, data);
            showAlert('Potatura aggiornata.', 'success');
        } else {
            await createPotatura(vignetoId, data);
            showAlert('Potatura registrata.', 'success');
        }
        closeModal();
        await loadPotature();
    } catch (err) {
        showAlert(err.message || 'Errore salvataggio', 'error');
    }
}

async function deletePotaturaConfirm(vignetoId, potaturaId) {
    if (!confirm('Eliminare questa potatura?')) return;
    try {
        const { deletePotatura } = await import(resolvePath('../services/potatura-vigneto-service.js'));
        await deletePotatura(vignetoId, potaturaId);
        showAlert('Potatura eliminata.', 'success');
        await loadPotature();
    } catch (err) {
        showAlert(err.message || 'Errore eliminazione', 'error');
    }
}

function loadGoogleMapsPotatura() {
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

async function initMappaPotatura(terreno) {
    try {
        const container = document.getElementById('mappa-potatura-container');
        if (!container) return;
        
        // Inizializza mappa centrata sul terreno
        const center = terreno.polygonCoords && terreno.polygonCoords.length > 0
            ? { lat: terreno.polygonCoords[0].lat, lng: terreno.polygonCoords[0].lng }
            : { lat: 43.7228, lng: 10.4017 }; // Default Toscana
        
        mappaPotatura = new google.maps.Map(container, {
            center: center,
            zoom: 15,
            mapTypeId: 'satellite',
            mapTypeControl: true,
            streetViewControl: false
        });
        
        // Carica terreno sulla mappa
        await caricaTerrenoSullaMappaPotatura(terreno);
        
    } catch (error) {
        console.error('Errore inizializzazione mappa:', error);
        alert('Errore nel caricamento della mappa: ' + error.message);
    }
}

async function caricaTerrenoSullaMappaPotatura(terreno) {
    if (!mappaPotatura || !terreno || !terreno.polygonCoords || terreno.polygonCoords.length === 0) return;
    
    // Rimuovi poligono terreno precedente se presente
    if (terrenoPolygonPotatura) {
        terrenoPolygonPotatura.setMap(null);
    }
    
    // Crea poligono terreno
    const terrenoCoords = terreno.polygonCoords.map(c => 
        new google.maps.LatLng(c.lat, c.lng)
    );
    
    terrenoPolygonPotatura = new google.maps.Polygon({
        paths: terrenoCoords,
        fillColor: '#2E8B57',
        fillOpacity: 0.2,
        strokeColor: '#2E8B57',
        strokeWeight: 3,
        strokeOpacity: 0.8,
        editable: false,
        clickable: false, // IMPORTANTE: false per non intercettare i click
        zIndex: 1 // Sotto al poligono potatura
    });
    
    terrenoPolygonPotatura.setMap(mappaPotatura);
    
    // Salva coordinate del confine per lo snap
    terrenoBoundaryCoordsPotatura = terrenoCoords;
    
    // Centra mappa sul terreno
    const bounds = new google.maps.LatLngBounds();
    terrenoCoords.forEach(coord => bounds.extend(coord));
    mappaPotatura.fitBounds(bounds);
}

function aggiornaInfoPoligonoPotatura() {
    const infoDiv = document.getElementById('mappa-info-potatura');
    const superficieDiv = document.getElementById('superficie-calcolata-potatura');
    const puntiDiv = document.getElementById('punti-tracciati-potatura');
    const btnClear = document.getElementById('btn-clear-polygon-potatura');
    const btnSave = document.getElementById('btn-save-polygon-potatura');
    const btnConferma = document.getElementById('btn-conferma-polygon-potatura');
    
    if (poligonoCoords.length >= 3) {
        // Calcola superficie
        const areaMq = google.maps.geometry.spherical.computeArea(poligonoCoords);
        const areaHa = areaMq / 10000; // Converti in ettari
        
        superficieDiv.textContent = areaHa.toFixed(2) + ' ha';
        puntiDiv.textContent = poligonoCoords.length;
        
        infoDiv.style.display = 'block';
        btnClear.style.display = 'inline-block';
        btnSave.style.display = 'inline-block';
        btnConferma.style.display = 'inline-block';
    } else {
        infoDiv.style.display = 'none';
        btnClear.style.display = 'none';
        btnSave.style.display = 'none';
        btnConferma.style.display = 'none';
    }
}

function aggiornaPoligonoSullaMappaPotatura() {
    if (!mappaPotatura || poligonoCoords.length < 2) return;
    
    // Rimuovi poligono precedente
    if (poligonoPotaturaPoly) {
        poligonoPotaturaPoly.setMap(null);
    }
    
    // Crea nuovo poligono
    poligonoPotaturaPoly = new google.maps.Polygon({
        paths: poligonoCoords,
        fillColor: '#6A1B9A', // Viola per potatura
        fillOpacity: 0.4,
        strokeColor: '#4A148C', // Viola scuro per bordo
        strokeWeight: 4,
        strokeOpacity: 1.0,
        editable: true,
        draggable: false
    });
    
    poligonoPotaturaPoly.setMap(mappaPotatura);
    
    // Listener per modifiche poligono (drag dei vertici)
    google.maps.event.addListener(poligonoPotaturaPoly.getPath(), 'set_at', function() {
        poligonoCoords = poligonoPotaturaPoly.getPath().getArray();
        aggiornaInfoPoligonoPotatura();
    });
    
    google.maps.event.addListener(poligonoPotaturaPoly.getPath(), 'insert_at', function() {
        poligonoCoords = poligonoPotaturaPoly.getPath().getArray();
        aggiornaInfoPoligonoPotatura();
    });
    
    google.maps.event.addListener(poligonoPotaturaPoly.getPath(), 'remove_at', function() {
        poligonoCoords = poligonoPotaturaPoly.getPath().getArray();
        aggiornaInfoPoligonoPotatura();
    });
}

function caricaPoligonoEsistentePotatura(coordinate, soloConsultazione) {
    if (!coordinate || coordinate.length < 3 || !mappaPotatura) return;
    
    // Converti coordinate in LatLng se necessario
    if (typeof coordinate[0] === 'object' && coordinate[0].lat !== undefined) {
        poligonoCoords = coordinate.map(c => 
            new google.maps.LatLng(c.lat, c.lng)
        );
    } else {
        // Già LatLng
        poligonoCoords = coordinate;
    }
    
    // Se solo consultazione, mostra poligono non editabile
    if (soloConsultazione) {
        if (poligonoPotaturaPoly) {
            poligonoPotaturaPoly.setMap(null);
        }
        poligonoPotaturaPoly = new google.maps.Polygon({
            paths: poligonoCoords,
            fillColor: '#6A1B9A',
            fillOpacity: 0.4,
            strokeColor: '#4A148C',
            strokeWeight: 4,
            strokeOpacity: 1.0,
            editable: false,
            draggable: false,
            map: mappaPotatura
        });
        aggiornaInfoPoligonoPotatura();
        return;
    }
    
    // Aggiorna poligono sulla mappa (editabile)
    aggiornaPoligonoSullaMappaPotatura();
    aggiornaInfoPoligonoPotatura();
}

window.apriMappaTracciamentoPotatura = async function apriMappaTracciamentoPotatura() {
    // Verifica che Google Maps sia caricato (allineato a vendemmia)
    if (typeof google === 'undefined' || !google.maps) {
        // Aspetta che Google Maps sia caricato
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
    window.potaturaMappaSoloConsultazione = soloConsultazione;

    const vignetoId = document.getElementById('potatura-vigneto').value;
    if (!vignetoId) {
        alert('Seleziona prima un vigneto');
        return;
    }
    
    const vigneto = vigneti.find(v => v.id === vignetoId);
    if (!vigneto || !vigneto.terrenoId) {
        alert('Vigneto senza terreno associato');
        return;
    }
    
    // Carica terreno per visualizzare confini
    const { getTerreno } = await import(resolvePath('../../../core/services/terreni-service.js'));
    const terreno = await getTerreno(vigneto.terrenoId);
    if (!terreno || !terreno.polygonCoords || terreno.polygonCoords.length === 0) {
        alert('Il terreno selezionato non ha confini tracciati. Traccia prima i confini del terreno.');
        return;
    }
    
    // Apri modal mappa
    document.getElementById('modal-mappa-potatura').classList.add('active');
    
    // Inizializza mappa se non già inizializzata
    if (!mappaPotatura) {
        await initMappaPotatura(terreno);
    } else {
        // Ricarica terreno se necessario
        await caricaTerrenoSullaMappaPotatura(terreno);
    }
    
    // Carica poligono esistente se presente
    // Priorità: 1) poligono tracciato nella sessione corrente, 2) poligono salvato nella potatura
    setTimeout(async () => {
        if (!mappaPotatura) return;
        
        // Se c'è già un poligono tracciato nella sessione, usalo
        if (poligonoCoords && poligonoCoords.length >= 3) {
            // Converti in LatLng se necessario
            if (typeof poligonoCoords[0] === 'object' && poligonoCoords[0].lat !== undefined && typeof poligonoCoords[0].lat !== 'function') {
                // Sono oggetti {lat, lng}, converti in LatLng
                poligonoCoords = poligonoCoords.map(c => new google.maps.LatLng(c.lat, c.lng));
            }
            caricaPoligonoEsistentePotatura(poligonoCoords, soloConsultazione);
            aggiornaInfoPoligonoPotatura();
        } else {
            // Altrimenti, carica poligono salvato nella potatura (se si sta modificando)
            const potaturaId = document.getElementById('potatura-id').value;
            if (potaturaId && vignetoId) {
                try {
                    const { getPotatura } = await import(resolvePath('../services/potatura-vigneto-service.js'));
                    const potaturaEsistente = await getPotatura(vignetoId, potaturaId);
                    if (potaturaEsistente && potaturaEsistente.poligonoPotatura && potaturaEsistente.poligonoPotatura.length > 0) {
                        caricaPoligonoEsistentePotatura(potaturaEsistente.poligonoPotatura, soloConsultazione);
                    }
                } catch (error) {
                    console.error('Errore caricamento potatura esistente:', error);
                }
            }
        }
    }, 500);

    if (soloConsultazione) {
        document.getElementById('mappa-potatura-solo-consultazione').style.display = 'block';
        document.getElementById('btn-draw-polygon-potatura').style.display = 'none';
        document.getElementById('btn-clear-polygon-potatura').style.display = 'none';
        document.getElementById('btn-save-polygon-potatura').style.display = 'none';
        document.getElementById('btn-conferma-polygon-potatura').style.display = 'none';
    } else {
        document.getElementById('mappa-potatura-solo-consultazione').style.display = 'none';
        document.getElementById('btn-draw-polygon-potatura').style.display = 'inline-block';
    }
};

window.chiudiMappaTracciamentoPotatura = function() {
    // Termina tracciamento se attivo (allineato a vendemmia)
    if (isDrawingPolygonPotatura) {
        isDrawingPolygonPotatura = false;
        const mapContainer = document.querySelector('#modal-mappa-potatura .modal-mappa-body');
        if (mapContainer) {
            mapContainer.classList.remove('drawing-mode');
            // Rimuovi anche il cursore via JavaScript
            const mappaElement = document.getElementById('mappa-potatura-container');
            if (mappaElement) {
                mappaElement.style.cursor = '';
                const mapDivs = mappaElement.querySelectorAll('div');
                const mapCanvas = mappaElement.querySelectorAll('canvas');
                mapDivs.forEach(div => {
                    div.style.cursor = '';
                });
                mapCanvas.forEach(canvas => {
                    canvas.style.cursor = '';
                });
            }
        }
        const btn = document.getElementById('btn-draw-polygon-potatura');
        if (btn) {
            btn.textContent = '✏️ Traccia Poligono';
            btn.style.background = '#17a2b8';
        }
        if (mappaPotatura && mappaPotatura.clickListenerPotatura) {
            google.maps.event.removeListener(mappaPotatura.clickListenerPotatura);
            mappaPotatura.clickListenerPotatura = null;
        }
    }
    
    // Chiudi modal
    if (isDrawingPolygonPotatura) {
        isDrawingPolygonPotatura = false;
        document.getElementById('btn-draw-polygon-potatura').textContent = '✏️ Traccia Poligono';
        document.getElementById('btn-draw-polygon-potatura').style.background = '#17a2b8';
        
        if (mappaPotatura && mappaPotatura.clickListenerPotatura) {
            google.maps.event.removeListener(mappaPotatura.clickListenerPotatura);
            mappaPotatura.clickListenerPotatura = null;
        }
    }
    
    document.getElementById('modal-mappa-potatura').classList.remove('active');
    
    // NOTA: Non eliminiamo il poligono tracciato, così l'utente può riaprire la mappa
    // e vedere/modificare il poligono. Verrà salvato solo quando si conferma con "Conferma e Applica"
};

window.salvaPoligonoPotatura = function() {
    if (poligonoCoords.length < 3) {
        alert('Traccia almeno 3 punti per creare un poligono valido');
        return;
    }
    alert('Poligono tracciato! Clicca "Conferma e Applica" per salvare e applicare la superficie.');
};

window.confermaPoligonoPotatura = function() {
    if (poligonoCoords.length < 3) {
        alert('Traccia almeno 3 punti per creare un poligono valido');
        return;
    }
    
    // Calcola superficie
    const areaMq = google.maps.geometry.spherical.computeArea(poligonoCoords);
    const areaHa = areaMq / 10000; // Converti in ettari
    
    // Compila campo superficie
    const supInput = document.getElementById('potatura-superficie-ha');
    if (supInput) {
        supInput.value = areaHa.toFixed(2);
    }
    
    // Calcola ceppi se densità disponibile
    const vignetoId = document.getElementById('potatura-vigneto').value;
    const vigneto = vigneti.find(v => v.id === vignetoId);
    const densita = vigneto ? (vigneto.densita ?? vigneto.densitaCepi) : null;
    if (densita != null && densita > 0) {
        const ceppi = Math.round(areaHa * densita);
        const ceppiInput = document.getElementById('potatura-ceppi');
        if (ceppiInput) ceppiInput.value = ceppi > 0 ? ceppi : '';
        const infoBox = document.getElementById('potatura-ceppi-info');
        const spanCalc = document.getElementById('potatura-ceppi-calcolati');
        if (infoBox && spanCalc) {
            spanCalc.textContent = ceppi + ' (superficie ' + areaHa.toFixed(2) + ' ha × ' + densita + ' ceppi/ha)';
            infoBox.style.display = 'block';
        }
    }
    
    // Mostra info poligono salvato
    const poligonoInfo = document.getElementById('poligono-info-potatura');
    if (poligonoInfo) {
        poligonoInfo.style.display = 'block';
    }
    
    // Termina tracciamento se attivo
    if (isDrawingPolygonPotatura) {
        isDrawingPolygonPotatura = false;
        document.getElementById('btn-draw-polygon-potatura').textContent = '✏️ Traccia Poligono';
        document.getElementById('btn-draw-polygon-potatura').style.background = '#17a2b8';
        
        if (mappaPotatura && mappaPotatura.clickListenerPotatura) {
            google.maps.event.removeListener(mappaPotatura.clickListenerPotatura);
            mappaPotatura.clickListenerPotatura = null;
        }
    }
    
    // Chiudi modal
    chiudiMappaTracciamentoPotatura();
};

window.eliminaPoligonoPotatura = function(resetDrawingMode = true) {
    if (poligonoPotaturaPoly) {
        poligonoPotaturaPoly.setMap(null);
        poligonoPotaturaPoly = null;
    }
    poligonoCoords = [];
    firstPointPotatura = null;
    
    // Resetta isDrawingPolygonPotatura solo se esplicitamente richiesto
    if (resetDrawingMode) {
        isDrawingPolygonPotatura = false;
        const mapContainer = document.querySelector('#modal-mappa-potatura .modal-mappa-body');
        if (mapContainer) {
            mapContainer.classList.remove('drawing-mode');
            // Rimuovi anche il cursore via JavaScript
            const mappaElement = document.getElementById('mappa-potatura-container');
            if (mappaElement) {
                mappaElement.style.cursor = '';
                const mapDivs = mappaElement.querySelectorAll('div');
                const mapCanvas = mappaElement.querySelectorAll('canvas');
                mapDivs.forEach(div => {
                    div.style.cursor = '';
                });
                mapCanvas.forEach(canvas => {
                    canvas.style.cursor = '';
                });
            }
        }
        const btn = document.getElementById('btn-draw-polygon-potatura');
        if (btn) {
            btn.textContent = '✏️ Traccia Poligono';
            btn.style.background = '#17a2b8';
        }
        if (mappaPotatura && mappaPotatura.clickListenerPotatura) {
            google.maps.event.removeListener(mappaPotatura.clickListenerPotatura);
            mappaPotatura.clickListenerPotatura = null;
        }
    }
    aggiornaInfoPoligonoPotatura();
};

window.iniziaTracciamentoPoligonoPotatura = function() {
    if (!mappaPotatura) {
        alert('Mappa non inizializzata');
        return;
    }
    
    if (isDrawingPolygonPotatura) {
        // Termina tracciamento
        isDrawingPolygonPotatura = false;
        document.getElementById('btn-draw-polygon-potatura').textContent = '✏️ Traccia Poligono';
        document.getElementById('btn-draw-polygon-potatura').style.background = '#17a2b8';
        
        // Rimuovi classe drawing-mode
        const mapContainer = document.querySelector('#modal-mappa-potatura .modal-mappa-body');
        if (mapContainer) {
            mapContainer.classList.remove('drawing-mode');
            
            // Rimuovi anche il cursore via JavaScript
            const mappaElement = document.getElementById('mappa-potatura-container');
            if (mappaElement) {
                mappaElement.style.cursor = '';
                const mapDivs = mappaElement.querySelectorAll('div');
                const mapCanvas = mappaElement.querySelectorAll('canvas');
                mapDivs.forEach(div => {
                    div.style.cursor = '';
                });
                mapCanvas.forEach(canvas => {
                    canvas.style.cursor = '';
                });
            }
        }
        
        // Rimuovi listener click
        if (mappaPotatura.clickListenerPotatura) {
            google.maps.event.removeListener(mappaPotatura.clickListenerPotatura);
            mappaPotatura.clickListenerPotatura = null;
        }
    } else {
        // Inizia tracciamento
        // IMPORTANTE: Elimina poligono PRIMA di impostare isDrawingPolygonPotatura = true
        // per evitare che eliminaPoligonoPotatura() resetti il flag
        
        // Elimina poligono precedente se presente (senza resettare isDrawingPolygonPotatura)
        if (poligonoPotaturaPoly) {
            poligonoPotaturaPoly.setMap(null);
            poligonoPotaturaPoly = null;
        }
        poligonoCoords = [];
        firstPointPotatura = null;
        
        // Rimuovi listener precedente se presente
        if (mappaPotatura.clickListenerPotatura) {
            google.maps.event.removeListener(mappaPotatura.clickListenerPotatura);
            mappaPotatura.clickListenerPotatura = null;
        }
        
        // ORA imposta il flag a true
        isDrawingPolygonPotatura = true;
        
        document.getElementById('btn-draw-polygon-potatura').textContent = '⏸️ Pausa Tracciamento';
        document.getElementById('btn-draw-polygon-potatura').style.background = '#dc3545';
        
        // Aggiungi classe drawing-mode per cursore crosshair
        const mapContainer = document.querySelector('#modal-mappa-potatura .modal-mappa-body');
        if (mapContainer) {
            mapContainer.classList.add('drawing-mode');
            
            // Forza anche il cursore via JavaScript per Google Maps
            const mappaElement = document.getElementById('mappa-potatura-container');
            if (mappaElement) {
                mappaElement.style.cursor = 'crosshair';
                
                // Prova anche sugli elementi interni
                setTimeout(() => {
                    const mapDivs = mappaElement.querySelectorAll('div');
                    const mapCanvas = mappaElement.querySelectorAll('canvas');
                    mapDivs.forEach(div => {
                        div.style.cursor = 'crosshair';
                    });
                    mapCanvas.forEach(canvas => {
                        canvas.style.cursor = 'crosshair';
                    });
                }, 100);
            }
        }
        
        // Listener click sulla mappa con gestione doppio clic e snap
        let clickTimeout = null;
        mappaPotatura.clickListenerPotatura = mappaPotatura.addListener('click', (event) => {
            if (!isDrawingPolygonPotatura) {
                return;
            }
            
            // Gestisci doppio clic per terminare tracciamento
            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
                // Doppio clic: termina tracciamento
                if (poligonoCoords.length >= 3) {
                    isDrawingPolygonPotatura = false;
                    const btn = document.getElementById('btn-draw-polygon-potatura');
                    const mapContainer = document.querySelector('#modal-mappa-potatura .modal-mappa-body');
                    btn.textContent = '✏️ Traccia Poligono';
                    btn.style.background = '#17a2b8';
                    if (mapContainer) {
                        mapContainer.classList.remove('drawing-mode');
                        // Rimuovi anche il cursore via JavaScript
                        const mappaElement = document.getElementById('mappa-potatura-container');
                        if (mappaElement) {
                            mappaElement.style.cursor = '';
                            const mapDivs = mappaElement.querySelectorAll('div');
                            const mapCanvas = mappaElement.querySelectorAll('canvas');
                            mapDivs.forEach(div => {
                                div.style.cursor = '';
                            });
                            mapCanvas.forEach(canvas => {
                                canvas.style.cursor = '';
                            });
                        }
                    }
                    alert('Tracciamento completato. Puoi modificare il poligono trascinando i punti.');
                    return;
                }
                return;
            }
            
            // Singolo clic: aggiungi punto con snap
            clickTimeout = setTimeout(() => {
                clickTimeout = null;
                
                // Applica snap: prima ai vertici, poi al confine
                // Tieni premuto Shift per disabilitare lo snap temporaneamente
                const disableSnap = event.domEvent && event.domEvent.shiftKey;
                let snappedPoint = event.latLng;
                let snapApplied = false;
                
                if (!disableSnap && terrenoBoundaryCoordsPotatura.length > 0) {
                    // 1. Snap ai vertici del terreno (solo se molto vicino)
                    const vertexSnap = findNearestVertexPotatura(snappedPoint, terrenoBoundaryCoordsPotatura, VERTEX_SNAP_DISTANCE_METERS);
                    if (vertexSnap) {
                        const snapDistance = google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, vertexSnap);
                        if (snapDistance <= VERTEX_SNAP_DISTANCE_METERS) {
                            snappedPoint = vertexSnap;
                            snapApplied = true;
                        }
                    }
                    
                    // 2. Snap al confine del terreno (solo se non già agganciato a un vertice)
                    if (!snapApplied) {
                        const boundarySnap = findNearestPointOnBoundaryPotatura(snappedPoint, terrenoBoundaryCoordsPotatura, SNAP_DISTANCE_METERS);
                        if (boundarySnap) {
                            const snapDistance = google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, boundarySnap);
                            if (snapDistance <= SNAP_DISTANCE_METERS) {
                                snappedPoint = boundarySnap;
                                snapApplied = true;
                            }
                        }
                    }
                }
                
                // Feedback visivo quando applica lo snap
                if (snapApplied) {
                    const snapMarker = new google.maps.Marker({
                        position: snappedPoint,
                        map: mappaPotatura,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: '#00ff00',
                            fillOpacity: 0.8,
                            strokeColor: '#ffffff',
                            strokeWeight: 2
                        },
                        zIndex: 2000
                    });
                    setTimeout(() => {
                        if (snapMarker) snapMarker.setMap(null);
                    }, 1000);
                }
                
                // Valida che il punto sia dentro i confini del terreno (con tolleranza)
                if (terrenoPolygonPotatura) {
                    const isInside = google.maps.geometry.poly.containsLocation(snappedPoint, terrenoPolygonPotatura);
                    const distanceToBoundary = getDistanceToBoundaryPotatura(snappedPoint, terrenoBoundaryCoordsPotatura);
                    
                    // Permetti punto se è dentro O se è molto vicino al confine (entro 3 metri)
                    if (!isInside && distanceToBoundary > 3) {
                        alert('Il punto deve essere dentro i confini del terreno!');
                        return;
                    }
                    
                    // Se il punto è stato agganciato al confine ma è leggermente fuori, spostalo leggermente dentro
                    if (!isInside && distanceToBoundary <= 3) {
                        snappedPoint = movePointInsideBoundaryPotatura(snappedPoint, terrenoBoundaryCoordsPotatura);
                    }
                }
                
                // Salva il primo punto per la chiusura automatica
                if (poligonoCoords.length === 0) {
                    firstPointPotatura = snappedPoint;
                }
                
                // Verifica se il click è vicino al primo punto (per chiudere il poligono)
                if (firstPointPotatura && poligonoCoords.length >= 3) {
                    const distanzaDalPrimo = google.maps.geometry.spherical.computeDistanceBetween(
                        snappedPoint,
                        firstPointPotatura
                    );
                    // Se il click è entro 20 metri dal primo punto, chiudi il poligono
                    if (distanzaDalPrimo < 20) {
                        poligonoCoords.push(firstPointPotatura);
                        
                        // Termina tracciamento
                        isDrawingPolygonPotatura = false;
                        const btn = document.getElementById('btn-draw-polygon-potatura');
                        const mapContainer = document.querySelector('#modal-mappa-potatura .modal-mappa-body');
                        btn.textContent = '✏️ Traccia Poligono';
                        btn.style.background = '#17a2b8';
                        if (mapContainer) {
                            mapContainer.classList.remove('drawing-mode');
                            // Rimuovi anche il cursore via JavaScript
                            const mappaElement = document.getElementById('mappa-potatura-container');
                            if (mappaElement) {
                                mappaElement.style.cursor = '';
                                const mapDivs = mappaElement.querySelectorAll('div');
                                const mapCanvas = mappaElement.querySelectorAll('canvas');
                                mapDivs.forEach(div => {
                                    div.style.cursor = '';
                                });
                                mapCanvas.forEach(canvas => {
                                    canvas.style.cursor = '';
                                });
                            }
                        }
                        alert('Poligono chiuso! Puoi modificarlo trascinando i punti.');
                        
                        aggiornaPoligonoSullaMappaPotatura();
                        aggiornaInfoPoligonoPotatura();
                        return;
                    }
                }
                
                poligonoCoords.push(snappedPoint);
                
                // Aggiorna poligono sulla mappa
                aggiornaPoligonoSullaMappaPotatura();
                
                // Aggiorna info
                aggiornaInfoPoligonoPotatura();
            }, 300); // Timeout per distinguere singolo da doppio clic
        });
    }
};

async function init() {
    const firebaseService = await import(resolvePath('../../../core/services/firebase-service.js'));
    const { initializeTenantService, getCurrentTenantId, setCurrentTenantId } = await import(resolvePath('../../../core/services/tenant-service.js'));
    const auth = firebaseService.getAuthInstance();
    initializeTenantService();
    const { onAuthStateChanged } = firebaseService;
    onAuthStateChanged(auth, async (user) => {
        const loadingEl = document.getElementById('loading');
        const emptyEl = document.getElementById('empty-state');
        const tableWrapEl = document.getElementById('table-wrap');
        if (!user) user = await resolveAuthUser(auth);
        if (!user) {
            window.location.href = await loginPageUrl(resolvePath('../../../core/auth/login-standalone.html'));
            return;
        }
        let tenantId = getCurrentTenantId();
        if (!tenantId) {
            for (let i = 0; i < 10; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                tenantId = getCurrentTenantId();
                if (tenantId) break;
            }
        }
        if (tenantId) setCurrentTenantId(tenantId);
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
                        // Fallback se helper non disponibile (retry manuale)
                        var initTonyContext = function(retries) {
                            retries = retries || 0;
                            if (window.Tony && typeof window.Tony.setContext === 'function') {
                                window.Tony.setContext('dashboard', {
                                    info_azienda: { moduli_attivi: modules },
                                    moduli_attivi: modules
                                });
                                console.log('[Vigneto Potatura] Context Tony inizializzato con moduli:', modules);
                            } else if (retries < 10) {
                                setTimeout(function() { initTonyContext(retries + 1); }, 500);
                            }
                        };
                        initTonyContext();
                    }
                }
            }
        } catch (err) { console.warn('Verifica modulo manodopera:', err); }
        const operaiGroup = document.getElementById('potatura-operai-form-group');
        const proprietarioMsg = document.getElementById('potatura-proprietario-message');
        if (operaiGroup) operaiGroup.style.display = hasManodoperaModule ? 'block' : 'none';
        if (proprietarioMsg) proprietarioMsg.style.display = hasManodoperaModule ? 'none' : 'block';
        await loadVigneti();
        document.getElementById('filter-vigneto').addEventListener('change', loadPotature);
        document.getElementById('filter-anno').addEventListener('change', loadPotature);
        const btnNuova = document.getElementById('btn-nuova-potatura');
        if (btnNuova) btnNuova.addEventListener('click', openModalNew);
        document.getElementById('close-modal').addEventListener('click', closeModal);
        document.getElementById('cancel-btn').addEventListener('click', closeModal);
        document.getElementById('form-potatura').addEventListener('submit', savePotatura);
        await loadPotature();
    });
}
init();

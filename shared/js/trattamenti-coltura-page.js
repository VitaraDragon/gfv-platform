/**
 * Meccanica condivisa delle pagine Trattamenti vigneto e frutteto.
 * I moduli restano separati: servizi, id del form e testi arrivano da cfg.
 * Gli import dinamici via resolvePath restano relativi all'URL della pagina HTML.
 * @module shared/js/trattamenti-coltura-page
 */

import { formatDateLikeToItalianLongLocal } from '../../core/js/date-format-it.js';
import { showAlert } from '../../core/js/gfv-page-utils.js';
import { resolvePath, getBasePath } from '../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../core/js/simulator-standalone-page.js';

export async function mountTrattamentiColturaPage(cfg) {
    try {
        await window.GFVStandaloneReady;
    } catch (err) {
        console.error('[' + cfg.bootstrapTag + '] Bootstrap failed:', err);
        throw err;
    }

function formatDate(d) {
    if (!d) return '-';
    const s = formatDateLikeToItalianLongLocal(d);
    return s || '-';
}

/**
 * @param {string} colturaId
 * @param {string} currentTrattamentoId
 * @param {{ filterLavoroId?: string|null }} [options]
 */
async function populateTrattamentiPrecedentiSelect(colturaId, currentTrattamentoId, options = {}) {
    const sel = document.getElementById('trattamento-precedente-id');
    if (!sel || !colturaId) return;
    const filterLavoroId = options.filterLavoroId || null;
    const hintEl = document.querySelector('#trattamento-precedente-wrap small');
    if (hintEl) {
        hintEl.textContent = filterLavoroId
            ? 'Solo il trattamento collegato al lavoro sospeso. Scegli quello elencato: i prodotti si possono compilare automaticamente dal trattamento padre.'
            : 'Collega al documento lasciato aperto; utile per tracciabilità e magazzino.';
    }
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— Seleziona —';
    sel.appendChild(opt0);
    try {
        const { getTrattamenti } = await import(resolvePath(cfg.servicePath));
        const { getLavoro } = await import(resolvePath('../../../core/services/lavori-service.js'));
        const list = await getTrattamenti(colturaId, { orderBy: 'data', orderDirection: 'desc' });
        const candidati = list.filter(tr => tr.id !== currentTrattamentoId && (!filterLavoroId || tr.lavoroId === filterLavoroId));
        const lavoroIds = [...new Set(candidati.map(tr => tr.lavoroId).filter(Boolean))];
        const lavoroLabelById = new Map();
        await Promise.all(lavoroIds.map(async (lid) => {
            try {
                const lavoro = await getLavoro(lid);
                if (!lavoro) return;
                const raw = (lavoro.tipoLavoro || lavoro.nome || lavoro.id || '').trim();
                if (raw) lavoroLabelById.set(lid, raw.length > 48 ? raw.slice(0, 48) + '…' : raw);
            } catch (_) { /* ignore */ }
        }));
        function labelFallbackProdotti(tr) {
            if (tr.prodotti && tr.prodotti[0] && tr.prodotti[0].prodotto) return String(tr.prodotti[0].prodotto).slice(0, 24);
            if (tr.prodotto) return String(tr.prodotto).slice(0, 24);
            return '';
        }
        for (const tr of candidati) {
            const ds = formatDateLikeToItalianLongLocal(tr.data) || '—';
            const tipo = tr.tipoTrattamento || '';
            const daLavoro = tr.lavoroId ? lavoroLabelById.get(tr.lavoroId) : '';
            const primi = labelFallbackProdotti(tr);
            const terzo = daLavoro || primi;
            const label = [ds, tipo, terzo].filter(Boolean).join(' · ');
            const o = document.createElement('option');
            o.value = tr.id;
            o.textContent = label || tr.id;
            sel.appendChild(o);
        }
    } catch (e) { console.warn(cfg.logTag + ' lista precedenti', e); }
}

async function applicaDatiDaTrattamentoPrecedente(colturaId, precedenteId) {
    if (!colturaId || !precedenteId) return;
    try {
        const { getTrattamento } = await import(resolvePath(cfg.servicePath));
        const parent = await getTrattamento(colturaId, precedenteId);
        if (!parent) return;
        let rowsProdotti;
        if (parent.prodotti && parent.prodotti.length) {
            rowsProdotti = parent.prodotti.map(r => ({
                prodottoId: r.prodottoId || null,
                prodotto: r.prodotto || '',
                dosaggio: r.dosaggio,
                unitaDosaggio: r.unitaDosaggio || null,
                quantita: r.quantita,
                costo: r.costo
            }));
        } else {
            rowsProdotti = [{
                prodottoId: null,
                prodotto: parent.prodotto || '',
                dosaggio: parent.dosaggio != null && parent.dosaggio !== '' ? parseFloat(parent.dosaggio) : null,
                unitaDosaggio: null,
                quantita: null,
                costo: parent.costoProdotto ?? 0
            }];
        }
        if (!rowsProdotti.length) rowsProdotti = [{ prodottoId: null, prodotto: '', dosaggio: null, unitaDosaggio: null, quantita: null, costo: 0 }];
        renderProdottiTrattamento(rowsProdotti);
        if (typeof ricalcolaQuantitaCostoProdotti === 'function') ricalcolaQuantitaCostoProdotti();
        const gc = document.getElementById('trattamento-giorni-carenza');
        if (gc && parent.giorniCarenza != null && parent.giorniCarenza !== '') gc.value = parent.giorniCarenza;
        const cop = document.getElementById('trattamento-copertura-terreno');
        if (cop && parent.coperturaTerreno) cop.value = parent.coperturaTerreno;
    } catch (e) {
        console.warn(cfg.logTag + ' applicaDatiDaTrattamentoPrecedente', e);
    }
}

let colture = [];
let listRows = [];
let currentColturaId = null;
let currentAnno = null;
let trattamentoFromAttivitaOnly = false;
let poligonoCoordsTrattamento = [];
let mappaTrattamento = null;
let poligonoTrattamentoPoly = null;
let terrenoPolygonTrattamento = null;
let terrenoBoundaryCoordsTrattamento = [];
let firstPointTrattamento = null;
let isDrawingPolygonTrattamento = false;
const SNAP_DISTANCE_METERS_TRATTAMENTO = 5;
const VERTEX_SNAP_DISTANCE_METERS_TRATTAMENTO = 8;
let listProdottiAnagrafica = [];
let hasMagazzinoModule = false;
/** Superficie terreno (ha) da anagrafe, per checkbox "tutto il terreno" */
let cachedTerrenoSuperficieHa = null;

async function loadTerrenoSuperficieForModal(colturaId) {
    cachedTerrenoSuperficieHa = null;
    const hint = document.getElementById('trattamento-superficie-anagrafe-hint');
    if (hint) hint.style.display = 'none';
    if (!colturaId) return null;
    const recordColtura = colture.find(v => v.id === colturaId);
    if (!recordColtura || !recordColtura.terrenoId) return null;
    try {
        const { getTerreno } = await import(resolvePath('../../../core/services/terreni-service.js'));
        const terreno = await getTerreno(recordColtura.terrenoId);
        if (terreno && terreno.superficie != null && terreno.superficie !== '') {
            const n = parseFloat(terreno.superficie);
            if (!isNaN(n) && n > 0) cachedTerrenoSuperficieHa = n;
        }
    } catch (e) {
        console.warn(cfg.logTag + ' loadTerrenoSuperficieForModal', e);
    }
    return cachedTerrenoSuperficieHa;
}

function applySuperficieDaAnagrafeTerreno(checked) {
    const sup = document.getElementById('trattamento-superficie');
    const btn = document.getElementById('btn-traccia-zona-trattamento');
    const poligonoInfo = document.getElementById('poligono-info-trattamento');
    if (!sup || !btn) return;
    if (checked) {
        if (cachedTerrenoSuperficieHa != null) {
            sup.value = Number(cachedTerrenoSuperficieHa).toFixed(2);
        }
        sup.readOnly = true;
        poligonoCoordsTrattamento = [];
        if (poligonoInfo) poligonoInfo.style.display = 'none';
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.title = 'Non necessario: indicato trattamento su tutta la superficie da anagrafe';
    } else {
        sup.readOnly = false;
        btn.disabled = false;
        btn.style.opacity = '';
        btn.title = 'Traccia o visualizza zona trattata sulla mappa';
    }
    if (typeof ricalcolaQuantitaCostoProdotti === 'function') ricalcolaQuantitaCostoProdotti();
}

async function syncSuperficieAnagrafeCheckboxUi(t, colturaId) {
    await loadTerrenoSuperficieForModal(colturaId);
    const cbAn = document.getElementById('trattamento-superficie-anagrafe');
    const hint = document.getElementById('trattamento-superficie-anagrafe-hint');
    if (!cbAn) return;
    if (cachedTerrenoSuperficieHa == null) {
        cbAn.disabled = true;
        cbAn.checked = false;
        if (hint) hint.style.display = 'block';
        applySuperficieDaAnagrafeTerreno(false);
    } else {
        cbAn.disabled = false;
        if (hint) hint.style.display = 'none';
        cbAn.checked = !!(t && t.superficieDaAnagrafeTerreno);
        applySuperficieDaAnagrafeTerreno(!!cbAn.checked);
    }
}

async function syncSuperficieAnagrafeAfterTonyInject() {
    const vidEl = document.getElementById(cfg.hiddenId);
    const vid = vidEl && vidEl.value ? String(vidEl.value).trim() : '';
    await loadTerrenoSuperficieForModal(vid);
    const cb = document.getElementById('trattamento-superficie-anagrafe');
    if (cb && cb.checked && !cb.disabled) {
        applySuperficieDaAnagrafeTerreno(true);
    }
}

async function loadProdottiAnagrafica() {
    try {
        const { getAllProdotti } = await import(resolvePath('../../../modules/magazzino/services/prodotti-service.js'));
        listProdottiAnagrafica = await getAllProdotti({ soloAttivi: true }) || [];
    } catch (e) {
        console.warn(cfg.logTag + ' Anagrafica prodotti non disponibile:', e);
        listProdottiAnagrafica = [];
    }
}

async function getDisplayNameForUserId(userId) {
    if (!userId || typeof userId !== 'string') return '';
    try {
        const { getDb, getDoc, doc } = await import(resolvePath('../../../core/services/firebase-service.js'));
        const db = getDb();
        if (!db) return userId;
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return userId;
        const u = userDoc.data();
        return `${(u.nome || '').trim()} ${(u.cognome || '').trim()}`.trim() || u.email || userId;
    } catch (e) { return userId; }
}

function renderProdottiTrattamento(rows, prodottiAnagrafica) {
    const tbody = document.getElementById('tbody-prodotti-trattamento');
    if (!tbody) return;
    const superficie = parseFloat(document.getElementById('trattamento-superficie')?.value) || 0;
    prodottiAnagrafica = prodottiAnagrafica || listProdottiAnagrafica;
    tbody.innerHTML = rows.map((r, idx) => {
        const qta = (r.dosaggio != null && !isNaN(r.dosaggio) && superficie > 0) ? (r.dosaggio * superficie) : (r.quantita != null ? r.quantita : null);
        const prezzoUnit = r.prezzoUnitario != null ? r.prezzoUnitario : (prodottiAnagrafica.find(p => p.id === r.prodottoId)?.prezzoUnitario);
        const costo = (qta != null && prezzoUnit != null && prezzoUnit > 0) ? (qta * prezzoUnit) : (r.costo != null ? r.costo : 0);
        const unita = r.unitaDosaggio || prodottiAnagrafica.find(p => p.id === r.prodottoId)?.unitaMisura || '-';
        const opts = prodottiAnagrafica.map(p => `<option value="${p.id}" ${r.prodottoId === p.id ? 'selected' : ''}>${(p.nome || p.codice || p.id)}</option>`).join('');
        const isAltro = !r.prodottoId && r.prodotto;
        return `<tr data-idx="${idx}">
            <td style="padding: 6px 8px;">
                <select class="prodotto-select" data-idx="${idx}" style="width: 100%; max-width: 180px;">
                    <option value="">— Seleziona o Altro —</option>${opts}
                </select>
                <input type="text" class="prodotto-nome-altro" data-idx="${idx}" placeholder="Nome se Altro" value="${isAltro ? (r.prodotto || '').replace(/"/g, '&quot;') : ''}" style="margin-top: 4px; width: 100%; max-width: 180px; display: ${isAltro ? 'block' : 'none'};">
            </td>
            <td style="padding: 6px 8px;"><input type="number" class="prodotto-dosaggio" data-idx="${idx}" min="0" step="0.01" value="${(r.dosaggio != null && Number.isFinite(Number(r.dosaggio))) ? r.dosaggio : ''}" style="width: 65px; max-width: 75px; box-sizing: border-box;"></td>
            <td style="padding: 6px 8px;"><span class="prodotto-unita" data-idx="${idx}">${unita}</span></td>
            <td style="padding: 6px 8px;"><span class="prodotto-quantita" data-idx="${idx}">${qta != null ? qta.toFixed(2) : '-'}</span></td>
            <td style="padding: 6px 8px;"><input type="number" class="prodotto-costo" data-idx="${idx}" min="0" step="0.01" value="${(Number(costo) || 0).toFixed(2)}" style="width: 100px; min-width: 100px; box-sizing: border-box;" ${r.prodottoId && prezzoUnit ? 'readonly' : ''} title="${r.prodottoId ? 'Calcolato da anagrafica' : 'Inserisci manuale'}"></td>
            <td style="padding: 6px 8px;"><button type="button" class="btn btn-sm btn-danger rimuovi-prodotto" data-idx="${idx}">🗑️</button></td>
        </tr>`;
    }).join('');
    tbody.querySelectorAll('.prodotto-select').forEach(sel => {
        sel.addEventListener('change', function() {
            const idx = parseInt(this.getAttribute('data-idx'), 10);
            const row = rows[idx];
            const opt = listProdottiAnagrafica.find(p => p.id === this.value);
            const nomeAltro = tbody.querySelector(`.prodotto-nome-altro[data-idx="${idx}"]`);
            if (nomeAltro) nomeAltro.style.display = this.value ? 'none' : 'block';
            if (opt) {
                const dosaggioInput = tbody.querySelector(`.prodotto-dosaggio[data-idx="${idx}"]`);
                if (dosaggioInput && (opt.dosaggioMin != null || opt.dosaggioMax != null)) {
                    const v = opt.dosaggioMin != null ? opt.dosaggioMin : opt.dosaggioMax;
                    dosaggioInput.value = v;
                }
                const unitaSpan = tbody.querySelector(`.prodotto-unita[data-idx="${idx}"]`);
                if (unitaSpan) unitaSpan.textContent = opt.unitaMisura || '-';
            }
            ricalcolaQuantitaCostoProdotti();
        });
    });
    tbody.querySelectorAll('.prodotto-dosaggio').forEach(inp => {
        inp.addEventListener('input', () => ricalcolaQuantitaCostoProdotti());
    });
    tbody.querySelectorAll('.prodotto-costo').forEach(inp => {
        inp.addEventListener('input', () => aggiornaTotaleCostoProdotti());
    });
    tbody.querySelectorAll('.rimuovi-prodotto').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.getAttribute('data-idx'), 10);
            const currentRows = getProdottiRowsFromTable();
            currentRows.splice(idx, 1);
            renderProdottiTrattamento(currentRows.length ? currentRows : [{ prodottoId: null, prodotto: '', dosaggio: null, unitaDosaggio: null, quantita: null, costo: 0 }]);
        });
    });
    aggiornaTotaleCostoProdotti();
    aggiornaGiorniCarenzaDaProdotti();
}

function getProdottiRowsFromTable() {
    const tbody = document.getElementById('tbody-prodotti-trattamento');
    if (!tbody) return [];
    const superficie = parseFloat(document.getElementById('trattamento-superficie')?.value) || 0;
    const rows = [];
    tbody.querySelectorAll('tr[data-idx]').forEach((tr, i) => {
        const idx = tr.getAttribute('data-idx');
        const sel = tr.querySelector('.prodotto-select');
        const nomeAltro = tr.querySelector('.prodotto-nome-altro');
        const dosaggioInp = tr.querySelector('.prodotto-dosaggio');
        const costoInp = tr.querySelector('.prodotto-costo');
        const prodottoId = sel?.value || null;
        const prodotto = prodottoId ? (listProdottiAnagrafica.find(p => p.id === prodottoId)?.nome || prodottoId) : (nomeAltro?.value?.trim() || '');
        const dosaggio = dosaggioInp?.value !== '' ? parseFloat(dosaggioInp.value) : null;
        const costo = costoInp?.value !== '' ? parseFloat(costoInp.value) : 0;
        const quantita = (dosaggio != null && superficie > 0) ? dosaggio * superficie : null;
        const prodAnag = listProdottiAnagrafica.find(p => p.id === prodottoId);
        const unitaDosaggio = prodAnag?.unitaMisura || null;
        rows.push({ prodottoId: prodottoId || null, prodotto, dosaggio, unitaDosaggio, quantita, costo });
    });
    return rows;
}

/**
 * Verifica che i dosaggi inseriti siano nel range consigliato (dosaggioMin/dosaggioMax) in anagrafica.
 * @param {Array} rowsProdotti - Righe prodotti da getProdottiRowsFromTable()
 * @returns {{ valid: boolean, message?: string }}
 */
function validaDosaggiProdotti(rowsProdotti) {
    for (const r of rowsProdotti) {
        if (!r.prodottoId || r.dosaggio == null || isNaN(r.dosaggio)) continue;
        const prod = listProdottiAnagrafica.find(p => p.id === r.prodottoId);
        if (!prod) continue;
        const nome = (r.prodotto || prod.nome || prod.codice || '').trim() || 'Prodotto';
        if (prod.dosaggioMax != null && r.dosaggio > prod.dosaggioMax) {
            return { valid: false, message: 'Dosaggio superiore al consigliato per ' + nome + '.' };
        }
        if (prod.dosaggioMin != null && r.dosaggio < prod.dosaggioMin) {
            return { valid: false, message: 'Dosaggio inferiore al consigliato per ' + nome + '.' };
        }
    }
    return { valid: true };
}

/**
 * Verifica se un trattamento in lista ha dosaggi fuori range (per colonna Avvisi).
 * @param {Object} row - Riga lista (row.trattamento.prodotti)
 * @returns {{ hasWarning: boolean, tooltip: string }}
 */
function avvisoDosaggioTrattamento(row) {
    const t = row && row.trattamento;
    if (!t || !t.prodotti || !listProdottiAnagrafica.length) return { hasWarning: false, tooltip: '' };
    const messaggi = [];
    for (const p of t.prodotti) {
        if (!p.prodottoId || p.dosaggio == null || isNaN(p.dosaggio)) continue;
        const prod = listProdottiAnagrafica.find(pr => pr.id === p.prodottoId);
        if (!prod) continue;
        const nome = (p.prodotto || prod.nome || prod.codice || '').trim() || 'Prodotto';
        if (prod.dosaggioMax != null && p.dosaggio > prod.dosaggioMax) messaggi.push('Dosaggio superiore al consigliato per ' + nome);
        if (prod.dosaggioMin != null && p.dosaggio < prod.dosaggioMin) messaggi.push('Dosaggio inferiore al consigliato per ' + nome);
    }
    return { hasWarning: messaggi.length > 0, tooltip: messaggi.join('; ') };
}

function ricalcolaQuantitaCostoProdotti() {
    const rows = getProdottiRowsFromTable();
    const superficie = parseFloat(document.getElementById('trattamento-superficie')?.value) || 0;
    const tbody = document.getElementById('tbody-prodotti-trattamento');
    if (!tbody) return;
    tbody.querySelectorAll('tr[data-idx]').forEach((tr, i) => {
        const idx = tr.getAttribute('data-idx');
        const r = rows[i];
        if (!r) return;
        const qta = (r.dosaggio != null && superficie > 0) ? r.dosaggio * superficie : null;
        const prodAnag = listProdottiAnagrafica.find(p => p.id === r.prodottoId);
        const prezzoUnit = prodAnag?.prezzoUnitario;
        const costoCalc = (qta != null && prezzoUnit != null && prezzoUnit > 0) ? qta * prezzoUnit : r.costo;
        const unitaSpan = tr.querySelector('.prodotto-unita');
        const quantitaSpan = tr.querySelector('.prodotto-quantita');
        const costoInp = tr.querySelector('.prodotto-costo');
        if (unitaSpan) unitaSpan.textContent = prodAnag?.unitaMisura || '-';
        if (quantitaSpan) quantitaSpan.textContent = qta != null ? qta.toFixed(2) : '-';
        if (costoInp) {
            costoInp.value = (Number(costoCalc) || 0).toFixed(2);
            costoInp.readOnly = !!(r.prodottoId && prezzoUnit != null);
        }
    });
    aggiornaTotaleCostoProdotti();
    aggiornaGiorniCarenzaDaProdotti();
}

function aggiornaTotaleCostoProdotti() {
    const rows = getProdottiRowsFromTable();
    const totale = rows.reduce((s, r) => s + (Number(r.costo) || 0), 0);
    const el = document.getElementById('totale-costo-prodotti-trattamento');
    if (el) el.textContent = 'Totale costo prodotti: ' + totale.toFixed(2) + ' €';
}

function aggiornaGiorniCarenzaDaProdotti() {
    const rows = getProdottiRowsFromTable();
    let maxCarenza = null;
    rows.forEach(r => {
        if (r.prodottoId) {
            const p = listProdottiAnagrafica.find(pr => pr.id === r.prodottoId);
            if (p && p.giorniCarenza != null && p.giorniCarenza > 0) {
                if (maxCarenza == null || p.giorniCarenza > maxCarenza) maxCarenza = p.giorniCarenza;
            }
        }
    });
    const inp = document.getElementById('trattamento-giorni-carenza');
    if (inp) inp.value = maxCarenza != null ? maxCarenza : '';
}

function aggiungiRigaProdottoTrattamento() {
    const rows = getProdottiRowsFromTable();
    rows.push({ prodottoId: null, prodotto: '', dosaggio: null, unitaDosaggio: null, quantita: null, costo: 0 });
    renderProdottiTrattamento(rows);
}

async function loadPoligonoFromZoneLavorateTrattamento(lavoroId) {
    const { getCurrentTenantId } = await import(resolvePath('../../../core/services/tenant-service.js'));
    const { getDb } = await import(resolvePath('../../../core/services/firebase-service.js'));
    const { collection, getDocs } = await import(resolvePath('../../../core/services/firebase-service.js'));
    const tenantId = getCurrentTenantId();
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
    } catch (e) { console.warn('[TRATTAMENTI] loadPoligonoFromZoneLavorate:', e); }
    return null;
}

async function initMappaTrattamento(terreno) {
    const container = document.getElementById('mappa-trattamento-container');
    if (!container) return;
    const center = terreno.polygonCoords && terreno.polygonCoords.length > 0
        ? { lat: terreno.polygonCoords[0].lat, lng: terreno.polygonCoords[0].lng }
        : { lat: 43.7228, lng: 10.4017 };
    mappaTrattamento = new google.maps.Map(container, {
        center,
        zoom: 15,
        mapTypeId: 'satellite',
        mapTypeControl: true,
        streetViewControl: false
    });
    await caricaTerrenoSullaMappaTrattamento(terreno);
}

async function caricaTerrenoSullaMappaTrattamento(terreno) {
    if (!mappaTrattamento || !terreno || !terreno.polygonCoords || terreno.polygonCoords.length === 0) return;
    if (terrenoPolygonTrattamento) terrenoPolygonTrattamento.setMap(null);
    const terrenoCoords = terreno.polygonCoords.map(c => new google.maps.LatLng(c.lat, c.lng));
    terrenoPolygonTrattamento = new google.maps.Polygon({
        paths: terrenoCoords,
        fillColor: '#2E8B57',
        fillOpacity: 0.2,
        strokeColor: '#2E8B57',
        strokeWeight: 3,
        editable: false,
        clickable: false,
        zIndex: 1
    });
    terrenoPolygonTrattamento.setMap(mappaTrattamento);
    terrenoBoundaryCoordsTrattamento = terrenoCoords;
    const bounds = new google.maps.LatLngBounds();
    terrenoCoords.forEach(coord => bounds.extend(coord));
    mappaTrattamento.fitBounds(bounds);
}

/** Normalizza coordinate poligono ed esclude punti non numerici (evita NaN su Google Maps). */
function coordsToValidLatLngArrayForTrattamento(coordinate) {
    if (!coordinate || !coordinate.length || typeof google === 'undefined' || !google.maps) return [];
    const out = [];
    for (let i = 0; i < coordinate.length; i++) {
        const c = coordinate[i];
        if (!c) continue;
        let lat;
        let lng;
        if (typeof c.lat === 'function') {
            lat = c.lat();
            lng = c.lng();
        } else {
            lat = Number(c.lat);
            lng = Number(c.lng);
        }
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            out.push(new google.maps.LatLng(lat, lng));
        }
    }
    return out;
}

function aggiornaInfoPoligonoTrattamento() {
    const infoDiv = document.getElementById('mappa-info-trattamento');
    const superficieDiv = document.getElementById('superficie-calcolata-trattamento');
    const puntiDiv = document.getElementById('punti-tracciati-trattamento');
    const btnClear = document.getElementById('btn-clear-polygon-trattamento');
    const btnConferma = document.getElementById('btn-conferma-polygon-trattamento');
    if (poligonoCoordsTrattamento.length >= 3) {
        const areaMq = google.maps.geometry.spherical.computeArea(poligonoCoordsTrattamento);
        const areaHa = areaMq / 10000;
        if (superficieDiv) superficieDiv.textContent = Number.isFinite(areaHa) ? (areaHa.toFixed(2) + ' ha') : '—';
        if (puntiDiv) puntiDiv.textContent = poligonoCoordsTrattamento.length;
        if (infoDiv) infoDiv.style.display = 'block';
        if (btnClear) btnClear.style.display = 'inline-block';
        if (btnConferma) btnConferma.style.display = 'inline-block';
    } else {
        if (infoDiv) infoDiv.style.display = 'none';
        if (btnClear) btnClear.style.display = 'none';
        if (btnConferma) btnConferma.style.display = 'none';
    }
}

function aggiornaPoligonoSullaMappaTrattamento() {
    if (!mappaTrattamento || poligonoCoordsTrattamento.length < 2) return;
    if (poligonoTrattamentoPoly) { poligonoTrattamentoPoly.setMap(null); poligonoTrattamentoPoly = null; }
    poligonoTrattamentoPoly = new google.maps.Polygon({
        paths: poligonoCoordsTrattamento,
        fillColor: '#6A1B9A',
        fillOpacity: 0.4,
        strokeColor: '#4A148C',
        strokeWeight: 4,
        editable: true,
        draggable: false
    });
    poligonoTrattamentoPoly.setMap(mappaTrattamento);
    google.maps.event.addListener(poligonoTrattamentoPoly.getPath(), 'set_at', () => { poligonoCoordsTrattamento = poligonoTrattamentoPoly.getPath().getArray(); aggiornaInfoPoligonoTrattamento(); });
    google.maps.event.addListener(poligonoTrattamentoPoly.getPath(), 'insert_at', () => { poligonoCoordsTrattamento = poligonoTrattamentoPoly.getPath().getArray(); aggiornaInfoPoligonoTrattamento(); });
    google.maps.event.addListener(poligonoTrattamentoPoly.getPath(), 'remove_at', () => { poligonoCoordsTrattamento = poligonoTrattamentoPoly.getPath().getArray(); aggiornaInfoPoligonoTrattamento(); });
}

function caricaPoligonoEsistenteTrattamento(coordinate, soloConsultazione) {
    if (!coordinate || coordinate.length < 3 || !mappaTrattamento) return;
    poligonoCoordsTrattamento = coordsToValidLatLngArrayForTrattamento(coordinate);
    if (poligonoCoordsTrattamento.length < 3) {
        console.warn(cfg.logTag + ' Poligono non mostrato: meno di 3 coordinate valide (lat/lng).');
        return;
    }
    if (soloConsultazione) {
        if (poligonoTrattamentoPoly) poligonoTrattamentoPoly.setMap(null);
        poligonoTrattamentoPoly = new google.maps.Polygon({
            paths: poligonoCoordsTrattamento,
            fillColor: '#6A1B9A',
            fillOpacity: 0.4,
            strokeColor: '#4A148C',
            strokeWeight: 4,
            editable: false,
            draggable: false,
            map: mappaTrattamento
        });
        aggiornaInfoPoligonoTrattamento();
        return;
    }
    aggiornaPoligonoSullaMappaTrattamento();
    aggiornaInfoPoligonoTrattamento();
}

window.apriMappaTracciamentoTrattamento = async function apriMappaTracciamentoTrattamento() {
    const cbAnagrafe = document.getElementById('trattamento-superficie-anagrafe');
    if (cbAnagrafe && cbAnagrafe.checked && !cbAnagrafe.disabled) {
        return;
    }
    if (typeof google === 'undefined' || !google.maps) {
        let attempts = 0;
        while (attempts < 50 && (typeof google === 'undefined' || !google.maps)) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }
        if (typeof google === 'undefined' || !google.maps) {
            alert('Google Maps non è ancora caricato. Attendi e riprova.');
            return;
        }
    }
    const lavoroId = document.getElementById('trattamento-lavoro-id').value.trim();
    const soloConsultazione = lavoroId !== '' && !trattamentoFromAttivitaOnly;
    const colturaId = document.getElementById(cfg.hiddenId).value || document.getElementById(cfg.selectId).value;
    if (!colturaId) { alert(cfg.alertSelect); return; }
    const recordColtura = colture.find(v => v.id === colturaId);
    if (!recordColtura || !recordColtura.terrenoId) { alert(cfg.alertNoTerreno); return; }
    const { getTerreno } = await import(resolvePath('../../../core/services/terreni-service.js'));
    const terreno = await getTerreno(recordColtura.terrenoId);
    if (!terreno || !terreno.polygonCoords || terreno.polygonCoords.length === 0) {
        alert('Il terreno non ha confini tracciati. Traccia prima i confini del terreno.');
        return;
    }
    document.getElementById('modal-mappa-trattamento').classList.add('active');
    if (!mappaTrattamento) await initMappaTrattamento(terreno);
    else await caricaTerrenoSullaMappaTrattamento(terreno);
    setTimeout(async () => {
        if (!mappaTrattamento) return;
        if (poligonoCoordsTrattamento && poligonoCoordsTrattamento.length >= 3) {
            const coords = poligonoCoordsTrattamento.map(c => {
                if (typeof c.lat === 'function') return { lat: c.lat(), lng: c.lng() };
                return { lat: c.lat, lng: c.lng };
            });
            caricaPoligonoEsistenteTrattamento(coords, soloConsultazione);
        } else if (lavoroId) {
            const fromLavoro = await loadPoligonoFromZoneLavorateTrattamento(lavoroId);
            if (fromLavoro && fromLavoro.length >= 3) {
                poligonoCoordsTrattamento = fromLavoro.map(c => new google.maps.LatLng(c.lat, c.lng));
                caricaPoligonoEsistenteTrattamento(poligonoCoordsTrattamento, true);
            }
        } else {
            const trattamentoId = document.getElementById('trattamento-id').value;
            if (trattamentoId && colturaId) {
                try {
                    const { getTrattamento } = await import(resolvePath(cfg.servicePath));
                    const t = await getTrattamento(colturaId, trattamentoId);
                    if (t && t.poligonoTrattamento && t.poligonoTrattamento.length >= 3) {
                        caricaPoligonoEsistenteTrattamento(t.poligonoTrattamento, soloConsultazione);
                    }
                } catch (e) { console.warn(e); }
            }
        }
        aggiornaInfoPoligonoTrattamento();
    }, 300);
    if (soloConsultazione) {
        document.getElementById('mappa-trattamento-solo-consultazione').style.display = 'block';
        document.getElementById('btn-draw-polygon-trattamento').style.display = 'none';
        document.getElementById('btn-clear-polygon-trattamento').style.display = 'none';
        document.getElementById('btn-conferma-polygon-trattamento').style.display = 'none';
    } else {
        document.getElementById('mappa-trattamento-solo-consultazione').style.display = 'none';
        document.getElementById('btn-draw-polygon-trattamento').style.display = 'inline-block';
    }
};

window.chiudiMappaTracciamentoTrattamento = function() {
    if (isDrawingPolygonTrattamento && mappaTrattamento && mappaTrattamento.clickListenerTrattamento) {
        google.maps.event.removeListener(mappaTrattamento.clickListenerTrattamento);
        mappaTrattamento.clickListenerTrattamento = null;
    }
    isDrawingPolygonTrattamento = false;
    const mapContainer = document.querySelector('#modal-mappa-trattamento .modal-mappa-body');
    if (mapContainer) mapContainer.classList.remove('drawing-mode');
    const mappaElement = document.getElementById('mappa-trattamento-container');
    if (mappaElement) {
        mappaElement.style.cursor = '';
        mappaElement.querySelectorAll('div').forEach(d => { d.style.cursor = ''; });
        mappaElement.querySelectorAll('canvas').forEach(c => { c.style.cursor = ''; });
    }
    const btn = document.getElementById('btn-draw-polygon-trattamento');
    if (btn) { btn.textContent = '✏️ Traccia Poligono'; btn.style.background = '#17a2b8'; }
    document.getElementById('modal-mappa-trattamento').classList.remove('active');
};

window.eliminaPoligonoTrattamento = function(resetDrawingMode = true) {
    if (poligonoTrattamentoPoly) { poligonoTrattamentoPoly.setMap(null); poligonoTrattamentoPoly = null; }
    poligonoCoordsTrattamento = [];
    firstPointTrattamento = null;
    if (resetDrawingMode) {
        isDrawingPolygonTrattamento = false;
        const mapContainer = document.querySelector('#modal-mappa-trattamento .modal-mappa-body');
        if (mapContainer) mapContainer.classList.remove('drawing-mode');
        const mappaElement = document.getElementById('mappa-trattamento-container');
        if (mappaElement) {
            mappaElement.style.cursor = '';
            mappaElement.querySelectorAll('div').forEach(d => { d.style.cursor = ''; });
            mappaElement.querySelectorAll('canvas').forEach(c => { c.style.cursor = ''; });
        }
        const btn = document.getElementById('btn-draw-polygon-trattamento');
        if (btn) { btn.textContent = '✏️ Traccia Poligono'; btn.style.background = '#17a2b8'; }
        if (mappaTrattamento && mappaTrattamento.clickListenerTrattamento) {
            google.maps.event.removeListener(mappaTrattamento.clickListenerTrattamento);
            mappaTrattamento.clickListenerTrattamento = null;
        }
    }
    aggiornaInfoPoligonoTrattamento();
};

window.confermaPoligonoTrattamento = function() {
    if (poligonoCoordsTrattamento.length < 3) { alert('Traccia almeno 3 punti per creare un poligono valido'); return; }
    const areaMq = google.maps.geometry.spherical.computeArea(poligonoCoordsTrattamento);
    const areaHa = areaMq / 10000;
    const supInput = document.getElementById('trattamento-superficie');
    if (supInput) supInput.value = Number.isFinite(areaHa) ? areaHa.toFixed(2) : '';
    const poligonoInfo = document.getElementById('poligono-info-trattamento');
    if (poligonoInfo) poligonoInfo.style.display = 'block';
    chiudiMappaTracciamentoTrattamento();
};

function findNearestVertexTrattamento(point, boundaryCoords, maxDistance) {
    let nearestVertex = null;
    let minDistance = maxDistance;
    boundaryCoords.forEach(vertex => {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point, vertex);
        if (distance < minDistance) { minDistance = distance; nearestVertex = vertex; }
    });
    return nearestVertex;
}
function findNearestPointOnBoundaryTrattamento(point, boundaryCoords, maxDistance) {
    let nearestPoint = null;
    let minDistance = maxDistance;
    for (let i = 0; i < boundaryCoords.length; i++) {
        const start = boundaryCoords[i];
        const end = boundaryCoords[(i + 1) % boundaryCoords.length];
        const closestPoint = getClosestPointOnSegmentTrattamento(point, start, end);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point, closestPoint);
        if (distance < minDistance) { minDistance = distance; nearestPoint = closestPoint; }
    }
    return nearestPoint;
}
function getClosestPointOnSegmentTrattamento(point, segmentStart, segmentEnd) {
    const A = point.lat(), B = point.lng();
    const C = segmentStart.lat(), D = segmentStart.lng();
    const E = segmentEnd.lat(), F = segmentEnd.lng();
    const dx = E - C, dy = F - D;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return segmentStart;
    const t = Math.max(0, Math.min(1, ((A - C) * dx + (B - D) * dy) / lengthSquared));
    return new google.maps.LatLng(C + t * dx, D + t * dy);
}
function getDistanceToBoundaryTrattamento(point, boundaryCoords) {
    let minDistance = Infinity;
    for (let i = 0; i < boundaryCoords.length; i++) {
        const start = boundaryCoords[i];
        const end = boundaryCoords[(i + 1) % boundaryCoords.length];
        const closestPoint = getClosestPointOnSegmentTrattamento(point, start, end);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(point, closestPoint);
        minDistance = Math.min(minDistance, distance);
    }
    return minDistance;
}
function movePointInsideBoundaryTrattamento(point, boundaryCoords) {
    const nearestBoundaryPoint = findNearestPointOnBoundaryTrattamento(point, boundaryCoords, 100);
    if (!nearestBoundaryPoint) return point;
    const center = getPolygonCenterTrattamento(boundaryCoords);
    const dx = center.lat() - nearestBoundaryPoint.lat();
    const dy = center.lng() - nearestBoundaryPoint.lng();
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return point;
    const moveDistance = 1 / 111000;
    const normalizedDx = dx / length, normalizedDy = dy / length;
    return new google.maps.LatLng(
        nearestBoundaryPoint.lat() + normalizedDx * moveDistance,
        nearestBoundaryPoint.lng() + normalizedDy * moveDistance
    );
}
function getPolygonCenterTrattamento(coords) {
    let sumLat = 0, sumLng = 0;
    coords.forEach(coord => { sumLat += coord.lat(); sumLng += coord.lng(); });
    return new google.maps.LatLng(sumLat / coords.length, sumLng / coords.length);
}

window.iniziaTracciamentoPoligonoTrattamento = function() {
    if (!mappaTrattamento) return;

    if (isDrawingPolygonTrattamento) {
        isDrawingPolygonTrattamento = false;
        const btn = document.getElementById('btn-draw-polygon-trattamento');
        if (btn) { btn.textContent = '✏️ Traccia Poligono'; btn.style.background = '#17a2b8'; }
        const mapContainer = document.querySelector('#modal-mappa-trattamento .modal-mappa-body');
        if (mapContainer) mapContainer.classList.remove('drawing-mode');
        const mappaElement = document.getElementById('mappa-trattamento-container');
        if (mappaElement) {
            mappaElement.style.cursor = '';
            mappaElement.querySelectorAll('div').forEach(d => { d.style.cursor = ''; });
            mappaElement.querySelectorAll('canvas').forEach(c => { c.style.cursor = ''; });
        }
        if (mappaTrattamento.clickListenerTrattamento) {
            google.maps.event.removeListener(mappaTrattamento.clickListenerTrattamento);
            mappaTrattamento.clickListenerTrattamento = null;
        }
        aggiornaInfoPoligonoTrattamento();
        return;
    }

    if (poligonoTrattamentoPoly) { poligonoTrattamentoPoly.setMap(null); poligonoTrattamentoPoly = null; }
    poligonoCoordsTrattamento = [];
    firstPointTrattamento = null;
    if (mappaTrattamento.clickListenerTrattamento) {
        google.maps.event.removeListener(mappaTrattamento.clickListenerTrattamento);
        mappaTrattamento.clickListenerTrattamento = null;
    }
    isDrawingPolygonTrattamento = true;
    const btn = document.getElementById('btn-draw-polygon-trattamento');
    if (btn) { btn.textContent = '⏸️ Pausa Tracciamento'; btn.style.background = '#dc3545'; }
    const mapContainer = document.querySelector('#modal-mappa-trattamento .modal-mappa-body');
    if (mapContainer) mapContainer.classList.add('drawing-mode');
    const mappaElement = document.getElementById('mappa-trattamento-container');
    if (mappaElement) {
        mappaElement.style.cursor = 'crosshair';
        setTimeout(() => {
            mappaElement.querySelectorAll('div').forEach(d => { d.style.cursor = 'crosshair'; });
            mappaElement.querySelectorAll('canvas').forEach(c => { c.style.cursor = 'crosshair'; });
        }, 100);
    }

    let clickTimeout = null;
    mappaTrattamento.clickListenerTrattamento = mappaTrattamento.addListener('click', (event) => {
        if (!isDrawingPolygonTrattamento) return;
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
            if (poligonoCoordsTrattamento.length >= 3) {
                isDrawingPolygonTrattamento = false;
                if (btn) { btn.textContent = '✏️ Traccia Poligono'; btn.style.background = '#17a2b8'; }
                if (mapContainer) mapContainer.classList.remove('drawing-mode');
                if (mappaElement) {
                    mappaElement.style.cursor = '';
                    mappaElement.querySelectorAll('div').forEach(d => { d.style.cursor = ''; });
                    mappaElement.querySelectorAll('canvas').forEach(c => { c.style.cursor = ''; });
                }
                if (mappaTrattamento.clickListenerTrattamento) {
                    google.maps.event.removeListener(mappaTrattamento.clickListenerTrattamento);
                    mappaTrattamento.clickListenerTrattamento = null;
                }
                aggiornaPoligonoSullaMappaTrattamento();
                aggiornaInfoPoligonoTrattamento();
                alert('Tracciamento completato. Puoi modificare il poligono trascinando i punti.');
                return;
            }
            return;
        }
        clickTimeout = setTimeout(() => {
            clickTimeout = null;
            const disableSnap = event.domEvent && event.domEvent.shiftKey;
            let snappedPoint = event.latLng;
            let snapApplied = false;

            if (!disableSnap && terrenoBoundaryCoordsTrattamento.length > 0) {
                const vertexSnap = findNearestVertexTrattamento(snappedPoint, terrenoBoundaryCoordsTrattamento, VERTEX_SNAP_DISTANCE_METERS_TRATTAMENTO);
                if (vertexSnap) {
                    const snapDistance = google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, vertexSnap);
                    if (snapDistance <= VERTEX_SNAP_DISTANCE_METERS_TRATTAMENTO) { snappedPoint = vertexSnap; snapApplied = true; }
                }
                if (!snapApplied) {
                    const boundarySnap = findNearestPointOnBoundaryTrattamento(snappedPoint, terrenoBoundaryCoordsTrattamento, SNAP_DISTANCE_METERS_TRATTAMENTO);
                    if (boundarySnap) {
                        const snapDistance = google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, boundarySnap);
                        if (snapDistance <= SNAP_DISTANCE_METERS_TRATTAMENTO) { snappedPoint = boundarySnap; snapApplied = true; }
                    }
                }
            }

            if (snapApplied) {
                const snapMarker = new google.maps.Marker({
                    position: snappedPoint,
                    map: mappaTrattamento,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#00ff00', fillOpacity: 0.8, strokeColor: '#ffffff', strokeWeight: 2 },
                    zIndex: 2000
                });
                setTimeout(() => { if (snapMarker) snapMarker.setMap(null); }, 1000);
            }

            if (terrenoPolygonTrattamento) {
                const isInside = google.maps.geometry.poly.containsLocation(snappedPoint, terrenoPolygonTrattamento);
                const distanceToBoundary = getDistanceToBoundaryTrattamento(snappedPoint, terrenoBoundaryCoordsTrattamento);
                if (!isInside && distanceToBoundary > 3) {
                    alert('Il punto deve essere dentro i confini del terreno!');
                    return;
                }
                if (!isInside && distanceToBoundary <= 3) {
                    snappedPoint = movePointInsideBoundaryTrattamento(snappedPoint, terrenoBoundaryCoordsTrattamento);
                }
            }

            if (poligonoCoordsTrattamento.length === 0) firstPointTrattamento = snappedPoint;

            if (firstPointTrattamento && poligonoCoordsTrattamento.length >= 3) {
                const distanzaDalPrimo = google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, firstPointTrattamento);
                if (distanzaDalPrimo < 20) {
                    poligonoCoordsTrattamento.push(firstPointTrattamento);
                    isDrawingPolygonTrattamento = false;
                    if (btn) { btn.textContent = '✏️ Traccia Poligono'; btn.style.background = '#17a2b8'; }
                    if (mapContainer) mapContainer.classList.remove('drawing-mode');
                    if (mappaElement) {
                        mappaElement.style.cursor = '';
                        mappaElement.querySelectorAll('div').forEach(d => { d.style.cursor = ''; });
                        mappaElement.querySelectorAll('canvas').forEach(c => { c.style.cursor = ''; });
                    }
                    if (mappaTrattamento.clickListenerTrattamento) {
                        google.maps.event.removeListener(mappaTrattamento.clickListenerTrattamento);
                        mappaTrattamento.clickListenerTrattamento = null;
                    }
                    aggiornaPoligonoSullaMappaTrattamento();
                    aggiornaInfoPoligonoTrattamento();
                    alert('Poligono chiuso! Puoi modificarlo trascinando i punti.');
                    return;
                }
            }

            poligonoCoordsTrattamento.push(snappedPoint);
            aggiornaPoligonoSullaMappaTrattamento();
            aggiornaInfoPoligonoTrattamento();
        }, 300);
    });
};

async function loadAnagrafica() {
    const anagraficaMod = await import(resolvePath(cfg.anagraficaPath));
    colture = await anagraficaMod[cfg.listExport]();
    const selFilter = document.getElementById(cfg.filterId);
    const selModal = document.getElementById(cfg.selectId);
    [selFilter, selModal].forEach(sel => {
        if (!sel) return;
        sel.innerHTML = sel === selFilter ? '<option value="">' + cfg.filterAllLabel + '</option>' : '<option value="">' + cfg.selectPlaceholder + '</option>';
        colture.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = cfg.optionLabel(v);
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

async function loadTrattamenti() {
    const vid = document.getElementById(cfg.filterId).value || null;
    const annoVal = document.getElementById('filter-anno').value;
    const anno = annoVal ? parseInt(annoVal, 10) : null;
    currentColturaId = vid;
    currentAnno = anno;

    const loading = document.getElementById('loading');
    const tableWrap = document.getElementById('table-wrap');
    const empty = document.getElementById('empty-state');
    const tbody = document.getElementById('tbody-trattamenti');

    const annoEffettivo = anno || new Date().getFullYear();
    if (!annoEffettivo) {
        loading.style.display = 'none';
        tableWrap.style.display = 'none';
        empty.style.display = 'block';
        empty.innerHTML = '<p>Seleziona un anno per vedere i lavori e le attività fitosanitarie (categoria Trattamenti).</p>';
        return;
    }

    loading.style.display = 'block';
    tableWrap.style.display = 'none';
    empty.style.display = 'none';

    try {
        const svc = await import(resolvePath(cfg.servicePath));
        const filtroLista = { filtroCategoria: 'trattamenti' };
        if (vid) {
            listRows = await svc[cfg.perMethod](vid, annoEffettivo, filtroLista);
        } else {
            listRows = await svc[cfg.tuttiMethod](annoEffettivo, filtroLista);
        }
    } catch (e) {
        console.error(cfg.logTag + ' view loadTrattamenti errore', e);
        listRows = [];
    }

    loading.style.display = 'none';
    if (listRows.length === 0) {
        empty.style.display = 'block';
        empty.innerHTML = vid ? cfg.emptyFiltered : cfg.emptyYear;
        return;
    }

    tableWrap.style.display = 'block';
    const basePath = getBasePath();
    const rootPrefix = basePath && basePath !== '/' ? basePath.replace(/\/$/, '') : '';
    const gestioneLavoriUrl = `${rootPrefix}/core/admin/gestione-lavori-standalone.html`;
    const attivitaUrl = `${rootPrefix}/core/attivita-standalone.html`;
    tbody.innerHTML = listRows.map((row, idx) => {
        const t = row.trattamento;
        const costo = t && t.costoTotale != null ? t.costoTotale.toFixed(2) : '-';
        const sup = t && t.superficieTrattata != null ? t.superficieTrattata.toFixed(2) : '-';
        let refCell = '-';
        if (row.lavoroId) {
            refCell = `<a href="${gestioneLavoriUrl}?lavoroId=${encodeURIComponent(row.lavoroId)}" target="_blank" class="link-lavoro">🔗 Vedi Lavoro</a>`;
        } else if (row.attivitaId) {
            refCell = `<a href="${attivitaUrl}?attivitaId=${encodeURIComponent(row.attivitaId)}" target="_blank" class="link-lavoro">🔗 Vedi Attività</a>`;
        }
        const avviso = avvisoDosaggioTrattamento(row);
        const hasTrattamento = !!t;
        const avvisiCell = !hasTrattamento ? '-'
            : avviso.hasWarning
                ? `<span class="avviso-dosaggio" title="${(avviso.tooltip || '').replace(/"/g, '&quot;')}" aria-label="Avviso dosaggio">⚠️</span>`
                : `<span class="alert-badge green" title="Dosaggi nel range consigliato" aria-label="Tutto ok"></span>`;
        const azioni = hasTrattamento
            ? `<button type="button" class="btn btn-secondary btn-sm" data-edit-row="${idx}">Modifica</button>
               <button type="button" class="btn btn-danger btn-sm" data-delete-row="${idx}">Elimina</button>`
            : `<button type="button" class="btn btn-success btn-sm" data-completa-row="${idx}">Completa</button>`;
        const foundColtura = colture.find(v => v.id === row[cfg.idKey]);
        const colturaLabel = row[cfg.nomeKey] || (foundColtura ? cfg.optionLabel(foundColtura) : '') || row[cfg.idKey] || '-';
        return `<tr>
            <td>${formatDate(row.data)}</td>
            <td>${colturaLabel}</td>
            <td>${(row.lavoroLabel || '').substring(0, 40)}${(row.lavoroLabel && row.lavoroLabel.length > 40) ? '…' : ''}</td>
            <td>${row.terrenoLabel || '-'}</td>
            <td>${t ? (t.prodotti && t.prodotti.length ? t.prodotti.map(p => (p.prodotto || '-').trim()).filter(Boolean).join(', ') || '-' : (t.prodotto || '-')) : '-'}</td>
            <td>${sup}</td>
            <td>${costo}</td>
            <td>${refCell}</td>
            <td>${avvisiCell}</td>
            <td>${azioni}</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-edit-row]').forEach(btn => btn.addEventListener('click', () => openModalEditRow(parseInt(btn.getAttribute('data-edit-row'), 10))));
    tbody.querySelectorAll('[data-delete-row]').forEach(btn => btn.addEventListener('click', () => deleteTrattamentoConfirmRow(parseInt(btn.getAttribute('data-delete-row'), 10))));
    tbody.querySelectorAll('[data-completa-row]').forEach(btn => btn.addEventListener('click', () => openModalCompleta(parseInt(btn.getAttribute('data-completa-row'), 10))));
}

function setDatiBaseReadOnly(data, terrenoLabel, riferimentoLabel) {
    document.getElementById('dati-lavoro-section').style.display = 'block';
    document.getElementById('dati-base-data').textContent = formatDate(data);
    document.getElementById('dati-base-terreno').textContent = terrenoLabel || '-';
    document.getElementById('dati-base-riferimento').textContent = riferimentoLabel || '-';
    document.getElementById('form-campi-base').style.display = 'none';
    document.getElementById('form-campi-data-row').style.display = 'none';
}

function popolaTabellaMacchineTrattamento(macchineData) {
    const section = document.getElementById('macchine-tabella-section');
    const tbody = document.getElementById('macchine-tabella-body');
    const nessuna = document.getElementById('macchine-nessuna');
    if (!section || !tbody) return;
    section.style.display = 'block';
    if (!macchineData || macchineData.length === 0) {
        tbody.innerHTML = '';
        if (nessuna) nessuna.style.display = 'block';
        return;
    }
    if (nessuna) nessuna.style.display = 'none';
    tbody.innerHTML = macchineData.map(m => '<tr><td style="padding:6px 8px;">' + (m.tipo || '-') + '</td><td style="padding:6px 8px;">' + (m.nome || '-') + '</td><td style="padding:6px 8px;">' + (typeof m.ore === 'number' ? m.ore.toFixed(2) : (m.ore || '-')) + '</td></tr>').join('');
}

function nascondiTabellaMacchineTrattamento() {
    const section = document.getElementById('macchine-tabella-section');
    if (section) section.style.display = 'none';
}

async function openModalCompleta(idx) {
    const row = listRows[idx];
    if (!row) return;
    if (row.trattamento) { openModalEditRow(idx); return; }
    try {
        const svc = await import(resolvePath(cfg.servicePath));
        if (row.lavoroId) {
            await svc.createTrattamentoFromLavoro(row.lavoroId);
        } else if (row.attivitaId) {
            await svc.createTrattamentoFromAttivita(row.attivitaId);
        } else { showAlert('Riga senza lavoro/attività', 'error'); return; }
        const found = row.lavoroId ? await svc.findTrattamentoByLavoroId(row.lavoroId) : await svc.findTrattamentoByAttivitaId(row.attivitaId);
        if (!found || found[cfg.idKey] !== row[cfg.idKey]) { showAlert(cfg.alertNotFound, 'error'); await loadTrattamenti(); return; }
        row.trattamento = found.trattamento;
        document.getElementById('modal-title').textContent = 'Completa dati trattamento';
        setDatiBaseReadOnly(row.data, row.terrenoLabel, row.lavoroLabel);
        document.getElementById('trattamento-id').value = found.trattamentoId;
        document.getElementById(cfg.hiddenId).value = row[cfg.idKey];
        document.getElementById('trattamento-lavoro-id').value = row.lavoroId || '';
        document.getElementById('trattamento-attivita-id').value = row.attivitaId || '';
        const t = found.trattamento;
        const dataVal = t.data instanceof Date ? t.data : (t.data?.toDate ? t.data.toDate() : new Date(t.data));
        document.getElementById('trattamento-data').value = dataVal.toISOString ? dataVal.toISOString().slice(0, 10) : '';
        document.getElementById('trattamento-operatore').value = t.operatore || '';
        document.getElementById('trattamento-superficie').value = (t.superficieTrattata != null && t.superficieTrattata !== '') ? Number(t.superficieTrattata).toFixed(2) : '';
        await syncSuperficieAnagrafeCheckboxUi(t, row[cfg.idKey]);
        document.getElementById('trattamento-costo-mano').value = t.costoManodopera ?? 0;
        document.getElementById('trattamento-costo-macchina').value = t.costoMacchina ?? 0;
        document.getElementById('trattamento-giorni-carenza').value = t.giorniCarenza ?? '';
        document.getElementById('trattamento-note').value = t.note || '';
        setCondizioniMeteoOnForm(t.condizioniMeteo);
        document.getElementById('trattamento-copertura-terreno').value = t.coperturaTerreno || 'non_dichiarata';
        let lavoroRipresaDa = null;
        if (row.lavoroId) {
            const { getLavoro } = await import(resolvePath('../../../core/services/lavori-service.js'));
            const lav = await getLavoro(row.lavoroId);
            lavoroRipresaDa = lav && lav.ripresaDaLavoroId ? lav.ripresaDaLavoroId : null;
        }
        const prosegueP = !!(t.prosegueDaTrattamentoId) || !!lavoroRipresaDa;
        document.getElementById('trattamento-prosegue-precedente').checked = prosegueP;
        document.getElementById('trattamento-precedente-wrap').style.display = prosegueP ? 'block' : 'none';
        await populateTrattamentiPrecedentiSelect(row[cfg.idKey], found.trattamentoId, lavoroRipresaDa ? { filterLavoroId: lavoroRipresaDa } : {});
        let parentTrattamentoIdRipresa = t.prosegueDaTrattamentoId || '';
        if (lavoroRipresaDa && !parentTrattamentoIdRipresa) {
            const parentFound = await svc.findTrattamentoByLavoroId(lavoroRipresaDa);
            if (parentFound && parentFound[cfg.idKey] === row[cfg.idKey]) {
                parentTrattamentoIdRipresa = parentFound.trattamentoId;
            }
        }
        document.getElementById('trattamento-precedente-id').value = parentTrattamentoIdRipresa || '';
        if (t.operatore) {
            const operatoreNome = await getDisplayNameForUserId(t.operatore);
            document.getElementById('trattamento-operatore').value = operatoreNome || t.operatore;
        }
        document.getElementById('trattamento-operatore').removeAttribute('required');
        document.getElementById('trattamento-superficie').removeAttribute('required');
        if (lavoroRipresaDa && parentTrattamentoIdRipresa) {
            await applicaDatiDaTrattamentoPrecedente(row[cfg.idKey], parentTrattamentoIdRipresa);
        } else {
            let rowsProdotti = (t.prodotti && t.prodotti.length) ? t.prodotti.map(r => ({ prodottoId: r.prodottoId || null, prodotto: r.prodotto || '', dosaggio: r.dosaggio, unitaDosaggio: r.unitaDosaggio || null, quantita: r.quantita, costo: r.costo })) : [{ prodottoId: null, prodotto: t.prodotto || '', dosaggio: t.dosaggio != null && t.dosaggio !== '' ? parseFloat(t.dosaggio) : null, unitaDosaggio: null, quantita: null, costo: t.costoProdotto ?? 0 }];
            if (!rowsProdotti.length) rowsProdotti = [{ prodottoId: null, prodotto: '', dosaggio: null, unitaDosaggio: null, quantita: null, costo: 0 }];
            renderProdottiTrattamento(rowsProdotti);
        }
        try {
            const { getDatiPrecompilazioneTrattamento } = await import(resolvePath(cfg.servicePath));
            const prefill = await getDatiPrecompilazioneTrattamento(row[cfg.idKey], found.trattamento);
            document.getElementById('trattamento-costo-mano').value = prefill.costoManodopera ?? 0;
            document.getElementById('trattamento-costo-macchina').value = prefill.costoMacchina ?? 0;
            popolaTabellaMacchineTrattamento(prefill.macchine || []);
        } catch (e) {
            console.warn(cfg.logTag + ' prefill costi/macchine:', e);
            popolaTabellaMacchineTrattamento([]);
        }
        trattamentoFromAttivitaOnly = !!(row.attivitaId && !row.lavoroId);
        const btnZona = document.getElementById('btn-traccia-zona-trattamento');
        if (btnZona) btnZona.textContent = row.lavoroId ? '🗺️ Visualizza zona' : '🗺️ Traccia';
        if (t.superficieDaAnagrafeTerreno) {
            poligonoCoordsTrattamento = [];
        } else if (found.trattamento.poligonoTrattamento && found.trattamento.poligonoTrattamento.length >= 3) {
            poligonoCoordsTrattamento = found.trattamento.poligonoTrattamento.map(c => ({ lat: c.lat, lng: c.lng }));
        } else {
            poligonoCoordsTrattamento = [];
        }
        const poligonoInfo = document.getElementById('poligono-info-trattamento');
        if (poligonoInfo) poligonoInfo.style.display = (!t.superficieDaAnagrafeTerreno && poligonoCoordsTrattamento.length >= 3) ? 'block' : 'none';
        applyScaricoMagazzinoUi(t);
        document.getElementById('modal-trattamento').classList.add('active');
        suggestTrattamentoMeteoIfAvailable();
    } catch (err) {
        showAlert(err.message || 'Errore creazione trattamento', 'error');
        await loadTrattamenti();
    }
}

function applyScaricoMagazzinoUi(t) {
    const scaricoGrp = document.getElementById('trattamento-scarico-magazzino-group');
    const scaricoCb = document.getElementById('trattamento-registra-scarico-magazzino');
    if (!scaricoGrp || !scaricoCb) return;
    scaricoGrp.style.display = hasMagazzinoModule ? 'block' : 'none';
    if (hasMagazzinoModule) {
        const ids = t && t.magazzinoMovimentoIds;
        scaricoCb.checked = Array.isArray(ids) && ids.length > 0;
    }
}

async function openModalEditRow(idx) {
    const row = listRows[idx];
    if (!row || !row.trattamento) return;
    const t = row.trattamento;
    const colturaId = row[cfg.idKey];
    const trattamentoId = t.id;
    document.getElementById('modal-title').textContent = 'Modifica dati trattamento';
    setDatiBaseReadOnly(row.data, row.terrenoLabel, row.lavoroLabel);
    document.getElementById('trattamento-id').value = trattamentoId;
    document.getElementById(cfg.hiddenId).value = colturaId;
    document.getElementById('trattamento-lavoro-id').value = row.lavoroId || '';
    document.getElementById('trattamento-attivita-id').value = row.attivitaId || '';
    const dataVal = t.data instanceof Date ? t.data : (t.data?.toDate ? t.data.toDate() : new Date(t.data));
    document.getElementById('trattamento-data').value = dataVal.toISOString ? dataVal.toISOString().slice(0, 10) : '';
    document.getElementById('trattamento-operatore').value = t.operatore || '';
    document.getElementById('trattamento-superficie').value = (t.superficieTrattata != null && t.superficieTrattata !== '') ? Number(t.superficieTrattata).toFixed(2) : '';
    await syncSuperficieAnagrafeCheckboxUi(t, colturaId);
    document.getElementById('trattamento-costo-mano').value = t.costoManodopera ?? 0;
    document.getElementById('trattamento-costo-macchina').value = t.costoMacchina ?? 0;
    document.getElementById('trattamento-giorni-carenza').value = t.giorniCarenza ?? '';
    document.getElementById('trattamento-note').value = t.note || '';
    setCondizioniMeteoOnForm(t.condizioniMeteo);
    document.getElementById('trattamento-copertura-terreno').value = t.coperturaTerreno || 'non_dichiarata';
    let lavoroRipresaDaEd = null;
    if (row.lavoroId) {
        const { getLavoro } = await import(resolvePath('../../../core/services/lavori-service.js'));
        const lavEd = await getLavoro(row.lavoroId);
        lavoroRipresaDaEd = lavEd && lavEd.ripresaDaLavoroId ? lavEd.ripresaDaLavoroId : null;
    }
    const prosegueEd = !!(t.prosegueDaTrattamentoId) || !!lavoroRipresaDaEd;
    document.getElementById('trattamento-prosegue-precedente').checked = prosegueEd;
    document.getElementById('trattamento-precedente-wrap').style.display = prosegueEd ? 'block' : 'none';
    await populateTrattamentiPrecedentiSelect(colturaId, trattamentoId, lavoroRipresaDaEd ? { filterLavoroId: lavoroRipresaDaEd } : {});
    let parentIdEdit = t.prosegueDaTrattamentoId || '';
    if (lavoroRipresaDaEd && !parentIdEdit) {
        const { findTrattamentoByLavoroId } = await import(resolvePath(cfg.servicePath));
        const parentFound = await findTrattamentoByLavoroId(lavoroRipresaDaEd);
        if (parentFound && parentFound[cfg.idKey] === colturaId) parentIdEdit = parentFound.trattamentoId;
    }
    document.getElementById('trattamento-precedente-id').value = parentIdEdit || '';
    if (t.operatore) {
        const operatoreNome = await getDisplayNameForUserId(t.operatore);
        document.getElementById('trattamento-operatore').value = operatoreNome || t.operatore;
    }
    if (row.lavoroId || row.attivitaId) {
        document.getElementById('trattamento-operatore').removeAttribute('required');
        document.getElementById('trattamento-superficie').removeAttribute('required');
    } else {
        document.getElementById('trattamento-operatore').setAttribute('required', '');
        document.getElementById('trattamento-superficie').setAttribute('required', '');
    }
    const hasProdotti = t.prodotti && t.prodotti.some(r => (r.prodotto || '').trim());
    if (lavoroRipresaDaEd && parentIdEdit && !hasProdotti) {
        await applicaDatiDaTrattamentoPrecedente(colturaId, parentIdEdit);
    } else {
        let rowsProdotti = (t.prodotti && t.prodotti.length) ? t.prodotti.map(r => ({ prodottoId: r.prodottoId || null, prodotto: r.prodotto || '', dosaggio: r.dosaggio, unitaDosaggio: r.unitaDosaggio || null, quantita: r.quantita, costo: r.costo })) : [{ prodottoId: null, prodotto: t.prodotto || '', dosaggio: t.dosaggio != null && t.dosaggio !== '' ? parseFloat(t.dosaggio) : null, unitaDosaggio: null, quantita: null, costo: t.costoProdotto ?? 0 }];
        if (!rowsProdotti.length) rowsProdotti = [{ prodottoId: null, prodotto: '', dosaggio: null, unitaDosaggio: null, quantita: null, costo: 0 }];
        renderProdottiTrattamento(rowsProdotti);
    }
    try {
        const { getDatiPrecompilazioneTrattamento } = await import(resolvePath(cfg.servicePath));
        const prefill = await getDatiPrecompilazioneTrattamento(colturaId, t);
        document.getElementById('trattamento-costo-mano').value = prefill.costoManodopera ?? t.costoManodopera ?? 0;
        document.getElementById('trattamento-costo-macchina').value = prefill.costoMacchina ?? t.costoMacchina ?? 0;
        popolaTabellaMacchineTrattamento(prefill.macchine || []);
    } catch (e) {
        console.warn(cfg.logTag + ' prefill costi/macchine:', e);
        popolaTabellaMacchineTrattamento([]);
    }
    trattamentoFromAttivitaOnly = !!(row.attivitaId && !row.lavoroId);
    const btnZona = document.getElementById('btn-traccia-zona-trattamento');
    if (btnZona) btnZona.textContent = row.lavoroId ? '🗺️ Visualizza zona' : '🗺️ Traccia';
    if (t.superficieDaAnagrafeTerreno) {
        poligonoCoordsTrattamento = [];
    } else if (t.poligonoTrattamento && t.poligonoTrattamento.length >= 3) {
        poligonoCoordsTrattamento = t.poligonoTrattamento.map(c => ({ lat: c.lat, lng: c.lng }));
    } else if (row.lavoroId) {
        const fromLavoro = await loadPoligonoFromZoneLavorateTrattamento(row.lavoroId);
        poligonoCoordsTrattamento = fromLavoro ? fromLavoro.map(c => ({ lat: c.lat, lng: c.lng })) : [];
    } else {
        poligonoCoordsTrattamento = [];
    }
    const poligonoInfo = document.getElementById('poligono-info-trattamento');
    if (poligonoInfo) poligonoInfo.style.display = (!t.superficieDaAnagrafeTerreno && poligonoCoordsTrattamento.length >= 3) ? 'block' : 'none';
    applyScaricoMagazzinoUi(t);
    document.getElementById('modal-trattamento').classList.add('active');
    suggestTrattamentoMeteoIfAvailable();
}

function readCondizioniMeteoFromForm() {
    const el = document.getElementById('trattamento-condizioni-meteo');
    const v = el && el.value ? String(el.value).trim() : '';
    return v || null;
}

function setCondizioniMeteoOnForm(value) {
    const el = document.getElementById('trattamento-condizioni-meteo');
    if (el) el.value = value || '';
    const hint = document.getElementById('trattamento-condizioni-meteo-hint');
    if (hint) hint.remove();
}

function suggestTrattamentoMeteoIfAvailable() {
    if (typeof window.__tonySuggestTrattamentoCondizioniMeteo === 'function') {
        window.__tonySuggestTrattamentoCondizioniMeteo(window.Tony && window.Tony.context);
    }
}

function closeModal() {
    document.getElementById('modal-trattamento').classList.remove('active');
    const copEl = document.getElementById('trattamento-copertura-terreno');
    if (copEl) copEl.value = 'non_dichiarata';
    const cbPr = document.getElementById('trattamento-prosegue-precedente');
    if (cbPr) cbPr.checked = false;
    const wrapPr = document.getElementById('trattamento-precedente-wrap');
    if (wrapPr) wrapPr.style.display = 'none';
    const selPr = document.getElementById('trattamento-precedente-id');
    if (selPr) selPr.innerHTML = '<option value="">— Seleziona —</option>';
    const cbAn = document.getElementById('trattamento-superficie-anagrafe');
    if (cbAn) {
        cbAn.checked = false;
        cbAn.disabled = false;
    }
    const hint = document.getElementById('trattamento-superficie-anagrafe-hint');
    if (hint) hint.style.display = 'none';
    const sup = document.getElementById('trattamento-superficie');
    if (sup) sup.readOnly = false;
    const btnT = document.getElementById('btn-traccia-zona-trattamento');
    if (btnT) {
        btnT.disabled = false;
        btnT.style.opacity = '';
        btnT.title = 'Traccia o visualizza zona trattata sulla mappa';
    }
}

async function saveTrattamento(e) {
    e.preventDefault();
    const id = document.getElementById('trattamento-id').value.trim();
    const colturaIdFromHidden = document.getElementById(cfg.hiddenId).value;
    const colturaIdFromSelect = document.getElementById(cfg.selectId).value;
    const colturaId = colturaIdFromHidden || colturaIdFromSelect;
    if (!colturaId) { showAlert(cfg.alertMissing, 'error'); return; }

    let costoManodopera = parseFloat(document.getElementById('trattamento-costo-mano').value) || 0;
    let costoMacchina = parseFloat(document.getElementById('trattamento-costo-macchina').value) || 0;
    const lavoroIdVal = document.getElementById('trattamento-lavoro-id').value.trim();
    const attivitaIdVal = document.getElementById('trattamento-attivita-id').value.trim();
    if ((lavoroIdVal || attivitaIdVal) && costoManodopera === 0 && costoMacchina === 0) {
        try {
            const { getDatiPrecompilazioneTrattamento } = await import(resolvePath(cfg.servicePath));
            const prefill = await getDatiPrecompilazioneTrattamento(colturaId, { lavoroId: lavoroIdVal || null, attivitaId: attivitaIdVal || null });
            costoManodopera = prefill.costoManodopera ?? 0;
            costoMacchina = prefill.costoMacchina ?? 0;
        } catch (err) {
            console.warn(cfg.logTag + ' ricalcolo costi in salvataggio:', err);
        }
    }

    const rowsProdotti = getProdottiRowsFromTable();
    if (!rowsProdotti.length || !rowsProdotti.some(r => (r.prodotto || '').trim())) {
        showAlert('Aggiungi almeno una riga prodotto con nome.', 'error');
        return;
    }
    const checkDosaggi = validaDosaggiProdotti(rowsProdotti);
    if (!checkDosaggi.valid && !confirm('Attenzione: ' + checkDosaggi.message + ' Salvare comunque?')) {
        return;
    }
    const costoProdottoTotale = rowsProdotti.reduce((s, r) => s + (Number(r.costo) || 0), 0);
    const dataVal = document.getElementById('trattamento-data').value;
    const giorniCarenzaVal = document.getElementById('trattamento-giorni-carenza').value.trim();
    const cbAnagrafe = document.getElementById('trattamento-superficie-anagrafe');
    const usaSuperficieAnagrafe = !!(cbAnagrafe && cbAnagrafe.checked && !cbAnagrafe.disabled);
    let superficieTrattataNum = (() => { const v = document.getElementById('trattamento-superficie').value; const n = parseFloat(v); return isNaN(n) ? null : Math.round(n * 100) / 100; })();
    if (usaSuperficieAnagrafe) {
        const { getTerreno } = await import(resolvePath('../../../core/services/terreni-service.js'));
        const vObj = colture.find(x => x.id === colturaId);
        if (vObj && vObj.terrenoId) {
            const ter = await getTerreno(vObj.terrenoId);
            if (ter && ter.superficie != null && ter.superficie !== '') {
                const n = parseFloat(ter.superficie);
                if (!isNaN(n) && n > 0) superficieTrattataNum = Math.round(n * 100) / 100;
            }
        }
        if (superficieTrattataNum == null || superficieTrattataNum <= 0) {
            showAlert('Superficie terreno non disponibile in anagrafe. Completa il dato sul terreno o deseleziona l’opzione.', 'error');
            return;
        }
    }
    let tipoTrattamentoResolved = '';
    try {
        const { getTrattamento } = await import(resolvePath(cfg.servicePath));
        const existingTr = await getTrattamento(colturaId, id);
        if (existingTr && existingTr.tipoTrattamento) {
            tipoTrattamentoResolved = existingTr.tipoTrattamento;
        }
    } catch (e) {
        console.warn(cfg.logTag + ' tipo trattamento esistente:', e);
    }
    if (!tipoTrattamentoResolved) {
        const { inferTipoTrattamentoColturaFromTipoLavoroNome } = await import(resolvePath('../../../core/config/trattamenti-lavoro-defaults.js'));
        let tipoLavoroNome = '';
        if (lavoroIdVal) {
            const { getLavoro } = await import(resolvePath('../../../core/services/lavori-service.js'));
            const lav = await getLavoro(lavoroIdVal);
            tipoLavoroNome = lav && lav.tipoLavoro ? lav.tipoLavoro : '';
        } else if (attivitaIdVal) {
            const { getAttivita } = await import(resolvePath('../../../core/services/attivita-service.js'));
            const att = await getAttivita(attivitaIdVal);
            tipoLavoroNome = att && att.tipoLavoro ? att.tipoLavoro : '';
        }
        tipoTrattamentoResolved = inferTipoTrattamentoColturaFromTipoLavoroNome(tipoLavoroNome);
    }
    const data = {
        data: dataVal ? new Date(dataVal) : new Date(),
        prodotti: rowsProdotti.map(r => ({
            prodottoId: r.prodottoId || null,
            prodotto: (r.prodotto || '').trim(),
            dosaggio: r.dosaggio,
            unitaDosaggio: r.unitaDosaggio || null,
            quantita: r.quantita,
            costo: Number(r.costo) || 0
        })),
        costoProdotto: costoProdottoTotale,
        tipoTrattamento: tipoTrattamentoResolved,
        operatore: (document.getElementById('trattamento-operatore-group') && document.getElementById('trattamento-operatore-group').style.display !== 'none')
            ? document.getElementById('trattamento-operatore').value.trim()
            : '',
        superficieTrattata: superficieTrattataNum,
        superficieDaAnagrafeTerreno: usaSuperficieAnagrafe,
        costoManodopera,
        costoMacchina,
        giorniCarenza: giorniCarenzaVal ? parseInt(giorniCarenzaVal, 10) : null,
        parcella: null,
        note: document.getElementById('trattamento-note').value.trim() || null,
        condizioniMeteo: readCondizioniMeteoFromForm()
    };
    const copVal = document.getElementById('trattamento-copertura-terreno').value;
    data.coperturaTerreno = ['completa', 'parziale', 'non_dichiarata'].includes(copVal) ? copVal : 'non_dichiarata';
    const prosegueCb = document.getElementById('trattamento-prosegue-precedente');
    data.prosegueDaTrattamentoId = (prosegueCb && prosegueCb.checked)
        ? (document.getElementById('trattamento-precedente-id').value.trim() || null)
        : null;
    if (prosegueCb && prosegueCb.checked) {
        const prevId = data.prosegueDaTrattamentoId;
        if (!prevId) {
            showAlert('Seleziona il trattamento precedente oppure deseleziona l’opzione.', 'error');
            return;
        }
        if (prevId === id) {
            showAlert('Il trattamento precedente non può coincidere con il trattamento corrente.', 'error');
            return;
        }
        try {
            const { getTrattamento } = await import(resolvePath(cfg.servicePath));
            const prev = await getTrattamento(colturaId, prevId);
            if (!prev) {
                showAlert(cfg.alertPrevNotFound, 'error');
                return;
            }
        } catch (ve) {
            showAlert(ve.message || 'Verifica trattamento precedente non riuscita.', 'error');
            return;
        }
    }
    if (usaSuperficieAnagrafe) {
        data.poligonoTrattamento = null;
    } else if (poligonoCoordsTrattamento && poligonoCoordsTrattamento.length >= 3) {
        data.poligonoTrattamento = poligonoCoordsTrattamento.map(c =>
            typeof c.lat === 'function' ? { lat: c.lat(), lng: c.lng() } : { lat: c.lat, lng: c.lng }
        );
    }
    if (lavoroIdVal) data.lavoroId = lavoroIdVal;
    if (attivitaIdVal) data.attivitaId = attivitaIdVal;

    try {
        const { updateTrattamento } = await import(resolvePath(cfg.servicePath));
        if (!id) { showAlert('Trattamento non trovato', 'error'); return; }
        const scaricoGroup = document.getElementById('trattamento-scarico-magazzino-group');
        const scaricoOpts = (scaricoGroup && scaricoGroup.style.display !== 'none')
            ? { registraScaricoMagazzino: !!document.getElementById('trattamento-registra-scarico-magazzino')?.checked }
            : {};
        await updateTrattamento(colturaId, id, data, scaricoOpts);
        showAlert('Trattamento aggiornato.', 'success');
        closeModal();
        await loadTrattamenti();
    } catch (err) {
        showAlert(err.message || 'Errore salvataggio', 'error');
    }
}

async function deleteTrattamentoConfirmRow(idx) {
    const row = listRows[idx];
    if (!row || !row.trattamento) return;
    if (!confirm('Eliminare i dati trattamento? Il lavoro/attività resterà; potrai completare di nuovo dalla lista.')) return;
    try {
        const { deleteTrattamento } = await import(resolvePath(cfg.servicePath));
        await deleteTrattamento(row[cfg.idKey], row.trattamento.id);
        showAlert('Trattamento eliminato. La riga resta come "da completare".', 'success');
        await loadTrattamenti();
    } catch (err) {
        showAlert(err.message || 'Errore eliminazione', 'error');
    }
}

async function init() {
    const firebaseService = await import(resolvePath('../../../core/services/firebase-service.js'));
    const { initializeTenantService, getCurrentTenantId, setCurrentTenantId, hasModuleAccess, getAvailableModules } = await import(resolvePath('../../../core/services/tenant-service.js'));
    const auth = firebaseService.getAuthInstance();
    initializeTenantService();
    const { onAuthStateChanged } = firebaseService;
    onAuthStateChanged(auth, async (user) => {
        if (!user) user = await resolveAuthUser(auth);
        if (!user) {
            window.location.href = await loginPageUrl(resolvePath('../../../core/auth/login-standalone.html'));
            return;
        }
        let tenantId = getCurrentTenantId();
        if (!tenantId && cfg.waitForTenant) {
            for (let i = 0; i < 10; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                tenantId = getCurrentTenantId();
                if (tenantId) break;
            }
        }
        if (tenantId) setCurrentTenantId(tenantId);
        if (!tenantId) {
            showAlert('Nessun tenant selezionato.', 'error');
            return;
        }
        let hasManodoperaModule = false;
        try {
            hasManodoperaModule = await hasModuleAccess('manodopera');
            hasMagazzinoModule = await hasModuleAccess('magazzino');
            const modules = await getAvailableModules();

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
                        console.log(cfg.tonyLog + ' Context Tony inizializzato con moduli:', modules);
                    } else if (retries < 10) {
                        setTimeout(function() { initTonyContext(retries + 1); }, 500);
                    }
                };
                initTonyContext();
            }
        } catch (err) { console.warn('Verifica modulo manodopera:', err); }
        const operatoreGroup = document.getElementById('trattamento-operatore-group');
        const proprietarioMsg = document.getElementById('trattamento-proprietario-message');
        if (operatoreGroup) operatoreGroup.style.display = hasManodoperaModule ? 'block' : 'none';
        if (proprietarioMsg) proprietarioMsg.style.display = hasManodoperaModule ? 'none' : 'block';
        await loadAnagrafica();
        await loadProdottiAnagrafica();
        window.__tonyTrattamentoCampoApi = {
            renderProdotti: function(rows) { renderProdottiTrattamento(rows); },
            getProdottiAnagrafica: function() { return listProdottiAnagrafica; },
            syncSuperficieAnagrafeAfterTonyInject: syncSuperficieAnagrafeAfterTonyInject,
            getTerrenoId: function() {
                const vid = document.getElementById(cfg.hiddenId).value;
                const v = colture.find(x => x.id === vid);
                return v && v.terrenoId ? v.terrenoId : null;
            }
        };
        document.getElementById('btn-aggiungi-prodotto-trattamento').addEventListener('click', aggiungiRigaProdottoTrattamento);
        document.getElementById('trattamento-superficie').addEventListener('input', ricalcolaQuantitaCostoProdotti);
        document.getElementById(cfg.filterId).addEventListener('change', loadTrattamenti);
        document.getElementById('filter-anno').addEventListener('change', loadTrattamenti);
        document.getElementById('close-modal').addEventListener('click', closeModal);
        document.getElementById('cancel-btn').addEventListener('click', closeModal);
        document.getElementById('form-trattamento').addEventListener('submit', saveTrattamento);
        const cbProsegue = document.getElementById('trattamento-prosegue-precedente');
        if (cbProsegue) {
            cbProsegue.addEventListener('change', function() {
                document.getElementById('trattamento-precedente-wrap').style.display = this.checked ? 'block' : 'none';
                if (!this.checked) document.getElementById('trattamento-precedente-id').value = '';
            });
        }
        const selPrecedente = document.getElementById('trattamento-precedente-id');
        if (selPrecedente) {
            selPrecedente.addEventListener('change', async function() {
                const vid = document.getElementById(cfg.hiddenId).value;
                const pid = this.value;
                if (!pid || !vid) return;
                if (!document.getElementById('trattamento-prosegue-precedente').checked) return;
                await applicaDatiDaTrattamentoPrecedente(vid, pid);
            });
        }
        const cbSupAnag = document.getElementById('trattamento-superficie-anagrafe');
        if (cbSupAnag) cbSupAnag.addEventListener('change', function() { applySuperficieDaAnagrafeTerreno(this.checked); });
        const btnTraccia = document.getElementById('btn-traccia-zona-trattamento');
        if (btnTraccia) btnTraccia.addEventListener('click', () => window.apriMappaTracciamentoTrattamento && window.apriMappaTracciamentoTrattamento());
        document.getElementById('close-mappa-trattamento').addEventListener('click', () => window.chiudiMappaTracciamentoTrattamento && window.chiudiMappaTracciamentoTrattamento());
        document.getElementById('btn-annulla-mappa-trattamento').addEventListener('click', () => window.chiudiMappaTracciamentoTrattamento && window.chiudiMappaTracciamentoTrattamento());
        document.getElementById('btn-draw-polygon-trattamento').addEventListener('click', () => window.iniziaTracciamentoPoligonoTrattamento && window.iniziaTracciamentoPoligonoTrattamento());
        document.getElementById('btn-clear-polygon-trattamento').addEventListener('click', () => window.eliminaPoligonoTrattamento && window.eliminaPoligonoTrattamento());
        document.getElementById('btn-conferma-polygon-trattamento').addEventListener('click', () => window.confermaPoligonoTrattamento && window.confermaPoligonoTrattamento());
        await loadTrattamenti();
    });
}
init();
}

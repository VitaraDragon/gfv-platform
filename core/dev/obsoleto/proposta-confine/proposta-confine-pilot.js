/**
 * Pagina pilota Fase 0 — proposta confine da tap.
 *
 * ABBANDONATO (no-go 2026-09-05). Solo archivio. Non è prodotto.
 * Solo dev: niente salvataggio anagrafe, niente UI Terreni.
 *
 * @module core/dev/obsoleto/proposta-confine/proposta-confine-pilot
 */

import { getAllTerreni } from '../../../services/terreni-service.js';
import { getAuthInstance, awaitAuthStateReady } from '../../../services/firebase-service.js';
import { getCurrentTenantId } from '../../../services/tenant-service.js';
import { ensureSimulatorSession } from '../../../js/simulator-browser-auth.js';
import {
  hasUsableTerrenoPolygon,
  polygonCentroid,
  scoreProposal,
  findOverlappingTerreni,
  viewForPolygon,
  latLngToImagePixel
} from './proposta-confine-geo.js';
import {
  createSegmenter,
  composeEsriViewport,
  DEFAULT_VIEW_SIZE
} from './proposta-confine-segmenter.js';

const RESULTS_KEY = 'gfv_proposta_confine_fase0';
const DRAFT_STROKE = '#ffffff';
const REF_STROKE = '#1a73e8';
const REF_FILL = '#1a73e8';

/** @type {google.maps.Map|null} */
let map = null;
/** @type {google.maps.Polygon|null} */
let refPoly = null;
/** @type {google.maps.Polygon|null} */
let draftPoly = null;
/** @type {Array} */
let terreni = [];
/** @type {object|null} */
let selected = null;
/** @type {Array} */
let sessions = [];
let busy = false;

function $(id) {
  return document.getElementById(id);
}

function loginUrl() {
  const q = localStorage.getItem('gfv_firebase_emulator') === '1' ? '?emulator=1' : '';
  return '../auth/login-standalone.html' + q;
}

function setStatus(msg, kind) {
  const el = $('pilot-status');
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'status show' + (kind ? ' ' + kind : '');
  if (!msg) el.classList.remove('show');
}

function loadSessions() {
  try {
    const raw = sessionStorage.getItem(RESULTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    sessions = Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    sessions = [];
  }
}

function persistSessions() {
  try {
    sessionStorage.setItem(RESULTS_KEY, JSON.stringify(sessions));
  } catch (_) { /* quota */ }
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return (n * 100).toFixed(1) + '%';
}

function fmtHa(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(3);
}

function renderTable() {
  const tb = $('session-body');
  if (!tb) return;
  if (!sessions.length) {
    tb.innerHTML = '<tr><td colspan="8" class="empty-row">Nessuna misura. Seleziona un terreno e lancia un tap.</td></tr>';
    updateSummary();
    return;
  }
  tb.innerHTML = sessions
    .map((row, i) => {
      const ok = row.campoGiusto && row.ritoccoMinimo;
      return (
        '<tr>' +
        `<td>${i + 1}</td>` +
        `<td>${escapeHtml(row.nome || '')}</td>` +
        `<td>${escapeHtml(row.coltura || '—')}</td>` +
        `<td>${row.campoGiusto ? 'sì' : row.invasion ? 'no (invasione)' : 'no'}</td>` +
        `<td>${row.ritoccoMinimo ? 'sì' : 'no'} (${row.ritoccoCount})</td>` +
        `<td>${fmtPct(row.scostamentoEttari)}</td>` +
        `<td>${fmtPct(row.iou)}</td>` +
        `<td>${row.latencyMs} ms · ${escapeHtml(row.engine || '')}${ok ? ' · usabile' : ''}</td>` +
        '</tr>'
      );
    })
    .join('');
  updateSummary();
}

function updateSummary() {
  const el = $('session-summary');
  if (!el) return;
  const n = sessions.length;
  const usable = sessions.filter((r) => r.campoGiusto && r.ritoccoMinimo).length;
  const ratio = n ? usable / n : 0;
  const hint =
    n >= 20
      ? ratio >= 2 / 3
        ? 'Soglia go (~2/3) raggiunta su questo campione.'
        : ratio <= 0.5
          ? 'Verso no-go / solo disegno più veloce.'
          : 'Zona grigia: continua a misurare.'
      : `Servono 20–30 misure (ora ${n}).`;
  el.textContent = n
    ? `Usabili (campo giusto + ritocco minimo): ${usable}/${n} (${fmtPct(ratio)}). ${hint}`
    : 'Ancora nessuna riga.';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearDraft() {
  if (draftPoly && draftPoly.__dash) {
    draftPoly.__dash.setMap(null);
    draftPoly.__dash = null;
  }
  if (draftPoly) {
    draftPoly.setMap(null);
    draftPoly = null;
  }
  const chip = $('draft-chip');
  if (chip) chip.hidden = true;
}

function drawReference(coords) {
  if (refPoly) {
    refPoly.setMap(null);
    refPoly = null;
  }
  if (!map || !coords || coords.length < 3) return;
  refPoly = new google.maps.Polygon({
    paths: coords.map((c) => new google.maps.LatLng(c.lat, c.lng)),
    strokeColor: REF_STROKE,
    strokeWeight: 3,
    strokeOpacity: 1,
    fillColor: REF_FILL,
    fillOpacity: 0.28,
    clickable: false,
    editable: false,
    zIndex: 1
  });
  refPoly.setMap(map);
  const bounds = new google.maps.LatLngBounds();
  coords.forEach((c) => bounds.extend(c));
  map.fitBounds(bounds, 48);
}

function drawDraft(coords) {
  clearDraft();
  if (!map || !coords || coords.length < 3) return;
  draftPoly = new google.maps.Polygon({
    paths: coords.map((c) => new google.maps.LatLng(c.lat, c.lng)),
    strokeColor: DRAFT_STROKE,
    strokeWeight: 0,
    strokeOpacity: 0,
    fillColor: REF_FILL,
    fillOpacity: 0.18,
    clickable: false,
    editable: false,
    zIndex: 2
  });
  draftPoly.setMap(map);
  const polyline = new google.maps.Polyline({
    path: draftPoly.getPath(),
    strokeColor: DRAFT_STROKE,
    strokeWeight: 4,
    strokeOpacity: 0,
    zIndex: 3,
    icons: [
      {
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: DRAFT_STROKE, scale: 3 },
        offset: '0',
        repeat: '14px'
      }
    ],
    clickable: false
  });
  polyline.setMap(map);
  draftPoly.__dash = polyline;
  const bounds = new google.maps.LatLngBounds();
  coords.forEach((c) => bounds.extend(c));
  map.fitBounds(bounds, 36);
  const chip = $('draft-chip');
  if (chip) chip.hidden = false;
}

function fillTerrenoSelect() {
  const sel = $('terreno-select');
  if (!sel) return;
  const mapped = terreni.filter((t) => hasUsableTerrenoPolygon(t.polygonCoords));
  sel.innerHTML =
    '<option value="">— scegli un terreno già mappato —</option>' +
    mapped
      .map((t) => {
        const label = [t.nome, t.coltura, t.podere].filter(Boolean).join(' · ');
        return `<option value="${escapeHtml(t.id)}">${escapeHtml(label || t.id)}</option>`;
      })
      .join('');
  $('terreni-count').textContent = `${mapped.length} terreni con poligono (${terreni.length} totali)`;
}

function selectTerreno(id) {
  selected = terreni.find((t) => t.id === id) || null;
  clearDraft();
  $('metrics').hidden = true;
  if (!selected) {
    if (refPoly) {
      refPoly.setMap(null);
      refPoly = null;
    }
    return;
  }
  drawReference(selected.polygonCoords);
  setStatus('Terreno caricato. Tocca al centro del campo oppure usa «Tap al centro».', 'ok');
}

function currentEngine() {
  const sel = $('engine-select');
  return sel && sel.value === 'sam' ? 'sam' : 'stub';
}

function showMetrics(score, extra) {
  const box = $('metrics');
  if (!box) return;
  box.hidden = false;
  $('m-giusto').textContent = score.campoGiusto
    ? 'sì'
    : score.invasion
      ? 'no (invasione)'
      : 'no';
  if ($('m-fuori')) {
    $('m-fuori').textContent = fmtPct(score.outsideFraction);
  }
  $('m-ritocco').textContent = score.ritoccoMinimo
    ? `sì (${score.ritoccoCount} vertici)`
    : `no (${score.ritoccoCount} vertici)`;
  $('m-ha-delta').textContent = fmtPct(score.scostamentoEttari);
  $('m-iou').textContent = fmtPct(score.iou);
  $('m-ha').textContent = `${fmtHa(score.haProposta)} / ${fmtHa(score.haRiferimento)}`;
  $('m-lat').textContent = extra.latencyMs + ' ms · ' + extra.engine;
  const overlapEl = $('m-overlap');
  if (extra.overlaps && extra.overlaps.length) {
    overlapEl.textContent = extra.overlaps.map((o) => o.nome || o.id).join(', ');
  } else {
    overlapEl.textContent = 'nessuna';
  }
}

async function runProposal(pointLatLng) {
  if (busy) return;
  if (!selected || !hasUsableTerrenoPolygon(selected.polygonCoords)) {
    setStatus('Seleziona prima un terreno già mappato.', 'err');
    return;
  }
  if (!pointLatLng) {
    setStatus('Punto non valido.', 'err');
    return;
  }

  busy = true;
  $('btn-center').disabled = true;
  setStatus('Preparazione vista satellite…', '');

  try {
    const viewInfo = viewForPolygon(selected.polygonCoords, DEFAULT_VIEW_SIZE.width, DEFAULT_VIEW_SIZE.height);
    if (!viewInfo) throw new Error('vista_poligono');
    const view = {
      center: viewInfo.center,
      zoom: viewInfo.zoom,
      width: DEFAULT_VIEW_SIZE.width,
      height: DEFAULT_VIEW_SIZE.height
    };
    const pointPx = latLngToImagePixel(
      pointLatLng.lat,
      pointLatLng.lng,
      view.center,
      view.zoom,
      view.width,
      view.height
    );

    const engine = currentEngine();
    let image = null;
    if (engine === 'sam') {
      setStatus('Scarico imagery (stessa finestra Web Mercator)…', '');
      image = await composeEsriViewport(view);
      setStatus('SAM: primo uso scarica il modello da Hugging Face (non da localhost). Può richiedere 1–3 minuti.', '');
    } else {
      setStatus('Stub rettangolo (solo pipeline)…', '');
    }

    const segment = createSegmenter(engine, { timeoutMs: 45000, loadTimeoutMs: 180000 });
    const out = await segment({
      image,
      pointPx,
      pointLatLng,
      bounds: view
    });

    if (!out.polygonCoords || out.polygonCoords.length < 3) {
      throw new Error('proposta_senza_poligono');
    }

    drawDraft(out.polygonCoords);
    const score = scoreProposal(out.polygonCoords, selected.polygonCoords);
    const overlaps = findOverlappingTerreni(out.polygonCoords, terreni, {
      excludeId: selected.id
    });
    showMetrics(score, { latencyMs: out.latencyMs, engine: out.engine, overlaps });

    const row = {
      at: new Date().toISOString(),
      terrenoId: selected.id,
      nome: selected.nome,
      coltura: selected.coltura || '',
      engine: out.engine,
      latencyMs: out.latencyMs,
      campoGiusto: score.campoGiusto,
      ritoccoMinimo: score.ritoccoMinimo,
      ritoccoCount: score.ritoccoCount,
      iou: score.iou,
      scostamentoEttari: score.scostamentoEttari,
      haProposta: score.haProposta,
      haRiferimento: score.haRiferimento,
      fusedSuspect: score.fusedSuspect,
      invasion: score.invasion,
      outsideFraction: score.outsideFraction,
      overlapNomi: overlaps.map((o) => o.nome || o.id),
      tap: pointLatLng,
      proposta: out.polygonCoords
    };
    sessions.push(row);
    persistSessions();
    renderTable();
    let statusMsg = 'Proposta pronta. Confronta tratteggio (bozza) e tratto blu (anagrafe).';
    let statusKind = 'ok';
    if (score.invasion) {
      statusMsg =
        'Invasione: una fetta della bozza è fuori da questo terreno (altro campo o pezzo che non c’entra). Non è campo giusto.';
      statusKind = 'err';
    } else if (!score.campoGiusto) {
      statusMsg = 'Proposta fuori soglia «campo giusto». Scarta a mente e passa al prossimo.';
      statusKind = 'warn';
    }
    setStatus(statusMsg, statusKind);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    setStatus('Errore (niente retry automatico): ' + msg, 'err');
  } finally {
    busy = false;
    $('btn-center').disabled = false;
  }
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    tenantId: getCurrentTenantId() || null,
    criterion: 'campo giusto + ritocco minimo ≥ ~2/3 su vigneto/frutteto ben bordati',
    sessions
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'proposta-confine-fase0.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function initMap() {
  const el = $('map');
  if (!el || !window.google || !google.maps) {
    setStatus('Google Maps non disponibile (chiave API).', 'err');
    return;
  }
  map = new google.maps.Map(el, {
    zoom: 15,
    center: { lat: 44.4949, lng: 11.3426 },
    mapTypeId: google.maps.MapTypeId.SATELLITE,
    streetViewControl: false,
    mapTypeControl: false
  });
  map.addListener('click', (ev) => {
    if (!ev || !ev.latLng) return;
    runProposal({ lat: ev.latLng.lat(), lng: ev.latLng.lng() });
  });
}

export async function bootstrapPropostaConfinePilot() {
  await window.GFVStandaloneReady;
  const auth = getAuthInstance();
  await awaitAuthStateReady();
  let user = auth && auth.currentUser;
  if (!user) user = await ensureSimulatorSession(auth);
  if (!user) {
    window.location.href = loginUrl();
    return;
  }

  if (window.GFVConfigLoader && window.GFVConfigLoader.loadGoogleMapsAPI) {
    await window.GFVConfigLoader.loadGoogleMapsAPI();
  }

  const tid = getCurrentTenantId();
  $('tenant-label').textContent = tid ? 'Tenant: ' + tid : 'Tenant non risolto';

  terreni = await getAllTerreni({ includeTerreniClienti: false });
  fillTerrenoSelect();
  loadSessions();
  renderTable();
  initMap();

  $('terreno-select').addEventListener('change', (e) => selectTerreno(e.target.value));
  $('btn-center').addEventListener('click', () => {
    if (!selected) {
      setStatus('Seleziona un terreno.', 'err');
      return;
    }
    const c = polygonCentroid(selected.polygonCoords);
    runProposal(c);
  });
  $('btn-export').addEventListener('click', exportJson);
  $('btn-clear').addEventListener('click', () => {
    sessions = [];
    persistSessions();
    renderTable();
    setStatus('Tabella sessioni svuotata (solo questa scheda).', 'ok');
  });

  setStatus('Pilota Fase 0: misura, non salva. Nessun pulsante in Terreni.', 'ok');
}

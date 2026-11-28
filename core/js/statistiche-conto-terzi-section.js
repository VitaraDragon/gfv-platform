/**
 * Caricamento e render del blocco Conto terzi su Statistiche.
 * Una query per collezione (lavori, clienti, terreni, attivita); aggrega in memoria.
 * @module core/js/statistiche-conto-terzi-section
 */

import { calcolaBloccoContoTerziAnnata } from './statistiche-conto-terzi-blocco.js';
import {
  chartColorsForItems,
  readReportChartColors
} from '../../modules/report/js/report-chart-colors.js';
import { updateChartContoTerziLavoriCliente } from './statistiche-charts.js';
import { escapeHtml } from './statistiche-utils.js';

/** @type {{ lavori: object[], attivita: object[], clientiById: Map<string, object>, terreniById: Map<string, object> }|null} */
let _cache = null;
/** @type {string|null} */
let _cacheTenantId = null;

/**
 * @param {string} tenantId
 * @param {object} dependencies
 * @param {{ force?: boolean }} [options]
 */
export async function loadContoTerziBloccoBundle(tenantId, dependencies, options = {}) {
  if (!options.force && _cache && _cacheTenantId === tenantId) {
    return _cache;
  }
  const { db, collection, getDocs } = dependencies;
  if (!tenantId || !db) {
    _cache = { lavori: [], attivita: [], clientiById: new Map(), terreniById: new Map() };
    _cacheTenantId = tenantId || null;
    return _cache;
  }

  const [lavoriSnap, clientiSnap, terreniSnap, attivitaSnap] = await Promise.all([
    getDocs(collection(db, 'tenants', tenantId, 'lavori')),
    getDocs(collection(db, 'tenants', tenantId, 'clienti')),
    getDocs(collection(db, 'tenants', tenantId, 'terreni')),
    getDocs(collection(db, 'tenants', tenantId, 'attivita'))
  ]);

  const lavori = (lavoriSnap.docs || []).map((d) =>
    Object.assign({ id: d.id }, d.data() || {})
  );
  const attivita = (attivitaSnap.docs || []).map((d) =>
    Object.assign({ id: d.id }, d.data() || {})
  );
  /** @type {Map<string, object>} */
  const clientiById = new Map();
  (clientiSnap.docs || []).forEach((d) => {
    clientiById.set(d.id, Object.assign({ id: d.id }, d.data() || {}));
  });
  /** @type {Map<string, object>} */
  const terreniById = new Map();
  (terreniSnap.docs || []).forEach((d) => {
    terreniById.set(d.id, Object.assign({ id: d.id }, d.data() || {}));
  });

  _cache = { lavori, attivita, clientiById, terreniById };
  _cacheTenantId = tenantId;
  return _cache;
}

/**
 * @param {number} n
 * @param {number} [digits=1]
 * @returns {string}
 */
function formatNum(n, digits = 1) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return v.toLocaleString('it-IT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
}

/**
 * @param {string} tenantId
 * @param {number} anno
 * @param {object} dependencies
 * @param {{
 *   hasReportModule?: boolean,
 *   chartState?: object,
 *   updateChartState?: Function
 * }} [ui]
 */
export async function renderContoTerziBlocco(tenantId, anno, dependencies, ui = {}) {
  const section = document.getElementById('statistiche-conto-terzi-section');
  if (!section) return null;

  section.style.display = 'block';
  const loadingEl = document.getElementById('conto-terzi-blocco-loading');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const data = await loadContoTerziBloccoBundle(tenantId, dependencies);
    const kpi = calcolaBloccoContoTerziAnnata({
      lavori: data.lavori,
      attivita: data.attivita,
      clientiById: data.clientiById,
      terreniById: data.terreniById,
      anno,
      topN: 7
    });

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('kpi-ct-n-lavori', String(kpi.nLavori));
    setText('kpi-ct-clienti-attivi', String(kpi.clientiAttivi));
    setText('kpi-ct-ettari', formatNum(kpi.ettari, 2));
    setText('kpi-ct-ore', formatNum(kpi.ore, 1));

    renderLavoriPerClienteCards(kpi.lavoriPerCliente);
    renderCtaReport(!!ui.hasReportModule);

    if (typeof ui.updateChartState === 'function') {
      updateChartContoTerziLavoriCliente(
        kpi.lavoriPerCliente,
        ui.chartState || {},
        ui.updateChartState
      );
    }

    return kpi;
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

/**
 * @param {{ nome: string, valore: number }[]} rows
 */
function renderLavoriPerClienteCards(rows) {
  const host = document.getElementById('conto-terzi-lavori-cliente-cards');
  if (!host) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    host.innerHTML = '<div class="empty-state" style="padding:12px;">Nessun lavoro conto terzi nell\'annata</div>';
    return;
  }
  const palette = readReportChartColors();
  const colors = chartColorsForItems(list.map((r) => r.nome), palette);
  host.innerHTML = list.map((r, idx) => {
    const bg = colors[idx] || palette.altri;
    const n = Number(r.valore) || 0;
    return `
      <div class="mano-operaio-card" style="border-left:4px solid ${bg};">
        <div class="title">${escapeHtml(r.nome)}</div>
        <div class="tot">${escapeHtml(String(n))} lavor${n === 1 ? 'o' : 'i'}</div>
      </div>`;
  }).join('');
}

/**
 * @param {boolean} hasReport
 */
function renderCtaReport(hasReport) {
  const el = document.getElementById('conto-terzi-report-cta');
  if (!el) return;
  if (hasReport) {
    el.innerHTML = 'Per ricavi, costi, margine, preventivi e export apri <a href="../modules/report/views/report-conto-terzi-standalone.html">Report — Conto terzi</a>.';
  } else {
    el.innerHTML = 'Vuoi ricavi, margine e export? <a href="admin/abbonamento-standalone.html">Attiva il modulo Report</a>.';
  }
}

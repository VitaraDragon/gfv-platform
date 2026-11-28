/**
 * Caricamento e render del blocco Magazzino su Statistiche (solo quantità).
 * Una query per collezione (prodotti, movimentiMagazzino); aggrega in memoria.
 * @module core/js/statistiche-magazzino-section
 */

import { calcolaBloccoMagazzinoAnnata } from './statistiche-magazzino-blocco.js';
import {
  chartColorsForItems,
  readReportChartColors
} from '../../modules/report/js/report-chart-colors.js';
import { updateChartMagazzinoMovimentiProdotto } from './statistiche-charts.js';
import { escapeHtml } from './statistiche-utils.js';

/** @type {{ prodotti: object[], movimenti: object[] }|null} */
let _cache = null;
/** @type {string|null} */
let _cacheTenantId = null;

/**
 * @param {string} tenantId
 * @param {object} dependencies
 * @param {{ force?: boolean }} [options]
 */
export async function loadMagazzinoBloccoBundle(tenantId, dependencies, options = {}) {
  if (!options.force && _cache && _cacheTenantId === tenantId) {
    return _cache;
  }
  const { db, collection, getDocs } = dependencies;
  if (!tenantId || !db) {
    _cache = { prodotti: [], movimenti: [] };
    _cacheTenantId = tenantId || null;
    return _cache;
  }

  const [prodottiSnap, movimentiSnap] = await Promise.all([
    getDocs(collection(db, 'tenants', tenantId, 'prodotti')),
    getDocs(collection(db, 'tenants', tenantId, 'movimentiMagazzino'))
  ]);

  const prodotti = (prodottiSnap.docs || []).map((d) =>
    Object.assign({ id: d.id }, d.data() || {})
  );
  const movimenti = (movimentiSnap.docs || []).map((d) =>
    Object.assign({ id: d.id }, d.data() || {})
  );

  _cache = { prodotti, movimenti };
  _cacheTenantId = tenantId;
  return _cache;
}

/**
 * @param {number} n
 * @param {number} [digits=1]
 * @returns {string}
 */
function formatQty(n, digits = 1) {
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
export async function renderMagazzinoBlocco(tenantId, anno, dependencies, ui = {}) {
  const section = document.getElementById('statistiche-magazzino-section');
  if (!section) return null;

  section.style.display = 'block';
  const loadingEl = document.getElementById('magazzino-blocco-loading');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const data = await loadMagazzinoBloccoBundle(tenantId, dependencies);
    const kpi = calcolaBloccoMagazzinoAnnata({
      prodotti: data.prodotti,
      movimenti: data.movimenti,
      anno,
      topGiacenze: 5,
      topNChart: 7
    });

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('kpi-mag-n-giacenze', String(kpi.nProdottiConGiacenza));
    setText('kpi-mag-entrate', formatQty(kpi.qtyEntrate, 2));
    setText('kpi-mag-uscite', formatQty(kpi.qtyUscite, 2));
    setText('kpi-mag-n-movimenti', String(kpi.nMovimenti));

    renderGiacenzePrincipali(kpi.giacenzePrincipali);
    renderMovimentiCards(kpi.movimentiPerProdotto);
    renderCtaReport(!!ui.hasReportModule);

    if (typeof ui.updateChartState === 'function') {
      updateChartMagazzinoMovimentiProdotto(
        kpi.movimentiPerProdotto,
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
 * @param {{ nome: string, giacenza: number, unitaMisura?: string }[]} rows
 */
function renderGiacenzePrincipali(rows) {
  const tableBody = document.getElementById('magazzino-giacenze-body');
  const cardsHost = document.getElementById('magazzino-giacenze-cards');
  const list = Array.isArray(rows) ? rows : [];

  if (tableBody) {
    if (!list.length) {
      tableBody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#999;padding:16px;">Nessuna giacenza positiva</td></tr>';
    } else {
      tableBody.innerHTML = list.map((r) => {
        const um = r.unitaMisura ? ` ${r.unitaMisura}` : '';
        return `
          <tr>
            <td>${escapeHtml(r.nome)}</td>
            <td style="text-align:right;font-weight:600;">${escapeHtml(formatQty(r.giacenza, 2))}${escapeHtml(um)}</td>
          </tr>`;
      }).join('');
    }
  }

  if (cardsHost) {
    if (!list.length) {
      cardsHost.innerHTML = '<div class="empty-state" style="padding:12px;">Nessuna giacenza positiva</div>';
    } else {
      cardsHost.innerHTML = list.map((r) => {
        const um = r.unitaMisura ? ` ${r.unitaMisura}` : '';
        return `
          <div class="mano-operaio-card">
            <div class="title">${escapeHtml(r.nome)}</div>
            <div class="tot">${escapeHtml(formatQty(r.giacenza, 2))}${escapeHtml(um)}</div>
          </div>`;
      }).join('');
    }
  }
}

/**
 * @param {{ nome: string, valore: number }[]} rows
 */
function renderMovimentiCards(rows) {
  const host = document.getElementById('magazzino-movimenti-prodotto-cards');
  if (!host) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    host.innerHTML = '<div class="empty-state" style="padding:12px;">Nessun movimento nell\'annata</div>';
    return;
  }
  const palette = readReportChartColors();
  const colors = chartColorsForItems(list.map((r) => r.nome), palette);
  host.innerHTML = list.map((r, idx) => {
    const bg = colors[idx] || palette.altri;
    return `
      <div class="mano-operaio-card" style="border-left:4px solid ${bg};">
        <div class="title">${escapeHtml(r.nome)}</div>
        <div class="tot">${escapeHtml(formatQty(r.valore, 2))}</div>
        <div class="meta">quantità movimenti</div>
      </div>`;
  }).join('');
}

/**
 * @param {boolean} hasReport
 */
function renderCtaReport(hasReport) {
  const el = document.getElementById('magazzino-report-cta');
  if (!el) return;
  if (hasReport) {
    el.innerHTML = 'Per valori in euro, schede prodotto, confronti e export apri <a href="../modules/report/views/report-magazzino-standalone.html">Report — Magazzino</a>.';
  } else {
    el.innerHTML = 'Vuoi valori in euro, confronti e export? <a href="admin/abbonamento-standalone.html">Attiva il modulo Report</a>.';
  }
}

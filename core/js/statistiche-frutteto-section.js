/**
 * Caricamento e render del blocco Frutteto su Statistiche.
 * Una query frutteti + una getDocs raccolte per frutteto (in parallelo); aggrega in memoria.
 * @module core/js/statistiche-frutteto-section
 */

import { calcolaBloccoFruttetoAnnata } from './statistiche-frutteto-blocco.js';
import {
  chartColorsForItems,
  readReportChartColors
} from '../../modules/report/js/report-chart-colors.js';
import { updateChartFruttetoProduzioneSpecie } from './statistiche-charts.js';
import { escapeHtml } from './statistiche-utils.js';

/** @type {{ frutteti: object[], raccolte: object[] }|null} */
let _cache = null;
/** @type {string|null} */
let _cacheTenantId = null;

/**
 * @param {string} tenantId
 * @param {object} dependencies
 * @param {{ force?: boolean }} [options]
 */
export async function loadFruttetoBloccoBundle(tenantId, dependencies, options = {}) {
  if (!options.force && _cache && _cacheTenantId === tenantId) {
    return _cache;
  }
  const { db, collection, getDocs } = dependencies;
  if (!tenantId || !db) {
    _cache = { frutteti: [], raccolte: [] };
    _cacheTenantId = tenantId || null;
    return _cache;
  }

  const fruttetiSnap = await getDocs(collection(db, 'tenants', tenantId, 'frutteti'));
  const frutteti = (fruttetiSnap.docs || []).map((d) =>
    Object.assign({ id: d.id }, d.data() || {})
  );

  const raccolteNested = await Promise.all(
    frutteti.map(async (f) => {
      if (!f || !f.id) return [];
      try {
        const snap = await getDocs(
          collection(db, 'tenants', tenantId, 'frutteti', f.id, 'raccolte')
        );
        return (snap.docs || []).map((d) =>
          Object.assign({ id: d.id, fruttetoId: f.id }, d.data() || {})
        );
      } catch (e) {
        console.warn('[statistiche-frutteto] raccolte', f.id, e && e.message);
        return [];
      }
    })
  );
  const raccolte = raccolteNested.flat();

  _cache = { frutteti, raccolte };
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
export async function renderFruttetoBlocco(tenantId, anno, dependencies, ui = {}) {
  const section = document.getElementById('statistiche-frutteto-section');
  if (!section) return null;

  section.style.display = 'block';
  const loadingEl = document.getElementById('frutteto-blocco-loading');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const data = await loadFruttetoBloccoBundle(tenantId, dependencies);
    const kpi = calcolaBloccoFruttetoAnnata({
      frutteti: data.frutteti,
      raccolte: data.raccolte,
      anno,
      topNChart: 7
    });

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('kpi-fru-superficie', formatNum(kpi.superficieHa, 2));
    setText('kpi-fru-produzione', formatNum(kpi.produzioneKg, 1));
    setText('kpi-fru-resa', formatNum(kpi.resaKgHa, 1));
    setText('kpi-fru-n-frutteti', String(kpi.nFrutteti));

    renderProduzioneCards(kpi.produzionePerSpecie);
    renderCta(!!ui.hasReportModule);

    if (typeof ui.updateChartState === 'function') {
      updateChartFruttetoProduzioneSpecie(
        kpi.produzionePerSpecie,
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
function renderProduzioneCards(rows) {
  const host = document.getElementById('frutteto-produzione-specie-cards');
  if (!host) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    host.innerHTML = '<div class="empty-state" style="padding:12px;">Nessuna raccolta nell\'annata</div>';
    return;
  }
  const palette = readReportChartColors();
  const colors = chartColorsForItems(list.map((r) => r.nome), palette);
  host.innerHTML = list.map((r, idx) => {
    const bg = colors[idx] || palette.altri;
    return `
      <div class="mano-operaio-card" style="border-left:4px solid ${bg};">
        <div class="title">${escapeHtml(r.nome)}</div>
        <div class="tot">${escapeHtml(formatNum(r.valore, 1))} kg</div>
      </div>`;
  }).join('');
}

/**
 * @param {boolean} hasReport
 */
function renderCta(hasReport) {
  const el = document.getElementById('frutteto-report-cta');
  if (!el) return;
  const dettaglio = '<a href="../modules/frutteto/views/frutteto-statistiche-standalone.html">Apri il dettaglio del modulo</a>';
  if (hasReport) {
    el.innerHTML = `Per confronti tra anni, costi, scarto e export apri <a href="../modules/report/views/report-frutteto-standalone.html">Report — Frutteto</a>. · ${dettaglio}`;
  } else {
    el.innerHTML = `Vuoi confronti, costi e export? <a href="admin/abbonamento-standalone.html">Attiva il modulo Report</a>. · ${dettaglio}`;
  }
}

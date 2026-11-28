/**
 * Caricamento e render del blocco Seminativo su Statistiche.
 * Una getDocs per collezione (seminativi, raccolteSeminativo); aggrega in memoria.
 * @module core/js/statistiche-seminativo-section
 */

import {
  RACCOLTE_SEMINATIVO_COLLECTION,
  SEMINATIVO_COLLECTION
} from '../../modules/seminativo/config/seminativo-hub.js';
import { calcolaBloccoSeminativoAnnata } from './statistiche-seminativo-blocco.js';
import {
  chartColorsForItems,
  readReportChartColors
} from '../../modules/report/js/report-chart-colors.js';
import { updateChartSeminativoProduzioneColtura } from './statistiche-charts.js';
import { escapeHtml } from './statistiche-utils.js';

/** @type {{ campagne: object[], raccolte: object[] }|null} */
let _cache = null;
/** @type {string|null} */
let _cacheTenantId = null;

/**
 * @param {string} tenantId
 * @param {object} dependencies
 * @param {{ force?: boolean }} [options]
 */
export async function loadSeminativoBloccoBundle(tenantId, dependencies, options = {}) {
  if (!options.force && _cache && _cacheTenantId === tenantId) {
    return _cache;
  }
  const { db, collection, getDocs } = dependencies;
  if (!tenantId || !db) {
    _cache = { campagne: [], raccolte: [] };
    _cacheTenantId = tenantId || null;
    return _cache;
  }

  const [campagneSnap, raccolteSnap] = await Promise.all([
    getDocs(collection(db, 'tenants', tenantId, SEMINATIVO_COLLECTION)),
    getDocs(collection(db, 'tenants', tenantId, RACCOLTE_SEMINATIVO_COLLECTION))
  ]);

  const campagne = (campagneSnap.docs || []).map((d) =>
    Object.assign({ id: d.id }, d.data() || {})
  );
  const raccolte = (raccolteSnap.docs || []).map((d) =>
    Object.assign({ id: d.id }, d.data() || {})
  );

  _cache = { campagne, raccolte };
  _cacheTenantId = tenantId;
  return _cache;
}

/**
 * @param {number|null|undefined} n
 * @param {number} [digits=1]
 * @returns {string}
 */
function formatNum(n, digits = 1) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('it-IT', {
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
export async function renderSeminativoBlocco(tenantId, anno, dependencies, ui = {}) {
  const section = document.getElementById('statistiche-seminativo-section');
  if (!section) return null;

  section.style.display = 'block';
  const loadingEl = document.getElementById('seminativo-blocco-loading');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const data = await loadSeminativoBloccoBundle(tenantId, dependencies);
    const kpi = calcolaBloccoSeminativoAnnata({
      campagne: data.campagne,
      raccolte: data.raccolte,
      anno,
      topNChart: 7
    });

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('kpi-sem-produzione', formatNum(kpi.produzioneQli, 1));
    setText('kpi-sem-resa-effettiva', formatNum(kpi.resaEffettivaQliHa, 1));
    setText('kpi-sem-resa-prevista', formatNum(kpi.resaPrevistaQliHa, 1));
    setText('kpi-sem-n-campagne', String(kpi.nCampagne));

    renderProduzioneCards(kpi.produzionePerColtura);
    renderCta(!!ui.hasReportModule);

    if (typeof ui.updateChartState === 'function') {
      updateChartSeminativoProduzioneColtura(
        kpi.produzionePerColtura,
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
  const host = document.getElementById('seminativo-produzione-coltura-cards');
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
        <div class="tot">${escapeHtml(formatNum(r.valore, 1))} q.li</div>
      </div>`;
  }).join('');
}

/**
 * @param {boolean} hasReport
 */
function renderCta(hasReport) {
  const el = document.getElementById('seminativo-report-cta');
  if (!el) return;
  const dettaglio = '<a href="../modules/seminativo/views/seminativo-statistiche-standalone.html">Apri il dettaglio del modulo</a>';
  if (hasReport) {
    el.innerHTML = `Per costi e export apri <a href="../modules/report/views/report-economici-standalone.html">Report — Economici</a>; la sezione dedicata arriverà. · ${dettaglio}`;
  } else {
    el.innerHTML = `Vuoi costi e export? <a href="admin/abbonamento-standalone.html">Attiva il modulo Report</a>. · ${dettaglio}`;
  }
}

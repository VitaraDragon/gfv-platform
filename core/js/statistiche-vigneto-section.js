/**
 * Caricamento e render del blocco Vigneto su Statistiche.
 * Una query vigneti + una getDocs vendemmie per vigneto (in parallelo); aggrega in memoria.
 * @module core/js/statistiche-vigneto-section
 */

import { calcolaBloccoVignetoAnnata } from './statistiche-vigneto-blocco.js';
import {
  chartColorsForItems,
  readReportChartColors
} from '../../modules/report/js/report-chart-colors.js';
import { updateChartVignetoProduzioneVarieta } from './statistiche-charts.js';
import { escapeHtml } from './statistiche-utils.js';

/** @type {{ vigneti: object[], vendemmie: object[] }|null} */
let _cache = null;
/** @type {string|null} */
let _cacheTenantId = null;

/**
 * @param {string} tenantId
 * @param {object} dependencies
 * @param {{ force?: boolean }} [options]
 */
export async function loadVignetoBloccoBundle(tenantId, dependencies, options = {}) {
  if (!options.force && _cache && _cacheTenantId === tenantId) {
    return _cache;
  }
  const { db, collection, getDocs } = dependencies;
  if (!tenantId || !db) {
    _cache = { vigneti: [], vendemmie: [] };
    _cacheTenantId = tenantId || null;
    return _cache;
  }

  const vignetiSnap = await getDocs(collection(db, 'tenants', tenantId, 'vigneti'));
  const vigneti = (vignetiSnap.docs || []).map((d) =>
    Object.assign({ id: d.id }, d.data() || {})
  );

  const vendemmieNested = await Promise.all(
    vigneti.map(async (v) => {
      if (!v || !v.id) return [];
      try {
        const snap = await getDocs(
          collection(db, 'tenants', tenantId, 'vigneti', v.id, 'vendemmie')
        );
        return (snap.docs || []).map((d) =>
          Object.assign({ id: d.id, vignetoId: v.id }, d.data() || {})
        );
      } catch (e) {
        console.warn('[statistiche-vigneto] vendemmie', v.id, e && e.message);
        return [];
      }
    })
  );
  const vendemmie = vendemmieNested.flat();

  _cache = { vigneti, vendemmie };
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
export async function renderVignetoBlocco(tenantId, anno, dependencies, ui = {}) {
  const section = document.getElementById('statistiche-vigneto-section');
  if (!section) return null;

  section.style.display = 'block';
  const loadingEl = document.getElementById('vigneto-blocco-loading');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const data = await loadVignetoBloccoBundle(tenantId, dependencies);
    const kpi = calcolaBloccoVignetoAnnata({
      vigneti: data.vigneti,
      vendemmie: data.vendemmie,
      anno,
      topNChart: 7
    });

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('kpi-vig-superficie', formatNum(kpi.superficieHa, 2));
    setText('kpi-vig-produzione', formatNum(kpi.produzioneQli, 1));
    setText('kpi-vig-resa', formatNum(kpi.resaQliHa, 1));
    setText('kpi-vig-n-vigneti', String(kpi.nVigneti));

    renderProduzioneCards(kpi.produzionePerVarieta);
    renderCta(!!ui.hasReportModule);

    if (typeof ui.updateChartState === 'function') {
      updateChartVignetoProduzioneVarieta(
        kpi.produzionePerVarieta,
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
  const host = document.getElementById('vigneto-produzione-varieta-cards');
  if (!host) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    host.innerHTML = '<div class="empty-state" style="padding:12px;">Nessuna vendemmia nell\'annata</div>';
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
  const el = document.getElementById('vigneto-report-cta');
  if (!el) return;
  const dettaglio = '<a href="../modules/vigneto/views/vigneto-statistiche-standalone.html">Apri il dettaglio del modulo</a>';
  if (hasReport) {
    el.innerHTML = `Per confronti tra anni, costi e export apri <a href="../modules/report/views/report-standalone.html">Report — Vigneto</a>. · ${dettaglio}`;
  } else {
    el.innerHTML = `Vuoi confronti, costi e export? <a href="admin/abbonamento-standalone.html">Attiva il modulo Report</a>. · ${dettaglio}`;
  }
}

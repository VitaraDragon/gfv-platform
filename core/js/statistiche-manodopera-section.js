/**
 * Caricamento e render del blocco Manodopera su Statistiche.
 * @module core/js/statistiche-manodopera-section
 */

import {
  fetchLavoriWithOreOperai,
  fetchUsersByIds,
  forEachOraInBundle
} from '../services/manodopera-lavori-ore-loader.js';
import { isLavoroSolaLettura } from '../../shared/js/storico-sola-lettura.js';
import { calcolaBloccoManodoperaAnnata } from './statistiche-manodopera-blocco.js';
import {
  chartColorsForItems,
  readReportChartColors
} from '../../modules/report/js/report-chart-colors.js';
import { updateChartManodoperaOreMese } from './statistiche-charts.js';
import { formatOre, escapeHtml } from './statistiche-utils.js';

/** @type {{ bundle: *, terreniById: Map<string, object>, lavori: object[], oreRows: object[] }|null} */
let _cache = null;
/** @type {string|null} */
let _cacheTenantId = null;

/**
 * @param {number} fromYear
 * @param {number} toYear
 * @returns {number[]}
 */
export function buildAnniOptions(fromYear, toYear) {
  const years = [];
  const a = Math.min(fromYear, toYear);
  const b = Math.max(fromYear, toYear);
  for (let y = b; y >= a; y -= 1) years.push(y);
  return years;
}

/**
 * @param {HTMLSelectElement|null} select
 * @param {number} selectedYear
 * @param {Date} [oggi]
 */
export function populateAnnoSelect(select, selectedYear, oggi = new Date()) {
  if (!select) return;
  const current = oggi.getFullYear();
  const years = buildAnniOptions(current - 8, current + 1);
  select.innerHTML = years
    .map((y) => `<option value="${y}"${y === selectedYear ? ' selected' : ''}>${y}</option>`)
    .join('');
}

/**
 * @param {string} tenantId
 * @param {object} dependencies
 * @param {{ force?: boolean }} [options]
 */
export async function loadManodoperaBloccoBundle(tenantId, dependencies, options = {}) {
  if (!options.force && _cache && _cacheTenantId === tenantId) {
    return _cache;
  }
  const { db, collection, getDocs, query, where, doc, getDoc } = dependencies;
  const bundle = await fetchLavoriWithOreOperai(tenantId, {
    db, collection, getDocs, query, where
  });

  const terreniSnap = await getDocs(collection(db, 'tenants', tenantId, 'terreni'));
  /** @type {Map<string, object>} */
  const terreniById = new Map();
  (terreniSnap.docs || []).forEach((tDoc) => {
    terreniById.set(tDoc.id, Object.assign({ id: tDoc.id }, tDoc.data() || {}));
  });

  const lavori = (bundle.lavoriDocs || []).map((lavoroDoc) =>
    Object.assign({ id: lavoroDoc.id }, lavoroDoc.data() || {})
  );

  /** @type {object[]} */
  const oreRows = [];
  forEachOraInBundle(bundle, (ctx) => {
    const ora = ctx.oraData || {};
    oreRows.push({
      stato: ora.stato,
      oreNette: ora.oreNette,
      data: ora.data,
      operaioId: ora.operaioId,
      lavoroId: ctx.lavoroId
    });
  });

  _cache = { bundle, terreniById, lavori, oreRows };
  _cacheTenantId = tenantId;
  return _cache;
}

/**
 * @param {string} tenantId
 * @param {number} anno
 * @param {object} dependencies
 * @param {{
 *   hasReportModule?: boolean,
 *   chartState?: object,
 *   updateChartState?: Function,
 *   oggi?: Date
 * }} [ui]
 */
export async function renderManodoperaBlocco(tenantId, anno, dependencies, ui = {}) {
  const section = document.getElementById('statistiche-manodopera-section');
  if (!section) return null;

  section.style.display = 'block';
  const loadingEl = document.getElementById('manodopera-blocco-loading');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const data = await loadManodoperaBloccoBundle(tenantId, dependencies);
    const operaioIds = [...new Set(
      (data.oreRows || []).map((o) => o.operaioId).filter(Boolean).map(String)
    )];
    const usersById = await fetchUsersByIds(operaioIds, dependencies);

    const kpi = calcolaBloccoManodoperaAnnata({
      oreRows: data.oreRows,
      lavori: data.lavori,
      terreniById: data.terreniById,
      usersById,
      anno,
      oggi: ui.oggi instanceof Date ? ui.oggi : new Date(),
      isLavoroSolaLettura,
      topN: 5
    });

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('kpi-mano-ore-validate', formatOre(kpi.oreValidateAnno));
    setText('kpi-mano-ore-da-validare', formatOre(kpi.oreDaValidare));
    setText('kpi-mano-lavori-attivi', String(kpi.lavoriAttiviAnno));
    setText('kpi-mano-lavori-completati', String(kpi.lavoriCompletatiAnno));
    setText(
      'kpi-mano-media-giorno',
      formatOre(kpi.mediaOreGiornoMeseCorrente)
    );
    setText(
      'kpi-mano-media-giorno-sub',
      `Media ore/giorno · ${kpi.mediaOreGiornoEtichetta}`
    );
    setText('kpi-mano-annullati', kpi.lavoriAnnullatiAnno > 0
      ? `${kpi.lavoriAnnullatiAnno} annullati (esclusi)`
      : '');

    renderOrePerTipo(kpi.orePerTipo);
    renderTopOperai(kpi.topOperai);
    renderCtaReport(!!ui.hasReportModule);

    if (typeof ui.updateChartState === 'function') {
      updateChartManodoperaOreMese(
        kpi.orePerMese,
        ui.chartState || {},
        ui.updateChartState,
        formatOre
      );
    }

    return kpi;
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

/**
 * @param {{ tipo: string, ore: number }[]} tipi
 */
function renderOrePerTipo(tipi) {
  const host = document.getElementById('manodopera-ore-per-tipo');
  if (!host) return;
  const list = Array.isArray(tipi) ? tipi : [];
  if (!list.length) {
    host.innerHTML = '<div class="empty-state" style="padding:12px;">Nessun dato disponibile</div>';
    return;
  }
  const palette = readReportChartColors();
  const colors = chartColorsForItems(list.map((t) => t.tipo), palette);
  host.innerHTML = list.map((t, idx) => {
    const bg = colors[idx] || palette.altri;
    return `
      <div class="mano-tipo-chip" style="background:${bg};">
        <div class="mano-tipo-ore">${escapeHtml(formatOre(t.ore))}</div>
        <div class="mano-tipo-label">${escapeHtml(t.tipo)}</div>
      </div>`;
  }).join('');
}

/**
 * @param {{ nomeCompleto: string, tipoDisplay: string, oreTotali: number, oreValidate: number }[]} top
 */
function renderTopOperai(top) {
  const tableBody = document.getElementById('manodopera-top-operai-body');
  const cardsHost = document.getElementById('manodopera-top-operai-cards');
  const list = Array.isArray(top) ? top : [];

  if (tableBody) {
    if (!list.length) {
      tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#999;padding:16px;">Nessun operaio nell\'annata</td></tr>';
    } else {
      tableBody.innerHTML = list.map((o) => `
        <tr>
          <td>${escapeHtml(o.nomeCompleto)}</td>
          <td>${escapeHtml(o.tipoDisplay)}</td>
          <td style="text-align:right;font-weight:600;">${escapeHtml(formatOre(o.oreTotali))}</td>
        </tr>`).join('');
    }
  }

  if (cardsHost) {
    if (!list.length) {
      cardsHost.innerHTML = '<div class="empty-state" style="padding:12px;">Nessun operaio nell\'annata</div>';
    } else {
      cardsHost.innerHTML = list.map((o) => `
        <div class="mano-operaio-card">
          <div class="title">${escapeHtml(o.nomeCompleto)}</div>
          <div class="meta">${escapeHtml(o.tipoDisplay)}</div>
          <div class="tot">${escapeHtml(formatOre(o.oreTotali))}</div>
        </div>`).join('');
    }
  }
}

/**
 * @param {boolean} hasReport
 */
function renderCtaReport(hasReport) {
  const el = document.getElementById('manodopera-report-cta');
  if (!el) return;
  if (hasReport) {
    el.innerHTML = 'Per periodi a piacere, confronti, costi e per scaricare i dati apri <a href="../modules/report/views/report-manodopera-standalone.html">Report — Manodopera</a>.';
  } else {
    el.innerHTML = 'Vuoi periodi liberi, confronti e export? <a href="admin/abbonamento-standalone.html">Attiva il modulo Report</a>.';
  }
}

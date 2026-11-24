/**
 * Report Magazzino — caricamento fonti + assemblaggio.
 * Solo lettura: prodotti + movimentiMagazzino.
 *
 * @module modules/report/services/report-magazzino-service
 */

import {
  getCollectionData,
  dateToTimestamp
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId, getCurrentTenant } from '../../../core/services/tenant-service.js';
import { resolveEffectiveModules } from '../../../core/utils/module-access-resolver.js';
import {
  formatLocalIsoDate,
  inRange
} from './report-economici-aggregate.js';
import {
  assembleMagazzinoReport,
  labelCategoria
} from './report-magazzino-aggregate.js';

/** @type {{ key: string, data: object }|null} */
let periodBundleCache = null;

function periodKey(start, end) {
  return `${formatLocalIsoDate(start)}|${formatLocalIsoDate(end)}`;
}

function timePhase(timings, name, ms) {
  timings[name] = Math.round(ms);
  if (typeof console !== 'undefined' && console.info) {
    console.info(`[report-magazzino] ${name}: ${Math.round(ms)} ms`);
  }
}

/**
 * @param {Date} start
 * @param {Date} end
 * @returns {Promise<object[]>}
 */
async function loadMovimentiInRange(start, end) {
  const t0 = dateToTimestamp(start);
  const t1 = dateToTimestamp(end);
  const tenantId = getCurrentTenantId();
  try {
    const docs = await getCollectionData('movimentiMagazzino', {
      tenantId,
      where: [
        ['data', '>=', t0],
        ['data', '<=', t1]
      ],
      orderBy: 'data',
      orderDirection: 'desc'
    });
    return docs || [];
  } catch (_) {
    try {
      const { getAllMovimenti } = await import('../../magazzino/services/movimenti-service.js');
      const all = await getAllMovimenti({}).catch(() => []);
      return (all || []).filter((m) => m && inRange(m.data, start, end));
    } catch (e) {
      console.warn('[report-magazzino] movimenti', e && e.message);
      return [];
    }
  }
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {{ forceReload?: boolean }} [opts]
 */
export async function loadMagazzinoPeriodBundle(start, end, opts = {}) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant non disponibile');

  const key = periodKey(start, end);
  if (!opts.forceReload && periodBundleCache && periodBundleCache.key === key) {
    return periodBundleCache.data;
  }

  const timings = {};
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const tenant = await getCurrentTenant().catch(() => null);
  const mods = new Set((resolveEffectiveModules(tenant || {}) || []).map((m) => String(m || '').toLowerCase()));
  if (!mods.has('magazzino')) {
    const empty = {
      movimenti: [],
      prodotti: [],
      timings: { skipped: 1 },
      ready: true
    };
    periodBundleCache = { key, data: empty };
    return empty;
  }

  let t0 = now();
  let prodotti = [];
  try {
    const { getAllProdotti } = await import('../../magazzino/services/prodotti-service.js');
    prodotti = await getAllProdotti().catch(() => []) || [];
  } catch (e) {
    console.warn('[report-magazzino] prodotti', e && e.message);
    prodotti = await getCollectionData('prodotti', { tenantId }).catch(() => []) || [];
  }
  timePhase(timings, 'prodotti', now() - t0);

  t0 = now();
  const movimenti = await loadMovimentiInRange(start, end);
  timePhase(timings, 'movimenti', now() - t0);

  const data = {
    movimenti,
    prodotti,
    timings,
    ready: true
  };
  periodBundleCache = { key, data };
  return data;
}

/**
 * @param {object} bundle
 * @param {{ categoria?: string|null, prodottoId?: string|null, tipo?: string|null, origineUscita?: string|null }} [filters]
 */
export function assembleMagazzinoFromBundle(bundle, filters = {}) {
  if (!bundle || !bundle.ready) {
    return {
      movimenti: [],
      byProdotto: [],
      byCategoria: [],
      kpi: {
        valoreEntrate: 0,
        partialEntrate: false,
        valoreUscite: 0,
        partialUscite: false,
        valoreMagazzino: 0,
        partialMagazzino: false,
        prodottiSottoScorta: 0,
        nProdotti: 0
      },
      chartUsciteCategoria: [],
      chartTopProdotti: [],
      chartMensile: [],
      notes: [],
      empty: true,
      ready: false
    };
  }
  return assembleMagazzinoReport({
    movimenti: bundle.movimenti || [],
    prodotti: bundle.prodotti || []
  }, filters);
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {{ categoria?: string|null, prodottoId?: string|null, tipo?: string|null, origineUscita?: string|null, forceReload?: boolean }} [filters]
 */
export async function buildReportMagazzino(start, end, filters = {}) {
  const bundle = await loadMagazzinoPeriodBundle(start, end, {
    forceReload: filters.forceReload
  });
  return assembleMagazzinoFromBundle(bundle, {
    categoria: filters.categoria,
    prodottoId: filters.prodottoId,
    tipo: filters.tipo,
    origineUscita: filters.origineUscita
  });
}

/**
 * Opzioni filtri da bundle già caricato.
 * @param {object} bundle
 */
export function getMagazzinoFilterOptions(bundle) {
  const prodotti = (bundle && bundle.prodotti) || [];
  const cats = new Map();
  const prods = [];
  for (const p of prodotti) {
    if (!p || !p.id) continue;
    if (p.attivo === false) continue;
    const cat = String(p.categoria || '');
    if (cat && !cats.has(cat)) cats.set(cat, labelCategoria(cat));
    prods.push({
      id: String(p.id),
      nome: p.nome || p.nomeCommerciale || p.id,
      categoria: cat
    });
  }
  prods.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));
  return {
    categorie: [...cats.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
    prodotti: prods
  };
}

export {
  assembleMagazzinoReport,
  prepareMagazzinoExportData,
  isMagazzinoDataReady,
  buildProdottoDetailRows,
  formatEuroPrefixCompact,
  labelCategoria,
  labelOrigineUscita,
  totaleUsciteComeEconomici,
  quotaUsciteEscluseDaEconomici,
  notesUsciteVsEconomici,
  filterProdottiVisibiliTabella,
  valoreUscitaFromMovimento,
  valoreEntrataFromMovimento,
  classifyUscitaOrigine,
  aggregateByProdotto,
  aggregateByCategoria,
  aggregateProdottiUsciteForChart,
  aggregateMonthlyEntrateUscite,
  buildMagazzinoKpi,
  filterEnrichedMovimenti,
  enrichMovimento
} from './report-magazzino-aggregate.js';

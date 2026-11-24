/**
 * Report Macchine — caricamento fonti + assemblaggio.
 * Riusa loader ore/lavori e costi macchina condivisi con Economici.
 *
 * @module modules/report/services/report-macchine-service
 */

import {
  getCollectionData,
  getDb,
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  dateToTimestamp
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId, getCurrentTenant } from '../../../core/services/tenant-service.js';
import { resolveEffectiveModules } from '../../../core/utils/module-access-resolver.js';
import { fetchOreOperaiForLavori, fetchUsersByIds } from '../../../core/services/manodopera-lavori-ore-loader.js';
import {
  chiaveLavoroDiario,
  dataIsoFromAny,
  euro,
  formatLocalIsoDate,
  inRange
} from './report-economici-aggregate.js';
import {
  displayNameUser,
  loadAttivitaInRange,
  loadLavoriInRange
} from './report-labour-shared.js';
import {
  bumpOreMacchinaPerMezzo,
  costiMacchineFromOreMap,
  oreMacchinaMapFromAttivita
} from './report-macchine-shared.js';
import {
  assembleMacchineReport,
  aggregateCarburantePienoByMacchina,
  aggregateGuastiByMacchina,
  buildMacchinaCostLine,
  sumCostoMacchineLikeEconomici
} from './report-macchine-aggregate.js';

/** @type {{ key: string, data: object }|null} */
let periodBundleCache = null;

function periodKey(start, end) {
  return `${formatLocalIsoDate(start)}|${formatLocalIsoDate(end)}`;
}

function timePhase(timings, name, ms) {
  timings[name] = Math.round(ms);
  if (typeof console !== 'undefined' && console.info) {
    console.info(`[report-macchine] ${name}: ${Math.round(ms)} ms`);
  }
}

function terrenoMeta(terrenoById, terrenoId) {
  const t = terrenoId ? terrenoById.get(String(terrenoId)) : null;
  return {
    terrenoId: terrenoId ? String(terrenoId) : null,
    terrenoNome: t
      ? (t.nome || t.podere || terrenoId)
      : (terrenoId || '—'),
    ettari: t && t.superficie != null ? Number(t.superficie) : null
  };
}

function macchinaLabel(meta, id) {
  if (!meta) return id;
  return (meta.nome || meta.targa || meta.modello || id || '').toString();
}

/**
 * Linee ore validate → costo per mezzo (dettaglio).
 */
function buildLinesFromOre(lavoriInRange, oreByLavoroId, ctx) {
  const {
    usersById,
    terrenoById,
    macchineCostoById,
    macchineMetaById
  } = ctx;
  /** @type {import('./report-macchine-aggregate.js').MacchineLine[]} */
  const lines = [];

  for (const lav of lavoriInRange || []) {
    const entry = oreByLavoroId.get(lav.id) || { oreDocs: [] };
    const metaT = terrenoMeta(terrenoById, lav.terrenoId);
    const dataIso = dataIsoFromAny(lav.dataInizio || lav.data);
    const tipoLavoro = lav.tipoLavoro || '';

    for (const oraDoc of entry.oreDocs || []) {
      const ora = typeof oraDoc.data === 'function' ? oraDoc.data() : oraDoc;
      if (!ora || ora.stato !== 'validate') continue;
      const oreMac = Number(ora.oreMacchina) || 0;
      if (oreMac <= 0) continue;

      /** @type {Record<string, number>} */
      const perMezzo = {};
      bumpOreMacchinaPerMezzo(perMezzo, ora);
      const operaioId = ora.operaioId ? String(ora.operaioId) : null;
      const user = operaioId ? usersById.get(operaioId) : null;

      for (const [mid, ore] of Object.entries(perMezzo)) {
        const meta = macchineMetaById.get(String(mid)) || {};
        lines.push(buildMacchinaCostLine({
          macchinaId: mid,
          nome: macchinaLabel(meta, mid),
          tipoMezzo: meta.tipoMacchina || meta.tipo || '',
          ore,
          ...metaT,
          dataIso,
          tipoLavoro,
          lavoroId: lav.id ? String(lav.id) : null,
          operaioId,
          operaioNome: operaioId ? displayNameUser(user, operaioId) : null,
          origine: 'lavoro'
        }, macchineCostoById, macchineMetaById));
      }
    }
  }
  return lines;
}

function buildLinesDaValidare(lavoriDocs, oreByLavoroId, ctx) {
  const { usersById, terrenoById, macchineMetaById, macchineCostoById } = ctx || {};
  /** @type {Array<object>} */
  const lines = [];
  let oreDaValidare = 0;

  for (const lav of lavoriDocs || []) {
    const id = lav && lav.id;
    if (!id) continue;
    const lavData = typeof lav.data === 'function' ? lav.data() : lav;
    if (!lavData) continue;
    const entry = oreByLavoroId.get(id) || { oreDocs: [] };
    const metaT = terrenoMeta(terrenoById, lavData.terrenoId);
    const dataIso = dataIsoFromAny(lavData.dataInizio || lavData.data);

    for (const oraDoc of entry.oreDocs || []) {
      const ora = typeof oraDoc.data === 'function' ? oraDoc.data() : oraDoc;
      if (!ora || ora.stato !== 'da_validare') continue;
      const oreMac = Number(ora.oreMacchina) || 0;
      if (oreMac <= 0) continue;
      /** @type {Record<string, number>} */
      const perMezzo = {};
      bumpOreMacchinaPerMezzo(perMezzo, ora);
      const operaioId = ora.operaioId ? String(ora.operaioId) : null;
      const user = operaioId && usersById ? usersById.get(operaioId) : null;

      for (const [mid, ore] of Object.entries(perMezzo)) {
        oreDaValidare += ore;
        const meta = macchineMetaById.get(String(mid)) || {};
        lines.push({
          ...buildMacchinaCostLine({
            macchinaId: mid,
            nome: macchinaLabel(meta, mid),
            tipoMezzo: meta.tipoMacchina || meta.tipo || '',
            ore,
            ...metaT,
            dataIso,
            tipoLavoro: lavData.tipoLavoro || '',
            lavoroId: String(id),
            operaioId,
            operaioNome: operaioId ? displayNameUser(user, operaioId) : null,
            origine: 'lavoro'
          }, macchineCostoById || new Map(), macchineMetaById || new Map()),
          stato: 'da_validare',
          costo: null,
          costoOraMissing: true,
          costoOra: null
        });
      }
    }
  }
  return { lines, oreDaValidare: euro(oreDaValidare) || 0 };
}

/**
 * Diario proprietario con ore macchina (anti-doppio chiave lavoro come Economici).
 */
function buildLinesFromAttivita(attivitaDocs, lavoriInRange, terrenoById, macchineCostoById, macchineMetaById) {
  const chiavi = new Set();
  for (const lav of lavoriInRange || []) {
    if (!lav || !lav.terrenoId) continue;
    chiavi.add(chiaveLavoroDiario(
      lav.terrenoId,
      dataIsoFromAny(lav.dataInizio || lav.data),
      lav.tipoLavoro || ''
    ));
  }

  /** @type {import('./report-macchine-aggregate.js').MacchineLine[]} */
  const lines = [];
  for (const a of attivitaDocs || []) {
    if (!a || a.lavoroId || a.clienteId) continue;
    if (!a.terrenoId || !terrenoById.has(String(a.terrenoId))) continue;
    const dataIso = dataIsoFromAny(a.data);
    const tipoLavoro = a.tipoLavoro || '';
    if (chiavi.has(chiaveLavoroDiario(a.terrenoId, dataIso, tipoLavoro))) continue;

    const perMezzo = oreMacchinaMapFromAttivita(a);
    const metaT = terrenoMeta(terrenoById, a.terrenoId);
    for (const [mid, ore] of Object.entries(perMezzo)) {
      if (!(ore > 0)) continue;
      const meta = macchineMetaById.get(String(mid)) || {};
      lines.push(buildMacchinaCostLine({
        macchinaId: mid,
        nome: macchinaLabel(meta, mid),
        tipoMezzo: meta.tipoMacchina || meta.tipo || '',
        ore,
        ...metaT,
        dataIso,
        tipoLavoro,
        lavoroId: null,
        attivitaId: a.id ? String(a.id) : null,
        operaioId: null,
        operaioNome: 'Proprietario (diario)',
        origine: 'diario'
      }, macchineCostoById, macchineMetaById));
    }
  }
  return lines;
}

/**
 * Costi per lavoro/attività nello stesso formato Economici (per allineamento totale).
 */
function buildEconomiciAlignedMacchineCosts(lavoriInRange, oreByLavoroId, attivitaDocs, ctx) {
  const { macchineCostoById, macchineNomiById, hasParco, terrenoById } = ctx;
  const lavoriCosti = (lavoriInRange || []).map((lav) => {
    const entry = oreByLavoroId.get(lav.id) || { oreDocs: [] };
    /** @type {Record<string, number>} */
    const oreMacchinaPerId = {};
    for (const oraDoc of entry.oreDocs || []) {
      const ora = typeof oraDoc.data === 'function' ? oraDoc.data() : oraDoc;
      if (!ora || ora.stato !== 'validate') continue;
      bumpOreMacchinaPerMezzo(oreMacchinaPerId, ora);
    }
    const mac = costiMacchineFromOreMap(oreMacchinaPerId, macchineCostoById, macchineNomiById, {
      tipo: lav.tipoLavoro || 'Lavoro',
      dataIso: dataIsoFromAny(lav.dataInizio || lav.data),
      origine: 'lavoro',
      hasParco
    });
    return {
      terrenoId: lav.terrenoId,
      dataIso: dataIsoFromAny(lav.dataInizio || lav.data),
      tipoLavoro: lav.tipoLavoro || '',
      costoMacchine: mac.costoMacchine,
      missingMacchine: mac.missingMacchine
    };
  });

  const attivitaCosti = (attivitaDocs || [])
    .filter((a) => a && !a.lavoroId && !a.clienteId && a.terrenoId && terrenoById.has(String(a.terrenoId)))
    .map((a) => {
      const oreMacchinaPerId = oreMacchinaMapFromAttivita(a);
      const mac = costiMacchineFromOreMap(oreMacchinaPerId, macchineCostoById, macchineNomiById, {
        tipo: a.tipoLavoro || 'Diario',
        dataIso: dataIsoFromAny(a.data),
        origine: 'diario',
        hasParco
      });
      return {
        terrenoId: a.terrenoId,
        dataIso: dataIsoFromAny(a.data),
        tipoLavoro: a.tipoLavoro || '',
        lavoroId: a.lavoroId || null,
        clienteId: a.clienteId || null,
        costoMacchine: mac.costoMacchine,
        missingMacchine: mac.missingMacchine
      };
    });

  return { lavoriCosti, attivitaCosti, totale: sumCostoMacchineLikeEconomici(lavoriCosti, attivitaCosti) };
}

async function loadMacchinePack() {
  /** @type {Map<string, number>} */
  const costoById = new Map();
  /** @type {Map<string, string>} */
  const nomiById = new Map();
  /** @type {Map<string, object>} */
  const metaById = new Map();
  try {
    const { getAllMacchine } = await import('../../parco-macchine/services/macchine-service.js');
    const list = await getAllMacchine();
    for (const m of list || []) {
      if (!m || !m.id) continue;
      const id = String(m.id);
      costoById.set(id, m.costoOra != null ? Number(m.costoOra) : 0);
      nomiById.set(id, macchinaLabel(m, id));
      metaById.set(id, m);
    }
  } catch (e) {
    console.warn('[report-macchine] macchine', e && e.message);
  }
  return { costoById, nomiById, metaById };
}

async function loadUsciteMagazzinoInRange(start, end) {
  const t0 = dateToTimestamp(start);
  const t1 = dateToTimestamp(end);
  const tenantId = getCurrentTenantId();
  try {
    const docs = await getCollectionData('movimentiMagazzino', {
      tenantId,
      where: [
        ['tipo', '==', 'uscita'],
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
      const all = await getAllMovimenti({ tipo: 'uscita' }).catch(() => []);
      return (all || []).filter((m) => m && inRange(m.data, start, end));
    } catch (e) {
      console.warn('[report-macchine] magazzino', e && e.message);
      return [];
    }
  }
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {{ forceReload?: boolean }} [opts]
 */
export async function loadMacchinePeriodBundle(start, end, opts = {}) {
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
  const hasParco = mods.has('parcomacchine') || mods.has('parco-macchine') || mods.has('manodopera');
  const hasMagazzino = mods.has('magazzino');

  let t0 = now();
  const [terreniRaw, lavoriRaw, attivitaDocs, macchinePack] = await Promise.all([
    getCollectionData('terreni', { tenantId }).catch(() => []),
    loadLavoriInRange(tenantId, start, end, { logPrefix: '[report-macchine]' }),
    loadAttivitaInRange(tenantId, start, end, { logPrefix: '[report-macchine]' }),
    loadMacchinePack()
  ]);
  timePhase(timings, 'terreni_lavori_attivita_macchine', now() - t0);

  const terreni = (terreniRaw || []).filter((t) => !t.clienteId || String(t.clienteId).trim() === '');
  const terrenoById = new Map(terreni.map((t) => [String(t.id), t]));
  const macchineCostoById = macchinePack.costoById;
  const macchineNomiById = macchinePack.nomiById;
  const macchineMetaById = macchinePack.metaById;

  const lavoriInRange = (lavoriRaw || []).filter((l) => {
    if (!l || l.stato !== 'completato') return false;
    if (l.clienteId && String(l.clienteId).trim()) return false;
    if (!l.terrenoId || !terrenoById.has(String(l.terrenoId))) return false;
    return inRange(l.dataInizio || l.data, start, end);
  });

  const lavoriPerDaValidare = (lavoriRaw || []).filter((l) => {
    if (!l) return false;
    if (l.clienteId && String(l.clienteId).trim()) return false;
    return inRange(l.dataInizio || l.data, start, end);
  });

  const db = getDb();
  const lavoriDocsCompletati = lavoriInRange.map((l) => ({ id: l.id, data: () => l }));
  const lavoriDocsDaValidareExtra = lavoriPerDaValidare
    .filter((l) => !lavoriInRange.some((c) => String(c.id) === String(l.id)))
    .map((l) => ({ id: l.id, data: () => l }));
  const lavoriDocsOre = [...lavoriDocsCompletati, ...lavoriDocsDaValidareExtra];

  t0 = now();
  const oreByLavoroId = db
    ? await fetchOreOperaiForLavori(
      tenantId,
      lavoriDocsOre,
      { db, collection, getDocs, query, where },
      { statoFilter: null }
    )
    : new Map();
  timePhase(timings, 'oreOperai', now() - t0);

  const userIds = [];
  oreByLavoroId.forEach((entry) => {
    for (const oraDoc of entry.oreDocs || []) {
      const ora = typeof oraDoc.data === 'function' ? oraDoc.data() : oraDoc;
      if (ora && ora.operaioId) userIds.push(String(ora.operaioId));
    }
  });
  t0 = now();
  const usersById = db
    ? await fetchUsersByIds(userIds, { db, doc, getDoc })
    : new Map();
  timePhase(timings, 'utenti', now() - t0);

  const lineCtx = {
    usersById,
    terrenoById,
    macchineCostoById,
    macchineMetaById
  };
  const oreLines = buildLinesFromOre(lavoriInRange, oreByLavoroId, lineCtx);
  const daValidare = buildLinesDaValidare(lavoriDocsOre, oreByLavoroId, lineCtx);
  const diarioLines = buildLinesFromAttivita(
    attivitaDocs,
    lavoriInRange,
    terrenoById,
    macchineCostoById,
    macchineMetaById
  );
  const lines = [...oreLines, ...diarioLines];

  const aligned = buildEconomiciAlignedMacchineCosts(
    lavoriInRange,
    oreByLavoroId,
    attivitaDocs,
    {
      macchineCostoById,
      macchineNomiById,
      hasParco,
      terrenoById
    }
  );

  t0 = now();
  let movimenti = [];
  /** @type {Map<string, object>} */
  let prodottiById = new Map();
  if (hasMagazzino) {
    movimenti = await loadUsciteMagazzinoInRange(start, end);
    try {
      const prodotti = await getCollectionData('prodotti', { tenantId }).catch(() => []);
      prodottiById = new Map((prodotti || []).map((p) => [String(p.id), p]));
    } catch (_) { /* ignore */ }
  }
  const carburanteByMacchinaId = aggregateCarburantePienoByMacchina(movimenti, prodottiById, { start, end });
  timePhase(timings, 'carburante', now() - t0);

  t0 = now();
  let guastiRaw = [];
  try {
    guastiRaw = await getCollectionData('guasti', { tenantId }).catch(() => []);
  } catch (e) {
    console.warn('[report-macchine] guasti', e && e.message);
  }
  const guastiByMacchinaId = aggregateGuastiByMacchina(guastiRaw || [], { start, end });
  timePhase(timings, 'guasti', now() - t0);

  const mezziOptsMap = new Map();
  for (const l of lines) {
    if (!l || !l.macchinaId) continue;
    mezziOptsMap.set(l.macchinaId, {
      id: l.macchinaId,
      nome: l.nome,
      tipoMezzo: l.tipoMezzo || ''
    });
  }
  for (const [id, meta] of macchineMetaById) {
    if (!mezziOptsMap.has(id)) {
      mezziOptsMap.set(id, {
        id,
        nome: macchinaLabel(meta, id),
        tipoMezzo: meta.tipoMacchina || meta.tipo || ''
      });
    }
  }

  const data = {
    lines,
    linesDaValidare: daValidare.lines,
    oreDaValidare: daValidare.oreDaValidare,
    macchineMetaById,
    carburanteByMacchinaId,
    guastiByMacchinaId,
    costoMacchineEconomiciAligned: aligned.totale,
    terreni: terreni.map((t) => ({
      id: t.id,
      nome: t.nome || t.podere || t.id
    })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it')),
    mezziOptions: [...mezziOptsMap.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it')),
    timings,
    start,
    end,
    ready: true
  };

  periodBundleCache = { key, data };
  return data;
}

export function clearMacchinePeriodCache() {
  periodBundleCache = null;
}

export function assembleMacchineFromBundle(bundle, filters = {}) {
  if (!bundle || !bundle.ready) {
    return {
      byMezzo: [],
      byTipo: [],
      chartCosto: [],
      chartMensile: [],
      lines: [],
      kpi: {
        oreTotali: 0,
        costoTotale: null,
        partialCosto: false,
        litriTotali: 0,
        guastiAperti: 0,
        nMezzi: 0
      },
      notes: [],
      oreDaValidare: 0,
      empty: true,
      ready: false
    };
  }
  return assembleMacchineReport({
    lines: bundle.lines,
    linesDaValidare: bundle.linesDaValidare || [],
    macchineMetaById: bundle.macchineMetaById,
    carburanteByMacchinaId: bundle.carburanteByMacchinaId,
    guastiByMacchinaId: bundle.guastiByMacchinaId,
    costoMacchineEconomiciAligned: bundle.costoMacchineEconomiciAligned
  }, filters);
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {{ terrenoId?: string|null, macchinaId?: string|null, tipoMezzo?: string|null, forceReload?: boolean }} [filters]
 */
export async function buildReportMacchine(start, end, filters = {}) {
  const bundle = await loadMacchinePeriodBundle(start, end, {
    forceReload: filters.forceReload
  });
  return assembleMacchineFromBundle(bundle, {
    terrenoId: filters.terrenoId,
    macchinaId: filters.macchinaId,
    tipoMezzo: filters.tipoMezzo
  });
}

export {
  assembleMacchineReport,
  aggregateByMezzo,
  aggregateByTipoMezzo,
  aggregateMacchineCostoForChart,
  aggregateMonthlyOreMacchina,
  aggregateCarburantePienoByMacchina,
  aggregateGuastiByMacchina,
  buildMezzoDetailRows,
  buildMacchinaCostLine,
  formatEuroPrefixCompact,
  isMacchineDataReady,
  labelTipoMezzo,
  prepareMacchineExportData,
  sumCostoMacchineLikeEconomici,
  ettariLavoratiFromLines
} from './report-macchine-aggregate.js';

export {
  bumpOreMacchinaPerMezzo,
  costiMacchineFromOreMap,
  manutenzioneStatus,
  resolveCostoOraMacchina
} from './report-macchine-shared.js';

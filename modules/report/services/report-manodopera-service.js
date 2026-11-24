/**
 * Report Manodopera — caricamento fonti + assemblaggio.
 * Riusa loader ore/lavori e tariffe condivise con Economici (niente duplicazione logica).
 *
 * @module modules/report/services/report-manodopera-service
 */

import {
  getCollectionData,
  getDb,
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { fetchOreOperaiForLavori, fetchUsersByIds } from '../../../core/services/manodopera-lavori-ore-loader.js';
import {
  dataIsoFromAny,
  euro,
  formatLocalIsoDate,
  inRange
} from './report-economici-aggregate.js';
import {
  displayNameUser,
  loadAttivitaInRange,
  loadLavoriInRange,
  loadTariffe,
  resolveTariffaOperaioWithMissing
} from './report-labour-shared.js';
import {
  assembleManodoperaReport,
  buildChiaviLavoroDiario,
  buildProprietarioLines,
  isManodoperaDataReady,
  prepareManodoperaExportData,
  sumCostoManodoperaLines,
  PROPRIETARIO_ID,
  PROPRIETARIO_NOME,
  PROPRIETARIO_TIPO
} from './report-manodopera-aggregate.js';

/** @type {{ key: string, data: object }|null} */
let periodBundleCache = null;

function periodKey(start, end) {
  return `${formatLocalIsoDate(start)}|${formatLocalIsoDate(end)}`;
}

function timePhase(timings, name, ms) {
  timings[name] = Math.round(ms);
  if (typeof console !== 'undefined' && console.info) {
    console.info(`[report-manodopera] ${name}: ${Math.round(ms)} ms`);
  }
}

function terrenoMeta(terrenoById, terrenoId) {
  const t = terrenoId ? terrenoById.get(String(terrenoId)) : null;
  return {
    terrenoId: terrenoId ? String(terrenoId) : null,
    terrenoNome: t
      ? (t.nome || t.podere || terrenoId)
      : (terrenoId || '—'),
    ettari: t && t.stato !== 'archiviato' && t.superficie != null
      ? Number(t.superficie)
      : (t && t.superficie != null ? Number(t.superficie) : null)
  };
}

/**
 * Solo ore validate → linee di costo. Il conteggio da_validare è separato
 * (può includere lavori non ancora completati).
 */
function buildLinesFromOre(lavoriInRange, oreByLavoroId, ctx) {
  const {
    usersById,
    tariffeOperai,
    terrenoById
  } = ctx;

  /** @type {import('./report-manodopera-aggregate.js').ManodoperaLine[]} */
  const lines = [];

  for (const lav of lavoriInRange || []) {
    const entry = oreByLavoroId.get(lav.id) || { oreDocs: [] };
    const metaT = terrenoMeta(terrenoById, lav.terrenoId);
    const caposquadraId = lav.caposquadraId ? String(lav.caposquadraId) : null;
    const capoUser = caposquadraId ? usersById.get(caposquadraId) : null;
    const caposquadraNome = caposquadraId
      ? displayNameUser(capoUser, caposquadraId)
      : null;
    const dataIso = dataIsoFromAny(lav.dataInizio || lav.data);
    const tipoLavoro = lav.tipoLavoro || '';

    for (const oraDoc of entry.oreDocs || []) {
      const ora = typeof oraDoc.data === 'function' ? oraDoc.data() : oraDoc;
      if (!ora) continue;
      const oreNette = Number(ora.oreNette) || 0;
      if (oreNette <= 0) continue;
      if (ora.stato !== 'validate') continue;

      const operaioId = ora.operaioId ? String(ora.operaioId) : '';
      if (!operaioId) continue;
      const user = usersById.get(operaioId);
      const resolved = resolveTariffaOperaioWithMissing(tariffeOperai, user);
      const missing = resolved.missing || !user;
      const costo = missing ? null : euro(oreNette * resolved.tariffa);

      lines.push({
        operaioId,
        nome: displayNameUser(user, operaioId),
        tipo: (user && user.tipoOperaio) || '',
        isProprietario: false,
        ore: oreNette,
        tariffa: missing ? null : resolved.tariffa,
        tariffaMissing: missing,
        costo,
        ...metaT,
        dataIso,
        tipoLavoro,
        lavoroId: lav.id ? String(lav.id) : null,
        caposquadraId,
        caposquadraNome
      });
    }
  }

  return lines;
}

/**
 * Ore ancora da validare nel periodo (lavori in range, anche non completati).
 * Linee leggere (ore + filtri + data) per grafico mensile — stessa lettura ore già in cache.
 */
function buildLinesDaValidare(lavoriDocs, oreByLavoroId, ctx) {
  const { usersById, terrenoById } = ctx || {};
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
    const caposquadraId = lavData.caposquadraId ? String(lavData.caposquadraId) : null;
    const capoUser = caposquadraId && usersById ? usersById.get(caposquadraId) : null;
    const dataIso = dataIsoFromAny(lavData.dataInizio || lavData.data);

    for (const oraDoc of entry.oreDocs || []) {
      const ora = typeof oraDoc.data === 'function' ? oraDoc.data() : oraDoc;
      if (!ora || ora.stato !== 'da_validare') continue;
      const oreNette = Number(ora.oreNette) || 0;
      if (oreNette <= 0) continue;
      oreDaValidare += oreNette;
      const operaioId = ora.operaioId ? String(ora.operaioId) : '';
      const user = operaioId && usersById ? usersById.get(operaioId) : null;
      lines.push({
        operaioId: operaioId || null,
        nome: operaioId ? displayNameUser(user, operaioId) : '—',
        tipo: (user && user.tipoOperaio) || '',
        isProprietario: false,
        ore: oreNette,
        tariffa: null,
        tariffaMissing: true,
        costo: null,
        ...metaT,
        dataIso,
        tipoLavoro: lavData.tipoLavoro || '',
        lavoroId: String(id),
        caposquadraId,
        caposquadraNome: caposquadraId
          ? displayNameUser(capoUser, caposquadraId)
          : null,
        stato: 'da_validare'
      });
    }
  }

  return { lines, oreDaValidare: euro(oreDaValidare) || 0 };
}

/**
 * Fallback Economici: lavori senza oreOperai ma con attività collegate → ore proprietario.
 */
function buildProprietarioFromLinkedAttivita(lavoriInRange, oreByLavoroId, attivitaDocs, terrenoById, tariffe) {
  /** @type {import('./report-manodopera-aggregate.js').ManodoperaLine[]} */
  const lines = [];
  const configured = !!tariffe.tariffaProprietarioConfigurata;
  const tariffa = Number(tariffe.tariffaProprietario) || 0;

  for (const lav of lavoriInRange || []) {
    const entry = oreByLavoroId.get(lav.id) || { oreDocs: [] };
    let oreValidate = 0;
    for (const oraDoc of entry.oreDocs || []) {
      const ora = typeof oraDoc.data === 'function' ? oraDoc.data() : oraDoc;
      if (ora && ora.stato === 'validate') oreValidate += Number(ora.oreNette) || 0;
    }
    if (oreValidate > 0) continue;

    const linked = (attivitaDocs || []).filter((a) => a && String(a.lavoroId || '') === String(lav.id));
    let ore = 0;
    for (const a of linked) ore += Number(a.oreNette) || 0;
    if (ore <= 0) continue;

    const metaT = terrenoMeta(terrenoById, lav.terrenoId);
    const missing = !configured;
    lines.push({
      operaioId: PROPRIETARIO_ID,
      nome: PROPRIETARIO_NOME,
      tipo: PROPRIETARIO_TIPO,
      isProprietario: true,
      ore,
      tariffa: missing ? null : tariffa,
      tariffaMissing: missing,
      costo: missing ? null : euro(ore * tariffa),
      ...metaT,
      dataIso: dataIsoFromAny(lav.dataInizio || lav.data),
      tipoLavoro: lav.tipoLavoro || '',
      lavoroId: lav.id ? String(lav.id) : null,
      attivitaId: null,
      caposquadraId: lav.caposquadraId ? String(lav.caposquadraId) : null,
      caposquadraNome: null,
      fromLinkedAttivita: true
    });
  }
  return lines;
}

/**
 * Carica (o riusa) il bundle grezzo del periodo.
 * @param {Date} start
 * @param {Date} end
 * @param {{ forceReload?: boolean }} [opts]
 */
export async function loadManodoperaPeriodBundle(start, end, opts = {}) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant non disponibile');

  const key = periodKey(start, end);
  if (!opts.forceReload && periodBundleCache && periodBundleCache.key === key) {
    return periodBundleCache.data;
  }

  const timings = {};
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  let t0 = now();
  const [terreniRaw, lavoriRaw, attivitaDocs, tariffe] = await Promise.all([
    getCollectionData('terreni', { tenantId }).catch(() => []),
    loadLavoriInRange(tenantId, start, end, { logPrefix: '[report-manodopera]' }),
    loadAttivitaInRange(tenantId, start, end, { logPrefix: '[report-manodopera]' }),
    loadTariffe(tenantId)
  ]);
  timePhase(timings, 'terreni_lavori_attivita_tariffe', now() - t0);

  const terreni = (terreniRaw || []).filter((t) => !t.clienteId || String(t.clienteId).trim() === '');
  const terrenoById = new Map(terreni.map((t) => [String(t.id), t]));

  const lavoriInRange = (lavoriRaw || []).filter((l) => {
    if (!l || l.stato !== 'completato') return false;
    if (l.clienteId && String(l.clienteId).trim()) return false;
    if (!l.terrenoId || !terrenoById.has(String(l.terrenoId))) return false;
    return inRange(l.dataInizio || l.data, start, end);
  });

  // Per la nota «ore da validare»: anche lavori non completati nel periodo (stesso range data).
  const lavoriPerDaValidare = (lavoriRaw || []).filter((l) => {
    if (!l) return false;
    if (l.clienteId && String(l.clienteId).trim()) return false;
    return inRange(l.dataInizio || l.data, start, end);
  });

  const db = getDb();
  const lavoriDocsCompletati = lavoriInRange.map((l) => ({
    id: l.id,
    data: () => l
  }));
  const lavoriDocsDaValidareExtra = lavoriPerDaValidare
    .filter((l) => !lavoriInRange.some((c) => String(c.id) === String(l.id)))
    .map((l) => ({ id: l.id, data: () => l }));
  const lavoriDocsOre = [...lavoriDocsCompletati, ...lavoriDocsDaValidareExtra];

  // Stesso loader di Economici. Senza statoFilter: validate → costi; da_validare → nota.
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
  for (const lav of lavoriInRange) {
    if (lav.caposquadraId) userIds.push(String(lav.caposquadraId));
    if (lav.operaioId) userIds.push(String(lav.operaioId));
  }

  t0 = now();
  const usersById = db
    ? await fetchUsersByIds(userIds, { db, doc, getDoc })
    : new Map();
  timePhase(timings, 'utenti', now() - t0);

  const oreLines = buildLinesFromOre(lavoriInRange, oreByLavoroId, {
    usersById,
    tariffeOperai: tariffe.tariffeOperai,
    terrenoById
  });
  const daValidare = buildLinesDaValidare(lavoriDocsOre, oreByLavoroId, {
    usersById,
    terrenoById
  });
  const linesDaValidare = daValidare.lines;
  const oreDaValidare = daValidare.oreDaValidare;

  // Stesso anti-doppio di Economici: diario diretto se già coperto da un lavoro completato.
  const chiaviLavoro = buildChiaviLavoroDiario(lavoriInRange);
  const propLines = buildProprietarioLines(attivitaDocs, terrenoById, tariffe, chiaviLavoro);
  const linkedProp = buildProprietarioFromLinkedAttivita(
    lavoriInRange,
    oreByLavoroId,
    attivitaDocs,
    terrenoById,
    tariffe
  );

  const lines = [...oreLines, ...propLines, ...linkedProp];
  const hasCaposquadraData = lines.some((l) => l && l.caposquadraId);
  const costoManodoperaTotale = sumCostoManodoperaLines(lines);

  /** Opzioni filtro UI derivate dal periodo */
  const operaiOptsMap = new Map();
  const capiOptsMap = new Map();
  for (const l of lines) {
    if (!l) continue;
    if (l.isProprietario) {
      operaiOptsMap.set(PROPRIETARIO_ID, { id: PROPRIETARIO_ID, nome: PROPRIETARIO_NOME });
    } else if (l.operaioId) {
      operaiOptsMap.set(l.operaioId, { id: l.operaioId, nome: l.nome });
    }
    if (l.caposquadraId) {
      capiOptsMap.set(l.caposquadraId, {
        id: l.caposquadraId,
        nome: l.caposquadraNome || l.caposquadraId
      });
    }
  }

  const data = {
    lines,
    linesDaValidare,
    oreDaValidare,
    hasCaposquadraData,
    costoManodoperaTotale,
    terreni: terreni.map((t) => ({
      id: t.id,
      nome: t.nome || t.podere || t.id
    })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it')),
    operaiOptions: [...operaiOptsMap.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it')),
    caposquadraOptions: [...capiOptsMap.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it')),
    timings,
    start,
    end,
    ready: true
  };

  periodBundleCache = { key, data };
  return data;
}

export function clearManodoperaPeriodCache() {
  periodBundleCache = null;
}

export function assembleManodoperaFromBundle(bundle, filters = {}) {
  if (!bundle || !bundle.ready) {
    return {
      byOperaio: [],
      byCaposquadra: [],
      byTerreno: [],
      byTipo: [],
      chartTerreno: [],
      chartMensile: [],
      lines: [],
      kpi: {
        oreTotali: 0,
        costoTotale: null,
        partialCosto: false,
        nOperai: 0,
        nPersone: 0,
        euroOraMedio: null,
        partialEuroOra: false
      },
      notes: [],
      oreDaValidare: 0,
      hasCaposquadraData: false,
      empty: true,
      ready: false
    };
  }
  return assembleManodoperaReport({
    lines: bundle.lines,
    linesDaValidare: bundle.linesDaValidare || [],
    oreDaValidare: bundle.oreDaValidare,
    hasCaposquadraData: bundle.hasCaposquadraData
  }, filters);
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {{ terrenoId?: string|null, operaioId?: string|null, caposquadraId?: string|null, forceReload?: boolean }} [filters]
 */
export async function buildReportManodopera(start, end, filters = {}) {
  const bundle = await loadManodoperaPeriodBundle(start, end, {
    forceReload: filters.forceReload
  });
  return assembleManodoperaFromBundle(bundle, {
    terrenoId: filters.terrenoId,
    operaioId: filters.operaioId,
    caposquadraId: filters.caposquadraId
  });
}

export async function getManodoperaFilterOptions() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant non disponibile');
  const terreniRaw = await getCollectionData('terreni', { tenantId }).catch(() => []);
  const terreni = (terreniRaw || [])
    .filter((t) => !t.clienteId || String(t.clienteId).trim() === '')
    .map((t) => ({
      id: t.id,
      nome: t.nome || t.podere || t.id
    }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));
  return { terreni };
}

export {
  assembleManodoperaReport,
  aggregateByTipoOperaio,
  aggregateManodoperaTerrenoForChart,
  aggregateMonthlyOreValidateDaValidare,
  buildOperaioDetailRows,
  buildChiaviLavoroDiario,
  buildProprietarioLines,
  formatEuroPrefixCompact,
  isManodoperaDataReady,
  labelTipoOperaio,
  prepareManodoperaExportData,
  sumCostoManodoperaLines,
  PROPRIETARIO_ID,
  PROPRIETARIO_NOME
};

export {
  resolveTariffaOperaio,
  loadTariffe,
  loadLavoriInRange,
  loadAttivitaInRange
} from './report-labour-shared.js';

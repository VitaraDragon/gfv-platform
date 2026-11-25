/**
 * Report Conto terzi — caricamento fonti + assemblaggio.
 * Solo lettura: lavori/attività con clienteId, preventivi, clienti, ore, magazzino.
 * Non modifica Economici (che continua a escludere clienteId).
 *
 * @module modules/report/services/report-conto-terzi-service
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
  formatLocalIsoDate,
  inRange,
  dataIsoFromAny,
  dataIsoInRange
} from './report-economici-aggregate.js';
import {
  loadAttivitaInRange,
  loadLavoriInRange,
  loadTariffe
} from './report-labour-shared.js';
import {
  costiMacchineFromOreMap,
  oreMacchinaMapFromAttivita
} from './report-macchine-shared.js';
import { costiFromOreBundle } from './report-economici-service.js';
import {
  assembleContoTerziReport,
  prepareContoTerziExportData,
  isContoTerziDataReady,
  buildClienteDetailRows,
  formatEuroPrefixCompact,
  labelStatoPreventivo
} from './report-conto-terzi-aggregate.js';

/** @type {{ key: string, data: object }|null} */
let periodBundleCache = null;

function periodKey(start, end) {
  return `${formatLocalIsoDate(start)}|${formatLocalIsoDate(end)}`;
}

function timePhase(timings, name, ms) {
  timings[name] = Math.round(ms);
  if (typeof console !== 'undefined' && console.info) {
    console.info(`[report-conto-terzi] ${name}: ${Math.round(ms)} ms`);
  }
}

async function loadMacchineMap(hasParco) {
  /** @type {Map<string, number>} */
  const map = new Map();
  /** @type {Map<string, string>} */
  const nomi = new Map();
  if (!hasParco) return { map, nomi };
  try {
    const { getAllMacchine } = await import('../../parco-macchine/services/macchine-service.js');
    const list = await getAllMacchine();
    for (const m of list || []) {
      if (!m || !m.id) continue;
      map.set(String(m.id), m.costoOra != null ? Number(m.costoOra) : 0);
      const label = (m.nome || m.targa || m.modello || m.id || '').toString();
      nomi.set(String(m.id), label);
    }
  } catch (e) {
    console.warn('[report-conto-terzi] macchine', e && e.message);
  }
  return { map, nomi };
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
      console.warn('[report-conto-terzi] movimenti', e && e.message);
      return [];
    }
  }
}

/**
 * Preventivo nel periodo se dataInvio / dataPrevista / dataAccettazione / createdAt cade nel range.
 * @param {object} p
 * @param {Date} start
 * @param {Date} end
 */
function preventivoInRange(p, start, end) {
  if (!p) return false;
  const candidates = [p.dataInvio, p.dataPrevista, p.dataAccettazione, p.createdAt, p.data];
  for (const c of candidates) {
    if (c == null) continue;
    if (inRange(c, start, end) || dataIsoInRange(c, start, end)) return true;
  }
  return false;
}

/**
 * Costo attività CT (diario) senza lavoroId — tariffa proprietario + macchine da attività.
 */
function costiAttivitaCt(att, ctx) {
  const {
    macchineById,
    macchineNomiById,
    hasParco,
    tariffaProprietario,
    tariffaProprietarioConfigurata
  } = ctx;
  const ore = Number(att.oreNette) || 0;
  /** @type {string[]} */
  const notes = [];
  let missingManodopera = false;
  let costoManodopera = 0;

  if (ore > 0) {
    if (!tariffaProprietarioConfigurata) {
      missingManodopera = true;
      notes.push('Tariffa oraria non impostata');
    } else {
      costoManodopera = ore * Number(tariffaProprietario || 0);
    }
  }

  const oreMacchinaPerId = oreMacchinaMapFromAttivita(att);
  const mac = costiMacchineFromOreMap(oreMacchinaPerId, macchineById, macchineNomiById, {
    tipo: att.tipoLavoro || 'Diario CT',
    dataIso: dataIsoFromAny(att.data),
    origine: 'diario',
    hasParco
  });
  for (const n of mac.notes) notes.push(n);

  return {
    ore: ore || 0,
    costoManodopera: missingManodopera ? null : costoManodopera,
    costoMacchine: mac.costoMacchine,
    missingManodopera,
    missingMacchine: mac.missingMacchine,
    notes: [...new Set(notes)]
  };
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {{ forceReload?: boolean }} [opts]
 */
export async function loadContoTerziPeriodBundle(start, end, opts = {}) {
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
  if (!mods.has('contoterzi')) {
    const empty = {
      lavori: [],
      costiByLavoroId: new Map(),
      preventivi: [],
      clienti: [],
      terreni: [],
      movimenti: [],
      prodotti: [],
      timings: { skipped: 1 },
      ready: true
    };
    periodBundleCache = { key, data: empty };
    return empty;
  }

  let t0 = now();
  const [terreniRaw, lavoriRaw, attivitaDocs, tariffe, clienti] = await Promise.all([
    getCollectionData('terreni', { tenantId }).catch(() => []),
    loadLavoriInRange(tenantId, start, end, { logPrefix: '[report-conto-terzi]' }),
    loadAttivitaInRange(tenantId, start, end, { logPrefix: '[report-conto-terzi]' }),
    loadTariffe(tenantId),
    (async () => {
      try {
        const { getAllClienti } = await import('../../conto-terzi/services/clienti-service.js');
        return await getAllClienti({}).catch(() => []) || [];
      } catch (_) {
        return await getCollectionData('clienti', { tenantId }).catch(() => []) || [];
      }
    })()
  ]);
  timePhase(timings, 'base', now() - t0);

  t0 = now();
  let preventiviAll = [];
  try {
    const { getAllPreventivi } = await import('../../conto-terzi/services/preventivi-service.js');
    preventiviAll = await getAllPreventivi({}).catch(() => []) || [];
  } catch (_) {
    preventiviAll = await getCollectionData('preventivi', { tenantId }).catch(() => []) || [];
  }
  const preventivi = (preventiviAll || []).filter((p) => preventivoInRange(p, start, end));
  timePhase(timings, 'preventivi', now() - t0);

  // Lavori CT nel periodo (invertito rispetto a Economici): con clienteId, non annullati
  const lavoriCt = (lavoriRaw || []).filter((l) => {
    if (!l || !l.clienteId || !String(l.clienteId).trim()) return false;
    if (l.stato === 'annullato') return false;
    return inRange(l.dataInizio || l.data, start, end);
  });

  // Attività CT senza lavoroId (diario conto terzi)
  const attivitaCt = (attivitaDocs || []).filter((a) => {
    if (!a || !a.clienteId || !String(a.clienteId).trim()) return false;
    if (a.lavoroId) return false;
    return true;
  });

  const terreni = terreniRaw || [];

  const hasParco = mods.has('parcomacchine') || mods.has('parco-macchine');
  const hasMagazzino = mods.has('magazzino');

  t0 = now();
  const { map: macchineById, nomi: macchineNomiById } = await loadMacchineMap(hasParco);
  timePhase(timings, 'macchine', now() - t0);

  const db = getDb();
  const lavoriDocs = lavoriCt.map((l) => ({ id: l.id, data: () => l }));

  t0 = now();
  const oreByLavoroId = db && lavoriDocs.length
    ? await fetchOreOperaiForLavori(
      tenantId,
      lavoriDocs,
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

  let prodotti = [];
  let movimenti = [];
  if (hasMagazzino) {
    t0 = now();
    try {
      const { getAllProdotti } = await import('../../magazzino/services/prodotti-service.js');
      prodotti = await getAllProdotti().catch(() => []) || [];
    } catch (_) {
      prodotti = await getCollectionData('prodotti', { tenantId }).catch(() => []) || [];
    }
    movimenti = await loadMovimentiInRange(start, end);
    timePhase(timings, 'magazzino', now() - t0);
  }

  const costCtx = {
    usersById,
    tariffeOperai: tariffe.tariffeOperai,
    macchineById,
    macchineNomiById,
    hasParco,
    tariffaProprietario: tariffe.tariffaProprietario,
    tariffaProprietarioConfigurata: tariffe.tariffaProprietarioConfigurata
  };

  /** @type {Map<string, object>} */
  const costiByLavoroId = new Map();
  for (const lav of lavoriCt) {
    const entry = oreByLavoroId.get(String(lav.id)) || { oreDocs: [] };
    const c = costiFromOreBundle(lav, entry.oreDocs, costCtx);
    // fallback attività collegate se zero ore validate (come Economici)
    if ((c.ore || 0) === 0) {
      const linked = (attivitaDocs || []).filter((a) => a && String(a.lavoroId || '') === String(lav.id));
      let ore = 0;
      for (const a of linked) ore += Number(a.oreNette) || 0;
      if (ore > 0) {
        if (!tariffe.tariffaProprietarioConfigurata) {
          costiByLavoroId.set(String(lav.id), {
            ore,
            costoManodopera: null,
            costoMacchine: c.costoMacchine || 0,
            missingManodopera: true,
            missingMacchine: !!c.missingMacchine,
            notes: ['Tariffa oraria non impostata']
          });
          continue;
        }
        costiByLavoroId.set(String(lav.id), {
          ore,
          costoManodopera: ore * Number(tariffe.tariffaProprietario || 0),
          costoMacchine: c.costoMacchine || 0,
          missingManodopera: false,
          missingMacchine: !!c.missingMacchine,
          notes: c.notes || []
        });
        continue;
      }
    }
    costiByLavoroId.set(String(lav.id), {
      ore: c.ore || 0,
      costoManodopera: c.costoManodopera,
      costoMacchine: c.costoMacchine,
      missingManodopera: !!c.missingManodopera,
      missingMacchine: !!c.missingMacchine,
      notes: c.notes || []
    });
  }

  // Attività CT come “lavori” sintetici
  const lavoriFromAttivita = [];
  for (const a of attivitaCt) {
    const synthId = `attivita:${a.id}`;
    const c = costiAttivitaCt(a, costCtx);
    costiByLavoroId.set(synthId, c);
    lavoriFromAttivita.push({
      id: synthId,
      _kind: 'attivita',
      clienteId: a.clienteId,
      terrenoId: a.terrenoId || null,
      tipoLavoro: a.tipoLavoro || '',
      dataInizio: a.data,
      data: a.data,
      stato: 'completato',
      preventivoId: null,
      superficieTotaleLavorata: a.superficie != null ? Number(a.superficie) : 0
    });
  }

  const data = {
    lavori: [...lavoriCt, ...lavoriFromAttivita],
    costiByLavoroId,
    preventivi,
    clienti: clienti || [],
    terreni,
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
 * @param {{ clienteId?: string|null, tipoLavoro?: string|null, statoPreventivo?: string|null }} [filters]
 */
export function assembleContoTerziFromBundle(bundle, filters = {}) {
  if (!bundle || !bundle.ready) {
    return {
      lavori: [],
      byCliente: [],
      kpi: {
        ricavi: 0,
        partialRicavi: false,
        costi: 0,
        partialCosti: false,
        margine: 0,
        partialMargine: false,
        ettari: 0,
        nClienti: 0,
        nLavori: 0,
        preventiviInAttesa: 0,
        preventiviAccettati: 0,
        preventiviRifiutatiOScaduti: 0
      },
      chartRicaviClienti: [],
      chartMensile: [],
      notes: [],
      empty: true,
      ready: false
    };
  }
  return assembleContoTerziReport({
    lavori: bundle.lavori || [],
    costiByLavoroId: bundle.costiByLavoroId || new Map(),
    preventivi: bundle.preventivi || [],
    clienti: bundle.clienti || [],
    terreni: bundle.terreni || [],
    movimenti: bundle.movimenti || [],
    prodotti: bundle.prodotti || []
  }, filters);
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {{ clienteId?: string|null, tipoLavoro?: string|null, statoPreventivo?: string|null, forceReload?: boolean }} [filters]
 */
export async function buildReportContoTerzi(start, end, filters = {}) {
  const bundle = await loadContoTerziPeriodBundle(start, end, {
    forceReload: filters.forceReload
  });
  return assembleContoTerziFromBundle(bundle, {
    clienteId: filters.clienteId,
    tipoLavoro: filters.tipoLavoro,
    statoPreventivo: filters.statoPreventivo
  });
}

/**
 * Opzioni filtri da bundle già caricato.
 * @param {object} bundle
 */
export function getContoTerziFilterOptions(bundle) {
  const clienti = (bundle && bundle.clienti) || [];
  const lavori = (bundle && bundle.lavori) || [];
  const preventivi = (bundle && bundle.preventivi) || [];
  const tipi = new Set();
  for (const l of lavori) {
    if (l && l.tipoLavoro) tipi.add(String(l.tipoLavoro));
  }
  for (const p of preventivi) {
    if (p && p.tipoLavoro) tipi.add(String(p.tipoLavoro));
  }
  const stati = new Set();
  for (const p of preventivi) {
    if (p && p.stato) stati.add(String(p.stato));
  }
  const clientiOpts = clienti
    .filter((c) => c && c.id)
    .map((c) => ({
      id: String(c.id),
      nome: c.ragioneSociale || c.nome || c.id
    }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));

  return {
    clienti: clientiOpts,
    tipiLavoro: [...tipi].sort((a, b) => a.localeCompare(b, 'it')),
    statiPreventivo: [...stati].sort((a, b) => a.localeCompare(b, 'it'))
  };
}

export {
  assembleContoTerziReport,
  prepareContoTerziExportData,
  isContoTerziDataReady,
  buildClienteDetailRows,
  formatEuroPrefixCompact,
  labelStatoPreventivo
};

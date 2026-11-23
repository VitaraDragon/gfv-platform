/**
 * Report Economici — caricamento fonti + aggregazione terreno × coltura.
 * I calcoli puri stanno in report-economici-aggregate.js (testabili / riusabili).
 *
 * Prestazioni: letture per collezione + oreOperai in parallelo (niente calcolaCostiLavoro sequenziale).
 *
 * @module modules/report/services/report-economici-service
 */

import {
  getCollectionData,
  getDb,
  collection,
  getDocs,
  doc,
  getDoc
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId, getCurrentTenant } from '../../../core/services/tenant-service.js';
import { resolveEffectiveModules } from '../../../core/utils/module-access-resolver.js';
import { fetchOreOperaiForLavori, fetchUsersByIds } from '../../../core/services/manodopera-lavori-ore-loader.js';
import {
  aggregateEconomiciRows,
  buildEconomiciLines,
  companyTotal,
  dataIsoFromAny,
  dataIsoInRange,
  inRange,
  prodottoCostFromTrattamento,
  totalsByColtura,
  euro
} from './report-economici-aggregate.js';

const TARIFFE_OPERAI_DEFAULT = {
  semplice: 10.0,
  specializzato: 12.0,
  trattorista: 15.0,
  meccanico: 14.0,
  elettricista: 14.0,
  altro: 10.0
};

function modsSet(activeModules) {
  return new Set((activeModules || []).map((m) => String(m || '').toLowerCase()));
}

function resolveTariffaOperaio(tariffeOperai, operaio) {
  if (operaio && operaio.tariffaPersonalizzata != null && operaio.tariffaPersonalizzata !== '') {
    return { tariffa: Number(operaio.tariffaPersonalizzata), fromConfig: true };
  }
  const tipo = (operaio && operaio.tipoOperaio) || null;
  if (tariffeOperai && tipo && tariffeOperai[tipo] != null) {
    return { tariffa: Number(tariffeOperai[tipo]), fromConfig: true };
  }
  if (tipo && TARIFFE_OPERAI_DEFAULT[tipo] != null) {
    return { tariffa: TARIFFE_OPERAI_DEFAULT[tipo], fromConfig: false };
  }
  return { tariffa: 10.0, fromConfig: false };
}

async function loadTariffe(tenantId) {
  const db = getDb();
  let tariffeOperai = null;
  let tariffaProprietario = null;
  let tariffaProprietarioConfigurata = false;
  if (!db || !tenantId) {
    return { tariffeOperai, tariffaProprietario: 15, tariffaProprietarioConfigurata: false };
  }
  try {
    const snap = await getDoc(doc(db, `tenants/${tenantId}/tariffe`, 'operai'));
    if (snap.exists()) tariffeOperai = snap.data() || null;
  } catch (_) { /* ignore */ }
  try {
    const snap = await getDoc(doc(db, `tenants/${tenantId}/tariffe`, 'proprietario'));
    if (snap.exists()) {
      const data = snap.data() || {};
      const t = data.tariffaOraria != null ? data.tariffaOraria : data.tariffa;
      if (t != null && t !== '') {
        tariffaProprietario = Number(t);
        tariffaProprietarioConfigurata = true;
      }
    }
  } catch (_) { /* ignore */ }
  if (tariffaProprietario == null) tariffaProprietario = 15;
  return { tariffeOperai, tariffaProprietario, tariffaProprietarioConfigurata };
}

async function loadMacchineMap(hasParco) {
  /** @type {Map<string, number>} */
  const map = new Map();
  if (!hasParco) return map;
  try {
    const { getAllMacchine } = await import('../../parco-macchine/services/macchine-service.js');
    const list = await getAllMacchine();
    for (const m of list || []) {
      if (!m || !m.id) continue;
      map.set(String(m.id), m.costoOra != null ? Number(m.costoOra) : 0);
    }
  } catch (e) {
    console.warn('[report-economici] macchine', e && e.message);
  }
  return map;
}

/**
 * Costo manodopera/macchine da oreOperai già caricate (puro rispetto a Firestore).
 */
export function costiFromOreBundle(lavoro, oreDocs, ctx) {
  const {
    usersById,
    tariffeOperai,
    macchineById,
    hasParco,
    tariffaProprietario,
    tariffaProprietarioConfigurata
  } = ctx;

  let ore = 0;
  let costoManodopera = 0;
  let costoMacchine = 0;
  let missingManodopera = false;
  let missingMacchine = false;
  /** @type {string[]} */
  const notes = [];
  /** @type {Record<string, number>} */
  const orePerOperaio = {};
  /** @type {Record<string, number>} */
  const oreMacchinaPerId = {};

  for (const oraDoc of oreDocs || []) {
    const ora = typeof oraDoc.data === 'function' ? oraDoc.data() : oraDoc;
    if (!ora || ora.stato !== 'validate') continue;
    const oreNette = Number(ora.oreNette) || 0;
    ore += oreNette;
    const operaioId = ora.operaioId;
    if (operaioId) {
      orePerOperaio[operaioId] = (orePerOperaio[operaioId] || 0) + oreNette;
    }
    const oreMac = Number(ora.oreMacchina) || 0;
    if (oreMac > 0) {
      if (ora.macchinaId) {
        oreMacchinaPerId[ora.macchinaId] = (oreMacchinaPerId[ora.macchinaId] || 0) + oreMac;
      }
      if (ora.attrezzoId && ora.attrezzoId !== ora.macchinaId) {
        oreMacchinaPerId[ora.attrezzoId] = (oreMacchinaPerId[ora.attrezzoId] || 0) + oreMac;
      }
    }
  }

  const operaioIds = Object.keys(orePerOperaio);
  if (operaioIds.length > 0) {
    for (const oid of operaioIds) {
      const user = usersById.get(String(oid));
      if (!user) {
        missingManodopera = true;
        notes.push('Operaio non trovato in anagrafica per calcolo tariffa');
        continue;
      }
      const { tariffa, fromConfig } = resolveTariffaOperaio(tariffeOperai, user);
      if (!fromConfig && user.tariffaPersonalizzata == null) {
        // default di sistema: ok, ma se non c’è tipo né personalizzata segnaliamo solo se ore>0 e tenant senza doc tariffe
        if (!tariffeOperai && !user.tipoOperaio) {
          missingManodopera = true;
          notes.push('Tariffa oraria non impostata');
          continue;
        }
      }
      costoManodopera += orePerOperaio[oid] * tariffa;
    }
  } else if (ore > 0) {
    // ore senza operaio (raro): non contiamo manodopera
  }

  // Se non ci sono ore validate da operai, il costo manodopera lavoro può arrivare dal diario
  // (gestito a parte). Qui non inventiamo.

  if (hasParco) {
    for (const [mid, oreM] of Object.entries(oreMacchinaPerId)) {
      if (!macchineById.has(String(mid))) {
        missingMacchine = true;
        notes.push('Macchina non in anagrafica (costo orario mancante)');
        continue;
      }
      const costoOra = macchineById.get(String(mid));
      if (!costoOra || costoOra <= 0) {
        missingMacchine = true;
        notes.push('Costo orario macchina non impostato');
        continue;
      }
      costoMacchine += oreM * costoOra;
    }
  } else if (Object.keys(oreMacchinaPerId).length > 0) {
    // Parco non attivo: macchine = 0 senza warning di prezzo
    costoMacchine = 0;
  }

  void tariffaProprietario;
  void tariffaProprietarioConfigurata;

  return {
    ore: euro(ore) || 0,
    costoManodopera: missingManodopera ? null : euro(costoManodopera),
    costoMacchine: missingMacchine ? null : euro(costoMacchine),
    missingManodopera,
    missingMacchine,
    notes: [...new Set(notes)]
  };
}

function costiAttivitaDiario(att, ctx) {
  const {
    macchineById,
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

  let missingMacchine = false;
  let costoMacchine = 0;
  const oreMac = Number(att.oreMacchina) || 0;
  if (oreMac > 0 && hasParco) {
    const ids = [att.macchinaId, att.attrezzoId].filter(Boolean);
    const unique = [...new Set(ids.map(String))];
    for (const mid of unique) {
      if (!macchineById.has(mid)) {
        missingMacchine = true;
        notes.push('Macchina non in anagrafica (costo orario mancante)');
        continue;
      }
      const costoOra = macchineById.get(mid);
      if (!costoOra || costoOra <= 0) {
        missingMacchine = true;
        notes.push('Costo orario macchina non impostato');
        continue;
      }
      costoMacchine += oreMac * costoOra;
    }
  }

  return {
    ore: euro(ore) || 0,
    costoManodopera: missingManodopera ? null : euro(costoManodopera),
    costoMacchine: missingMacchine ? null : euro(costoMacchine),
    missingManodopera,
    missingMacchine,
    notes: [...new Set(notes)]
  };
}

async function loadAttivitaInRange(tenantId, start, end) {
  const dataDaStr = dataIsoFromAny(start);
  const dataAStr = dataIsoFromAny(end);
  try {
    const docs = await getCollectionData('attivita', {
      tenantId,
      where: [
        ['data', '>=', dataDaStr],
        ['data', '<=', dataAStr]
      ],
      orderBy: 'data',
      orderDirection: 'desc'
    });
    return docs || [];
  } catch (e) {
    try {
      const raw = await getCollectionData('attivita', {
        tenantId,
        orderBy: 'data',
        orderDirection: 'desc',
        limit: 2000
      });
      return (raw || []).filter((a) => dataIsoInRange(a.data, start, end));
    } catch (e2) {
      console.warn('[report-economici] attività', e2 && e2.message);
      return [];
    }
  }
}

async function loadTrattamentiSubcol(tenantId, collectionPath, start, end) {
  const { dateToTimestamp } = await import('../../../core/services/firebase-service.js');
  const t0 = dateToTimestamp(start);
  const t1 = dateToTimestamp(end);
  try {
    const docs = await getCollectionData(collectionPath, {
      tenantId,
      where: [
        ['data', '>=', t0],
        ['data', '<=', t1]
      ],
      orderBy: 'data',
      orderDirection: 'desc'
    });
    return docs || [];
  } catch (e) {
    try {
      const docs = await getCollectionData(collectionPath, {
        tenantId,
        orderBy: 'data',
        orderDirection: 'desc',
        limit: 400
      });
      return (docs || []).filter((d) => inRange(d.data, start, end));
    } catch (e2) {
      return [];
    }
  }
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {{ terrenoId?: string|null, coltura?: string|null, activeModules?: string[] }} [filters]
 */
export async function buildReportEconomici(start, end, filters = {}) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant non disponibile');

  const tenant = await getCurrentTenant().catch(() => null);
  const activeModules = filters.activeModules
    || resolveEffectiveModules(tenant || {});
  const mods = modsSet(activeModules);
  const hasParco = mods.has('parcomacchine') || mods.has('parco-macchine');

  const [terreniRaw, lavoriRaw, attivitaDocs, tariffe, macchineById] = await Promise.all([
    getCollectionData('terreni', { tenantId }).catch(() => []),
    getCollectionData('lavori', { tenantId, orderBy: 'dataInizio', orderDirection: 'desc' }).catch(() => []),
    loadAttivitaInRange(tenantId, start, end),
    loadTariffe(tenantId),
    loadMacchineMap(hasParco)
  ]);

  const terreni = (terreniRaw || []).filter((t) => !t.clienteId || String(t.clienteId).trim() === '');
  const terrenoById = new Map(terreni.map((t) => [String(t.id), t]));

  const lavoriInRange = (lavoriRaw || []).filter((l) => {
    if (!l || l.stato !== 'completato') return false;
    if (l.clienteId && String(l.clienteId).trim()) return false;
    if (!l.terrenoId || !terrenoById.has(String(l.terrenoId))) return false;
    return inRange(l.dataInizio || l.data, start, end);
  });

  const db = getDb();
  const lavoriDocs = lavoriInRange.map((l) => ({
    id: l.id,
    data: () => l
  }));

  const oreByLavoroId = db
    ? await fetchOreOperaiForLavori(
      tenantId,
      lavoriDocs,
      { db, collection, getDocs },
      { statoFilter: 'validate' }
    )
    : new Map();

  const operaioIds = [];
  oreByLavoroId.forEach((entry) => {
    for (const oraDoc of entry.oreDocs || []) {
      const ora = oraDoc.data();
      if (ora && ora.operaioId) operaioIds.push(ora.operaioId);
    }
  });
  const usersById = db
    ? await fetchUsersByIds(operaioIds, { db, doc, getDoc })
    : new Map();

  const costCtx = {
    usersById,
    tariffeOperai: tariffe.tariffeOperai,
    macchineById,
    hasParco,
    tariffaProprietario: tariffe.tariffaProprietario,
    tariffaProprietarioConfigurata: tariffe.tariffaProprietarioConfigurata
  };

  const lavoriCosti = lavoriInRange.map((lav) => {
    const entry = oreByLavoroId.get(lav.id) || { oreDocs: [] };
    const c = costiFromOreBundle(lav, entry.oreDocs, costCtx);
    // Se non ci sono ore validate sul lavoro, prova ore dalle attività collegate
    if ((c.ore || 0) === 0) {
      const linked = (attivitaDocs || []).filter((a) => a && String(a.lavoroId || '') === String(lav.id));
      let ore = 0;
      for (const a of linked) ore += Number(a.oreNette) || 0;
      if (ore > 0) {
        if (!tariffe.tariffaProprietarioConfigurata) {
          return {
            id: lav.id,
            terrenoId: lav.terrenoId,
            dataIso: dataIsoFromAny(lav.dataInizio || lav.data),
            tipoLavoro: lav.tipoLavoro || '',
            ore: euro(ore) || 0,
            costoManodopera: null,
            costoMacchine: 0,
            missingManodopera: true,
            missingMacchine: false,
            notes: ['Tariffa oraria non impostata']
          };
        }
        return {
          id: lav.id,
          terrenoId: lav.terrenoId,
          dataIso: dataIsoFromAny(lav.dataInizio || lav.data),
          tipoLavoro: lav.tipoLavoro || '',
          ore: euro(ore) || 0,
          costoManodopera: euro(ore * tariffe.tariffaProprietario),
          costoMacchine: 0,
          missingManodopera: false,
          missingMacchine: false,
          notes: []
        };
      }
    }
    return {
      id: lav.id,
      terrenoId: lav.terrenoId,
      dataIso: dataIsoFromAny(lav.dataInizio || lav.data),
      tipoLavoro: lav.tipoLavoro || '',
      ...c
    };
  });

  const attivitaCosti = (attivitaDocs || [])
    .filter((a) => a && !a.lavoroId && !a.clienteId && a.terrenoId && terrenoById.has(String(a.terrenoId)))
    .map((a) => {
      const c = costiAttivitaDiario(a, costCtx);
      return {
        terrenoId: a.terrenoId,
        dataIso: dataIsoFromAny(a.data),
        tipoLavoro: a.tipoLavoro || '',
        lavoroId: a.lavoroId || null,
        clienteId: a.clienteId || null,
        ...c
      };
    });

  /** @type {Array<{ terrenoId: string, costoProdotti: number|null, missingProdotti?: boolean, notes?: string[] }>} */
  const prodottiCosti = [];

  // Prodotti: moduli coltura attivi (skip silenzioso se disattivo)
  const productLoaders = [];

  if (mods.has('seminativo')) {
    productLoaders.push((async () => {
      try {
        const { getAllTrattamentiSeminativo } = await import('../../seminativo/services/trattamenti-service.js');
        const list = await getAllTrattamentiSeminativo();
        for (const row of list || []) {
          if (!row || !dataIsoInRange(row.data, start, end)) continue;
          const tid = row.terrenoId;
          if (!tid || !terrenoById.has(String(tid))) continue;
          const p = prodottoCostFromTrattamento(row);
          prodottiCosti.push({ terrenoId: String(tid), ...p });
        }
      } catch (e) {
        console.warn('[report-economici] seminativo trattamenti', e && e.message);
      }
    })());
  }

  if (mods.has('orticole')) {
    productLoaders.push((async () => {
      try {
        const { getAllTrattamentiOrticole } = await import('../../orticole/services/trattamenti-service.js');
        const list = await getAllTrattamentiOrticole();
        for (const row of list || []) {
          if (!row || !dataIsoInRange(row.data, start, end)) continue;
          const tid = row.terrenoId;
          if (!tid || !terrenoById.has(String(tid))) continue;
          const p = prodottoCostFromTrattamento(row);
          prodottiCosti.push({ terrenoId: String(tid), ...p });
        }
      } catch (e) {
        console.warn('[report-economici] orticole trattamenti', e && e.message);
      }
    })());
  }

  if (mods.has('vigneto')) {
    productLoaders.push((async () => {
      try {
        const vigneti = await getCollectionData('vigneti', { tenantId }).catch(() => []);
        await Promise.all((vigneti || []).map(async (v) => {
          if (!v || !v.id || !v.terrenoId || !terrenoById.has(String(v.terrenoId))) return;
          const docs = await loadTrattamentiSubcol(tenantId, `vigneti/${v.id}/trattamenti`, start, end);
          for (const row of docs) {
            const p = prodottoCostFromTrattamento(row);
            prodottiCosti.push({ terrenoId: String(v.terrenoId), ...p });
          }
        }));
      } catch (e) {
        console.warn('[report-economici] vigneto trattamenti', e && e.message);
      }
    })());
  }

  if (mods.has('frutteto')) {
    productLoaders.push((async () => {
      try {
        const frutteti = await getCollectionData('frutteti', { tenantId }).catch(() => []);
        await Promise.all((frutteti || []).map(async (f) => {
          if (!f || !f.id || !f.terrenoId || !terrenoById.has(String(f.terrenoId))) return;
          const docs = await loadTrattamentiSubcol(tenantId, `frutteti/${f.id}/trattamenti`, start, end);
          for (const row of docs) {
            const p = prodottoCostFromTrattamento(row);
            prodottiCosti.push({ terrenoId: String(f.terrenoId), ...p });
          }
        }));
      } catch (e) {
        console.warn('[report-economici] frutteto trattamenti', e && e.message);
      }
    })());
  }

  await Promise.all(productLoaders);

  const lines = buildEconomiciLines({
    terreni,
    lavoriCosti,
    attivitaCosti,
    prodottiCosti
  });

  const { rows, notes } = aggregateEconomiciRows(lines, {
    terrenoId: filters.terrenoId || null,
    coltura: filters.coltura || null
  });

  const byColtura = totalsByColtura(rows);
  const totaleAzienda = companyTotal(rows);

  return {
    rows,
    byColtura,
    totaleAzienda,
    notes,
    meta: {
      start,
      end,
      activeModules: [...mods],
      lavoriCount: lavoriInRange.length,
      skippedModules: ['vigneto', 'frutteto', 'seminativo', 'orticole'].filter((m) => !mods.has(m))
    }
  };
}

/**
 * Opzioni filtri UI (terreni + colture uniche).
 */
export async function getEconomiciFilterOptions() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant non disponibile');
  const terreniRaw = await getCollectionData('terreni', { tenantId }).catch(() => []);
  const terreni = (terreniRaw || [])
    .filter((t) => !t.clienteId || String(t.clienteId).trim() === '')
    .map((t) => ({
      id: t.id,
      nome: t.nome || t.podere || t.id,
      coltura: (t.coltura && String(t.coltura).trim()) || 'Senza coltura',
      superficie: t.superficie
    }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));

  const colture = [...new Set(terreni.map((t) => t.coltura))].sort((a, b) => a.localeCompare(b, 'it'));
  return { terreni, colture };
}

export { aggregateEconomiciRows, buildEconomiciLines, totalsByColtura, companyTotal, prodottoCostFromTrattamento };

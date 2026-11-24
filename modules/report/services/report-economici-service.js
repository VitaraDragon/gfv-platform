/**
 * Report Economici — caricamento fonti + aggregazione terreno × coltura.
 * I calcoli puri stanno in report-economici-aggregate.js (testabili / riusabili).
 *
 * Prestazioni (senza indici/functions/rules nuovi):
 * - lavori / attività / movimenti / trattamenti flat / campagne / magazzino avviati in parallelo;
 * - cache in memoria del bundle grezzo per periodo (filtri terreno/coltura = solo ricalcolo);
 * - campagna/anagrafiche caricate una sola volta;
 * - labour pronto prima di prodotti/carburante (callback onLabourReady opzionale);
 *   la UI mostra cifre solo a bundle completo (niente totali parziali in caricamento).
 * Limite noto: oreOperai restano 1 lettura per lavoro (niente collectionGroup senza indice nuovo).
 *
 * @module modules/report/services/report-economici-service
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
  aggregateEconomiciRows,
  assembleEconomiciReport,
  buildEconomiciLines,
  buildEconomiciVoci,
  companyTotal,
  dataIsoFromAny,
  dataIsoInRange,
  filterUsciteMagazzinoPerEconomici,
  formatLocalIsoDate,
  inRange,
  mergeDocsById,
  prepareEconomiciExportData,
  prodottoCostFromMovimentoUscita,
  prodottoVociFromTrattamento,
  splitCostoProdottoCarburanteFromTrattamento,
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

/** @type {{ key: string, data: object }|null} */
let periodBundleCache = null;

function modsSet(activeModules) {
  return new Set((activeModules || []).map((m) => String(m || '').toLowerCase()));
}

function periodKey(start, end, mods) {
  return `${formatLocalIsoDate(start)}|${formatLocalIsoDate(end)}|${[...mods].sort().join(',')}`;
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
    console.warn('[report-economici] macchine', e && e.message);
  }
  return { map, nomi };
}

/**
 * Costo manodopera/macchine da oreOperai già caricate (puro rispetto a Firestore).
 */
export function costiFromOreBundle(lavoro, oreDocs, ctx) {
  const {
    usersById,
    tariffeOperai,
    macchineById,
    macchineNomiById,
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
  /** @type {Array<object>} */
  const voci = [];
  const tipo = (lavoro && lavoro.tipoLavoro) || 'Lavoro';
  const dataIso = dataIsoFromAny((lavoro && (lavoro.dataInizio || lavoro.data)) || '');

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
      const oreO = orePerOperaio[oid];
      const nome = user
        ? (`${user.nome || ''} ${user.cognome || ''}`.trim() || user.displayName || oid)
        : oid;
      if (!user) {
        missingManodopera = true;
        notes.push('Operaio non trovato in anagrafica per calcolo tariffa');
        voci.push({
          origine: 'lavoro',
          categoria: 'manodopera',
          descrizione: `${tipo} — ${nome} (${oreO} h)`,
          importo: null,
          prezzoMancante: true,
          dataIso
        });
        continue;
      }
      const { tariffa, fromConfig } = resolveTariffaOperaio(tariffeOperai, user);
      if (!fromConfig && user.tariffaPersonalizzata == null) {
        if (!tariffeOperai && !user.tipoOperaio) {
          missingManodopera = true;
          notes.push('Tariffa oraria non impostata');
          voci.push({
            origine: 'lavoro',
            categoria: 'manodopera',
            descrizione: `${tipo} — ${nome} (${oreO} h)`,
            importo: null,
            prezzoMancante: true,
            dataIso
          });
          continue;
        }
      }
      const importo = oreO * tariffa;
      costoManodopera += importo;
      voci.push({
        origine: 'lavoro',
        categoria: 'manodopera',
        descrizione: `${tipo} — ${nome} (${oreO} h × € ${tariffa}/h)`,
        importo: euro(importo),
        prezzoMancante: false,
        dataIso
      });
    }
  }

  if (hasParco) {
    for (const [mid, oreM] of Object.entries(oreMacchinaPerId)) {
      const label = (macchineNomiById && macchineNomiById.get(String(mid))) || mid;
      if (!macchineById.has(String(mid))) {
        missingMacchine = true;
        notes.push('Macchina non in anagrafica (costo orario mancante)');
        voci.push({
          origine: 'lavoro',
          categoria: 'macchine',
          descrizione: `${tipo} — ${label} (${oreM} h)`,
          importo: null,
          prezzoMancante: true,
          dataIso
        });
        continue;
      }
      const costoOra = macchineById.get(String(mid));
      if (!costoOra || costoOra <= 0) {
        missingMacchine = true;
        notes.push('Costo orario macchina non impostato');
        voci.push({
          origine: 'lavoro',
          categoria: 'macchine',
          descrizione: `${tipo} — ${label} (${oreM} h)`,
          importo: null,
          prezzoMancante: true,
          dataIso
        });
        continue;
      }
      const importo = oreM * costoOra;
      costoMacchine += importo;
      voci.push({
        origine: 'lavoro',
        categoria: 'macchine',
        descrizione: `${tipo} — ${label} (${oreM} h × € ${costoOra}/h)`,
        importo: euro(importo),
        prezzoMancante: false,
        dataIso
      });
    }
  } else if (Object.keys(oreMacchinaPerId).length > 0) {
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
    notes: [...new Set(notes)],
    voci
  };
}

function costiAttivitaDiario(att, ctx) {
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
  /** @type {Array<object>} */
  const voci = [];
  let missingManodopera = false;
  let costoManodopera = 0;
  const tipo = att.tipoLavoro || 'Diario';
  const dataIso = dataIsoFromAny(att.data);

  if (ore > 0) {
    if (!tariffaProprietarioConfigurata) {
      missingManodopera = true;
      notes.push('Tariffa oraria non impostata');
      voci.push({
        origine: 'diario',
        categoria: 'manodopera',
        descrizione: `${tipo} — proprietario (${ore} h)`,
        importo: null,
        prezzoMancante: true,
        dataIso
      });
    } else {
      costoManodopera = ore * Number(tariffaProprietario || 0);
      voci.push({
        origine: 'diario',
        categoria: 'manodopera',
        descrizione: `${tipo} — proprietario (${ore} h × € ${tariffaProprietario}/h)`,
        importo: euro(costoManodopera),
        prezzoMancante: false,
        dataIso
      });
    }
  }

  let missingMacchine = false;
  let costoMacchine = 0;
  const oreMac = Number(att.oreMacchina) || 0;
  if (oreMac > 0 && hasParco) {
    const ids = [att.macchinaId, att.attrezzoId].filter(Boolean);
    const unique = [...new Set(ids.map(String))];
    for (const mid of unique) {
      const label = (macchineNomiById && macchineNomiById.get(mid)) || mid;
      if (!macchineById.has(mid)) {
        missingMacchine = true;
        notes.push('Macchina non in anagrafica (costo orario mancante)');
        voci.push({
          origine: 'diario',
          categoria: 'macchine',
          descrizione: `${tipo} — ${label} (${oreMac} h)`,
          importo: null,
          prezzoMancante: true,
          dataIso
        });
        continue;
      }
      const costoOra = macchineById.get(mid);
      if (!costoOra || costoOra <= 0) {
        missingMacchine = true;
        notes.push('Costo orario macchina non impostato');
        voci.push({
          origine: 'diario',
          categoria: 'macchine',
          descrizione: `${tipo} — ${label} (${oreMac} h)`,
          importo: null,
          prezzoMancante: true,
          dataIso
        });
        continue;
      }
      const importo = oreMac * costoOra;
      costoMacchine += importo;
      voci.push({
        origine: 'diario',
        categoria: 'macchine',
        descrizione: `${tipo} — ${label} (${oreMac} h × € ${costoOra}/h)`,
        importo: euro(importo),
        prezzoMancante: false,
        dataIso
      });
    }
  }

  return {
    ore: euro(ore) || 0,
    costoManodopera: missingManodopera ? null : euro(costoManodopera),
    costoMacchine: missingMacchine ? null : euro(costoMacchine),
    missingManodopera,
    missingMacchine,
    notes: [...new Set(notes)],
    voci
  };
}

async function loadAttivitaInRange(tenantId, start, end) {
  // Formato salvato: sempre stringa YYYY-MM-DD (Attivita model / diario). Solo range ISO.
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

async function loadLavoriInRange(tenantId, start, end) {
  // Formato salvato: sempre Timestamp (Lavoro.toFirestore → dateToTimestamp(dataInizio)). Solo range Timestamp.
  const t0 = dateToTimestamp(start);
  const t1 = dateToTimestamp(end);
  try {
    const docs = await getCollectionData('lavori', {
      tenantId,
      where: [
        ['dataInizio', '>=', t0],
        ['dataInizio', '<=', t1]
      ],
      orderBy: 'dataInizio',
      orderDirection: 'desc'
    });
    return docs || [];
  } catch (e) {
    try {
      const docs = await getCollectionData('lavori', {
        tenantId,
        orderBy: 'dataInizio',
        orderDirection: 'desc'
      });
      return (docs || []).filter((l) => inRange(l.dataInizio || l.data, start, end));
    } catch (e2) {
      console.warn('[report-economici] lavori', e2 && e2.message);
      return [];
    }
  }
}

/**
 * Range duale ISO + Timestamp su `data`, merge per id.
 * Serve dove il campo può essere stringa o Timestamp (trattamenti seminativo/orticole/subcol).
 */
async function loadDocsByDataDualFormat(tenantId, collectionPath, start, end, opts = {}) {
  const dataDaStr = formatLocalIsoDate(start);
  const dataAStr = formatLocalIsoDate(end);
  const t0 = dateToTimestamp(start);
  const t1 = dateToTimestamp(end);
  const limitFallback = opts.limitFallback;

  const [isoRes, tsRes] = await Promise.all([
    getCollectionData(collectionPath, {
      tenantId,
      where: [
        ['data', '>=', dataDaStr],
        ['data', '<=', dataAStr]
      ],
      orderBy: 'data',
      orderDirection: 'desc'
    }).then((docs) => ({ ok: true, docs: docs || [] })).catch((err) => ({ ok: false, err })),
    getCollectionData(collectionPath, {
      tenantId,
      where: [
        ['data', '>=', t0],
        ['data', '<=', t1]
      ],
      orderBy: 'data',
      orderDirection: 'desc'
    }).then((docs) => ({ ok: true, docs: docs || [] })).catch((err) => ({ ok: false, err }))
  ]);

  if (isoRes.ok || tsRes.ok) {
    return mergeDocsById(isoRes.ok ? isoRes.docs : [], tsRes.ok ? tsRes.docs : [])
      .filter((d) => dataIsoInRange(d.data, start, end));
  }

  try {
    const docs = await getCollectionData(collectionPath, {
      tenantId,
      orderBy: 'data',
      orderDirection: 'desc',
      ...(limitFallback != null ? { limit: limitFallback } : {})
    });
    return (docs || []).filter((d) => dataIsoInRange(d.data, start, end));
  } catch (e3) {
    if (!opts.silent) {
      console.warn('[report-economici] dual data range', collectionPath, e3 && e3.message);
    }
    return [];
  }
}

async function loadTrattamentiSubcol(tenantId, collectionPath, start, end) {
  // Vigneto/frutteto: di solito Timestamp (Date → Firestore), ma toFirestore non forza il tipo:
  // stessa dual query ISO+Timestamp per non perdere eventuali stringhe.
  return loadDocsByDataDualFormat(tenantId, collectionPath, start, end, {
    limitFallback: 400,
    silent: true
  });
}

async function loadTrattamentiFlatInRange(tenantId, collectionName, start, end) {
  // seminativo/orticole: data può essere ISO string (toFirestore as-is / sync da lavoro)
  // oppure Timestamp/Date (editingRow da lavoro/attività). Entrambe le query in parallelo.
  return loadDocsByDataDualFormat(tenantId, collectionName, start, end, { silent: true });
}

async function loadUsciteMagazzinoInRange(start, end) {
  // Formato salvato: sempre Timestamp (MovimentoMagazzino.toFirestore → dateToTimestamp(data)).
  const t0 = dateToTimestamp(start);
  const t1 = dateToTimestamp(end);
  try {
    const { getAllMovimenti } = await import('../../magazzino/services/movimenti-service.js');
    // Indice esistente tipo+data: estendiamo con range via getCollectionData diretto
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
      const all = await getAllMovimenti({ tipo: 'uscita' }).catch(() => []);
      return (all || []).filter((m) => m && dataIsoInRange(m.data, start, end));
    }
  } catch (e) {
    console.warn('[report-economici] magazzino uscite', e && e.message);
    return [];
  }
}

function timePhase(timings, name, ms) {
  timings[name] = Math.round(ms);
  if (typeof console !== 'undefined' && console.info) {
    console.info(`[report-economici] ${name}: ${Math.round(ms)} ms`);
  }
}

/**
 * Carica (o riusa dalla cache) il bundle grezzo del periodo.
 * @param {Date} start
 * @param {Date} end
 * @param {{ activeModules?: string[], forceReload?: boolean, onLabourReady?: Function }} [opts]
 */
export async function loadEconomiciPeriodBundle(start, end, opts = {}) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant non disponibile');

  const tenant = await getCurrentTenant().catch(() => null);
  const activeModules = opts.activeModules || resolveEffectiveModules(tenant || {});
  const mods = modsSet(activeModules);
  const key = periodKey(start, end, mods);

  if (!opts.forceReload && periodBundleCache && periodBundleCache.key === key) {
    const cached = periodBundleCache.data;
    if (typeof opts.onLabourReady === 'function' && cached.labourReady) {
      opts.onLabourReady(cached);
    }
    return cached;
  }

  const timings = {};
  const tAll = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const hasParco = mods.has('parcomacchine') || mods.has('parco-macchine');
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // Avvio parallelo di tutte le letture indipendenti (obiettivo console < 5 s)
  const tCoreStart = now();
  const pCore = Promise.all([
    getCollectionData('terreni', { tenantId }).catch(() => []),
    loadLavoriInRange(tenantId, start, end),
    loadAttivitaInRange(tenantId, start, end),
    loadTariffe(tenantId),
    loadMacchineMap(hasParco)
  ]).then((r) => {
    timePhase(timings, 'terreni_lavori_attivita_tariffe_macchine', now() - tCoreStart);
    return r;
  });

  const tCampStart = now();
  const pCampagne = (async () => {
    /** @type {Array<object>} */
    let campagneSeminativo = [];
    /** @type {Array<object>} */
    let campagneOrticole = [];
    /** @type {Array<object>} */
    let vignetiList = [];
    /** @type {Array<object>} */
    let fruttetiList = [];
    await Promise.all([
      (async () => {
        if (!mods.has('seminativo')) return;
        try {
          const { getAllSeminativi } = await import('../../seminativo/services/seminativi-service.js');
          campagneSeminativo = await getAllSeminativi().catch(() => []) || [];
        } catch (_) { /* ignore */ }
      })(),
      (async () => {
        if (!mods.has('orticole')) return;
        try {
          const { getAllOrticole } = await import('../../orticole/services/orticole-service.js');
          campagneOrticole = await getAllOrticole().catch(() => []) || [];
        } catch (_) { /* ignore */ }
      })(),
      (async () => {
        if (!mods.has('vigneto')) return;
        vignetiList = await getCollectionData('vigneti', { tenantId }).catch(() => []) || [];
      })(),
      (async () => {
        if (!mods.has('frutteto')) return;
        fruttetiList = await getCollectionData('frutteti', { tenantId }).catch(() => []) || [];
      })()
    ]);
    timePhase(timings, 'campagne_anagrafiche', now() - tCampStart);
    return { campagneSeminativo, campagneOrticole, vignetiList, fruttetiList };
  })();

  const tMagStart = now();
  const pMagazzino = mods.has('magazzino')
    ? (async () => {
      try {
        const { getAllProdotti } = await import('../../magazzino/services/prodotti-service.js');
        const [movimenti, prodotti] = await Promise.all([
          loadUsciteMagazzinoInRange(start, end),
          getAllProdotti().catch(() => [])
        ]);
        timePhase(timings, 'magazzino', now() - tMagStart);
        return { movimenti: movimenti || [], prodotti: prodotti || [] };
      } catch (e) {
        console.warn('[report-economici] magazzino uscite', e && e.message);
        timePhase(timings, 'magazzino', now() - tMagStart);
        return { movimenti: [], prodotti: [] };
      }
    })()
    : Promise.resolve({ movimenti: [], prodotti: [] }).then((r) => {
      timePhase(timings, 'magazzino', 0);
      return r;
    });

  const tFlatStart = now();
  const pFlatTratt = (async () => {
    const out = { seminativo: [], orticole: [] };
    await Promise.all([
      mods.has('seminativo')
        ? loadTrattamentiFlatInRange(tenantId, 'trattamentiSeminativo', start, end)
          .then((list) => { out.seminativo = list || []; })
          .catch((e) => { console.warn('[report-economici] seminativo trattamenti', e && e.message); })
        : Promise.resolve(),
      mods.has('orticole')
        ? loadTrattamentiFlatInRange(tenantId, 'trattamentiOrticole', start, end)
          .then((list) => { out.orticole = list || []; })
          .catch((e) => { console.warn('[report-economici] orticole trattamenti', e && e.message); })
        : Promise.resolve()
    ]);
    timePhase(timings, 'trattamenti_flat', now() - tFlatStart);
    return out;
  })();

  const [terreniRaw, lavoriRaw, attivitaDocs, tariffe, macchinePack] = await pCore;

  const terreni = (terreniRaw || []).filter((t) => !t.clienteId || String(t.clienteId).trim() === '');
  const terrenoById = new Map(terreni.map((t) => [String(t.id), t]));
  const macchineById = macchinePack.map;
  const macchineNomiById = macchinePack.nomi;

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

  let t0 = now();
  const oreByLavoroId = db
    ? await fetchOreOperaiForLavori(
      tenantId,
      lavoriDocs,
      { db, collection, getDocs, query, where },
      { statoFilter: 'validate' }
    )
    : new Map();
  timePhase(timings, 'oreOperai', now() - t0);

  const operaioIds = [];
  oreByLavoroId.forEach((entry) => {
    for (const oraDoc of entry.oreDocs || []) {
      const ora = oraDoc.data();
      if (ora && ora.operaioId) operaioIds.push(ora.operaioId);
    }
  });
  t0 = now();
  const usersById = db
    ? await fetchUsersByIds(operaioIds, { db, doc, getDoc })
    : new Map();
  timePhase(timings, 'utenti_operai', now() - t0);

  const costCtx = {
    usersById,
    tariffeOperai: tariffe.tariffeOperai,
    macchineById,
    macchineNomiById,
    hasParco,
    tariffaProprietario: tariffe.tariffaProprietario,
    tariffaProprietarioConfigurata: tariffe.tariffaProprietarioConfigurata
  };

  const lavoriCosti = lavoriInRange.map((lav) => {
    const entry = oreByLavoroId.get(lav.id) || { oreDocs: [] };
    const c = costiFromOreBundle(lav, entry.oreDocs, costCtx);
    if ((c.ore || 0) === 0) {
      const linked = (attivitaDocs || []).filter((a) => a && String(a.lavoroId || '') === String(lav.id));
      let ore = 0;
      for (const a of linked) ore += Number(a.oreNette) || 0;
      if (ore > 0) {
        const dataIso = dataIsoFromAny(lav.dataInizio || lav.data);
        const tipo = lav.tipoLavoro || '';
        if (!tariffe.tariffaProprietarioConfigurata) {
          return {
            id: lav.id,
            terrenoId: lav.terrenoId,
            dataIso,
            tipoLavoro: tipo,
            ore: euro(ore) || 0,
            costoManodopera: null,
            costoMacchine: 0,
            missingManodopera: true,
            missingMacchine: false,
            notes: ['Tariffa oraria non impostata'],
            voci: [{
              origine: 'lavoro',
              categoria: 'manodopera',
              descrizione: `${tipo || 'Lavoro'} — da attività collegate (${ore} h)`,
              importo: null,
              prezzoMancante: true,
              dataIso
            }]
          };
        }
        const importo = euro(ore * tariffe.tariffaProprietario);
        return {
          id: lav.id,
          terrenoId: lav.terrenoId,
          dataIso,
          tipoLavoro: tipo,
          ore: euro(ore) || 0,
          costoManodopera: importo,
          costoMacchine: 0,
          missingManodopera: false,
          missingMacchine: false,
          notes: [],
          voci: [{
            origine: 'lavoro',
            categoria: 'manodopera',
            descrizione: `${tipo || 'Lavoro'} — da attività collegate (${ore} h × € ${tariffe.tariffaProprietario}/h)`,
            importo,
            prezzoMancante: false,
            dataIso
          }]
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
        id: a.id,
        terrenoId: a.terrenoId,
        dataIso: dataIsoFromAny(a.data),
        tipoLavoro: a.tipoLavoro || '',
        lavoroId: a.lavoroId || null,
        clienteId: a.clienteId || null,
        ...c
      };
    });

  // Campagne in parallelo al core: attendi e avvia subito i trattamenti subcol
  const {
    campagneSeminativo,
    campagneOrticole,
    vignetiList,
    fruttetiList
  } = await pCampagne;

  const tSubcolStart = now();
  const pSubcol = (async () => {
    /** @type {Array<object>} */
    const rows = [];
    await Promise.all([
      mods.has('vigneto')
        ? Promise.all((vignetiList || []).map(async (v) => {
          if (!v || !v.id || !v.terrenoId || !terrenoById.has(String(v.terrenoId))) return;
          try {
            const docs = await loadTrattamentiSubcol(tenantId, `vigneti/${v.id}/trattamenti`, start, end);
            for (const row of docs) {
              rows.push({
                row,
                terrenoId: String(v.terrenoId),
                coltura: (v.varieta && String(v.varieta).trim()) || 'Vite'
              });
            }
          } catch (e) {
            console.warn('[report-economici] vigneto trattamenti', e && e.message);
          }
        }))
        : Promise.resolve(),
      mods.has('frutteto')
        ? Promise.all((fruttetiList || []).map(async (f) => {
          if (!f || !f.id || !f.terrenoId || !terrenoById.has(String(f.terrenoId))) return;
          try {
            const docs = await loadTrattamentiSubcol(tenantId, `frutteti/${f.id}/trattamenti`, start, end);
            for (const row of docs) {
              rows.push({
                row,
                terrenoId: String(f.terrenoId),
                coltura: (f.specie && String(f.specie).trim())
                  || (f.varieta && String(f.varieta).trim())
                  || 'Frutteto'
              });
            }
          } catch (e) {
            console.warn('[report-economici] frutteto trattamenti', e && e.message);
          }
        }))
        : Promise.resolve()
    ]);
    timePhase(timings, 'trattamenti_subcol', now() - tSubcolStart);
    return rows;
  })();

  const colturaContext = {
    campagneSeminativo,
    campagneOrticole,
    vigneti: vignetiList,
    frutteti: fruttetiList
  };

  const labourBundle = {
    terreni,
    lavoriCosti,
    attivitaCosti,
    prodottiCosti: [],
    colturaContext,
    lavoriRaw,
    attivitaDocs,
    terrenoById,
    vignetiList,
    fruttetiList,
    campagneSeminativo,
    campagneOrticole,
    mods: [...mods],
    timings: { ...timings },
    labourReady: true,
    prodottiReady: false,
    lavoriCount: lavoriInRange.length,
    start,
    end
  };

  if (typeof opts.onLabourReady === 'function') {
    opts.onLabourReady(labourBundle);
  }

  const [flatTratt, magRaw, subcolRows] = await Promise.all([pFlatTratt, pMagazzino, pSubcol]);
  timePhase(timings, 'trattamenti', (timings.trattamenti_flat || 0) + (timings.trattamenti_subcol || 0));

  const prodottiById = new Map((magRaw.prodotti || []).map((p) => [String(p.id), p]));

  /** @type {Array<object>} */
  const prodottiCosti = [];
  /** @type {Set<string>} */
  const magazzinoIdsDaTrattamenti = new Set();

  const pushTrattamento = (row, meta) => {
    if (!row) return;
    for (const id of row.magazzinoMovimentoIds || []) {
      if (id) magazzinoIdsDaTrattamenti.add(String(id));
    }
    const split = splitCostoProdottoCarburanteFromTrattamento(row, { prodottiById });
    const voci = prodottoVociFromTrattamento(row, { prodottiById })
      .map((v) => ({ ...v, origine: 'trattamento' }));
    prodottiCosti.push({
      id: row.id,
      terrenoId: meta.terrenoId,
      dataIso: dataIsoFromAny(row.data),
      campagnaId: meta.campagnaId || row.campagnaId || null,
      coltura: meta.coltura || null,
      origine: 'trattamento',
      voci,
      costoProdotti: split.costoProdotti,
      costoCarburante: split.costoCarburante,
      missingProdotti: !!split.missingProdotti,
      missingCarburante: !!split.missingCarburante,
      notes: split.notes || []
    });
  };

  for (const row of flatTratt.seminativo || []) {
    if (!row || !dataIsoInRange(row.data, start, end)) continue;
    const tid = row.terrenoId;
    if (!tid || !terrenoById.has(String(tid))) continue;
    pushTrattamento(row, {
      terrenoId: String(tid),
      campagnaId: row.campagnaId || null,
      coltura: row.colturaNome || null
    });
  }
  for (const row of flatTratt.orticole || []) {
    if (!row || !dataIsoInRange(row.data, start, end)) continue;
    const tid = row.terrenoId;
    if (!tid || !terrenoById.has(String(tid))) continue;
    pushTrattamento(row, {
      terrenoId: String(tid),
      campagnaId: row.campagnaId || null,
      coltura: row.colturaNome || null
    });
  }
  for (const item of subcolRows || []) {
    pushTrattamento(item.row, { terrenoId: item.terrenoId, coltura: item.coltura });
  }

  if (mods.has('magazzino')) {
    try {
      const lavoriById = new Map((lavoriRaw || []).map((l) => [String(l.id), l]));
      const attivitaById = new Map((attivitaDocs || []).map((a) => [String(a.id), a]));
      const vignetoById = new Map((vignetiList || []).map((v) => [String(v.id), v]));
      const fruttetoById = new Map((fruttetiList || []).map((f) => [String(f.id), f]));
      const campagnaSemiById = new Map((campagneSeminativo || []).map((c) => [String(c.id), c]));
      const campagnaOrtById = new Map((campagneOrticole || []).map((c) => [String(c.id), c]));

      const uscite = filterUsciteMagazzinoPerEconomici(
        (magRaw.movimenti || []).filter((m) => m && dataIsoInRange(m.data, start, end)),
        magazzinoIdsDaTrattamenti
      );

      for (const mov of uscite) {
        let terrenoId = null;
        let colturaHint = null;
        let campagnaId = null;

        if (mov.lavoroId && lavoriById.has(String(mov.lavoroId))) {
          const lav = lavoriById.get(String(mov.lavoroId));
          terrenoId = lav.terrenoId || null;
        } else if (mov.attivitaId && attivitaById.has(String(mov.attivitaId))) {
          const att = attivitaById.get(String(mov.attivitaId));
          terrenoId = att.terrenoId || null;
        } else if (mov.origineTrattamentoColturaId) {
          const cid = String(mov.origineTrattamentoColturaId);
          if (vignetoById.has(cid)) {
            const v = vignetoById.get(cid);
            terrenoId = v.terrenoId || null;
            colturaHint = (v.varieta && String(v.varieta).trim()) || 'Vite';
          } else if (fruttetoById.has(cid)) {
            const f = fruttetoById.get(cid);
            terrenoId = f.terrenoId || null;
            colturaHint = (f.specie && String(f.specie).trim())
              || (f.varieta && String(f.varieta).trim())
              || 'Frutteto';
          } else if (campagnaSemiById.has(cid)) {
            const c = campagnaSemiById.get(cid);
            terrenoId = c.terrenoId || null;
            colturaHint = c.colturaNome || null;
            campagnaId = c.id;
          } else if (campagnaOrtById.has(cid)) {
            const c = campagnaOrtById.get(cid);
            terrenoId = c.terrenoId || null;
            colturaHint = c.colturaNome || null;
            campagnaId = c.id;
          }
        }

        const prodAnag = prodottiById.get(String(mov.prodottoId || ''));
        const p = prodottoCostFromMovimentoUscita(mov, prodAnag);
        const nomeProd = (prodAnag && (prodAnag.nome || prodAnag.nomeCommerciale))
          || mov.prodottoNome
          || 'Prodotto';
        const qty = Number(mov.quantita) || 0;
        const isCarb = (p.costoCarburante != null && p.costoCarburante !== 0) || p.missingCarburante;
        const voce = {
          origine: 'uscita_magazzino',
          categoria: isCarb ? 'carburante' : 'prodotti',
          descrizione: `Uscita magazzino: ${nomeProd}${qty ? ` × ${qty}` : ''}`,
          importo: isCarb
            ? (p.missingCarburante ? null : p.costoCarburante)
            : (p.missingProdotti ? null : p.costoProdotti),
          prezzoMancante: isCarb ? !!p.missingCarburante : !!p.missingProdotti
        };
        const entry = {
          id: mov.id,
          dataIso: dataIsoFromAny(mov.data),
          coltura: colturaHint,
          campagnaId,
          origine: 'uscita_magazzino',
          voci: [voce],
          costoProdotti: p.costoProdotti,
          costoCarburante: p.costoCarburante,
          missingProdotti: !!p.missingProdotti,
          missingCarburante: !!p.missingCarburante,
          notes: p.notes || []
        };
        if (terrenoId && terrenoById.has(String(terrenoId))) {
          prodottiCosti.push({ ...entry, terrenoId: String(terrenoId) });
        } else {
          prodottiCosti.push({ ...entry, nonAttribuito: true });
        }
      }
    } catch (e) {
      console.warn('[report-economici] magazzino merge', e && e.message);
    }
  }

  timePhase(timings, 'totale', (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - tAll);

  const lines = buildEconomiciLines({
    terreni,
    lavoriCosti,
    attivitaCosti,
    prodottiCosti,
    colturaContext
  });
  const voci = buildEconomiciVoci({
    terreni,
    lavoriCosti,
    attivitaCosti,
    prodottiCosti,
    colturaContext
  });

  const full = {
    ...labourBundle,
    prodottiCosti,
    lines,
    voci,
    timings,
    labourReady: true,
    prodottiReady: true
  };

  periodBundleCache = { key, data: full };
  return full;
}

/**
 * Invalida la cache periodo (es. dopo cambio dati).
 */
export function clearEconomiciPeriodCache() {
  periodBundleCache = null;
}

/**
 * Assembla il report filtrato dal bundle già caricato.
 */
export function assembleEconomiciFromBundle(bundle, filters = {}) {
  if (!bundle) {
    return {
      rows: [],
      byColtura: [],
      totaleAzienda: companyTotal([]),
      notes: [],
      voci: [],
      meta: { prodottiReady: false }
    };
  }
  const assembled = assembleEconomiciReport({
    terreni: bundle.terreni,
    lavoriCosti: bundle.lavoriCosti,
    attivitaCosti: bundle.attivitaCosti,
    prodottiCosti: bundle.prodottiCosti || [],
    colturaContext: bundle.colturaContext,
    lines: bundle.prodottiReady ? bundle.lines : null,
    voci: bundle.prodottiReady ? bundle.voci : null
  }, {
    terrenoId: filters.terrenoId || null,
    coltura: filters.coltura || null
  });

  return {
    ...assembled,
    meta: {
      start: bundle.start,
      end: bundle.end,
      activeModules: bundle.mods || [],
      lavoriCount: bundle.lavoriCount || 0,
      timings: bundle.timings || {},
      prodottiReady: !!bundle.prodottiReady,
      labourReady: !!bundle.labourReady,
      skippedModules: ['vigneto', 'frutteto', 'seminativo', 'orticole'].filter(
        (m) => !(bundle.mods || []).includes(m)
      )
    }
  };
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {{ terrenoId?: string|null, coltura?: string|null, activeModules?: string[], forceReload?: boolean, onLabourReady?: Function }} [filters]
 * `onLabourReady` riceve il **bundle grezzo** (labourReady): il caller assembla con i filtri UI attuali
 * (evita filtri stale se terreno/coltura cambiano durante il fetch).
 */
export async function buildReportEconomici(start, end, filters = {}) {
  const filterOpts = {
    terrenoId: filters.terrenoId,
    coltura: filters.coltura
  };
  const bundle = await loadEconomiciPeriodBundle(start, end, {
    activeModules: filters.activeModules,
    forceReload: filters.forceReload,
    onLabourReady: typeof filters.onLabourReady === 'function'
      ? (labourBundle) => { filters.onLabourReady(labourBundle); }
      : undefined
  });
  return assembleEconomiciFromBundle(bundle, filterOpts);
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

export {
  aggregateEconomiciRows,
  assembleEconomiciReport,
  buildEconomiciLines,
  buildEconomiciVoci,
  totalsByColtura,
  companyTotal,
  prodottoCostFromTrattamento,
  prodottoVociFromTrattamento,
  splitCostoProdottoCarburanteFromTrattamento,
  isProdottoCarburante,
  allocatePercentages,
  aggregateMonthlyFromVoci,
  aggregateByTerrenoForChart,
  countVociIncomplete,
  resolveColturaAtDate,
  sumNullable,
  sumVociImporti,
  vociForRow,
  filterEconomiciVoci,
  prepareEconomiciExportData,
  prodottoCostFromMovimentoUscita,
  filterUsciteMagazzinoPerEconomici,
  mergeDocsById,
  isEconomiciDataReady
} from './report-economici-aggregate.js';

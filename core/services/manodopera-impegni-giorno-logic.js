/**
 * Logica pura vista impegni giornalieri (testabile senza Firebase).
 * Stesso grafo usato dalla shortlist sostituti.
 *
 * @module core/services/manodopera-impegni-giorno-logic
 */

import {
  LAVORO_STATI_IMPEGNO,
  buildOperaioSquadreMap,
  findImpegnoLavoroOperaio,
  resolvePrevistiOperaioIds,
  evaluateEquipaggioMinimo
} from './manodopera-sostituti-shortlist-logic.js';
import {
  getEquipaggioSlice as getRosterSlice,
  isRosterMaterializzato,
  getRosterAttiviIds
} from './manodopera-roster-giorno-logic.js';

/** @param {*} dataInizio @returns {Date|null} */
function parseLavoroDataInizio(dataInizio) {
  if (dataInizio == null) return null;
  const d = dataInizio.toDate ? dataInizio.toDate() : new Date(dataInizio);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** @param {{ dataInizio?: *, durataPrevista?: number }} lavoro @returns {Date|null} */
function getLavoroDataFinePrevista(lavoro) {
  const di = parseLavoroDataInizio(lavoro && lavoro.dataInizio);
  const dur = lavoro && lavoro.durataPrevista != null ? Number(lavoro.durataPrevista) : NaN;
  if (!di || !Number.isFinite(dur) || dur < 1) return null;
  const end = new Date(di);
  end.setDate(end.getDate() + dur - 1);
  end.setHours(23, 59, 59, 999);
  return end;
}

export const IMPEGNO_STATO_LIBERO = 'libero';
export const IMPEGNO_STATO_IMPEGNATO = 'impegnato';
export const IMPEGNO_STATO_ASSENTE = 'assente';
export const IMPEGNO_STATO_PRESTATO = 'prestato';
export const IMPEGNO_STATO_SOSTITUTO = 'sostituto';

/** Stati lavoro considerati nella vista giorno (oltre impegno shortlist). */
export const LAVORO_STATI_VISTA_GIORNO = Object.freeze([
  'assegnato',
  'in_corso',
  'in_standby',
  'sospeso'
]);

/**
 * @param {string} giornoKey YYYY-MM-DD
 * @param {Object} lavoro
 * @returns {boolean}
 */
export function lavoroCopreGiornoKey(giornoKey, lavoro) {
  if (!giornoKey || !lavoro) return false;
  if (!LAVORO_STATI_VISTA_GIORNO.includes(lavoro.stato || 'assegnato')) {
    return false;
  }

  const di = parseLavoroDataInizio(lavoro.dataInizio);
  if (!di) {
    // Senza data: in_corso / assegnato / standby contano comunque
    return LAVORO_STATI_IMPEGNO.includes(lavoro.stato) || lavoro.stato === 'in_standby';
  }

  const start = new Date(di);
  start.setHours(0, 0, 0, 0);
  const startKey = formatLocalGiornoKey(start);

  const fine = getLavoroDataFinePrevista(lavoro);
  if (!fine) {
    // Solo data inizio: include se giorno >= inizio, o se in_corso/standby
    if (lavoro.stato === 'in_corso' || lavoro.stato === 'in_standby') {
      return giornoKey >= startKey;
    }
    return giornoKey === startKey;
  }

  const end = new Date(fine);
  end.setHours(0, 0, 0, 0);
  const endKey = formatLocalGiornoKey(end);
  return giornoKey >= startKey && giornoKey <= endKey;
}

/**
 * @param {Date} d
 * @returns {string}
 */
export function formatLocalGiornoKey(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {Object} lavoro
 * @param {string} giornoKey
 * @returns {{ assenti: string[], sostituzioni: Object[], prestitiUscita: Object[] }}
 */
export function getEquipaggioSliceForGiorno(lavoro, giornoKey) {
  const empty = { assenti: [], sostituzioni: [], prestitiUscita: [] };
  if (!lavoro?.equipaggioGiorno || !giornoKey) return empty;
  const slice = lavoro.equipaggioGiorno[giornoKey] || {};
  return {
    assenti: [...(slice.assenti || [])].filter(Boolean),
    sostituzioni: [...(slice.sostituzioni || [])],
    prestitiUscita: [...(slice.prestitiUscita || [])]
  };
}

/**
 * @param {Object} op
 * @returns {string}
 */
function nomeOperaio(op) {
  if (!op) return '';
  return [op.nome, op.cognome].filter(Boolean).join(' ') || op.email || op.id || op.uid || '';
}

/**
 * Indici di supporto da lavori del giorno.
 * @param {Array<Object>} lavoriGiorno
 * @param {string} giornoKey
 */
export function indexMovimentiGiorno(lavoriGiorno, giornoKey) {
  const prestati = new Map(); // operaioId -> { lavoroId, lavoroNome, versoLavoroId }
  const sostituti = new Map(); // operaioId -> { lavoroId, lavoroNome, assenteOperaioId }

  for (const lav of lavoriGiorno || []) {
    const slice = getEquipaggioSliceForGiorno(lav, giornoKey);
    const nomeLav = lav.nome || lav.tipoLavoro || lav.id;

    for (const p of slice.prestitiUscita) {
      if (!p?.operaioId) continue;
      prestati.set(p.operaioId, {
        lavoroId: lav.id,
        lavoroNome: nomeLav,
        versoLavoroId: p.versoLavoroId || null
      });
    }

    const mp = lav.manodoperaPrestata;
    if (
      mp?.operaioId &&
      (!mp.giornoKey || mp.giornoKey === giornoKey)
    ) {
      prestati.set(mp.operaioId, {
        lavoroId: lav.id,
        lavoroNome: nomeLav,
        versoLavoroId: mp.versoLavoroId || null
      });
    }

    for (const s of slice.sostituzioni) {
      if (!s?.sostitutoOperaioId) continue;
      sostituti.set(s.sostitutoOperaioId, {
        lavoroId: lav.id,
        lavoroNome: nomeLav,
        assenteOperaioId: s.assenteOperaioId || null
      });
    }

    if (lav.assenzaSostitutoOperaioId) {
      sostituti.set(lav.assenzaSostitutoOperaioId, {
        lavoroId: lav.id,
        lavoroNome: nomeLav,
        assenteOperaioId: lav.assenzaOperaioAssenteId || null
      });
    }
  }

  return { prestati, sostituti };
}

/**
 * Costruisce riga impegno per un operaio.
 *
 * @param {Object} options
 * @param {Object} options.operaio
 * @param {string} options.giornoKey
 * @param {Array<Object>} options.lavori
 * @param {Array<Object>} options.lavoriGiorno
 * @param {Map} options.squadreMap
 * @param {Set<string>} options.assentiSet
 * @param {Map<string, Object>} options.assenzeByOperaio
 * @param {Map} options.prestati
 * @param {Map} options.sostituti
 */
export function buildImpegnoOperaioRow(options = {}) {
  const {
    operaio,
    giornoKey,
    lavori = [],
    lavoriGiorno = [],
    squadreMap,
    assentiSet = new Set(),
    assenzeByOperaio = new Map(),
    prestati = new Map(),
    sostituti = new Map()
  } = options;

  const operaioId = operaio?.id || operaio?.uid;
  if (!operaioId) return null;

  const nome = nomeOperaio(operaio);
  const base = {
    operaioId,
    nome,
    giornoKey,
    statoDisponibilita: IMPEGNO_STATO_LIBERO,
    lavoroId: null,
    lavoroNome: null,
    assenzaTipo: null,
    nota: 'Libero'
  };

  if (assentiSet.has(operaioId)) {
    const ass = assenzeByOperaio.get(operaioId);
    return {
      ...base,
      statoDisponibilita: IMPEGNO_STATO_ASSENTE,
      assenzaTipo: ass?.tipo || ass?.tipoLabel || null,
      nota: ass?.tipoLabel || ass?.tipo
        ? `Assente (${ass.tipoLabel || ass.tipo})`
        : 'Assente confermato'
    };
  }

  if (prestati.has(operaioId)) {
    const p = prestati.get(operaioId);
    return {
      ...base,
      statoDisponibilita: IMPEGNO_STATO_PRESTATO,
      lavoroId: p.lavoroId,
      lavoroNome: p.lavoroNome,
      nota: p.versoLavoroId
        ? `Prestato da «${p.lavoroNome}» verso altro lavoro`
        : `Prestato da «${p.lavoroNome}»`
    };
  }

  if (sostituti.has(operaioId)) {
    const s = sostituti.get(operaioId);
    return {
      ...base,
      statoDisponibilita: IMPEGNO_STATO_SOSTITUTO,
      lavoroId: s.lavoroId,
      lavoroNome: s.lavoroNome,
      nota: `Sostituto su «${s.lavoroNome}»`
    };
  }

  // Impegno: preferisci lavori del giorno, fallback a tutti (coerente shortlist)
  const pool = lavoriGiorno.length ? lavoriGiorno : lavori;
  const impegno = findImpegnoLavoroOperaio(operaioId, pool, squadreMap, null);
  if (impegno) {
    // Se risulta solo per squadra ma è in assenti del giorno sul lavoro → già gestito sopra
    const slice = getEquipaggioSliceForGiorno(impegno, giornoKey);
    if (slice.assenti.includes(operaioId)) {
      return {
        ...base,
        statoDisponibilita: IMPEGNO_STATO_ASSENTE,
        lavoroId: impegno.id,
        lavoroNome: impegno.nome || impegno.tipoLavoro || impegno.id,
        nota: 'Assente sul lavoro (equipaggio giorno)'
      };
    }
    const nomeLav = impegno.nome || impegno.tipoLavoro || impegno.id;
    return {
      ...base,
      statoDisponibilita: IMPEGNO_STATO_IMPEGNATO,
      lavoroId: impegno.id,
      lavoroNome: nomeLav,
      nota: `Impegnato su «${nomeLav}»`
    };
  }

  return base;
}

/**
 * Aggregato per lavoro del giorno.
 *
 * @param {Object} options
 * @param {Object} options.lavoro
 * @param {string} options.giornoKey
 * @param {Array<Object>} options.squadreList
 * @param {Map<string, Object>} options.operaiById
 * @param {number|null} [options.equipaggioMinimo]
 */
export function buildImpegnoLavoroRow(options = {}) {
  const {
    lavoro,
    giornoKey,
    squadreList = [],
    operaiById = new Map(),
    equipaggioMinimo = null
  } = options;

  if (!lavoro?.id) return null;

  const previstiIds = resolvePrevistiOperaioIds(lavoro, squadreList, giornoKey);
  const slice = getEquipaggioSliceForGiorno(lavoro, giornoKey);
  const rosterSlice = getRosterSlice(lavoro, giornoKey);
  const rosterMaterializzato = isRosterMaterializzato(rosterSlice);
  const assentiIds = [
    ...new Set(
      [
        ...slice.assenti,
        lavoro.standbyOperaioId,
        lavoro.assenzaOperaioAssenteId
      ].filter(Boolean)
    )
  ];
  const sostitutiIds = [
    ...new Set(
      [
        ...slice.sostituzioni.map((s) => s.sostitutoOperaioId),
        lavoro.assenzaSostitutoOperaioId
      ].filter(Boolean)
    )
  ];

  const check = evaluateEquipaggioMinimo({
    minPersone: equipaggioMinimo,
    previstiIds,
    assentiIds,
    sostitutiIds
  });

  const attiviIds = rosterMaterializzato
    ? getRosterAttiviIds(rosterSlice)
    : null;
  const attiviCount = attiviIds != null ? attiviIds.length : check.attivi;
  const incompleto =
    check.applicabile && equipaggioMinimo != null
      ? attiviCount < equipaggioMinimo
      : false;
  const mancanti = incompleto ? Math.max(0, equipaggioMinimo - attiviCount) : 0;

  const labelOp = (id) => {
    const op = operaiById.get(id);
    return op ? nomeOperaio(op) : id;
  };

  return {
    lavoroId: lavoro.id,
    lavoroNome: lavoro.nome || lavoro.tipoLavoro || lavoro.id,
    stato: lavoro.stato || 'assegnato',
    caposquadraId: lavoro.caposquadraId || null,
    operaioId: lavoro.operaioId || null,
    isSquadra: Boolean(lavoro.caposquadraId && !lavoro.operaioId),
    previstiIds,
    previstiNomi: previstiIds.map(labelOp),
    assentiIds,
    assentiNomi: assentiIds.map(labelOp),
    sostitutiIds,
    sostitutiNomi: sostitutiIds.map(labelOp),
    rosterMaterializzato,
    partecipazioni: rosterMaterializzato ? rosterSlice.partecipazioni : [],
    attiviIds: attiviIds || [],
    attiviNomi: (attiviIds || []).map(labelOp),
    equipaggioMinimo: check.minPersone,
    equipaggioAttivi: attiviCount,
    equipaggioIncompleto: incompleto,
    equipaggioMancanti: mancanti
  };
}

/**
 * Costruisce l'intero snapshot giorno (puro).
 *
 * @param {Object} input
 * @param {string} input.giornoKey
 * @param {Array<Object>} input.operaiList
 * @param {Array<Object>} input.lavoriList
 * @param {Array<Object>} input.squadreList
 * @param {Array<Object>} input.assenzeConfermate — già filtrate sul giorno
 * @param {Map<string, number|null>|Object} [input.equipaggioMinimoByLavoroId]
 */
export function buildImpegniGiornoSnapshot(input = {}) {
  const {
    giornoKey,
    operaiList = [],
    lavoriList = [],
    squadreList = [],
    assenzeConfermate = [],
    equipaggioMinimoByLavoroId = {}
  } = input;

  const lavoriGiorno = (lavoriList || []).filter((l) =>
    lavoroCopreGiornoKey(giornoKey, l)
  );

  const squadreMap = buildOperaioSquadreMap(squadreList);
  const assentiSet = new Set(
    (assenzeConfermate || []).map((a) => a.operaioId).filter(Boolean)
  );
  const assenzeByOperaio = new Map();
  for (const a of assenzeConfermate || []) {
    if (a.operaioId) assenzeByOperaio.set(a.operaioId, a);
  }

  const { prestati, sostituti } = indexMovimentiGiorno(lavoriGiorno, giornoKey);

  const operaiById = new Map();
  for (const op of operaiList || []) {
    const id = op.id || op.uid;
    if (id) operaiById.set(id, op);
  }

  const perOperaio = [];
  for (const op of operaiList || []) {
    const row = buildImpegnoOperaioRow({
      operaio: op,
      giornoKey,
      lavori: lavoriList,
      lavoriGiorno,
      squadreMap,
      assentiSet,
      assenzeByOperaio,
      prestati,
      sostituti
    });
    if (row) perOperaio.push(row);
  }

  perOperaio.sort((a, b) => {
    const order = {
      [IMPEGNO_STATO_ASSENTE]: 0,
      [IMPEGNO_STATO_PRESTATO]: 1,
      [IMPEGNO_STATO_SOSTITUTO]: 2,
      [IMPEGNO_STATO_IMPEGNATO]: 3,
      [IMPEGNO_STATO_LIBERO]: 4
    };
    const da = order[a.statoDisponibilita] ?? 9;
    const db = order[b.statoDisponibilita] ?? 9;
    if (da !== db) return da - db;
    return (a.nome || '').localeCompare(b.nome || '', 'it');
  });

  const minMap =
    equipaggioMinimoByLavoroId instanceof Map
      ? equipaggioMinimoByLavoroId
      : new Map(Object.entries(equipaggioMinimoByLavoroId || {}));

  const perLavoro = lavoriGiorno
    .map((lav) =>
      buildImpegnoLavoroRow({
        lavoro: lav,
        giornoKey,
        squadreList,
        operaiById,
        equipaggioMinimo: minMap.has(lav.id) ? minMap.get(lav.id) : null
      })
    )
    .filter(Boolean)
    .sort((a, b) => (a.lavoroNome || '').localeCompare(b.lavoroNome || '', 'it'));

  const kpi = {
    totaleOperai: perOperaio.length,
    liberi: perOperaio.filter((r) => r.statoDisponibilita === IMPEGNO_STATO_LIBERO).length,
    impegnati: perOperaio.filter((r) =>
      [IMPEGNO_STATO_IMPEGNATO, IMPEGNO_STATO_SOSTITUTO].includes(r.statoDisponibilita)
    ).length,
    assenti: perOperaio.filter((r) => r.statoDisponibilita === IMPEGNO_STATO_ASSENTE).length,
    prestati: perOperaio.filter((r) => r.statoDisponibilita === IMPEGNO_STATO_PRESTATO).length,
    lavoriGiorno: perLavoro.length,
    equipaggioIncompleti: perLavoro.filter((r) => r.equipaggioIncompleto).length
  };

  return {
    giornoKey,
    perOperaio,
    perLavoro,
    kpi
  };
}

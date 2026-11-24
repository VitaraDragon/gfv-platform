/**
 * Aggregati puri Report Manodopera (per operaio / caposquadra / terreno).
 * Nessuna I/O: pensato per unit test.
 *
 * Contano solo ore validate. Tariffa mancante → costo null + nota (mai zero silenzioso).
 * Proprietario (diario) come riga separata.
 *
 * @module modules/report/services/report-manodopera-aggregate
 */

import {
  chiaveLavoroDiario,
  dataIsoFromAny,
  euro,
  euroPerHa
} from './report-economici-aggregate.js';

export const PROPRIETARIO_ID = '__proprietario__';
export const PROPRIETARIO_NOME = 'Proprietario (diario)';
export const PROPRIETARIO_TIPO = 'proprietario';

/**
 * Chiavi lavoro→diario come Economici (`terreno|data|tipo`).
 * @param {Array<{ terrenoId?: string, dataInizio?: *, data?: *, tipoLavoro?: string }>} lavori
 * @returns {Set<string>}
 */
export function buildChiaviLavoroDiario(lavori) {
  const set = new Set();
  for (const lav of lavori || []) {
    if (!lav || !lav.terrenoId) continue;
    set.add(chiaveLavoroDiario(
      lav.terrenoId,
      dataIsoFromAny(lav.dataInizio || lav.data),
      lav.tipoLavoro || ''
    ));
  }
  return set;
}

/**
 * Diario proprietario (attività senza lavoroId), allineato a Economici:
 * salta attività già coperte da un lavoro (stessa chiave terreno|data|tipo).
 *
 * @param {object[]} attivitaDocs
 * @param {Map<string, object>} terrenoById
 * @param {{ tariffaProprietario?: number, tariffaProprietarioConfigurata?: boolean }} tariffe
 * @param {Set<string>} [chiaviLavoro]
 * @returns {ManodoperaLine[]}
 */
export function buildProprietarioLines(attivitaDocs, terrenoById, tariffe, chiaviLavoro) {
  /** @type {ManodoperaLine[]} */
  const lines = [];
  const configured = !!(tariffe && tariffe.tariffaProprietarioConfigurata);
  const tariffa = Number(tariffe && tariffe.tariffaProprietario) || 0;
  const keys = chiaviLavoro instanceof Set ? chiaviLavoro : new Set();

  for (const a of attivitaDocs || []) {
    if (!a || a.lavoroId || a.clienteId) continue;
    if (!a.terrenoId || !terrenoById.has(String(a.terrenoId))) continue;
    const ore = Number(a.oreNette) || 0;
    if (ore <= 0) continue;
    const dataIso = dataIsoFromAny(a.data);
    const tipoLavoro = a.tipoLavoro || '';
    if (keys.has(chiaveLavoroDiario(a.terrenoId, dataIso, tipoLavoro))) continue;
    const t = terrenoById.get(String(a.terrenoId));
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
      terrenoId: String(a.terrenoId),
      terrenoNome: t ? (t.nome || t.podere || a.terrenoId) : String(a.terrenoId),
      ettari: t && t.superficie != null ? Number(t.superficie) : null,
      dataIso,
      tipoLavoro,
      lavoroId: null,
      attivitaId: a.id ? String(a.id) : null,
      caposquadraId: null,
      caposquadraNome: null
    });
  }
  return lines;
}

/**
 * Somma nullable: null se tutti mancanti; partial se mix.
 * @param {Array<number|null|undefined>} values
 * @param {boolean} [anyMissing]
 * @returns {{ value: number|null, partial: boolean }}
 */
export function sumNullableCosts(values, anyMissing = false) {
  let sum = 0;
  let known = 0;
  let missing = !!anyMissing;
  for (const v of values || []) {
    if (v == null || Number.isNaN(Number(v))) {
      missing = true;
      continue;
    }
    known += 1;
    sum += Number(v);
  }
  if (known === 0) {
    return { value: missing ? null : 0, partial: false };
  }
  return { value: euro(sum), partial: missing };
}

/**
 * @typedef {object} ManodoperaLine
 * @property {string} operaioId
 * @property {string} nome
 * @property {string} tipo
 * @property {boolean} isProprietario
 * @property {number} ore
 * @property {number|null} tariffa
 * @property {boolean} tariffaMissing
 * @property {number|null} costo
 * @property {string|null} terrenoId
 * @property {string} terrenoNome
 * @property {number|null} ettari
 * @property {string|null} lavoroId
 * @property {string|null} caposquadraId
 * @property {string|null} caposquadraNome
 */

/**
 * Aggrega per operaio (proprietario incluso come riga dedicata).
 * @param {ManodoperaLine[]} lines
 * @returns {Array<object>}
 */
export function aggregateByOperaio(lines) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const line of lines || []) {
    if (!line || !(Number(line.ore) > 0)) continue;
    const id = String(line.operaioId || '');
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, {
        operaioId: id,
        nome: line.nome || id,
        tipo: line.tipo || '',
        isProprietario: !!line.isProprietario,
        ore: 0,
        tariffa: line.tariffaMissing ? null : (line.tariffa != null ? Number(line.tariffa) : null),
        tariffaMissing: false,
        costoKnown: 0,
        costoMissing: false,
        lavoriIds: new Set(),
        attivitaIds: new Set(),
        terreniIds: new Set()
      });
    }
    const row = map.get(id);
    row.ore += Number(line.ore) || 0;
    if (line.tariffaMissing || line.costo == null) {
      row.tariffaMissing = true;
      row.costoMissing = true;
      row.tariffa = null;
    } else {
      row.costoKnown += Number(line.costo) || 0;
      if (row.tariffa == null && line.tariffa != null) row.tariffa = Number(line.tariffa);
    }
    if (line.lavoroId) row.lavoriIds.add(String(line.lavoroId));
    if (line.attivitaId) row.attivitaIds.add(String(line.attivitaId));
    if (line.terrenoId) row.terreniIds.add(String(line.terrenoId));
  }

  const rows = [...map.values()].map((r) => {
    const costo = r.costoMissing
      ? (r.costoKnown > 0 ? euro(r.costoKnown) : null)
      : euro(r.costoKnown);
    // Proprietario: niente «0 lavori» fuorviante — in colonna lavori mostriamo «—»
    // (le attività diario restano in nAttivita per eventuale dettaglio).
    const nLavori = r.isProprietario ? null : r.lavoriIds.size;
    return {
      operaioId: r.operaioId,
      nome: r.nome,
      tipo: r.tipo,
      isProprietario: r.isProprietario,
      ore: euro(r.ore) || 0,
      tariffa: r.tariffaMissing ? null : r.tariffa,
      tariffaMissing: r.tariffaMissing,
      costo: r.costoMissing && !(r.costoKnown > 0) ? null : costo,
      partialCosto: r.costoMissing && r.costoKnown > 0,
      nLavori,
      nAttivita: r.isProprietario ? r.attivitaIds.size : null,
      nTerreni: r.terreniIds.size,
      note: r.tariffaMissing ? 'Tariffa oraria non impostata' : ''
    };
  });

  rows.sort((a, b) => {
    if (a.isProprietario !== b.isProprietario) return a.isProprietario ? 1 : -1;
    return String(a.nome).localeCompare(String(b.nome), 'it');
  });
  return rows;
}

/**
 * Aggrega per caposquadra (`caposquadraId` sul lavoro). Solo linee con caposquadra.
 * @param {ManodoperaLine[]} lines
 * @returns {Array<object>}
 */
export function aggregateByCaposquadra(lines) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const line of lines || []) {
    if (!line || !(Number(line.ore) > 0)) continue;
    if (line.isProprietario) continue;
    const cid = line.caposquadraId ? String(line.caposquadraId) : '';
    if (!cid) continue;
    if (!map.has(cid)) {
      map.set(cid, {
        caposquadraId: cid,
        nome: line.caposquadraNome || cid,
        ore: 0,
        costoKnown: 0,
        costoMissing: false,
        nOperai: new Set(),
        nLavori: new Set()
      });
    }
    const row = map.get(cid);
    row.ore += Number(line.ore) || 0;
    if (line.tariffaMissing || line.costo == null) {
      row.costoMissing = true;
    } else {
      row.costoKnown += Number(line.costo) || 0;
    }
    if (line.operaioId) row.nOperai.add(String(line.operaioId));
    if (line.lavoroId) row.nLavori.add(String(line.lavoroId));
  }

  return [...map.values()]
    .map((r) => ({
      caposquadraId: r.caposquadraId,
      nome: r.nome,
      ore: euro(r.ore) || 0,
      costo: r.costoMissing && !(r.costoKnown > 0)
        ? null
        : euro(r.costoKnown),
      partialCosto: r.costoMissing && r.costoKnown > 0,
      nOperai: r.nOperai.size,
      nLavori: r.nLavori.size,
      note: r.costoMissing ? 'Tariffa oraria non impostata' : ''
    }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));
}

/**
 * Aggrega per terreno (ore, costo, €/ha).
 * @param {ManodoperaLine[]} lines
 * @returns {Array<object>}
 */
export function aggregateByTerreno(lines) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const line of lines || []) {
    if (!line || !(Number(line.ore) > 0)) continue;
    const tid = line.terrenoId ? String(line.terrenoId) : '';
    if (!tid) continue;
    if (!map.has(tid)) {
      map.set(tid, {
        terrenoId: tid,
        terrenoNome: line.terrenoNome || tid,
        ettari: line.ettari != null ? Number(line.ettari) : null,
        ore: 0,
        costoKnown: 0,
        costoMissing: false
      });
    }
    const row = map.get(tid);
    row.ore += Number(line.ore) || 0;
    if (line.tariffaMissing || line.costo == null) {
      row.costoMissing = true;
    } else {
      row.costoKnown += Number(line.costo) || 0;
    }
    if (row.ettari == null && line.ettari != null) row.ettari = Number(line.ettari);
  }

  return [...map.values()]
    .map((r) => {
      const costo = r.costoMissing && !(r.costoKnown > 0)
        ? null
        : euro(r.costoKnown);
      const partial = r.costoMissing && r.costoKnown > 0;
      return {
        terrenoId: r.terrenoId,
        terrenoNome: r.terrenoNome,
        ettari: r.ettari,
        ore: euro(r.ore) || 0,
        costo,
        partialCosto: partial,
        euroHa: euroPerHa(costo, r.ettari),
        note: r.costoMissing ? 'Tariffa oraria non impostata' : ''
      };
    })
    .sort((a, b) => String(a.terrenoNome).localeCompare(String(b.terrenoNome), 'it'));
}

/**
 * KPI riquadri: ore totali, costo, n. operai (escluso proprietario dal conteggio “operai”?
 * Prompt: n. operai — tipicamente chi ha ore validate. Incluso proprietario come “persona”?
 * Meglio: n. operai = righe non-proprietario; KPI ore/costo includono tutto.
 * €/ora medio = costo / ore (solo se costo noto completo).
 *
 * @param {Array<object>} byOperaio
 * @returns {object}
 */
export function buildManodoperaKpi(byOperaio) {
  let ore = 0;
  let costoKnown = 0;
  let costoMissing = false;
  let nOperai = 0;
  let nPersone = 0;

  for (const r of byOperaio || []) {
    if (!r) continue;
    ore += Number(r.ore) || 0;
    nPersone += 1;
    if (!r.isProprietario) nOperai += 1;
    if (r.tariffaMissing || r.costo == null) {
      costoMissing = true;
      if (r.costo != null) costoKnown += Number(r.costo) || 0;
    } else {
      costoKnown += Number(r.costo) || 0;
    }
  }

  const costo = costoMissing && !(costoKnown > 0)
    ? null
    : euro(costoKnown);
  const partialCosto = costoMissing && costoKnown > 0;
  let euroOraMedio = null;
  if (costo != null && ore > 0 && !costoMissing) {
    euroOraMedio = euro(costo / ore);
  } else if (costo != null && ore > 0 && partialCosto) {
    euroOraMedio = euro(costo / ore);
  }

  return {
    oreTotali: euro(ore) || 0,
    costoTotale: costo,
    partialCosto,
    nOperai,
    nPersone,
    euroOraMedio: euroOraMedio == null ? null : euroOraMedio,
    partialEuroOra: partialCosto
  };
}

/**
 * Filtra linee (periodo già applicato a monte).
 * @param {ManodoperaLine[]} lines
 * @param {{ terrenoId?: string|null, operaioId?: string|null, caposquadraId?: string|null }} filters
 * @returns {ManodoperaLine[]}
 */
export function filterManodoperaLines(lines, filters = {}) {
  const terrenoId = filters.terrenoId ? String(filters.terrenoId) : '';
  const operaioId = filters.operaioId ? String(filters.operaioId) : '';
  const caposquadraId = filters.caposquadraId ? String(filters.caposquadraId) : '';

  return (lines || []).filter((line) => {
    if (!line) return false;
    if (terrenoId && String(line.terrenoId || '') !== terrenoId) return false;
    if (operaioId) {
      if (operaioId === PROPRIETARIO_ID) {
        if (!line.isProprietario) return false;
      } else if (String(line.operaioId || '') !== operaioId) {
        return false;
      }
    }
    if (caposquadraId) {
      if (line.isProprietario) return false;
      if (String(line.caposquadraId || '') !== caposquadraId) return false;
    }
    return true;
  });
}

/**
 * Assembla report completo da linee + meta.
 * @param {{ lines: ManodoperaLine[], oreDaValidare?: number, hasCaposquadraData?: boolean }} input
 * @param {{ terrenoId?: string|null, operaioId?: string|null, caposquadraId?: string|null }} [filters]
 */
export function assembleManodoperaReport(input, filters = {}) {
  const filtered = filterManodoperaLines(input.lines || [], filters);
  const byOperaio = aggregateByOperaio(filtered);
  const byCaposquadra = aggregateByCaposquadra(filtered);
  const byTerreno = aggregateByTerreno(filtered);
  const kpi = buildManodoperaKpi(byOperaio);

  /** @type {string[]} */
  const notes = [];
  const oreDaValidare = Number(input.oreDaValidare) || 0;
  if (oreDaValidare > 0) {
    const nLabel = Number.isInteger(oreDaValidare)
      ? String(oreDaValidare)
      : String(oreDaValidare).replace('.', ',');
    notes.push(`${nLabel} ore ancora da validare nel periodo (non incluse)`);
  }
  if (byOperaio.some((r) => r.tariffaMissing) || byTerreno.some((r) => r.note)) {
    notes.push('Tariffa oraria non impostata: i costi con * sono parziali o mancanti (mai zero silenzioso).');
  }
  if (input.hasCaposquadraData === false) {
    notes.push('Nessun lavoro con caposquadra nel periodo filtrato.');
  }

  const empty = (kpi.oreTotali || 0) === 0 && byOperaio.length === 0;

  return {
    byOperaio,
    byCaposquadra,
    byTerreno,
    kpi,
    notes,
    oreDaValidare,
    hasCaposquadraData: byCaposquadra.length > 0,
    empty,
    ready: true
  };
}

/**
 * Somma costo manodopera dalle linee (stessa regola partial dei KPI).
 * @param {ManodoperaLine[]} lines
 * @returns {{ value: number|null, partial: boolean }}
 */
export function sumCostoManodoperaLines(lines) {
  return sumNullableCosts(
    (lines || []).map((l) => (l && l.costo != null ? l.costo : null)),
    (lines || []).some((l) => l && (l.tariffaMissing || l.costo == null) && (Number(l.ore) > 0))
  );
}

/**
 * Prepara fogli export Excel (stesso stile di Economici: filtri in intestazione).
 * @param {object} report — output assembleManodoperaReport
 * @param {object} meta
 */
export function prepareManodoperaExportData(report, meta = {}) {
  const periodoLabel = meta.periodoLabel || '';
  const filtroTerreno = meta.terrenoNome || (meta.terrenoId ? String(meta.terrenoId) : 'Tutti');
  const filtroOperaio = meta.operaioNome || (meta.operaioId ? String(meta.operaioId) : 'Tutti');
  const filtroCapo = meta.caposquadraNome || (meta.caposquadraId ? String(meta.caposquadraId) : 'Tutti');

  const perOperaio = (report.byOperaio || []).map((r) => ({
    nome: r.nome,
    tipo: r.tipo,
    ore: r.ore,
    tariffa: r.tariffa,
    costo: r.costo,
    nLavori: r.nLavori,
    nTerreni: r.nTerreni,
    noteParziale: r.tariffaMissing || r.partialCosto ? (r.note || 'parziale') : ''
  }));

  const perCaposquadra = (report.byCaposquadra || []).map((r) => ({
    nome: r.nome,
    ore: r.ore,
    costo: r.costo,
    nOperai: r.nOperai,
    nLavori: r.nLavori,
    noteParziale: r.partialCosto || r.costo == null ? (r.note || 'parziale') : ''
  }));

  const perTerreno = (report.byTerreno || []).map((r) => ({
    terrenoNome: r.terrenoNome,
    ettari: r.ettari,
    ore: r.ore,
    costo: r.costo,
    euroHa: r.euroHa,
    noteParziale: r.partialCosto || r.costo == null ? (r.note || 'parziale') : ''
  }));

  const kpi = report.kpi || {};
  const noteRows = [
    `Periodo: ${periodoLabel}`,
    `Filtro terreno: ${filtroTerreno}`,
    `Filtro operaio: ${filtroOperaio}`,
    `Filtro caposquadra: ${filtroCapo}`,
    ...(report.notes || [])
  ];

  return {
    periodoLabel,
    filtroTerreno,
    filtroOperaio,
    filtroCapo,
    perOperaio,
    perCaposquadra,
    perTerreno,
    kpi: {
      oreTotali: kpi.oreTotali,
      costoTotale: kpi.costoTotale,
      nOperai: kpi.nOperai,
      euroOraMedio: kpi.euroOraMedio
    },
    noteRows
  };
}

/**
 * True se il report può mostrare cifre (bundle pronto).
 * @param {object|null} report
 */
export function isManodoperaDataReady(report) {
  return !!(report && report.ready);
}

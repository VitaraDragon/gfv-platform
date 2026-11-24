/**
 * Aggregati puri Report Macchine (per mezzo / tipo / grafici).
 * Nessuna I/O: pensato per unit test.
 *
 * Contano solo ore macchina validate nei costi. Da validare separate.
 * Costo orario mancante → costo null + badge (mai zero silenzioso).
 * Carburante (pieno) e guasti sono metadati operativi, non inventano costi Economici.
 *
 * @module modules/report/services/report-macchine-aggregate
 */

import {
  chiaveLavoroDiario,
  dataIsoFromAny,
  euro,
  euroPerHa,
  prodottoCostFromMovimentoUscita
} from './report-economici-aggregate.js';
import { isGuastoAttivo } from '../../../core/services/guasto-stati.js';
import { idMezziCoinvolti } from '../../../core/services/guasto-ripristino.js';
import {
  ORIGINE_PIENO,
  normalizeOrigineCarburante
} from '../../magazzino/lib/carburante-movimento.js';
import {
  manutenzioneStatus,
  resolveCostoOraMacchina
} from './report-macchine-shared.js';

/**
 * @typedef {object} MacchineLine
 * @property {string} macchinaId
 * @property {string} nome
 * @property {string} tipoMezzo — trattore | attrezzo | …
 * @property {number} ore
 * @property {number|null} costoOra
 * @property {boolean} costoOraMissing
 * @property {number|null} costo
 * @property {string|null} terrenoId
 * @property {string} terrenoNome
 * @property {number|null} ettari
 * @property {string|null} lavoroId
 * @property {string|null} attivitaId
 * @property {string|null} dataIso
 * @property {string} tipoLavoro
 * @property {string|null} operaioId
 * @property {string|null} operaioNome
 * @property {string} origine — lavoro | diario
 */

/**
 * Somma nullable (stessa regola Manodopera/Economici).
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
 * Ettari lavorati: superficie del terreno, una volta per lavoro (o attività).
 * @param {MacchineLine[]} lines
 * @returns {number|null}
 */
export function ettariLavoratiFromLines(lines) {
  /** @type {Map<string, number>} */
  const bySource = new Map();
  for (const line of lines || []) {
    if (!line || !(Number(line.ore) > 0)) continue;
    const ha = line.ettari != null ? Number(line.ettari) : null;
    if (ha == null || !(ha > 0) || Number.isNaN(ha)) continue;
    const key = line.lavoroId
      ? `l:${line.lavoroId}`
      : (line.attivitaId ? `a:${line.attivitaId}` : `t:${line.terrenoId || ''}|${line.dataIso || ''}`);
    if (!bySource.has(key)) bySource.set(key, ha);
  }
  if (!bySource.size) return null;
  let sum = 0;
  for (const ha of bySource.values()) sum += ha;
  return euro(sum);
}

/**
 * @param {string|null|undefined} tipo
 * @returns {string}
 */
export function labelTipoMezzo(tipo) {
  const raw = String(tipo || '').trim().toLowerCase();
  if (!raw) return 'Non classificato';
  const map = {
    trattore: 'Trattore',
    attrezzo: 'Attrezzo',
    automezzo: 'Automezzo',
    veicolo: 'Veicolo',
    furgone: 'Furgone'
  };
  if (map[raw]) return map[raw];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Filtra linee.
 * @param {MacchineLine[]} lines
 * @param {{ terrenoId?: string|null, macchinaId?: string|null, tipoMezzo?: string|null }} filters
 */
export function filterMacchineLines(lines, filters = {}) {
  const terrenoId = filters.terrenoId ? String(filters.terrenoId) : '';
  const macchinaId = filters.macchinaId ? String(filters.macchinaId) : '';
  const tipoMezzo = filters.tipoMezzo ? String(filters.tipoMezzo).toLowerCase() : '';

  return (lines || []).filter((line) => {
    if (!line) return false;
    if (terrenoId && String(line.terrenoId || '') !== terrenoId) return false;
    if (macchinaId && String(line.macchinaId || '') !== macchinaId) return false;
    if (tipoMezzo) {
      const t = String(line.tipoMezzo || '').toLowerCase();
      if (tipoMezzo === 'trattore') {
        if (t !== 'trattore') return false;
      } else if (tipoMezzo === 'attrezzo') {
        if (t !== 'attrezzo') return false;
      } else if (t !== tipoMezzo) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Aggrega per mezzo.
 * @param {MacchineLine[]} lines
 * @param {{
 *   macchineMetaById?: Map<string, object>,
 *   carburanteByMacchinaId?: Map<string, object>,
 *   guastiByMacchinaId?: Map<string, object>
 * }} [extra]
 */
export function aggregateByMezzo(lines, extra = {}) {
  const metaById = extra.macchineMetaById || new Map();
  const carbById = extra.carburanteByMacchinaId || new Map();
  const guastiById = extra.guastiByMacchinaId || new Map();

  /** @type {Map<string, object>} */
  const map = new Map();
  for (const line of lines || []) {
    if (!line || !(Number(line.ore) > 0)) continue;
    const id = String(line.macchinaId || '');
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, {
        macchinaId: id,
        nome: line.nome || id,
        tipoMezzo: line.tipoMezzo || '',
        ore: 0,
        costoOra: line.costoOraMissing ? null : (line.costoOra != null ? Number(line.costoOra) : null),
        costoOraMissing: false,
        costoKnown: 0,
        costoMissing: false,
        lines: [],
        lavoriIds: new Set()
      });
    }
    const row = map.get(id);
    row.ore += Number(line.ore) || 0;
    row.lines.push(line);
    if (line.lavoroId) row.lavoriIds.add(String(line.lavoroId));
    if (line.costoOraMissing || line.costo == null) {
      row.costoOraMissing = true;
      row.costoMissing = true;
      row.costoOra = null;
    } else {
      row.costoKnown += Number(line.costo) || 0;
      if (row.costoOra == null && line.costoOra != null) row.costoOra = Number(line.costoOra);
    }
  }

  // Includi mezzi con solo carburante/guasti nel periodo (senza ore) se filtrati via extra maps? No:
  // la tabella «Per mezzo» è sui mezzi con ore; dettaglio mostra pieni/guasti.
  // Mezzi solo-guasti/pieno senza ore non entrano in byMezzo (periodo vuoto se zero ore).

  return [...map.values()].map((r) => {
    const costo = r.costoMissing
      ? (r.costoKnown > 0 ? euro(r.costoKnown) : null)
      : euro(r.costoKnown);
    const ettari = ettariLavoratiFromLines(r.lines);
    const meta = metaById.get(r.macchinaId) || {};
    const manut = manutenzioneStatus(meta);
    const carb = carbById.get(r.macchinaId) || { litri: 0, costo: null, costoMissing: false, movimenti: [] };
    const guasti = guastiById.get(r.macchinaId) || { segnalati: 0, aperti: 0, items: [] };
    const litri = Number(carb.litri) || 0;
    const litriOra = (Number(r.ore) > 0 && litri > 0) ? euro(litri / Number(r.ore)) : null;

    return {
      macchinaId: r.macchinaId,
      nome: r.nome,
      tipoMezzo: r.tipoMezzo || meta.tipoMacchina || meta.tipo || '',
      ore: euro(r.ore) || 0,
      costoOra: r.costoOraMissing ? null : r.costoOra,
      costoOraMissing: r.costoOraMissing,
      costo: r.costoMissing && !(r.costoKnown > 0) ? null : costo,
      partialCosto: r.costoMissing && r.costoKnown > 0,
      ettari,
      euroHa: euroPerHa(r.costoMissing && !(r.costoKnown > 0) ? null : costo, ettari),
      nLavori: r.lavoriIds.size,
      litri,
      litriOra,
      costoCarburante: carb.costo == null ? null : euro(carb.costo),
      carburanteCostoMissing: !!carb.costoMissing,
      guastiSegnalati: guasti.segnalati || 0,
      guastiAperti: guasti.aperti || 0,
      oreAttuali: manut.oreAttuali,
      oreProssimaManutenzione: manut.oreProssimaManutenzione,
      manutenzioneSuperata: manut.superata,
      note: r.costoOraMissing ? 'Costo orario non impostato' : ''
    };
  }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));
}

/**
 * KPI riquadri.
 * @param {Array<object>} byMezzo
 * @param {{ litriTotali?: number, guastiAperti?: number }} [extra]
 */
export function buildMacchineKpi(byMezzo, extra = {}) {
  let ore = 0;
  let costoKnown = 0;
  let costoMissing = false;
  let litri = Number(extra.litriTotali) || 0;
  let guastiAperti = Number(extra.guastiAperti) || 0;

  for (const r of byMezzo || []) {
    if (!r) continue;
    ore += Number(r.ore) || 0;
    if (r.costoOraMissing || r.costo == null) {
      costoMissing = true;
      if (r.costo != null) costoKnown += Number(r.costo) || 0;
    } else {
      costoKnown += Number(r.costo) || 0;
    }
    if (!(Number(extra.litriTotali) >= 0) || extra.litriTotali == null) {
      litri += Number(r.litri) || 0;
    }
    if (extra.guastiAperti == null) {
      guastiAperti += Number(r.guastiAperti) || 0;
    }
  }

  const costo = costoMissing && !(costoKnown > 0) ? null : euro(costoKnown);
  return {
    oreTotali: euro(ore) || 0,
    costoTotale: costo,
    partialCosto: costoMissing && costoKnown > 0,
    litriTotali: euro(litri) || 0,
    guastiAperti: guastiAperti || 0,
    nMezzi: (byMezzo || []).length
  };
}

/**
 * Costo per tipo mezzo (ciambella).
 * @param {MacchineLine[]} lines
 */
export function aggregateByTipoMezzo(lines) {
  /** @type {Map<string, { tipo: string, ore: number, costoKnown: number, costoMissing: boolean }>} */
  const map = new Map();
  for (const line of lines || []) {
    if (!line || !(Number(line.ore) > 0)) continue;
    const tipo = String(line.tipoMezzo || '').trim() || '__none__';
    if (!map.has(tipo)) map.set(tipo, { tipo, ore: 0, costoKnown: 0, costoMissing: false });
    const row = map.get(tipo);
    row.ore += Number(line.ore) || 0;
    if (line.costoOraMissing || line.costo == null) row.costoMissing = true;
    else row.costoKnown += Number(line.costo) || 0;
  }
  return [...map.values()]
    .map((r) => ({
      tipo: r.tipo === '__none__' ? '' : r.tipo,
      label: labelTipoMezzo(r.tipo === '__none__' ? '' : r.tipo),
      ore: euro(r.ore) || 0,
      costo: r.costoMissing && !(r.costoKnown > 0) ? null : euro(r.costoKnown),
      partialCosto: r.costoMissing && r.costoKnown > 0
    }))
    .sort((a, b) => (Number(b.costo) || 0) - (Number(a.costo) || 0)
      || String(a.label).localeCompare(String(b.label), 'it'));
}

/**
 * Barre costo: top N + Altri.
 * @param {Array<object>} byMezzo
 * @param {number} [topN=8]
 */
export function aggregateMacchineCostoForChart(byMezzo, topN = 8) {
  const attributed = [...(byMezzo || [])]
    .filter((r) => r && r.macchinaId)
    .map((r) => ({
      macchinaId: String(r.macchinaId),
      nome: r.nome || r.macchinaId,
      costo: r.costo == null ? null : Number(r.costo),
      ore: Number(r.ore) || 0
    }))
    .sort((a, b) => (Number(b.costo) || 0) - (Number(a.costo) || 0)
      || (Number(b.ore) || 0) - (Number(a.ore) || 0));

  const n = Math.max(0, topN);
  const top = attributed.slice(0, n);
  const rest = attributed.slice(n);
  const out = top.map((x) => ({
    macchinaId: x.macchinaId,
    nome: x.nome,
    costo: x.costo == null ? null : euro(x.costo),
    ore: euro(x.ore) || 0
  }));
  if (rest.length) {
    const altri = rest.reduce((acc, x) => {
      acc.ore += Number(x.ore) || 0;
      if (x.costo != null) acc.costoKnown += Number(x.costo) || 0;
      else acc.costoMissing = true;
      return acc;
    }, { ore: 0, costoKnown: 0, costoMissing: false });
    out.push({
      macchinaId: '__altri__',
      nome: 'Altri',
      costo: altri.costoMissing && !(altri.costoKnown > 0) ? null : euro(altri.costoKnown),
      ore: euro(altri.ore) || 0
    });
  }
  return out;
}

const MESI_IT_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/**
 * Ore macchina mensili validate + da validare.
 * @param {Array<{ dataIso?: string, ore?: number }>} linesValidate
 * @param {Array<{ dataIso?: string, ore?: number }>} [linesDaValidare]
 */
export function aggregateMonthlyOreMacchina(linesValidate, linesDaValidare = []) {
  /** @type {Map<string, { oreValidate: number, oreDaValidare: number }>} */
  const map = new Map();
  const bump = (list, field) => {
    for (const line of list || []) {
      if (!line || !(Number(line.ore) > 0)) continue;
      const iso = String(line.dataIso || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(iso)) continue;
      let bucket = map.get(iso);
      if (!bucket) {
        bucket = { oreValidate: 0, oreDaValidare: 0 };
        map.set(iso, bucket);
      }
      bucket[field] += Number(line.ore) || 0;
    }
  };
  bump(linesValidate, 'oreValidate');
  bump(linesDaValidare, 'oreDaValidare');

  return [...map.keys()].sort().map((key) => {
    const m = Number(key.slice(5, 7)) - 1;
    const label = `${MESI_IT_SHORT[m] || key} ${key.slice(0, 4)}`;
    const b = map.get(key) || { oreValidate: 0, oreDaValidare: 0 };
    const oreValidate = euro(b.oreValidate) || 0;
    const oreDaValidare = euro(b.oreDaValidare) || 0;
    return {
      key,
      label,
      oreValidate,
      oreDaValidare,
      oreTotali: euro(oreValidate + oreDaValidare) || 0
    };
  });
}

/**
 * Dettaglio ore per un mezzo.
 * @param {MacchineLine[]} lines
 * @param {string} macchinaId
 */
export function buildMezzoDetailRows(lines, macchinaId) {
  const id = String(macchinaId || '');
  if (!id) return [];
  const rows = (lines || [])
    .filter((line) => line && String(line.macchinaId || '') === id && Number(line.ore) > 0)
    .map((line) => ({
      dataIso: line.dataIso || null,
      terrenoNome: line.terrenoNome || '—',
      terrenoId: line.terrenoId || null,
      lavoro: line.tipoLavoro || (line.origine === 'diario' ? 'Diario' : '—'),
      lavoroId: line.lavoroId || null,
      operaioNome: line.operaioNome || '—',
      operaioId: line.operaioId || null,
      ore: euro(line.ore) || 0,
      costoOra: line.costoOraMissing ? null : (line.costoOra != null ? Number(line.costoOra) : null),
      costoOraMissing: !!line.costoOraMissing,
      costo: line.costo == null ? null : euro(line.costo)
    }));
  rows.sort((a, b) => {
    const da = String(a.dataIso || '');
    const db = String(b.dataIso || '');
    if (da !== db) return da.localeCompare(db);
    return String(a.terrenoNome).localeCompare(String(b.terrenoNome), 'it');
  });
  return rows;
}

/**
 * Movimenti pieno → litri / costo per macchina (prezzo solo se già presente).
 * Economici esclude `origineCarburante`: qui non si duplica la voce Economici.
 *
 * @param {Array<object>} movimenti
 * @param {Map<string, object>|null|undefined} prodottiById
 * @param {{ start?: Date, end?: Date }} [range]
 * @returns {Map<string, { litri: number, costo: number|null, costoMissing: boolean, movimenti: Array<object> }>}
 */
export function aggregateCarburantePienoByMacchina(movimenti, prodottiById, range = {}) {
  /** @type {Map<string, { litri: number, costoKnown: number, costoMissing: boolean, hasCosto: boolean, movimenti: Array<object> }>} */
  const map = new Map();

  for (const mov of movimenti || []) {
    if (!mov || mov.tipo !== 'uscita') continue;
    if (normalizeOrigineCarburante(mov.origineCarburante) !== ORIGINE_PIENO) continue;
    const mid = mov.macchinaId ? String(mov.macchinaId) : '';
    if (!mid) continue;
    if (range.start && range.end) {
      const iso = dataIsoFromAny(mov.data);
      if (iso && !inRangeIso(iso, range.start, range.end)) continue;
    }
    const litri = Number(mov.quantita) || 0;
    if (litri <= 0) continue;

    const prodAnag = prodottiById ? prodottiById.get(String(mov.prodottoId || '')) : null;
    const priced = prodottoCostFromMovimentoUscita(mov, prodAnag);
    const costo = priced.missingCarburante ? null : priced.costoCarburante;

    if (!map.has(mid)) {
      map.set(mid, {
        litri: 0,
        costoKnown: 0,
        costoMissing: false,
        hasCosto: false,
        movimenti: []
      });
    }
    const row = map.get(mid);
    row.litri += litri;
    if (costo == null || priced.missingCarburante) {
      row.costoMissing = true;
    } else {
      row.hasCosto = true;
      row.costoKnown += Number(costo) || 0;
    }
    row.movimenti.push({
      id: mov.id ? String(mov.id) : null,
      dataIso: dataIsoFromAny(mov.data),
      litri: euro(litri) || 0,
      costo: costo == null ? null : euro(costo),
      prodottoNome: (prodAnag && (prodAnag.nome || prodAnag.nomeCommerciale))
        || mov.prodottoNome
        || 'Carburante'
    });
  }

  /** @type {Map<string, { litri: number, costo: number|null, costoMissing: boolean, movimenti: Array<object> }>} */
  const out = new Map();
  for (const [id, r] of map) {
    out.set(id, {
      litri: euro(r.litri) || 0,
      costo: r.hasCosto ? euro(r.costoKnown) : null,
      costoMissing: r.costoMissing,
      movimenti: r.movimenti.sort((a, b) => String(a.dataIso || '').localeCompare(String(b.dataIso || '')))
    });
  }
  return out;
}

function inRangeIso(iso, start, end) {
  if (!iso) return true;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return true;
  return d >= start && d <= end;
}

/**
 * Guasti per mezzo: segnalati nel periodo + ancora aperti (isGuastoAttivo).
 * @param {Array<object>} guasti
 * @param {{ start: Date, end: Date }} range
 * @returns {Map<string, { segnalati: number, aperti: number, items: Array<object> }>}
 */
export function aggregateGuastiByMacchina(guasti, range) {
  /** @type {Map<string, { segnalati: number, aperti: number, items: Array<object> }>} */
  const map = new Map();
  const bump = (mid, g, inPeriod) => {
    if (!mid) return;
    if (!map.has(mid)) map.set(mid, { segnalati: 0, aperti: 0, items: [] });
    const row = map.get(mid);
    const attivo = isGuastoAttivo(g.stato);
    if (inPeriod) row.segnalati += 1;
    if (attivo) row.aperti += 1;
    if (inPeriod || attivo) {
      row.items.push({
        id: g.id ? String(g.id) : null,
        dataIso: dataIsoFromAny(g.segnalatoIl || g.createdAt || g.data),
        dettagli: g.dettagli || g.descrizione || '',
        stato: g.stato || '',
        attivo,
        inPeriodo: inPeriod
      });
    }
  };

  for (const g of guasti || []) {
    if (!g) continue;
    const dataIso = dataIsoFromAny(g.segnalatoIl || g.createdAt || g.data);
    const inPeriod = !!(dataIso && inRangeIso(dataIso, range.start, range.end));
    const mezzi = [...idMezziCoinvolti(g)];
    if (!mezzi.length && g.macchinaId) mezzi.push(String(g.macchinaId));
    for (const mid of mezzi) {
      // Conta aperti anche fuori periodo; segnalati solo nel periodo
      if (!inPeriod && !isGuastoAttivo(g.stato)) continue;
      bump(String(mid), g, inPeriod);
    }
  }
  return map;
}

/**
 * Totale costo macchine allineato a Economici (lavoro-level all-or-nothing + diario anti-doppio).
 * @param {Array<{ costoMacchine?: number|null, missingMacchine?: boolean, terrenoId?: string, dataIso?: string, tipoLavoro?: string }>} lavoriCosti
 * @param {Array<{ costoMacchine?: number|null, missingMacchine?: boolean, terrenoId?: string, dataIso?: string, tipoLavoro?: string, lavoroId?: string|null, clienteId?: string|null }>} attivitaCosti
 * @returns {{ value: number|null, partial: boolean }}
 */
export function sumCostoMacchineLikeEconomici(lavoriCosti, attivitaCosti) {
  const chiavi = new Set();
  /** @type {Array<number|null>} */
  const values = [];
  let anyMissing = false;

  for (const lav of lavoriCosti || []) {
    if (!lav || !lav.terrenoId) continue;
    chiavi.add(chiaveLavoroDiario(lav.terrenoId, lav.dataIso || '', lav.tipoLavoro || ''));
    if (lav.missingMacchine) {
      anyMissing = true;
      values.push(null);
    } else {
      values.push(lav.costoMacchine != null ? Number(lav.costoMacchine) : 0);
    }
  }
  for (const att of attivitaCosti || []) {
    if (!att || !att.terrenoId) continue;
    if (att.lavoroId || att.clienteId) continue;
    if (chiavi.has(chiaveLavoroDiario(att.terrenoId, att.dataIso || '', att.tipoLavoro || ''))) continue;
    if (att.missingMacchine) {
      anyMissing = true;
      values.push(null);
    } else {
      values.push(att.costoMacchine != null ? Number(att.costoMacchine) : 0);
    }
  }
  return sumNullableCosts(values, anyMissing);
}

/**
 * Assembla report.
 * @param {object} input
 * @param {{ terrenoId?: string|null, macchinaId?: string|null, tipoMezzo?: string|null }} [filters]
 */
export function assembleMacchineReport(input, filters = {}) {
  const filtered = filterMacchineLines(input.lines || [], filters);
  const filteredDaValidare = filterMacchineLines(input.linesDaValidare || [], filters);

  const carbAll = input.carburanteByMacchinaId || new Map();
  const guastiAll = input.guastiByMacchinaId || new Map();

  /** Filtra mappe extra per macchinaId se filtro mezzo */
  let carbMap = carbAll;
  let guastiMap = guastiAll;
  if (filters.macchinaId) {
    const mid = String(filters.macchinaId);
    carbMap = new Map();
    if (carbAll.has(mid)) carbMap.set(mid, carbAll.get(mid));
    guastiMap = new Map();
    if (guastiAll.has(mid)) guastiMap.set(mid, guastiAll.get(mid));
  }

  const byMezzo = aggregateByMezzo(filtered, {
    macchineMetaById: input.macchineMetaById,
    carburanteByMacchinaId: carbMap,
    guastiByMacchinaId: guastiMap
  });
  const byTipo = aggregateByTipoMezzo(filtered);
  const chartCosto = aggregateMacchineCostoForChart(byMezzo, 8);
  const chartMensile = aggregateMonthlyOreMacchina(filtered, filteredDaValidare);

  let litriTotali = 0;
  let guastiAperti = 0;
  for (const r of byMezzo) {
    litriTotali += Number(r.litri) || 0;
    guastiAperti += Number(r.guastiAperti) || 0;
  }
  // Se filtro terreno: i guasti/carburante restano legati al mezzo (non al terreno) —
  // mostriamo solo quelli dei mezzi presenti in byMezzo (già filtrati via ore/terreno).

  const kpi = buildMacchineKpi(byMezzo, { litriTotali, guastiAperti });

  /** @type {string[]} */
  const notes = [];
  const oreDaValidare = filteredDaValidare.reduce((s, l) => s + (Number(l && l.ore) || 0), 0);
  const oreDaValidareEuro = euro(oreDaValidare) || 0;
  if (oreDaValidareEuro > 0) {
    const nLabel = Number.isInteger(oreDaValidareEuro)
      ? String(oreDaValidareEuro)
      : String(oreDaValidareEuro).replace('.', ',');
    notes.push(`${nLabel} ore macchina ancora da validare nel periodo (non incluse nei costi)`);
  }
  if (byMezzo.some((r) => r.costoOraMissing)) {
    notes.push('Costo orario non impostato: i costi con * sono parziali o mancanti (mai zero silenzioso).');
  }
  notes.push('Carburante: solo pieni magazzino (origineCarburante=pieno). Economici li esclude dalle uscite — niente doppio conteggio.');

  const empty = (kpi.oreTotali || 0) === 0 && byMezzo.length === 0;

  return {
    byMezzo,
    byTipo,
    chartCosto,
    chartMensile,
    lines: filtered,
    kpi,
    notes,
    oreDaValidare: oreDaValidareEuro,
    carburanteByMacchinaId: carbMap,
    guastiByMacchinaId: guastiMap,
    costoMacchineEconomiciAligned: input.costoMacchineEconomiciAligned || null,
    empty,
    ready: true
  };
}

/**
 * @param {object} report
 * @param {object} meta
 */
export function prepareMacchineExportData(report, meta = {}) {
  const periodoLabel = meta.periodoLabel || '';
  const filtroTerreno = meta.terrenoNome || (meta.terrenoId ? String(meta.terrenoId) : 'Tutti');
  const filtroMezzo = meta.macchinaNome || (meta.macchinaId ? String(meta.macchinaId) : 'Tutti');
  const filtroTipo = meta.tipoMezzoLabel || (meta.tipoMezzo ? labelTipoMezzo(meta.tipoMezzo) : 'Tutti');

  const perMezzo = (report.byMezzo || []).map((r) => ({
    nome: r.nome,
    tipo: labelTipoMezzo(r.tipoMezzo),
    ore: r.ore,
    costoOra: r.costoOra,
    costo: r.costo,
    euroHa: r.euroHa,
    litri: r.litri,
    litriOra: r.litriOra,
    costoCarburante: r.costoCarburante,
    guastiSegnalati: r.guastiSegnalati,
    guastiAperti: r.guastiAperti,
    noteParziale: r.costoOraMissing || r.partialCosto ? (r.note || 'parziale') : ''
  }));

  const kpi = report.kpi || {};
  return {
    periodoLabel,
    filtroTerreno,
    filtroMezzo,
    filtroTipo,
    perMezzo,
    kpi: {
      oreTotali: kpi.oreTotali,
      costoTotale: kpi.costoTotale,
      litriTotali: kpi.litriTotali,
      guastiAperti: kpi.guastiAperti
    },
    noteRows: [
      `Periodo: ${periodoLabel}`,
      `Filtro terreno: ${filtroTerreno}`,
      `Filtro mezzo: ${filtroMezzo}`,
      `Filtro tipo: ${filtroTipo}`,
      ...(report.notes || [])
    ]
  };
}

export function isMacchineDataReady(report) {
  return !!(report && report.ready);
}

export function formatEuroPrefixCompact(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Math.round(Number(value));
  const sign = n < 0 ? '-' : '';
  const abs = String(Math.abs(n));
  const withDots = abs.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `€ ${sign}${withDots}`;
}

/**
 * Helper: costruisce una linea costo da ore + anagrafica.
 * @param {object} base
 * @param {Map<string, number>} macchineCostoById
 * @param {Map<string, object>} macchineMetaById
 */
export function buildMacchinaCostLine(base, macchineCostoById, macchineMetaById) {
  const mid = String(base.macchinaId || '');
  const meta = macchineMetaById.get(mid) || {};
  const resolved = resolveCostoOraMacchina(macchineCostoById, mid);
  const ore = Number(base.ore) || 0;
  const missing = resolved.missing;
  return {
    macchinaId: mid,
    nome: base.nome || meta.nome || meta.targa || meta.modello || mid,
    tipoMezzo: base.tipoMezzo || meta.tipoMacchina || meta.tipo || '',
    ore,
    costoOra: missing ? null : resolved.costoOra,
    costoOraMissing: missing,
    costo: missing ? null : euro(ore * resolved.costoOra),
    terrenoId: base.terrenoId || null,
    terrenoNome: base.terrenoNome || '—',
    ettari: base.ettari != null ? Number(base.ettari) : null,
    lavoroId: base.lavoroId || null,
    attivitaId: base.attivitaId || null,
    dataIso: base.dataIso || null,
    tipoLavoro: base.tipoLavoro || '',
    operaioId: base.operaioId || null,
    operaioNome: base.operaioNome || null,
    origine: base.origine || 'lavoro'
  };
}

export { chiaveLavoroDiario, manutenzioneStatus };

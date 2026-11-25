/**
 * Aggregati puri Report Frutteto (per frutteto / raccolte / grafici).
 * Nessuna I/O: pensato per unit test.
 *
 * Produzione da raccolte; costi da aggregaSpeseFruttetoAnno (passati già calcolati).
 * Ricavo solo se la raccolta ha prezzoVendita; altrimenti null + *.
 * Costo orario mancante → null / partial + *.
 *
 * @module modules/report/services/report-frutteto-aggregate
 */

import {
  dataIsoFromAny,
  euro,
  sumNullable
} from './report-economici-aggregate.js';

/** 1 quintale = 100 kg */
export const KG_PER_Q = 100;

/**
 * @param {number|null|undefined} kg
 * @returns {number|null}
 */
export function kgToQ(kg) {
  if (kg == null || Number.isNaN(Number(kg))) return null;
  return euro(Number(kg) / KG_PER_Q);
}

/**
 * Resa q/ha da kg e ettari.
 * @param {number|null|undefined} kg
 * @param {number|null|undefined} ettari
 * @returns {number|null}
 */
export function resaQHa(kg, ettari) {
  const ha = Number(ettari);
  if (kg == null || Number.isNaN(Number(kg)) || !ha || ha <= 0 || Number.isNaN(ha)) return null;
  return euro(Number(kg) / KG_PER_Q / ha);
}

/**
 * Scarto % sul raccolto (kg scarto / kg raccolti × 100).
 * @param {number|null|undefined} scartoKg
 * @param {number|null|undefined} produzioneKg
 * @returns {number|null}
 */
export function scartoPct(scartoKg, produzioneKg) {
  const prod = Number(produzioneKg);
  if (!prod || prod <= 0 || Number.isNaN(prod)) return null;
  const s = Number(scartoKg) || 0;
  return euro((s / prod) * 100);
}

/**
 * €/q: costi / produzione in quintali.
 * @param {number|null|undefined} costi
 * @param {number|null|undefined} produzioneQ
 * @returns {number|null}
 */
export function euroPerQ(costi, produzioneQ) {
  if (costi == null || Number.isNaN(Number(costi))) return null;
  const q = Number(produzioneQ);
  if (!q || q <= 0 || Number.isNaN(q)) return null;
  return euro(Number(costi) / q);
}

/**
 * Ricavo registrato sulla raccolta: solo se c’è prezzoVendita.
 * Non stima prezzi. ricavo 0 senza prezzo → null.
 *
 * @param {object|null|undefined} raccolta
 * @returns {{ ricavo: number|null, senzaPrezzo: boolean, prezzoVendita: number|null }}
 */
export function ricavoFromRaccolta(raccolta) {
  if (!raccolta) {
    return { ricavo: null, senzaPrezzo: true, prezzoVendita: null };
  }
  const prezzo = raccolta.prezzoVendita;
  if (prezzo == null || prezzo === '' || Number.isNaN(Number(prezzo)) || !(Number(prezzo) > 0)) {
    return { ricavo: null, senzaPrezzo: true, prezzoVendita: null };
  }
  const p = Number(prezzo);
  const kg = Number(raccolta.quantitaKg) || 0;
  let ricavo = raccolta.ricavo;
  if (ricavo == null || ricavo === '' || Number.isNaN(Number(ricavo))) {
    ricavo = p * kg;
  }
  return {
    ricavo: euro(Number(ricavo)),
    senzaPrezzo: false,
    prezzoVendita: p
  };
}

/**
 * Combina voci di costo (manodopera / macchine / prodotti / potatura…).
 * missing* → pezzo null; somma parziale con *.
 *
 * @param {{
 *   speseManodopera?: number|null,
 *   missingManodopera?: boolean,
 *   speseMacchine?: number|null,
 *   missingMacchine?: boolean,
 *   speseProdotti?: number|null,
 *   missingProdotti?: boolean,
 *   spesePotatura?: number|null,
 *   speseTrattamenti?: number|null,
 *   speseRaccolta?: number|null,
 *   costoTotale?: number|null,
 *   partial?: boolean
 * }} parts
 * @returns {{ value: number|null, partial: boolean, breakdown: object }}
 */
export function combineSpeseFrutteto(parts = {}) {
  const mano = parts.missingManodopera ? null : (parts.speseManodopera == null ? 0 : Number(parts.speseManodopera));
  const mac = parts.missingMacchine ? null : (parts.speseMacchine == null ? 0 : Number(parts.speseMacchine));
  const prod = parts.missingProdotti ? null : (parts.speseProdotti == null ? 0 : Number(parts.speseProdotti));

  // Se il totale anno è già fornito (allineato a aggregaSpeseFruttetoAnno), usalo come base
  // e applica solo i flag partial/missing.
  if (parts.costoTotale != null && !Number.isNaN(Number(parts.costoTotale))) {
    const anyMissing = !!(
      parts.missingManodopera
      || parts.missingMacchine
      || parts.missingProdotti
      || parts.partial
    );
    return {
      value: euro(Number(parts.costoTotale)),
      partial: anyMissing,
      breakdown: {
        speseManodopera: mano,
        speseMacchine: mac,
        speseProdotti: prod,
        spesePotatura: parts.spesePotatura == null ? 0 : Number(parts.spesePotatura),
        speseTrattamenti: parts.speseTrattamenti == null ? 0 : Number(parts.speseTrattamenti),
        speseRaccolta: parts.speseRaccolta == null ? 0 : Number(parts.speseRaccolta)
      }
    };
  }

  const summed = sumNullable([mano, mac, prod], {
    anyMissing: !!(parts.missingManodopera || parts.missingMacchine || parts.missingProdotti || parts.partial)
  });
  return {
    value: summed.value,
    partial: summed.partial,
    breakdown: {
      speseManodopera: mano,
      speseMacchine: mac,
      speseProdotti: prod,
      spesePotatura: parts.spesePotatura == null ? 0 : Number(parts.spesePotatura),
      speseTrattamenti: parts.speseTrattamenti == null ? 0 : Number(parts.speseTrattamenti),
      speseRaccolta: parts.speseRaccolta == null ? 0 : Number(parts.speseRaccolta)
    }
  };
}

/**
 * Arricchisce una raccolta con ricavo, scarto %, resa.
 * @param {object} raccolta
 * @param {{ fruttetoNome?: string }} [ctx]
 */
export function enrichRaccolta(raccolta, ctx = {}) {
  if (!raccolta) return null;
  const dataIso = dataIsoFromAny(raccolta.data);
  const kg = raccolta.quantitaKg != null ? Number(raccolta.quantitaKg) : 0;
  const ha = raccolta.quantitaEttari != null ? Number(raccolta.quantitaEttari) : null;
  const scartoKg = raccolta.scartoTotaleKg != null ? Number(raccolta.scartoTotaleKg) : 0;
  const ric = ricavoFromRaccolta(raccolta);
  const resaStored = raccolta.resaKgHa != null && !Number.isNaN(Number(raccolta.resaKgHa))
    ? Number(raccolta.resaKgHa)
    : null;
  const resaKgHa = resaStored != null
    ? resaStored
    : (ha && ha > 0 ? euro(kg / ha) : null);

  return {
    id: raccolta.id ? String(raccolta.id) : null,
    fruttetoId: raccolta.fruttetoId ? String(raccolta.fruttetoId) : null,
    fruttetoNome: ctx.fruttetoNome || '',
    dataIso,
    specie: raccolta.specie || '',
    varieta: raccolta.varieta || '',
    quantitaKg: kg,
    quantitaQ: kgToQ(kg) || 0,
    quantitaEttari: ha,
    resaKgHa,
    resaQHa: resaKgHa == null ? null : euro(resaKgHa / KG_PER_Q),
    scartoTotaleKg: scartoKg,
    scartoPct: scartoPct(scartoKg, kg),
    scartoPerCategoria: raccolta.scartoPerCategoria && typeof raccolta.scartoPerCategoria === 'object'
      ? { ...raccolta.scartoPerCategoria }
      : null,
    calibro: raccolta.calibro || null,
    costoTotaleRaccolta: raccolta.costoTotale != null ? euro(Number(raccolta.costoTotale)) : 0,
    prezzoVendita: ric.prezzoVendita,
    ricavo: ric.ricavo,
    senzaPrezzo: ric.senzaPrezzo,
    note: raccolta.note || ''
  };
}

/**
 * @param {Array<object>} raccolte
 * @param {{ fruttetoId?: string|null, specie?: string|null, varieta?: string|null }} filters
 */
export function filterRaccolte(raccolte, filters = {}) {
  return (raccolte || []).filter((r) => {
    if (!r) return false;
    if (filters.fruttetoId && String(r.fruttetoId || '') !== String(filters.fruttetoId)) return false;
    if (filters.specie && String(r.specie || '') !== String(filters.specie)) return false;
    if (filters.varieta && String(r.varieta || '') !== String(filters.varieta)) return false;
    return true;
  });
}

/**
 * Aggrega per frutteto.
 * @param {Array<object>} raccolte enriched
 * @param {Map<string, object>|Record<string, object>} speseByFruttetoId
 * @param {Map<string, object>|Record<string, object>} fruttetoById
 */
export function aggregateByFrutteto(raccolte, speseByFruttetoId, fruttetoById) {
  /** @type {Map<string, object>} */
  const speseMap = speseByFruttetoId instanceof Map
    ? speseByFruttetoId
    : new Map(Object.entries(speseByFruttetoId || {}));
  /** @type {Map<string, object>} */
  const fruMap = fruttetoById instanceof Map
    ? fruttetoById
    : new Map(Object.entries(fruttetoById || {}));

  /** @type {Map<string, object>} */
  const buckets = new Map();

  function ensure(fid) {
    const id = String(fid || '');
    let b = buckets.get(id);
    if (!b) {
      const fru = fruMap.get(id) || {};
      b = {
        fruttetoId: id,
        fruttetoNome: fru.nome || fru.specie || id || '—',
        specie: fru.specie || '',
        varieta: fru.varieta || '',
        ettari: fru.superficieEttari != null ? Number(fru.superficieEttari) : (fru.superficie != null ? Number(fru.superficie) : 0),
        produzioneKg: 0,
        scartoKg: 0,
        nRaccolte: 0,
        ricavi: 0,
        knownRicavi: 0,
        missRicavi: false,
        specieSet: new Set(),
        varietaSet: new Set()
      };
      buckets.set(id, b);
    }
    return b;
  }

  for (const r of raccolte || []) {
    if (!r || !r.fruttetoId) continue;
    const b = ensure(r.fruttetoId);
    b.nRaccolte += 1;
    b.produzioneKg += Number(r.quantitaKg) || 0;
    b.scartoKg += Number(r.scartoTotaleKg) || 0;
    if (r.specie) b.specieSet.add(String(r.specie));
    if (r.varieta) b.varietaSet.add(String(r.varieta));
    if (r.senzaPrezzo || r.ricavo == null) {
      b.missRicavi = true;
    } else {
      b.ricavi += Number(r.ricavo) || 0;
      b.knownRicavi += 1;
    }
  }

  // Includi frutteti con sole spese (senza raccolte nel filtro) se richiesti via spese map — no:
  // solo quelli con raccolte o già nel bucket. Frutteti filtrati senza raccolte restano fuori.

  const out = [];
  for (const b of buckets.values()) {
    const speseRaw = speseMap.get(String(b.fruttetoId)) || {};
    const combined = combineSpeseFrutteto(speseRaw);
    const produzioneQ = kgToQ(b.produzioneKg) || 0;
    const ricaviVal = b.knownRicavi === 0
      ? (b.missRicavi ? null : 0)
      : euro(b.ricavi);
    const partialRicavi = b.knownRicavi > 0 && b.missRicavi;
    const costi = combined.value;
    const partialCosti = combined.partial;

    let margine = null;
    let partialMargine = false;
    // Margine solo se ricavi completi (nessun * sui ricavi)
    if (ricaviVal == null || partialRicavi || costi == null) {
      margine = null;
      partialMargine = true;
    } else {
      margine = euro(Number(ricaviVal) - Number(costi));
      partialMargine = partialCosti;
      if (partialCosti) {
        margine = null;
        partialMargine = true;
      }
    }

    const specieLabel = b.specieSet.size
      ? [...b.specieSet].sort((a, c) => a.localeCompare(c, 'it')).join(', ')
      : (b.specie || '—');
    const varietaLabel = b.varietaSet.size
      ? [...b.varietaSet].sort((a, c) => a.localeCompare(c, 'it')).join(', ')
      : (b.varieta || '—');

    out.push({
      fruttetoId: b.fruttetoId,
      fruttetoNome: b.fruttetoNome,
      specie: specieLabel,
      varieta: varietaLabel,
      specieVarieta: `${specieLabel} / ${varietaLabel}`,
      ettari: euro(b.ettari) || 0,
      produzioneKg: euro(b.produzioneKg) || 0,
      produzioneQ,
      resaQHa: resaQHa(b.produzioneKg, b.ettari),
      scartoPct: scartoPct(b.scartoKg, b.produzioneKg),
      scartoKg: euro(b.scartoKg) || 0,
      costi,
      partialCosti,
      euroPerQ: euroPerQ(costi, produzioneQ),
      ricavi: ricaviVal,
      partialRicavi,
      senzaPrezzo: b.missRicavi,
      margine,
      partialMargine,
      nRaccolte: b.nRaccolte,
      breakdown: combined.breakdown
    });
  }

  return out.sort((a, b) => String(a.fruttetoNome).localeCompare(String(b.fruttetoNome), 'it'));
}

/**
 * Barre: top N per produzione + «Altri».
 * Se un solo frutteto è filtrato, aggrega per specie.
 *
 * @param {Array<object>} byFrutteto
 * @param {Array<object>} raccolte
 * @param {{ fruttetoId?: string|null, topN?: number, mode?: 'frutteto'|'specie' }} [opts]
 */
export function aggregateProduzioneForChart(byFrutteto, raccolte, opts = {}) {
  const topN = opts.topN != null ? opts.topN : 7;
  const mode = opts.mode
    || (opts.fruttetoId ? 'specie' : 'frutteto');

  /** @type {Array<{ id: string, nome: string, valore: number|null }>} */
  let attributed = [];

  if (mode === 'specie') {
    /** @type {Map<string, number>} */
    const map = new Map();
    for (const r of raccolte || []) {
      if (!r) continue;
      if (opts.fruttetoId && String(r.fruttetoId) !== String(opts.fruttetoId)) continue;
      const key = String(r.specie || 'Sconosciuta');
      map.set(key, (map.get(key) || 0) + (Number(r.quantitaKg) || 0));
    }
    attributed = [...map.entries()].map(([nome, kg]) => ({
      id: nome,
      nome,
      valore: kgToQ(kg)
    }));
  } else {
    attributed = (byFrutteto || [])
      .filter((r) => r && (Number(r.produzioneQ) > 0 || Number(r.produzioneKg) > 0))
      .map((r) => ({
        id: r.fruttetoId,
        nome: r.fruttetoNome || r.fruttetoId || '—',
        valore: r.produzioneQ == null ? kgToQ(r.produzioneKg) : Number(r.produzioneQ)
      }));
  }

  attributed.sort((a, b) => (Number(b.valore) || 0) - (Number(a.valore) || 0));
  const n = Math.max(0, topN);
  const top = attributed.slice(0, n);
  const rest = attributed.slice(n);
  const out = top.map((x) => ({
    id: x.id,
    nome: x.nome,
    valore: x.valore == null ? null : euro(x.valore)
  }));
  if (rest.length) {
    const altri = rest.reduce((acc, x) => {
      if (x.valore != null) acc.known += Number(x.valore) || 0;
      else acc.missing = true;
      return acc;
    }, { known: 0, missing: false });
    out.push({
      id: '__altri__',
      nome: 'Altri',
      valore: altri.missing && !(altri.known > 0) ? null : euro(altri.known)
    });
  }
  return out;
}

const MESI_IT_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/**
 * Mensile: produzione (q) e costi (€).
 * Costi mensili da `costiMensili` (ym → { costi, partial }); produzione da raccolte.
 *
 * @param {Array<object>} raccolte enriched
 * @param {Array<{ ym: string, costi: number|null, partial?: boolean }>|Map<string, object>} [costiMensili]
 */
export function aggregateMonthlyProduzioneCosti(raccolte, costiMensili) {
  /** @type {Map<string, { produzioneKg: number, costi: number, missC: boolean, knownC: number }>} */
  const map = new Map();

  for (const r of raccolte || []) {
    if (!r) continue;
    const iso = String(r.dataIso || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(iso)) continue;
    let b = map.get(iso);
    if (!b) {
      b = { produzioneKg: 0, costi: 0, missC: false, knownC: 0 };
      map.set(iso, b);
    }
    b.produzioneKg += Number(r.quantitaKg) || 0;
  }

  /** @type {Map<string, { costi: number|null, partial?: boolean }>} */
  let costiMap;
  if (costiMensili instanceof Map) {
    costiMap = costiMensili;
  } else if (Array.isArray(costiMensili)) {
    costiMap = new Map(
      costiMensili
        .filter((c) => c && c.ym)
        .map((c) => [String(c.ym), c])
    );
  } else {
    costiMap = new Map(Object.entries(costiMensili || {}));
  }

  for (const [ym, c] of costiMap.entries()) {
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    let b = map.get(ym);
    if (!b) {
      b = { produzioneKg: 0, costi: 0, missC: false, knownC: 0 };
      map.set(ym, b);
    }
    if (c == null || c.costi == null || Number.isNaN(Number(c.costi))) {
      b.missC = true;
    } else {
      b.costi += Number(c.costi) || 0;
      b.knownC += 1;
      if (c.partial) b.missC = true;
    }
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, b]) => {
      const [y, mo] = ym.split('-');
      const mi = Number(mo) - 1;
      return {
        ym,
        label: `${MESI_IT_SHORT[mi] || mo} ${y}`,
        produzioneQ: kgToQ(b.produzioneKg) || 0,
        costi: b.knownC === 0 ? (b.missC ? null : 0) : euro(b.costi),
        partialCosti: b.knownC > 0 && b.missC
      };
    });
}

/**
 * @param {Array<object>} byFrutteto
 * @param {Array<object>} raccolte
 */
export function buildFruttetoKpi(byFrutteto, raccolte) {
  let produzioneKg = 0;
  let scartoKg = 0;
  let ettari = 0;
  let costi = 0;
  let knownC = 0;
  let missC = false;
  let ricavi = 0;
  let knownR = 0;
  let missR = false;
  const frutteti = new Set();

  for (const r of byFrutteto || []) {
    if (!r) continue;
    if (r.fruttetoId) frutteti.add(String(r.fruttetoId));
    produzioneKg += Number(r.produzioneKg) || 0;
    scartoKg += Number(r.scartoKg) || 0;
    ettari += Number(r.ettari) || 0;
    if (r.costi == null) {
      if (r.partialCosti || r.nRaccolte > 0) missC = true;
    } else {
      costi += Number(r.costi) || 0;
      knownC += 1;
      if (r.partialCosti) missC = true;
    }
    if (r.ricavi == null) {
      if (r.partialRicavi || r.nRaccolte > 0) missR = true;
    } else {
      ricavi += Number(r.ricavi) || 0;
      knownR += 1;
      if (r.partialRicavi) missR = true;
    }
  }

  const produzioneQ = kgToQ(produzioneKg) || 0;
  const costiVal = knownC === 0 ? (missC ? null : 0) : euro(costi);
  const ricaviVal = knownR === 0 ? (missR ? null : 0) : euro(ricavi);
  const partialCosti = knownC > 0 && missC;
  const partialRicavi = knownR > 0 && missR;

  return {
    produzioneQ,
    produzioneKg: euro(produzioneKg) || 0,
    resaQHa: resaQHa(produzioneKg, ettari),
    scartoPct: scartoPct(scartoKg, produzioneKg),
    costi: costiVal,
    partialCosti,
    euroPerQ: euroPerQ(costiVal, produzioneQ),
    ricavi: ricaviVal,
    partialRicavi,
    ettari: euro(ettari) || 0,
    nFrutteti: frutteti.size,
    nRaccolte: (raccolte || []).length
  };
}

/**
 * Dettaglio raccolte di un frutteto.
 * @param {Array<object>} raccolte
 * @param {string} fruttetoId
 */
export function buildFruttetoDetailRows(raccolte, fruttetoId) {
  const id = String(fruttetoId || '');
  return (raccolte || [])
    .filter((r) => r && String(r.fruttetoId || '') === id)
    .slice()
    .sort((a, b) => String(b.dataIso || '').localeCompare(String(a.dataIso || '')));
}

/**
 * Export Excel: stessi filtri/righe della pagina.
 * @param {{ byFrutteto: Array<object>, kpi: object, raccolte: Array<object>, notes?: string[] }} data
 */
export function prepareFruttetoExportData(data) {
  const kpi = data.kpi || {};
  const byFrutteto = data.byFrutteto || [];
  const raccolte = data.raccolte || [];
  const notes = data.notes || [];
  return {
    kpi: {
      produzioneQ: kpi.produzioneQ,
      resaQHa: kpi.resaQHa,
      scartoPct: kpi.scartoPct,
      costi: kpi.costi,
      euroPerQ: kpi.euroPerQ,
      ricavi: kpi.ricavi,
      ettari: kpi.ettari,
      nFrutteti: kpi.nFrutteti,
      nRaccolte: kpi.nRaccolte,
      annotazione: 'Ricavi solo da prezzo registrato sulla raccolta; costi allineati a Frutteto'
    },
    perFrutteto: byFrutteto.map((r) => ({
      frutteto: r.fruttetoNome,
      specie: r.specie,
      varieta: r.varieta,
      ettari: r.ettari,
      produzioneQ: r.produzioneQ,
      resaQHa: r.resaQHa,
      scartoPct: r.scartoPct,
      costi: r.costi,
      euroPerQ: r.euroPerQ,
      ricavi: r.ricavi,
      margine: r.margine,
      senzaPrezzo: r.senzaPrezzo,
      costiParziali: r.partialCosti
    })),
    raccolte: raccolte.map((r) => ({
      data: r.dataIso,
      frutteto: r.fruttetoNome,
      specie: r.specie,
      varieta: r.varieta,
      kg: r.quantitaKg,
      ettari: r.quantitaEttari,
      resaKgHa: r.resaKgHa,
      scartoKg: r.scartoTotaleKg,
      calibro: r.calibro,
      costo: r.costoTotaleRaccolta,
      prezzo: r.prezzoVendita,
      ricavo: r.ricavo,
      senzaPrezzo: !!r.senzaPrezzo
    })),
    notes
  };
}

/**
 * Assembla il report completo.
 *
 * @param {{
 *   frutteti?: Array<object>,
 *   raccolte?: Array<object>,
 *   speseByFruttetoId?: Map<string, object>|Record<string, object>,
 *   costiMensili?: Array<object>|Map<string, object>|Record<string, object>
 * }} input
 * @param {{ fruttetoId?: string|null, specie?: string|null, varieta?: string|null }} [filters]
 */
export function assembleFruttetoReport(input = {}, filters = {}) {
  const frutteti = input.frutteti || [];
  const fruttetoById = new Map(
    frutteti.filter((f) => f && f.id).map((f) => [String(f.id), f])
  );

  const enrichedAll = [];
  for (const raw of input.raccolte || []) {
    if (!raw) continue;
    const fid = raw.fruttetoId ? String(raw.fruttetoId) : null;
    const fru = fid ? fruttetoById.get(fid) : null;
    const row = enrichRaccolta(raw, {
      fruttetoNome: fru
        ? (fru.nome || fru.specie || fid)
        : (fid || '')
    });
    if (row) enrichedAll.push(row);
  }

  const raccolte = filterRaccolte(enrichedAll, filters);
  const byFrutteto = aggregateByFrutteto(raccolte, input.speseByFruttetoId || {}, fruttetoById);
  const kpi = buildFruttetoKpi(byFrutteto, raccolte);
  const chartProduzione = aggregateProduzioneForChart(byFrutteto, raccolte, {
    fruttetoId: filters.fruttetoId || null,
    topN: 7
  });
  const chartMensile = aggregateMonthlyProduzioneCosti(raccolte, input.costiMensili);

  /** @type {string[]} */
  const notes = [
    'Ricavi solo da prezzo di vendita registrato sulla raccolta (niente stime; PAC ecc. nella futura Sintesi).',
    'Costi allineati all’aggregazione del modulo Frutteto (manodopera, macchine, prodotti/trattamenti, potatura).'
  ];
  const nSenza = raccolte.filter((r) => r.senzaPrezzo).length;
  if (nSenza > 0) {
    notes.push(
      `${nSenza} raccolt${nSenza === 1 ? 'a' : 'e'} senza prezzo (ricavo —; totali con *).`
    );
  }
  if (kpi.partialCosti || kpi.costi == null) {
    notes.push('Alcuni costi orari mancano (mostrati come —; totali con * se parziali).');
  }
  const nPartialC = byFrutteto.filter((r) => r.partialCosti).length;
  if (nPartialC > 0) {
    notes.push(`${nPartialC} fruttet${nPartialC === 1 ? 'o' : 'i'} con costi parziali.`);
  }

  return {
    raccolte,
    byFrutteto,
    kpi,
    chartProduzione,
    chartMensile,
    notes,
    empty: !(raccolte.length || byFrutteto.length),
    ready: true
  };
}

export function formatEuroPrefixCompact(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k €`;
  }
  return `${n.toLocaleString('it-IT', { maximumFractionDigits: 0 })} €`;
}

export function isFruttetoDataReady(data) {
  return !!(data && data.ready);
}

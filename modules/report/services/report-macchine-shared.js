/**
 * Helper condivisi costi macchina (ore × costoOra) per Report Economici e Report Macchine.
 * Stessa regola: oreMacchina validate su macchinaId e, se diverso, su attrezzoId.
 *
 * @module modules/report/services/report-macchine-shared
 */

import { euro } from './report-economici-aggregate.js';

/**
 * Accumula ore macchina da un documento ore (stato già filtrato a monte se serve).
 * @param {Record<string, number>} oreMacchinaPerId
 * @param {object|null|undefined} ora
 */
export function bumpOreMacchinaPerMezzo(oreMacchinaPerId, ora) {
  if (!ora || !oreMacchinaPerId) return;
  const oreMac = Number(ora.oreMacchina) || 0;
  if (oreMac <= 0) return;
  if (ora.macchinaId) {
    const id = String(ora.macchinaId);
    oreMacchinaPerId[id] = (oreMacchinaPerId[id] || 0) + oreMac;
  }
  if (ora.attrezzoId && String(ora.attrezzoId) !== String(ora.macchinaId || '')) {
    const id = String(ora.attrezzoId);
    oreMacchinaPerId[id] = (oreMacchinaPerId[id] || 0) + oreMac;
  }
}

/**
 * Ore macchina da un set di documenti ore (solo validate se `soloValidate`).
 * @param {Array<object>} oreDocs
 * @param {{ soloValidate?: boolean }} [opts]
 * @returns {Record<string, number>}
 */
export function oreMacchinaMapFromOreDocs(oreDocs, opts = {}) {
  /** @type {Record<string, number>} */
  const map = {};
  const soloValidate = opts.soloValidate !== false;
  for (const oraDoc of oreDocs || []) {
    const ora = typeof oraDoc.data === 'function' ? oraDoc.data() : oraDoc;
    if (!ora) continue;
    if (soloValidate && ora.stato !== 'validate') continue;
    bumpOreMacchinaPerMezzo(map, ora);
  }
  return map;
}

/**
 * Risolve costo orario da anagrafica (mappa id → numero, come Economici).
 * @param {Map<string, number>|null|undefined} macchineById
 * @param {string} mezzoId
 * @returns {{ inAnagrafica: boolean, costoOra: number|null, missing: boolean }}
 */
export function resolveCostoOraMacchina(macchineById, mezzoId) {
  const id = String(mezzoId || '');
  if (!id || !macchineById || !macchineById.has(id)) {
    return { inAnagrafica: false, costoOra: null, missing: true };
  }
  const raw = macchineById.get(id);
  const costoOra = raw != null ? Number(raw) : 0;
  if (!costoOra || costoOra <= 0) {
    return { inAnagrafica: true, costoOra: null, missing: true };
  }
  return { inAnagrafica: true, costoOra, missing: false };
}

/**
 * Costo macchine da mappa ore×mezzo — stessa logica di Economici (`costiFromOreBundle` / diario).
 * @param {Record<string, number>} oreMacchinaPerId
 * @param {Map<string, number>} macchineById
 * @param {Map<string, string>|null|undefined} macchineNomiById
 * @param {{ tipo?: string, dataIso?: string|null, origine?: string, hasParco?: boolean }} [meta]
 * @returns {{
 *   costoMacchine: number|null,
 *   missingMacchine: boolean,
 *   notes: string[],
 *   voci: Array<object>,
 *   oreMacchinaTotali: number
 * }}
 */
export function costiMacchineFromOreMap(oreMacchinaPerId, macchineById, macchineNomiById, meta = {}) {
  const hasParco = meta.hasParco !== false;
  const tipo = meta.tipo || 'Lavoro';
  const dataIso = meta.dataIso || null;
  const origine = meta.origine || 'lavoro';
  /** @type {string[]} */
  const notes = [];
  /** @type {Array<object>} */
  const voci = [];
  let missingMacchine = false;
  let costoMacchine = 0;
  let oreMacchinaTotali = 0;

  const entries = Object.entries(oreMacchinaPerId || {});
  if (!entries.length) {
    return {
      costoMacchine: 0,
      missingMacchine: false,
      notes,
      voci,
      oreMacchinaTotali: 0
    };
  }

  if (!hasParco) {
    return {
      costoMacchine: 0,
      missingMacchine: false,
      notes,
      voci,
      oreMacchinaTotali: entries.reduce((s, [, o]) => s + (Number(o) || 0), 0)
    };
  }

  for (const [mid, oreMRaw] of entries) {
    const oreM = Number(oreMRaw) || 0;
    if (oreM <= 0) continue;
    oreMacchinaTotali += oreM;
    const label = (macchineNomiById && macchineNomiById.get(String(mid))) || mid;
    const resolved = resolveCostoOraMacchina(macchineById, mid);
    if (resolved.missing) {
      missingMacchine = true;
      notes.push(
        resolved.inAnagrafica
          ? 'Costo orario macchina non impostato'
          : 'Macchina non in anagrafica (costo orario mancante)'
      );
      voci.push({
        origine,
        categoria: 'macchine',
        descrizione: `${tipo} — ${label} (${oreM} h)`,
        importo: null,
        prezzoMancante: true,
        dataIso,
        macchinaId: String(mid),
        ore: oreM
      });
      continue;
    }
    const importo = oreM * resolved.costoOra;
    costoMacchine += importo;
    voci.push({
      origine,
      categoria: 'macchine',
      descrizione: `${tipo} — ${label} (${oreM} h × € ${resolved.costoOra}/h)`,
      importo: euro(importo),
      prezzoMancante: false,
      dataIso,
      macchinaId: String(mid),
      ore: oreM,
      costoOra: resolved.costoOra
    });
  }

  return {
    costoMacchine: missingMacchine ? null : euro(costoMacchine),
    missingMacchine,
    notes: [...new Set(notes)],
    voci,
    oreMacchinaTotali: euro(oreMacchinaTotali) || 0
  };
}

/**
 * Ore macchina su un’attività diario: stessa regola Economici (ogni mezzo riceve oreMacchina).
 * @param {object|null|undefined} att
 * @returns {Record<string, number>}
 */
export function oreMacchinaMapFromAttivita(att) {
  /** @type {Record<string, number>} */
  const map = {};
  if (!att) return map;
  const oreMac = Number(att.oreMacchina) || 0;
  if (oreMac <= 0) return map;
  const ids = [att.macchinaId, att.attrezzoId].filter(Boolean).map(String);
  for (const mid of [...new Set(ids)]) {
    map[mid] = (map[mid] || 0) + oreMac;
  }
  return map;
}

/**
 * Manutenzione: ore attuali (oreAttuali, fallback oreIniziali) vs soglia.
 * @param {{ oreAttuali?: number|null, oreIniziali?: number|null, oreProssimaManutenzione?: number|null }|null} macchina
 * @returns {{ oreAttuali: number|null, oreProssimaManutenzione: number|null, superata: boolean }}
 */
export function manutenzioneStatus(macchina) {
  if (!macchina) {
    return { oreAttuali: null, oreProssimaManutenzione: null, superata: false };
  }
  let oreAttuali = null;
  if (macchina.oreAttuali != null && macchina.oreAttuali !== '') {
    oreAttuali = Number(macchina.oreAttuali);
  } else if (macchina.oreIniziali != null && macchina.oreIniziali !== '') {
    oreAttuali = Number(macchina.oreIniziali);
  }
  if (oreAttuali != null && Number.isNaN(oreAttuali)) oreAttuali = null;

  let soglia = null;
  if (macchina.oreProssimaManutenzione != null && macchina.oreProssimaManutenzione !== '') {
    soglia = Number(macchina.oreProssimaManutenzione);
  }
  if (soglia != null && Number.isNaN(soglia)) soglia = null;

  const superata = oreAttuali != null && soglia != null && oreAttuali >= soglia;
  return {
    oreAttuali,
    oreProssimaManutenzione: soglia,
    superata
  };
}

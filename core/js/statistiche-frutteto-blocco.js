/**
 * Aggregati puri blocco Frutteto su Statistiche (annata solare, senza costi/scarto dettagliato).
 * Nessuna I/O / DOM.
 * @module core/js/statistiche-frutteto-blocco
 */

import { dateLikeToLocalCalendarIso } from './date-format-it.js';
import { isImpiantoAperto } from '../../shared/js/impianto-aperto.js';
import { topNConAltri } from './statistiche-conto-terzi-blocco.js';

/**
 * @param {{ data?: * }|null|undefined} row
 * @param {number} anno
 * @returns {boolean}
 */
export function raccoltaInAnnata(row, anno) {
  const iso = dateLikeToLocalCalendarIso((row && row.data) || null);
  if (!iso) return false;
  return iso.startsWith(`${Number(anno)}-`);
}

/**
 * @param {object|null|undefined} frutteto
 * @returns {string}
 */
export function nomeFruttetoDisplay(frutteto) {
  if (!frutteto) return '—';
  const specie = String(frutteto.specie || '').trim();
  const varieta = String(frutteto.varieta || frutteto.nome || '').trim();
  if (specie && varieta) return `${specie} — ${varieta}`;
  return specie || varieta || String(frutteto.id || '—');
}

/**
 * KPI frutteto: superficie impianti aperti, produzione e resa annata.
 *
 * @param {{
 *   frutteti?: Array<object>,
 *   raccolte?: Array<object>,
 *   anno: number,
 *   topNChart?: number
 * }} input
 */
export function calcolaBloccoFruttetoAnnata(input) {
  const anno = Number(input && input.anno);
  const topNChart = (input && Number(input.topNChart) > 0) ? Number(input.topNChart) : 7;
  const frutteti = (input && Array.isArray(input.frutteti)) ? input.frutteti : [];
  const raccolte = (input && Array.isArray(input.raccolte)) ? input.raccolte : [];

  const aperti = frutteti.filter((f) => f && isImpiantoAperto(f));
  let superficieHa = 0;
  for (const f of aperti) {
    const ha = f.superficieEttari != null ? Number(f.superficieEttari) : 0;
    if (Number.isFinite(ha) && ha > 0) superficieHa += ha;
  }

  let produzioneKg = 0;
  /** @type {Map<string, { id: string, nome: string, valore: number }>} */
  const bySpecie = new Map();

  for (const rac of raccolte) {
    if (!rac || !raccoltaInAnnata(rac, anno)) continue;
    const q = rac.quantitaKg != null ? Number(rac.quantitaKg) : 0;
    if (!(Number.isFinite(q) && q > 0)) continue;
    produzioneKg += q;
    const nome = String(rac.specie || rac.varieta || 'Sconosciuta').trim() || 'Sconosciuta';
    const key = nome.toLowerCase();
    let row = bySpecie.get(key);
    if (!row) {
      row = { id: key, nome, valore: 0 };
      bySpecie.set(key, row);
    }
    row.valore += q;
  }

  const resaKgHa = superficieHa > 0
    ? Math.round((produzioneKg / superficieHa) * 100) / 100
    : 0;

  return {
    anno,
    nFrutteti: aperti.length,
    superficieHa: Math.round(superficieHa * 100) / 100,
    produzioneKg: Math.round(produzioneKg * 100) / 100,
    resaKgHa,
    produzionePerSpecie: topNConAltri([...bySpecie.values()], topNChart)
  };
}

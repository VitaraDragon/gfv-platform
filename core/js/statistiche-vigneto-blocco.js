/**
 * Aggregati puri blocco Vigneto su Statistiche (annata solare, senza costi/confronti).
 * Nessuna I/O / DOM.
 * @module core/js/statistiche-vigneto-blocco
 */

import { dateLikeToLocalCalendarIso } from './date-format-it.js';
import { isImpiantoAperto } from '../../shared/js/impianto-aperto.js';
import { topNConAltri } from './statistiche-conto-terzi-blocco.js';

/**
 * @param {{ data?: * }|null|undefined} row
 * @param {number} anno
 * @returns {boolean}
 */
export function vendemmiaInAnnata(row, anno) {
  const iso = dateLikeToLocalCalendarIso((row && row.data) || null);
  if (!iso) return false;
  return iso.startsWith(`${Number(anno)}-`);
}

/**
 * @param {object|null|undefined} vigneto
 * @returns {string}
 */
export function nomeVignetoDisplay(vigneto) {
  if (!vigneto) return '—';
  return String(vigneto.varieta || vigneto.nome || vigneto.id || '—');
}

/**
 * KPI vigneto: superficie impianti aperti, produzione e resa annata.
 *
 * @param {{
 *   vigneti?: Array<object>,
 *   vendemmie?: Array<object>,
 *   anno: number,
 *   topNChart?: number
 * }} input
 */
export function calcolaBloccoVignetoAnnata(input) {
  const anno = Number(input && input.anno);
  const topNChart = (input && Number(input.topNChart) > 0) ? Number(input.topNChart) : 7;
  const vigneti = (input && Array.isArray(input.vigneti)) ? input.vigneti : [];
  const vendemmie = (input && Array.isArray(input.vendemmie)) ? input.vendemmie : [];

  const aperti = vigneti.filter((v) => v && isImpiantoAperto(v));
  let superficieHa = 0;
  for (const v of aperti) {
    const ha = v.superficieEttari != null ? Number(v.superficieEttari) : 0;
    if (Number.isFinite(ha) && ha > 0) superficieHa += ha;
  }

  let produzioneQli = 0;
  /** @type {Map<string, { id: string, nome: string, valore: number }>} */
  const byVarieta = new Map();

  for (const vend of vendemmie) {
    if (!vend || !vendemmiaInAnnata(vend, anno)) continue;
    const q = vend.quantitaQli != null ? Number(vend.quantitaQli) : 0;
    if (!(Number.isFinite(q) && q > 0)) continue;
    produzioneQli += q;
    const nome = String(vend.varieta || 'Sconosciuta').trim() || 'Sconosciuta';
    const key = nome.toLowerCase();
    let row = byVarieta.get(key);
    if (!row) {
      row = { id: key, nome, valore: 0 };
      byVarieta.set(key, row);
    }
    row.valore += q;
  }

  const resaQliHa = superficieHa > 0
    ? Math.round((produzioneQli / superficieHa) * 100) / 100
    : 0;

  return {
    anno,
    nVigneti: aperti.length,
    superficieHa: Math.round(superficieHa * 100) / 100,
    produzioneQli: Math.round(produzioneQli * 100) / 100,
    resaQliHa,
    produzionePerVarieta: topNConAltri([...byVarieta.values()], topNChart)
  };
}

/**
 * Aggregati puri blocco Orticole su Statistiche (annata solare, senza costi).
 * Nessuna I/O / DOM. Il campo anagrafico `campagna` non definisce i confini solari.
 * @module core/js/statistiche-orticole-blocco
 */

import { dateLikeToLocalCalendarIso } from './date-format-it.js';
import { topNConAltri } from './statistiche-conto-terzi-blocco.js';

/**
 * @param {number|null|undefined} value
 * @returns {number}
 */
function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * @param {number|null|undefined} value
 * @returns {number|null}
 */
function numero(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ data?: * }|null|undefined} row
 * @param {number} anno
 * @returns {boolean}
 */
export function eventoInAnnata(row, anno) {
  const iso = dateLikeToLocalCalendarIso((row && row.data) || null);
  if (!iso) return false;
  return iso.startsWith(`${Number(anno)}-`);
}

/**
 * KPI orticole: quintali, rese, acqua m³, n. campagne con raccolta o irrigazione nell'annata.
 *
 * @param {{
 *   campagne?: Array<object>,
 *   raccolte?: Array<object>,
 *   irrigazioni?: Array<object>,
 *   anno: number,
 *   topNChart?: number
 * }} input
 */
export function calcolaBloccoOrticoleAnnata(input) {
  const anno = Number(input && input.anno);
  const topNChart = (input && Number(input.topNChart) > 0) ? Number(input.topNChart) : 7;
  const campagne = (input && Array.isArray(input.campagne)) ? input.campagne : [];
  const raccolte = (input && Array.isArray(input.raccolte)) ? input.raccolte : [];
  const irrigazioni = (input && Array.isArray(input.irrigazioni)) ? input.irrigazioni : [];

  /** @type {Map<string, object>} */
  const campagneById = new Map();
  for (const c of campagne) {
    if (c && c.id) campagneById.set(String(c.id), c);
  }

  const raccolteAnnata = raccolte.filter((r) => r && eventoInAnnata(r, anno));
  const irrigazioniAnnata = irrigazioni.filter((r) => r && eventoInAnnata(r, anno));

  /** @type {Set<string>} */
  const campagnaIds = new Set();
  for (const rac of raccolteAnnata) {
    if (rac.campagnaId) campagnaIds.add(String(rac.campagnaId));
  }
  for (const irr of irrigazioniAnnata) {
    if (irr.campagnaId) campagnaIds.add(String(irr.campagnaId));
  }

  const campagneContate = [...campagnaIds]
    .map((id) => campagneById.get(id))
    .filter(Boolean);

  let superficieHa = 0;
  let sommaPrevistaPonderata = 0;
  let haPrevista = 0;
  for (const c of campagneContate) {
    const ha = numero(c.superficieEttari);
    if (ha != null && ha > 0) {
      superficieHa += ha;
      const prevista = numero(c.resaPrevistaQliHa);
      if (prevista != null) {
        sommaPrevistaPonderata += prevista * ha;
        haPrevista += ha;
      }
    }
  }

  let produzioneQli = 0;
  /** @type {Map<string, { id: string, nome: string, valore: number }>} */
  const byColtura = new Map();

  for (const rac of raccolteAnnata) {
    const q = rac.quantitaQli != null ? Number(rac.quantitaQli) : 0;
    if (!(Number.isFinite(q) && q > 0)) continue;
    produzioneQli += q;

    const camp = rac.campagnaId ? campagneById.get(String(rac.campagnaId)) : null;
    const nome = String(
      (camp && (camp.colturaNome || camp.varieta))
      || rac.colturaNome
      || rac.varieta
      || 'Sconosciuta'
    ).trim() || 'Sconosciuta';
    const key = nome.toLowerCase();
    let row = byColtura.get(key);
    if (!row) {
      row = { id: key, nome, valore: 0 };
      byColtura.set(key, row);
    }
    row.valore += q;
  }

  let acquaM3 = 0;
  for (const irr of irrigazioniAnnata) {
    const v = irr.volumeM3 != null ? Number(irr.volumeM3) : 0;
    if (Number.isFinite(v) && v > 0) acquaM3 += v;
  }

  const resaEffettivaQliHa = superficieHa > 0 && produzioneQli > 0
    ? round2(produzioneQli / superficieHa)
    : null;
  const resaPrevistaQliHa = haPrevista > 0
    ? round2(sommaPrevistaPonderata / haPrevista)
    : null;

  return {
    anno,
    nCampagne: campagneContate.length,
    superficieHa: round2(superficieHa),
    produzioneQli: round2(produzioneQli),
    resaEffettivaQliHa,
    resaPrevistaQliHa,
    acquaM3: round2(acquaM3),
    produzionePerColtura: topNConAltri([...byColtura.values()], topNChart)
  };
}

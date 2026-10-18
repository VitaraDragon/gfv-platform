/**
 * Statistiche superficie manodopera: somma dei passaggi e terreni coperti.
 * Modulo puro: niente Firebase, niente DOM.
 * @module core/services/statistiche-superficie
 */

/** Stati lavoro esclusi da somma passaggi e da terreni coperti. */
export const STATI_ESCLUSI_SUPERFICIE = Object.freeze(['annullato']);

/**
 * Numeri finiti e non negativi; tutto il resto (stringa, null, NaN, negativo) vale 0.
 * @param {unknown} value
 * @returns {number}
 */
function num(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

/**
 * @param {unknown} stato
 * @returns {boolean}
 */
function statoEscluso(stato) {
  return STATI_ESCLUSI_SUPERFICIE.indexOf(stato) !== -1;
}

/**
 * @param {{stato?:string, terrenoId?:string, superficieTotaleLavorata?:number}[]} lavori
 * @param {{id:string, superficie?:number}[]} terreni
 * @returns {{
 *   sommaPassaggi: number,
 *   superficieTotale: number,
 *   superficieCoperta: number,
 *   terreniCoperti: number,
 *   percentualeCoperta: number
 * }}
 */
export function calcolaSuperficieStats(lavori, terreni) {
  const listaLavori = Array.isArray(lavori) ? lavori : [];
  const listaTerreni = Array.isArray(terreni) ? terreni : [];

  /** @type {Map<string, number>} */
  const superficiePerTerreno = new Map();
  let superficieTotale = 0;
  for (const terreno of listaTerreni) {
    if (!terreno || typeof terreno !== 'object') continue;
    const ha = num(terreno.superficie);
    superficieTotale += ha;
    const id = terreno.id;
    if (id == null || id === '') continue;
    if (!superficiePerTerreno.has(id)) superficiePerTerreno.set(id, ha);
  }

  /** @type {Set<string>} */
  const coperti = new Set();
  let sommaPassaggi = 0;
  for (const lavoro of listaLavori) {
    if (!lavoro || typeof lavoro !== 'object') continue;
    if (statoEscluso(lavoro.stato)) continue;
    const ha = num(lavoro.superficieTotaleLavorata);
    sommaPassaggi += ha;
    if (ha <= 0) continue;
    const terrenoId = lavoro.terrenoId;
    if (terrenoId == null || terrenoId === '') continue;
    if (!superficiePerTerreno.has(terrenoId)) continue;
    coperti.add(terrenoId);
  }

  let superficieCoperta = 0;
  for (const id of coperti) {
    superficieCoperta += superficiePerTerreno.get(id) || 0;
  }

  const percentualeCoperta = superficieTotale > 0
    ? (superficieCoperta / superficieTotale) * 100
    : 0;

  return {
    sommaPassaggi,
    superficieTotale,
    superficieCoperta,
    terreniCoperti: coperti.size,
    percentualeCoperta
  };
}

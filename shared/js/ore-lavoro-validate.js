/**
 * Ore/costi di un lavoro: preferire le ore VALIDATE alla stima durataPrevista × 8.
 * Funzioni pure, condivise da potatura/vendemmia (vigneto) e potatura/raccolta (frutteto).
 *
 * @module shared/js/ore-lavoro-validate
 */

/** Ore per giorno usate per la stima da durataPrevista (solo fallback). */
export const ORE_PER_GIORNO_STIMA = 8;

/**
 * @param {*} v
 * @returns {number|null} numero finito oppure null
 */
export function oreFinite(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Stima ore da durata prevista (giorni × 8). Null se durata assente/non valida/≤0.
 * @param {*} durataPrevista
 * @returns {number|null}
 */
export function stimaOreDaDurataPrevista(durataPrevista) {
  const d = oreFinite(durataPrevista);
  return d != null && d > 0 ? d * ORE_PER_GIORNO_STIMA : null;
}

/**
 * Risolve ore (e costi, se disponibili) di un lavoro collegato.
 * Se esistono ore validate (`costi.oreValidate > 0`) → ore e costi dalle validate;
 * altrimenti stima durataPrevista × 8 (senza costi: i campi costo restano `undefined`).
 *
 * @param {{ durataPrevista?: * }|null} lavoro
 * @param {{ oreValidate?: number, costoManodopera?: number, costoMacchine?: number }|null} costi - esito `calcolaCostiLavoro`
 * @returns {{ oreImpiegate: number|null, costoManodopera?: number, costoMacchina?: number, daValidate: boolean }}
 */
export function risolviOreCostiLavoro(lavoro, costi) {
  const oreValidate = oreFinite(costi && costi.oreValidate);
  if (oreValidate != null && oreValidate > 0) {
    const out = { oreImpiegate: oreValidate, daValidate: true };
    const cm = oreFinite(costi.costoManodopera);
    const cmac = oreFinite(costi.costoMacchine);
    if (cm != null) out.costoManodopera = cm;
    if (cmac != null) out.costoMacchina = cmac;
    return out;
  }
  return {
    oreImpiegate: stimaOreDaDurataPrevista(lavoro && lavoro.durataPrevista),
    daValidate: false
  };
}

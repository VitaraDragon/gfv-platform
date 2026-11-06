/**
 * Quantità prodotto da dose × superficie (registro trattamenti / concimazioni).
 * Funzioni pure: mai NaN in output, la dose accetta fino a 3 decimali (step 0.001).
 *
 * @module shared/js/quantita-dose
 */

import { numeroFinito } from './registro-trattamenti.js';

/** Step HTML degli input dose (L/ha, kg/ha, …): fino a 3 decimali. */
export const STEP_DOSE = '0.001';
/** Cifre decimali mostrate per le quantità. */
export const DECIMALI_QUANTITA = 3;

/**
 * Quantità di una riga prodotto: dosaggio × superficie se entrambi finiti (superficie > 0),
 * altrimenti la quantità salvata se finita, altrimenti null.
 * @param {{ dosaggio?: *, quantita?: * }|null} riga
 * @param {*} superficie - ettari
 * @returns {number|null}
 */
export function quantitaRigaProdotto(riga, superficie) {
  const dosaggio = numeroFinito(riga && riga.dosaggio);
  const sup = numeroFinito(superficie);
  if (dosaggio != null && sup != null && sup > 0) {
    const q = dosaggio * sup;
    if (Number.isFinite(q)) return q;
  }
  return numeroFinito(riga && riga.quantita);
}

/**
 * Testo per la quantità: `toFixed(3)` se finita, altrimenti '-'.
 * @param {*} quantita
 * @returns {string}
 */
export function formattaQuantita(quantita) {
  const q = numeroFinito(quantita);
  return q != null ? q.toFixed(DECIMALI_QUANTITA) : '-';
}

/**
 * Stati del guasto, senza Firebase.
 * Un guasto vecchio senza stato vale come in attesa: il manager non ha ancora deciso.
 * Annullato è chiuso, come risolto, riparato e chiuso.
 * @module core/services/guasto-stati
 */

export const STATI_GUASTO_CHIUSI = Object.freeze(['risolto', 'annullato', 'riparato', 'chiuso']);

const CHIAVI_BADGE = Object.freeze([
  'in-attesa',
  'approvato-continuazione',
  'sospeso',
  'risolto',
  'annullato'
]);

/**
 * @param {unknown} stato
 * @returns {string}
 */
export function normalizzaStatoGuasto(stato) {
  const testo = String(stato == null ? '' : stato).trim().toLowerCase();
  return testo || 'in-attesa';
}

/**
 * Il manager non ha ancora deciso. Come le rules: assente o in-attesa.
 * @param {unknown} stato
 * @returns {boolean}
 */
export function isGuastoNonDeciso(stato) {
  return normalizzaStatoGuasto(stato) === 'in-attesa';
}

/**
 * @param {unknown} stato
 * @returns {boolean}
 */
export function isGuastoChiuso(stato) {
  return STATI_GUASTO_CHIUSI.includes(normalizzaStatoGuasto(stato));
}

/**
 * Anche uno stato sconosciuto resta attivo: non va contato come chiuso.
 * @param {unknown} stato
 * @returns {boolean}
 */
export function isGuastoAttivo(stato) {
  return !isGuastoChiuso(stato);
}

/**
 * Chiave del badge. riparato e chiuso si mostrano come risolto.
 * Uno stato sconosciuto resta «sconosciuto»: la pagina mostra il valore grezzo.
 * @param {unknown} stato
 * @returns {'in-attesa'|'approvato-continuazione'|'sospeso'|'risolto'|'annullato'|'sconosciuto'}
 */
export function chiaveBadgeStatoGuasto(stato) {
  const normalizzato = normalizzaStatoGuasto(stato);
  if (normalizzato === 'riparato' || normalizzato === 'chiuso') return 'risolto';
  if (CHIAVI_BADGE.includes(normalizzato)) return normalizzato;
  return 'sconosciuto';
}

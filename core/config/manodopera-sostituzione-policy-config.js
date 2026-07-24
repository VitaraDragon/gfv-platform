/**
 * Policy tenant minima per shortlist sostituti e prestito manodopera.
 * Config > hardcode pagina: priorità, prestabilità, pesi score.
 *
 * @module core/config/manodopera-sostituzione-policy-config
 */

/** Priorità operativa (3 livelli): più alto = meno prestabile come origine. */
export const PRIORITA_LIVELLI = Object.freeze({
  critico: 3,
  normale: 2,
  scalabile: 1
});

export const PRIORITA_DEFAULT = 'normale';

/**
 * Pesi score shortlist (indicativi, calibrabili per tenant).
 * score = stelle * wStelle + bonusLibero + bonusSpostabile - penalitaOrigineSottoSoglia
 */
export const SOSTITUZIONE_SCORE_WEIGHTS = Object.freeze({
  stelle: 10,
  bonusLibero: 5,
  bonusSpostabile: 2,
  penalitaOrigineSottoSoglia: 4
});

/**
 * Se true, candidati su lavoro non prestabile restano in shortlist come «impegnato»
 * (override manager esplicito). Se false, esclusi dallo stadio disponibilità.
 */
export const ALLOW_IMPEGNATO_IN_SHORTLIST = true;

/**
 * @param {Object} [lavoro]
 * @returns {'critico'|'normale'|'scalabile'}
 */
export function resolvePrioritaLavoro(lavoro = {}) {
  const raw = lavoro.prioritaOperativa || lavoro.priorita;
  if (raw && Object.prototype.hasOwnProperty.call(PRIORITA_LIVELLI, raw)) {
    return raw;
  }
  if (lavoro.sospendibile === true || lavoro.ritardabile === true) {
    return 'scalabile';
  }
  return PRIORITA_DEFAULT;
}

/**
 * @param {string} priorita
 * @returns {number}
 */
export function getPrioritaRank(priorita) {
  return PRIORITA_LIVELLI[priorita] ?? PRIORITA_LIVELLI[PRIORITA_DEFAULT];
}

/**
 * Un lavoro di origine è prestabile se sospendibile/ritardabile
 * oppure ha priorità strettamente inferiore al lavoro destinazione.
 *
 * @param {Object|null} lavoroOrigine
 * @param {Object|null} lavoroDestinazione
 * @returns {boolean}
 */
export function isLavoroPrestabile(lavoroOrigine, lavoroDestinazione) {
  if (!lavoroOrigine) return false;
  if (lavoroOrigine.sospendibile === true || lavoroOrigine.ritardabile === true) {
    return true;
  }
  const pOrig = getPrioritaRank(resolvePrioritaLavoro(lavoroOrigine));
  const pDest = getPrioritaRank(resolvePrioritaLavoro(lavoroDestinazione || {}));
  return pOrig < pDest;
}

/**
 * @param {Object} candidato
 * @param {typeof SOSTITUZIONE_SCORE_WEIGHTS} [weights]
 * @returns {number}
 */
export function computeShortlistScore(candidato, weights = SOSTITUZIONE_SCORE_WEIGHTS) {
  let score = (candidato.stelleMinime || 0) * (weights.stelle || 0);
  if (candidato.disponibilita === 'libero') score += weights.bonusLibero || 0;
  if (candidato.disponibilita === 'spostabile') score += weights.bonusSpostabile || 0;
  if (candidato.origineSottoSogliaDopoPrestito) {
    score -= weights.penalitaOrigineSottoSoglia || 0;
  }
  return score;
}

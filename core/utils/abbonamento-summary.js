/**
 * Parti del riepilogo Abbonamento (prove vs «nessun modulo»).
 * Il prezzo resta calcolato a parte sui soli moduli/bundle pagati.
 * @module core/utils/abbonamento-summary
 */

/**
 * @param {{
 *   effectiveModules?: string[],
 *   trialModuleIds?: string[],
 *   trialLabels?: string[]
 * }} input
 * @returns {{
 *   showNessunModuloAttivo: boolean,
 *   trialBlockText: string|null
 * }}
 */
export function buildAbbonamentoSummaryTrialState(input = {}) {
  const effective = Array.isArray(input.effectiveModules) ? input.effectiveModules : [];
  const trialIds = Array.isArray(input.trialModuleIds) ? input.trialModuleIds : [];
  const labels = Array.isArray(input.trialLabels) ? input.trialLabels : [];

  let trialBlockText = null;
  if (trialIds.length > 0) {
    const body = labels.length > 0 ? labels.join('; ') : trialIds.join('; ');
    trialBlockText = `In prova (${trialIds.length}): ${body}`;
  }

  return {
    showNessunModuloAttivo: effective.length === 0,
    trialBlockText,
  };
}

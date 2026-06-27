/**
 * Compatibilità CV trattore ↔ attrezzi (dropdown lavori, Tony, attività).
 * @module core/js/macchine-cv-compat
 */

/**
 * Attrezzi il cui minimo CV è soddisfatto dal trattore; senza potenza trattore → tutti.
 * @param {{ cavalli?: number|string|null }} trattore
 * @param {Array<{ cavalliMinimiRichiesti?: number|string|null, stato?: string }>} attrezziList
 * @returns {Array}
 */
export function attrezziCompatibiliConTrattoreCv(trattore, attrezziList) {
  if (!Array.isArray(attrezziList)) return [];
  if (!trattore) return attrezziList.slice();
  const cv = Number(trattore.cavalli);
  const hasPotenza = Number.isFinite(cv) && cv > 0;
  if (!hasPotenza) return attrezziList.slice();
  return attrezziList.filter((a) => {
    if (!a) return false;
    const minRaw = a.cavalliMinimiRichiesti;
    const minN =
      minRaw != null && minRaw !== '' && Number.isFinite(Number(minRaw)) ? Number(minRaw) : 0;
    return cv >= minN;
  });
}

/**
 * Filtro dropdown attrezzi (gestione lavori): esclude dismessi + regole CV.
 * @param {{ cavalli?: number|string|null }} trattore
 * @param {Array} attrezziList
 * @returns {Array}
 */
export function filterAttrezziDropdownCompatibili(trattore, attrezziList) {
  if (!Array.isArray(attrezziList)) return [];
  const cvTrattore = trattore ? Number(trattore.cavalli) : NaN;
  const hasPotenzaTrattore = Number.isFinite(cvTrattore) && cvTrattore > 0;

  return attrezziList.filter((attrezzo) => {
    if (!attrezzo || attrezzo.stato === 'dismesso') return false;
    if (!hasPotenzaTrattore) return true;
    const minRaw = attrezzo.cavalliMinimiRichiesti;
    const minN =
      minRaw != null && minRaw !== '' && Number.isFinite(Number(minRaw)) ? Number(minRaw) : 0;
    return cvTrattore >= minN;
  });
}

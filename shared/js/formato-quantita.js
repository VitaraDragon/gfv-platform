/**
 * Quantità in formato italiano, solo visualizzazione.
 * Fino a 3 decimali, virgola decimale, punto delle migliaia.
 * Il risultato non va mai in un `.value`: dose × superficie si ricalcola dai numeri.
 *
 * @module shared/js/formato-quantita
 */

const formatoQuantitaIt = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 3,
  useGrouping: 'always'
});

/**
 * @param {*} valore
 * @returns {number|null} null se assente o non numerico. -0 diventa 0.
 */
function leggiNumero(valore) {
  if (valore == null || valore === '') return null;
  const n = typeof valore === 'number'
    ? valore
    : (typeof valore === 'string' ? Number(valore.trim()) : Number.NaN);
  if (!Number.isFinite(n)) return null;
  return n === 0 ? 0 : n;
}

/**
 * Testo quantità. `useGrouping: 'always'` tiene il punto delle migliaia
 * anche quando ci sono i decimali (senza, 1234,567 esce senza raggruppamento).
 *
 * @param {*} valore
 * @param {string} [unita] aggiunta dopo uno spazio, solo se il numero c'è
 * @param {string} [vuoto='-'] segnaposto della pagina (trattino, «—», «0»)
 * @returns {string}
 */
export function formatQuantita(valore, unita, vuoto) {
  const segnaposto = vuoto == null ? '-' : String(vuoto);
  const n = leggiNumero(valore);
  if (n == null) return segnaposto;
  const testo = formatoQuantitaIt.format(n);
  const u = unita == null ? '' : String(unita).trim();
  return u ? testo + ' ' + u : testo;
}

/**
 * Numero grezzo per `data-valore` sullo span. Stringa vuota se non numerico.
 * Il simulatore legge questo, non il testo italiano.
 *
 * @param {*} valore
 * @returns {string}
 */
export function valoreQuantitaGrezzo(valore) {
  const n = leggiNumero(valore);
  return n == null ? '' : String(n);
}

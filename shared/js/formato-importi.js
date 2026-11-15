/**
 * Euro e ettari in formato italiano, solo visualizzazione.
 * Virgola decimale, punto delle migliaia. Il risultato non va in un `.value`
 * e non va riletto con parseFloat: i calcoli usano il numero.
 *
 * @module shared/js/formato-importi
 */

const formatoEuroIt = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always'
});

const formatoEttariIt = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
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
 * Punto delle migliaia anche se ICU usa uno spazio. Il segno meno resta il trattino ASCII.
 * @param {Intl.NumberFormat} formatter
 * @param {number} n
 * @returns {string}
 */
function testoIt(formatter, n) {
  return formatter.format(n)
    .replace(/[\u00A0\u202F\u2009]/g, '.')
    .replace(/\u2212/g, '-');
}

/**
 * «€ 915,00», «€ 1.234,50». Simbolo davanti, due decimali.
 *
 * @param {*} valore
 * @param {string} [vuoto='-'] segnaposto se il valore non è un numero
 * @returns {string}
 */
export function formatEuro(valore, vuoto) {
  const segnaposto = vuoto == null ? '-' : String(vuoto);
  const n = leggiNumero(valore);
  if (n == null) return segnaposto;
  return '€ ' + testoIt(formatoEuroIt, n);
}

/**
 * Ettari: almeno 2 decimali, fino a 4. 5 → «5,00», 0,4567 → «0,4567», 1200 → «1.200,00».
 *
 * @param {*} valore
 * @param {string} [vuoto='-'] segnaposto se il valore non è un numero
 * @returns {string}
 */
export function formatEttari(valore, vuoto) {
  const segnaposto = vuoto == null ? '-' : String(vuoto);
  const n = leggiNumero(valore);
  if (n == null) return segnaposto;
  return testoIt(formatoEttariIt, n);
}

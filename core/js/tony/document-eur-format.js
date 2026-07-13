/**
 * Formattazione importi EUR (it-IT) per Tony Occhi — form revisione documenti.
 * @module core/js/tony/document-eur-format
 */

const EUR_DISPLAY = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const EUR_INPUT = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * @param {number|null|undefined} amount
 * @returns {string}
 */
export function formatEurDisplay(amount) {
  if (amount == null || amount === '' || !Number.isFinite(Number(amount))) return '—';
  return EUR_DISPLAY.format(Number(amount));
}

/**
 * Valore per input editabile (senza simbolo € — mostrato via CSS).
 * @param {number|null|undefined} amount
 * @returns {string}
 */
export function formatEurForInput(amount) {
  if (amount == null || amount === '' || !Number.isFinite(Number(amount))) return '';
  return EUR_INPUT.format(Number(amount));
}

/**
 * Interpreta testo inserito dall'utente (12,50 · 12.50 · 1.234,56 €).
 * @param {string|number|null|undefined} raw
 * @returns {number|null}
 */
export function parseEurInput(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  var s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/\s/g, '').replace(/€/g, '');
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  var n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

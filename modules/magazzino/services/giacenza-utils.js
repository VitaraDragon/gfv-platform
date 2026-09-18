/**
 * Delta giacenza magazzino — funzioni pure, senza I/O.
 * Lo scarico oltre giacenza è permesso (il totale può diventare negativo).
 *
 * @module modules/magazzino/services/giacenza-utils
 */

/**
 * @param {*} delta
 * @returns {number}
 */
export function parseGiacenzaDelta(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n)) {
    throw new Error('Delta giacenza non valido');
  }
  return n;
}

/**
 * Variazione giacenza per un movimento: entrata +, uscita −.
 * @param {string} tipo
 * @param {number} quantita
 * @returns {number}
 */
export function movimentoGiacenzaDelta(tipo, quantita) {
  const q = Number(quantita);
  if (!Number.isFinite(q) || q <= 0) {
    throw new Error('Quantità movimento non valida');
  }
  if (tipo === 'entrata') return q;
  if (tipo === 'uscita') return -q;
  throw new Error('Tipo movimento non valido');
}

/**
 * Anagrafica prodotto non deve riscrivere `giacenza` (la tengono i movimenti via increment).
 * @param {Object} data
 * @returns {Object}
 */
export function omitGiacenzaFromAnagraficaPayload(data) {
  if (!data || typeof data !== 'object') return data;
  const { giacenza, ...rest } = data;
  return rest;
}

/**
 * Somma corretta di delta concorrenti (quello che fa FieldValue.increment).
 * @param {number} start
 * @param {number[]} deltas
 * @returns {number}
 */
export function composeGiacenza(start, deltas) {
  return (Number(start) || 0) + (Array.isArray(deltas) ? deltas.reduce((acc, d) => acc + Number(d), 0) : 0);
}

/**
 * Race read-modify-write: ogni writer ha letto `start` e l'ultimo overwrite vince.
 * @param {number} start
 * @param {number[]} deltas
 * @returns {number}
 */
export function lastWriteWinsGiacenza(start, deltas) {
  const s = Number(start) || 0;
  if (!Array.isArray(deltas) || !deltas.length) return s;
  return s + Number(deltas[deltas.length - 1]);
}

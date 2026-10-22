/**
 * Aiuto condiviso per i test della landing (senza Firebase/rete/browser).
 */

/**
 * Raccoglie tutte le stringhe annidate in un valore (oggetto/array).
 * @param {unknown} valore
 * @param {string[]} [acc]
 * @returns {string[]}
 */
export function raccogliStringhe(valore, acc = []) {
  if (typeof valore === 'string') {
    acc.push(valore);
    return acc;
  }
  if (Array.isArray(valore)) {
    valore.forEach((v) => raccogliStringhe(v, acc));
    return acc;
  }
  if (valore && typeof valore === 'object') {
    Object.values(valore).forEach((v) => raccogliStringhe(v, acc));
  }
  return acc;
}

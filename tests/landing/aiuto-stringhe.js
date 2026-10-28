/**
 * Aiuto condiviso per i test della landing (senza Firebase/rete/browser).
 */

/** Unico file della landing autorizzato a nominare Firebase / reCAPTCHA (passo 9). */
export const FILE_FIREBASE_LANDING = 'landing/src/lib/firebase-landing.js';

/** Secondo file Firebase (Auth/Firestore/Functions) del passo 13: niente initializeApp. */
export const FILE_FIREBASE_ACCOUNT_LANDING = 'landing/src/lib/firebase-landing-account.js';

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

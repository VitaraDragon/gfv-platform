/**
 * Attese con un limite. Nessun timer lasciato acceso a fine lettura.
 * @module core/js/tony/tony-attesa-riprova
 */

/**
 * Risolve con il valore della promessa, oppure rifiuta se passa il limite.
 * Il timer viene spento appena c'è un esito.
 * @param {Promise<unknown>} promessa
 * @param {number} ms
 * @returns {Promise<unknown>}
 */
export function conTimeout(promessa, ms) {
  const limite = Number(ms);
  let timer = null;
  const scadenza = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timer = null;
      reject(new Error('Tempo scaduto'));
    }, limite);
  });
  return Promise.race([Promise.resolve(promessa), scadenza]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Millisecondi prima di un nuovo tentativo automatico.
 * Il primo fallimento aspetta 3 secondi e riprova da solo.
 * Dal secondo in poi l'attesa è 0: si mostra «Riprova» e non si riprova da soli.
 * @param {number} tentativo tentativo appena fallito (1, 2, 3…)
 * @returns {number}
 */
export function prossimaAttesaRiprova(tentativo) {
  const n = Number(tentativo) || 0;
  if (n === 1) return 3000;
  return 0;
}

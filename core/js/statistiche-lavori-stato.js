/**
 * Conteggi lavori per stato (statistiche manodopera).
 * Modulo puro: niente Firebase, niente DOM.
 * @module core/js/statistiche-lavori-stato
 */

/**
 * Attivi = in corso / assegnati (+ legacy `attivo`).
 * Pianificati = da pianificare (+ legacy `pianificato`).
 * Completati = solo `completato`.
 * Sospesi = `sospeso` + `in_standby`.
 * Altri = tutto il resto (annullato, completato_da_approvare, stati sconosciuti).
 * La somma attivi+pianificati+completati+sospesi+altri è sempre uguale a totali.
 *
 * @param {{ stato?: string }[]|Iterable<{ stato?: string }>|null|undefined} lavori
 * @returns {{
 *   totali: number,
 *   attivi: number,
 *   pianificati: number,
 *   completati: number,
 *   sospesi: number,
 *   altri: number
 * }}
 */
export function calcolaLavoriPerStato(lavori) {
  const counts = {
    totali: 0,
    attivi: 0,
    pianificati: 0,
    completati: 0,
    sospesi: 0,
    altri: 0
  };

  const lista = Array.isArray(lavori)
    ? lavori
    : (lavori && typeof lavori[Symbol.iterator] === 'function' ? Array.from(lavori) : []);

  for (const lavoro of lista) {
    counts.totali += 1;
    const stato = (lavoro && lavoro.stato) || 'pianificato';

    if (stato === 'in_corso' || stato === 'assegnato' || stato === 'attivo') {
      counts.attivi += 1;
    } else if (stato === 'da_pianificare' || stato === 'pianificato') {
      counts.pianificati += 1;
    } else if (stato === 'completato') {
      counts.completati += 1;
    } else if (stato === 'sospeso' || stato === 'in_standby') {
      counts.sospesi += 1;
    } else {
      counts.altri += 1;
    }
  }

  return counts;
}

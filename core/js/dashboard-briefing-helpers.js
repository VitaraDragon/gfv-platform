/**
 * Briefing proattivo di Tony sulla dashboard: saluto per fascia oraria e
 * attesa del meteo con un limite. Funzioni pure, senza DOM né Tony.
 * @module core/js/dashboard-briefing-helpers
 */

import { proactiveFasciaForDate } from './tony-proactive-briefing-policy.js';

/** Oltre questo tempo il briefing parte senza la frase sul meteo. */
export const BRIEFING_METEO_ATTESA_MS = 4000;

const SALUTO_PER_FASCIA = {
  mattina: 'Buongiorno!',
  pomeriggio: 'Buon pomeriggio!',
  sera: 'Buonasera!',
};

/**
 * Saluto del briefing secondo le fasce della policy (mattina 5-12,
 * pomeriggio 12-18, sera 18-5).
 * @param {Date} [now]
 * @returns {string}
 */
export function salutoBriefingPerOra(now) {
  return SALUTO_PER_FASCIA[proactiveFasciaForDate(now)];
}

/**
 * Aspetta la promessa al massimo `ms` millisecondi.
 * Se non arriva in tempo, o fallisce, risolve null; la promessa originale
 * resta valida e chi la tiene può usarne il risultato più tardi.
 * @template T
 * @param {Promise<T>|T} promessa
 * @param {number} ms
 * @returns {Promise<T|null>}
 */
export function attendiConLimite(promessa, ms) {
  let timer = null;
  const limite = new Promise(function (resolve) {
    timer = setTimeout(function () {
      resolve(null);
    }, ms);
  });
  const esito = Promise.resolve(promessa).catch(function () {
    return null;
  });
  return Promise.race([esito, limite]).finally(function () {
    clearTimeout(timer);
  });
}

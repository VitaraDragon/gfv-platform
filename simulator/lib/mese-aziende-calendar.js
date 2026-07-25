/**
 * Mix tipi lavoro tipici di un mese agricolo (lab scenarioMese).
 * @module simulator/lib/mese-aziende-calendar
 */

/** Pattern ciclico ~5 giorni: manuale → trattamento → meccanico → concimazione → controllo */
const PATTERN_MESE = [
  'Potatura',
  'Trattamento',
  'Erpicatura',
  'Concimazione',
  'Controllo fitosanitario'
];

/**
 * @param {number} dayIndex
 * @param {string[]} [tipiFallback]
 * @param {{ fruttetoOnly?: boolean, isFruitTerreno?: boolean }} [opts]
 * @returns {string}
 */
export function tipoLavoroPerGiornoMese(dayIndex, tipiFallback = PATTERN_MESE, opts = {}) {
  const pool = Array.isArray(tipiFallback) && tipiFallback.length ? tipiFallback : PATTERN_MESE;
  let tipo = pool[dayIndex % pool.length] || PATTERN_MESE[dayIndex % PATTERN_MESE.length];

  // Un giorno su 11: lavoro tipicamente meccanizzato (erpicatura) se non già
  if (dayIndex % 11 === 7 && !/Erpicatura|Trattamento/i.test(tipo)) {
    tipo = pool.includes('Erpicatura') ? 'Erpicatura' : tipo;
  }
  // Un giorno su 9: lavoro tipicamente manuale (potatura)
  if (dayIndex % 9 === 3 && pool.includes('Potatura')) {
    tipo = 'Potatura';
  }

  if ((opts.fruttetoOnly || opts.isFruitTerreno) && tipo === 'Vendemmia Manuale') {
    return 'Raccolta';
  }
  return tipo;
}

/**
 * Durata prevista lavori squadra lab mese: primo = 1 giorno, poi multi-giorno.
 * @param {number} index
 * @param {boolean} scenarioMese
 */
export function durataLavoroSquadraMese(index, scenarioMese) {
  if (!scenarioMese) return 5 + (index % 3);
  if (index === 0) return 1;
  return 4 + (index % 3); // 4–6 giorni
}

/**
 * Durata lavori autonomi lab mese: preferisci 1 giorno.
 * @param {number} index
 * @param {boolean} scenarioMese
 */
export function durataLavoroAutonomoMese(index, scenarioMese) {
  if (!scenarioMese) return 3 + index;
  return index === 0 ? 1 : 2;
}

/**
 * @param {object} template
 */
export function isScenarioMeseTemplate(template) {
  return !!(
    template?.scenarioMese ||
    template?.attivita?.scenarioMese ||
    template?.manodopera?.scenarioMese
  );
}

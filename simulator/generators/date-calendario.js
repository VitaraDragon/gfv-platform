/**
 * Calendario lavorativo relativo a oggi (no weekend, no date future).
 * @module simulator/generators/date-calendario
 */

function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * @param {number} count - Giorni lavorativi richiesti
 * @param {Date} [referenceDate=new Date()]
 * @returns {string[]} Date YYYY-MM-DD dal più vecchio al più recente
 */
export function generaGiorniLavorativi(count, referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const dates = [];
  const cursor = new Date(today);

  while (dates.length < count) {
    if (!isWeekend(cursor)) {
      dates.unshift(formatDateLocal(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
    if (cursor.getFullYear() < today.getFullYear() - 2) {
      throw new Error('Impossibile generare abbastanza giorni lavorativi nel range');
    }
  }

  return dates;
}

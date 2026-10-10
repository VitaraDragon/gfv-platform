/**
 * Giorni di calendario relativi a oggi, sabato e domenica compresi.
 * Nessuna data futura. In campagna si lavora tutti i giorni: il seed
 * deve coprire anche il weekend, così uno scenario con «oggi» non
 * dipende dal giorno in cui parte la CI.
 * @module simulator/generators/date-calendario
 */

function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {number} count - Giorni richiesti, weekend inclusi
 * @param {Date} [referenceDate=new Date()]
 * @returns {string[]} Date YYYY-MM-DD dal più vecchio al più recente
 */
export function generaGiorniLavorativi(count, referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const dates = [];
  const cursor = new Date(today);

  while (dates.length < count) {
    dates.unshift(formatDateLocal(cursor));
    cursor.setDate(cursor.getDate() - 1);
    if (cursor.getFullYear() < today.getFullYear() - 2) {
      throw new Error('Impossibile generare abbastanza giorni nel range');
    }
  }

  return dates;
}

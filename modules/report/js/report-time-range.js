/**
 * Periodi per report: annata agraria (11 nov – 10 nov), annata solare, intervallo personalizzato.
 */

/**
 * @param {Date} [refDate]
 * @returns {{ start: Date, end: Date, label: string }}
 */
export function getAgrarianYearBounds(refDate = new Date()) {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const d = refDate.getDate();
  let startY = y;
  if (m < 10 || (m === 10 && d < 11)) {
    startY = y - 1;
  }
  const start = new Date(startY, 10, 11, 0, 0, 0, 0);
  const end = new Date(startY + 1, 10, 10, 23, 59, 59, 999);
  return {
    start,
    end,
    label: `Annata agraria ${startY}/${startY + 1} (11 nov – 10 nov)`
  };
}

/**
 * Anno solare (1 gen – 31 dic) per l'anno di refDate.
 * @param {Date} [refDate]
 */
export function getSolarYearBounds(refDate = new Date()) {
  const y = refDate.getFullYear();
  const start = new Date(y, 0, 1, 0, 0, 0, 0);
  const end = new Date(y, 11, 31, 23, 59, 59, 999);
  return {
    start,
    end,
    label: `Anno solare ${y}`
  };
}

/**
 * @param {Date} start
 * @param {Date} end
 */
export function formatRangeIt(start, end) {
  try {
    const o = { day: 'numeric', month: 'long', year: 'numeric' };
    return `${start.toLocaleDateString('it-IT', o)} — ${end.toLocaleDateString('it-IT', o)}`;
  } catch (_) {
    return '';
  }
}

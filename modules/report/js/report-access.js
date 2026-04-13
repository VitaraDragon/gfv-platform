/**
 * Accesso modulo Report: ruoli strategici (Manager / Amministratore) e modulo `report` attivo.
 */

/**
 * @param {{ ruoli?: string[] } | null | undefined} userData
 * @returns {boolean}
 */
export function canAccessStrategicReports(userData) {
  const ruoli = userData && Array.isArray(userData.ruoli) ? userData.ruoli : [];
  return ruoli.some((r) => {
    const x = String(r || '').toLowerCase();
    return x.includes('manager') || x.includes('amministratore') || x === 'admin';
  });
}

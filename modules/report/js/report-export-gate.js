/**
 * Abilita/disabilita export solo a render completo (niente flash durante «Caricamento…»).
 * Condiviso Economici / Manodopera.
 *
 * @param {HTMLButtonElement|null|undefined} btn
 * @param {boolean} enabled
 */
export function setReportExportEnabled(btn, enabled) {
  if (!btn) return;
  btn.disabled = !enabled;
}

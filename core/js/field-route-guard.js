/**
 * Guardia di interfaccia per il profilo campo.
 * Non sostituisce le regole Firestore: un indirizzo desktop digitato a mano
 * torna al workspace, senza mostrare la pagina.
 * Spegnere: FIELD_ROUTE_GUARD_ENABLED = false
 * @module core/js/field-route-guard
 */

import {
  guardiaRottaCampo,
  indizioRuoliCampo,
  paginaStrumentoDev,
  urlWorkspaceDaPercorso,
  CHIAVE_INGRESSO_ULTIMO,
  CHIAVE_RIMBALZI_INGRESSO,
} from './tony/tony-ingresso-login.js';

export const FIELD_ROUTE_GUARD_ENABLED = true;

function rivelaPaginaDesktop() {
  try {
    if (document.documentElement.getAttribute('data-ingresso') === 'attesa') {
      document.documentElement.removeAttribute('data-ingresso');
    }
  } catch (e) { /* ignore */ }
}

/**
 * Nessuna attesa e nessun timer. Usa solo l'indizio già in memoria.
 * La dashboard ha la sua decisione (ruoli veri) e non passa di qui.
 * @returns {'off'|'dashboard'|'stop'|'workspace'|'consenti'}
 */
export function avviaGuardiaRottaCampo() {
  if (!FIELD_ROUTE_GUARD_ENABLED) {
    rivelaPaginaDesktop();
    return 'off';
  }
  if (typeof window === 'undefined' || !window.location) return 'consenti';
  const path = window.location.pathname || '';
  if (/dashboard-standalone/i.test(path)) return 'dashboard';
  if (paginaStrumentoDev(path)) {
    rivelaPaginaDesktop();
    return 'consenti';
  }
  let ultimo = '';
  let ruoli = [];
  let rimbalzi = 0;
  try { ultimo = localStorage.getItem(CHIAVE_INGRESSO_ULTIMO) || ''; } catch (e) { /* ignore */ }
  try {
    const raw = sessionStorage.getItem('gfv_tony_utente_ruoli');
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) ruoli = parsed;
  } catch (e2) { /* ignore */ }
  try { rimbalzi = Number(sessionStorage.getItem(CHIAVE_RIMBALZI_INGRESSO) || '0') || 0; } catch (e3) { /* ignore */ }
  if (rimbalzi >= 2) {
    rivelaPaginaDesktop();
    return 'stop';
  }
  const indizio = indizioRuoliCampo({ ultimo: ultimo, ruoli: ruoli });
  const esito = guardiaRottaCampo({
    ruoli: indizio.ruoli,
    moduli: indizio.moduli,
    pathname: path,
  });
  if (esito.azione !== 'workspace') {
    rivelaPaginaDesktop();
    return 'consenti';
  }
  try { document.documentElement.setAttribute('data-ingresso', 'attesa'); } catch (e4) { /* ignore */ }
  const dest = urlWorkspaceDaPercorso(path);
  try {
    window.location.replace(dest);
  } catch (e5) {
    window.location.href = dest;
  }
  return 'workspace';
}

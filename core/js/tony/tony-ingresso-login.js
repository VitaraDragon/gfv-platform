/**
 * Una sola decisione dopo il login: area di lavoro, dashboard, oppure stop.
 * Non legge il browser: la pagina passa ruoli, moduli, preferenza e rimbalzi.
 * @module core/js/tony/tony-ingresso-login
 */

export const CHIAVE_RIMBALZI_INGRESSO = 'gfv_workspace_rimbalzi';

function normalizzaLista(v) {
  return (Array.isArray(v) ? v : []).map((x) => String(x || '').toLowerCase());
}

/**
 * Dove va l'utente appena entrato.
 * Manager e amministratore restano in dashboard.
 * Senza Manodopera si resta in dashboard.
 * La preferenza «classic» vale solo se l'utente l'ha scelta.
 * Dopo un rimbalzo automatico si riprova l'area di lavoro una volta.
 * Al secondo rimbalzo ci si ferma.
 *
 * @param {{ ruoli?: string[], moduli?: string[], preferenza?: string, rimbalzi?: number }} [input]
 * @returns {{ scelta: 'workspace'|'dashboard'|'errore', motivo: string }}
 */
export function spiegaIngressoDopoLogin(input) {
  const src = input || {};
  const ruoli = normalizzaLista(src.ruoli);
  const moduli = normalizzaLista(src.moduli);
  const preferenza = String(src.preferenza || 'auto').toLowerCase();
  const rimbalzi = Number(src.rimbalzi) || 0;
  const manager = ruoli.indexOf('manager') >= 0 || ruoli.indexOf('amministratore') >= 0;
  if (manager) return { scelta: 'dashboard', motivo: 'manager' };
  if (moduli.indexOf('manodopera') < 0) return { scelta: 'dashboard', motivo: 'senza manodopera' };
  if (preferenza === 'classic') return { scelta: 'dashboard', motivo: 'preferenza classica' };
  const campo = ruoli.indexOf('operaio') >= 0 || ruoli.indexOf('caposquadra') >= 0;
  if (!campo) return { scelta: 'dashboard', motivo: 'ruolo senza area di lavoro' };
  if (rimbalzi >= 2) return { scelta: 'errore', motivo: 'secondo rimbalzo' };
  return { scelta: 'workspace', motivo: 'operaio o caposquadra con manodopera' };
}

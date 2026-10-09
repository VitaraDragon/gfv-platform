/**
 * Una sola decisione dopo il login: area di lavoro, dashboard, oppure stop.
 * @param {{ ruoli?: string[], moduli?: string[], preferenza?: string, rimbalzi?: number }} [input]
 * @returns {'workspace'|'dashboard'|'errore'}
 */
export function decidiIngressoDopoLogin(input) {
  const src = input || {};
  const ruoli = normalizzaLista(src.ruoli);
  const moduli = normalizzaLista(src.moduli);
  const preferenza = String(src.preferenza || 'auto').toLowerCase();
  const rimbalzi = Number(src.rimbalzi) || 0;
  if (rimbalzi >= 2) return 'errore';
  const manager = ruoli.indexOf('manager') >= 0 || ruoli.indexOf('amministratore') >= 0;
  if (manager) return 'dashboard';
  const manodopera = moduli.indexOf('manodopera') >= 0;
  if (!manodopera) return 'dashboard';
  if (preferenza === 'classic') return 'dashboard';
  const campo = ruoli.indexOf('operaio') >= 0 || ruoli.indexOf('caposquadra') >= 0;
  if (campo) return 'workspace';
  return 'dashboard';
}

/**
 * @param {{ ruoli?: string[], moduli?: string[], preferenza?: string, rimbalzi?: number }} [input]
 * @returns {{ scelta: 'workspace'|'dashboard'|'errore', motivo: string }}
 */
export function spiegaIngressoDopoLogin(input) {
  const src = input || {};
  const scelta = decidiIngressoDopoLogin(src);
  const ruoli = normalizzaLista(src.ruoli);
  const moduli = normalizzaLista(src.moduli);
  const preferenza = String(src.preferenza || 'auto').toLowerCase();
  const rimbalzi = Number(src.rimbalzi) || 0;
  let motivo = 'ruolo senza area di lavoro';
  if (rimbalzi >= 2) motivo = 'secondo rimbalzo';
  else if (ruoli.indexOf('manager') >= 0 || ruoli.indexOf('amministratore') >= 0) motivo = 'manager';
  else if (moduli.indexOf('manodopera') < 0) motivo = 'senza manodopera';
  else if (preferenza === 'classic') motivo = 'preferenza classica';
  else if (ruoli.indexOf('operaio') >= 0 || ruoli.indexOf('caposquadra') >= 0) motivo = 'operaio o caposquadra con manodopera';
  return { scelta, motivo };
}

export const CHIAVE_RIMBALZI_INGRESSO = 'gfv_workspace_rimbalzi';

function normalizzaLista(v) {
  return (Array.isArray(v) ? v : []).map((x) => String(x || '').toLowerCase());
}

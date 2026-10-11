/**
 * Una sola decisione dopo il login: area di lavoro, dashboard, oppure stop.
 * Non legge il browser: la pagina passa ruoli, moduli, preferenza e rimbalzi.
 * @module core/js/tony/tony-ingresso-login
 */

export const CHIAVE_RIMBALZI_INGRESSO = 'gfv_workspace_rimbalzi';
export const CHIAVE_INGRESSO_ULTIMO = 'gfv_ingresso_ultimo';

function normalizzaLista(v) {
  return (Array.isArray(v) ? v : []).map((x) => String(x || '').toLowerCase());
}

/**
 * Profilo campo: solo operaio e/o caposquadra, modulo manodopera, senza manager né amministratore.
 * @param {string[]} [ruoli]
 * @param {string[]} [moduli]
 * @returns {boolean}
 */
export function eProfiloCampo(ruoli, moduli) {
  const r = normalizzaLista(ruoli);
  const m = normalizzaLista(moduli);
  if (r.indexOf('manager') >= 0 || r.indexOf('amministratore') >= 0) return false;
  if (m.indexOf('manodopera') < 0) return false;
  return r.indexOf('operaio') >= 0 || r.indexOf('caposquadra') >= 0;
}

/**
 * Dove va l'utente appena entrato.
 * Manager e amministratore restano in dashboard, anche se sono pure capo o operaio.
 * Senza Manodopera si resta in dashboard.
 * La preferenza «classic» è ignorata per il profilo campo.
 * Per manager/admin non sposta la casa: è già la dashboard.
 * Dopo due rimbalzi il profilo campo si ferma.
 *
 * @param {{ ruoli?: string[], moduli?: string[], preferenza?: string, rimbalzi?: number }} [input]
 * @returns {{ scelta: 'workspace'|'dashboard'|'errore', motivo: string }}
 */
export function scegliIngresso(input) {
  const src = input || {};
  const ruoli = normalizzaLista(src.ruoli);
  const moduli = normalizzaLista(src.moduli);
  const preferenza = String(src.preferenza || 'auto').toLowerCase();
  const rimbalzi = Number(src.rimbalzi) || 0;
  if (ruoli.indexOf('manager') >= 0 || ruoli.indexOf('amministratore') >= 0) {
    return { scelta: 'dashboard', motivo: 'manager' };
  }
  if (moduli.indexOf('manodopera') < 0) {
    return { scelta: 'dashboard', motivo: 'senza manodopera' };
  }
  const campo = ruoli.indexOf('operaio') >= 0 || ruoli.indexOf('caposquadra') >= 0;
  if (!campo) {
    if (preferenza === 'classic') return { scelta: 'dashboard', motivo: 'preferenza classica' };
    return { scelta: 'dashboard', motivo: 'ruolo senza area di lavoro' };
  }
  if (rimbalzi >= 2) return { scelta: 'errore', motivo: 'secondo rimbalzo' };
  return { scelta: 'workspace', motivo: 'operaio o caposquadra con manodopera' };
}

/**
 * @param {{ ruoli?: string[], moduli?: string[], preferenza?: string, rimbalzi?: number }} [input]
 * @returns {{ scelta: 'workspace'|'dashboard'|'errore', motivo: string }}
 */
export function spiegaIngressoDopoLogin(input) {
  return scegliIngresso(input);
}

/**
 * @param {string} [pathname]
 * @returns {string}
 */
export function normalizzaPercorso(pathname) {
  let p = String(pathname || '').replace(/\\/g, '/').toLowerCase();
  const q = p.indexOf('?');
  if (q >= 0) p = p.slice(0, q);
  const hash = p.indexOf('#');
  if (hash >= 0) p = p.slice(0, hash);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

const PERCORSI_CAMPO = [
  /\/core\/mobile\//,
  /\/core\/auth\/(login-standalone|registrazione-standalone|registrazione-invito-standalone|reset-password)/,
  /\/core\/admin\/impostazioni-standalone\.html$/,
  /\/core\/admin\/validazione-ore-standalone\.html$/,
  /\/core\/admin\/segnalazione-guasti-standalone\.html$/,
  /\/core\/admin\/lavori-caposquadra-standalone\.html$/,
  /\/core\/segnatura-ore-standalone\.html$/,
  /\/documentazione-utente\/guida-manodopera-utente\.html$/,
];

/**
 * Elenco bianco del profilo campo. Tutto il resto è una pagina desktop.
 * I file sotto core/js non sono pagine.
 * @param {string} pathname
 * @returns {boolean}
 */
export function percorsoConsentitoAlCampo(pathname) {
  const p = normalizzaPercorso(pathname);
  if (!p) return false;
  if (/\.(js|css|map|png|svg|json|woff2?)$/.test(p)) return true;
  return PERCORSI_CAMPO.some((re) => re.test(p));
}

/**
 * Il simulatore sceglie la persona. Non è una pagina desktop del profilo campo
 * e non va rimandato al workspace, altrimenti non si può più cambiare utente.
 * @param {string} pathname
 * @returns {boolean}
 */
export function paginaStrumentoDev(pathname) {
  const p = normalizzaPercorso(pathname);
  return p.indexOf('/core/dev/') >= 0 || p.indexOf('simulator-dev') >= 0;
}

/**
 * @param {{ ruoli?: string[], moduli?: string[], pathname?: string }} [input]
 * @returns {{ azione: 'consenti'|'workspace' }}
 */
export function guardiaRottaCampo(input) {
  const src = input || {};
  if (!eProfiloCampo(src.ruoli, src.moduli)) return { azione: 'consenti' };
  if (percorsoConsentitoAlCampo(src.pathname)) return { azione: 'consenti' };
  return { azione: 'workspace' };
}

/**
 * Indizio di interfaccia, mai un permesso.
 * `workspace` e `dashboard` vengono dall'ultimo ingresso.
 * I ruoli in sessione si usano solo se l'ultimo ingresso non dice il contrario.
 * @param {{ ultimo?: string, ruoli?: string[] }} [input]
 * @returns {{ ruoli: string[], moduli: string[], fonte: string }}
 */
export function indizioRuoliCampo(input) {
  const src = input || {};
  const ultimo = String(src.ultimo || '');
  if (ultimo === 'dashboard') {
    return { ruoli: ['manager'], moduli: ['manodopera'], fonte: 'indizio-dashboard' };
  }
  if (ultimo === 'workspace') {
    return { ruoli: ['operaio'], moduli: ['manodopera'], fonte: 'indizio-workspace' };
  }
  const ruoli = Array.isArray(src.ruoli) ? src.ruoli : [];
  const low = normalizzaLista(ruoli);
  const manager = low.indexOf('manager') >= 0 || low.indexOf('amministratore') >= 0;
  const campo = low.indexOf('operaio') >= 0 || low.indexOf('caposquadra') >= 0;
  if (!manager && campo) {
    return { ruoli: ruoli, moduli: ['manodopera'], fonte: 'indizio-ruoli' };
  }
  return { ruoli: ruoli, moduli: [], fonte: 'nessuno' };
}

/**
 * @param {string} pathname
 * @returns {string}
 */
export function urlWorkspaceDaPercorso(pathname) {
  const p = String(pathname || '').replace(/\\/g, '/');
  const low = p.toLowerCase();
  const i = low.indexOf('/modules/');
  const j = low.indexOf('/core/');
  const cut = i >= 0 ? i : (j >= 0 ? j : -1);
  const root = cut >= 0 ? p.slice(0, cut) : '';
  return root + '/core/mobile/field-workspace-standalone.html';
}

export function scriviIndizioIngresso(scelta) {
  try {
    if (scelta === 'workspace' || scelta === 'dashboard') {
      localStorage.setItem(CHIAVE_INGRESSO_ULTIMO, scelta);
    }
  } catch (e) { /* ignore */ }
}

export function pulisciIndizioIngresso() {
  try { localStorage.removeItem(CHIAVE_INGRESSO_ULTIMO); } catch (e) { /* ignore */ }
  try { sessionStorage.removeItem('gfv_tony_utente_ruoli'); } catch (e2) { /* ignore */ }
}

if (typeof window !== 'undefined') {
  window.__gfvScegliIngresso = scegliIngresso;
}

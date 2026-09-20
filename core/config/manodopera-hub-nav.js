/**
 * Link hub Manodopera vs dashboard principale (pagine manager/admin).
 * @module core/config/manodopera-hub-nav
 */

export const MANODOPERA_HUB_FROM_CORE_ADMIN =
    '../../modules/manodopera/views/manodopera-home-standalone.html';

export const MAIN_DASHBOARD_FROM_CORE_ADMIN = '../dashboard-standalone.html';

/**
 * @param {boolean} hasManodopera
 * @param {'core-admin'|'core-root'} [scope]
 * @returns {string}
 */
export function getManagerHomeHref(hasManodopera, scope = 'core-admin') {
    if (hasManodopera) {
        return scope === 'core-root'
            ? '../modules/manodopera/views/manodopera-home-standalone.html'
            : MANODOPERA_HUB_FROM_CORE_ADMIN;
    }
    return scope === 'core-root' ? 'dashboard-standalone.html' : MAIN_DASHBOARD_FROM_CORE_ADMIN;
}

/**
 * @param {boolean} hasManodopera
 * @returns {string}
 */
export function getManagerHomeLabel(_hasManodopera) {
    // Destinazione cambia (hub vs home app), etichetta no.
    // «← Dashboard Principale» sta solo sugli hub modulo.
    return '← Dashboard';
}

/**
 * Aggiorna href del link di uscita in header pagine admin (etichetta sempre «← Dashboard»).
 * @param {HTMLElement|string|null} target
 * @param {boolean} hasManodopera
 * @param {'core-admin'|'core-root'} [scope]
 */
export function wireManagerHomeLink(target, hasManodopera, scope = 'core-admin') {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    el.href = getManagerHomeHref(hasManodopera, scope);
    el.textContent = getManagerHomeLabel(hasManodopera);
}

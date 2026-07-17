/**
 * Tony – profilo campo (operaio / caposquadra): navigazione e comandi consentiti.
 * I manager/amministratori non hanno profilo campo (restituisce null → nessun blocco).
 * @module core/js/tony/field-role-guard
 */

import { resolveTarget } from './engine.js';

/**
 * Pagine dove è lecito recuperare ruoli campo da sessionStorage se il contesto Tony è incompleto
 * (es. atterraggio su Statistiche desktop per errore di nav).
 */
var FIELD_SESSION_ROLE_PATH_RE =
    /field-workspace|segnatura-ore|lavori-caposquadra|validazione-ore|statistiche-lavoratore|statistiche-standalone|\/statistiche|impostazioni-standalone|impostazioni/;

/**
 * @returns {'operaio'|'caposquadra'|null}
 */
export function getTonyFieldProfileFromContext() {
    try {
        var d = window.Tony && window.Tony.context && window.Tony.context.dashboard;
        var ruoli = (d && d.utente_corrente && d.utente_corrente.ruoli) || [];
        if (!Array.isArray(ruoli) || ruoli.length === 0) {
            // Fallback sessionStorage: evita che un manager su Gestione Lavori
            // erediti ruoli operaio/caposquadra da una sessione precedente nello stesso browser.
            var pathLow = '';
            try {
                pathLow = (window.location && window.location.pathname ? String(window.location.pathname) : '').toLowerCase();
            } catch (ePath) { /* ignore */ }
            var allowStored =
                FIELD_SESSION_ROLE_PATH_RE.test(pathLow);
            if (allowStored) {
                try {
                    var ss = window.sessionStorage;
                    var stored = ss && typeof ss.getItem === 'function' ? ss.getItem('gfv_tony_utente_ruoli') : null;
                    if (stored) {
                        var parsed = JSON.parse(stored);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            var storedLow = parsed.map(function (r) {
                                return String(r).toLowerCase().trim();
                            });
                            // Non usare storage se contiene manager (sessione mista / switch account).
                            if (
                                storedLow.indexOf('manager') < 0 &&
                                storedLow.indexOf('amministratore') < 0
                            ) {
                                ruoli = parsed;
                            }
                        }
                    }
                } catch (e) { /* ignore */ }
            }
        }
        if (!Array.isArray(ruoli) || ruoli.length === 0) return null;
        var n = ruoli.map(function (r) {
            return String(r).toLowerCase().trim();
        });
        if (n.indexOf('manager') >= 0 || n.indexOf('amministratore') >= 0) return null;
        if (n.indexOf('caposquadra') >= 0) return 'caposquadra';
        if (n.indexOf('operaio') >= 0) return 'operaio';
    } catch (e) {}
    return null;
}

/** Chiavi canoniche come restituite da resolveTarget() / TONY_PAGE_MAP */
var ALLOW_OPERAIO = {
    'workspace campo': true,
    comunicazioni: true,
    'comunicazioni squadra': true,
    'comunicazioni caposquadra': true,
    'segnatura ore': true,
    'statistiche lavoratore': true,
    'statistiche campo': true,
    'lavoro campo': true,
    impostazioni: true
};

var ALLOW_CAPOSQUADRA = Object.assign({}, ALLOW_OPERAIO, {
    'lavori caposquadra': true,
    'validazione ore': true
});

/**
 * Remap target desktop → target campo (es. «statistiche» manager → slide mobile).
 * @param {string} rawOrResolved
 * @returns {string}
 */
export function remapTonyApriPaginaTargetForFieldProfile(rawOrResolved) {
    var p = getTonyFieldProfileFromContext();
    if (!p) return rawOrResolved;
    var resolved = resolveTarget(rawOrResolved) || String(rawOrResolved || '').toLowerCase().trim();
    var r = String(resolved || '').toLowerCase().trim();
    if (r === 'statistiche') return 'statistiche lavoratore';
    // «lavori» / Gestione Lavori manager → slide Lavoro del workspace mobile.
    if (r === 'lavori' || r === 'gestione lavori') return 'lavoro campo';
    return rawOrResolved;
}

/**
 * @param {string} resolvedTarget - risultato di resolveTarget(rawTarget)
 * @returns {boolean}
 */
export function isTonyApriPaginaAllowedForFieldProfile(resolvedTarget) {
    var p = getTonyFieldProfileFromContext();
    if (!p) return true;
    var k = (resolvedTarget || '').toString().trim();
    if (k === 'statistiche') k = 'statistiche lavoratore';
    var set = p === 'caposquadra' ? ALLOW_CAPOSQUADRA : ALLOW_OPERAIO;
    return !!set[k];
}

/**
 * Verifica target grezzo (prima della navigazione).
 * @param {string} rawTarget
 * @returns {boolean}
 */
export function isRawTonyApriPaginaAllowed(rawTarget) {
    var p = getTonyFieldProfileFromContext();
    if (!p) return true;
    var remapped = remapTonyApriPaginaTargetForFieldProfile(rawTarget);
    var resolved = resolveTarget(remapped);
    if (!resolved && remapped === 'statistiche lavoratore') resolved = 'statistiche lavoratore';
    if (!resolved) return false;
    if (resolved === 'statistiche') resolved = 'statistiche lavoratore';
    return isTonyApriPaginaAllowedForFieldProfile(resolved);
}

var BLOCKED_MODAL_PREFIXES_FIELD = ['preventivo', 'terreno', 'prodotto', 'movimento', 'magazzino', 'clienti'];

/**
 * OPEN_MODAL non ammessi per profilo campo (moduli manager / contabilità / anagrafiche).
 * @param {string} modalId
 * @returns {boolean} true se deve essere bloccato
 */
export function isTonyOpenModalBlockedForFieldProfile(modalId) {
    var p = getTonyFieldProfileFromContext();
    if (!p) return false;
    var key = (modalId || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
    for (var i = 0; i < BLOCKED_MODAL_PREFIXES_FIELD.length; i++) {
        if (key.indexOf(BLOCKED_MODAL_PREFIXES_FIELD[i]) >= 0) return true;
    }
    return false;
}

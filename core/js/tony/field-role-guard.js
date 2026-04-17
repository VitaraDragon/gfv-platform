/**
 * Tony – profilo campo (operaio / caposquadra): navigazione e comandi consentiti.
 * I manager/amministratori non hanno profilo campo (restituisce null → nessun blocco).
 * @module core/js/tony/field-role-guard
 */

import { resolveTarget } from './engine.js';

/**
 * @returns {'operaio'|'caposquadra'|null}
 */
export function getTonyFieldProfileFromContext() {
    try {
        var d = window.Tony && window.Tony.context && window.Tony.context.dashboard;
        var ruoli = (d && d.utente_corrente && d.utente_corrente.ruoli) || [];
        if (!Array.isArray(ruoli) || ruoli.length === 0) {
            try {
                var stored = sessionStorage.getItem('gfv_tony_utente_ruoli');
                if (stored) {
                    var parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) ruoli = parsed;
                }
            } catch (e) { /* ignore */ }
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
    'segnatura ore': true,
    'statistiche lavoratore': true,
    impostazioni: true
};

var ALLOW_CAPOSQUADRA = Object.assign({}, ALLOW_OPERAIO, {
    'lavori caposquadra': true,
    'validazione ore': true
});

/**
 * @param {string} resolvedTarget - risultato di resolveTarget(rawTarget)
 * @returns {boolean}
 */
export function isTonyApriPaginaAllowedForFieldProfile(resolvedTarget) {
    var p = getTonyFieldProfileFromContext();
    if (!p) return true;
    var k = (resolvedTarget || '').toString().trim();
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
    var resolved = resolveTarget(rawTarget);
    if (!resolved) return false;
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

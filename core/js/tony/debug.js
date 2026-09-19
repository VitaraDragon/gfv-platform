/**
 * Log di debug Tony. Spenti di default.
 * In console: `window.__TONY_DEBUG = true` per riattivarli.
 *
 * @see docs-sviluppo/da-fare/snellimento/PROPOSTA_SNELLIMENTO_E_OTTIMIZZAZIONE_CODICE.md §3.1
 * @module core/js/tony/debug
 */

export function tonyDebugEnabled() {
    return typeof window !== 'undefined' && !!window.__TONY_DEBUG;
}

export function tonyDebugLog() {
    if (!tonyDebugEnabled() || typeof console === 'undefined' || !console.log) return;
    console.log.apply(console, arguments);
}

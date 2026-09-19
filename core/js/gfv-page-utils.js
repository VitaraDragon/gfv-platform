/**
 * Utility condivise per pagine standalone.
 * Snellimento §2.2: un solo escapeHtml / showAlert, senza copie inline.
 *
 * @see docs-sviluppo/da-fare/snellimento/PROPOSTA_SNELLIMENTO_E_OTTIMIZZAZIONE_CODICE.md
 * @module core/js/gfv-page-utils
 */

import { showStandaloneAlert } from './standalone-alert.js';

/**
 * Escape caratteri HTML per inserimento sicuro in innerHTML.
 * @param {*} text
 * @returns {string}
 */
export function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Toast utente (stesso layer di gfvShowAlert / standalone-alert).
 * @param {string} message
 * @param {string} [type='info'] success | error | warning | info
 * @param {number} [durationMs]
 */
export function showAlert(message, type = 'info', durationMs) {
    showStandaloneAlert(message, type || 'info', durationMs);
}

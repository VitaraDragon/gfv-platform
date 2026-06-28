/**
 * Toast/alert sopra modali e overlay nelle pagine standalone.
 * @module core/js/standalone-alert
 */

const TOAST_LAYER_ID = 'gfv-standalone-toast-layer';

function ensureToastLayer() {
    let layer = document.getElementById(TOAST_LAYER_ID);
    if (!layer) {
        layer = document.createElement('div');
        layer.id = TOAST_LAYER_ID;
        layer.setAttribute('role', 'status');
        layer.setAttribute('aria-live', 'polite');
        document.body.appendChild(layer);
    }
    return layer;
}

function renderStandaloneAlert(message, type = 'success', durationMs = 5000) {
    const container = ensureToastLayer();
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    container.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, durationMs);
}

/**
 * Mostra alert temporaneo sopra modali e overlay.
 * @param {string} message
 * @param {string} type - success | error | warning | info
 * @param {number} durationMs
 */
export function showStandaloneAlert(message, type = 'success', durationMs = 5000) {
    const globalAlert =
        typeof window !== 'undefined' && typeof window.gfvShowAlert === 'function'
            ? window.gfvShowAlert
            : null;

    // Evita ricorsione: standalone-alert-global.js espone già gfvShowAlert prima degli import ES.
    if (globalAlert && globalAlert !== showStandaloneAlert) {
        globalAlert(message, type, durationMs);
        return;
    }

    renderStandaloneAlert(message, type, durationMs);
}

if (typeof window !== 'undefined' && typeof window.gfvShowAlert !== 'function') {
    window.gfvShowAlert = showStandaloneAlert;
}

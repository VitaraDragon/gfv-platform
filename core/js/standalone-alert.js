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

/**
 * Mostra alert temporaneo sopra modali e overlay.
 * @param {string} message
 * @param {string} type - success | error | warning | info
 * @param {number} durationMs
 */
export function showStandaloneAlert(message, type = 'success', durationMs = 5000) {
    if (typeof window !== 'undefined' && typeof window.gfvShowAlert === 'function') {
        window.gfvShowAlert(message, type, durationMs);
        return;
    }
    const container = ensureToastLayer();
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    container.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, durationMs);
}

if (typeof window !== 'undefined') {
    window.gfvShowAlert = showStandaloneAlert;
}

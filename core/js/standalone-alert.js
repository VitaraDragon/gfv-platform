/**
 * Toast/alert sopra modali e overlay nelle pagine standalone.
 * @module core/js/standalone-alert
 */

const TOAST_LAYER_ID = 'gfv-standalone-toast-layer';
const MAX_TOASTS = 3;
const toastTimers = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

function ensureToastLayer() {
    let layer = document.getElementById(TOAST_LAYER_ID);
    if (!layer) {
        layer = document.createElement('div');
        layer.id = TOAST_LAYER_ID;
        layer.setAttribute('role', 'status');
        layer.setAttribute('aria-live', 'polite');
    }
    document.body.appendChild(layer);
    return layer;
}

function scheduleRemove(alert, durationMs) {
    if (toastTimers && toastTimers.has(alert)) {
        clearTimeout(toastTimers.get(alert));
    }
    const tid = setTimeout(() => {
        if (alert && alert.parentNode) alert.remove();
        if (toastTimers) toastTimers.delete(alert);
    }, durationMs);
    if (toastTimers) toastTimers.set(alert, tid);
}

function renderStandaloneAlert(message, type = 'success', durationMs = 6000) {
    const text = String(message == null ? '' : message);
    const container = ensureToastLayer();
    const existing = container.querySelectorAll('.alert');
    for (let i = 0; i < existing.length; i++) {
        if (existing[i].textContent === text) {
            scheduleRemove(existing[i], durationMs);
            return;
        }
    }
    while (container.children.length >= MAX_TOASTS) {
        container.removeChild(container.firstChild);
    }
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = text;
    container.appendChild(alert);
    scheduleRemove(alert, durationMs);
}

/**
 * Mostra alert temporaneo sopra modali e overlay.
 * @param {string} message
 * @param {string} type - success | error | warning | info
 * @param {number} durationMs
 */
export function showStandaloneAlert(message, type = 'success', durationMs = 6000) {
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

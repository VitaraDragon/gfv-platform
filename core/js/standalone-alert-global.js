/**
 * Toast/alert sopra modali — versione globale per pagine standalone (script classico).
 * Espone window.gfvShowAlert; usato da showAlert inline e da moduli ES.
 */
(function () {
    'use strict';

    var TOAST_LAYER_ID = 'gfv-standalone-toast-layer';
    var MAX_TOASTS = 3;
    var toastTimers = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

    function ensureToastLayer() {
        var layer = document.getElementById(TOAST_LAYER_ID);
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
        var tid = setTimeout(function () {
            if (alert && alert.parentNode) alert.remove();
            if (toastTimers) toastTimers.delete(alert);
        }, durationMs);
        if (toastTimers) toastTimers.set(alert, tid);
    }

    function showStandaloneAlert(message, type, durationMs) {
        type = type || 'success';
        durationMs = durationMs == null ? 6000 : durationMs;
        var text = String(message == null ? '' : message);
        var container = ensureToastLayer();
        var existing = container.querySelectorAll('.alert');
        for (var i = 0; i < existing.length; i++) {
            if (existing[i].textContent === text) {
                scheduleRemove(existing[i], durationMs);
                return;
            }
        }
        while (container.children.length >= MAX_TOASTS) {
            container.removeChild(container.firstChild);
        }
        var alert = document.createElement('div');
        alert.className = 'alert alert-' + type;
        alert.textContent = text;
        container.appendChild(alert);
        scheduleRemove(alert, durationMs);
    }

    window.gfvShowAlert = showStandaloneAlert;
})();

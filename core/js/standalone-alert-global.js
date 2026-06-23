/**
 * Toast/alert sopra modali — versione globale per pagine standalone (script classico).
 * Espone window.gfvShowAlert; usato da showAlert inline e da moduli ES.
 */
(function () {
    'use strict';

    var TOAST_LAYER_ID = 'gfv-standalone-toast-layer';

    function ensureToastLayer() {
        var layer = document.getElementById(TOAST_LAYER_ID);
        if (!layer) {
            layer = document.createElement('div');
            layer.id = TOAST_LAYER_ID;
            layer.setAttribute('role', 'status');
            layer.setAttribute('aria-live', 'polite');
            document.body.appendChild(layer);
        }
        return layer;
    }

    function showStandaloneAlert(message, type, durationMs) {
        type = type || 'success';
        durationMs = durationMs == null ? 5000 : durationMs;
        var container = ensureToastLayer();
        var alert = document.createElement('div');
        alert.className = 'alert alert-' + type;
        alert.textContent = message;
        container.appendChild(alert);
        setTimeout(function () {
            alert.remove();
        }, durationMs);
    }

    window.gfvShowAlert = showStandaloneAlert;
})();

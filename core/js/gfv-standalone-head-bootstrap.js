/**
 * Bootstrap head pagine standalone: alert toast + Tony loader (prima di Firebase/auth).
 * Includere in <head> con path relativo a core/js/.
 */
(function () {
    'use strict';

    var scriptEl = document.currentScript;
    if (!scriptEl || !scriptEl.src) return;

    var coreJsBase = scriptEl.src.replace(/[^/]+$/, '');

    function loadScript(relativePath) {
        if (document.querySelector('script[src*="' + relativePath.split('?')[0] + '"]')) return;
        var s = document.createElement('script');
        s.src = coreJsBase + relativePath;
        document.head.appendChild(s);
    }

    loadScript('standalone-alert-global.js');
    loadScript('gfv-tony-loader.js?v=20260706');
})();

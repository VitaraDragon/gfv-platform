/**
 * Bootstrap leggero pagine standalone: alert toast globali + Tony gated.
 * Caricato dalle pagine al posto dei blocchi inline duplicati.
 */
(function () {
    'use strict';

    var scriptEl = document.currentScript;
    if (!scriptEl || !scriptEl.src) return;

    var coreJsBase = scriptEl.src.replace(/[^/]+$/, '');

    function loadScript(relativePath) {
        var s = document.createElement('script');
        s.src = coreJsBase + relativePath;
        document.head.appendChild(s);
    }

    loadScript('standalone-alert-global.js');
    loadScript('gfv-tony-loader.js?v=20260717e');
})();

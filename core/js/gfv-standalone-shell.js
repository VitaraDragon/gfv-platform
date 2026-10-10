/**
 * Bootstrap leggero pagine standalone: alert toast globali + Tony gated.
 * Caricato dalle pagine al posto dei blocchi inline duplicati.
 */
(function () {
    'use strict';

    if (window.__gfvStandaloneShellRan) return;
    window.__gfvStandaloneShellRan = true;

    var scriptEl = document.currentScript;
    if (!scriptEl || !scriptEl.src) return;

    var coreJsBase = scriptEl.src.replace(/[^/]+$/, '');

    function loadScript(relativePath) {
        var s = document.createElement('script');
        s.src = coreJsBase + relativePath;
        document.head.appendChild(s);
    }

    if (!document.querySelector('script[src*="standalone-alert-global.js"]')) {
        loadScript('standalone-alert-global.js');
    }
    if (window.__gfvTonyLoaderBuild || document.querySelector('script[src*="gfv-tony-loader.js"]')) return;
    loadScript('gfv-tony-loader.js?v=2026-10-09g');
})();

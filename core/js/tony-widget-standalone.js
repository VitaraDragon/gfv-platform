/**
 * Tony Widget – Loader per pagine standalone.
 * Imposta __tonyScriptBase, carica CSS e script di supporto, poi carica main.js.
 * @module core/js/tony-widget-standalone
 */

(function() {
    'use strict';

    /** Bump a ogni fix Tony client — invalida cache moduli ES6 del browser. */
    var TONY_LOADER_BUILD = '2026-06-20l';

    var scriptBase = typeof import.meta !== 'undefined' && import.meta.url
        ? import.meta.url
        : (document.currentScript && document.currentScript.src) || '';
    window.__tonyScriptBase = scriptBase;
    window.__TONY_LOADER_BUILD = TONY_LOADER_BUILD;

    function loadTonyMain() {
        import('./tony/main.js?v=' + encodeURIComponent(TONY_LOADER_BUILD)).catch(function(err) {
            console.error('[Tony] Errore caricamento main.js:', err);
        });
    }

    function appendClassicScript(relativePath, onload, onerror) {
        var s = document.createElement('script');
        s.src = new URL(relativePath, scriptBase).href;
        if (onload) s.onload = onload;
        if (onerror) {
            s.onerror = onerror;
        } else if (onload) {
            s.onerror = onload;
        }
        document.head.appendChild(s);
        return s;
    }

    function loadSchemasFillerInjector(onReady) {
        onReady = typeof onReady === 'function' ? onReady : function() {};

        function loadInjector() {
            appendClassicScript('./tony-form-injector.js', onReady, function() {
                console.warn('[Tony] tony-form-injector.js non caricato: INJECT_FORM_DATA non funzionerà.');
                onReady();
            });
        }

        function loadFillerThenInjector() {
            appendClassicScript('./tony-smart-filler.js', loadInjector, loadInjector);
        }

        appendClassicScript('./tony-form-schemas.js', loadFillerThenInjector, loadFillerThenInjector);
    }

    if (scriptBase) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = new URL('../styles/tony-widget.css', scriptBase).href;
        document.head.appendChild(link);

        // Treasure Map: necessario per injectProdottoForm / injectMovimentoForm / getFormMap
        appendClassicScript('../config/tony-form-mapping.js', function() {
            loadSchemasFillerInjector(loadTonyMain);
        }, function() {
            console.warn('[Tony] tony-form-mapping.js non caricato: INJECT_FORM_DATA magazzino può fallire.');
            loadSchemasFillerInjector(loadTonyMain);
        });
        return;
    }

    loadTonyMain();
})();

/**
 * Tony Widget – Loader per pagine standalone.
 * Imposta __tonyScriptBase, carica CSS e script di supporto, poi carica main.js.
 * @module core/js/tony-widget-standalone
 */

(function() {
    'use strict';

    var scriptBase = typeof import.meta !== 'undefined' && import.meta.url
        ? import.meta.url
        : (document.currentScript && document.currentScript.src) || '';
    window.__tonyScriptBase = scriptBase;

    if (scriptBase) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = new URL('../styles/tony-widget.css', scriptBase).href;
        document.head.appendChild(link);

        function loadSchemasFillerInjector() {
            var scriptSchemas = document.createElement('script');
            scriptSchemas.src = new URL('./tony-form-schemas.js', scriptBase).href;
            scriptSchemas.onload = function() {
                var scriptFiller = document.createElement('script');
                scriptFiller.src = new URL('./tony-smart-filler.js', scriptBase).href;
                document.head.appendChild(scriptFiller);
                var scriptInjector = document.createElement('script');
                scriptInjector.src = new URL('./tony-form-injector.js', scriptBase).href;
                document.head.appendChild(scriptInjector);
            };
            scriptSchemas.onerror = function() {
                var scriptFiller = document.createElement('script');
                scriptFiller.src = new URL('./tony-smart-filler.js', scriptBase).href;
                document.head.appendChild(scriptFiller);
            };
            document.head.appendChild(scriptSchemas);
        }

        // Treasure Map: necessario per injectProdottoForm / injectMovimentoForm / getFormMap (standalone non includeva questo script)
        var scriptMapping = document.createElement('script');
        scriptMapping.src = new URL('../config/tony-form-mapping.js', scriptBase).href;
        scriptMapping.onload = loadSchemasFillerInjector;
        scriptMapping.onerror = function() {
            console.warn('[Tony] tony-form-mapping.js non caricato: INJECT_FORM_DATA magazzino può fallire.');
            loadSchemasFillerInjector();
        };
        document.head.appendChild(scriptMapping);
    }

    import('./tony/main.js').catch(function(err) {
        console.error('[Tony] Errore caricamento main.js:', err);
    });
})();

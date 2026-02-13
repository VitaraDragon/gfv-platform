/**
 * Tony Widget – loader per pagine standalone.
 * Inietta FAB, pannello chat e dialog conferma; inizializza Tony quando Firebase è pronto.
 * Includere con: <link rel="stylesheet" href="PATH_TO_CORE/styles/tony-widget.css">
 *                <script type="module" src="PATH_TO_CORE/js/tony-widget-standalone.js"></script>
 * @module core/js/tony-widget-standalone
 */

(function() {
    'use strict';

    var scriptBase = typeof import.meta !== 'undefined' && import.meta.url
        ? import.meta.url
        : (document.currentScript && document.currentScript.src);
    if (scriptBase) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = new URL('../styles/tony-widget.css', scriptBase).href;
        document.head.appendChild(link);
        
        // Carica prima il catalogo schema form, poi SmartFormFiller.
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
            // Fallback: carica comunque SmartFormFiller con schema locale/fallback.
            var scriptFiller = document.createElement('script');
            scriptFiller.src = new URL('./tony-smart-filler.js', scriptBase).href;
            document.head.appendChild(scriptFiller);
        };
        document.head.appendChild(scriptSchemas);
    }

    var TONY_PAGE_MAP = {
        'dashboard': 'core/dashboard-standalone.html',
        'terreni': 'core/terreni-standalone.html',
        'attivita': 'core/attivita-standalone.html', 'attività': 'core/attivita-standalone.html',
        'lavori': 'core/admin/gestione-lavori-standalone.html', 'gestione lavori': 'core/admin/gestione-lavori-standalone.html',
        'segnatura ore': 'core/segnatura-ore-standalone.html', 'segnare ore': 'core/segnatura-ore-standalone.html',
        'validazione ore': 'core/admin/validazione-ore-standalone.html', 'validare ore': 'core/admin/validazione-ore-standalone.html',
        'lavori caposquadra': 'core/admin/lavori-caposquadra-standalone.html', 'i miei lavori': 'core/admin/lavori-caposquadra-standalone.html',
        'statistiche': 'core/statistiche-standalone.html',
        'statistiche manodopera': 'core/admin/statistiche-manodopera-standalone.html', 'statistiche ore': 'core/admin/statistiche-manodopera-standalone.html',
        'gestisci utenti': 'core/admin/gestisci-utenti-standalone.html', 'utenti': 'core/admin/gestisci-utenti-standalone.html',
        'gestione squadre': 'core/admin/gestione-squadre-standalone.html', 'squadre': 'core/admin/gestione-squadre-standalone.html',
        'gestione operai': 'core/admin/gestione-operai-standalone.html', 'operai': 'core/admin/gestione-operai-standalone.html',
        'compensi operai': 'core/admin/compensi-operai-standalone.html', 'compensi': 'core/admin/compensi-operai-standalone.html',
        'gestione macchine': 'core/admin/gestione-macchine-standalone.html', 'macchine': 'core/admin/gestione-macchine-standalone.html',
        'magazzino': 'modules/magazzino/views/magazzino-home-standalone.html',
        'prodotti': 'modules/magazzino/views/prodotti-standalone.html', 'anagrafica prodotti': 'modules/magazzino/views/prodotti-standalone.html',
        'movimenti': 'modules/magazzino/views/movimenti-standalone.html', 'movimenti magazzino': 'modules/magazzino/views/movimenti-standalone.html',
        'vigneto': 'modules/vigneto/views/vigneto-dashboard-standalone.html',
        'vigneti': 'modules/vigneto/views/vigneti-standalone.html',
        'statistiche vigneto': 'modules/vigneto/views/vigneto-statistiche-standalone.html',
        'vigneto statistiche': 'modules/vigneto/views/vigneto-statistiche-standalone.html',
        'vendemmia': 'modules/vigneto/views/vendemmia-standalone.html',
        'potatura vigneto': 'modules/vigneto/views/potatura-standalone.html',
        'trattamenti vigneto': 'modules/vigneto/views/trattamenti-standalone.html',
        'calcolo materiali': 'modules/vigneto/views/calcolo-materiali-standalone.html?coltura=vigneto',
        'calcolo materiali frutteto': 'modules/vigneto/views/calcolo-materiali-standalone.html?coltura=frutteto',
        'pianificazione impianto': 'modules/vigneto/views/pianifica-impianto-standalone.html?coltura=vigneto',
        'pianifica impianto': 'modules/vigneto/views/pianifica-impianto-standalone.html?coltura=vigneto',
        'impianto': 'modules/vigneto/views/pianifica-impianto-standalone.html?coltura=vigneto',
        'frutteto': 'modules/frutteto/views/frutteto-dashboard-standalone.html',
        'frutteti': 'modules/frutteto/views/frutteti-standalone.html',
        'statistiche frutteto': 'modules/frutteto/views/frutteto-statistiche-standalone.html',
        'frutteto statistiche': 'modules/frutteto/views/frutteto-statistiche-standalone.html',
        'raccolta frutta': 'modules/frutteto/views/raccolta-frutta-standalone.html',
        'potatura frutteto': 'modules/frutteto/views/potatura-standalone.html',
        'trattamenti frutteto': 'modules/frutteto/views/trattamenti-standalone.html',
        'conto terzi': 'modules/conto-terzi/views/conto-terzi-home-standalone.html',
        'contoterzi': 'modules/conto-terzi/views/conto-terzi-home-standalone.html',
        'clienti': 'modules/conto-terzi/views/clienti-standalone.html',
        'preventivi': 'modules/conto-terzi/views/preventivi-standalone.html',
        'tariffe': 'modules/conto-terzi/views/tariffe-standalone.html',
        'terreni clienti': 'modules/conto-terzi/views/terreni-clienti-standalone.html',
        'mappa clienti': 'modules/conto-terzi/views/mappa-clienti-standalone.html',
        'report': 'modules/report/views/report-standalone.html',
        'amministrazione': 'core/admin/amministrazione-standalone.html',
        'guasti': 'core/admin/gestione-guasti-standalone.html',
        'segnalazione guasti': 'core/admin/segnalazione-guasti-standalone.html',
        'abbonamento': 'core/admin/abbonamento-standalone.html',
        'impostazioni': 'core/admin/impostazioni-standalone.html',
        'diario': 'core/attivita-standalone.html',
        'statistiche del vigneto': 'modules/vigneto/views/vigneto-statistiche-standalone.html',
        'statistiche del frutteto': 'modules/frutteto/views/frutteto-statistiche-standalone.html',
        'segnala guasto': 'core/admin/segnalazione-guasti-standalone.html',
        'segnalazione guasto': 'core/admin/segnalazione-guasti-standalone.html'
    };

    var TONY_LABEL_MAP = {
        'dashboard': 'Dashboard', 'terreni': 'Terreni', 'attivita': 'Diario Attività', 'attività': 'Diario Attività',
        'lavori': 'Gestione Lavori', 'gestione lavori': 'Gestione Lavori',
        'segnatura ore': 'Segnatura Ore', 'segnare ore': 'Segnatura Ore',
        'validazione ore': 'Validazione Ore', 'validare ore': 'Validazione Ore',
        'lavori caposquadra': 'I miei Lavori', 'i miei lavori': 'I miei Lavori',
        'statistiche': 'Statistiche', 'statistiche manodopera': 'Statistiche Manodopera', 'statistiche ore': 'Statistiche Manodopera',
        'gestisci utenti': 'Gestisci Utenti', 'utenti': 'Gestisci Utenti',
        'gestione squadre': 'Gestione Squadre', 'squadre': 'Gestione Squadre',
        'gestione operai': 'Gestione Operai', 'operai': 'Gestione Operai',
        'compensi operai': 'Compensi Operai', 'compensi': 'Compensi Operai',
        'gestione macchine': 'Gestione Macchine', 'macchine': 'Gestione Macchine',
        'magazzino': 'Magazzino', 'prodotti': 'Prodotti', 'anagrafica prodotti': 'Prodotti',
        'movimenti': 'Movimenti', 'movimenti magazzino': 'Movimenti',
        'vigneto': 'Vigneto', 'vigneti': 'Vigneti',
        'statistiche vigneto': 'Statistiche Vigneto', 'vigneto statistiche': 'Statistiche Vigneto',
        'vendemmia': 'Vendemmia', 'potatura vigneto': 'Potatura Vigneto', 'trattamenti vigneto': 'Trattamenti Vigneto',
        'calcolo materiali': 'Calcolo Materiali', 'calcolo materiali frutteto': 'Calcolo Materiali Frutteto',
        'pianificazione impianto': 'Pianificazione Impianto', 'pianifica impianto': 'Pianificazione Impianto', 'impianto': 'Pianificazione Impianto',
        'frutteto': 'Frutteto', 'frutteti': 'Frutteti',
        'statistiche frutteto': 'Statistiche Frutteto', 'frutteto statistiche': 'Statistiche Frutteto',
        'raccolta frutta': 'Raccolta Frutta', 'potatura frutteto': 'Potatura Frutteto', 'trattamenti frutteto': 'Trattamenti Frutteto',
        'conto terzi': 'Conto Terzi', 'contoterzi': 'Conto Terzi',
        'clienti': 'Clienti', 'preventivi': 'Preventivi', 'tariffe': 'Tariffe',
        'terreni clienti': 'Terreni Clienti', 'mappa clienti': 'Mappa Clienti',
        'report': 'Report', 'amministrazione': 'Amministrazione', 'guasti': 'Gestione Guasti',
        'segnalazione guasti': 'Segnalazione Guasti', 'abbonamento': 'Abbonamento',
        'impostazioni': 'Impostazioni', 'diario': 'Diario Attività',
        'statistiche del vigneto': 'Statistiche Vigneto', 'statistiche del frutteto': 'Statistiche Frutteto',
        'segnala guasto': 'Segnalazione Guasti', 'segnalazione guasto': 'Segnalazione Guasti'
    };

    function resolveTarget(raw) {
        var t = (raw || '').toString().toLowerCase().trim().replace(/\s+/g, ' ').replace(/[àáâãä]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u');
        if (TONY_PAGE_MAP[t]) return t;
        var aliases = {
            'statistiche del vigneto': 'statistiche vigneto', 'statistiche vigneto': 'statistiche vigneto',
            'statistiche del frutteto': 'statistiche frutteto', 'statistiche frutteto': 'statistiche frutteto',
            'anagrafica vigneti': 'vigneti', 'anagrafica terreni': 'terreni', 'anagrafica clienti': 'clienti',
            'anagrafica prodotti': 'prodotti', 'anagrafica operai': 'operai', 'anagrafica squadre': 'squadre',
            'diario attività': 'attivita', 'diario attivita': 'attivita', 'modulo attività': 'attivita',
            'pagina terreni': 'terreni', 'pagina vigneti': 'vigneti', 'pagina frutteti': 'frutteti',
            'pianificazione impianto vigneto': 'pianificazione impianto', 'impianto vigneto': 'pianificazione impianto',
            'pianificazione impianto frutteto': 'calcolo materiali frutteto', 'impianto frutteto': 'calcolo materiali frutteto',
            'home vigneto': 'vigneto', 'home frutteto': 'frutteto', 'home magazzino': 'magazzino',
            'home conto terzi': 'conto terzi', 'contoterzi': 'conto terzi'
        };
        if (aliases[t]) return aliases[t];
        var normalized = t.replace(/\b(del|della|dei|delle|pagina|modulo|sezione|anagrafica)\b/g, ' ').replace(/\s+/g, ' ').trim();
        if (TONY_PAGE_MAP[normalized]) return normalized;
        for (var k in TONY_PAGE_MAP) {
            if (t.indexOf(k) !== -1 && k.length >= 4) return k;
        }
        return null;
    }

    function getUrlForTarget(target, pathname) {
        var resolved = resolveTarget(target);
        if (!resolved) return null;
        var pathFromRoot = TONY_PAGE_MAP[resolved];
        if (!pathFromRoot) return null;
        return '/' + pathFromRoot.replace(/^\//, '');
    }

    var _lastModalOpenTime = 0;
    var _tonyCommandQueue = [];
    var _isProcessingTonyCommand = false;
    var _isSendingMessage = false; // Anti-flood: blocca invii concorrenti

    function getTonyCommandPriority(command) {
        var type = command && command.type ? String(command.type).toUpperCase() : '';
        if (type === 'OPEN_MODAL') return 10;
        if (type === '_WAIT_MODAL_READY') return 15;
        if (type === 'SET_FIELD') return 20;
        if (type === 'CLICK_BUTTON' || type === 'SAVE_ACTIVITY') return 30;
        return 40;
    }

    function getTonyQueueDelayByType(command) {
        var type = command && command.type ? String(command.type).toUpperCase() : '';
        if (type === 'OPEN_MODAL') return 700;
        if (type === 'SET_FIELD') return 350;
        if (type === 'CLICK_BUTTON' || type === 'SAVE_ACTIVITY') return 300;
        return 120;
    }

    function drainTonyCommandQueue() {
        if (_isProcessingTonyCommand) return;
        if (_tonyCommandQueue.length === 0) return;

        _isProcessingTonyCommand = true;
        var queued = _tonyCommandQueue.shift();
        var command = queued.command;
        var delay = typeof queued.delayMs === 'number' ? queued.delayMs : getTonyQueueDelayByType(command);
        var source = queued.source || 'unknown';

        setTimeout(function() {
            try {
                console.log('[Tony Queue] Eseguo comando da coda:', source, command && command.type ? command.type : 'UNKNOWN');
                processTonyCommand(command);
            } finally {
                _isProcessingTonyCommand = false;
                drainTonyCommandQueue();
            }
        }, Math.max(0, delay));
    }

    function enqueueTonyCommand(command, options) {
        if (!command || !command.type) return;
        options = options || {};

        var entry = {
            command: command,
            source: options.source || 'unknown',
            delayMs: options.delayMs,
            priority: getTonyCommandPriority(command)
        };

        // Evita duplicati consecutivi identici (tipico caso di parse ridondante).
        var lastEntry = _tonyCommandQueue.length ? _tonyCommandQueue[_tonyCommandQueue.length - 1] : null;
        if (lastEntry && JSON.stringify(lastEntry.command) === JSON.stringify(command)) {
            return;
        }

        _tonyCommandQueue.push(entry);
        _tonyCommandQueue.sort(function(a, b) { return a.priority - b.priority; });
        drainTonyCommandQueue();
    }

    function isSmartFillerEligibleField(fieldId) {
        if (!fieldId) return false;
        return fieldId.indexOf('attivita-') === 0 ||
               fieldId.indexOf('ora-') === 0 ||
               fieldId.indexOf('lavoro-') === 0;
    }

    /** Mappa ID alternativi → ID corretti (es. modal-attivita → attivita-modal) */
    var MODAL_ID_FALLBACK = {
        'modal-attivita': 'attivita-modal',
        'attivita': 'attivita-modal',
        'diario': 'attivita-modal',
        'modulo-ore': 'attivita-modal',
        'modulo_ore': 'attivita-modal',
        'ore': 'attivita-modal',
        'modal-ora': 'ora-modal',
        'ora': 'ora-modal',
        'modal-lavoro': 'lavoro-modal',
        'lavoro': 'lavoro-modal'
    };

    /** Mappa nomi campo alternativi → ID reali nel DOM (attivita-standalone.html) */
    var FIELD_ID_FALLBACK = {
        'terreno': 'attivita-terreno',
        'id_terreno': 'attivita-terreno',
        'data': 'attivita-data',
        'inizio': 'attivita-orario-inizio',
        'ora_inizio': 'attivita-orario-inizio',
        'orario_inizio': 'attivita-orario-inizio',
        'fine': 'attivita-orario-fine',
        'ora_fine': 'attivita-orario-fine',
        'orario_fine': 'attivita-orario-fine',
        'lavoro': 'attivita-tipo-lavoro',
        'tipo_lavoro': 'attivita-tipo-lavoro',
        'tipo lavoro': 'attivita-tipo-lavoro',
        'pause': 'attivita-pause',
        'note': 'attivita-note',
        'coltura': 'attivita-coltura'
    };

    /**
     * Helper: Gestisce la deduzione automatica di categoria e sottocategoria quando viene impostato il tipo lavoro.
     * Implementa il flusso bottom-up: tipo lavoro → categoria automatica → preselezione sottocategoria.
     * @param {string} tipoLavoroValue - Valore (ID) del tipo lavoro selezionato
     * @param {string} tipoLavoroText - Testo del tipo lavoro selezionato
     */
    function handleSmartTipoLavoroSet(tipoLavoroValue, tipoLavoroText) {
        console.log('[Tony Smart SET_FIELD] Deduzione automatica per tipo lavoro:', tipoLavoroValue, tipoLavoroText);
        
        // Verifica se SmartFormFiller è disponibile (caricato dinamicamente)
        if (window.SmartFormFiller) {
             const filler = new SmartFormFiller();
             const context = window.Tony ? window.Tony.context : {};
             
             // Il filler si occupa ora di TUTTO: Categoria -> Tipo Lavoro -> Sottocategoria
             // Non serve più chiamare handleSmartSottocategoriaSet manualmente qui
             filler.fillField('attivita-tipo-lavoro-gerarchico', tipoLavoroValue, context).then(() => {
                 console.log('[Tony Smart SET_FIELD] Filler completato per:', tipoLavoroValue);
             });
             return;
        }

        // --- FALLBACK: VECCHIA LOGICA (se SmartFormFiller non è caricato) ---
        
        // Cerca il tipo lavoro nei dati disponibili
        var tipoLavoroObj = null;
        
        // Prova 1: Cerca in window.attivitaState (se disponibile)
        if (window.attivitaState && window.attivitaState.tipiLavoroList) {
            tipoLavoroObj = window.attivitaState.tipiLavoroList.find(function(t) {
                return t.id === tipoLavoroValue || t.nome === tipoLavoroText || 
                       (tipoLavoroText && t.nome && t.nome.toLowerCase() === tipoLavoroText.toLowerCase());
            });
        }
        
        // Prova 2: Cerca nel context di Tony (se disponibile)
        if (!tipoLavoroObj && window.Tony && window.Tony.context && window.Tony.context.attivita) {
            var tipiLavoro = window.Tony.context.attivita.tipi_lavoro || [];
            tipoLavoroObj = tipiLavoro.find(function(t) {
                return t.id === tipoLavoroValue || t.nome === tipoLavoroText ||
                       (tipoLavoroText && t.nome && t.nome.toLowerCase() === tipoLavoroText.toLowerCase());
            });
        }
        
        // MAPPAZIONE INVERSA INTEGRATA: Se non trovato per ID/nome, cerca per testo parziale
        if (!tipoLavoroObj && tipoLavoroText) {
            var searchText = tipoLavoroText.toLowerCase();
            if (window.attivitaState && window.attivitaState.tipiLavoroList) {
                tipoLavoroObj = window.attivitaState.tipiLavoroList.find(function(t) {
                    return t.nome && t.nome.toLowerCase().indexOf(searchText) !== -1;
                });
            }
            if (!tipoLavoroObj && window.Tony && window.Tony.context && window.Tony.context.attivita) {
                var tipiLavoro = window.Tony.context.attivita.tipi_lavoro || [];
                tipoLavoroObj = tipiLavoro.find(function(t) {
                    return t.nome && t.nome.toLowerCase().indexOf(searchText) !== -1;
                });
            }
        }
        
        if (!tipoLavoroObj) {
            console.warn('[Tony Smart SET_FIELD] Tipo lavoro non trovato nei dati disponibili');
            return;
        }
        
        console.log('[Tony Smart SET_FIELD] Tipo lavoro trovato:', tipoLavoroObj);
        
        // Deduzione categoria principale
        var categoriaId = tipoLavoroObj.categoriaId;
        if (categoriaId) {
            var categoriaSelect = document.getElementById('attivita-categoria-principale');
            if (categoriaSelect) {
                // MAPPAZIONE INVERSA: Verifica se la categoria è una sottocategoria (ha parentId)
                // Se è una sottocategoria, trova la categoria principale
                var categoriaFound = false;
                if (window.attivitaState && window.attivitaState.sottocategorieLavoriMap) {
                    var sottocatMap = window.attivitaState.sottocategorieLavoriMap;
                    for (var parentId in sottocatMap) {
                        if (sottocatMap[parentId].some(function(sc) { return sc.id === categoriaId; })) {
                            categoriaId = parentId;
                            categoriaFound = true;
                            console.log('[Tony Smart SET_FIELD] Categoria trovata come sottocategoria, uso parent:', categoriaId);
                            break;
                        }
                    }
                }
                
                // MAPPAZIONE INVERSA: Se categoriaId non corrisponde a nessuna opzione, cerca per nome categoria
                var categoriaOpt = Array.from(categoriaSelect.options).find(function(o) {
                    return o.value === categoriaId;
                });
                
                if (!categoriaOpt && window.Tony && window.Tony.context && window.Tony.context.attivita) {
                    // Cerca la categoria per nome nel context
                    var categorie = window.Tony.context.attivita.categorie_lavoro || [];
                    var categoriaObj = categorie.find(function(c) {
                        return c.id === categoriaId;
                    });
                    
                    if (categoriaObj) {
                        // Cerca l'opzione nel dropdown per nome
                        categoriaOpt = Array.from(categoriaSelect.options).find(function(o) {
                            return o.text && o.text.toLowerCase() === categoriaObj.nome.toLowerCase();
                        });
                        if (categoriaOpt) {
                            categoriaId = categoriaOpt.value;
                            console.log('[Tony Smart SET_FIELD] Mappatura inversa categoria: trovato per nome, uso ID:', categoriaId);
                        }
                    }
                }
                
                // Imposta categoria principale
                var categoriaOpt = Array.from(categoriaSelect.options).find(function(o) {
                    return o.value === categoriaId;
                });
                if (categoriaOpt) {
                    categoriaSelect.value = categoriaId;
                    
                    // TRIGGER DELLA CASCATA: Scatena tutti gli eventi per attivare la logica gerarchica
                    categoriaSelect.dispatchEvent(new Event('input', { bubbles: true }));
                    categoriaSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    if (window.jQuery || window.$) {
                        var $cat = (window.jQuery || window.$)(categoriaSelect);
                        $cat.trigger('change');
                        console.log('[Tony Smart SET_FIELD] Trigger jQuery change per categoria');
                    }
                    console.log('[Tony Smart SET_FIELD] Categoria principale impostata con trigger cascata:', categoriaId);
                    
                    // MONITORAGGIO CASCATA: Attendi che il dropdown tipo-lavoro-gerarchico si popoli
                    var tipoLavoroSelect = document.getElementById('attivita-tipo-lavoro-gerarchico');
                    if (tipoLavoroSelect) {
                        var initialOptionsCount = tipoLavoroSelect.options.length;
                        console.log('[Tony Smart SET_FIELD] Opzioni tipo lavoro iniziali:', initialOptionsCount);
                        
                        // Monitora fino a quando il dropdown non si popola (da 1 opzione a molte)
                        var checkInterval = setInterval(function() {
                            var currentOptionsCount = tipoLavoroSelect.options.length;
                            if (currentOptionsCount > initialOptionsCount) {
                                clearInterval(checkInterval);
                                console.log('[Tony Smart SET_FIELD] Dropdown tipo lavoro popolato! Opzioni:', currentOptionsCount);
                                
                                // Ora procedi con sottocategoria e tipo lavoro
                                setTimeout(function() {
                                    handleSmartSottocategoriaSet(tipoLavoroObj, categoriaId, tipoLavoroValue);
                                }, 200);
                            }
                        }, 100);
                        
                        // Timeout di sicurezza: dopo 2 secondi procedi comunque
                        setTimeout(function() {
                            clearInterval(checkInterval);
                            console.warn('[Tony Smart SET_FIELD] Timeout monitoraggio cascata, procedo comunque');
                            handleSmartSottocategoriaSet(tipoLavoroObj, categoriaId, tipoLavoroValue);
                        }, 2000);
                    } else {
                        // Fallback: se il dropdown non esiste ancora, aspetta e riprova
                        setTimeout(function() {
                            handleSmartSottocategoriaSet(tipoLavoroObj, categoriaId, tipoLavoroValue);
                        }, 400);
                    }
                } else {
                    console.warn('[Tony Smart SET_FIELD] Categoria principale non trovata nel dropdown:', categoriaId);
                }
            }
        } else {
            console.warn('[Tony Smart SET_FIELD] Tipo lavoro non ha categoriaId');
        }
    }
    
    /**
     * Helper: Gestisce la preselezione della sottocategoria basata sul tipo lavoro e terreno.
     * @param {Object} tipoLavoroObj - Oggetto tipo lavoro con categoriaId e sottocategoriaId
     * @param {string} categoriaPrincipaleId - ID categoria principale
     * @param {string} tipoLavoroValue - Valore (ID) del tipo lavoro da ri-impostare dopo la sincronizzazione
     */
    function handleSmartSottocategoriaSet(tipoLavoroObj, categoriaPrincipaleId, tipoLavoroValue) {
        var sottocategoriaSelect = document.getElementById('attivita-sottocategoria');
        if (!sottocategoriaSelect || sottocategoriaSelect.style.display === 'none') {
            console.log('[Tony Smart SET_FIELD] Sottocategoria non visibile o non disponibile');
            return;
        }
        
        var sottocategoriaId = null;
        
        // Priorità 1: Se il tipo lavoro ha già una sottocategoriaId predefinita, usala
        if (tipoLavoroObj.sottocategoriaId) {
            sottocategoriaId = tipoLavoroObj.sottocategoriaId;
            console.log('[Tony Smart SET_FIELD] Usando sottocategoriaId predefinita:', sottocategoriaId);
        } else {
            // Priorità 2: Preselezione basata sul terreno
            var terrenoSelect = document.getElementById('attivita-terreno');
            var terrenoId = terrenoSelect ? terrenoSelect.value : null;
            
            if (terrenoId) {
                // Cerca il terreno nei dati disponibili
                var terreno = null;
                if (window.attivitaState && window.attivitaState.terreniList) {
                    terreno = window.attivitaState.terreniList.find(function(t) { return t.id === terrenoId; });
                } else if (window.Tony && window.Tony.context && window.Tony.context.attivita) {
                    var terreni = window.Tony.context.attivita.terreni || [];
                    terreno = terreni.find(function(t) { return t.id === terrenoId; });
                }
                
                if (terreno && terreno.coltura) {
                    var coltura = terreno.coltura.toLowerCase();
                    var tipoLavoroNome = (tipoLavoroObj.nome || '').toLowerCase();
                    
                    // Preselezione per Vite/Frutteto → "Tra le File"
                    if ((coltura === 'vite' || coltura === 'frutteto')) {
                        var lavoriTraLeFile = ['erpicatura', 'trinciatura', 'fresatura', 'ripasso'];
                        if (lavoriTraLeFile.some(function(l) { return tipoLavoroNome.indexOf(l) !== -1; })) {
                            // Cerca ID "Tra le File" nel dropdown
                            var traLeFileOpt = Array.from(sottocategoriaSelect.options).find(function(o) {
                                return o.text && o.text.toLowerCase().indexOf('tra le file') !== -1;
                            });
                            if (traLeFileOpt) {
                                sottocategoriaId = traLeFileOpt.value;
                                console.log('[Tony Smart SET_FIELD] Preselezione "Tra le File" per terreno Vite/Frutteto');
                            }
                        }
                    }
                    
                    // Preselezione per Seminativo → "Generale"
                    if (!sottocategoriaId && coltura === 'seminativo') {
                        var generaleOpt = Array.from(sottocategoriaSelect.options).find(function(o) {
                            return o.text && o.text.toLowerCase().indexOf('generale') !== -1;
                        });
                        if (generaleOpt) {
                            sottocategoriaId = generaleOpt.value;
                            console.log('[Tony Smart SET_FIELD] Preselezione "Generale" per terreno Seminativo');
                        }
                    }
                }
            }
        }
        
        // Imposta sottocategoria se trovata
        if (sottocategoriaId) {
            var sottocatOpt = Array.from(sottocategoriaSelect.options).find(function(o) {
                return o.value === sottocategoriaId;
            });
            if (sottocatOpt) {
                sottocategoriaSelect.value = sottocategoriaId;
                
                // TRIGGER DELLA CASCATA: Scatena tutti gli eventi per attivare la logica gerarchica
                sottocategoriaSelect.dispatchEvent(new Event('input', { bubbles: true }));
                sottocategoriaSelect.dispatchEvent(new Event('change', { bubbles: true }));
                if (window.jQuery || window.$) {
                    var $subcat = (window.jQuery || window.$)(sottocategoriaSelect);
                    $subcat.trigger('change');
                    console.log('[Tony Smart SET_FIELD] Trigger jQuery change per sottocategoria');
                }
                console.log('[Tony Smart SET_FIELD] Sottocategoria impostata con trigger cascata:', sottocategoriaId);
                
                // Attendi che il dropdown tipo lavoro si aggiorni dopo il cambio sottocategoria
                setTimeout(function() {
                    // Ri-imposta il tipo lavoro selezionato (potrebbe essere stato deselezionato dal ricaricamento dropdown)
                    if (tipoLavoroValue) {
                        var tipoLavoroSelect = document.getElementById('attivita-tipo-lavoro-gerarchico');
                        if (tipoLavoroSelect) {
                            var tipoLavoroOpt = Array.from(tipoLavoroSelect.options).find(function(o) {
                                return o.value === tipoLavoroValue;
                            });
                            if (tipoLavoroOpt) {
                                tipoLavoroSelect.value = tipoLavoroValue;
                                
                                // TRIGGER DELLA CASCATA per tipo lavoro
                                tipoLavoroSelect.dispatchEvent(new Event('input', { bubbles: true }));
                                tipoLavoroSelect.dispatchEvent(new Event('change', { bubbles: true }));
                                if (window.jQuery || window.$) {
                                    var $tl = (window.jQuery || window.$)(tipoLavoroSelect);
                                    $tl.trigger('change');
                                }
                                console.log('[Tony Smart SET_FIELD] Tipo lavoro ri-impostato dopo sincronizzazione:', tipoLavoroValue);
                            } else {
                                console.warn('[Tony Smart SET_FIELD] Tipo lavoro non più disponibile dopo cambio sottocategoria:', tipoLavoroValue);
                            }
                        }
                    }
                }, 300);
            } else {
                console.warn('[Tony Smart SET_FIELD] Sottocategoria non trovata nel dropdown:', sottocategoriaId);
            }
        } else {
            console.log('[Tony Smart SET_FIELD] Nessuna preselezione sottocategoria disponibile');
            // Anche se non c'è sottocategoria, ri-imposta il tipo lavoro dopo un breve delay
            if (tipoLavoroValue) {
                setTimeout(function() {
                    var tipoLavoroSelect = document.getElementById('attivita-tipo-lavoro-gerarchico');
                    if (tipoLavoroSelect) {
                        var tipoLavoroOpt = Array.from(tipoLavoroSelect.options).find(function(o) {
                            return o.value === tipoLavoroValue;
                        });
                        if (tipoLavoroOpt) {
                            tipoLavoroSelect.value = tipoLavoroValue;
                            
                            // TRIGGER DELLA CASCATA per tipo lavoro
                            tipoLavoroSelect.dispatchEvent(new Event('input', { bubbles: true }));
                            tipoLavoroSelect.dispatchEvent(new Event('change', { bubbles: true }));
                            if (window.jQuery || window.$) {
                                var $tl = (window.jQuery || window.$)(tipoLavoroSelect);
                                $tl.trigger('change');
                            }
                            console.log('[Tony Smart SET_FIELD] Tipo lavoro ri-impostato dopo sincronizzazione (senza sottocategoria):', tipoLavoroValue);
                        }
                    }
                }, 300);
            }
        }
    }

    /**
     * Mostra un messaggio nella chat. Usa lookup DOM diretto per evitare ReferenceError
     * quando richiamata da processTonyCommand (scope diverso da appendMessage).
     * @param {string} text - Testo del messaggio
     * @param {string} [type='tony'] - Tipo: 'tony', 'user', 'error', 'typing'
     */
    function showMessageInChat(text, type) {
        type = type || 'tony';
        var el = document.getElementById('tony-messages');
        if (el) {
            var div = document.createElement('div');
            div.className = 'tony-msg ' + type;
            div.textContent = text;
            el.appendChild(div);
            el.scrollTop = el.scrollHeight;
        }
    }

    /**
     * Elabora i comandi operativi inviati da Tony.
     * Gestisce OPEN_MODAL, SET_FIELD (input/textarea e select), CLICK_BUTTON.
     * IMPORTANTE: non chiamare mai sendMessage da qui; dopo OPEN_MODAL/SET_FIELD il widget si ferma e aspetta input utente.
     * @param {Object} data - L'oggetto comando (es. { type: 'OPEN_MODAL', id: '...' })
     */
    function processTonyCommand(data) {
        // console.log('[DEBUG CURSOR] processTonyCommand: Chiamata ricevuta');
        // console.log('[DEBUG CURSOR] processTonyCommand: Dati comando:', JSON.stringify(data, null, 2));
        console.log('[Tony] Esecuzione comando:', data.type, data.field || data.id || '');

        if (!data || !data.type) {
            console.warn('[Tony] Comando malformato o vuoto.');
            return;
        }

        // SICUREZZA: Blocca comandi operativi se modulo non attivo
        if (!isTonyAdvancedActive) {
            console.warn('[Tony] Comando operativo bloccato: modulo Tony Avanzato non attivo.');
            var commandType = data.type || 'operazione';
            showMessageInChat('Questa funzionalità richiede il modulo Tony Avanzato. Attivalo dalla Dashboard per aprire pagine, compilare form e molto altro.', 'tony');
            return;
        }

        var $ = window.$ || window.jQuery;
        console.log('[DEBUG CURSOR] processTonyCommand: jQuery disponibile:', !!($ && $.fn && $.fn.modal));
        try {
            switch (String(data.type).toUpperCase()) {
                case '_WAIT_MODAL_READY':
                    console.log('[Tony] Attesa popolamento modal completata, proseguo con i SET_FIELD');
                    break;
                case 'INJECT_FORM_DATA':
                    if (data.formId === 'attivita-form' && data.formData && window.TonyFormInjector) {
                        console.log('[Tony] INJECT_FORM_DATA: iniezione formData attività');
                        window.TonyFormInjector.injectAttivitaForm(data.formData, window.Tony ? window.Tony.context : {}).then(function(ok) {
                            if (ok) console.log('[Tony] Form data iniettato con successo');
                            else console.warn('[Tony] Iniezione formData fallita');
                        });
                    } else {
                        console.warn('[Tony] INJECT_FORM_DATA: formId/formData non supportati o injector non caricato');
                    }
                    break;
                case 'OPEN_MODAL':
                    console.log('[DEBUG CURSOR] processTonyCommand: Caso OPEN_MODAL');
                    var modalId = data.id || data.target;
                    console.log('[DEBUG CURSOR] processTonyCommand: modalId originale:', modalId);
                    
                    if (modalId) {
                        var resolvedId = modalId;
                        var modalKey = (modalId || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
                        console.log('[DEBUG CURSOR] processTonyCommand: modalKey normalizzato:', modalKey);
                        
                        // Verifica se l'ID esiste nel DOM
                        var originalExists = !!document.getElementById(modalId);
                        console.log('[DEBUG CURSOR] processTonyCommand: Modal con ID originale esiste nel DOM:', originalExists);
                        
                        // Se attivita-modal richiesto ma non esiste (es. siamo sulla dashboard), vai alla pagina Diario
                        if ((modalId === 'attivita-modal' || (modalKey && modalKey.indexOf('attivita') >= 0)) && !document.getElementById('attivita-modal')) {
                            if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] Modal attività non presente in questa pagina, apro Diario Attività');
                                window.Tony.triggerAction('APRI_PAGINA', { target: 'attivita' });
                                break;
                            }
                        }
                        
                        if (!originalExists && (MODAL_ID_FALLBACK[modalId] || MODAL_ID_FALLBACK[modalKey])) {
                            resolvedId = MODAL_ID_FALLBACK[modalId] || MODAL_ID_FALLBACK[modalKey];
                            console.log('[DEBUG CURSOR] processTonyCommand: ID non trovato, fallback da', modalId, '→', resolvedId);
                            console.log('[Tony] OPEN_MODAL: ID non trovato, fallback da', modalId, '→', resolvedId);
                        }
                        
                        console.log('[DEBUG CURSOR] processTonyCommand: resolvedId finale:', resolvedId);
                        console.log('[DEBUG CURSOR] processTonyCommand: Verifica esistenza modal nel DOM...');
                        var modalExists = !!document.getElementById(resolvedId);
                        console.log('[DEBUG CURSOR] processTonyCommand: Modal con resolvedId esiste:', modalExists);
                        
                        // Lista tutti i modal presenti nel DOM per debug
                        var allModals = document.querySelectorAll('.modal, [id*="modal"], [id*="Modal"]');
                        console.log('[DEBUG CURSOR] processTonyCommand: Tutti i modal trovati nel DOM:', Array.from(allModals).map(function(m) { return m.id || '(senza id)'; }));
                        
                        console.log('[Tony] Apertura modal:', resolvedId);
                        var opened = false;
                        if ($ && $.fn && $.fn.modal) {
                            console.log('[DEBUG CURSOR] processTonyCommand: Uso jQuery per aprire modal');
                            var $modal = $('#' + resolvedId);
                            console.log('[DEBUG CURSOR] processTonyCommand: jQuery selector trovato:', $modal.length, 'elementi');
                            if ($modal.length) {
                                $modal.modal('show');
                                opened = true;
                                console.log('[DEBUG CURSOR] processTonyCommand: Modal aperto con jQuery');
                            } else {
                                console.warn('[DEBUG CURSOR] processTonyCommand: jQuery selector non ha trovato elementi');
                            }
                        } else {
                            console.log('[DEBUG CURSOR] processTonyCommand: Uso metodo nativo per aprire modal');
                            var modalEl = document.getElementById(resolvedId);
                            console.log('[DEBUG CURSOR] processTonyCommand: Elemento trovato:', !!modalEl);
                            if (modalEl) {
                                modalEl.classList.add('active');
                                opened = true;
                                console.log('[DEBUG CURSOR] processTonyCommand: Classe "active" aggiunta al modal');
                            } else {
                                console.warn('[DEBUG CURSOR] processTonyCommand: Elemento modal non trovato con getElementById');
                            }
                        }
                        if (opened) {
                            _lastModalOpenTime = Date.now();
                            console.log('[DEBUG CURSOR] processTonyCommand: Modal aperto con successo, _lastModalOpenTime aggiornato');
                            if (resolvedId === 'attivita-modal') {
                                function tryOpenAttivitaModal(retries) {
                                    retries = retries || 0;
                                    if (typeof window.openAttivitaModal === 'function') {
                                        console.log('[Tony] Inizializzo modal attività (popolamento dropdown categoria/tipi)');
                                        window.openAttivitaModal().catch(function(e) {
                                            console.warn('[Tony] openAttivitaModal fallito:', e);
                                        });
                                        enqueueTonyCommand({ type: '_WAIT_MODAL_READY' }, { source: 'post-open-attivita', delayMs: 1200 });
                                    } else if (retries < 5) {
                                        setTimeout(function() { tryOpenAttivitaModal(retries + 1); }, 300);
                                    }
                                }
                                tryOpenAttivitaModal();
                            }
                            setTimeout(function() {
                                console.log('[DEBUG CURSOR] processTonyCommand: Timeout 500ms scaduto, modal dovrebbe essere visibile');
                                console.log('[Tony] Modal pronto, ora i campi dovrebbero essere rilevabili.');
                            }, 500);
                        } else {
                            console.error('[DEBUG CURSOR] processTonyCommand: ERRORE - Modal NON aperto!');
                            console.error('[DEBUG CURSOR] processTonyCommand: ID provati:', modalId, resolvedId);
                            console.error('[DEBUG CURSOR] processTonyCommand: Elementi .modal presenti:', document.querySelectorAll('.modal').length);
                            console.error('[Tony] OPEN_MODAL FALLITO: modal non trovato nel DOM. ID provati:', modalId, resolvedId, 'Elementi .modal presenti:', document.querySelectorAll('.modal').length);
                            
                            // FALLBACK: Se il modal non esiste, prova ad aprire la pagina corrispondente
                            var pageMap = {
                                'attivita-modal': 'attivita',
                                'ora-modal': 'segnatura ore',
                                'lavoro-modal': 'lavori',
                                'terreno-modal': 'terreni',
                                'prodotto-modal': 'prodotti',
                                'movimento-modal': 'movimenti',
                                'cliente-modal': 'clienti',
                                'vigneto-modal': 'vigneti',
                                'frutteto-modal': 'frutteti'
                            };
                            
                            var pageTarget = pageMap[resolvedId] || pageMap[modalId];
                            if (pageTarget && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] Fallback: Modal non trovato, apro pagina:', pageTarget);
                                window.Tony.triggerAction('APRI_PAGINA', { target: pageTarget });
                            } else {
                                console.warn('[Tony] Fallback non disponibile per modal:', resolvedId);
                            }
                        }
                    } else {
                        console.warn('[DEBUG CURSOR] processTonyCommand: OPEN_MODAL senza id o target');
                        console.warn('[Tony] OPEN_MODAL: nessun id o target fornito.');
                    }
                    break;

                case 'SET_FIELD':
                    console.log('[DEBUG CURSOR] processTonyCommand: Caso SET_FIELD');
                    var fieldId = data.field || data.id;
                    var value = data.value;
                    
                    // INTERCETTAZIONE SMART FILLER (Prioritaria)
                    // Se stiamo impostando il tipo lavoro gerarchico, deleghiamo SUBITO al SmartFormFiller
                    // e impediamo l'esecuzione standard che fallirebbe su un dropdown vuoto.
                    if (fieldId === 'attivita-tipo-lavoro-gerarchico' && window.SmartFormFiller) {
                        console.log('[Tony] Intercettato SET_FIELD per SmartFormFiller:', fieldId, value);
                        var filler = new SmartFormFiller();
                        var context = window.Tony ? window.Tony.context : {};
                        
                        // Esegui in background (non blocchiamo il thread UI)
                        filler.fillField(fieldId, value, context).then(function(success) {
                            console.log('[Tony] SmartFormFiller completato:', success);
                            if (success) {
                                // Opzionale: feedback visivo o log
                            } else {
                                console.warn('[Tony] SmartFormFiller non è riuscito a compilare il campo');
                            }
                        });
                        
                        // Interrompiamo qui il case SET_FIELD standard per questo campo
                        return; 
                    }

                    console.log('[DEBUG CURSOR] processTonyCommand: fieldId originale:', fieldId);
                    console.log('[DEBUG CURSOR] processTonyCommand: value:', value);
                    
                    if (fieldId) {
                        // AUTO-OPEN MODAL: Se il modal non è aperto, aprilo prima di impostare il campo
                        var targetModalId = null;
                        if (fieldId.indexOf('attivita-') === 0) targetModalId = 'attivita-modal';
                        else if (fieldId.indexOf('lavoro-') === 0) targetModalId = 'lavoro-modal';
                        else if (fieldId.indexOf('ora-') === 0) targetModalId = 'ora-modal';
                        else if (fieldId.indexOf('terreno-') === 0) targetModalId = 'terreno-modal';
                        
                        if (targetModalId) {
                            var modal = document.getElementById(targetModalId);
                            var isModalActive = modal && (modal.classList.contains('active') || modal.style.display === 'block' || (window.jQuery && window.jQuery(modal).is(':visible')));
                            
                            if (modal && !isModalActive) {
                                console.log('[Tony] Auto-opening modal ' + targetModalId + ' per campo ' + fieldId);
                                enqueueTonyCommand({ type: 'OPEN_MODAL', id: targetModalId }, { source: 'auto-open-modal' });
                                // Ritarda il SET_FIELD in coda per permettere apertura modal e popolamento dropdown dinamici.
                                enqueueTonyCommand(data, { source: 'auto-retry-set-field', delayMs: 1000 });
                                return;
                            }
                        }

                        if (fieldId === 'operaio' || fieldId === 'manodopera') {
                            console.warn('[DEBUG CURSOR] processTonyCommand: Campo operaio/manodopera rilevato, sposto in Note');
                            console.warn('[Tony] Tentativo di impostare operaio in modulo attività. Sposto in Note.');
                            fieldId = 'attivita-note';
                            value = (value ? 'Operaio citato: ' + value : '');
                        }
                        
                        var fieldExists = !!document.getElementById(fieldId);
                        console.log('[DEBUG CURSOR] processTonyCommand: Campo con ID originale esiste:', fieldExists);
                        
                        if (!fieldExists) {
                            var fieldKey = (fieldId || '').toString().toLowerCase().trim().replace(/\s+/g, '_');
                            var resolvedField = FIELD_ID_FALLBACK[fieldId] || FIELD_ID_FALLBACK[fieldKey];
                            console.log('[DEBUG CURSOR] processTonyCommand: fieldKey normalizzato:', fieldKey);
                            console.log('[DEBUG CURSOR] processTonyCommand: resolvedField da fallback:', resolvedField);
                            
                            if (resolvedField) {
                                console.log('[DEBUG CURSOR] processTonyCommand: Fallback applicato:', fieldId, '→', resolvedField);
                                console.log('[Tony] SET_FIELD: fallback da', fieldId, '→', resolvedField);
                                fieldId = resolvedField;
                            } else {
                                console.warn('[DEBUG CURSOR] processTonyCommand: Nessun fallback trovato per fieldId:', fieldId);
                            }
                        }

                        // Delega al Form Engine quando il campo è supportato e presente nel DOM.
                        // In questo modo riduciamo i fallback hardcoded del widget.
                        if (window.SmartFormFiller && isSmartFillerEligibleField(fieldId) && document.getElementById(fieldId)) {
                            console.log('[Tony] SET_FIELD delegato a SmartFormFiller:', fieldId, value);
                            var smartFiller = new SmartFormFiller();
                            var smartContext = window.Tony ? window.Tony.context : {};
                            smartFiller.fillField(fieldId, value, smartContext).then(function(success) {
                                if (!success) {
                                    console.warn('[Tony] SmartFormFiller fallback necessario per campo:', fieldId);
                                }
                            }).catch(function(err) {
                                console.warn('[Tony] Errore SmartFormFiller, fallback standard:', err);
                            });
                            return;
                        }
                        
                        var runSetField = function() {
                            console.log('[DEBUG CURSOR] processTonyCommand: runSetField eseguita');
                            var el = document.getElementById(fieldId);
                            console.log('[DEBUG CURSOR] processTonyCommand: Elemento campo trovato:', !!el);
                            
                            if (el) {
                                console.log('[DEBUG CURSOR] processTonyCommand: Tipo elemento:', el.tagName, 'Tipo input:', el.type || 'N/A');
                                console.log('[Tony] Imposto campo ' + fieldId + ' = ' + value);
                                var val = value != null ? String(value) : '';
                                
                                if (el.tagName === 'SELECT') {
                                    console.log('[DEBUG CURSOR] processTonyCommand: Campo è SELECT, cerco opzione...');
                                    var valLower = val.toLowerCase().trim();
                                    var opt = null;
                                    var targetValue = val; // Default: usa il valore fornito
                                    
                                    // Prima prova: match esatto per value
                                    opt = Array.from(el.options).find(function(o) {
                                        return o.value === val;
                                    });
                                    
                                    // Seconda prova: match esatto per text (MAPPA FORZATA: ID vs Testo)
                                    if (!opt) {
                                        opt = Array.from(el.options).find(function(o) {
                                            return String(o.text).trim().toLowerCase() === valLower;
                                        });
                                        if (opt) {
                                            targetValue = opt.value; // Usa l'ID corrispondente al testo trovato
                                            console.log('[Tony SET_FIELD] Mappatura testo→ID:', val, '→', targetValue);
                                        }
                                    }
                                    
                                    // Terza prova: match parziale nel testo (es. "erpicatura" matcha "Erpicatura Tra le File")
                                    if (!opt && valLower.length >= 3) {
                                        opt = Array.from(el.options).find(function(o) {
                                            var textLower = String(o.text).trim().toLowerCase();
                                            return textLower.indexOf(valLower) !== -1 || valLower.indexOf(textLower) !== -1;
                                        });
                                        if (opt) {
                                            targetValue = opt.value; // Usa l'ID corrispondente
                                        }
                                    }
                                    
                                    // Quarta prova: match per parole chiave (es. "erpicatura" matcha qualsiasi opzione che contiene "erpicatura")
                                    if (!opt && valLower.length >= 3) {
                                        var keywords = valLower.split(/\s+/).filter(function(w) { return w.length >= 3; });
                                        if (keywords.length > 0) {
                                            opt = Array.from(el.options).find(function(o) {
                                                var textLower = String(o.text).trim().toLowerCase();
                                                return keywords.every(function(kw) {
                                                    return textLower.indexOf(kw) !== -1;
                                                });
                                            });
                                            if (opt) {
                                                targetValue = opt.value; // Usa l'ID corrispondente
                                            }
                                        }
                                    }
                                    
                                    if (opt) {
                                        console.log('[DEBUG CURSOR] processTonyCommand: Opzione trovata:', targetValue, opt.text);
                                        
                                        // Imposta il valore
                                        el.value = targetValue;
                                        
                                        // AGGIORNAMENTO VISIVO: Forza il browser a riconoscere il cambio valore
                                        // Alcuni browser richiedono focus/blur per aggiornare la visualizzazione del SELECT
                                        var wasFocused = document.activeElement === el;
                                        if (!wasFocused) {
                                            el.focus();
                                        }
                                        
                                        // TRIGGER DELLA CASCATA: Scatena tutti gli eventi necessari per attivare la logica gerarchica
                                        // Usa Event con cancelable: true per compatibilità con alcuni framework
                                        el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                                        el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                                        
                                        // Trigger anche per eventi specifici di alcuni framework UI
                                        if (window.jQuery || window.$) {
                                            var $el = (window.jQuery || window.$)(el);
                                            $el.trigger('input');
                                            $el.trigger('change');
                                            console.log('[Tony SET_FIELD] Trigger jQuery input+change eseguito');
                                        }
                                        
                                        // AGGIORNAMENTO VISIVO: Se non era già focalizzato, rimuovi il focus per forzare refresh
                                        if (!wasFocused) {
                                            setTimeout(function() {
                                                el.blur();
                                                // VERIFICA: Controlla che il valore sia stato effettivamente impostato
                                                if (el.value === targetValue) {
                                                    console.log('[Tony SET_FIELD] ✓ Valore SELECT verificato:', el.value, '=', opt.text);
                                                } else {
                                                    console.warn('[Tony SET_FIELD] ⚠ Valore SELECT non corrisponde! Atteso:', targetValue, 'Trovato:', el.value);
                                                }
                                            }, 10);
                                        } else {
                                            // VERIFICA immediata se già focalizzato
                                            if (el.value === targetValue) {
                                                console.log('[Tony SET_FIELD] ✓ Valore SELECT verificato:', el.value, '=', opt.text);
                                            } else {
                                                console.warn('[Tony SET_FIELD] ⚠ Valore SELECT non corrisponde! Atteso:', targetValue, 'Trovato:', el.value);
                                            }
                                        }
                                        
                                        console.log('[DEBUG CURSOR] processTonyCommand: Eventi input+change+jQuery dispatchati per SELECT, valore:', targetValue);
                                        
                                        // SMART SET_FIELD: Se è il campo tipo-lavoro-gerarchico, deduci categoria e sottocategoria
                                        if (fieldId === 'attivita-tipo-lavoro-gerarchico') {
                                            setTimeout(function() {
                                                handleSmartTipoLavoroSet(targetValue, opt.text);
                                            }, 150); // Delay per permettere al DOM di aggiornarsi dopo i trigger
                                        }
                                    } else {
                                        console.warn('[DEBUG CURSOR] processTonyCommand: Opzione non trovata, imposto valore diretto:', val);
                                        
                                        // Imposta il valore
                                        el.value = targetValue;
                                        
                                        // AGGIORNAMENTO VISIVO: Forza il browser a riconoscere il cambio valore
                                        var wasFocused = document.activeElement === el;
                                        if (!wasFocused) {
                                            el.focus();
                                        }
                                        
                                        // TRIGGER DELLA CASCATA anche se non trovato
                                        el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                                        el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                                        
                                        if (window.jQuery || window.$) {
                                            var $el = (window.jQuery || window.$)(el);
                                            $el.trigger('input');
                                            $el.trigger('change');
                                        }
                                        
                                        // AGGIORNAMENTO VISIVO: Se non era già focalizzato, rimuovi il focus per forzare refresh
                                        if (!wasFocused) {
                                            setTimeout(function() {
                                                el.blur();
                                                // VERIFICA: Controlla che il valore sia stato effettivamente impostato
                                                if (el.value === targetValue) {
                                                    console.log('[Tony SET_FIELD] ✓ Valore SELECT verificato (valore diretto):', el.value);
                                                } else {
                                                    console.warn('[Tony SET_FIELD] ⚠ Valore SELECT non corrisponde! Atteso:', targetValue, 'Trovato:', el.value);
                                                }
                                            }, 10);
                                        } else {
                                            // VERIFICA immediata se già focalizzato
                                            if (el.value === targetValue) {
                                                console.log('[Tony SET_FIELD] ✓ Valore SELECT verificato (valore diretto):', el.value);
                                            } else {
                                                console.warn('[Tony SET_FIELD] ⚠ Valore SELECT non corrisponde! Atteso:', targetValue, 'Trovato:', el.value);
                                            }
                                        }
                                        
                                        // SMART SET_FIELD: Anche se non trovato, prova comunque la deduzione
                                        if (fieldId === 'attivita-tipo-lavoro-gerarchico') {
                                            setTimeout(function() {
                                                handleSmartTipoLavoroSet(targetValue, val);
                                            }, 150);
                                        }
                                    }
                                } else {
                                    console.log('[DEBUG CURSOR] processTonyCommand: Campo è INPUT/TEXTAREA, imposto valore:', val);
                                    el.value = val;
                                    
                                    // TRIGGER DELLA CASCATA anche per input/textarea
                                    el.dispatchEvent(new Event('input', { bubbles: true }));
                                    el.dispatchEvent(new Event('change', { bubbles: true }));
                                    if (window.jQuery || window.$) {
                                        var $el = (window.jQuery || window.$)(el);
                                        $el.trigger('change');
                                    }
                                    console.log('[DEBUG CURSOR] processTonyCommand: Eventi input+change+jQuery dispatchati per INPUT/TEXTAREA');
                                }
                                console.log('[DEBUG CURSOR] processTonyCommand: SET_FIELD completato con successo');
                            } else {
                                console.error('[DEBUG CURSOR] processTonyCommand: ERRORE - Campo non trovato nel DOM!');
                                console.error('[DEBUG CURSOR] processTonyCommand: fieldId cercato:', fieldId);
                                var allFields = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
                                console.error('[DEBUG CURSOR] processTonyCommand: Campi INPUT/SELECT/TEXTAREA presenti:', allFields.length);
                                console.error('[DEBUG CURSOR] processTonyCommand: ID dei campi presenti:', Array.from(allFields).slice(0, 10).map(function(f) { return f.id || f.name || '(senza id)'; }));
                                console.error('[Tony] SET_FIELD FALLITO: campo ' + fieldId + ' non trovato nel DOM. Campi INPUT/SELECT visibili:', allFields.length);
                            }
                        };
                        
                        var timeSinceModalOpen = Date.now() - _lastModalOpenTime;
                        var delay = (timeSinceModalOpen < 600) ? 500 : 0;
                        console.log('[DEBUG CURSOR] processTonyCommand: Tempo da apertura modal:', timeSinceModalOpen, 'ms');
                        console.log('[DEBUG CURSOR] processTonyCommand: Delay applicato:', delay, 'ms');
                        
                        if (delay > 0) {
                            console.log('[DEBUG CURSOR] processTonyCommand: Esecuzione ritardata di', delay, 'ms');
                            setTimeout(runSetField, delay);
                        } else {
                            console.log('[DEBUG CURSOR] processTonyCommand: Esecuzione immediata');
                            runSetField();
                        }
                    } else {
                        console.warn('[DEBUG CURSOR] processTonyCommand: SET_FIELD senza field o id');
                        console.warn('[Tony] SET_FIELD: nessun field o id fornito.');
                    }
                    break;

                case 'SAVE_ACTIVITY':
                    console.log('[DEBUG CURSOR] processTonyCommand: Caso SAVE_ACTIVITY');
                    var saveValidation = null;
                    if (window.SmartFormFiller) {
                        try {
                            saveValidation = new SmartFormFiller().validateBeforeSave();
                        } catch (validationError) {
                            console.warn('[Tony] Save guard SmartFormFiller non disponibile, fallback al controllo widget:', validationError);
                        }
                    }

                    if (!saveValidation) {
                        saveValidation = checkFormCompleteness();
                    }

                    if (!saveValidation.isComplete) {
                        console.error('[Tony] SAVE_ACTIVITY BLOCCATO: Campi obbligatori mancanti o form non pronto:', saveValidation.missingFields);
                        showMessageInChat('Attenzione: non posso salvare perché ci sono campi obbligatori vuoti o non pronti: ' + saveValidation.missingFields.join(', '), 'error');
                        return;
                    }

                    // Cerca il bottone di salvataggio nel form attivo
                    var saveBtn = document.querySelector('.modal.active button[type="submit"], .modal.active .btn-primary, .modal.show button[type="submit"]');
                    // Fallback specifico per moduli noti
                    if (!saveBtn) saveBtn = document.getElementById('attivita-form');
                    if (!saveBtn) saveBtn = document.getElementById('ora-form');
                    if (!saveBtn) saveBtn = document.getElementById('lavoro-form');
                    
                    if (saveBtn) {
                        console.log('[Tony] SAVE_ACTIVITY: Clicco bottone salvataggio', saveBtn);
                        saveBtn.click();
                        // Chiudi dopo salvataggio (opzionale, spesso il form lo fa da solo)
                    } else {
                        console.error('[Tony] SAVE_ACTIVITY: Bottone salvataggio non trovato');
                        showMessageInChat('Non trovo il tasto per salvare. Prova a cliccarlo tu.', 'tony');
                    }
                    break;

                case 'CLICK_BUTTON':
                    var btnId = data.id || data.target;
                    if (btnId) {
                        // BLOCCO DI SICUREZZA: Verifica campi required prima di salvare
                        var completeness = checkFormCompleteness();
                        
                        if (!completeness.isComplete) {
                            console.error('[Tony] CLICK_BUTTON BLOCCATO: Campi required vuoti:', completeness.missingFields);
                            showMessageInChat('Attenzione: non posso salvare perché ci sono campi obbligatori vuoti: ' + completeness.missingFields.join(', '), 'error');
                            
                            // BLOCCO SPECIFICO: Se tipo-lavoro-gerarchico è vuoto, invia messaggio specifico
                            var tipoLavoroSelect = document.getElementById('attivita-tipo-lavoro-gerarchico');
                            if (tipoLavoroSelect && (!tipoLavoroSelect.value || tipoLavoroSelect.value === '')) {
                                console.error('[Tony] BLOCCO SICUREZZA CRITICO: Tipo lavoro vuoto, salvataggio impedito!');
                                
                                // Invia messaggio di errore interno a Tony (non visibile all'utente)
                                if (window.Tony && typeof window.Tony.ask === 'function') {
                                    setTimeout(function() {
                                        window.Tony.ask('ERRORE_INTERNO_WIDGET: Il campo tipo-lavoro-gerarchico è vuoto. Non posso salvare. Devo prima impostare la categoria principale e attendere che le opzioni del tipo lavoro vengano caricate dinamicamente dal form.').catch(function(err) {
                                            console.error('[Tony] Errore invio messaggio errore:', err);
                                        });
                                    }, 100);
                                }
                            }
                            
                            return; // NON eseguire il click
                        }
                        
                        var btnEl = document.getElementById(btnId);
                        if (btnEl) {
                            if (btnEl.tagName === 'FORM') {
                                var submitBtn = btnEl.querySelector('button[type="submit"], input[type="submit"]');
                                if (submitBtn) {
                                    var requiredEmpty = [];
                                    btnEl.querySelectorAll('[required]').forEach(function(f) {
                                        if (!f.value || (f.value && String(f.value).trim() === '')) {
                                            requiredEmpty.push(f.id || f.name || f.placeholder || '(senza id)');
                                        }
                                    });
                                    if (requiredEmpty.length > 0) {
                                        console.warn('[Tony] CLICK_BUTTON: campi required vuoti prima del submit:', requiredEmpty);
                                        showMessageInChat('Attenzione: non posso salvare perché ci sono campi obbligatori vuoti: ' + requiredEmpty.join(', '), 'error');
                                        return; // NON eseguire il click
                                    }
                                    if (typeof btnEl.validateForm === 'function') {
                                        btnEl.validateForm();
                                    } else if (typeof window.validateForm === 'function') {
                                        window.validateForm(btnEl);
                                    }
                                    console.log('[Tony] Click pulsante submit:', btnId);
                                    submitBtn.click();
                                }
                            } else {
                                console.log('[Tony] Click pulsante:', btnId);
                                btnEl.click();
                            }
                        } else if ($ && $('#' + btnId).length) {
                            var $btn = $('#' + btnId);
                            if ($btn.is('form')) {
                                $btn.find('button[type="submit"], input[type="submit"]').first().click();
                            } else {
                                $btn.click();
                            }
                        } else {
                            console.error('[Tony] CLICK_BUTTON FALLITO: pulsante/form ' + btnId + ' non trovato nel DOM. Form presenti:', document.querySelectorAll('form').length);
                        }
                    } else {
                        console.warn('[Tony] CLICK_BUTTON: nessun id o target fornito.');
                    }
                    break;

                case 'APRI_PAGINA':
                    console.log('[DEBUG CURSOR] processTonyCommand: Caso APRI_PAGINA');
                    // APRI_PAGINA viene gestito tramite onAction callback, ma se arriva qui lo gestiamo comunque
                    var target = (data.target || (data.params && data.params.target) || '').toString().trim();
                    console.log('[DEBUG CURSOR] processTonyCommand: Target per APRI_PAGINA:', target);
                    if (target) {
                        var url = getUrlForTarget(target);
                        if (url) {
                            var resolved = resolveTarget(target);
                            var label = TONY_LABEL_MAP[resolved] || resolved;
                            console.log('[DEBUG CURSOR] processTonyCommand: URL trovato per', target, '→', url);
                            window.showTonyConfirmDialog('Aprire la pagina "' + label + '"?').then(function(ok) {
                                if (ok) {
                                    console.log('[DEBUG CURSOR] processTonyCommand: Navigazione confermata, apro:', url);
                                    window.location.href = url;
                                } else {
                                    console.log('[DEBUG CURSOR] processTonyCommand: Navigazione annullata dall\'utente');
                                }
                            });
                        } else {
                            console.warn('[DEBUG CURSOR] processTonyCommand: URL non trovato per target:', target);
                        }
                    } else {
                        console.warn('[DEBUG CURSOR] processTonyCommand: APRI_PAGINA senza target');
                    }
                    break;

                default:
                    console.warn('[Tony] Tipo comando sconosciuto:', data.type);
            }
        } catch (err) {
            console.error('[Tony] Errore durante l\'esecuzione del comando:', err, data);
        }
    }
    window.processTonyCommand = processTonyCommand;

    // Variabile globale per tracciare se il modulo Tony Avanzato è attivo
    var isTonyAdvancedActive = false;

    function injectWidget() {
        if (document.getElementById('tony-fab')) return;

        var tonyIconUrl = scriptBase ? new URL('../images/tony-icon.png', scriptBase).href : '';

        var fab = document.createElement('button');
        fab.type = 'button';
        fab.className = 'tony-widget-fab';
        fab.id = 'tony-fab';
        fab.title = 'Chiedi a Tony';
        fab.setAttribute('aria-label', 'Apri assistente Tony');
        if (tonyIconUrl) {
            var fabImg = document.createElement('img');
            fabImg.src = tonyIconUrl;
            fabImg.alt = 'Tony';
            fabImg.className = 'tony-fab-icon';
            fabImg.onerror = function() { fab.innerHTML = ''; fab.textContent = '\uD83E\uDD16'; };
            fab.appendChild(fabImg);
        } else {
            fab.textContent = '\uD83E\uDD16';
        }

        var panel = document.createElement('div');
        panel.className = 'tony-widget-panel';
        panel.id = 'tony-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Chat con Tony');
        var headerContent = tonyIconUrl
            ? '<img src="' + tonyIconUrl + '" alt="" class="tony-header-icon" onerror="this.style.display=\'none\'"> Tony – Assistente'
            : '\uD83E\uDD16 Tony – Assistente';
        panel.innerHTML = '<div class="tony-widget-header">' +
            '<h2>' + headerContent + '</h2>' +
            '<button type="button" class="tony-widget-close" id="tony-close" aria-label="Chiudi">×</button>' +
            '</div>' +
            '<div class="tony-widget-messages" id="tony-messages"></div>' +
            '<div class="tony-widget-voice-confirm" id="tony-voice-confirm" style="display:none">' +
            '<span class="tony-voice-confirm-text">Hai detto: «<em id="tony-voice-transcript"></em>»</span>' +
            '<div class="tony-voice-confirm-actions">' +
            '<button type="button" class="tony-voice-confirm-cancel" id="tony-voice-cancel">Annulla</button>' +
            '<button type="button" class="tony-voice-confirm-ok" id="tony-voice-ok">Invia</button>' +
            '</div></div>' +
            '<div class="tony-widget-input-row">' +
            '<button type="button" class="tony-widget-mic" id="tony-mic" title="Clicca per attivare dialogo continuo (mani libere)" aria-label="Microfono">🎤</button>' +
            '<input type="text" class="tony-widget-input" id="tony-input" placeholder="Scrivi un messaggio..." autocomplete="off" maxlength="2000">' +
            '<button type="button" class="tony-widget-send" id="tony-send">Invia</button>' +
            '</div>';

        var overlay = document.createElement('div');
        overlay.className = 'tony-confirm-overlay';
        overlay.id = 'tony-confirm-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-labelledby', 'tony-confirm-title');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.display = 'none';
        overlay.innerHTML = '<div class="tony-confirm-box">' +
            '<h3 class="tony-confirm-title" id="tony-confirm-title">Aprire pagina?</h3>' +
            '<p class="tony-confirm-message" id="tony-confirm-message"></p>' +
            '<div class="tony-confirm-actions">' +
            '<button type="button" class="tony-confirm-btn tony-confirm-cancel" id="tony-confirm-cancel">Annulla</button>' +
            '<button type="button" class="tony-confirm-btn tony-confirm-ok" id="tony-confirm-ok">Apri</button>' +
            '</div></div>';

        document.body.appendChild(fab);
        document.body.appendChild(panel);
        document.body.appendChild(overlay);

        var messagesEl = document.getElementById('tony-messages');
        var inputEl = document.getElementById('tony-input');
        var sendBtn = document.getElementById('tony-send');
        var closeBtn = document.getElementById('tony-close');

        function appendMessage(text, type) {
            type = type || 'tony';
            var div = document.createElement('div');
            div.className = 'tony-msg ' + type;
            div.textContent = text;
            messagesEl.appendChild(div);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function removeTyping() {
            var typing = messagesEl.querySelector('.tony-msg.typing');
            if (typing) typing.remove();
        }

        /**
         * Pulisce il testo per TTS: rimuove emoji, markdown e blocchi JSON.
         * Da applicare al testo completo finale prima di speechSynthesis.speak().
         * @param {string} testo - Testo grezzo da pulire
         * @returns {string} Testo adatto alla sintesi vocale
         */
        function pulisciTestoPerVoce(testo) {
            if (!testo || typeof testo !== 'string') return '';
            var t = testo;
            t = t.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '');
            t = t.replace(/\{[\s\S]*?\}/g, '');
            t = t.replace(/[#*>_~`]/g, '');
            t = t.replace(/\*\*(.*?)\*\*/g, '$1');
            t = t.replace(/\*(.*?)\*/g, '$1');
            t = t.replace(/_(.*?)_/g, '$1');
            t = t.replace(/[""«»]/g, '');
            t = t.replace(/(\w+)-(\w+)/g, '$1 $2');
            t = t.replace(/\b(asterisco|virgolette)\b/gi, '');
            return t.replace(/\s{2,}/g, ' ').trim();
        }

        function nascondiJsonDaStreaming(testo) {
            var t = testo.replace(/\{[\s\S]*?\}/g, '');
            return t.replace(/\{[^}]*$/, '');
        }

        /**
         * Estrae text e command da una stringa che contiene JSON (fallback se Cloud Function non parsa).
         * @param {string} str - Risposta grezza che può contenere {"text":"...","command":{...}}
         * @returns {{ text: string, command: object|null }|null}
         */
        function extractTonyResponseFromString(str) {
            if (!str || typeof str !== 'string') return null;
            var s = str.trim();
            var jsonStart = s.search(/\{\s*["']?text["']?\s*:/);
            if (jsonStart < 0) jsonStart = s.indexOf('{');
            if (jsonStart < 0) return null;
            var jsonStr = s.slice(jsonStart).replace(/\b(text|command)\s*:/g, '"$1":');
            for (var tries = 0; tries < 25 && jsonStr.length > 15; tries++) {
                try {
                    var parsed = JSON.parse(jsonStr);
                    if (parsed && typeof parsed === 'object' && (parsed.text != null || parsed.command != null)) {
                        var text = (parsed.text != null ? String(parsed.text).replace(/\s+[}\]]\s*$/g, '').trim() : '') || '';
                        var cmd = parsed.command && typeof parsed.command === 'object' ? parsed.command : null;
                        return { text: text || 'Ok.', command: cmd };
                    }
                } catch (_) {}
                jsonStr = jsonStr.slice(0, -1).trim();
            }
            return null;
        }

        /**
         * Parser JSON ultra-robusto che estrae qualsiasi JSON da una stringa, anche mescolato con testo discorsivo.
         * Gestisce formati: { "text": "...", "command": {...} }, { "command": {...} }, { "type": "..." }, ecc.
         * @param {string} str - Stringa che può contenere testo + JSON in qualsiasi formato
         * @returns {{ text: string, command: object|null }|null}
         */
        function parseRobustTonyResponse(str) {
            if (!str || typeof str !== 'string') {
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: input non valido (non stringa o vuoto)');
                return null;
            }
            
            console.log('[DEBUG CURSOR] parseRobustTonyResponse: input ricevuto, lunghezza:', str.length);
            console.log('[DEBUG CURSOR] parseRobustTonyResponse: preview:', str.substring(0, 200) + (str.length > 200 ? '...' : ''));
            
            // Cerca il primo JSON object nella stringa usando regex robusta
            // Prima prova con JSON completo
            var jsonMatch = str.match(/\{[\s\S]*\}/);
            
            // Se non trova JSON completo, cerca JSON incompleto (troncato)
            if (!jsonMatch) {
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Nessun JSON completo trovato, cerco JSON troncato...');
                // Cerca pattern che inizia con { e contiene "text" o "command" o "type"
                var incompleteMatch = str.match(/\{[^{}]*["']?(?:text|command|type)["']?\s*:/);
                if (incompleteMatch) {
                    console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato JSON incompleto, provo a completarlo');
                    // Estrai tutto dalla prima { fino alla fine della stringa
                    var startIdx = str.indexOf('{');
                    var incompleteJson = str.substring(startIdx);
                    // Prova a completare il JSON aggiungendo le parentesi mancanti
                    var openBraces = (incompleteJson.match(/\{/g) || []).length;
                    var closeBraces = (incompleteJson.match(/\}/g) || []).length;
                    var missingBraces = openBraces - closeBraces;
                    console.log('[DEBUG CURSOR] parseRobustTonyResponse: Parentesi aperte:', openBraces, 'chiuse:', closeBraces, 'mancanti:', missingBraces);
                    
                    if (missingBraces > 0) {
                        // Aggiungi le parentesi mancanti
                        var completedJson = incompleteJson + Array(missingBraces + 1).join('}');
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: JSON completato:', completedJson.substring(0, 300) + (completedJson.length > 300 ? '...' : ''));
                        jsonMatch = [completedJson];
                        jsonMatch.index = startIdx;
                    } else {
                        // Se le parentesi sono bilanciate ma manca qualcosa, prova comunque
                        jsonMatch = [incompleteJson];
                        jsonMatch.index = startIdx;
                    }
                }
            }
            
            if (!jsonMatch) {
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Nessun JSON trovato nella stringa (né completo né incompleto)');
                return null;
            }
            
            var jsonStr = jsonMatch[0];
            console.log('[DEBUG CURSOR] parseRobustTonyResponse: JSON estratto (primo tentativo):', jsonStr.substring(0, 300) + (jsonStr.length > 300 ? '...' : ''));
            
            // Prova a parsare il JSON completo
            try {
                var parsed = JSON.parse(jsonStr);
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: JSON parsato con successo:', parsed);
                
                if (parsed && typeof parsed === 'object') {
                    // Caso 1: { "text": "...", "command": {...} }
                    if (parsed.command && typeof parsed.command === 'object') {
                        var text = (parsed.text != null ? String(parsed.text).trim() : '') || '';
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+command. Text:', text, 'Command:', parsed.command);
                        return { text: text || 'Ok.', command: parsed.command };
                    }
                    // Caso 1b: { "text": "...", "action": "...", "params": {...} } (formato alternativo)
                    if (parsed.action) {
                        var text = (parsed.text != null ? String(parsed.text).trim() : '') || '';
                        var actionCommand = {
                            type: parsed.action,
                            ...(parsed.params || {})
                        };
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+action. Text:', text, 'Action:', parsed.action, 'Params:', parsed.params);
                        return { text: text || 'Ok.', command: actionCommand };
                    }
                    // Caso 2: { "type": "OPEN_MODAL", ... } (comando standalone)
                    if (parsed.type && (parsed.type === 'OPEN_MODAL' || parsed.type === 'SET_FIELD' || parsed.type === 'CLICK_BUTTON' || parsed.type === 'APRI_PAGINA' || parsed.type === 'SAVE_ACTIVITY')) {
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato comando standalone:', parsed);
                        // Estrai testo prima del JSON se presente
                        var textBefore = str.substring(0, jsonMatch.index).trim();
                        return { text: textBefore || 'Ok.', command: parsed };
                    }
                    // Caso 2b: { "action": "APRI_PAGINA", "params": {...} } (formato alternativo standalone)
                    if (parsed.action && !parsed.text) {
                        var textBefore = str.substring(0, jsonMatch.index).trim();
                        var actionCommand = {
                            type: parsed.action,
                            ...(parsed.params || {})
                        };
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato action standalone:', parsed.action, 'Params:', parsed.params);
                        return { text: textBefore || 'Ok.', command: actionCommand };
                    }
                    // Caso 3: Solo { "text": "..." } senza command
                    if (parsed.text != null) {
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato solo text, nessun command');
                        return { text: String(parsed.text).trim(), command: null };
                    }
                }
            } catch (e) {
                console.warn('[DEBUG CURSOR] parseRobustTonyResponse: Errore parsing JSON completo:', e.message);
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Tentativo con completamento e trimming progressivo...');
                
                // Prima prova a completare il JSON aggiungendo parentesi mancanti
                var openBraces = (jsonStr.match(/\{/g) || []).length;
                var closeBraces = (jsonStr.match(/\}/g) || []).length;
                var missingBraces = openBraces - closeBraces;
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Parentesi nel JSON estratto - aperte:', openBraces, 'chiuse:', closeBraces, 'mancanti:', missingBraces);
                
                if (missingBraces > 0) {
                    var completedJson = jsonStr + '}'.repeat(missingBraces);
                    console.log('[DEBUG CURSOR] parseRobustTonyResponse: Tentativo con JSON completato:', completedJson.substring(0, 300) + (completedJson.length > 300 ? '...' : ''));
                    try {
                        var parsedCompleted = JSON.parse(completedJson);
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: JSON completato parsato con successo:', parsedCompleted);
                        
                        if (parsedCompleted && typeof parsedCompleted === 'object') {
                            if (parsedCompleted.command && typeof parsedCompleted.command === 'object') {
                                var textCompleted = (parsedCompleted.text != null ? String(parsedCompleted.text).trim() : '') || '';
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+command dopo completamento');
                                return { text: textCompleted || 'Ok.', command: parsedCompleted.command };
                            }
                            if (parsedCompleted.action) {
                                var textCompleted = (parsedCompleted.text != null ? String(parsedCompleted.text).trim() : '') || '';
                                var actionCommand = {
                                    type: parsedCompleted.action,
                                    ...(parsedCompleted.params || {})
                                };
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+action dopo completamento');
                                return { text: textCompleted || 'Ok.', command: actionCommand };
                            }
                            if (parsedCompleted.type && (parsedCompleted.type === 'OPEN_MODAL' || parsedCompleted.type === 'SET_FIELD' || parsedCompleted.type === 'CLICK_BUTTON' || parsedCompleted.type === 'APRI_PAGINA' || parsedCompleted.type === 'SAVE_ACTIVITY')) {
                                var textBeforeCompleted = str.substring(0, jsonMatch.index).trim();
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato comando standalone dopo completamento');
                                return { text: textBeforeCompleted || 'Ok.', command: parsedCompleted };
                            }
                        }
                    } catch (e2) {
                        console.warn('[DEBUG CURSOR] parseRobustTonyResponse: Completamento fallito:', e2.message);
                    }
                }
                
                // Se il completamento fallisce, prova trimming progressivo
                var trimmed = jsonStr;
                for (var tries = 0; tries < 50 && trimmed.length > 10; tries++) {
                    trimmed = trimmed.slice(0, -1).trim();
                    // Rimuovi eventuali caratteri finali non validi
                    while (trimmed.length > 0 && !trimmed.endsWith('}')) {
                        trimmed = trimmed.slice(0, -1);
                    }
                    if (trimmed.length === 0) break;
                    
                    try {
                        var parsedTrimmed = JSON.parse(trimmed);
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: JSON parsato dopo trimming (tentativo', tries + 1, '):', parsedTrimmed);
                        
                        if (parsedTrimmed && typeof parsedTrimmed === 'object') {
                            if (parsedTrimmed.command && typeof parsedTrimmed.command === 'object') {
                                var textTrimmed = (parsedTrimmed.text != null ? String(parsedTrimmed.text).trim() : '') || '';
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+command dopo trimming');
                                return { text: textTrimmed || 'Ok.', command: parsedTrimmed.command };
                            }
                            if (parsedTrimmed.action) {
                                var textTrimmed = (parsedTrimmed.text != null ? String(parsedTrimmed.text).trim() : '') || '';
                                var actionCommand = {
                                    type: parsedTrimmed.action,
                                    ...(parsedTrimmed.params || {})
                                };
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+action dopo trimming');
                                return { text: textTrimmed || 'Ok.', command: actionCommand };
                            }
                            if (parsedTrimmed.type && (parsedTrimmed.type === 'OPEN_MODAL' || parsedTrimmed.type === 'SET_FIELD' || parsedTrimmed.type === 'CLICK_BUTTON' || parsedTrimmed.type === 'APRI_PAGINA' || parsedTrimmed.type === 'SAVE_ACTIVITY')) {
                                var textBeforeTrimmed = str.substring(0, jsonMatch.index).trim();
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato comando standalone dopo trimming');
                                return { text: textBeforeTrimmed || 'Ok.', command: parsedTrimmed };
                            }
                        }
                    } catch (_) {
                        // Continua il loop
                    }
                }
                
                console.error('[DEBUG CURSOR] parseRobustTonyResponse: Impossibile parsare JSON dopo', tries, 'tentativi di trimming');
            }
            
            console.log('[DEBUG CURSOR] parseRobustTonyResponse: Nessun formato riconosciuto, ritorno null');
            return null;
        }

        /**
         * Verifica se il form è completo (tutti i campi required hanno valori)
         * @param {Object} formCtx - Context del form (opzionale, se non fornito usa getCurrentFormContext)
         * @returns {{isComplete: boolean, missingFields: Array<string>}}
         */
        function checkFormCompleteness(formCtx) {
            formCtx = formCtx || getCurrentFormContext();
            var missingFields = [];
            var isComplete = true;
            
            if (!formCtx || !formCtx.fields) {
                return { isComplete: false, missingFields: ['Form context non disponibile'] };
            }
            
            formCtx.fields.forEach(function(field) {
                if (field.required) {
                    var isEmpty = !field.value || field.value === '' || field.value === null;
                    if (isEmpty) {
                        isComplete = false;
                        missingFields.push(field.id + ' (' + field.label + ')');
                    }
                }
            });
            
            // Verifica anche direttamente nel DOM per sicurezza extra
            var modal = document.querySelector('.modal.active');
            if (modal) {
                var form = modal.querySelector('form');
                if (form) {
                    form.querySelectorAll('[required]').forEach(function(f) {
                        if (!f.value || String(f.value).trim() === '') {
                            var fieldId = f.id || f.name || '(senza id)';
                            if (missingFields.indexOf(fieldId) === -1) {
                                missingFields.push(fieldId);
                                isComplete = false;
                            }
                        }
                    });
                }
            }
            
            return { isComplete: isComplete, missingFields: missingFields };
        }

        /**
         * Estrae il contesto del form attivo dal DOM (modal aperto).
         * Tony usa questi dati per guidare l'interrogatorio senza mappature statiche.
         * @returns {{ formId: string, modalId: string, fields: Array, submitId?: string }|null}
         */
        /**
         * Genera riepilogo testuale leggibile dello stato del form per Gemini.
         * Es: "- Terreno: Sangiovese ✓" se compilato, "- Terreno: (vuoto)" se mancante.
         */
        function generateFormSummary(fields) {
            if (!fields || !Array.isArray(fields)) return '';
            var lines = [];
            for (var i = 0; i < fields.length; i++) {
                var f = fields[i];
                var lbl = (f.label || f.id || 'Campo').trim();
                var val = f.value || '';
                var displayVal = '';
                if (f.valueLabel && String(f.valueLabel).trim()) {
                    displayVal = String(f.valueLabel).trim();
                } else if (val && val.length > 0 && val.length < 80 && !/^[a-zA-Z0-9_-]{20,}$/.test(val)) {
                    displayVal = val;
                } else if (val && val.length > 0) {
                    displayVal = '(compilato)';
                }
                var line = '- ' + lbl + ': ' + (displayVal || '(vuoto)');
                // attivita-sottocategoria con placeholder "-- Nessuna sottocategoria --" e value vuoto = non ancora scelto
                var isSottocategoriaPlaceholder = (f.id === 'attivita-sottocategoria' && (!val || val === '') && (displayVal === '-- Nessuna sottocategoria --' || !displayVal));
                // attivita-pause con valore 0 = default, non ancora chiesto all'utente
                var isPauseDefault = (f.id === 'attivita-pause' && (val === '0' || val === 0 || String(val).trim() === '0'));
                if (displayVal && displayVal !== '(vuoto)' && displayVal !== '(compilato)' && !isSottocategoriaPlaceholder && !isPauseDefault) {
                    line += ' ✓';
                }
                lines.push(line);
            }
            return lines.join('\n');
        }

        function getCurrentFormContext() {
            // Cerca SOLO dentro .modal.active, non nel body - AGNOSTICO: funziona con qualsiasi modal
            var modal = document.querySelector('.modal.active');
            if (!modal) {
                console.log('[DEBUG CURSOR] getCurrentFormContext: Nessun modal attivo');
                return null;
            }
            
            // Verifica che il modal sia effettivamente visibile
            var modalStyle = window.getComputedStyle(modal);
            if (modalStyle.display === 'none' || modalStyle.visibility === 'hidden') {
                console.log('[DEBUG CURSOR] getCurrentFormContext: Modal trovato ma nascosto');
                return null;
            }
            
            var form = modal.querySelector('form');
            if (!form || !form.id) {
                console.log('[DEBUG CURSOR] getCurrentFormContext: Nessun form trovato nel modal');
                return null;
            }
            
            var fields = [];
            var fieldTags = ['INPUT', 'SELECT', 'TEXTAREA'];
            var elements = form.querySelectorAll(fieldTags.join(','));
            console.log('[DEBUG CURSOR] getCurrentFormContext: Trovati', elements.length, 'elementi nel form del modal attivo');
            
            for (var i = 0; i < elements.length; i++) {
                var el = elements[i];
                if (!el.id) continue;
                if (el.type === 'hidden' || el.disabled) continue;
                
                if (!modal.contains(el)) continue;
                
                var computedStyle = window.getComputedStyle(el);
                var isElementVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
                var parentGroup = el.closest('[id$="-group"]');
                var isParentGroupVisible = true;
                if (parentGroup) {
                    var parentStyle = window.getComputedStyle(parentGroup);
                    isParentGroupVisible = parentStyle.display !== 'none' && parentStyle.visibility !== 'hidden';
                }
                var isVisible = isElementVisible && isParentGroupVisible;
                var rect = el.getBoundingClientRect();
                var hasDimensions = rect.width > 0 || rect.height > 0;
                var isFieldVisible = isVisible && hasDimensions;
                var isRequired = el.required || el.hasAttribute('required');
                
                if (!isFieldVisible && !isRequired) continue;
                
                var label = '';
                var labelEl = modal.querySelector('label[for="' + CSS.escape(el.id) + '"]');
                if (labelEl) label = labelEl.textContent.trim().replace(/\s*\*?\s*$/, '');
                else if (el.placeholder) label = el.placeholder;
                else if (el.getAttribute('aria-label')) label = el.getAttribute('aria-label');
                
                var options = [];
                var valueLabel = '';
                if (el.tagName === 'SELECT') {
                    for (var j = 0; j < el.options.length; j++) {
                        var opt = el.options[j];
                        if (opt.value || opt.text.trim()) {
                            options.push({ value: opt.value || '', text: opt.text.trim() });
                        }
                        if (opt.value === el.value && (opt.text || '').trim()) {
                            valueLabel = opt.text.trim();
                        }
                    }
                }
                
                var isRelevant = !!label || /^(attivita|lavoro|ora|terreno|vigneto|frutteto|cliente|prodotto|movimento|macchina)-/.test(el.id) || el.id === 'lavoro-id';
                if (!isRelevant) continue;
                
                var fieldInfo = {
                    id: el.id,
                    label: label || el.id,
                    type: (el.type || el.tagName).toLowerCase(),
                    required: isRequired,
                    value: el.value || '',
                    valueLabel: valueLabel || undefined,
                    options: options.length > 0 ? options : undefined,
                    isVisible: isFieldVisible
                };
                
                if (fieldInfo.required && (!fieldInfo.value || fieldInfo.value === '')) {
                    console.log('[DEBUG CURSOR] getCurrentFormContext: Campo required vuoto trovato:', el.id, 'label:', label, 'isVisible:', isFieldVisible);
                }
                
                fields.push(fieldInfo);
            }
            
            var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
            var formSummary = generateFormSummary(fields);
            var context = {
                formId: form.id,
                modalId: modal.id || '',
                fields: fields,
                formSummary: formSummary,
                submitId: submitBtn ? submitBtn.id || form.id : form.id
            };
            
            console.log('[DEBUG CURSOR] getCurrentFormContext: Contesto estratto:', {
                formId: context.formId,
                modalId: context.modalId,
                fieldsCount: fields.length,
                formSummaryLength: formSummary.length,
                requiredEmpty: fields.filter(function(f) { return f.required && (!f.value || f.value === ''); }).map(function(f) { return f.id; }),
                hiddenRequired: fields.filter(function(f) { return f.required && f.isVisible === false; }).map(function(f) { return f.id; })
            });
            
            return context;
        }

        fab.addEventListener('click', function() {
            panel.classList.add('is-open');
            if (messagesEl.children.length === 0) {
                var welcomeMessage = isTonyAdvancedActive
                    ? 'Ciao! Sono Tony, il tuo assistente. Posso rispondere a domande, aprire pagine, compilare form e molto altro. Prova ad esempio: "Apri il modulo attività" o "Portami ai terreni".'
                    : 'Ciao! Sono Tony, la guida dell\'app. Posso rispondere a domande su come funziona l\'app e dove trovare le cose.';
                appendMessage(welcomeMessage, 'tony');
            }
            inputEl.focus();
        });

        var pendingVoiceText = null;
        var isAutoMode = false;
        var isWaitingForTonyResponse = false; // Blocca mic fino a risposta (Protocollo Silenzio)
        var startListeningRef = null;
        var stopListeningRef = null;
        var autoModeTimeout = null;
        var AUTO_MODE_SILENCE_MS = 15000; // 15 secondi
        var TONY_SESSION_MAX_AGE_MS = 600000;
        var lastTTSCache = { text: '', audioBase64: '' };

        function saveTonyState() {
            try {
                var chatHistory = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
                var state = {
                    chatHistory: chatHistory,
                    isAutoMode: isAutoMode,
                    lastPath: window.location.pathname,
                    timestamp: Date.now()
                };
                sessionStorage.setItem('tony_session_state', JSON.stringify(state));
            } catch (e) { console.warn('[Tony] saveTonyState:', e); }
        }

        function restoreTonyState() {
            try {
                var saved = sessionStorage.getItem('tony_session_state');
                if (!saved) return;
                var state = JSON.parse(saved);
                if (Date.now() - state.timestamp > TONY_SESSION_MAX_AGE_MS) return;

                if (state.chatHistory && state.chatHistory.length && window.Tony) {
                    window.Tony.chatHistory = state.chatHistory;
                    while (messagesEl.firstChild) messagesEl.removeChild(messagesEl.firstChild);
                    for (var i = 0; i < state.chatHistory.length; i++) {
                        var m = state.chatHistory[i];
                        var txt = (m.parts && m.parts[0]) ? m.parts[0].text : '';
                        if (txt) appendMessage(txt, m.role === 'user' ? 'user' : 'tony');
                    }
                }

                if (state.isAutoMode) {
                    console.log('[Tony] Ripristino sessione vocale attiva...');
                    isAutoMode = true;
                    panel.classList.add('is-auto-mode');
                    if (state.lastPath !== window.location.pathname) {
                        var pageTitle = (document.title || '').replace(/^GFV Platform\s*[-–]\s*/i, '').trim() || 'questa sezione';
                        setTimeout(function() {
                            speakWithTTS('Eccoci qui nella sezione ' + pageTitle + '. Come posso aiutarti ora?', { fromVoice: true });
                        }, 1500);
                    } else {
                        toggleAutoMode(true);
                    }
                }
            } catch (e) { console.warn('[Tony] restoreTonyState:', e); }
        }

        function checkFarewellIntent(text) {
            if (!text || typeof text !== 'string') return false;
            var t = text.toLowerCase().trim();
            var keywords = ['grazie', 'posto così', 'a posto', 'apposto', 'ciao tony', 'basta così', 'basta', 'chiudi', 'termina', 'fine', 'ottimo così', 'perfetto così', 'va bene così', 'va bene cosi', 'ci sentiamo', 'a dopo', 'buon lavoro', 'saluti'];
            var words = t.split(/\s+/).filter(Boolean);
            if (words.length < 8) {
                return keywords.some(function(k) { return t.indexOf(k) !== -1; });
            }
            return false;
        }

        function resetAutoModeTimeout() {
            if (autoModeTimeout) clearTimeout(autoModeTimeout);
            if (!isAutoMode) return;
            autoModeTimeout = setTimeout(function() {
                console.log('[Tony] Inattività raggiunta. Spengo tutto.');
                isAutoMode = false;
                toggleAutoMode(false);
                appendMessage('Sessione vocale scaduta per inattività.', 'tony');
            }, AUTO_MODE_SILENCE_MS);
        }

        function toggleAutoMode(active) {
            isAutoMode = active;
            if (autoModeTimeout) {
                clearTimeout(autoModeTimeout);
                autoModeTimeout = null;
            }
            if (active) {
                panel.classList.add('is-auto-mode');
                if (startListeningRef) startListeningRef();
                resetAutoModeTimeout();
            } else {
                if (stopListeningRef) stopListeningRef();
                panel.classList.remove('is-auto-mode');
                micBtn.classList.remove('tony-mic-active', 'is-auto-mode');
                console.log('[Tony] Modalità continua disattivata.');
            }
        }

        function reopenMicIfAutoMode() {
            if (isAutoMode && startListeningRef) {
                resetAutoModeTimeout();
                setTimeout(function() {
                    if (isAutoMode) startListeningRef();
                }, 300);
            }
        }

        closeBtn.addEventListener('click', function() {
            panel.classList.remove('is-open');
            pendingVoiceText = null;
            toggleAutoMode(false);
            var vc = document.getElementById('tony-voice-confirm');
            if (vc) vc.style.display = 'none';
        });

        function speakWithTTS(testo, opts) {
            opts = opts || {};
            if (!testo) {
                if (opts.isClosingSession) toggleAutoMode(false);
                else reopenMicIfAutoMode();
                return;
            }
            var testoPulito = pulisciTestoPerVoce(testo);
            if (!testoPulito) {
                if (opts.isClosingSession) toggleAutoMode(false);
                else reopenMicIfAutoMode();
                return;
            }
            // Estrai SOLO il testo umano per TTS: se contiene JSON, non pronunciare parentesi o nomi campi
            if (testoPulito.indexOf('{') >= 0 || testoPulito.indexOf('"text"') >= 0 || /^\s*\{/.test(testoPulito)) {
                var extracted = extractTonyResponseFromString(testoPulito);
                if (extracted && extracted.text) {
                    testoPulito = extracted.text;
                } else {
                    var textMatch = testoPulito.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                    if (textMatch) {
                        testoPulito = textMatch[1].replace(/\\"/g, '"');
                    } else {
                        var beforeBrace = testoPulito.split(/\s*\{/)[0];
                        if (beforeBrace && beforeBrace.trim().length > 0) testoPulito = beforeBrace.trim();
                    }
                }
            }
            if (!testoPulito || testoPulito.length < 2) {
                if (opts.isClosingSession) toggleAutoMode(false);
                else reopenMicIfAutoMode();
                return;
            }
            // Rimuovi suffissi " }" o " ]" che Gemini a volte aggiunge al testo
            testoPulito = testoPulito.replace(/\s+[}\]]\s*$/g, '').trim();
            // Evita TTS per frammenti tipo "json }", "Ok. }" (solo testo inutile)
            var testoBrevissimo = testoPulito.trim();
            if (testoBrevissimo.length < 15 && (/^(json\s*[}\]]?|[\s}\]]+)$/i.test(testoBrevissimo) || /^\s*[}\]]\s*$/i.test(testoBrevissimo))) {
                if (opts.isClosingSession) toggleAutoMode(false);
                else reopenMicIfAutoMode();
                return;
            }

            if (window.speechSynthesis) window.speechSynthesis.cancel();
            if (window.currentTonyAudio) {
                window.currentTonyAudio.pause();
                window.currentTonyAudio = null;
            }

            if (testoPulito === lastTTSCache.text && lastTTSCache.audioBase64) {
                var audioSrc = 'data:audio/mp3;base64,' + lastTTSCache.audioBase64;
                window.currentTonyAudio = new Audio(audioSrc);
                window.currentTonyAudio.onplay = function() {
                    if (autoModeTimeout) { clearTimeout(autoModeTimeout); autoModeTimeout = null; }
                };
                window.currentTonyAudio.onerror = function(e) { console.error('[Tony] Audio cached error:', e); };
                window.currentTonyAudio.onended = function() {
                    window.currentTonyAudio = null;
                    if (opts && opts.isClosingSession) {
                        toggleAutoMode(false);
                        console.log('[Tony] Sessione vocale terminata (congedo rilevato).');
                    } else {
                        reopenMicIfAutoMode();
                    }
                };
                window.currentTonyAudio.play().catch(function(e) { console.error('[Tony] Errore play cached:', e); });
                return;
            }

            (async function() {
                var TTS_TIMEOUT_MS = 15000;
                try {
                    console.log('[Tony] speakWithTTS: chiamata getTonyAudio', {
                        testoLen: testoPulito.length,
                        preview: testoPulito.substring(0, 50) + (testoPulito.length > 50 ? '...' : ''),
                        ts: new Date().toISOString()
                    });
                    var firebaseService = await import('../services/firebase-service.js');
                    var app = firebaseService.getAppInstance && firebaseService.getAppInstance();
                    if (!app) throw new Error('Firebase non pronto');
                    var firebaseFunctions = await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js');
                    var functions = firebaseFunctions.getFunctions(app, 'europe-west1');
                    var getTonyAudio = firebaseFunctions.httpsCallable(functions, 'getTonyAudio');
                    var result = await Promise.race([
                        getTonyAudio({ text: testoPulito }),
                        new Promise(function(_, reject) {
                            setTimeout(function() { reject(new Error('getTonyAudio timeout ' + TTS_TIMEOUT_MS + 'ms')); }, TTS_TIMEOUT_MS);
                        })
                    ]);
                    console.log('[Tony] Risposta getTonyAudio', {
                        hasData: !!result.data,
                        hasAudioContent: !!(result.data && result.data.audioContent),
                        audioContentLen: result.data && result.data.audioContent ? result.data.audioContent.length : 0,
                        voice: result.data && result.data.voice || '(non specificata)'
                    });
                    if (result.data && result.data.audioContent) {
                        lastTTSCache.text = testoPulito;
                        lastTTSCache.audioBase64 = result.data.audioContent;
                        var audioSrc = 'data:audio/mp3;base64,' + result.data.audioContent;
                        window.currentTonyAudio = new Audio(audioSrc);
                        window.currentTonyAudio.onplay = function() {
                            if (autoModeTimeout) { clearTimeout(autoModeTimeout); autoModeTimeout = null; }
                            console.log('[Tony] Audio play avviato');
                        };
                        window.currentTonyAudio.onerror = function(e) { console.error('[Tony] Audio element error:', e); };
                        window.currentTonyAudio.onended = function() {
                            window.currentTonyAudio = null;
                            if (opts && opts.isClosingSession) {
                                toggleAutoMode(false);
                                console.log('[Tony] Sessione vocale terminata (congedo rilevato).');
                            } else {
                                reopenMicIfAutoMode();
                            }
                        };
                        window.currentTonyAudio.play().catch(function(e) { console.error('[Tony] Errore play():', e); });
                    } else {
                        console.warn('[Tony] Nessun audioContent nella risposta');
                        if (opts && opts.isClosingSession) toggleAutoMode(false);
                        else reopenMicIfAutoMode();
                    }
                } catch (err) {
                    console.error('[Tony] Errore critico getTonyAudio:', err);
                    if (opts && opts.isClosingSession) toggleAutoMode(false);
                    else reopenMicIfAutoMode();
                }
            })();
        }

        function sendMessage(overrideText, opts) {
            opts = opts || {};
            if (_isSendingMessage) {
                console.warn('[Tony] sendMessage ignorato: richiesta già in corso (anti-flood).');
                return;
            }
            var text = (overrideText != null ? String(overrideText).trim() : (inputEl.value || '').trim());
            if (!text) return;
            if (opts.fromVoice) {
                isWaitingForTonyResponse = true;
                pendingVoiceText = null;
                if (typeof stopListeningRef === 'function') stopListeningRef();
            }
            if (!window.Tony || !window.Tony.isReady()) {
                if (opts.fromVoice) isWaitingForTonyResponse = false;
                appendMessage('Tony non è ancora pronto. Attendi qualche secondo e riprova.', 'error');
                return;
            }
            if (checkFarewellIntent(text)) opts.isClosingSession = true;
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            inputEl.value = '';
            appendMessage(text, 'user');
            saveTonyState();
            
            // Rileva intenti di apertura modulo
            var textLower = text.toLowerCase();
            var openModalIntents = ['apri il modulo', 'apri modulo', 'apri il form', 'apri form', 
                                   'apri attività', 'apri attivita', 'apri il modal', 'apri modal',
                                   'apri diario', 'apri segnatura', 'apri ore'];
            var hasOpenModalIntent = openModalIntents.some(function(intent) { return textLower.includes(intent); });
            
            // WIDGET SYNC: Rileva parole chiave che indicano attività lavorative
            var keywords = ['erpicato', 'trattamento', 'fatto', 'lavorato', 'trinciato', 'fresato', 'potato', 
                           'raccolto', 'semato', 'concimato', 'diserbato', 'erpicatura', 'trinciatura', 
                           'fresatura', 'potatura', 'raccolta', 'semina', 'concimazione', 'diserbo'];
            var hasKeyword = keywords.some(function(kw) { return textLower.includes(kw); });
            
            // Funzione per attendere che il modal sia nel DOM e attivo - SINCRONIZZAZIONE ANTI-NULL
            var waitForModalAndGetContext = function(callback, maxAttempts, attempt) {
                attempt = attempt || 0;
                maxAttempts = maxAttempts || 5; // Max 500ms (5 * 100ms) come richiesto
                
                var modal = document.querySelector('.modal.active');
                if (modal) {
                    // Verifica che il modal abbia un form con campi - AGNOSTICO: qualsiasi form
                    var form = modal.querySelector('form');
                    if (form && form.querySelectorAll('input, select, textarea').length > 0) {
                        console.log('[Tony Widget Sync] Modal trovato e attivo dopo', attempt * 100, 'ms');
                        var formCtx = getCurrentFormContext();
                        callback(formCtx);
                        return;
                    }
                }
                
                if (attempt < maxAttempts) {
                    setTimeout(function() {
                        waitForModalAndGetContext(callback, maxAttempts, attempt + 1);
                    }, 100);
                } else {
                    // SINCRONIZZAZIONE ANTI-NULL: Se il modal non appare, procedi comunque con il contesto globale
                    console.warn('[Tony Widget Sync] Timeout attesa modal (500ms), procedo con contesto corrente o globale');
                    var formCtx = getCurrentFormContext();
                    // Se formCtx è null, passa un oggetto vuoto invece di null per evitare errori
                    callback(formCtx || { fields: [] });
                }
            };
            
            // Funzione per inviare la richiesta con il contesto aggiornato. NON chiamare sendMessage dopo OPEN_MODAL/SET_FIELD.
            var sendRequestWithContext = function(formCtx) {
                if (_isSendingMessage) return;
                _isSendingMessage = true;
                if (formCtx && formCtx.fields) {
                    var requiredEmpty = formCtx.fields.filter(function(f) { 
                        return f.required && (!f.value || f.value === '' || f.value === null); 
                    });
                    console.log('[DEBUG CURSOR] sendMessage: Campi required vuoti prima della richiesta:', requiredEmpty.map(function(f) { return f.id + ' (' + f.label + ')'; }));
                }
                if (window.Tony.setContext) {
                    window.Tony.setContext('form', formCtx || {});
                    console.log('[DEBUG CURSOR] sendMessage: Contesto form passato a Tony:', JSON.stringify(formCtx, null, 2));
                }
                sendBtn.disabled = true;
                inputEl.disabled = true;
                if (document.getElementById('tony-mic')) document.getElementById('tony-mic').disabled = true;
                appendMessage('Sto pensando...', 'typing');

                var useStream = typeof window.Tony.askStream === 'function';
                var streamingMsgEl = null;

                function onComplete(response) {
                try {
                removeTyping();
                if (streamingMsgEl) streamingMsgEl.remove();
                var rawData = response;
                console.log('[DEBUG CURSOR] onComplete: Dati grezzi ricevuti, tipo:', typeof rawData);
                console.log('[DEBUG CURSOR] onComplete: Dati grezzi (primi 500 caratteri):', typeof rawData === 'string' ? rawData.substring(0, 500) : JSON.stringify(rawData).substring(0, 500));
                
                var parsedData = {};
                try {
                    if (typeof rawData === 'object' && rawData !== null) {
                        console.log('[DEBUG CURSOR] onComplete: Dati già oggetto, uso direttamente');
                        parsedData = rawData;
                    } else if (typeof rawData === 'string') {
                        console.log('[DEBUG CURSOR] onComplete: Dati sono stringa, avvio parsing robusto...');
                        
                        // Se modulo attivo, usa parsing ultra-robusto con regex match(/\{[\s\S]*\}/)
                        if (isTonyAdvancedActive) {
                            // Parsing ultra-robusto per modulo attivo
                            var jsonMatch = rawData.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                try {
                                    var jsonStr = jsonMatch[0];
                                    // Corregge chiavi non quotate
                                    jsonStr = jsonStr.replace(/\b(text|command|type|action|params|field|value|id|target)\s*:/g, '"$1":');
                                    
                                    // Fix encoding prima del parse
                                    try {
                                        // Corregge encoding errati comuni (es. \xE8 -> è)
                                        // Usa una funzione di decode sicura
                                        jsonStr = jsonStr.replace(/\\x([0-9A-Fa-f]{2})/g, function(match, hex) {
                                            return String.fromCharCode(parseInt(hex, 16));
                                        });
                                    } catch (e_enc) {
                                        console.warn('[DEBUG CURSOR] Errore fix encoding:', e_enc);
                                    }

                                    var parsed = JSON.parse(jsonStr);
                                    if (parsed && typeof parsed === 'object') {
                                        // Formato { "text": "...", "command": {...} }
                                        if (parsed.command && typeof parsed.command === 'object') {
                                            parsedData = {
                                                text: (parsed.text || '').trim() || 'Ok.',
                                                command: parsed.command
                                            };
                                        }
                                        // Formato { "action": "...", "params": {...} }
                                        else if (parsed.action) {
                                            var commandObj = { type: parsed.action };
                                            if (parsed.params && typeof parsed.params === 'object') {
                                                for (var k in parsed.params) {
                                                    if (parsed.params.hasOwnProperty(k)) {
                                                        commandObj[k] = parsed.params[k];
                                                    }
                                                }
                                            }
                                            parsedData = {
                                                text: (parsed.text || '').trim() || 'Ok.',
                                                command: commandObj
                                            };
                                        }
                                        // Formato { "type": "OPEN_MODAL", ... }
                                        else if (parsed.type) {
                                            var textBefore = rawData.substring(0, jsonMatch.index).trim();
                                            parsedData = {
                                                text: textBefore || 'Ok.',
                                                command: parsed
                                            };
                                        }
                                        // Solo text
                                        else if (parsed.text) {
                                            parsedData = { text: String(parsed.text).trim(), command: null };
                                        }
                                        else {
                                            parsedData = { text: rawData, command: null };
                                        }
                                    } else {
                                        parsedData = { text: rawData, command: null };
                                    }
                                    console.log('[DEBUG CURSOR] onComplete: Parsing ultra-robusto riuscito:', parsedData);
                                } catch (e) {
                                    console.warn('[DEBUG CURSOR] onComplete: Parsing ultra-robusto fallito, provo parser robusto:', e.message);
                                    // Fallback al parser robusto esistente
                                    var extracted = parseRobustTonyResponse(rawData);
                                    if (extracted) {
                                        parsedData = extracted;
                                    } else {
                                        parsedData = { text: rawData, command: null };
                                    }
                                }
                            } else {
                                // Nessun JSON trovato, usa parser robusto come fallback
                                var extracted = parseRobustTonyResponse(rawData);
                                parsedData = extracted || { text: rawData, command: null };
                            }
                        } else {
                            // Modulo non attivo: rimuovi qualsiasi comando JSON
                            var cleanedText = rawData.replace(/\{[\s\S]*?\}/g, '').trim();
                            parsedData = { text: cleanedText || rawData, command: null };
                            console.log('[DEBUG CURSOR] onComplete: Modulo non attivo, comandi rimossi');
                        }
                    } else {
                        console.warn('[DEBUG CURSOR] onComplete: Tipo dati sconosciuto:', typeof rawData);
                        parsedData = { text: 'Nessuna risposta.' };
                    }
                } catch (e) {
                    console.error('[DEBUG CURSOR] onComplete: ERRORE CRITICO durante parsing:', e);
                    console.error('[DEBUG CURSOR] onComplete: Stack:', e.stack);
                    parsedData = { text: typeof rawData === 'string' ? rawData : 'Nessuna risposta.' };
                }
                
                console.log('[DEBUG CURSOR] onComplete: parsedData finale:', parsedData);
                
                // Verifica e esegui comando (solo se modulo attivo)
                // Gestisci sia command che action (formato alternativo)
                var commandToExecute = parsedData.command;
                if (!commandToExecute && parsedData.action) {
                    // Converti action in command per compatibilità
                    commandToExecute = {
                        type: parsedData.action,
                        ...(parsedData.params || {})
                    };
                    console.log('[DEBUG CURSOR] onComplete: Convertito action in command:', commandToExecute);
                }
                
                if (commandToExecute && typeof commandToExecute === 'object') {
                    console.log('[DEBUG CURSOR] onComplete: Trovato comando valido:', commandToExecute);
                    
                    // SICUREZZA: Blocca comandi se modulo non attivo
                    if (!isTonyAdvancedActive) {
                        console.warn('[Tony] Comando bloccato: modulo Tony Avanzato non attivo');
                        appendMessage('Questa funzionalità richiede il modulo Tony Avanzato. Attivalo dalla Dashboard per automatizzare operazioni.', 'tony');
                        // Rimuovi comando dal parsedData per evitare esecuzione
                        parsedData.command = null;
                    } else {
                        // Gestisci APRI_PAGINA tramite onAction callback (come da service)
                        if (commandToExecute.type === 'APRI_PAGINA' || commandToExecute.type === 'apri_modulo') {
                            console.log('[DEBUG CURSOR] onComplete: Gestione APRI_PAGINA tramite onAction');
                            if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                // Estrai target da params se presente, altrimenti direttamente dal comando
                                var target = (commandToExecute.params && commandToExecute.params.target) || 
                                            commandToExecute.target || 
                                            commandToExecute.modulo || 
                                            '';
                                console.log('[DEBUG CURSOR] onComplete: Target estratto:', target, 'da commandToExecute:', commandToExecute);
                                if (target) {
                                    window.Tony.triggerAction('APRI_PAGINA', { target: target });
                                } else {
                                    console.warn('[DEBUG CURSOR] onComplete: Target non trovato nel comando APRI_PAGINA');
                                }
                            } else {
                                console.warn('[DEBUG CURSOR] onComplete: Tony.triggerAction non disponibile, uso processTonyCommand');
                                if (typeof processTonyCommand === 'function') {
                                    processTonyCommand(commandToExecute);
                                }
                            }
                        } else {
                            console.log('[Tony] ESEGUO COMANDO:', commandToExecute);
                            
                            // Verifica che processTonyCommand esista
                            if (typeof window.processTonyCommand === 'function') {
                                console.log('[DEBUG CURSOR] onComplete: Chiamata window.processTonyCommand');
                                try {
                                    enqueueTonyCommand(commandToExecute, { source: 'response-direct' });
                                    console.log('[DEBUG CURSOR] onComplete: window.processTonyCommand eseguita con successo');
                                } catch (e) {
                                    console.error('[DEBUG CURSOR] onComplete: ERRORE durante esecuzione window.processTonyCommand:', e);
                                }
                            } else if (typeof processTonyCommand === 'function') {
                                console.log('[DEBUG CURSOR] onComplete: Chiamata processTonyCommand (scope locale)');
                                try {
                                    enqueueTonyCommand(commandToExecute, { source: 'response-local' });
                                    console.log('[DEBUG CURSOR] onComplete: processTonyCommand eseguita con successo');
                                } catch (e) {
                                    console.error('[DEBUG CURSOR] onComplete: ERRORE durante esecuzione processTonyCommand:', e);
                                }
                            } else {
                                console.error('[DEBUG CURSOR] onComplete: ERRORE CRITICO - processTonyCommand non trovato!');
                                console.error('[DEBUG CURSOR] onComplete: window.processTonyCommand:', typeof window.processTonyCommand);
                                console.error('[DEBUG CURSOR] onComplete: processTonyCommand (locale):', typeof processTonyCommand);
                            }
                        }
                        
                        // DOPO aver eseguito SET_FIELD, aggiorna il contesto del form per la prossima richiesta
                        if (commandToExecute && commandToExecute.type === 'SET_FIELD') {
                            setTimeout(function() {
                                var updatedCtx = getCurrentFormContext();
                                if (updatedCtx && window.Tony && window.Tony.setContext) {
                                    console.log('[DEBUG CURSOR] onComplete: Aggiornamento contesto form dopo SET_FIELD');
                                    window.Tony.setContext('form', updatedCtx);
                                }
                            }, 300);
                        }
                    }
                    
                    if (opts.fromVoice && isAutoMode) {
                        resetAutoModeTimeout();
                    }
                } else {
                    console.log('[DEBUG CURSOR] onComplete: Nessun comando trovato in parsedData.command');
                    console.log('[DEBUG CURSOR] onComplete: parsedData.command:', parsedData.command);
                    console.log('[DEBUG CURSOR] onComplete: Tipo parsedData.command:', typeof parsedData.command);
                }
                
                var finalSpeech = parsedData.text || (typeof rawData === 'string' ? rawData : 'Ok');
                finalSpeech = (finalSpeech || 'Ok').trim();
                function doDisplay(txt) {
                    console.log('[DEBUG CURSOR] onComplete: Testo finale per display/TTS:', (txt || '').substring(0, 100));
                    appendMessage(txt || finalSpeech, 'tony');
                    speakWithTTS(txt || finalSpeech, opts);
                }
                var formCtxForInject = typeof getCurrentFormContext === 'function' ? getCurrentFormContext() : null;
                var shouldTryExtract = formCtxForInject && (formCtxForInject.formId === 'attivita-form' || formCtxForInject.modalId === 'attivita-modal') && !parsedData.command && finalSpeech.indexOf('```json') >= 0 && window.TonyFormInjector && window.TonyFormInjector.extractAndInjectFromResponse;
                if (shouldTryExtract) {
                    window.TonyFormInjector.extractAndInjectFromResponse(finalSpeech, window.Tony ? window.Tony.context : {}).then(function(res) {
                        doDisplay(res.injected ? res.cleanedText : finalSpeech);
                    });
                } else {
                    doDisplay(finalSpeech);
                }
                saveTonyState();
                } catch (e) {
                    console.error('[Tony] onComplete: errore non gestito', e);
                    _isSendingMessage = false;
                    removeTyping();
                    if (streamingMsgEl) streamingMsgEl.remove();
                    appendMessage('Errore durante la risposta di Tony. Riprova.', 'error');
                }
            }

            function onError(err) {
                _isSendingMessage = false;
                removeTyping();
                if (streamingMsgEl) streamingMsgEl.remove();
                appendMessage('Errore: ' + (err && err.message ? err.message : 'Riprova più tardi.'), 'error');
                reopenMicIfAutoMode();
            }

            function onFinally() {
                _isSendingMessage = false;
                isWaitingForTonyResponse = false;
                sendBtn.disabled = false;
                inputEl.disabled = false;
                var micBtn = document.getElementById('tony-mic');
                if (micBtn) micBtn.disabled = false;
                inputEl.focus();
            }

                if (useStream) {
                    var streamingAccum = '';
                    window.Tony.askStream(text, {
                        onChunk: function(chunk) {
                            streamingAccum += chunk;
                            var daMostrare = nascondiJsonDaStreaming(streamingAccum);
                            if (!streamingMsgEl) {
                                removeTyping();
                                streamingMsgEl = document.createElement('div');
                                streamingMsgEl.className = 'tony-msg tony streaming';
                                messagesEl.appendChild(streamingMsgEl);
                                messagesEl.scrollTop = messagesEl.scrollHeight;
                            }
                            streamingMsgEl.textContent = daMostrare;
                            messagesEl.scrollTop = messagesEl.scrollHeight;
                        }
                    }).then(onComplete).catch(onError).finally(onFinally);
                } else {
                    window.Tony.ask(text).then(onComplete).catch(onError).finally(onFinally);
                }
            };
            
            // FIX CODA ESECUZIONE: Assicura che sendRequestWithContext venga sempre chiamata
            // Se rilevato intento di apertura modulo, attendi che il modal sia nel DOM
            if (hasOpenModalIntent) {
                console.log('[Tony Widget Sync] Intent apertura modulo rilevato, attendo che modal sia nel DOM (max 500ms)');
                waitForModalAndGetContext(function(formCtx) {
                    console.log('[Tony Widget Sync] Contesto estratto dopo attesa modal:', formCtx ? JSON.stringify(formCtx, null, 2) : '{}');
                    // FIX CODA ESECUZIONE: Garantisce che formCtx non sia null
                    sendRequestWithContext(formCtx || { fields: [] });
                });
            } else if (hasKeyword) {
                // Se rilevata parola chiave, usa polling fino a 500ms per attendere apertura modal
                console.log('[Tony Widget Sync] Parola chiave rilevata, uso polling per attendere modal (max 500ms)');
                waitForModalAndGetContext(function(formCtx) {
                    console.log('[Tony Widget Sync] Contesto estratto dopo polling:', formCtx ? JSON.stringify(formCtx, null, 2) : '{}');
                    // FIX CODA ESECUZIONE: Garantisce che formCtx non sia null
                    sendRequestWithContext(formCtx || { fields: [] });
                });
            } else {
                // Nessuna keyword: usa contesto immediato
                var formCtx = getCurrentFormContext();
                // FIX CODA ESECUZIONE: Garantisce che formCtx non sia null
                sendRequestWithContext(formCtx || { fields: [] });
            }
        }

        sendBtn.addEventListener('click', function() { sendMessage(); });
        inputEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        var voiceConfirmEl = document.getElementById('tony-voice-confirm');
        var voiceTranscriptEl = document.getElementById('tony-voice-transcript');
        var voiceCancelBtn = document.getElementById('tony-voice-cancel');
        var voiceOkBtn = document.getElementById('tony-voice-ok');
        var micBtn = document.getElementById('tony-mic');

        if (SpeechRecognition && micBtn && voiceConfirmEl) {
            var recognition = new SpeechRecognition();
            window.recognition = recognition; // Esposto per debug
            recognition.continuous = false; // Resta false, onspeechend + delay gestiscono la pausa
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;
            recognition.lang = 'it-IT';

            recognition.onsoundstart = function() {
                if (isAutoMode) resetAutoModeTimeout();
            };
            recognition.onresult = function(e) {
                if (window.currentTonyAudio && !window.currentTonyAudio.paused) return;
                if (isAutoMode) resetAutoModeTimeout();
                var transcript = '';
                for (var i = e.resultIndex; i < e.results.length; i++) {
                    transcript += e.results[i][0].transcript;
                }
                var txt = transcript.trim();
                if (txt) {
                    voiceTranscriptEl.textContent = txt;
                    var lastResult = e.results.length > 0 ? e.results[e.results.length - 1] : null;
                    if (lastResult && lastResult.isFinal) {
                        pendingVoiceText = txt;
                        console.log('[Tony] Ho sentito (finale):', pendingVoiceText);
                    }
                    if (!isAutoMode) {
                        voiceConfirmEl.style.display = 'flex';
                    }
                }
            };
            recognition.onerror = function(e) {
                if (e.error !== 'aborted' && e.error !== 'no-speech') {
                    appendMessage('Microfono: ' + (e.error === 'not-allowed' ? 'permesso negato' : e.error), 'error');
                }
            };

            function startListening() {
                if (!window.Tony || !window.Tony.isReady()) return;
                pendingVoiceText = null;
                voiceConfirmEl.style.display = 'none';
                try {
                    recognition.start();
                    micBtn.classList.add('tony-mic-active');
                    if (isAutoMode) {
                        panel.classList.add('is-auto-mode');
                        micBtn.classList.add('is-auto-mode');
                    }
                } catch (err) { /* già in esecuzione */ }
            }
            function stopListening() {
                try { recognition.stop(); } catch (err) {}
                micBtn.classList.remove('tony-mic-active', 'is-auto-mode');
                if (!isAutoMode) panel.classList.remove('is-auto-mode');
            }

            startListeningRef = startListening;
            stopListeningRef = stopListening;

            recognition.onspeechend = function() {
                console.log('[Tony] Fine rilevamento voce, attendo processamento...');
                setTimeout(function() {
                    stopListening();
                    var textToSend = pendingVoiceText ? String(pendingVoiceText).trim() : '';
                    pendingVoiceText = null;
                    if (isAutoMode && textToSend) {
                        console.log('[Tony] Invio testo vocale:', textToSend);
                        resetAutoModeTimeout();
                        sendMessage(textToSend, { fromVoice: true });
                    } else if (isAutoMode && !textToSend) {
                        console.warn('[Tony] Speechend attivato ma pendingVoiceText è vuoto.');
                    }
                }, 1000);
            };
            recognition.onspeechstart = function() {
                if (window.currentTonyAudio) {
                    window.currentTonyAudio.pause();
                    window.currentTonyAudio.currentTime = 0;
                    window.currentTonyAudio = null;
                }
            };

            recognition.onend = function() {
                if (window.currentTonyAudio && !window.currentTonyAudio.paused) {
                    console.log('[Tony] Audio in corso, microfono resta spento.');
                    return;
                }
                if (isWaitingForTonyResponse) {
                    console.log('[Tony] In attesa risposta Tony, microfono non riaccendo.');
                    return;
                }
                if (isAutoMode && autoModeTimeout) {
                    console.log('[Tony] Fine sessione naturale, riaccendo tra 1 secondo...');
                    setTimeout(function() {
                        if (isAutoMode && autoModeTimeout && !isWaitingForTonyResponse && (!window.currentTonyAudio || window.currentTonyAudio.paused)) {
                            try { recognition.start(); } catch (err) {}
                        }
                    }, 1000);
                } else {
                    micBtn.classList.remove('tony-mic-active');
                }
            };

            micBtn.addEventListener('click', function() {
                if (window.currentTonyAudio && !window.currentTonyAudio.paused) {
                    window.currentTonyAudio.pause();
                    window.currentTonyAudio.currentTime = 0;
                    window.currentTonyAudio = null;
                    if (isAutoMode && startListeningRef) {
                        startListeningRef();
                        resetAutoModeTimeout();
                    }
                    return;
                }
                toggleAutoMode(!isAutoMode);
            });

            voiceCancelBtn.addEventListener('click', function() {
                pendingVoiceText = null;
                voiceConfirmEl.style.display = 'none';
            });
            voiceOkBtn.addEventListener('click', function() {
                if (pendingVoiceText) {
                    var t = pendingVoiceText;
                    pendingVoiceText = null;
                    voiceConfirmEl.style.display = 'none';
                    sendMessage(t, { fromVoice: true });
                }
            });
        } else if (micBtn) {
            micBtn.style.display = 'none';
        }

        var tonyConfirmOverlay = document.getElementById('tony-confirm-overlay');
        var tonyConfirmMessage = document.getElementById('tony-confirm-message');
        var tonyConfirmCancel = document.getElementById('tony-confirm-cancel');
        var tonyConfirmOk = document.getElementById('tony-confirm-ok');
        var tonyConfirmResolve = null;

        tonyConfirmCancel.addEventListener('click', function() {
            if (tonyConfirmResolve) { tonyConfirmResolve(false); tonyConfirmResolve = null; }
            tonyConfirmOverlay.style.display = 'none';
        });
        tonyConfirmOk.addEventListener('click', function() {
            if (tonyConfirmResolve) { tonyConfirmResolve(true); tonyConfirmResolve = null; }
            tonyConfirmOverlay.style.display = 'none';
        });
        tonyConfirmOverlay.addEventListener('click', function(e) {
            if (e.target === tonyConfirmOverlay && tonyConfirmResolve) {
                tonyConfirmResolve(false);
                tonyConfirmResolve = null;
                tonyConfirmOverlay.style.display = 'none';
            }
        });

        window.showTonyConfirmDialog = function(message) {
            return new Promise(function(resolve) {
                tonyConfirmResolve = resolve;
                tonyConfirmMessage.textContent = message;
                tonyConfirmOverlay.style.display = 'flex';
            });
        };

        window.addEventListener('beforeunload', saveTonyState);
        window.__tonyRestoreSession = restoreTonyState;
    }

    injectWidget();

    async function initTonyWhenReady() {
        var maxAttempts = 40;
        var interval = 250;
        for (var i = 0; i < maxAttempts; i++) {
            try {
                var firebaseService = await import('../services/firebase-service.js');
                var app = firebaseService.getAppInstance && firebaseService.getAppInstance();
                if (app) {
                    var Tony = (await import('../services/tony-service.js')).Tony;
                    window.Tony = Tony;
                    await Tony.init(app);
                    Tony.setContext('session', {
                        current_page: {
                            path: window.location.pathname,
                            title: document.title,
                            timestamp: new Date().toISOString()
                        }
                    });
                    // Recupera stato modulo Tony dal context o dal database
                    var lastStatusCheck = 0;
                    var STATUS_CHECK_THROTTLE_MS = 1000; // Throttle: max 1 chiamata al secondo
                    
                    var checkTonyModuleStatus = function(force) {
                        var now = Date.now();
                        if (!force && (now - lastStatusCheck) < STATUS_CHECK_THROTTLE_MS) {
                            return; // Skip se troppo presto
                        }
                        lastStatusCheck = now;
                        
                        try {
                            var context = Tony.context || {};
                            var moduliAttivi = context.dashboard?.moduli_attivi || 
                                             context.info_azienda?.moduli_attivi || 
                                             context.moduli_attivi || [];
                            
                            var wasActive = isTonyAdvancedActive;
                            isTonyAdvancedActive = Array.isArray(moduliAttivi) && moduliAttivi.includes('tony');
                            
                            // Log solo se cambia stato o se è la prima chiamata
                            if (wasActive !== isTonyAdvancedActive || !lastStatusCheck) {
                                console.log('[Tony] Stato modulo avanzato:', isTonyAdvancedActive ? 'ATTIVO' : 'NON ATTIVO', 'Moduli:', moduliAttivi);
                            }
                            
                            // Warning solo se moduli sono vuoti dopo inizializzazione completa
                            if ((!moduliAttivi || moduliAttivi.length === 0) && now > 5000) {
                                // Solo dopo 5 secondi dall'inizializzazione
                                console.warn('[Tony] ATTENZIONE: moduli_attivi non trovati nel context. La pagina potrebbe non aver inizializzato Tony correttamente.');
                            }
                        } catch (e) {
                            console.warn('[Tony] Errore recupero stato modulo:', e);
                            isTonyAdvancedActive = false;
                        }
                    };
                    
                    // Controlla stato modulo all'inizializzazione (una sola volta)
                    checkTonyModuleStatus(true);
                    
                    // Polling ridotto: solo 3 controlli nei primi 10 secondi (invece di 15 controlli in 30 secondi)
                    var statusCheckCount = 0;
                    var statusCheckInterval = setInterval(function() {
                        statusCheckCount++;
                        if (statusCheckCount <= 3) {
                            checkTonyModuleStatus();
                        } else {
                            clearInterval(statusCheckInterval);
                        }
                    }, 3000); // Ogni 3 secondi invece di 2
                    setTimeout(function() {
                        clearInterval(statusCheckInterval);
                    }, 10000); // Stop dopo 10 secondi invece di 30
                    
                    // Ascolta eventi di aggiornamento modulo dalla pagina abbonamento
                    window.addEventListener('tony-module-updated', function(e) {
                        var newModules = e.detail && e.detail.modules;
                        if (newModules && Array.isArray(newModules)) {
                            console.log('[Tony] Evento aggiornamento modulo ricevuto:', newModules);
                            if (window.Tony && window.Tony.setContext) {
                                window.Tony.setContext('dashboard', {
                                    info_azienda: { moduli_attivi: newModules },
                                    moduli_attivi: newModules
                                });
                            }
                            checkTonyModuleStatus();
                        }
                    });
                    
                    Tony.onAction(function(actionName, params) {
                        console.log('[DEBUG CURSOR] onAction callback: Chiamato dal service');
                        console.log('[DEBUG CURSOR] onAction callback: actionName:', actionName);
                        console.log('[DEBUG CURSOR] onAction callback: params:', JSON.stringify(params, null, 2));
                        console.log('[Tony] Azione ricevuta dal Service:', actionName, params);
                        
                        // SICUREZZA: Blocca azioni se modulo non attivo
                        if (!isTonyAdvancedActive) {
                            console.warn('[Tony] Azione bloccata: modulo Tony Avanzato non attivo');
                            appendMessage('Questa funzionalità richiede il modulo Tony Avanzato. Attivalo dalla Dashboard per automatizzare operazioni.', 'tony');
                            return;
                        }
                        
                        if (actionName === 'APRI_PAGINA' || actionName === 'apri_modulo') {
                            console.log('[DEBUG CURSOR] onAction callback: Caso APRI_PAGINA');
                            // Gestisci sia params.target che params.params.target (per compatibilità)
                            var actualParams = params.params && typeof params.params === 'object' ? params.params : params;
                            var rawTarget = (actualParams.target || actualParams.modulo || '').toString().trim();
                            
                            if (!rawTarget) {
                                console.warn('[DEBUG CURSOR] onAction callback: Target non trovato nei params');
                                console.warn('[Tony] Target non trovato. Params ricevuti:', params);
                                return;
                            }
                            
                            var url = getUrlForTarget(rawTarget);
                            if (!url) {
                                console.warn('[DEBUG CURSOR] onAction callback: Pagina non mappata');
                                console.warn('[Tony] Pagina non mappata per target:', rawTarget, 'Params:', params);
                                return;
                            }
                            var resolved = resolveTarget(rawTarget);
                            var label = TONY_LABEL_MAP[resolved] || resolved;
                            window.showTonyConfirmDialog('Aprire la pagina "' + label + '"?').then(function(ok) {
                                if (ok) window.location.href = url;
                            });
                            return;
                        }
                        console.log('[DEBUG CURSOR] onAction callback: Costruisco comando da actionName e params');
                        var command = { type: actionName };
                        if (params && typeof params === 'object') {
                            for (var k in params) if (params.hasOwnProperty(k)) command[k] = params[k];
                        }
                        console.log('[DEBUG CURSOR] onAction callback: Comando costruito:', JSON.stringify(command, null, 2));
                        console.log('[DEBUG CURSOR] onAction callback: Chiamata processTonyCommand dal callback onAction');
                        enqueueTonyCommand(command, { source: 'onAction-callback' });
                    });
                    
                    // Aggiorna stato modulo quando context dashboard viene settato (con debounce)
                    var setContextTimeout = null;
                    var originalSetContext = Tony.setContext;
                    if (originalSetContext) {
                        Tony.setContext = function(moduleName, data) {
                            originalSetContext.call(this, moduleName, data);
                            if (moduleName === 'dashboard' || moduleName === 'session') {
                                // Debounce: cancella timeout precedente e ne crea uno nuovo
                                if (setContextTimeout) clearTimeout(setContextTimeout);
                                setContextTimeout = setTimeout(function() {
                                    checkTonyModuleStatus(true); // Force check dopo debounce
                                }, 300); // Aspetta 300ms prima di controllare
                            }
                        };
                    }
                    
                    console.log('[Tony] Pronto (widget standalone). Modulo avanzato:', isTonyAdvancedActive ? 'ATTIVO' : 'NON ATTIVO');
                    if (typeof window.__tonyRestoreSession === 'function') window.__tonyRestoreSession();
                    return;
                }
            } catch (e) {
                if (i === maxAttempts - 1) console.warn('[Tony] Init non disponibile (Firebase non pronto o assente).', e);
            }
            await new Promise(function(r) { setTimeout(r, interval); });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { initTonyWhenReady(); });
    } else {
        initTonyWhenReady();
    }
})();

/**
 * Tony Widget – Main: orchestra ui, voice, engine.
 * @module core/js/tony/main
 */

import { injectWidget } from './ui.js';
import { initTonyVoice } from './voice.js';
import { TONY_PAGE_MAP, TONY_LABEL_MAP, resolveTarget, getUrlForTarget, cleanTextFromJsonResidue, extractTonyResponseFromString } from './engine.js';

(function() {
    'use strict';

    window.__tonyAudioQueue = window.__tonyAudioQueue || [];
    window.__tonyIsSpeaking = window.__tonyIsSpeaking || false;

    var scriptBase = window.__tonyScriptBase || (typeof import.meta !== 'undefined' && import.meta.url) || (document.currentScript && document.currentScript.src) || '';

    var _lastModalOpenTime = 0;
    var _tonyCommandQueue = [];
    var _isProcessingTonyCommand = false;
    var _isSendingMessage = false; // Anti-flood: blocca invii concorrenti

    // Timer proattivo form: delay post-inject (stabilizzazione) poi check; timer inattività parte dopo il check
    var POST_INJECT_CHECK_DELAY_MS = 2800;
    var IDLE_REMINDER_MS = 7000;

    /** True se il messaggio utente sembra già indicare trattore e/o attrezzo (Gestione Lavori). */
    function tonyUserMentionedLavoroMacchine(userText) {
        if (!userText) return false;
        var t = String(userText).toLowerCase();
        if (/\bcon\s+[^\n,]{1,48}\s+e\s+[^\n,]{1,48}/.test(t)) return true;
        if (/\b(trattrice|trattor)\b/.test(t)) return true;
        if (/\b(agrifull|erpice|nebulizz|atomizz|irrorat|spand|zappat|spread)\w*\b/.test(t)) return true;
        return false;
    }

    /** Rimuove domande ridondanti su trattore/attrezzo se l'utente li aveva già nel messaggio. */
    function tonySanitizeLavoroMacchineQuestionInReply(displayText, userText) {
        if (!displayText || !userText || !tonyUserMentionedLavoroMacchine(userText)) return displayText;
        var s = String(displayText);
        var patterns = [
            /\b[Qq]uale\s+trattor[ei]?\s+e\s+attrezzo\b[^?]*\?/gi,
            /\b[Qq]uale\s+trattor[ei]\b[^?]*\?/gi,
            /\b[Cc]he\s+trattor[ei]\b[^?]*\?/gi
        ];
        for (var pi = 0; pi < patterns.length; pi++) {
            s = s.replace(patterns[pi], '');
        }
        s = s.replace(/\s{2,}/g, ' ').replace(/\s+([.!?])/g, '$1').trim();
        s = s.replace(/^[\s.,;]+|[\s.,;]+$/g, '').trim();
        return s.length ? s : displayText;
    }

    function getTonyCommandPriority(command) {
        var type = command && command.type ? String(command.type).toUpperCase() : '';
        if (type === 'OPEN_MODAL') return 10;
        if (type === '_WAIT_MODAL_READY') return 15;
        if (type === 'INJECT_FORM_DATA') return 18;
        if (type === 'SET_FIELD') return 20;
        if (type === 'CLICK_BUTTON' || type === 'SAVE_ACTIVITY') return 30;
        return 40;
    }

    function getTonyQueueDelayByType(command) {
        var type = command && command.type ? String(command.type).toUpperCase() : '';
        if (type === 'OPEN_MODAL') return 700;
        if (type === 'INJECT_FORM_DATA') return 400;
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

    /**
     * True se l'oggetto fields/formData ha chiavi tipiche del Nuovo Preventivo, non del diario attività / modal Gestione Lavori.
     * Nota: il preventivo usa anche lavoro-categoria-principale / lavoro-sottocategoria — non vanno contati come modal lavoro.
     */
    function tonyPayloadLooksLikePreventivoFormData(obj) {
        if (!obj || typeof obj !== 'object') return false;
        var keys = Object.keys(obj);
        if (!keys.length) return false;
        var prevHints = ['tipo-lavoro', 'terreno-id', 'cliente-id', 'coltura-categoria', 'coltura', 'tipo-campo', 'superficie', 'lavoro-categoria-principale', 'lavoro-sottocategoria', 'iva', 'giorni-scadenza', 'data-prevista', 'note'];
        var looks = keys.some(function (k) { return prevHints.indexOf(k) >= 0; });
        var hasAttivita = keys.some(function (k) { return k.indexOf('attivita-') === 0; });
        var preventivoLavoroKeys = { 'lavoro-categoria-principale': 1, 'lavoro-sottocategoria': 1 };
        var hasLavoroModal = keys.some(function (k) {
            if (k === 'tipo-assegnazione') return true;
            if (k.indexOf('lavoro-') !== 0) return false;
            return !preventivoLavoroKeys[k];
        });
        return looks && !hasAttivita && !hasLavoroModal;
    }

    /** Ultimo messaggio utente in Tony.chatHistory (persiste finché non si ricarica senza restore). */
    function tonyGetLastUserMessageText() {
        var hist = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
        for (var i = hist.length - 1; i >= 0; i--) {
            var entry = hist[i];
            if (!entry || entry.role !== 'user' || !entry.parts || !entry.parts.length) continue;
            var p = entry.parts[0];
            var text = String((p && p.text) != null ? p.text : '');
            if (text.trim()) return text.trim();
        }
        return '';
    }

    /** Prompt utente per pending dopo navigazione: chatHistory può non essere ancora aggiornata al click «Apri pagina» (triggerAction prima di _pushChatTurn nel service). */
    function tonyGetUserPromptForPendingNav() {
        var fromHist = tonyGetLastUserMessageText();
        if (fromHist) return fromHist;
        try {
            if (typeof sessionStorage === 'undefined') return '';
            var s = sessionStorage.getItem('tony_last_user_message');
            return (s && String(s).trim()) ? String(s).trim() : '';
        } catch (e) { return ''; }
    }

    /**
     * Ultimo turno utente in chatHistory: intento Nuovo Preventivo (il modello a volte emette OPEN_MODAL lavoro/attività senza fields).
     * Evitare match su sole parole tipo "trinciatura" (gestione lavori) — richiedere lessico preventivo esplicito.
     */
    function tonyLastUserMessageSuggestsPreventivo() {
        var text = tonyGetLastUserMessageText();
        if (!text) return false;
        var low = text.toLowerCase();
        if (/\bpreventiv[a-z]*\b/i.test(text)) return true;
        if (/nuovo\s+preventivo/i.test(low)) return true;
        if (/conto\s+terzi/i.test(low)) return true;
        if (/\b(fare|creare|aprire|serve)\s+(un\s+)?preventivo\b/i.test(low)) return true;
        return false;
    }

    function tonyOpenModalShouldRouteToPreventivo(dataFields) {
        return tonyPayloadLooksLikePreventivoFormData(dataFields) || tonyLastUserMessageSuggestsPreventivo();
    }

    var PREVENTIVO_LAVORAZIONE_FIELD_IDS = ['tipo-lavoro', 'lavoro-categoria-principale', 'lavoro-sottocategoria'];

    /** True se #tipo-lavoro non ha ancora un valore reale (placeholder o option vuota). */
    function tonyIsPreventivoTipoLavoroUnset(tipoEl) {
        if (!tipoEl || !tipoEl.options || tipoEl.selectedIndex < 0) return true;
        var opt = tipoEl.options[tipoEl.selectedIndex];
        if (!opt) return true;
        var val = String(opt.value != null ? opt.value : '').trim();
        if (!val) return true;
        var txt = String(opt.text || '').trim();
        if (/^--/.test(txt)) return true;
        if (/seleziona\s+tipo\s*lavoro/i.test(txt)) return true;
        return false;
    }

    /**
     * La CF può emettere un secondo INJECT_FORM_DATA che sovrascrive categoria/sottocategoria/tipo-lavoro
     * con valori incoerenti rispetto al primo inject (es. Diserbo al posto di Trinciatura), lasciando
     * la sottocategoria vuota e rompendo validazione/salvataggio. Se il DOM ha già un tipo-lavoro
     * selezionato e il payload propone un'altra lavorazione, ignoriamo le chiavi gerarchiche.
     * Opzionale: formData._tonyAllowLavorazioneOverride per forzare l'override.
     */
    function tonyStripConflictingPreventivoLavorazione(formData) {
        if (!formData || typeof formData !== 'object') return formData;
        if (formData._tonyAllowLavorazioneOverride) return formData;
        var tipoEl = document.getElementById('tipo-lavoro');
        if (tonyIsPreventivoTipoLavoroUnset(tipoEl)) return formData;
        var curText = '';
        if (tipoEl && tipoEl.options && tipoEl.selectedIndex >= 0) {
            var opt = tipoEl.options[tipoEl.selectedIndex];
            curText = String((opt && (opt.text || opt.value)) || '').trim();
        }
        function normTipo(s) {
            return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
        }
        function tipoLavoroCompatibile(domText, incoming) {
            var a = normTipo(domText);
            var b = normTipo(incoming);
            if (!a || !b) return false;
            if (a === b) return true;
            if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
            return false;
        }
        var hasHierarchyPayload = PREVENTIVO_LAVORAZIONE_FIELD_IDS.some(function (k) {
            return formData[k] != null && String(formData[k]).trim() !== '';
        });
        if (!hasHierarchyPayload) return formData;
        if (!curText) return formData;
        var incTipo = formData['tipo-lavoro'] != null ? String(formData['tipo-lavoro']).trim() : '';
        var conflict = false;
        if (incTipo) {
            if (!tipoLavoroCompatibile(curText, incTipo)) conflict = true;
        } else {
            conflict = !!(formData['lavoro-categoria-principale'] || formData['lavoro-sottocategoria']);
        }
        if (!conflict) return formData;
        var out = Object.assign({}, formData);
        PREVENTIVO_LAVORAZIONE_FIELD_IDS.forEach(function (k) { delete out[k]; });
        console.log('[Tony] Preventivo: ignorata sovrascrittura lavorazione (DOM già: "' + curText + '")');
        return out;
    }

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
     * checkFormCompleteness è definita dentro if (sendBtn); processTonyCommand vive nello scope IIFE.
     * Bridge via window impostato quando il widget inizializza il blocco sendBtn.
     */
    function tonyCheckFormCompletenessSafe(formCtx) {
        if (typeof window.__tonyCheckFormCompleteness === 'function') {
            return window.__tonyCheckFormCompleteness(formCtx);
        }
        return { isComplete: false, missingFields: ['Contesto form Tony non ancora disponibile'] };
    }

    /** Normalizza testo per confronto hint terreno (nome/coltura) vs messaggio utente. Scope IIFE: usato da processTonyCommand. */
    function normTxtPreventivoTerrenoHint(str) {
        if (str == null || str === '') return '';
        try {
            return String(str).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
        } catch (e) {
            return String(str).toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
        }
    }

    var PREVENTIVO_TERRENO_HINT_STOP = {
        dobbiamo: 1, preventivo: 1, per: 1, con: 1, dalla: 1, del: 1, della: 1, delle: 1, degli: 1, deve: 1, devo: 1, essere: 1,
        fare: 1, fatto: 1, sono: 1, stato: 1, questa: 1, questo: 1, quale: 1, quelli: 1, anche: 1, solo: 1, tipo: 1, lavoro: 1,
        trinciare: 1, trinciatura: 1, trincia: 1, nostro: 1, nostri: 1, cliente: 1, conto: 1, terzi: 1, avere: 1, bisogno: 1,
        campo: 1, campi: 1, ecco: 1, qua: 1, qui: 1, nome: 1, indicami: 1, indicare: 1, quando: 1, dove: 1, come: 1, cosa: 1,
        signor: 1, signora: 1, luca: 1, marco: 1, paolo: 1, andrea: 1, giuseppe: 1
    };

    function terrenoClienteNormBlob(t) {
        if (!t || typeof t !== 'object') return '';
        return normTxtPreventivoTerrenoHint([
            t.nome, t.descrizione, t.note, t.podere,
            t.coltura, t.colturaSottocategoria, t.colturaSottoCategoria, t.colturaNome, t.nomeColtura, t.colturaCategoria
        ].join(' '));
    }

    function tokenMatchesTerrenoClienteBlob(tok, blob) {
        if (!tok || !blob) return false;
        if (blob.indexOf(tok) >= 0) return true;
        if (tok.length >= 5) {
            var pref = tok.slice(0, Math.min(6, tok.length));
            if (pref.length >= 5 && blob.indexOf(pref) >= 0) return true;
        }
        if (tok.indexOf('trebb') === 0 && /trebb/i.test(blob)) return true;
        return false;
    }

    /** Hint da campi preventivo (coltura, ecc.) + ultimo messaggio utente in chatHistory. */
    function getPreventivoTerrenoHintString(fdPrev) {
        var parts = [];
        if (fdPrev && typeof fdPrev === 'object') {
            ['coltura', 'coltura-categoria', 'lavoro-terreno'].forEach(function(k) {
                var v = fdPrev[k];
                if (v == null || v === '') return;
                var s = String(v).trim();
                if (!s) return;
                if (k === 'lavoro-terreno' && /^[a-zA-Z0-9_-]{15,}$/.test(s)) return;
                parts.push(s);
            });
            var tid = fdPrev['terreno-id'];
            if (tid != null && String(tid).trim() !== '') {
                var ts = String(tid).trim();
                if (!/^[a-zA-Z0-9_-]{15,}$/.test(ts)) parts.push(ts);
            }
        }
        var hist = (window.Tony && window.Tony.chatHistory) ? window.Tony.chatHistory : [];
        for (var i = hist.length - 1; i >= 0; i--) {
            var m = hist[i];
            if (m.role === 'user' && m.parts && m.parts[0] && m.parts[0].text) {
                parts.push(m.parts[0].text);
                break;
            }
        }
        return parts.join(' ');
    }

    /**
     * Restringe i terreni del cliente a quelli con match parziale su hint (messaggio / coltura).
     * @returns {{ listForAsk: Array, intro: string, hintTokens: string }}
     */
    function filterPreventivoTerreniForDisambiguation(listRaw, hintStr) {
        if (!listRaw || !listRaw.length) return { listForAsk: listRaw || [], intro: '', hintTokens: '' };
        var hintNorm = normTxtPreventivoTerrenoHint(hintStr);
        var toks = hintNorm.split(/\s+/).filter(function(t) {
            return t.length >= 4 && !PREVENTIVO_TERRENO_HINT_STOP[t];
        });
        var hintTokens = toks.slice(0, 4).join(', ');
        if (!toks.length) {
            return { listForAsk: listRaw, intro: '', hintTokens: '' };
        }
        var filtered = listRaw.filter(function(ter) {
            var b = terrenoClienteNormBlob(ter);
            return toks.some(function(tok) { return tokenMatchesTerrenoClienteBlob(tok, b); });
        });
        if (filtered.length >= 2) {
            return {
                listForAsk: filtered,
                intro: hintTokens ? ('Tra i terreni del cliente, questi richiamano «' + hintTokens + '»:\n') : '',
                hintTokens: hintTokens
            };
        }
        if (filtered.length === 1) {
            return {
                listForAsk: filtered,
                intro: hintTokens
                    ? ('Risulta un solo terreno compatibile con «' + hintTokens + '»:\n')
                    : 'Risulta un solo terreno compatibile con la tua richiesta:\n',
                hintTokens: hintTokens
            };
        }
        return {
            listForAsk: listRaw,
            intro: hintTokens
                ? ('Non ho trovato terreni con nome o coltura che richiamino «' + hintTokens + '»; ecco tutti i terreni del cliente:\n')
                : '',
            hintTokens: hintTokens
        };
    }

    /** Nome terreno per messaggi disambiguazione (evita coltura/ha in elenco breve). */
    function preventivoTerrenoNomeDisplay(t) {
        if (!t || typeof t !== 'object') return '';
        return String(t.nome || t.id || '').trim();
    }

    /** Una frase discorsiva adatta a chat e TTS (es. «Dobbiamo lavorare su A o B?»). */
    function buildPreventivoTerrenoChoiceQuestion(names) {
        var n = (names || []).map(function (s) { return String(s || '').trim(); }).filter(Boolean);
        if (n.length === 0) return '';
        if (n.length === 1) return 'Dobbiamo lavorare su ' + n[0] + '?';
        if (n.length === 2) return 'Dobbiamo lavorare su ' + n[0] + ' o ' + n[1] + '?';
        var last = n.pop();
        return 'Dobbiamo lavorare su ' + n.join(', ') + ' o ' + last + '?';
    }

    /**
     * Campi magazzino ancora da chiedere (da TONY_FORM_MAPPING.tonyInterviewFieldIds). Non sostituisce i required HTML per SAVE_ACTIVITY.
     */
    function tonyGetMagazzinoInterviewEmpty(formCtx, formId) {
        if (!formCtx || !formCtx.fields || !formId) return [];
        var getMap = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING && window.TONY_FORM_MAPPING.getFormMap);
        var map = getMap ? window.TONY_FORM_MAPPING.getFormMap(formId) : null;
        var ids = map && map.tonyInterviewFieldIds;
        if (!ids || !ids.length) return [];
        var byId = {};
        formCtx.fields.forEach(function(f) { byId[f.id] = f; });
        if (formId === 'prodotto-form' && map.prodottoCategoriaRichiedeGiorniCarenza && map.prodottoCategoriaRichiedeGiorniCarenza.length) {
            var catF = byId['prodotto-categoria'];
            var catVal = catF && catF.value != null ? String(catF.value).trim().toLowerCase() : '';
            if (!catVal || map.prodottoCategoriaRichiedeGiorniCarenza.indexOf(catVal) < 0) {
                ids = ids.filter(function(id) { return id !== 'prodotto-giorni-carenza'; });
            }
        }
        var placeholderRe = /^(seleziona|--\s*seleziona|--\s*nessun|scegli\.\.\.|select\.\.\.)/i;
        var empty = [];
        ids.forEach(function(id) {
            var f = byId[id];
            if (!f) return;
            var v = f.value;
            var isEmpty = v == null || v === '' || String(v).trim() === '';
            var t = (f.type || '').toLowerCase();
            if (!isEmpty && (t === 'select-one' || t === 'select' || /^select/.test(t))) {
                var vl = f.valueLabel || '';
                if (vl && placeholderRe.test(String(vl).trim())) isEmpty = true;
            }
            if (isEmpty) empty.push(id);
        });
        return empty;
    }

    function tonyMagazzinoInterviewLabels(formCtx, ids) {
        if (!ids || !ids.length || !formCtx || !formCtx.fields) return ids.join(', ');
        var byId = {};
        formCtx.fields.forEach(function(f) { byId[f.id] = f; });
        return ids.map(function(id) {
            var f = byId[id];
            return f ? String(f.label || id).replace(/\s*\*?\s*$/, '') : id;
        }).join(', ');
    }

    /** Dopo SET_FIELD su prodotto/movimento la CF spesso non rimanda subito un turno: schedula lo stesso check proattivo di post-INJECT (debounced). */
    var MAGAZZINO_POST_SETFIELD_DEBOUNCE_MS = 2000;
    var MAGAZZINO_IDLE_AFTER_SETFIELD_SAVE_MS = 2200;

    function scheduleTonyMagazzinoProactiveAfterSetField() {
        if (window.__tonyMagazzinoSetFieldDebounceTimer) {
            clearTimeout(window.__tonyMagazzinoSetFieldDebounceTimer);
        }
        window.__tonyMagazzinoSetFieldDebounceTimer = setTimeout(function() {
            window.__tonyMagazzinoSetFieldDebounceTimer = null;
            runTonyMagazzinoProactiveFromSetField(0);
        }, MAGAZZINO_POST_SETFIELD_DEBOUNCE_MS);
    }

    function runTonyMagazzinoProactiveFromSetField(retryCount) {
        retryCount = retryCount || 0;
        if (window.__tonyInjectionInProgress) {
            if (retryCount < 10) {
                setTimeout(function() { runTonyMagazzinoProactiveFromSetField(retryCount + 1); }, 400);
            }
            return;
        }
        var fc = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
        if (!fc || (fc.formId !== 'prodotto-form' && fc.formId !== 'movimento-form')) return;
        var mid = fc.formId === 'prodotto-form' ? 'prodotto-modal' : 'movimento-modal';
        var mel = document.getElementById(mid);
        if (!mel || !mel.classList.contains('active')) return;
        if (window.__tonyProactiveAskTimerId) { clearTimeout(window.__tonyProactiveAskTimerId); window.__tonyProactiveAskTimerId = null; }
        if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
        var hasReq = fc.requiredEmpty && fc.requiredEmpty.length > 0;
        var intE = (fc.interviewEmpty && fc.interviewEmpty.length) ? fc.interviewEmpty : (typeof tonyGetMagazzinoInterviewEmpty === 'function' ? tonyGetMagazzinoInterviewEmpty(fc, fc.formId) : []);
        var complete = !hasReq && intE.length === 0;
        window.__tonyProactiveFormState = { active: true, type: complete ? 'ready_for_save' : 'missing_fields', formId: fc.formId, modalId: mid };
        var idleDelay = complete ? MAGAZZINO_IDLE_AFTER_SETFIELD_SAVE_MS : IDLE_REMINDER_MS;
        window.__tonyIdleReminderTimerId = setTimeout(function() {
            window.__tonyIdleReminderTimerId = null;
            if (window.__tonyInjectionInProgress) return;
            var state = window.__tonyProactiveFormState;
            if (!state || !state.active) return;
            var el = document.getElementById(state.modalId);
            if (!el || !el.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
            var fc2 = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
            if (!fc2 || fc2.formId !== state.formId) { window.__tonyProactiveFormState = null; return; }
            var hasReq2 = fc2.requiredEmpty && fc2.requiredEmpty.length > 0;
            var intE2 = (fc2.interviewEmpty && fc2.interviewEmpty.length) ? fc2.interviewEmpty : (typeof tonyGetMagazzinoInterviewEmpty === 'function' ? tonyGetMagazzinoInterviewEmpty(fc2, fc2.formId) : []);
            var complete2 = !hasReq2 && intE2.length === 0;
            if (complete2 && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                window.__tonyTriggerAskForSaveConfirmation();
            } else if (!complete2 && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                var reqP = fc2.requiredEmpty && fc2.requiredEmpty.length ? fc2.requiredEmpty : [];
                var intP = intE2;
                var missMsg;
                if (state.formId === 'prodotto-form') {
                    missMsg = reqP.length
                        ? ('Form prodotto: obbligatori mancanti: ' + tonyMagazzinoInterviewLabels(fc2, reqP) + '.')
                        : (intP.length ? ('Form prodotto: indica ancora ' + tonyMagazzinoInterviewLabels(fc2, intP) + '.') : undefined);
                } else {
                    missMsg = reqP.length
                        ? ('Form movimento: obbligatori mancanti: ' + tonyMagazzinoInterviewLabels(fc2, reqP) + '.')
                        : (intP.length ? ('Form movimento: opzionali ancora da completare: ' + tonyMagazzinoInterviewLabels(fc2, intP) + '.') : undefined);
                }
                if (missMsg) window.__tonyTriggerAskForMissingFields(missMsg);
            }
            window.__tonyProactiveFormState = null;
        }, idleDelay);
    }

    /**
     * Messaggio in chat + stessa domanda letta ad alta voce (Tony.speak → TTS), come SUM_COLUMN/RIASSUNTO.
     */
    function appendPreventivoTerrenoAskAndSpeak(chatText, voiceText) {
        try {
            appendMessage(String(chatText || ''), 'tony');
        } catch (_) {}
        var v = (voiceText != null && String(voiceText).trim() !== '')
            ? String(voiceText).trim()
            : String(chatText || '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        if (v) {
            try {
                if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(v);
            } catch (_) {}
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

        // Bypass totale navigazione: APRI_PAGINA e apri_modulo sempre consentiti (ignorano isTonyAdvancedActive)
        var isNavCmd = (data.type === 'APRI_PAGINA' || data.type === 'apri_modulo');
        if (!isNavCmd && !isTonyAdvancedActive) {
            console.warn('[Tony] Comando operativo bloccato: modulo Tony Avanzato non attivo.');
            showMessageInChat('Questa funzionalità richiede il modulo Tony Avanzato. Attivalo dalla Dashboard per aprire pagine, compilare form e molto altro.', 'tony');
            return;
        }

        var $ = window.$ || window.jQuery;
        try {
            switch (String(data.type).toUpperCase()) {
                case '_WAIT_MODAL_READY':
                    console.log('[Tony] Attesa popolamento modal completata, proseguo con i SET_FIELD');
                    break;
                case 'INJECT_FORM_DATA':
                    // CF / modello possono usare "fields" o "fieldValues" (come OPEN_MODAL) invece di "formData"
                    (function normalizeInjectPayload(d) {
                        var alt = d.fieldValues || d.fields || (d.params && typeof d.params === 'object' && (d.params.formData || d.params.fields));
                        if (!alt || typeof alt !== 'object' || Array.isArray(alt)) return;
                        if (!d.formData || typeof d.formData !== 'object' || Array.isArray(d.formData)) {
                            d.formData = alt;
                            return;
                        }
                        var keysAlt = Object.keys(alt).filter(function(k) { return alt[k] != null && String(alt[k]).trim() !== ''; });
                        if (keysAlt.length > 0 && Object.keys(d.formData).length === 0) {
                            d.formData = alt;
                        }
                    })(data);
                    if ((data.formId === 'prodotto-form' || data.formId === 'movimento-form') && data.formData && typeof data.formData === 'object') {
                        var lastMagInj = window.__tonyMagazzinoLastInject;
                        if (lastMagInj && lastMagInj.formId === data.formId && (Date.now() - lastMagInj.t) < 15000 && lastMagInj.formData && typeof lastMagInj.formData === 'object') {
                            data.formData = Object.assign({}, lastMagInj.formData, data.formData);
                            console.log('[Tony] INJECT_FORM_DATA magazzino: merge con inject precedente (<15s)');
                        }
                        window.__tonyMagazzinoLastInject = { formId: data.formId, formData: Object.assign({}, data.formData), t: Date.now() };
                    }
                    if (data.formData && window.TonyFormInjector) {
                        // Muto durante iniezione: disabilita timer proattivi e resetta a ogni avvio INJECT
                        if (window.__tonyProactiveAskTimerId) { clearTimeout(window.__tonyProactiveAskTimerId); window.__tonyProactiveAskTimerId = null; }
                        if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                        if (window.__tonyProactiveFormState) window.__tonyProactiveFormState = null;
                        window.__tonyInjectionInProgress = true;
                        var ctx = window.Tony ? window.Tony.context : {};
                        if (data.formId === 'preventivo-form' && !document.getElementById('preventivo-form')) {
                            window.__tonyInjectionInProgress = false;
                            if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] INJECT_FORM_DATA: form preventivo assente, apro Nuovo Preventivo con intent pendente');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'nuovo preventivo',
                                    _tonyPendingModal: 'preventivo-form',
                                    _tonyPendingFields: (data.formData && typeof data.formData === 'object') ? data.formData : null
                                });
                            }
                            break;
                        }
                        if (data.formData && typeof data.formData === 'object') {
                            var fdInj = data.formData;
                            if (data.formId === 'attivita-form' && tonyPayloadLooksLikePreventivoFormData(fdInj)) {
                                console.log('[Tony] INJECT_FORM_DATA: attivita-form con chiavi preventivo → uso preventivo-form (anche cross-page)');
                                data.formId = 'preventivo-form';
                            }
                        }
                        if (document.getElementById('preventivo-form') && data.formData && typeof data.formData === 'object') {
                            var fdInj = data.formData;
                            if ((fdInj['data-prevista'] == null || String(fdInj['data-prevista']).trim() === '') &&
                                (fdInj['attivita-data'] != null && String(fdInj['attivita-data']).trim() !== '' ||
                                 fdInj['dataPrevista'] != null && String(fdInj['dataPrevista']).trim() !== '' ||
                                 fdInj['data_prevista'] != null && String(fdInj['data_prevista']).trim() !== '')) {
                                data.formData = Object.assign({}, fdInj);
                                if (data.formData['attivita-data'] != null && String(data.formData['attivita-data']).trim() !== '') {
                                    data.formData['data-prevista'] = data.formData['attivita-data'];
                                    delete data.formData['attivita-data'];
                                } else if (data.formData['dataPrevista'] != null && String(data.formData['dataPrevista']).trim() !== '') {
                                    data.formData['data-prevista'] = data.formData['dataPrevista'];
                                    delete data.formData['dataPrevista'];
                                } else {
                                    data.formData['data-prevista'] = data.formData['data_prevista'];
                                    delete data.formData['data_prevista'];
                                }
                                console.log('[Tony] INJECT_FORM_DATA: alias data → data-prevista (Nuovo Preventivo)');
                                fdInj = data.formData;
                            }
                        }
                        var targetModalId = (data.formId === 'lavoro-form' || data.formId === 'lavoro-modal') ? 'lavoro-modal' : (data.formId === 'attivita-form' ? 'attivita-modal' : (data.formId === 'prodotto-form' ? 'prodotto-modal' : (data.formId === 'movimento-form' ? 'movimento-modal' : null)));
                        var modalEl = targetModalId ? document.getElementById(targetModalId) : null;
                        var isModalOpen = modalEl && modalEl.classList.contains('active');
                        if (targetModalId && !isModalOpen && data.formData && Object.keys(data.formData).length > 0) {
                            console.log('[Tony] INJECT_FORM_DATA: modal non aperto, apro prima ' + targetModalId + ' e poi inietto');
                            window.__tonyInjectionInProgress = false;
                            enqueueTonyCommand({ type: 'OPEN_MODAL', id: targetModalId, fields: data.formData }, { source: 'inject-guard-open-first' });
                            break;
                        }
                        if (data.formId === 'lavoro-form' || data.formId === 'lavoro-modal') {
                            console.log('[Tony] INJECT_FORM_DATA: iniezione formData lavoro');
                            if (window.Tony && typeof window.Tony.setContext === 'function') {
                                window.Tony.setContext('lavori', ctx.lavori || {});
                            }
                            var formDataToInject = data.formData;
                            var formCtxMerge = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                            if (formCtxMerge && formCtxMerge.fields && formCtxMerge.fields.length > 0) {
                                var merged = Object.assign({}, formDataToInject);
                                formCtxMerge.fields.forEach(function(f) {
                                    var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                    if (f.id && hasVal && !(f.id in formDataToInject)) {
                                        merged[f.id] = f.value;
                                    }
                                });
                                if (Object.keys(merged).length > Object.keys(formDataToInject).length) {
                                    formDataToInject = merged;
                                    console.log('[Tony] INJECT_FORM_DATA: merge con valori esistenti, campi totali:', Object.keys(formDataToInject).length);
                                }
                            }
                            window.TonyFormInjector.injectLavoroForm(formDataToInject, ctx).then(function(ok) {
                                window.__tonyInjectionInProgress = false;
                                if (ok) {
                                    console.log('[Tony] Form lavoro iniettato con successo');
                                    if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                    if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                    function runProactiveCheckLavoro(retryCount) {
                                        retryCount = retryCount || 0;
                                        var formCtx = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                        var modalEl = document.getElementById('lavoro-modal');
                                        if (!modalEl || !modalEl.classList.contains('active')) {
                                            if (retryCount === 0) console.log('[Tony] Timer proattivo lavoro: modal non aperto, skip');
                                            return;
                                        }
                                        if (!formCtx || !formCtx.formId) {
                                            if (retryCount < 2) {
                                                window.__tonyProactiveAskTimerId = setTimeout(function() { window.__tonyProactiveAskTimerId = null; runProactiveCheckLavoro(retryCount + 1); }, 1500);
                                                return;
                                            }
                                            console.log('[Tony] Timer proattivo lavoro: formCtx non disponibile dopo retry, uso solo DOM per needsMacchine');
                                        }
                                        var hasRequiredEmpty = (formCtx && formCtx.requiredEmpty && formCtx.requiredEmpty.length > 0);
                                        var needsMacchine = false;
                                        var tipoEl = document.getElementById('lavoro-tipo-lavoro');
                                        var tipoVal = (tipoEl && tipoEl.options && tipoEl.options[tipoEl.selectedIndex]) ? (tipoEl.options[tipoEl.selectedIndex].text || '').toLowerCase() : '';
                                        var isMeccanico = /erpicatur|trinciatur|fresatur|pre-potatur|potatur\s+meccanica|vendemmia\s+meccanica|vangatur|raccolta\s+meccanica/.test(tipoVal)
                                            || /\bmeccanic[oa]\b/.test(tipoVal);
                                        if (isMeccanico) {
                                            var trEl = document.getElementById('lavoro-trattore');
                                            var atEl = document.getElementById('lavoro-attrezzo');
                                            needsMacchine = !trEl || !trEl.value || !atEl || !atEl.value;
                                        }
                                        var formComplete = !hasRequiredEmpty && !needsMacchine;
                                        var needsMacchineOnly = !hasRequiredEmpty && needsMacchine;
                                        window.__tonyProactiveFormState = { active: true, type: formComplete ? 'ready_for_save' : 'missing_fields', formId: 'lavoro-form', modalId: 'lavoro-modal', needsMacchineOnly: !!needsMacchineOnly };
                                        console.log('[Tony] Timer proattivo lavoro: check eseguito, type=', window.__tonyProactiveFormState.type, 'hasRequiredEmpty=', hasRequiredEmpty, 'needsMacchine=', needsMacchine);
                                        window.__tonyIdleReminderTimerId = setTimeout(function() {
                                            window.__tonyIdleReminderTimerId = null;
                                            if (window.__tonyInjectionInProgress) return;
                                            var state = window.__tonyProactiveFormState;
                                            if (!state || !state.active) return;
                                            var el = document.getElementById(state.modalId);
                                            if (!el || !el.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                                            if (state.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                                window.__tonyTriggerAskForSaveConfirmation();
                                            } else if (state.type === 'missing_fields' && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                                var lastUpM = '';
                                                try { lastUpM = String(sessionStorage.getItem('tony_last_user_message') || '').trim(); } catch (eMk) {}
                                                if (state.needsMacchineOnly && lastUpM && tonyUserMentionedLavoroMacchine(lastUpM)) {
                                                    window.__tonyProactiveFormState = null;
                                                } else {
                                                    var msg = (state.needsMacchineOnly) ? 'Mancano solo trattore e attrezzo per questo lavoro meccanico. Quale trattore e erpice vuoi usare?' : null;
                                                    window.__tonyTriggerAskForMissingFields(msg);
                                                }
                                            }
                                            window.__tonyProactiveFormState = null;
                                        }, IDLE_REMINDER_MS);
                                    }
                                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                                        window.__tonyProactiveAskTimerId = null;
                                        runProactiveCheckLavoro(0);
                                    }, POST_INJECT_CHECK_DELAY_MS);
                                } else {
                                    console.warn('[Tony] Iniezione form lavoro fallita');
                                }
                            });
                        } else if (data.formId === 'preventivo-form') {
                            console.log('[Tony] INJECT_FORM_DATA: iniezione formData Nuovo Preventivo');
                            var formDataPrev = data.formData;
                            var formCtxPrev = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                            if (formCtxPrev && formCtxPrev.fields && formCtxPrev.fields.length > 0) {
                                var mergedPrev = Object.assign({}, formDataPrev);
                                formCtxPrev.fields.forEach(function(f) {
                                    var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                    if (f.id && hasVal && !(f.id in formDataPrev)) {
                                        mergedPrev[f.id] = f.value;
                                    }
                                });
                                if (Object.keys(mergedPrev).length > Object.keys(formDataPrev).length) {
                                    formDataPrev = mergedPrev;
                                }
                            }
                            formDataPrev = tonyStripConflictingPreventivoLavorazione(formDataPrev);
                            window.TonyFormInjector.injectPreventivoForm(formDataPrev, ctx).then(function(ok) {
                                window.__tonyInjectionInProgress = false;
                                var dis = window.__tonyPreventivoTerrenoDisambiguation;
                                if (dis && Array.isArray(dis.options) && dis.options.length > 1) {
                                    var namesDis = dis.options.map(function (o) { return (o.nome || o.id || '').toString().trim(); }).filter(Boolean);
                                    var qDis = buildPreventivoTerrenoChoiceQuestion(namesDis);
                                    var chatDis = qDis ? qDis : 'Su quale terreno vuoi calcolare il preventivo?';
                                    appendPreventivoTerrenoAskAndSpeak(chatDis, qDis || null);
                                    // Fallback: fermati qui e attendi scelta utente, evita reminder fuorvianti.
                                    window.__tonyPreventivoTerrenoDisambiguation = null;
                                    return;
                                }
                                var fdPrev = formDataPrev;
                                function proceedPreventivoInjectRest() {
                                    window.__tonyPreventivoTerrenoDisambiguation = null;
                                    if (!ok) {
                                        console.warn('[Tony] Iniezione form preventivo fallita');
                                        return;
                                    }
                                    console.log('[Tony] Form preventivo iniettato con successo');
                                    if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                    if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                    function runProactiveCheckPreventivo(retryCount) {
                                        retryCount = retryCount || 0;
                                        var formPreventivo = document.getElementById('preventivo-form');
                                        if (!formPreventivo) {
                                            if (retryCount < 4) {
                                                window.__tonyProactiveAskTimerId = setTimeout(function() {
                                                    window.__tonyProactiveAskTimerId = null;
                                                    runProactiveCheckPreventivo(retryCount + 1);
                                                }, 1200);
                                                return;
                                            }
                                            console.log('[Tony] Timer proattivo preventivo: #preventivo-form assente, skip');
                                            return;
                                        }
                                        var buildPrev = window.__tonyBuildTonyFormContext;
                                        var formCtxP = (buildPrev && formPreventivo)
                                            ? buildPrev(formPreventivo, formPreventivo, '', 'preventivo proactive')
                                            : (typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null);
                                        if (!formCtxP || formCtxP.formId !== 'preventivo-form') {
                                            if (retryCount < 4) {
                                                window.__tonyProactiveAskTimerId = setTimeout(function() {
                                                    window.__tonyProactiveAskTimerId = null;
                                                    runProactiveCheckPreventivo(retryCount + 1);
                                                }, 1200);
                                                return;
                                            }
                                            console.log('[Tony] Timer proattivo preventivo: formCtx non disponibile dopo retry');
                                            return;
                                        }
                                        var reqEmpty = (formCtxP.requiredEmpty && formCtxP.requiredEmpty.slice) ? formCtxP.requiredEmpty.slice() : [];
                                        var formCompleteP = reqEmpty.length === 0;
                                        var proactiveMissingMsg = null;
                                        if (!formCompleteP) {
                                            if (reqEmpty.length === 1 && reqEmpty[0] === 'data-prevista') {
                                                proactiveMissingMsg = 'Prima di salvare serve la data prevista del lavoro. Indicala nel campo "Data prevista lavoro" o scrivila qui (es. 15 aprile 2026).';
                                            } else if (reqEmpty.indexOf('data-prevista') >= 0) {
                                                proactiveMissingMsg = 'Nel preventivo manca ancora la data prevista del lavoro; compilala nel form o indicamela nel messaggio.';
                                            }
                                        }
                                        window.__tonyProactiveFormState = {
                                            active: true,
                                            type: formCompleteP ? 'ready_for_save' : 'missing_fields',
                                            formId: 'preventivo-form',
                                            modalId: 'preventivo-form',
                                            proactiveMissingMessage: proactiveMissingMsg
                                        };
                                        console.log('[Tony] Timer proattivo preventivo: check eseguito, type=', window.__tonyProactiveFormState.type, 'requiredEmpty=', reqEmpty);
                                        window.__tonyIdleReminderTimerId = setTimeout(function() {
                                            window.__tonyIdleReminderTimerId = null;
                                            if (window.__tonyInjectionInProgress) return;
                                            var stateP = window.__tonyProactiveFormState;
                                            if (!stateP || !stateP.active || stateP.formId !== 'preventivo-form') return;
                                            if (!document.getElementById('preventivo-form')) {
                                                window.__tonyProactiveFormState = null;
                                                return;
                                            }
                                            if (stateP.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                                window.__tonyTriggerAskForSaveConfirmation();
                                            } else if (stateP.type === 'missing_fields' && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                                window.__tonyTriggerAskForMissingFields(stateP.proactiveMissingMessage);
                                            }
                                            window.__tonyProactiveFormState = null;
                                        }, IDLE_REMINDER_MS);
                                    }
                                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                                        window.__tonyProactiveAskTimerId = null;
                                        runProactiveCheckPreventivo(0);
                                    }, POST_INJECT_CHECK_DELAY_MS);
                                }
                                var cidPrev = fdPrev && fdPrev['cliente-id'];
                                var hadTerrenoPayload = fdPrev && String(fdPrev['terreno-id'] || '').trim() !== '';
                                if (ok && cidPrev && !hadTerrenoPayload) {
                                    var checkMultiTerrenoCliente = function(attempt) {
                                        attempt = attempt || 0;
                                        var ps = window.preventivoState;
                                        var listRaw = ps && Array.isArray(ps.terreni) ? ps.terreni : [];
                                        var terEl = document.getElementById('terreno-id');
                                        var terEmpty = !terEl || !String(terEl.value || '').trim();
                                        var hintStr = getPreventivoTerrenoHintString(fdPrev);
                                        var filt = filterPreventivoTerreniForDisambiguation(listRaw, hintStr);
                                        var list = filt.listForAsk;

                                        if (listRaw.length > 1 && terEmpty && list.length > 1) {
                                            var namesM = list.map(preventivoTerrenoNomeDisplay).filter(Boolean);
                                            var fullListFallback = !!(filt.intro && filt.intro.indexOf('Non ho trovato') === 0);
                                            var shortLimit = 5;
                                            if (namesM.length <= shortLimit) {
                                                var qM = buildPreventivoTerrenoChoiceQuestion(namesM);
                                                var chatM = qM;
                                                if (fullListFallback) {
                                                    chatM = filt.intro.replace(/\n/g, ' ').trim() + '\n' + qM;
                                                }
                                                appendPreventivoTerrenoAskAndSpeak(chatM, qM);
                                            } else {
                                                var elencoNomi = namesM.map(function (n) { return '- ' + n; }).join('\n');
                                                var chatLong = (filt.intro ? filt.intro : 'Per questo cliente ci sono molti terreni.\n') + elencoNomi + '\n\n' + 'Indica il nome del terreno che preferisci.';
                                                var voiceLong = 'Ci sono molti terreni per questo cliente. Leggi l\'elenco nella chat e dimmi il nome che preferisci.';
                                                appendPreventivoTerrenoAskAndSpeak(chatLong, voiceLong);
                                            }
                                            window.__tonyPreventivoTerrenoDisambiguation = null;
                                            return;
                                        }
                                        if (listRaw.length > 1 && terEmpty && list.length === 1) {
                                            var nSolo = preventivoTerrenoNomeDisplay(list[0]);
                                            var askOne = (filt.hintTokens ? ('Per «' + filt.hintTokens + '» ho trovato solo ' + nSolo + '. ') : ('Ho trovato solo ' + nSolo + '. ')) + 'Va bene? Selezionalo nel modulo Terreno o scrivilo qui.';
                                            appendPreventivoTerrenoAskAndSpeak(askOne, askOne);
                                            window.__tonyPreventivoTerrenoDisambiguation = null;
                                            return;
                                        }
                                        if (terEmpty && listRaw.length <= 1 && attempt < 10) {
                                            setTimeout(function() { checkMultiTerrenoCliente(attempt + 1); }, 400);
                                            return;
                                        }
                                        proceedPreventivoInjectRest();
                                    };
                                    checkMultiTerrenoCliente(0);
                                    return;
                                }
                                proceedPreventivoInjectRest();
                            });
                        } else if (data.formId === 'attivita-form') {
                            console.log('[Tony] INJECT_FORM_DATA: iniezione formData attività');
                            var formDataAttivita = data.formData;
                            var formCtxAttivita = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                            if (formCtxAttivita && formCtxAttivita.fields && formCtxAttivita.fields.length > 0) {
                                var mergedAtt = Object.assign({}, formDataAttivita);
                                formCtxAttivita.fields.forEach(function(f) {
                                    var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                    if (f.id && hasVal && !(f.id in formDataAttivita)) {
                                        mergedAtt[f.id] = f.value;
                                    }
                                });
                                if (Object.keys(mergedAtt).length > Object.keys(formDataAttivita).length) {
                                    formDataAttivita = mergedAtt;
                                }
                            }
                            window.TonyFormInjector.injectAttivitaForm(formDataAttivita, ctx).then(function(ok) {
                                window.__tonyInjectionInProgress = false;
                                if (ok) {
                                    console.log('[Tony] Form data iniettato con successo');
                                    if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                    if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                                        window.__tonyProactiveAskTimerId = null;
                                        var formCtx = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                        var modalEl = document.getElementById('attivita-modal');
                                        if (!formCtx || !formCtx.formId || !modalEl || !modalEl.classList.contains('active')) return;
                                        var hasRequiredEmpty = formCtx.requiredEmpty && formCtx.requiredEmpty.length > 0;
                                        var formComplete = !hasRequiredEmpty;
                                        window.__tonyProactiveFormState = { active: true, type: formComplete ? 'ready_for_save' : 'missing_fields', formId: 'attivita-form', modalId: 'attivita-modal' };
                                        window.__tonyIdleReminderTimerId = setTimeout(function() {
                                            window.__tonyIdleReminderTimerId = null;
                                            if (window.__tonyInjectionInProgress) return;
                                            var state = window.__tonyProactiveFormState;
                                            if (!state || !state.active) return;
                                            var el = document.getElementById(state.modalId);
                                            if (!el || !el.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                                            if (state.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                                window.__tonyTriggerAskForSaveConfirmation();
                                            } else if (state.type === 'missing_fields' && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                                window.__tonyTriggerAskForMissingFields();
                                            }
                                            window.__tonyProactiveFormState = null;
                                        }, IDLE_REMINDER_MS);
                                    }, POST_INJECT_CHECK_DELAY_MS);
                                } else {
                                    console.warn('[Tony] Iniezione formData fallita');
                                }
                            });
                        } else if (data.formId === 'prodotto-form') {
                            console.log('[Tony] INJECT_FORM_DATA: iniezione formData prodotto');
                            var formDataProdotto = data.formData;
                            var formCtxProdotto = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                            if (formCtxProdotto && formCtxProdotto.fields && formCtxProdotto.fields.length > 0) {
                                var mergedPro = Object.assign({}, formDataProdotto);
                                formCtxProdotto.fields.forEach(function(f) {
                                    var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                    if (f.id && hasVal && !(f.id in formDataProdotto)) {
                                        mergedPro[f.id] = f.value;
                                    }
                                });
                                if (Object.keys(mergedPro).length > Object.keys(formDataProdotto).length) {
                                    formDataProdotto = mergedPro;
                                }
                            }
                            window.TonyFormInjector.injectProdottoForm(formDataProdotto, ctx).then(function(ok) {
                                window.__tonyInjectionInProgress = false;
                                if (ok) {
                                    console.log('[Tony] Form prodotto iniettato con successo');
                                    if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                    if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                                        window.__tonyProactiveAskTimerId = null;
                                        var formCtx = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                        var modalEl = document.getElementById('prodotto-modal');
                                        if (!formCtx || formCtx.formId !== 'prodotto-form' || !modalEl || !modalEl.classList.contains('active')) return;
                                        var hasRequiredEmpty = formCtx.requiredEmpty && formCtx.requiredEmpty.length > 0;
                                        var intEmptyP = (formCtx.interviewEmpty && formCtx.interviewEmpty.length) ? formCtx.interviewEmpty : (typeof tonyGetMagazzinoInterviewEmpty === 'function' ? tonyGetMagazzinoInterviewEmpty(formCtx, 'prodotto-form') : []);
                                        var formComplete = !hasRequiredEmpty && intEmptyP.length === 0;
                                        window.__tonyProactiveFormState = { active: true, type: formComplete ? 'ready_for_save' : 'missing_fields', formId: 'prodotto-form', modalId: 'prodotto-modal' };
                                        window.__tonyIdleReminderTimerId = setTimeout(function() {
                                            window.__tonyIdleReminderTimerId = null;
                                            if (window.__tonyInjectionInProgress) return;
                                            var state = window.__tonyProactiveFormState;
                                            if (!state || !state.active) return;
                                            var el = document.getElementById(state.modalId);
                                            if (!el || !el.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                                            if (state.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                                window.__tonyTriggerAskForSaveConfirmation();
                                            } else if (state.type === 'missing_fields' && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                                var fcP = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                                var reqP = fcP && fcP.requiredEmpty && fcP.requiredEmpty.length ? fcP.requiredEmpty : [];
                                                var intP = fcP && fcP.interviewEmpty && fcP.interviewEmpty.length ? fcP.interviewEmpty : (fcP && typeof tonyGetMagazzinoInterviewEmpty === 'function' ? tonyGetMagazzinoInterviewEmpty(fcP, 'prodotto-form') : []);
                                                var missMsg = reqP.length
                                                    ? ('Form prodotto: obbligatori mancanti: ' + tonyMagazzinoInterviewLabels(fcP, reqP) + '.')
                                                    : (intP.length ? ('Form prodotto: indica ancora ' + tonyMagazzinoInterviewLabels(fcP, intP) + '.') : undefined);
                                                window.__tonyTriggerAskForMissingFields(missMsg);
                                            }
                                            window.__tonyProactiveFormState = null;
                                        }, IDLE_REMINDER_MS);
                                    }, POST_INJECT_CHECK_DELAY_MS);
                                } else {
                                    console.warn('[Tony] Iniezione form prodotto fallita');
                                }
                            });
                        } else if (data.formId === 'movimento-form') {
                            console.log('[Tony] INJECT_FORM_DATA: iniezione formData movimento');
                            var formDataMov = data.formData;
                            var formCtxMov = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                            if (formCtxMov && formCtxMov.fields && formCtxMov.fields.length > 0) {
                                var mergedMov = Object.assign({}, formDataMov);
                                formCtxMov.fields.forEach(function(f) {
                                    var hasVal = f.value != null && (f.value === 0 || f.value !== '');
                                    if (f.id && hasVal && !(f.id in formDataMov)) {
                                        mergedMov[f.id] = f.value;
                                    }
                                });
                                if (Object.keys(mergedMov).length > Object.keys(formDataMov).length) {
                                    formDataMov = mergedMov;
                                }
                            }
                            window.TonyFormInjector.injectMovimentoForm(formDataMov, ctx).then(function(ok) {
                                window.__tonyInjectionInProgress = false;
                                if (ok) {
                                    console.log('[Tony] Form movimento iniettato con successo');
                                    if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                    if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                    window.__tonyProactiveAskTimerId = setTimeout(function() {
                                        window.__tonyProactiveAskTimerId = null;
                                        var formCtxM = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                        var modalMov = document.getElementById('movimento-modal');
                                        if (!formCtxM || formCtxM.formId !== 'movimento-form' || !modalMov || !modalMov.classList.contains('active')) return;
                                        var hasReqM = formCtxM.requiredEmpty && formCtxM.requiredEmpty.length > 0;
                                        var intEmptyM = (formCtxM.interviewEmpty && formCtxM.interviewEmpty.length) ? formCtxM.interviewEmpty : (typeof tonyGetMagazzinoInterviewEmpty === 'function' ? tonyGetMagazzinoInterviewEmpty(formCtxM, 'movimento-form') : []);
                                        var completeM = !hasReqM && intEmptyM.length === 0;
                                        window.__tonyProactiveFormState = { active: true, type: completeM ? 'ready_for_save' : 'missing_fields', formId: 'movimento-form', modalId: 'movimento-modal' };
                                        window.__tonyIdleReminderTimerId = setTimeout(function() {
                                            window.__tonyIdleReminderTimerId = null;
                                            if (window.__tonyInjectionInProgress) return;
                                            var stateM = window.__tonyProactiveFormState;
                                            if (!stateM || !stateM.active) return;
                                            var elM = document.getElementById(stateM.modalId);
                                            if (!elM || !elM.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                                            if (stateM.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                                window.__tonyTriggerAskForSaveConfirmation();
                                            } else if (stateM.type === 'missing_fields' && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                                var fcMv = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                                var reqMv = fcMv && fcMv.requiredEmpty && fcMv.requiredEmpty.length ? fcMv.requiredEmpty : [];
                                                var intMv = fcMv && fcMv.interviewEmpty && fcMv.interviewEmpty.length ? fcMv.interviewEmpty : (fcMv && typeof tonyGetMagazzinoInterviewEmpty === 'function' ? tonyGetMagazzinoInterviewEmpty(fcMv, 'movimento-form') : []);
                                                var msgM = reqMv.length
                                                    ? ('Form movimento: obbligatori mancanti: ' + tonyMagazzinoInterviewLabels(fcMv, reqMv) + '.')
                                                    : (intMv.length ? ('Form movimento: opzionali ancora da completare: ' + tonyMagazzinoInterviewLabels(fcMv, intMv) + '.') : undefined);
                                                window.__tonyTriggerAskForMissingFields(msgM);
                                            }
                                            window.__tonyProactiveFormState = null;
                                        }, IDLE_REMINDER_MS);
                                    }, POST_INJECT_CHECK_DELAY_MS);
                                } else {
                                    console.warn('[Tony] Iniezione form movimento fallita');
                                }
                            });
                        } else {
                            window.__tonyInjectionInProgress = false;
                            console.warn('[Tony] INJECT_FORM_DATA: formId non supportato:', data.formId);
                        }
                    } else {
                        window.__tonyInjectionInProgress = false;
                        console.warn('[Tony] INJECT_FORM_DATA: formData vuoto o injector non caricato');
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
                        
                        // Se attivita-modal richiesto ma non esiste (es. dashboard): Diario — salvo che i campi siano chiaramente Nuovo Preventivo (errore comune del modello).
                        if ((modalId === 'attivita-modal' || (modalKey && modalKey.indexOf('attivita') >= 0)) && !document.getElementById('attivita-modal')) {
                            if (tonyOpenModalShouldRouteToPreventivo(data.fields) && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] OPEN_MODAL attivita-modal → Nuovo Preventivo (campi preventivo o ultimo messaggio utente)');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'nuovo preventivo',
                                    _tonyPendingModal: 'preventivo-form',
                                    _tonyPendingFields: (data.fields && typeof data.fields === 'object') ? data.fields : null
                                });
                                break;
                            }
                            if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] Modal attività non presente in questa pagina, apro Diario Attività');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'attivita',
                                    _tonyPendingModal: 'attivita-modal',
                                    _tonyPendingFields: (data.fields && typeof data.fields === 'object') ? data.fields : null
                                });
                                break;
                            }
                        }

                        if (modalId === 'lavoro-modal' && !document.getElementById('lavoro-modal')) {
                            if (tonyOpenModalShouldRouteToPreventivo(data.fields) && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] OPEN_MODAL lavoro-modal → Nuovo Preventivo (campi preventivo o ultimo messaggio utente, non Gestione Lavori)');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'nuovo preventivo',
                                    _tonyPendingModal: 'preventivo-form',
                                    _tonyPendingFields: (data.fields && typeof data.fields === 'object') ? data.fields : null
                                });
                                break;
                            }
                        }

                        var wantsPreventivoPage = (
                            modalId === 'preventivo-form' ||
                            modalKey === 'preventivo-form' ||
                            modalKey === 'nuovo-preventivo' ||
                            modalKey === 'preventivo' ||
                            (modalKey.indexOf('nuovo') >= 0 && modalKey.indexOf('preventivo') >= 0)
                        );
                        if (wantsPreventivoPage) {
                            var pfOpen = document.getElementById('preventivo-form');
                            if (pfOpen) {
                                if (data.fields && typeof data.fields === 'object' && Object.keys(data.fields).length > 0 && window.TonyFormInjector) {
                                    enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'preventivo-form', formData: data.fields }, { source: 'open-preventivo-on-page', delayMs: 900 });
                                }
                                break;
                            }
                            if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[Tony] Form preventivo non in pagina, apro Nuovo Preventivo');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'nuovo preventivo',
                                    _tonyPendingModal: 'preventivo-form',
                                    _tonyPendingFields: (data.fields && typeof data.fields === 'object') ? data.fields : null
                                });
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
                        if (resolvedId === 'prodotto-modal') {
                            var btnNuovoProd = document.getElementById('btn-nuovo-prodotto');
                            if (btnNuovoProd) {
                                btnNuovoProd.click();
                                opened = true;
                                console.log('[Tony] Apertura prodotto-modal via btn-nuovo-prodotto (form reset)');
                            }
                        } else if (resolvedId === 'movimento-modal') {
                            var btnNuovoMov = document.getElementById('btn-nuovo-movimento');
                            if (btnNuovoMov) {
                                btnNuovoMov.click();
                                opened = true;
                                console.log('[Tony] Apertura movimento-modal via btn-nuovo-movimento (form reset)');
                            }
                        }
                        if (!opened && $ && $.fn && $.fn.modal) {
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
                        } else if (!opened) {
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
                            } else if (resolvedId === 'lavoro-modal') {
                                if (typeof window.openCreaModal === 'function') {
                                    console.log('[Tony] Inizializzo modal lavoro (popolamento dropdown)');
                                    window.openCreaModal();
                                    enqueueTonyCommand({ type: '_WAIT_MODAL_READY' }, { source: 'post-open-lavoro', delayMs: 800 });
                                }
                            } else if (resolvedId === 'terreno-modal') {
                                if (typeof window.openTerrenoModal === 'function') {
                                    console.log('[Tony] Inizializzo modal terreno (popolamento poderi/colture)');
                                    window.openTerrenoModal(null).catch(function(e) {
                                        console.warn('[Tony] openTerrenoModal fallito:', e);
                                    });
                                    enqueueTonyCommand({ type: '_WAIT_MODAL_READY' }, { source: 'post-open-terreno', delayMs: 1500 });
                                }
                            }
                            // Supporto fields: INJECT_FORM_DATA atomico per attivita/lavoro/magazzino (evita perdita compilazione)
                            if (data.fields && typeof data.fields === 'object' && Object.keys(data.fields).length > 0) {
                                var fieldsObj = data.fields;
                                if ((resolvedId === 'attivita-modal' || resolvedId === 'lavoro-modal' || resolvedId === 'prodotto-modal' || resolvedId === 'movimento-modal') && window.TonyFormInjector) {
                                    var formId = resolvedId === 'attivita-modal' ? 'attivita-form' : resolvedId === 'lavoro-modal' ? 'lavoro-form' : resolvedId === 'prodotto-modal' ? 'prodotto-form' : 'movimento-form';
                                    var delayMag = (resolvedId === 'prodotto-modal' || resolvedId === 'movimento-modal') ? 1200 : 1800;
                                    enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: formId, formData: fieldsObj }, { source: 'open-modal-fields', delayMs: delayMag });
                                } else {
                                    var formMap = (typeof TONY_FORM_MAPPING !== 'undefined' && TONY_FORM_MAPPING.getFormMap) ? TONY_FORM_MAPPING.getFormMap(resolvedId) : null;
                                    var fieldOrder = (formMap && formMap.injectionOrder) ? formMap.injectionOrder : (resolvedId === 'terreno-modal' ? ['terreno-nome', 'terreno-superficie', 'terreno-coltura-categoria', 'terreno-coltura', 'terreno-podere', 'terreno-tipo-possesso', 'terreno-data-scadenza-affitto', 'terreno-canone-affitto', 'terreno-note'] : Object.keys(fieldsObj));
                                    var idx = 0;
                                    for (var i = 0; i < fieldOrder.length; i++) {
                                        var fk = fieldOrder[i];
                                        if (fieldsObj[fk] != null && fieldsObj[fk] !== '') {
                                            enqueueTonyCommand({ type: 'SET_FIELD', field: fk, value: String(fieldsObj[fk]) }, { source: 'open-modal-fields', delayMs: 1600 + (idx * 250) });
                                            idx++;
                                        }
                                    }
                                }
                            }
                            // Magazzino: OPEN_MODAL senza campi compilabili → stessi timer del post-INJECT (Tony deve chiedere nome, ecc.)
                            var magOpenFields = data.fields && typeof data.fields === 'object' ? data.fields : null;
                            var hasMagazzinoOpenPayload = magOpenFields && Object.keys(magOpenFields).some(function(k) {
                                var vv = magOpenFields[k];
                                return vv != null && String(vv).trim() !== '';
                            });
                            if ((resolvedId === 'prodotto-modal' || resolvedId === 'movimento-modal') && !hasMagazzinoOpenPayload) {
                                var fidMagOpen = resolvedId === 'prodotto-modal' ? 'prodotto-form' : 'movimento-form';
                                var midMagOpen = resolvedId;
                                if (window.__tonyProactiveAskTimerId) clearTimeout(window.__tonyProactiveAskTimerId);
                                if (window.__tonyIdleReminderTimerId) { clearTimeout(window.__tonyIdleReminderTimerId); window.__tonyIdleReminderTimerId = null; }
                                window.__tonyProactiveAskTimerId = setTimeout(function() {
                                    window.__tonyProactiveAskTimerId = null;
                                    if (window.__tonyInjectionInProgress) return;
                                    var gcfMag = window.__tonyGetCurrentFormContext;
                                    var fcMagOpen = typeof gcfMag === 'function' ? gcfMag() : null;
                                    var mElMagOpen = document.getElementById(midMagOpen);
                                    if (!fcMagOpen || fcMagOpen.formId !== fidMagOpen || !mElMagOpen || !mElMagOpen.classList.contains('active')) return;
                                    var hasReqMagOpen = fcMagOpen.requiredEmpty && fcMagOpen.requiredEmpty.length > 0;
                                    var intMagOpen = (fcMagOpen.interviewEmpty && fcMagOpen.interviewEmpty.length) ? fcMagOpen.interviewEmpty : (typeof tonyGetMagazzinoInterviewEmpty === 'function' ? tonyGetMagazzinoInterviewEmpty(fcMagOpen, fidMagOpen) : []);
                                    var doneMagOpen = !hasReqMagOpen && intMagOpen.length === 0;
                                    window.__tonyProactiveFormState = { active: true, type: doneMagOpen ? 'ready_for_save' : 'missing_fields', formId: fidMagOpen, modalId: midMagOpen };
                                    window.__tonyIdleReminderTimerId = setTimeout(function() {
                                        window.__tonyIdleReminderTimerId = null;
                                        if (window.__tonyInjectionInProgress) return;
                                        var stMagOpen = window.__tonyProactiveFormState;
                                        if (!stMagOpen || !stMagOpen.active) return;
                                        var elMagOpen2 = document.getElementById(stMagOpen.modalId);
                                        if (!elMagOpen2 || !elMagOpen2.classList.contains('active')) { window.__tonyProactiveFormState = null; return; }
                                        var gcfMag2 = window.__tonyGetCurrentFormContext;
                                        var fcMag2 = typeof gcfMag2 === 'function' ? gcfMag2() : null;
                                        var reqMag2 = fcMag2 && fcMag2.requiredEmpty && fcMag2.requiredEmpty.length ? fcMag2.requiredEmpty : [];
                                        var intMag2 = fcMag2 && fcMag2.interviewEmpty && fcMag2.interviewEmpty.length ? fcMag2.interviewEmpty : (fcMag2 && typeof tonyGetMagazzinoInterviewEmpty === 'function' ? tonyGetMagazzinoInterviewEmpty(fcMag2, fidMagOpen) : []);
                                        if (stMagOpen.type === 'ready_for_save' && typeof window.__tonyTriggerAskForSaveConfirmation === 'function') {
                                            window.__tonyTriggerAskForSaveConfirmation();
                                        } else if (stMagOpen.type === 'missing_fields' && typeof window.__tonyTriggerAskForMissingFields === 'function') {
                                            var prefMag = fidMagOpen === 'prodotto-form' ? 'Form prodotto: ' : 'Form movimento: ';
                                            var msgMagOpen = reqMag2.length
                                                ? (prefMag + 'obbligatori mancanti: ' + tonyMagazzinoInterviewLabels(fcMag2, reqMag2) + '.')
                                                : (intMag2.length ? (prefMag + (fidMagOpen === 'prodotto-form' ? 'indica ancora ' : 'opzionali: ') + tonyMagazzinoInterviewLabels(fcMag2, intMag2) + '.') : undefined);
                                            window.__tonyTriggerAskForMissingFields(msgMagOpen);
                                        }
                                        window.__tonyProactiveFormState = null;
                                    }, IDLE_REMINDER_MS);
                                }, POST_INJECT_CHECK_DELAY_MS);
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
                                'frutteto-modal': 'frutteti',
                                'preventivo-form': 'nuovo preventivo'
                            };
                            
                            var pageTarget = pageMap[resolvedId] || pageMap[modalId];
                            if (pageTarget && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                var pendingModalId = resolvedId;
                                var pendingTarget = pageTarget;
                                if (tonyOpenModalShouldRouteToPreventivo(data.fields) && (resolvedId === 'attivita-modal' || modalId === 'attivita-modal' || resolvedId === 'lavoro-modal' || modalId === 'lavoro-modal')) {
                                    pendingModalId = 'preventivo-form';
                                    pendingTarget = 'nuovo preventivo';
                                }
                                if (resolvedId === 'preventivo-form' || modalKey === 'preventivo-form' || modalKey === 'nuovo-preventivo') {
                                    pendingModalId = 'preventivo-form';
                                    pendingTarget = 'nuovo preventivo';
                                }
                                console.log('[Tony] Fallback: Modal non trovato, apro pagina:', pendingTarget);
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: pendingTarget,
                                    _tonyPendingModal: pendingModalId,
                                    _tonyPendingFields: (data.fields && typeof data.fields === 'object') ? data.fields : null
                                });
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
                        else if (fieldId.indexOf('prodotto-') === 0) targetModalId = 'prodotto-modal';
                        else if (fieldId.indexOf('mov-') === 0) targetModalId = 'movimento-modal';
                        
                        if (targetModalId) {
                            var modal = document.getElementById(targetModalId);
                            var isModalActive = modal && (modal.classList.contains('active') || modal.style.display === 'block' || (window.jQuery && window.jQuery(modal).is(':visible')));
                            
                            if (modal && !isModalActive) {
                                console.log('[Tony] Auto-opening modal ' + targetModalId + ' per campo ' + fieldId);
                                enqueueTonyCommand({ type: 'OPEN_MODAL', id: targetModalId }, { source: 'auto-open-modal' });
                                enqueueTonyCommand(data, { source: 'auto-retry-set-field', delayMs: 1000 });
                                return;
                            }
                            // Modal non esiste nel DOM (es. da Dashboard): naviga alla pagina e applica i campi (fallback cross-page)
                            if (!modal && targetModalId === 'attivita-modal' && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                var pendingFields = {};
                                if (fieldId && value != null) pendingFields[fieldId] = value;
                                console.log('[Tony] SET_FIELD su modal assente, navigo a Diario Attività con campi pendenti');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'attivita',
                                    _tonyPendingModal: 'attivita-modal',
                                    _tonyPendingFields: Object.keys(pendingFields).length > 0 ? pendingFields : null
                                });
                                return;
                            }
                            if (!modal && targetModalId === 'prodotto-modal' && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                var pendingFieldsP = {};
                                if (fieldId && value != null) pendingFieldsP[fieldId] = value;
                                console.log('[Tony] SET_FIELD su modal assente, navigo a Prodotti con campi pendenti');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'prodotti',
                                    _tonyPendingModal: 'prodotto-modal',
                                    _tonyPendingFields: Object.keys(pendingFieldsP).length > 0 ? pendingFieldsP : null
                                });
                                return;
                            }
                            if (!modal && targetModalId === 'movimento-modal' && window.Tony && typeof window.Tony.triggerAction === 'function') {
                                var pendingFieldsM = {};
                                if (fieldId && value != null) pendingFieldsM[fieldId] = value;
                                console.log('[Tony] SET_FIELD su modal assente, navigo a Movimenti con campi pendenti');
                                window.Tony.triggerAction('APRI_PAGINA', {
                                    target: 'movimenti',
                                    _tonyPendingModal: 'movimento-modal',
                                    _tonyPendingFields: Object.keys(pendingFieldsM).length > 0 ? pendingFieldsM : null
                                });
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
                                if (fieldId.indexOf('prodotto-') === 0 || fieldId.indexOf('mov-') === 0) {
                                    scheduleTonyMagazzinoProactiveAfterSetField();
                                }
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
                    var preventivoFormEl = document.getElementById('preventivo-form');
                    var saveValidation = null;
                    if (preventivoFormEl) {
                        saveValidation = tonyCheckFormCompletenessSafe();
                    } else if (window.SmartFormFiller) {
                        try {
                            saveValidation = new SmartFormFiller().validateBeforeSave();
                        } catch (validationError) {
                            console.warn('[Tony] Save guard SmartFormFiller non disponibile, fallback al controllo widget:', validationError);
                        }
                    }

                    if (!saveValidation) {
                        saveValidation = tonyCheckFormCompletenessSafe();
                    }

                    if (!saveValidation.isComplete) {
                        console.error('[Tony] SAVE_ACTIVITY BLOCCATO: Campi obbligatori mancanti o form non pronto:', saveValidation.missingFields);
                        var isModalClosed = (saveValidation.missingFields || []).some(function(m) { return String(m).indexOf('Nessun modal') >= 0 || String(m).indexOf('Form context') >= 0; });
                        if (isModalClosed && !preventivoFormEl) {
                            var path = (window.location.pathname || '').toLowerCase();
                            var isLavoriPage = path.indexOf('lavori') >= 0 || path.indexOf('gestione-lavori') >= 0;
                            var confirmMsg = 'Attività salvata!';
                            if (isLavoriPage) confirmMsg = 'Lavoro salvato!';
                            else if (path.indexOf('prodotti') >= 0) confirmMsg = 'Prodotto salvato!';
                            else if (path.indexOf('movimenti') >= 0) confirmMsg = 'Movimento registrato!';
                            showMessageInChat(confirmMsg, 'tony');
                        } else {
                            showMessageInChat('Attenzione: non posso salvare perché ci sono campi obbligatori vuoti o non pronti: ' + saveValidation.missingFields.join(', '), 'error');
                        }
                        return;
                    }

                    // Cerca il bottone di salvataggio nel form attivo
                    var saveBtn = null;
                    if (preventivoFormEl) {
                        saveBtn = preventivoFormEl.querySelector('button[type="submit"]');
                    }
                    if (!saveBtn) saveBtn = document.querySelector('.modal.active button[type="submit"], .modal.active .btn-primary, .modal.show button[type="submit"]');
                    // Fallback specifico per moduli noti
                    if (!saveBtn) saveBtn = document.getElementById('attivita-form');
                    if (!saveBtn) saveBtn = document.getElementById('ora-form');
                    if (!saveBtn) saveBtn = document.getElementById('lavoro-form');
                    
                    if (saveBtn) {
                        console.log('[Tony] SAVE_ACTIVITY: Clicco bottone salvataggio', saveBtn);
                        saveBtn.click();
                        // Rimuovi eventuali SAVE_ACTIVITY duplicati dalla coda (evita doppio salvataggio)
                        _tonyCommandQueue = _tonyCommandQueue.filter(function(e) { return e.command.type !== 'SAVE_ACTIVITY'; });
                    } else {
                        console.error('[Tony] SAVE_ACTIVITY: Bottone salvataggio non trovato');
                        showMessageInChat('Non trovo il tasto per salvare. Prova a cliccarlo tu.', 'tony');
                    }
                    break;

                case 'CLICK_BUTTON':
                    var btnId = data.id || data.target;
                    if (btnId) {
                        // BLOCCO DI SICUREZZA: Verifica campi required prima di salvare
                        var completeness = tonyCheckFormCompletenessSafe();
                        
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

                case 'PREVENTIVO_LIST_ACTION':
                    (function () {
                        var p = data.params || data;
                        var pathPrev = (window.location.pathname || '').toLowerCase();
                        var onPrev = pathPrev.indexOf('preventivi') !== -1;
                        function notifyRes(res) {
                            if (!res || !res.message) return;
                            if (typeof window.appendMessage === 'function') {
                                window.appendMessage(res.message, res.ok ? 'tony' : 'error');
                            }
                        }
                        function run() {
                            if (typeof window.tonyPreventivoListAction !== 'function') {
                                showMessageInChat('Apri la pagina Gestione preventivi per inviare o accettare un preventivo.', 'error');
                                return;
                            }
                            window.tonyPreventivoListAction(p).then(function (res) {
                                notifyRes(res);
                            }).catch(function (e) {
                                showMessageInChat((e && e.message) ? e.message : 'Errore durante l\'azione sul preventivo.', 'error');
                            });
                        }
                        if (onPrev) {
                            run();
                            return;
                        }
                        try {
                            sessionStorage.setItem('tony_pending_preventivi_action', JSON.stringify(p));
                        } catch (e) {}
                        var urlP = getUrlForTarget('preventivi');
                        if (!urlP) {
                            showMessageInChat('Non trovo la pagina Gestione preventivi.', 'error');
                            return;
                        }
                        var labP = TONY_LABEL_MAP.preventivi || 'Gestione preventivi';
                        window.showTonyConfirmDialog('Aprire "' + labP + '" per eseguire l\'invio o l\'accettazione?').then(function (ok) {
                            if (ok) {
                                window.location.href = urlP + (urlP.indexOf('?') >= 0 ? '&' : '?') + 'tnyNotify=' + encodeURIComponent('preventivi');
                            } else {
                                try {
                                    sessionStorage.removeItem('tony_pending_preventivi_action');
                                } catch (e2) {}
                            }
                        });
                    })();
                    break;

                case 'APRI_PAGINA':
                    console.log('[DEBUG CURSOR] processTonyCommand: Caso APRI_PAGINA');
                    var target = (data.target || (data.params && data.params.target) || '').toString().trim();
                    console.log('[DEBUG CURSOR] processTonyCommand: Target per APRI_PAGINA:', target);
                    if (target) {
                        var resolved = resolveTarget(target) || target;
                        var url = getUrlForTarget(target);
                        if (url) {
                            var label = TONY_LABEL_MAP[resolved] || resolved;
                            var urlWithNotify = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'tnyNotify=' + encodeURIComponent(resolved);
                            console.log('[DEBUG CURSOR] processTonyCommand: URL trovato per', target, '→', urlWithNotify);
                            window.showTonyConfirmDialog('Aprire la pagina "' + label + '"?').then(function(ok) {
                                if (ok) {
                                    _tonyCommandQueue.length = 0;
                                    console.log('[DEBUG CURSOR] processTonyCommand: Navigazione confermata, target:', resolved);
                                    var apParams = (data.params && typeof data.params === 'object') ? Object.assign({}, data, data.params) : data;
                                    var pendingModalPc = apParams._tonyPendingModal;
                                    var pendingFieldsPc = apParams._tonyPendingFields || apParams.fields;
                                    var rawTPc = (target || '').toLowerCase();
                                    if (!pendingModalPc && pendingFieldsPc && typeof pendingFieldsPc === 'object' && Object.keys(pendingFieldsPc).length > 0) {
                                        if (rawTPc.indexOf('nuovo') >= 0 && rawTPc.indexOf('preventivo') >= 0) pendingModalPc = 'preventivo-form';
                                    }
                                    if (!pendingModalPc && rawTPc.indexOf('nuovo') >= 0 && rawTPc.indexOf('preventivo') >= 0) {
                                        pendingModalPc = 'preventivo-form';
                                    }
                                    if (pendingModalPc && target) {
                                        try {
                                            var rawTNavPc = (target || '').toLowerCase();
                                            var isNuovoPrevNavPc = pendingModalPc === 'preventivo-form' || (rawTNavPc.indexOf('nuovo') >= 0 && rawTNavPc.indexOf('preventivo') >= 0);
                                            var userPromptForPendingPc = isNuovoPrevNavPc ? tonyGetUserPromptForPendingNav() : '';
                                            sessionStorage.setItem('tony_pending_intent', JSON.stringify({
                                                target: target,
                                                modalId: pendingModalPc,
                                                fields: (pendingFieldsPc && typeof pendingFieldsPc === 'object') ? pendingFieldsPc : null,
                                                userPromptForPending: userPromptForPendingPc || null
                                            }));
                                            console.log('[Tony] tony_pending_intent salvato (processTonyCommand):', pendingModalPc, target);
                                        } catch (e) { console.warn('[Tony] Impossibile salvare pending intent:', e); }
                                    }
                                    window.location.hash = '#' + resolved;
                                    try {
                                        window.dispatchEvent(new CustomEvent('tony-navigate', { detail: { target: resolved, hash: '#' + resolved, url: urlWithNotify } }));
                                    } catch (e) {}
                                    window.location.href = urlWithNotify;
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

                case 'SHOW_TABLE':
                    console.log('[Tony] SHOW_TABLE: già sulla pagina lista, tabella visibile.');
                    try {
                        var tableEl = document.querySelector('.prodotti-table, .movimenti-table, .mezzi-table, .guasti-table, .scadenze-table');
                        if (tableEl) {
                            tableEl.style.animation = 'none';
                            tableEl.offsetHeight;
                            tableEl.style.animation = 'tony-highlight 0.6s ease';
                        }
                    } catch (e) {}
                    break;

                case 'FILTER_TABLE':
                    (function() {
                        var params = data.params || {};
                        var pathStr = (window.location.pathname || '');
                        var pageType = (window.currentTableData && window.currentTableData.pageType) ||
                            (pathStr.indexOf('terreni-clienti') !== -1 ? 'terreniClienti' : pathStr.indexOf('clienti') !== -1 ? 'clienti' : pathStr.indexOf('preventivi') !== -1 ? 'preventivi' : pathStr.indexOf('tariffe') !== -1 ? 'tariffe' : pathStr.indexOf('prodotti') !== -1 ? 'prodotti' : pathStr.indexOf('movimenti') !== -1 ? 'movimenti' : pathStr.indexOf('attivita') !== -1 ? 'attivita' : (pathStr.indexOf('gestione-lavori') !== -1 || pathStr.indexOf('lavori') !== -1) ? 'lavori' : 'terreni');
                        var FILTER_KEY_MAP = {
                            attivita: { terreno: 'filter-terreno', tipoLavoro: 'filter-tipo-lavoro', coltura: 'filter-coltura', origine: 'filter-origine', dataDa: 'filter-data-da', dataA: 'filter-data-a', data: 'filter-data-da', ricerca: 'filter-ricerca' },
                            terreni: { podere: 'filter-podere', possesso: 'filter-tipo-possesso', alert: 'filter-alert', coltura: 'filter-coltura', categoria: 'filter-categoria' },
                            lavori: { stato: 'filter-stato', progresso: 'filter-progresso', caposquadra: 'filter-caposquadra', terreno: 'filter-terreno', tipo: 'filter-tipo', tipoLavoro: 'filter-tipo-lavoro', operaio: 'filter-operaio' },
                            clienti: { stato: 'filter-stato', ricerca: 'filter-search' },
                            preventivi: { stato: 'filter-stato', cliente: 'filter-cliente', categoriaLavoro: 'filter-categoria-lavoro', tipoLavoro: 'filter-tipo-lavoro', categoriaColtura: 'filter-categoria-coltura', ricerca: 'filter-search' },
                            terreniClienti: { cliente: 'filter-cliente' },
                            tariffe: { tipoLavoro: 'filter-tipo-lavoro', coltura: 'filter-coltura', tipoCampo: 'filter-tipo-campo', attiva: 'filter-attiva' },
                            prodotti: { attivo: 'filter-attivo', categoria: 'filter-categoria', ricerca: 'filter-search' },
                            movimenti: { tipo: 'filter-tipo', prodotto: 'filter-prodotto' }
                        };
                        var keyToId = FILTER_KEY_MAP[pageType] || FILTER_KEY_MAP.terreni;
                        var isAttivita = pageType === 'attivita';

                        /** Allinea testo libero / CF ai value reali di #filter-categoria (prodotti-standalone). */
                        function normalizeTonyProdottiCategoriaValue(raw) {
                            if (raw == null || raw === '') return raw;
                            var s = String(raw).toLowerCase().trim();
                            try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
                            var aliases = {
                                fertilizzante: 'fertilizzanti', fertilizzanti: 'fertilizzanti',
                                concime: 'fertilizzanti', concimi: 'fertilizzanti',
                                fitofarmaco: 'fitofarmaci', fitofarmaci: 'fitofarmaci',
                                pesticida: 'fitofarmaci', pesticidi: 'fitofarmaci',
                                'materiale impianto': 'materiale_impianto', materiale_impianto: 'materiale_impianto',
                                impianto: 'materiale_impianto', ricambi: 'ricambi', ricambio: 'ricambi',
                                sementi: 'sementi', seme: 'sementi', altro: 'altro'
                            };
                            if (aliases[s]) return aliases[s];
                            if (s.indexOf('fertil') >= 0 || s.indexOf('concim') >= 0) return 'fertilizzanti';
                            if (s.indexOf('fitofarm') >= 0 || s === 'fito' || s.indexOf('pestic') >= 0) return 'fitofarmaci';
                            if (s.indexOf('ricamb') >= 0) return 'ricambi';
                            if (s.indexOf('sement') >= 0 || /^sem[eie]/i.test(s)) return 'sementi';
                            if (s.indexOf('materiale') >= 0 && s.indexOf('impiant') >= 0) return 'materiale_impianto';
                            return raw;
                        }

                        function setFilterValue(el, value, matchByText) {
                            var valToSet = (value != null && value !== '') ? String(value) : '';
                            if (valToSet && el.options && el.options.length > 0) {
                                var normVal = valToSet.toLowerCase().trim();
                                var opt = Array.from(el.options).find(function(o) { return (o.value || '').toLowerCase() === normVal; });
                                if (!opt && matchByText) {
                                    opt = Array.from(el.options).find(function(o) { return (o.textContent || o.text || '').toLowerCase().trim() === normVal; });
                                }
                                if (!opt && matchByText && el.id === 'filter-categoria') {
                                    opt = Array.from(el.options).find(function(o) {
                                        if (!o.value) return false;
                                        var t = (o.textContent || o.text || '').toLowerCase();
                                        var v = (o.value || '').toLowerCase();
                                        return t.indexOf(normVal) >= 0 || v.indexOf(normVal) >= 0 || normVal.indexOf(v) >= 0;
                                    });
                                }
                                if (opt) valToSet = opt.value;
                            }
                            el.value = valToSet;
                            return valToSet;
                        }

                        if (params.filterType === 'reset' || params.reset === true) {
                            var resetSel = (pageType === 'attivita' || pageType === 'clienti' || pageType === 'preventivi' || pageType === 'tariffe' || pageType === 'terreniClienti' || pageType === 'prodotti' || pageType === 'movimenti') ? 'select[id^="filter-"], input[id^="filter-"]' : 'select[id^="filter-"]';
                            document.querySelectorAll(resetSel).forEach(function(el) {
                                el.value = '';
                                try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                // Pagine tipo prodotti: filter-search usa oninput, non onchange — serve anche input per aggiornare la lista.
                                if (el.tagName === 'INPUT') {
                                    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) {}
                                }
                            });
                            console.log('[Tony] FILTER_TABLE: tutti i filtri resettati (' + pageType + ')');
                            return;
                        }

                        var modified = [];
                        if (pageType === 'terreni' && params.categoria && params.categoria !== '') {
                            var catEl = document.getElementById('filter-categoria');
                            if (catEl) {
                                setFilterValue(catEl, params.categoria);
                                modified.push(catEl);
                                try { catEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                            }
                        }
                        for (var key in keyToId) {
                            if ((pageType === 'terreni' && key === 'categoria') || (key === 'data')) continue;
                            if (Object.prototype.hasOwnProperty.call(params, key) && params[key] != null && params[key] !== '') {
                                var realId = keyToId[key];
                                var el = document.getElementById(realId);
                                if (el && (el.tagName === 'SELECT' || 'value' in el)) {
                                    if (isAttivita && key === 'tipoLavoro' && params[key] === 'Vendemmia') {
                                        var hasOpt = Array.from(el.options).some(function(o) { return (o.value || '').toLowerCase() === 'vendemmia'; });
                                        if (!hasOpt) {
                                            var opt = document.createElement('option');
                                            opt.value = 'Vendemmia';
                                            opt.textContent = 'Vendemmia';
                                            el.appendChild(opt);
                                        }
                                    }
                                    var matchByText = (isAttivita && (key === 'terreno' || key === 'origine')) || (pageType === 'lavori' && (key === 'terreno' || key === 'caposquadra' || key === 'operaio' || key === 'tipoLavoro')) || (pageType === 'preventivi' && (key === 'cliente' || key === 'categoriaLavoro' || key === 'categoriaColtura')) || (pageType === 'terreniClienti' && key === 'cliente') || (pageType === 'movimenti' && key === 'prodotto') || (pageType === 'prodotti' && key === 'categoria');
                                    var paramVal = params[key];
                                    if (pageType === 'prodotti' && key === 'categoria' && realId === 'filter-categoria') {
                                        paramVal = normalizeTonyProdottiCategoriaValue(paramVal);
                                    }
                                    setFilterValue(el, paramVal, matchByText);
                                    modified.push(el);
                                }
                            }
                        }
                        if (params.data && params.data !== '' && pageType === 'attivita') {
                            var dataVal = String(params.data);
                            var daEl = document.getElementById('filter-data-da');
                            var aEl = document.getElementById('filter-data-a');
                            if (daEl) { daEl.value = dataVal; modified.push(daEl); }
                            if (aEl) { aEl.value = dataVal; modified.push(aEl); }
                        }
                        if (modified.length > 0) {
                            // Terreni: categoria è già gestita sopra con dispatch dedicato — evitare doppio change su #filter-categoria.
                            // Prodotti (e altre pagine con omonimo id): qui serve il change per aggiornare la lista (es. renderProdotti).
                            modified.filter(function(el) {
                                if (el.id === 'filter-categoria' && pageType === 'terreni') return false;
                                return true;
                            }).forEach(function(el) {
                                try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                if (el.tagName === 'INPUT') { try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) {} }
                            });
                            if (isAttivita && params.tipoLavoro) {
                                var sel = document.getElementById('filter-tipo-lavoro');
                                console.log('[Tony] FILTER_TABLE attivita tipoLavoro:', params.tipoLavoro, '-> select.value:', sel ? sel.value : 'N/A');
                            }
                            console.log('[Tony] FILTER_TABLE: applicati', modified.length, 'filtri (' + pageType + ')');
                        } else {
                            var filterType = (params.filterType || '').toString().toLowerCase();
                            var value = params.value;
                            if (filterType && (value != null && value !== '')) {
                                var realId = keyToId[filterType] || ('filter-' + filterType);
                                var el = document.getElementById(realId);
                                if (el && (el.tagName === 'SELECT' || 'value' in el)) {
                                    var matchByTextRetro = (pageType === 'attivita' && (filterType === 'terreno' || filterType === 'origine')) || (pageType === 'lavori' && (filterType === 'terreno' || filterType === 'caposquadra' || filterType === 'operaio' || filterType === 'tipoLavoro')) || (pageType === 'preventivi' && (filterType === 'cliente' || filterType === 'categoriaLavoro' || filterType === 'categoriaColtura')) || (pageType === 'terreniClienti' && filterType === 'cliente') || (pageType === 'movimenti' && (filterType === 'prodotto' || filterType === 'tipo')) || (pageType === 'prodotti' && filterType === 'categoria');
                                    var retroVal = value;
                                    if (pageType === 'prodotti' && filterType === 'categoria' && el.id === 'filter-categoria') {
                                        retroVal = normalizeTonyProdottiCategoriaValue(retroVal);
                                    }
                                    setFilterValue(el, retroVal, matchByTextRetro);
                                    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                    console.log('[Tony] FILTER_TABLE (retrocompat):', realId, '=', el.value);
                                } else {
                                    console.warn('[Tony] FILTER_TABLE: elemento non trovato per', filterType, '(ID:', realId + ')');
                                }
                            }
                        }
                    })();
                    break;

                case 'SUM_COLUMN':
                    (function() {
                        var params = data.params || {};
                        var keyToId = { podere: 'filter-podere', possesso: 'filter-tipo-possesso', alert: 'filter-alert', coltura: 'filter-coltura', categoria: 'filter-categoria' };
                        var column = (data.column || 'Ha').toString().trim() || 'Ha';
                        var messageTemplate = data.messageTemplate || 'Totale superficie: __TOTAL__ ettari';
                        var includeNeri = params.includeNeri === true || params.includeExpired === true || params.tuttoStorico === true;
                        var hasFilters = Object.keys(params).some(function(k) { return k !== 'includeNeri' && k !== 'includeExpired' && k !== 'tuttoStorico' && k !== 'resetFilters' && params[k] != null && params[k] !== ''; });
                        var doResetFilters = !hasFilters || params.resetFilters === true;
                        var filterIds = ['filter-podere', 'filter-categoria', 'filter-coltura', 'filter-tipo-possesso', 'filter-alert'];

                        function setFilterValue(el, value) {
                            var valToSet = (value != null && value !== '') ? String(value) : '';
                            if (valToSet && el.options && el.options.length > 0) {
                                var normVal = valToSet.toLowerCase().trim();
                                var opt = Array.from(el.options).find(function(o) { return (o.value || '').toLowerCase() === normVal; });
                                if (opt) valToSet = opt.value;
                            }
                            el.value = valToSet;
                            return valToSet;
                        }

                        function resetAllFilters() {
                            filterIds.forEach(function(id) {
                                var el = document.getElementById(id);
                                if (el && (el.tagName === 'SELECT' || 'value' in el)) {
                                    el.value = '';
                                    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                }
                            });
                            console.log('[Tony] SUM_COLUMN: filtri resettati per calcolo globale');
                        }

                        function applyFiltersFromParams() {
                            if (params.filterType === 'reset' || params.reset === true) return;
                            if (doResetFilters) return;
                            if (params.categoria && params.categoria !== '') {
                                var catEl = document.getElementById('filter-categoria');
                                if (catEl) { setFilterValue(catEl, params.categoria); try { catEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} }
                            }
                            for (var key in keyToId) {
                                if (key === 'categoria') continue;
                                if (Object.prototype.hasOwnProperty.call(params, key) && params[key] != null && params[key] !== '') {
                                    var realId = keyToId[key];
                                    var el = document.getElementById(realId);
                                    if (el && (el.tagName === 'SELECT' || 'value' in el)) {
                                        setFilterValue(el, params[key]);
                                        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                    }
                                }
                            }
                        }

                        function parseHaValue(str) {
                            if (str == null || str === '') return 0;
                            var s = String(str).replace(/\s/g, '').replace(',', '.');
                            var m = s.match(/(-?\d+(?:\.\d+)?)/);
                            return m ? parseFloat(m[1]) : 0;
                        }

                        function isItemNero(item) {
                            if ((item.tipoPossesso || '') !== 'affitto') return false;
                            if (item.statoContratto === 'Scaduto') return true;
                            var ds = item.dataScadenzaAffitto;
                            if (!ds) return false;
                            try {
                                var scad = new Date(ds);
                                return !isNaN(scad.getTime()) && scad < new Date();
                            } catch (e) { return false; }
                        }

                        function isRowNero(row) {
                            var possesso = row.querySelector('.col-possesso');
                            if (!possesso) return false;
                            return !!(possesso.querySelector('.alert-dot-grey') || possesso.querySelector('.alert-dot-black'));
                        }

                        function computeSumFromTable() {
                            var total = 0;
                            var rows = document.querySelectorAll('.terreno-row');
                            rows.forEach(function(row) {
                                if (!includeNeri && isRowNero(row)) return;
                                var haCell = row.querySelector('.col-ettari .terreno-ettari') || row.querySelector('.col-ettari');
                                if (haCell) {
                                    var txt = (haCell.textContent || haCell.innerText || '').trim();
                                    total += parseHaValue(txt);
                                }
                            });
                            return Math.round(total * 100) / 100;
                        }

                        function computeSumFromContext() {
                            var table = window.currentTableData;
                            if (!table || !Array.isArray(table.items)) return null;
                            var total = 0;
                            table.items.forEach(function(item) {
                                if (!includeNeri && isItemNero(item)) return;
                                var v = item.superficie;
                                if (v != null) total += parseFloat(String(v).replace(',', '.')) || 0;
                            });
                            return Math.round(total * 100) / 100;
                        }

                        if (doResetFilters) resetAllFilters();
                        else applyFiltersFromParams();

                        setTimeout(function() {
                            var total = computeSumFromContext();
                            if (total == null) total = computeSumFromTable();
                            var totalStr = (total != null && !isNaN(total)) ? total.toFixed(2).replace('.', ',') : '0,00';
                            var msg = messageTemplate.replace(/__TOTAL__/g, totalStr);
                            if (typeof showMessageInChat === 'function') showMessageInChat(msg, 'tony');
                            if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(msg);
                            console.log('[Tony] SUM_COLUMN: totale Ha =', total, 'msg=', msg);
                        }, 100);
                    })();
                    break;

                case 'RIASSUNTO':
                    try {
                        var briefing = window.tonyGlobalBriefing;
                        if (briefing && window.Tony && window.Tony.speak) {
                            var friendlyText = typeof formatFriendlyBriefing === 'function' ? formatFriendlyBriefing(briefing) : ('Abbiamo ' + (briefing.sottoScorta || 0) + ' prodotti sotto scorta, ' + (briefing.scadenzeUrgenti || 0) + ' scadenze nel parco macchine e ' + (briefing.guastiAperti || 0) + ' guasti da risolvere.');
                            window.Tony.speak(friendlyText);
                        }
                        var toHighlight = document.querySelectorAll('[data-tony-briefing]');
                        toHighlight.forEach(function(el) {
                            el.classList.add('tony-highlight');
                            setTimeout(function() { el.classList.remove('tony-highlight'); }, 5000);
                        });
                    } catch (e) { console.warn('[Tony] RIASSUNTO:', e); }
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

    var uiApi = injectWidget(scriptBase);
    var appendMessage = uiApi.appendMessage, removeTyping = uiApi.removeTyping, showMessageInChat = uiApi.showMessageInChat;
    var fab = document.getElementById('tony-fab');
    var panel = document.getElementById('tony-panel');
    var messagesEl = document.getElementById('tony-messages');
    var inputEl = document.getElementById('tony-input');
    var sendBtn = document.getElementById('tony-send');
    var closeBtn = document.getElementById('tony-close');

    if (sendBtn) {
        function nascondiJsonDaStreaming(testo) {
            var t = testo.replace(/\{[\s\S]*?\}/g, '');
            return t.replace(/\{[^}]*$/, '');
        }

        /**
         * Parser JSON ultra-robusto che estrae qualsiasi JSON da una stringa, anche mescolato con testo discorsivo.
         * Gestisce formati: { "text": "...", "command": {...} }, { "command": {...} }, { "type": "..." }, ecc.
         * Il testo restituito viene pulito da residui JSON (graffe, apici).
         * @param {string} str - Stringa che può contenere testo + JSON in qualsiasi formato
         * @returns {{ text: string, command: object|null }|null}
         */
        function parseRobustTonyResponse(str) {
            function clearQueueIfUnrepairable() {
                try { _tonyCommandQueue.length = 0; } catch (e) {}
            }
            function clean(t) { return cleanTextFromJsonResidue(t || ''); }
            if (!str || typeof str !== 'string') {
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: input non valido (non stringa o vuoto)');
                clearQueueIfUnrepairable();
                return null;
            }
            
            console.log('[DEBUG CURSOR] parseRobustTonyResponse: input ricevuto, lunghezza:', str.length);
            console.log('[DEBUG CURSOR] parseRobustTonyResponse: preview:', str.substring(0, 200) + (str.length > 200 ? '...' : ''));
            
            var jsonMatch = str.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Nessun JSON completo trovato, cerco JSON troncato...');
                var startIdx = str.indexOf('{');
                if (startIdx >= 0) {
                    var incompleteJson = str.substring(startIdx);
                    var openBraces = (incompleteJson.match(/\{/g) || []).length;
                    var closeBraces = (incompleteJson.match(/\}/g) || []).length;
                    var missingBraces = openBraces - closeBraces;
                    console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato JSON incompleto, parentesi aperte:', openBraces, 'chiuse:', closeBraces, 'mancanti:', missingBraces);
                    if (missingBraces > 0 && missingBraces <= 10) {
                        var completedJson = incompleteJson + '}'.repeat(missingBraces);
                        jsonMatch = [completedJson];
                        jsonMatch.index = startIdx;
                    }
                }
                if (!jsonMatch) {
                    var incompleteMatch = str.match(/\{[^{}]*["']?(?:text|command|type|action)["']?\s*:/);
                    if (incompleteMatch) {
                        startIdx = str.indexOf('{');
                        incompleteJson = str.substring(startIdx);
                        openBraces = (incompleteJson.match(/\{/g) || []).length;
                        closeBraces = (incompleteJson.match(/\}/g) || []).length;
                        missingBraces = openBraces - closeBraces;
                        if (missingBraces > 0 && missingBraces <= 10) {
                            completedJson = incompleteJson + '}'.repeat(missingBraces);
                            jsonMatch = [completedJson];
                            jsonMatch.index = startIdx;
                        }
                    }
                }
            }
            
            if (!jsonMatch) {
                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Nessun JSON trovato o non riparabile');
                clearQueueIfUnrepairable();
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
                        return { text: clean(text) || 'Ok.', command: parsed.command };
                    }
                    // Caso 1b: { "text": "...", "action": "...", "params": {...} } (formato alternativo)
                    if (parsed.action) {
                        var text = (parsed.text != null ? String(parsed.text).trim() : '') || '';
                        var actionCommand = {
                            type: parsed.action,
                            ...(parsed.params || {})
                        };
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+action. Text:', text, 'Action:', parsed.action, 'Params:', parsed.params);
                        return { text: clean(text) || 'Ok.', command: actionCommand };
                    }
                    // Caso 2: { "type": "OPEN_MODAL", ... } (comando standalone)
                    if (parsed.type && (parsed.type === 'OPEN_MODAL' || parsed.type === 'SET_FIELD' || parsed.type === 'CLICK_BUTTON' || parsed.type === 'APRI_PAGINA' || parsed.type === 'SAVE_ACTIVITY')) {
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato comando standalone:', parsed);
                        var textBefore = str.substring(0, jsonMatch.index).trim();
                        return { text: clean(textBefore) || 'Ok.', command: parsed };
                    }
                    // Caso 2b: { "action": "APRI_PAGINA", "params": {...} } (formato alternativo standalone)
                    if (parsed.action && !parsed.text) {
                        var textBefore = str.substring(0, jsonMatch.index).trim();
                        var actionCommand = {
                            type: parsed.action,
                            ...(parsed.params || {})
                        };
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato action standalone:', parsed.action, 'Params:', parsed.params);
                        return { text: clean(textBefore) || 'Ok.', command: actionCommand };
                    }
                    // Caso 3: Solo { "text": "..." } senza command
                    if (parsed.text != null) {
                        console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato solo text, nessun command');
                        return { text: clean(String(parsed.text).trim()) || 'Ok.', command: null };
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
                                return { text: clean(textCompleted) || 'Ok.', command: parsedCompleted.command };
                            }
                            if (parsedCompleted.action) {
                                var textCompleted = (parsedCompleted.text != null ? String(parsedCompleted.text).trim() : '') || '';
                                var actionCommand = {
                                    type: parsedCompleted.action,
                                    ...(parsedCompleted.params || {})
                                };
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+action dopo completamento');
                                return { text: clean(textCompleted) || 'Ok.', command: actionCommand };
                            }
                            if (parsedCompleted.type && (parsedCompleted.type === 'OPEN_MODAL' || parsedCompleted.type === 'SET_FIELD' || parsedCompleted.type === 'CLICK_BUTTON' || parsedCompleted.type === 'APRI_PAGINA' || parsedCompleted.type === 'SAVE_ACTIVITY')) {
                                var textBeforeCompleted = str.substring(0, jsonMatch.index).trim();
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato comando standalone dopo completamento');
                                return { text: clean(textBeforeCompleted) || 'Ok.', command: parsedCompleted };
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
                                return { text: clean(textTrimmed) || 'Ok.', command: parsedTrimmed.command };
                            }
                            if (parsedTrimmed.action) {
                                var textTrimmed = (parsedTrimmed.text != null ? String(parsedTrimmed.text).trim() : '') || '';
                                var actionCommand = {
                                    type: parsedTrimmed.action,
                                    ...(parsedTrimmed.params || {})
                                };
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato formato text+action dopo trimming');
                                return { text: clean(textTrimmed) || 'Ok.', command: actionCommand };
                            }
                            if (parsedTrimmed.type && (parsedTrimmed.type === 'OPEN_MODAL' || parsedTrimmed.type === 'SET_FIELD' || parsedTrimmed.type === 'CLICK_BUTTON' || parsedTrimmed.type === 'APRI_PAGINA' || parsedTrimmed.type === 'SAVE_ACTIVITY')) {
                                var textBeforeTrimmed = str.substring(0, jsonMatch.index).trim();
                                console.log('[DEBUG CURSOR] parseRobustTonyResponse: Trovato comando standalone dopo trimming');
                                return { text: clean(textBeforeTrimmed) || 'Ok.', command: parsedTrimmed };
                            }
                        }
                    } catch (_) {
                        // Continua il loop
                    }
                }
                
                console.error('[DEBUG CURSOR] parseRobustTonyResponse: Impossibile parsare JSON dopo', tries, 'tentativi di trimming');
            }
            
            console.log('[DEBUG CURSOR] parseRobustTonyResponse: Nessun formato riconosciuto, ritorno null e svuoto coda');
            clearQueueIfUnrepairable();
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
                return { isComplete: false, missingFields: ['Nessun modal attivo'] };
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

        try {
            window.__tonyCheckFormCompleteness = checkFormCompleteness;
        } catch (e) {}

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
            var placeholderPatterns = /^(seleziona|--\s*seleziona|--\s*nessun|--\s*nessuna|--\s*nessun[oa]\s|scegli\.\.\.|select\.\.\.)/i;
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
                // lavoro-sottocategoria: stesso caso (placeholder "-- Nessuna sottocategoria --" con value vuoto = non scelto)
                var isLavoroSottocategoriaPlaceholder = (f.id === 'lavoro-sottocategoria' && (!val || val === '') && (displayVal === '-- Nessuna sottocategoria --' || !displayVal));
                // attivita-pause con valore 0 = default, non ancora chiesto all'utente
                var isPauseDefault = (f.id === 'attivita-pause' && (val === '0' || val === 0 || String(val).trim() === '0'));
                // SELECT con placeholder: "-- Nessuna --", "Seleziona...", ecc. non considerare compilato
                var isSelectPlaceholder = (/^select/.test(f.type || '')) && (!val || val === '') && displayVal && placeholderPatterns.test(displayVal);
                if (displayVal && displayVal !== '(vuoto)' && displayVal !== '(compilato)' && !isSottocategoriaPlaceholder && !isLavoroSottocategoriaPlaceholder && !isPauseDefault && !isSelectPlaceholder) {
                    line += ' ✓';
                }
                lines.push(line);
            }
            return lines.join('\n');
        }

        /**
         * Costruisce contesto form Tony da un elemento form e un root per query label/contains (modal o lo stesso form).
         */
        function buildTonyFormContext(form, scopeRoot, modalIdForContext, logLabel) {
            if (!form || !form.id || !scopeRoot) return null;
            var fields = [];
            var fieldTags = ['INPUT', 'SELECT', 'TEXTAREA'];
            var elements = form.querySelectorAll(fieldTags.join(','));
            for (var i = 0; i < elements.length; i++) {
                var el = elements[i];
                if (!el.id) continue;
                if (el.type === 'hidden' || el.disabled) continue;
                if (!scopeRoot.contains(el)) continue;
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
                var labelEl = scopeRoot.querySelector('label[for="' + CSS.escape(el.id) + '"]');
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
                var isRelevant = (form.id === 'preventivo-form') || !!label || /^(attivita|lavoro|ora|terreno|vigneto|frutteto|cliente|prodotto|movimento|macchina)-/.test(el.id) || el.id === 'lavoro-id';
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
                fields.push(fieldInfo);
            }
            var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
            var formSummary = generateFormSummary(fields);
            var requiredEmpty = fields.filter(function(f) { return f.required && (!f.value || f.value === ''); }).map(function(f) { return f.id; });
            var interviewEmpty = [];
            if ((form.id === 'prodotto-form' || form.id === 'movimento-form') && typeof tonyGetMagazzinoInterviewEmpty === 'function') {
                interviewEmpty = tonyGetMagazzinoInterviewEmpty({ formId: form.id, fields: fields }, form.id);
            }
            var context = {
                formId: form.id,
                modalId: modalIdForContext || '',
                fields: fields,
                formSummary: formSummary,
                requiredEmpty: requiredEmpty,
                interviewEmpty: interviewEmpty,
                submitId: submitBtn ? submitBtn.id || form.id : form.id
            };
            return context;
        }

        /** Esposto per timer/async fuori dal blocco sendBtn (es. runProactiveCheckPreventivo dopo INJECT). */
        window.__tonyBuildTonyFormContext = buildTonyFormContext;

        function getCurrentFormContext() {
            var preventivoFormEl = document.getElementById('preventivo-form');
            // Un solo preventivo-form nel progetto (nuovo-preventivo-standalone): niente dipendenza da pathname/rewrite.
            if (preventivoFormEl) {
                return buildTonyFormContext(preventivoFormEl, preventivoFormEl, '', 'pagina Nuovo Preventivo');
            }
            var modal = document.querySelector('.modal.active');
            if (!modal) {
                return null;
            }
            var modalStyle = window.getComputedStyle(modal);
            if (modalStyle.display === 'none' || modalStyle.visibility === 'hidden') {
                return null;
            }
            var form = modal.querySelector('form');
            if (!form || !form.id) {
                return null;
            }
            return buildTonyFormContext(form, modal, modal.id || '', 'modal attivo');
        }

        /** Usare da `processTonyCommand` (scope esterno a questo blocco) per contesto form dopo inject/open modal. */
        window.__tonyGetCurrentFormContext = getCurrentFormContext;

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
        var AUTO_MODE_SILENCE_MS = 30000; // 30 secondi (inattività prima di spegnere microfono)
        var TONY_SESSION_MAX_AGE_MS = 600000;

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
                var moduli = window.Tony && window.Tony.context && (window.Tony.context.dashboard && window.Tony.context.dashboard.moduli_attivi || window.Tony.context.moduli_attivi);
                if (Array.isArray(moduli) && moduli.length > 0) {
                    sessionStorage.setItem(TONY_MODULI_STORAGE_KEY, JSON.stringify(moduli));
                }
            } catch (e) { console.warn('[Tony] saveTonyState:', e); }
        }

        function restoreTonyState() {
            try {
                var savedModuli = sessionStorage.getItem(TONY_MODULI_STORAGE_KEY);
                if (savedModuli && window.Tony && typeof window.Tony.setContext === 'function') {
                    try {
                        var moduli = JSON.parse(savedModuli);
                        if (Array.isArray(moduli) && moduli.length > 0) {
                            window.Tony.setContext('dashboard', { info_azienda: { moduli_attivi: moduli }, moduli_attivi: moduli });
                            try { window.dispatchEvent(new CustomEvent('tony-module-updated', { detail: { modules: moduli } })); } catch (ev) {}
                        }
                    } catch (e) {}
                }
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
                        if (!txt) continue;
                        var role = m.role === 'user' ? 'user' : 'tony';
                        appendMessage(txt, role);
                    }
                }

                if (state.isAutoMode) {
                    console.log('[Tony] Ripristino sessione vocale attiva...');
                    isAutoMode = true;
                    panel.classList.add('is-auto-mode');
                    if (state.lastPath !== window.location.pathname) {
                        var skipRestoreGreeting = (window.location.search || '').indexOf('tnyNotify=') >= 0;
                        if (!skipRestoreGreeting) {
                            var pageTitle = (document.title || '').replace(/^GFV Platform\s*[-–]\s*/i, '').trim() || 'questa sezione';
                            setTimeout(function() {
                                speakWithTTS('Eccoci qui nella sezione ' + pageTitle + '. Come posso aiutarti ora?', { fromVoice: true });
                            }, 1500);
                        }
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

        var voiceApi = initTonyVoice({
            onPlayEnd: function(opts) { if (opts && opts.isClosingSession) toggleAutoMode(false); else reopenMicIfAutoMode(); },
            onPlayStart: function() { if (autoModeTimeout) { clearTimeout(autoModeTimeout); autoModeTimeout = null; } }
        });
        var speakWithTTS = voiceApi.speakWithTTS;

        function getFriendlyGreeting() {
            var greetings = [
                'Ehilà!',
                'Buongiorno! Tutto bene?',
                'Ciao! Facciamo il punto?',
                'Salve! Come va?',
                'Ehi! Pronto a dare un\'occhiata?'
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        function formatFriendlyBriefing(data) {
            if (!data) return 'Non ho dati aggiornati al momento.';
            var s = data.sottoScorta || 0, y = data.scadenzeUrgenti || 0, z = data.guastiAperti || 0;
            if (s === 0 && y === 0 && z === 0) return 'Siamo in una botte di ferro, non vedo criticità.';
            var parts = [];
            if (z > 0) parts.push('C\'è qualche guasto di troppo da sistemare' + (z > 1 ? ' (' + z + ')' : ''));
            if (y > 0) parts.push('Occhio alle scadenze dei mezzi' + (y > 1 ? ' (' + y + ')' : ''));
            if (s > 0) parts.push(s === 1 ? 'un prodotto sotto scorta' : s + ' prodotti sotto scorta');
            return parts.join('. ') + '.';
        }
        window.getFriendlyGreeting = getFriendlyGreeting;
        window.formatFriendlyBriefing = formatFriendlyBriefing;
        window.__tonySayGreeting = function(t) { speakWithTTS(t || getFriendlyGreeting(), {}); };

        function sendMessage(overrideText, opts) {
            opts = opts || {};
            if (_isSendingMessage) {
                console.warn('[Tony] sendMessage ignorato: richiesta già in corso (anti-flood).');
                return;
            }
            if (window.__tonyProactiveAskTimerId) {
                clearTimeout(window.__tonyProactiveAskTimerId);
                window.__tonyProactiveAskTimerId = null;
            }
            if (window.__tonyIdleReminderTimerId) {
                clearTimeout(window.__tonyIdleReminderTimerId);
                window.__tonyIdleReminderTimerId = null;
            }
            if (window.__tonyProactiveFormState) window.__tonyProactiveFormState = null;
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
            if (!opts.proactive) {
                inputEl.value = '';
                appendMessage(text, 'user');
            }
            saveTonyState();

            function shouldForceLavoroStructuredReply(userText) {
                if (!userText) return false;
                var p = (window.location && window.location.pathname ? String(window.location.pathname).toLowerCase() : '');
                var onGestioneLavori = p.indexOf('gestione-lavori') >= 0;
                if (!onGestioneLavori) return false;
                var t = String(userText).toLowerCase();
                var hasCreateIntent = /crea\s+un?\s+lavor|nuovo\s+lavor|pianifica\s+lavor|assegna\s+lavor/.test(t);
                var hasWorkKeywords = /trattament|potatur|trinciatur|fresatur|erpicatur|concimaz|raccolt|vendemmi/.test(t);
                return hasCreateIntent || hasWorkKeywords;
            }

            function buildForcedLavoroPrompt(userText) {
                var extra = '\n\n[ISTRUZIONE CLIENT OBBLIGATORIA]\n' +
                    'Se la richiesta riguarda creazione/compilazione lavoro in Gestione Lavori, rispondi SOLO con comando strutturato, non testo libero.\n' +
                    'Output ammessi:\n' +
                    '1) OPEN_MODAL con id "lavoro-modal" e fields popolati, oppure\n' +
                    '2) INJECT_FORM_DATA con formId "lavoro-form" e formData popolato.\n' +
                    'Usa default trattamenti quando l\'utente dice solo "trattamento":\n' +
                    '- lavoro-categoria-principale = "Trattamenti"\n' +
                    '- lavoro-sottocategoria = "Meccanico"\n' +
                    '- lavoro-tipo-lavoro = "Trattamento Anticrittogamico Meccanico"\n' +
                    'Macchine: se l\'utente indica trattore e attrezzo (es. "con Agrifull e nebulizzatore"), includi nel primo formData le chiavi lavoro-trattore e lavoro-attrezzo (nome o id dal contesto parco macchine). ' +
                    'Nel campo "text" NON chiedere trattore o attrezzo se sono già nel messaggio utente; testo breve ok (es. conferma o salva).\n' +
                    'Non rispondere con sola domanda se i dati sono già presenti nel messaggio utente.[/ISTRUZIONE CLIENT OBBLIGATORIA]';
                return String(userText || '') + extra;
            }

            // Intercetta richiesta riassunto briefing (Dashboard)
            var textTrimmed = text.replace(/\s+/g, ' ').trim().toLowerCase();
            var riassuntoIntents = ['sì', 'si', 'ok', 'fammi il riassunto', 'dammi il riassunto', 'voglio il riassunto', 'dimmi il riassunto', 'riassunto'];
            var wantsRiassunto = riassuntoIntents.some(function(r) { return textTrimmed === r || textTrimmed.startsWith(r + ' ') || textTrimmed.endsWith(' ' + r); });
            if (wantsRiassunto && window.tonyGlobalBriefing && typeof processTonyCommand === 'function') {
                processTonyCommand({ type: 'RIASSUNTO' });
                var b = window.tonyGlobalBriefing;
                var reply = typeof formatFriendlyBriefing === 'function' ? formatFriendlyBriefing(b) : ('Abbiamo ' + (b.sottoScorta || 0) + ' prodotti sotto scorta, ' + (b.scadenzeUrgenti || 0) + ' scadenze nel parco macchine e ' + (b.guastiAperti || 0) + ' guasti da risolvere.');
                appendMessage(reply, 'tony');
                if (opts.fromVoice) isWaitingForTonyResponse = false;
                return;
            }
            
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
                maxAttempts = maxAttempts || 10; // Max 1000ms (10 * 100ms) per dare tempo al modal di aprirsi
                
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
                    var maxMs = (maxAttempts || 10) * 100;
                    console.warn('[Tony Widget Sync] Timeout attesa modal (' + maxMs + 'ms), procedo con contesto corrente o globale');
                    var formCtx = getCurrentFormContext();
                    // Se formCtx è null, passa un oggetto vuoto invece di null per evitare errori
                    callback(formCtx || { fields: [] });
                }
            };
            
            // Funzione per inviare la richiesta con il contesto aggiornato. NON chiamare sendMessage dopo OPEN_MODAL/SET_FIELD.
            var sendRequestWithContext = function(formCtx) {
                if (_isSendingMessage) return;
                var ctx = window.Tony && window.Tony.context;
                var moduli = ctx && (ctx.dashboard && ctx.dashboard.moduli_attivi || ctx.moduli_attivi);
                var needRetry = !Array.isArray(moduli) || moduli.length === 0;
                if (needRetry) {
                    var discovered = getModuliFromDiscovery();
                    if (discovered && discovered.length && window.Tony && typeof window.Tony.setContext === 'function') {
                        window.Tony.setContext('dashboard', { info_azienda: { moduli_attivi: discovered }, moduli_attivi: discovered });
                        saveModuliToStorage(discovered);
                        if (typeof window.__tonyCheckModuleStatus === 'function') window.__tonyCheckModuleStatus(true);
                        _isSendingMessage = true;
                        setTimeout(function() { doActualSend(formCtx); }, 150);
                        return;
                    }
                }
                doActualSend(formCtx);
            };

            function doActualSend(formCtx) {
                if (_isSendingMessage) return;
                _isSendingMessage = true;
                if (window.Tony.setContext) {
                    window.Tony.setContext('form', formCtx || {});
                    var pagePath = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
                    var pageCtx = {
                        pagePath: pagePath,
                        availableTargets: Object.keys(TONY_PAGE_MAP || {}),
                        availableRoutes: (typeof window !== 'undefined' && window.__tonyAvailableRoutes) ? window.__tonyAvailableRoutes : []
                    };
                    // Lettura dinamica: leggere window.currentTableData (o top/frame) nel momento esatto in cui l'utente preme invio
                    var pathStr = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
                    var freshTable = null;
                    if (typeof window !== 'undefined') {
                        var w = window.currentTableData;
                        var t = (window.top && window.top !== window) ? window.top.currentTableData : null;
                        var buf = window.__tonyTableDataBuffer;
                        // Preferisci sempre la finestra CORRENTE se ha dati tabella (così su Clienti non si invia per sbaglio dati di un'altra pagina)
                        if (w && (w.pageType || w.summary != null || w.items !== undefined)) {
                            freshTable = w;
                        } else if (t && (t.pageType || t.summary != null || t.items !== undefined)) {
                            freshTable = t;
                        } else if (buf && (buf.pageType || buf.summary != null || buf.items !== undefined)) {
                            freshTable = buf;
                        } else if (window.currentTableData) {
                            freshTable = window.currentTableData;
                        }
                        if (!freshTable && window.frames && window.frames.length > 0) {
                            try {
                                for (var f = 0; f < window.frames.length; f++) {
                                    var fw = window.frames[f];
                                    try {
                                        if (fw.currentTableData && fw.location && String(fw.location.pathname || '').indexOf('macchine') >= 0) {
                                            freshTable = fw.currentTableData;
                                            break;
                                        }
                                    } catch (err) { }
                                }
                            } catch (e) { }
                        }
                        if (!freshTable && window.top !== window && window.top.currentTableData) {
                            freshTable = window.top.currentTableData;
                        }
                    }
                    pageCtx.tableDataSummary = (freshTable && freshTable.summary) ? String(freshTable.summary) : 'Dati non disponibili';
                    pageCtx.currentTableData = freshTable ? Object.assign({}, freshTable, {
                        items: (freshTable.items && Array.isArray(freshTable.items)) ? freshTable.items : (freshTable.items != null ? [].concat(freshTable.items) : [])
                    }) : null;
                    if (freshTable) {
                        console.log('[Tony] Contesto tabella inviato alla CF:', freshTable.pageType || '(no pageType)', (freshTable.items && freshTable.items.length) || 0, 'righe, summary:', (freshTable.summary || '').substring(0, 50));
                    }
                    if (pathStr.indexOf('terreni') !== -1 && freshTable && freshTable.items && Array.isArray(freshTable.items)) {
                        var _seenP = {}, _seenC = {};
                        var _poderi = [], _colture = [];
                        freshTable.items.forEach(function(it) {
                            if (it.podere && !_seenP[it.podere]) { _seenP[it.podere] = 1; _poderi.push(it.podere); }
                            if (it.coltura && !_seenC[it.coltura]) { _seenC[it.coltura] = 1; _colture.push(it.coltura); }
                        });
                        pageCtx.terreni = { poderi: _poderi, colture: _colture };
                    }
                    if (pathStr.indexOf('attivita') !== -1 && freshTable && freshTable.items && Array.isArray(freshTable.items)) {
                        var _seenT = {}, _seenL = {}, _seenCol = {};
                        var _terreni = [], _tipiLavoro = [], _colture = [];
                        freshTable.items.forEach(function(it) {
                            if (it.terreno && it.terreno !== '-' && !_seenT[it.terreno]) { _seenT[it.terreno] = 1; _terreni.push(it.terreno); }
                            if (it.tipoLavoro && it.tipoLavoro !== '-' && !_seenL[it.tipoLavoro]) { _seenL[it.tipoLavoro] = 1; _tipiLavoro.push(it.tipoLavoro); }
                            if (it.coltura && it.coltura !== '-' && !_seenCol[it.coltura]) { _seenCol[it.coltura] = 1; _colture.push(it.coltura); }
                        });
                        pageCtx.attivita = { terreni: _terreni, tipiLavoro: _tipiLavoro, colture: _colture };
                    }
                    window.Tony.setContext('page', pageCtx);
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
                
                var parsedData = {};
                try {
                    if (typeof rawData === 'object' && rawData !== null) {
                        var cmd = rawData.command && typeof rawData.command === 'object' ? rawData.command : null;
                        if (!cmd && rawData.action) {
                            cmd = { type: rawData.action, ...(rawData.params || {}) };
                        }
                        // Normalizza: la CF può restituire command: { action: 'APRI_PAGINA', params: { target } } senza .type
                        if (cmd && cmd.action && !cmd.type) {
                            cmd = { type: cmd.action, ...(cmd.params || {}), params: cmd.params };
                        }
                        parsedData = {
                            text: rawData.text != null ? String(rawData.text).trim() : '',
                            command: cmd
                        };
                        if (!parsedData.text && rawData.text == null) parsedData.text = 'Ok.';
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
                // Fallback: testo "salvata/salvato" senza command → SAVE_ACTIVITY se form completo. NON attivare su domande (es. "Quali orari hai fatto?").
                if (!commandToExecute && parsedData.text) {
                    var txt = (parsedData.text || '').toLowerCase();
                    var isQuestion = txt.indexOf('?') >= 0 || /^(quali|quante|quale|che|cosa|come|quando|dove)\s/i.test(txt);
                    if (!isQuestion && /salvat[ao](?:\s|!|\.|$)|confermato!|ok\s*salvo|perfetto\s*salvo|attività\s*salvata|prodotto\s*salvato|movimento\s*salvato/i.test(txt)) {
                        var formCtxFb = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                        var isCompleteForSave = formCtxFb && (!formCtxFb.requiredEmpty || formCtxFb.requiredEmpty.length === 0);
                        var isSaveableTonyForm = formCtxFb && (
                            formCtxFb.formId === 'attivita-form' || formCtxFb.modalId === 'attivita-modal' ||
                            formCtxFb.formId === 'prodotto-form' || formCtxFb.modalId === 'prodotto-modal' ||
                            formCtxFb.formId === 'movimento-form' || formCtxFb.modalId === 'movimento-modal'
                        );
                        if (isCompleteForSave && isSaveableTonyForm) {
                            var pathMagFb = (typeof window !== 'undefined' && window.location && window.location.pathname) ? String(window.location.pathname).toLowerCase() : '';
                            var magAnagraficaFb = (formCtxFb.formId === 'prodotto-form' || formCtxFb.formId === 'movimento-form') &&
                                (pathMagFb.indexOf('prodotti') >= 0 || pathMagFb.indexOf('movimenti') >= 0);
                            if (magAnagraficaFb) {
                                var lastUserMag = '';
                                try {
                                    lastUserMag = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('tony_last_user_message'))
                                        ? String(sessionStorage.getItem('tony_last_user_message')).trim() : '';
                                } catch (eLm) {}
                                var lastLooksOkSalva = lastUserMag && /\b(ok\s*salva|salva\s+il\s+prodotto|salva\s+il\s+movimento|conferma\s+salvataggio)\b/i.test(lastUserMag);
                                if (lastLooksOkSalva) {
                                    commandToExecute = { type: 'SAVE_ACTIVITY' };
                                    console.log('[Tony] Fallback SAVE magazzino: ultimo messaggio utente è conferma esplicita');
                                } else {
                                    console.log('[Tony] Fallback testo→SAVE disattivato su prodotti/movimenti: niente click Salva da solo testo modello');
                                }
                            } else {
                                commandToExecute = { type: 'SAVE_ACTIVITY' };
                                console.log('[Tony] Fallback: testo conferma salvataggio senza command → SAVE_ACTIVITY');
                            }
                        }
                    }
                }

                if (commandToExecute && String(commandToExecute.type).toUpperCase() === 'SAVE_ACTIVITY' && opts.proactive) {
                    var proactiveUserText = (text || '').trim();
                    if (/confermi\s+salvataggio/i.test(proactiveUserText) || /^form\s+completo,?\s*confermi/i.test(proactiveUserText)) {
                        console.log('[Tony] SAVE_ACTIVITY annullato: promemoria proattivo non è conferma utente');
                        commandToExecute = null;
                        parsedData.command = null;
                    }
                }
                
                if (commandToExecute && typeof commandToExecute === 'object' && commandToExecute.type) {
                    
                    // Bypass totale navigazione: APRI_PAGINA e apri_modulo ignorano COMPLETAMENTE isTonyAdvancedActive
                    var isNavOpenPage = (commandToExecute.type === 'APRI_PAGINA' || commandToExecute.type === 'apri_modulo');
                    var allowExecute = isNavOpenPage || isTonyAdvancedActive || (commandToExecute.type === 'OPEN_MODAL');
                    if (!allowExecute) {
                        console.warn('[Tony] Comando bloccato: modulo Tony Avanzato non attivo');
                        appendMessage('Questa funzionalità richiede il modulo Tony Avanzato. Attivalo dalla Dashboard per automatizzare operazioni.', 'tony');
                        parsedData.command = null;
                    } else {
                        // Gestisci APRI_PAGINA tramite onAction callback (come da service)
                        if (commandToExecute.type === 'APRI_PAGINA' || commandToExecute.type === 'apri_modulo') {
                            var target = (commandToExecute.params && commandToExecute.params.target) || 
                                        commandToExecute.target || 
                                        commandToExecute.modulo || 
                                        '';
                            // Evita doppia esecuzione: se siamo già su terreni e target è terreni, il service ha già gestito (guard -> FILTER_TABLE)
                            var _isOnTerreni = (typeof window !== 'undefined' && (
                                (window.location.pathname || '').indexOf('terreni') >= 0 ||
                                (window.currentTableData && window.currentTableData.pageType === 'terreni')
                            ));
                            if (_isOnTerreni && (target === 'terreni' || target === 'terreni-test-bootstrap')) {
                                console.log('[Tony] onComplete: APRI_PAGINA terreni già gestito dalla guard, skip');
                            } else if (window.Tony && typeof window.Tony.triggerAction === 'function') {
                                console.log('[DEBUG CURSOR] onComplete: Gestione APRI_PAGINA tramite onAction, target:', target);
                                if (target) {
                                    var navPayload = { target: target };
                                    var pOn = (commandToExecute.params && typeof commandToExecute.params === 'object') ? commandToExecute.params : {};
                                    if (pOn._tonyPendingModal || commandToExecute._tonyPendingModal) {
                                        navPayload._tonyPendingModal = pOn._tonyPendingModal || commandToExecute._tonyPendingModal;
                                    }
                                    if (pOn._tonyPendingFields || commandToExecute._tonyPendingFields) {
                                        navPayload._tonyPendingFields = pOn._tonyPendingFields || commandToExecute._tonyPendingFields;
                                    }
                                    var fldOn = pOn.fields || commandToExecute.fields;
                                    if (fldOn && typeof fldOn === 'object' && Object.keys(fldOn).length > 0) {
                                        navPayload._tonyPendingFields = navPayload._tonyPendingFields || fldOn;
                                    }
                                    window.Tony.triggerAction('APRI_PAGINA', navPayload);
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
                            
                            // Evita doppio enqueue: tony-service chiama triggerAction prima di restituire { text, command },
                            // quindi onAction callback ha già accodato. Non enqueueare di nuovo.
                            var responseFromService = (typeof rawData === 'object' && rawData && rawData.command);
                            var skipEnqueueForSumColumn = (commandToExecute.type === 'SUM_COLUMN');
                            if (responseFromService) {
                                // Comando già gestito da triggerAction -> onAction-callback
                            } else if (!skipEnqueueForSumColumn && typeof window.processTonyCommand === 'function') {
                                try {
                                    enqueueTonyCommand(commandToExecute, { source: 'response-direct' });
                                } catch (e) {
                                    console.error('[Tony] onComplete: ERRORE durante enqueue:', e);
                                }
                            } else if (!skipEnqueueForSumColumn && typeof processTonyCommand === 'function') {
                                try {
                                    enqueueTonyCommand(commandToExecute, { source: 'response-local' });
                                } catch (e) {
                                    console.error('[Tony] onComplete: ERRORE durante enqueue:', e);
                                }
                            } else if (!skipEnqueueForSumColumn) {
                                console.error('[Tony] ERRORE - processTonyCommand non disponibile');
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
                }
                
                var finalSpeech = parsedData.text || (typeof rawData === 'string' ? rawData : 'Ok');
                finalSpeech = (typeof cleanTextFromJsonResidue === 'function' ? cleanTextFromJsonResidue(finalSpeech) : (finalSpeech || 'Ok').trim()) || 'Ok';
                var cmdForSaveNorm = commandToExecute && commandToExecute.type ? String(commandToExecute.type).toUpperCase() : '';
                if (cmdForSaveNorm === 'SAVE_ACTIVITY' && finalSpeech && /attivit/i.test(finalSpeech)) {
                    var pathSave = (window.location.pathname || '').toLowerCase();
                    if (pathSave.indexOf('prodotti') >= 0) {
                        finalSpeech = finalSpeech.replace(/\battivit[àa]\s+salvat[ao][^.\n!?]*/gi, 'Prodotto salvato correttamente');
                    } else if (pathSave.indexOf('movimenti') >= 0) {
                        finalSpeech = finalSpeech.replace(/\battivit[àa]\s+salvat[ao][^.\n!?]*/gi, 'Movimento registrato correttamente');
                    }
                }
                var cmdForDisplay = parsedData.command || (typeof rawData === 'object' && rawData && rawData.command);
                var isSumColumnCmd = cmdForDisplay && cmdForDisplay.type === 'SUM_COLUMN';
                // Fallback: se il testo è JSON troncato (solo parentesi/virgole) e c'è un comando terreni, usa messaggio sensato
                if (finalSpeech && (finalSpeech.length < 4 || /^[\s{}\[\],":]+$/i.test(finalSpeech))) {
                    var isTerreniCmd = cmdForDisplay && ((cmdForDisplay.type === 'APRI_PAGINA' && (cmdForDisplay.target === 'terreni' || cmdForDisplay.params?.target === 'terreni')) || cmdForDisplay.type === 'FILTER_TABLE');
                    if (isTerreniCmd) finalSpeech = 'Ecco i terreni.';
                    else if (isSumColumnCmd) finalSpeech = '';
                    else finalSpeech = finalSpeech || 'Ok';
                }
                if (!opts.proactive) {
                    var pathGestLavSan = (window.location && window.location.pathname) ? String(window.location.pathname).toLowerCase() : '';
                    if (pathGestLavSan.indexOf('gestione-lavori') >= 0) {
                        finalSpeech = tonySanitizeLavoroMacchineQuestionInReply(finalSpeech, text);
                    }
                }
                function doDisplay(txt) {
                    var out = (txt != null && String(txt).trim()) ? String(txt).trim() : finalSpeech;
                    appendMessage(out, 'tony');
                    speakWithTTS(out, opts);
                }
                // SUM_COLUMN: silenzia testo intermedio; il risultato viene mostrato da processTonyCommand
                if (isSumColumnCmd) {
                } else {
                    var formCtxForInject = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                    var isAttivitaForm = formCtxForInject && (formCtxForInject.formId === 'attivita-form' || formCtxForInject.modalId === 'attivita-modal');
                    var isLavoroForm = formCtxForInject && (formCtxForInject.formId === 'lavoro-form' || formCtxForInject.modalId === 'lavoro-modal');
                    var shouldTryExtract = formCtxForInject && (isAttivitaForm || isLavoroForm) && !parsedData.command && finalSpeech.indexOf('```json') >= 0 && window.TonyFormInjector && window.TonyFormInjector.extractAndInjectFromResponse;
                    if (shouldTryExtract) {
                        if (isLavoroForm && window.Tony && typeof window.Tony.setContext === 'function') {
                            window.Tony.setContext('lavori', (window.Tony.context && window.Tony.context.lavori) || {});
                        }
                        window.TonyFormInjector.extractAndInjectFromResponse(finalSpeech, window.Tony ? window.Tony.context : {}, formCtxForInject).then(function(res) {
                            var toShow = res.injected ? res.cleanedText : finalSpeech;
                            if (!opts.proactive) {
                                var pathExtract = (window.location && window.location.pathname) ? String(window.location.pathname).toLowerCase() : '';
                                if (pathExtract.indexOf('gestione-lavori') >= 0) {
                                    toShow = tonySanitizeLavoroMacchineQuestionInReply(toShow, text);
                                }
                            }
                            doDisplay(toShow);
                        });
                    } else {
                        doDisplay(finalSpeech);
                    }
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

                var textForTony = text;
                if (!opts.proactive && shouldForceLavoroStructuredReply(text)) {
                    textForTony = buildForcedLavoroPrompt(text);
                }

                if (useStream) {
                    var streamingAccum = '';
                    window.Tony.askStream(textForTony, {
                        skipUserHistory: !!opts.proactive,
                        proactive: !!opts.proactive,
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
                    window.Tony.ask(textForTony, { skipUserHistory: !!opts.proactive, proactive: !!opts.proactive }).then(onComplete).catch(onError).finally(onFinally);
                }
            };
            
            // FIX CODA ESECUZIONE: Assicura che sendRequestWithContext venga sempre chiamata
            // Se rilevato intento di apertura modulo, attendi che il modal sia nel DOM
            if (hasOpenModalIntent) {
                console.log('[Tony Widget Sync] Intent apertura modulo rilevato, attendo che modal sia nel DOM (max 1000ms)');
                waitForModalAndGetContext(function(formCtx) {
                    console.log('[Tony Widget Sync] Contesto estratto dopo attesa modal:', formCtx ? JSON.stringify(formCtx, null, 2) : '{}');
                    // FIX CODA ESECUZIONE: Garantisce che formCtx non sia null
                    sendRequestWithContext(formCtx || { fields: [] });
                });
            } else if (hasKeyword) {
                // Keyword (potatura, erpicatura, ecc.): verifica subito se modal già aperto, altrimenti breve poll (300ms)
                // Il modal si apre solo dopo la risposta di Tony, quindi evitiamo attese lunghe inutili
                var formCtxNow = getCurrentFormContext();
                if (formCtxNow && formCtxNow.fields && formCtxNow.fields.length > 0) {
                    console.log('[Tony Widget Sync] Parola chiave: modal già aperto, invio contesto immediato');
                    sendRequestWithContext(formCtxNow);
                } else {
                    console.log('[Tony Widget Sync] Parola chiave: breve attesa modal (max 300ms)');
                    waitForModalAndGetContext(function(formCtx) {
                        sendRequestWithContext(formCtx || { fields: [] });
                    }, 3);
                }
            } else {
                // Nessuna keyword: usa contesto immediato
                var formCtx = getCurrentFormContext();
                // FIX CODA ESECUZIONE: Garantisce che formCtx non sia null
                sendRequestWithContext(formCtx || { fields: [] });
            }
        }

        if (uiApi && uiApi.setSendHandler) uiApi.setSendHandler(function() { sendMessage(); });
        window.__tonyTriggerAskForMissingFields = function(optionalMessage) {
            if (typeof sendMessage === 'function' && !_isSendingMessage) sendMessage(optionalMessage && String(optionalMessage).trim() ? optionalMessage : 'Form aperto con campi mancanti da compilare', { proactive: true });
        };
        window.__tonyTriggerAskForSaveConfirmation = function() {
            if (typeof sendMessage === 'function' && !_isSendingMessage) sendMessage('Form completo, confermi salvataggio?', { proactive: true });
        };
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

    var TONY_MODULI_STORAGE_KEY = 'tony_moduli_attivi';

    /**
     * Auto-discovery: recupera moduli_attivi da sessionStorage, window.userModules o window.tenantConfig/tenant.
     * Usato quando la pagina non ha chiamato syncTonyModules (es. prodotti-standalone, sottopagine moduli).
     * @returns {string[]|null} Array moduli o null se non trovato
     */
    function getModuliFromDiscovery() {
        try {
            // Dati impostati da standalone-bootstrap prima dell'iniezione del widget
            if (Array.isArray(window.__gfvModuliAttivi) && window.__gfvModuliAttivi.length > 0) return window.__gfvModuliAttivi;
        } catch (e) {}
        try {
            var fromStorage = sessionStorage.getItem(TONY_MODULI_STORAGE_KEY);
            if (fromStorage) {
                var parsed = JSON.parse(fromStorage);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {}
        try {
            if (Array.isArray(window.userModules) && window.userModules.length > 0) return window.userModules;
        } catch (e) {}
        try {
            var tc = window.tenantConfig || window.tenant;
            var mods = tc && (tc.modules || tc.moduli_attivi);
            if (Array.isArray(mods) && mods.length > 0) return mods;
        } catch (e) {}
        return null;
    }

    /**
     * Salva moduli in sessionStorage (persistenza tra navigazioni).
     */
    function saveModuliToStorage(arr) {
        try {
            if (Array.isArray(arr) && arr.length > 0) {
                sessionStorage.setItem(TONY_MODULI_STORAGE_KEY, JSON.stringify(arr));
            }
        } catch (e) {}
    }

    /**
     * Helper globale: sincronizza i moduli attivi con Tony. Richiamabile da qualsiasi pagina standalone
     * dopo il caricamento dati tenant. Se Tony non è ancora pronto, riprova automaticamente (fino a ~10s).
     * @param {string[]} modules - Array id moduli (es. ['frutteto','tony','vigneto'])
     * @param {{ retry?: boolean }} options - options.retry = false disabilita il retry
     */
    window.syncTonyModules = function(modules, options) {
        var arr = Array.isArray(modules) ? modules : [];
        console.log('[Tony Sync] Ricevuti moduli:', arr.length ? arr : '(vuoto)');
        // Controllo di sicurezza: non sovrascrivere il contesto esistente se arriva un array vuoto e Tony ha già moduli
        if (!arr.length) {
            try {
                var ctx = (window.Tony && window.Tony.context) || {};
                var existing = ctx.dashboard?.moduli_attivi || ctx.info_azienda?.moduli_attivi || ctx.moduli_attivi;
                if (Array.isArray(existing) && existing.length > 0) {
                    console.log('[Tony Sync] Array vuoto ignorato: contesto già popolato con', existing.length, 'moduli. Non sovrascrivo.');
                    return;
                }
            } catch (e) {}
        }
        var doRetry = options && options.retry === false ? false : true;
        var maxRetries = 25;
        var attempt = 0;
        function apply() {
            if (typeof window.setTonyContext === 'function') {
                window.setTonyContext({ moduli_attivi: arr });
                saveModuliToStorage(arr);
                return true;
            }
            if (window.Tony && typeof window.Tony.setContext === 'function') {
                window.Tony.setContext('dashboard', { info_azienda: { moduli_attivi: arr }, moduli_attivi: arr });
                saveModuliToStorage(arr);
                try { window.dispatchEvent(new CustomEvent('tony-module-updated', { detail: { modules: arr } })); } catch (e) {}
                return true;
            }
            return false;
        }
        if (apply()) return;
        if (!doRetry) return;
        var t = setInterval(function() {
            attempt++;
            if (apply() || attempt >= maxRetries) clearInterval(t);
        }, 400);
    };

    async function initTonyWhenReady() {
        var maxWaitMs = 15000;
        var interval = 250;
        var maxAttempts = Math.max(40, Math.ceil(maxWaitMs / interval));
        if (typeof window !== 'undefined' && !window.__firebaseReady) {
            try {
                await new Promise(function(resolve, reject) {
                    var t = setTimeout(function() { resolve(); }, Math.min(12000, maxWaitMs));
                    function onReady() {
                        clearTimeout(t);
                        if (typeof window !== 'undefined') {
                            window.removeEventListener('gfv-firebase-ready', onReady);
                        }
                        resolve();
                    }
                    if (typeof window !== 'undefined') {
                        window.addEventListener('gfv-firebase-ready', onReady);
                        if (window.__firebaseReady) { onReady(); return; }
                    }
                });
            } catch (e) { /* continue to poll */ }
        }
        for (var i = 0; i < maxAttempts; i++) {
            try {
                var firebaseService = await import('../../services/firebase-service.js');
                var app = null;
                if (firebaseService.getAppInstanceIfReady) {
                    app = firebaseService.getAppInstanceIfReady();
                } else if (firebaseService.getAppInstance) {
                    try { app = firebaseService.getAppInstance(); } catch (e) { app = null; }
                }
                if (app) {
                    var Tony = (await import('../../services/tony-service.js')).Tony;
                    window.Tony = Tony;
                    Tony.speak = function(text) { if (typeof window.__tonySayGreeting === 'function') window.__tonySayGreeting(text); };
                    await Tony.init(app);
                    Tony.setContext('session', {
                        current_page: {
                            path: window.location.pathname,
                            title: document.title,
                            timestamp: new Date().toISOString()
                        }
                    });
                    // Carica rotte disponibili per supporto evolutivo (nuove cartelle in modules/)
                    try {
                        var configUrl = (scriptBase ? new URL('../config/tony-routes.json', scriptBase).href : (window.location.pathname.replace(/\/[^/]*$/, '') + '/../config/tony-routes.json'));
                        var routesRes = await fetch(configUrl, { cache: 'no-store' });
                        if (routesRes.ok) {
                            var routesData = await routesRes.json();
                            window.__tonyAvailableRoutes = (routesData && routesData.routes) || [];
                            console.log('[Tony] Rotte disponibili caricate:', window.__tonyAvailableRoutes.length);
                        }
                    } catch (e) {
                        window.__tonyAvailableRoutes = [];
                    }
                    var _tonyWidgetInitTime = Date.now();
                    window.setTonyContext = function(payload) {
                        if (!window.Tony || typeof window.Tony.setContext !== 'function') return;
                        var d = (window.Tony.context && window.Tony.context.dashboard) || {};
                        window.Tony.setContext('dashboard', Object.assign({}, d, payload));
                        if (payload && payload.moduli_attivi) {
                            saveModuliToStorage(payload.moduli_attivi);
                            try { window.dispatchEvent(new CustomEvent('tony-module-updated', { detail: { modules: payload.moduli_attivi } })); } catch (err) {}
                        }
                    };
                    // syncTonyModules è definito a livello script (sopra) per essere disponibile prima dell'init di Tony
                    // Recupera stato modulo Tony dal context o dal database
                    var lastStatusCheck = 0;
                    var STATUS_CHECK_THROTTLE_MS = 1000; // Throttle: max 1 chiamata al secondo
                    var _tonyProntoLogged = false;
                    
                    // Ultimo controllo forzato sui dati tenant forniti dal standalone-bootstrap (moduli_attivi)
                    (function applyBootstrapTenantContext() {
                        try {
                            var moduli = window.__gfvModuliAttivi;
                            if (Array.isArray(moduli) && moduli.length > 0 && window.Tony && typeof window.Tony.setContext === 'function') {
                                window.Tony.setContext('dashboard', { info_azienda: { moduli_attivi: moduli }, moduli_attivi: moduli });
                                saveModuliToStorage(moduli);
                                if (typeof console !== 'undefined' && console.log) {
                                    console.log('[Tony] Moduli impostati da bootstrap (__gfvModuliAttivi):', moduli.length);
                                }
                            }
                        } catch (e) {}
                    })();

                    var checkTonyModuleStatus = function(force) {
                        var now = Date.now();
                        if (!force && (now - lastStatusCheck) < STATUS_CHECK_THROTTLE_MS) {
                            return;
                        }
                        lastStatusCheck = now;
                        
                        try {
                            var context = Tony.context || {};
                            var moduliAttivi = context.dashboard?.moduli_attivi || 
                                             context.info_azienda?.moduli_attivi || 
                                             context.moduli_attivi || [];
                            if (!moduliAttivi || moduliAttivi.length === 0) {
                                var discovered = getModuliFromDiscovery();
                                if (discovered && discovered.length && window.Tony && typeof window.Tony.setContext === 'function') {
                                    window.Tony.setContext('dashboard', { info_azienda: { moduli_attivi: discovered }, moduli_attivi: discovered });
                                    saveModuliToStorage(discovered);
                                    moduliAttivi = discovered;
                                    console.log('[Tony] Moduli ripristinati da auto-discovery (sessionStorage/window):', moduliAttivi.length);
                                }
                            }
                            
                            var wasActive = isTonyAdvancedActive;
                            isTonyAdvancedActive = Array.isArray(moduliAttivi) && moduliAttivi.includes('tony');
                            
                            if (wasActive !== isTonyAdvancedActive || force) {
                                console.log('[Tony] Stato modulo avanzato:', isTonyAdvancedActive ? 'ATTIVO' : 'NON ATTIVO', 'Moduli:', moduliAttivi);
                            }
                            
                            var elapsedSinceInit = now - _tonyWidgetInitTime;
                            if ((!moduliAttivi || moduliAttivi.length === 0) && elapsedSinceInit > 5000) {
                                console.warn('[Tony] ATTENZIONE: moduli_attivi non trovati nel context. La pagina potrebbe non aver inizializzato Tony correttamente.');
                            }
                        } catch (e) {
                            console.warn('[Tony] Errore recupero stato modulo:', e);
                            isTonyAdvancedActive = false;
                        }
                    };
                    
                    checkTonyModuleStatus(true);
                    window.__tonyCheckModuleStatus = checkTonyModuleStatus;
                    
                    var statusCheckCount = 0;
                    var statusCheckInterval = setInterval(function() {
                        statusCheckCount++;
                        if (statusCheckCount <= 3) {
                            checkTonyModuleStatus();
                        } else {
                            clearInterval(statusCheckInterval);
                        }
                    }, 3000);
                    setTimeout(function() {
                        clearInterval(statusCheckInterval);
                    }, 10000);
                    
                    function logProntoIfNeeded() {
                        if (_tonyProntoLogged) return;
                        _tonyProntoLogged = true;
                        console.log('[Tony] Pronto (widget standalone). Modulo avanzato:', isTonyAdvancedActive ? 'ATTIVO' : 'NON ATTIVO');
                    }
                    
window.addEventListener('tony-module-updated', function(e) {
                        var newModules = e.detail && e.detail.modules;
                        if (newModules && Array.isArray(newModules)) {
                            console.log('[Tony] Evento aggiornamento modulo ricevuto:', newModules);
                            saveModuliToStorage(newModules);
                            if (window.Tony && window.Tony.setContext) {
                                window.Tony.setContext('dashboard', {
                                    info_azienda: { moduli_attivi: newModules },
                                    moduli_attivi: newModules
                                });
                            }
                            checkTonyModuleStatus(true);
                            logProntoIfNeeded();
                        }
                    });

                    function applyTableDataToContext(data) {
                        if (!data || !window.Tony || typeof window.Tony.setContext !== 'function') return;
                        window.currentTableData = data;
                        var page = (window.Tony.context && window.Tony.context.page) || {};
                        window.Tony.setContext('page', Object.assign({}, page, {
                            tableDataSummary: data.summary || '',
                            currentTableData: data
                        }));
                    }
                    // Buffer globale: se table-data-ready è stato emesso prima che il listener fosse attivo, recupera i dati al bootstrap
                    if (typeof window !== 'undefined' && window.__tonyTableDataBuffer && (window.__tonyTableDataBuffer.summary != null || window.__tonyTableDataBuffer.items != null || window.__tonyTableDataBuffer.pageType != null)) {
                        applyTableDataToContext(window.__tonyTableDataBuffer);
                        window.__tonyTableDataBuffer = null;
                    }
                    window.addEventListener('table-data-ready', function(e) {
                        var data = (e.detail && e.detail.currentTableData) || (e.detail && e.detail.data && e.detail.data.currentTableData) || e.detail;
                        if (data && (data.summary != null || data.items != null || data.pageType != null)) applyTableDataToContext(data);
                    });
                    if (window.currentTableData && (window.currentTableData.summary != null || window.currentTableData.items != null)) {
                        applyTableDataToContext(window.currentTableData);
                    }

                    Tony.onAction(function(actionName, params) {
                        
                        // Bypass: navigazione (APRI_PAGINA) consentita anche se context moduli non ancora caricato
                        if (actionName === 'APRI_PAGINA' || actionName === 'apri_modulo') {
                            console.log('[DEBUG CURSOR] onAction callback: Caso APRI_PAGINA');
                            var actualParams = params.params && typeof params.params === 'object' ? params.params : params;
                            var rawTarget = (actualParams.target || actualParams.modulo || '').toString().trim();
                            
                            if (!rawTarget) {
                                console.warn('[DEBUG CURSOR] onAction callback: Target non trovato nei params');
                                console.warn('[Tony] Target non trovato. Params ricevuti:', params);
                                return;
                            }
                            
                            // Guardia: se siamo già sulla pagina terreni e il target è terreni, non navigare (filtra invece)
                            var isOnTerreniPage = (typeof window !== 'undefined' && (
                                (window.location.pathname || '').indexOf('terreni') >= 0 ||
                                (window.currentTableData && window.currentTableData.pageType === 'terreni')
                            ));
                            if (isOnTerreniPage && (rawTarget === 'terreni' || rawTarget === 'terreni-test-bootstrap')) {
                                console.log('[Tony] Già sulla pagina terreni: ignoro APRI_PAGINA, eseguo FILTER_TABLE reset');
                                enqueueTonyCommand({ type: 'FILTER_TABLE', params: { filterType: 'reset', value: '' } }, { source: 'apri-pagina-guard' });
                                return;
                            }
                            // Guardia: se siamo già sulla pagina attivita e il target è attivita/diario, non navigare (filtra invece)
                            var isOnAttivitaPage = (typeof window !== 'undefined' && (
                                (window.location.pathname || '').indexOf('attivita') >= 0 ||
                                (window.currentTableData && window.currentTableData.pageType === 'attivita')
                            ));
                            if (isOnAttivitaPage && (rawTarget === 'attivita' || rawTarget === 'diario' || rawTarget === 'attivita-standalone')) {
                                console.log('[Tony] Già sulla pagina attivita: ignoro APRI_PAGINA, eseguo FILTER_TABLE reset');
                                enqueueTonyCommand({ type: 'FILTER_TABLE', params: { filterType: 'reset', value: '' } }, { source: 'apri-pagina-guard' });
                                return;
                            }
                            
                            var url = getUrlForTarget(rawTarget);
                            if (!url) {
                                console.warn('[DEBUG CURSOR] onAction callback: Pagina non mappata');
                                console.warn('[Tony] Pagina non mappata per target:', rawTarget, 'Params:', params);
                                return;
                            }
                            var resolved = resolveTarget(rawTarget) || rawTarget;
                            var label = TONY_LABEL_MAP[resolved] || resolved;
                            var urlWithNotify = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'tnyNotify=' + encodeURIComponent(resolved);
                            window.showTonyConfirmDialog('Aprire la pagina "' + label + '"?').then(function(ok) {
                                if (ok) {
                                    _tonyCommandQueue.length = 0;
                                    // Salvataggio intent solo alla conferma utente (evita residui da comandi annullati)
                                    var pendingModal = actualParams._tonyPendingModal;
                                    var pendingFields = actualParams._tonyPendingFields || actualParams.fields;
                                    var rawT = (rawTarget || '').toLowerCase();
                                    if (!pendingModal && pendingFields && typeof pendingFields === 'object' && Object.keys(pendingFields).length > 0) {
                                        if (rawT.indexOf('nuovo') >= 0 && rawT.indexOf('preventivo') >= 0) pendingModal = 'preventivo-form';
                                    }
                                    // Cross-page: CF / onComplete possono passare solo target senza _tonyPendingModal né fields → serve comunque modal per checkTonyPendingAfterNav.
                                    if (!pendingModal && rawT.indexOf('nuovo') >= 0 && rawT.indexOf('preventivo') >= 0) {
                                        pendingModal = 'preventivo-form';
                                    }
                                    if (pendingModal && rawTarget) {
                                        try {
                                            var rawTNav = (rawTarget || '').toLowerCase();
                                            var isNuovoPrevNav = pendingModal === 'preventivo-form' || (rawTNav.indexOf('nuovo') >= 0 && rawTNav.indexOf('preventivo') >= 0);
                                            var userPromptForPending = isNuovoPrevNav ? tonyGetUserPromptForPendingNav() : '';
                                            sessionStorage.setItem('tony_pending_intent', JSON.stringify({
                                                target: rawTarget,
                                                modalId: pendingModal,
                                                fields: (pendingFields && typeof pendingFields === 'object') ? pendingFields : null,
                                                userPromptForPending: userPromptForPending || null
                                            }));
                                            console.log('[Tony] tony_pending_intent salvato (post-conferma):', pendingModal, rawTarget);
                                        } catch (e) { console.warn('[Tony] Impossibile salvare pending intent:', e); }
                                    }
                                    window.location.hash = '#' + resolved;
                                    try {
                                        window.dispatchEvent(new CustomEvent('tony-navigate', { detail: { target: resolved, hash: '#' + resolved, url: urlWithNotify } }));
                                    } catch (e) {}
                                    window.location.href = urlWithNotify;
                                }
                            });
                            return;
                        }
                        
                        // SICUREZZA: per le altre azioni blocca se modulo non attivo
                        if (!isTonyAdvancedActive) {
                            console.warn('[Tony] Azione bloccata: modulo Tony Avanzato non attivo');
                            appendMessage('Questa funzionalità richiede il modulo Tony Avanzato. Attivalo dalla Dashboard per automatizzare operazioni.', 'tony');
                            return;
                        }
                        var command = { type: actionName };
                        if (params && typeof params === 'object') {
                            for (var k in params) if (params.hasOwnProperty(k)) command[k] = params[k];
                        }
                        var qOpts = { source: 'onAction-callback' };
                        // Su pagina Nuovo Preventivo il form è già nel DOM: niente attesa artificiale in coda (prima c'erano 400ms).
                        if (actionName === 'INJECT_FORM_DATA' && command.formId === 'preventivo-form' && document.getElementById('preventivo-form')) {
                            qOpts.delayMs = 0;
                        }
                        enqueueTonyCommand(command, qOpts);
                    });
                    
                    // Aggiorna stato modulo quando context dashboard viene settato (con debounce)
                    var setContextTimeout = null;
                    var originalSetContext = Tony.setContext;
                    if (originalSetContext) {
                        Tony.setContext = function(moduleName, data) {
                            originalSetContext.call(this, moduleName, data);
                            if (moduleName === 'dashboard' || moduleName === 'session') {
                                if (setContextTimeout) clearTimeout(setContextTimeout);
                                setContextTimeout = setTimeout(function() {
                                    checkTonyModuleStatus(true);
                                    logProntoIfNeeded();
                                }, 300);
                            }
                        };
                    }
                    
                    // Pronto: dopo dati dashboard (evento) o al massimo 2.5s per non bloccare
                    setTimeout(function() { logProntoIfNeeded(); }, 2500);
                    if (typeof window.__tonyRestoreSession === 'function') window.__tonyRestoreSession();
                    (function checkTnyNotifyGreeting() {
                        var params = new URLSearchParams(window.location.search);
                        var tny = params.get('tnyNotify');
                        if (!tny) return;
                        var label = TONY_LABEL_MAP[tny] || (tny.charAt(0).toUpperCase() + tny.slice(1).replace(/-/g, ' '));
                        var search = (window.location.search || '').replace(/([?&])tnyNotify=[^&]+&?|&tnyNotify=[^&]+/, '$1').replace(/[?&]$/, '') || '';
                        if (search === '?') search = '';
                        var urlClean = window.location.pathname + search;
                        try { history.replaceState(null, '', urlClean || window.location.pathname); } catch (e) {}
                        setTimeout(function() {
                            if (typeof window.__tonySayGreeting === 'function') {
                                window.__tonySayGreeting('Eccoci nella sezione ' + label + '!');
                            }
                        }, 800);
                    })();

                    (function checkTonyPendingAfterNav() {
                        try {
                            var raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tony_pending_intent') : null;
                            if (!raw) return;
                            var intent = null;
                            try { intent = JSON.parse(raw); } catch (e) { return; }
                            if (!intent || !intent.modalId || !intent.target) return;
                            var path = (window.location.pathname || '').toLowerCase();
                            var targetSlug = (intent.target || '').replace(/\s+/g, '-').toLowerCase();
                            var pendingPreventivo = intent.modalId === 'preventivo-form';
                            var onNuovoPreventivoPath =
                                path.indexOf('nuovo-preventivo') >= 0 ||
                                path.indexOf('nuovo_preventivo') >= 0 ||
                                path.indexOf('preventivo-standalone') >= 0;
                            var preventivoFormPresent = !!document.getElementById('preventivo-form');
                            if (pendingPreventivo) {
                                var pathOk = !targetSlug || path.indexOf(targetSlug) >= 0 || onNuovoPreventivoPath;
                                if (!pathOk && !preventivoFormPresent) return;
                            } else {
                                if (!targetSlug || path.indexOf(targetSlug) < 0) return;
                            }
                            sessionStorage.removeItem('tony_pending_intent');
                            var modalId = intent.modalId;
                            var fields = (intent.fields && typeof intent.fields === 'object') ? intent.fields : null;
                            function openAndInject() {
                                if (modalId === 'attivita-modal' && typeof window.openAttivitaModal === 'function') {
                                    window.openAttivitaModal().catch(function(e) { console.warn('[Tony] openAttivitaModal fallito:', e); });
                                    var jq = (typeof window.$ === 'function' && window.$.fn && window.$.fn.modal) ? window.$ : null;
                                    if (jq) { jq('#' + modalId).modal('show'); } else { var el = document.getElementById(modalId); if (el) el.classList.add('active'); }
                                    if (fields && Object.keys(fields).length > 0 && window.TonyFormInjector) {
                                        enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'attivita-form', formData: fields }, { source: 'pending-after-nav', delayMs: 1800 });
                                    }
                                } else if (modalId === 'lavoro-modal' && typeof window.openCreaModal === 'function') {
                                    window.openCreaModal();
                                    var jq = (typeof window.$ === 'function' && window.$.fn && window.$.fn.modal) ? window.$ : null;
                                    if (jq) { jq('#' + modalId).modal('show'); } else { var el = document.getElementById(modalId); if (el) el.classList.add('active'); }
                                    if (fields && Object.keys(fields).length > 0 && window.TonyFormInjector) {
                                        enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'lavoro-form', formData: fields }, { source: 'pending-after-nav', delayMs: 1800 });
                                    }
                                } else if (modalId === 'preventivo-form') {
                                    if (fields && Object.keys(fields).length > 0 && window.TonyFormInjector) {
                                        enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'preventivo-form', formData: fields }, { source: 'pending-after-nav', delayMs: 2200 });
                                    }
                                    var userPromptNav = (intent.userPromptForPending && String(intent.userPromptForPending).trim()) ? String(intent.userPromptForPending).trim() : '';
                                    if (!userPromptNav && typeof sessionStorage !== 'undefined') {
                                        try {
                                            var sup = sessionStorage.getItem('tony_last_user_message');
                                            if (sup && String(sup).trim()) userPromptNav = String(sup).trim();
                                        } catch (e2) {}
                                    }
                                    if (!userPromptNav) {
                                        userPromptNav = tonyGetUserPromptForPendingNav();
                                    }
                                    var hadPendingFieldsInject = fields && typeof fields === 'object' && Object.keys(fields).length > 0;
                                    if (userPromptNav && window.Tony && typeof window.Tony.ask === 'function') {
                                        var enrichDelayMs = hadPendingFieldsInject ? 14000 : 4000;
                                        setTimeout(function() {
                                            if (window.__tonyPreventivoPostNavEnrichDone) return;
                                            var formPrev = document.getElementById('preventivo-form');
                                            if (!formPrev) return;
                                            if (hadPendingFieldsInject) {
                                                var ctxNav = typeof window.__tonyGetCurrentFormContext === 'function' ? window.__tonyGetCurrentFormContext() : null;
                                                var reqNav = (ctxNav && ctxNav.requiredEmpty) ? ctxNav.requiredEmpty : [];
                                                if (reqNav.length === 0) return;
                                                if (reqNav.indexOf('cliente-id') < 0 && reqNav.length < 4) return;
                                            }
                                            window.__tonyPreventivoPostNavEnrichDone = true;
                                            var enrichSuffix = '\n\n[Contesto: pagina Nuovo Preventivo già aperta nel browser. Rispondi con un solo comando JSON INJECT_FORM_DATA con formId "preventivo-form" e formData completo (cliente-id, tipo-lavoro, terreno-id se noto, colture, data-prevista, ecc.) dedotto dal messaggio.]';
                                            console.log('[Tony] Post-nav: richiesta completamento preventivo a Tony (skipUserHistory), delay era', enrichDelayMs + 'ms');
                                            window.Tony.ask(userPromptNav + enrichSuffix, { skipUserHistory: true }).catch(function(err) {
                                                console.warn('[Tony] ask post-nav preventivo:', err);
                                            });
                                        }, enrichDelayMs);
                                    }
                                } else if (modalId === 'prodotto-modal') {
                                    var btnPendP = document.getElementById('btn-nuovo-prodotto');
                                    if (btnPendP) btnPendP.click();
                                    else { var elPendP = document.getElementById('prodotto-modal'); if (elPendP) elPendP.classList.add('active'); }
                                    if (fields && Object.keys(fields).length > 0 && window.TonyFormInjector) {
                                        enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'prodotto-form', formData: fields }, { source: 'pending-after-nav', delayMs: 1200 });
                                    }
                                } else if (modalId === 'movimento-modal') {
                                    var btnPendM = document.getElementById('btn-nuovo-movimento');
                                    if (btnPendM) btnPendM.click();
                                    else { var elPendM = document.getElementById('movimento-modal'); if (elPendM) elPendM.classList.add('active'); }
                                    if (fields && Object.keys(fields).length > 0 && window.TonyFormInjector) {
                                        enqueueTonyCommand({ type: 'INJECT_FORM_DATA', formId: 'movimento-form', formData: fields }, { source: 'pending-after-nav', delayMs: 1200 });
                                    }
                                } else if (modalId === 'terreno-modal' && typeof window.openTerrenoModal === 'function') {
                                    window.openTerrenoModal(null).catch(function(e) { console.warn('[Tony] openTerrenoModal fallito:', e); });
                                    var jq = (typeof window.$ === 'function' && window.$.fn && window.$.fn.modal) ? window.$ : null;
                                    if (jq) { jq('#' + modalId).modal('show'); } else { var el = document.getElementById(modalId); if (el) el.classList.add('active'); }
                                    if (fields && Object.keys(fields).length > 0) {
                                        var order = ['terreno-nome', 'terreno-superficie', 'terreno-coltura-categoria', 'terreno-coltura', 'terreno-podere', 'terreno-tipo-possesso', 'terreno-data-scadenza-affitto', 'terreno-canone-affitto', 'terreno-note'];
                                        order.forEach(function(fk, i) {
                                            if (fields[fk] != null && fields[fk] !== '') {
                                                enqueueTonyCommand({ type: 'SET_FIELD', field: fk, value: String(fields[fk]) }, { source: 'pending-after-nav', delayMs: 1800 + (i * 250) });
                                            }
                                        });
                                    }
                                } else {
                                    var mEl = document.getElementById(modalId);
                                    if (mEl) {
                                        var jq = (typeof window.$ === 'function' && window.$.fn && window.$.fn.modal) ? window.$ : null;
                                        if (jq) { jq('#' + modalId).modal('show'); } else { mEl.classList.add('active'); }
                                        if (fields && Object.keys(fields).length > 0) {
                                            Object.keys(fields).forEach(function(fk, i) {
                                                if (fields[fk] != null && fields[fk] !== '') {
                                                    enqueueTonyCommand({ type: 'SET_FIELD', field: fk, value: String(fields[fk]) }, { source: 'pending-after-nav', delayMs: 1200 + (i * 250) });
                                                }
                                            });
                                        }
                                    }
                                }
                            }
                            var waitElId = (modalId === 'preventivo-form') ? 'preventivo-form' : modalId;
                            if (document.getElementById(waitElId)) {
                                setTimeout(openAndInject, 400);
                            } else {
                                var attempts = 0;
                                var iv = setInterval(function() {
                                    attempts++;
                                    if (document.getElementById(waitElId)) { clearInterval(iv); setTimeout(openAndInject, 400); } else if (attempts >= 35) { clearInterval(iv); }
                                }, 200);
                            }
                        } catch (e) { console.warn('[Tony] checkTonyPendingAfterNav:', e); }
                    })();

                    return;
                }
            } catch (e) {
                if (i === maxAttempts - 1) console.warn('[Tony] Init non disponibile (Firebase non pronto o assente).', e);
            }
            await new Promise(function(r) { setTimeout(r, interval); });
        }
    }    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { initTonyWhenReady(); });
    } else {
        initTonyWhenReady();
    }
})();

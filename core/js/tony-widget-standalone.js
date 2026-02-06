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
    }

    var TONY_PAGE_MAP = {
        'terreni': 'core/terreni-standalone.html',
        'attivita': 'core/attivita-standalone.html', 'attività': 'core/attivita-standalone.html',
        'lavori': 'core/admin/gestione-lavori-standalone.html', 'gestione lavori': 'core/admin/gestione-lavori-standalone.html',
        'statistiche': 'core/statistiche-standalone.html',
        'magazzino': 'modules/magazzino/views/magazzino-home-standalone.html',
        'vigneto': 'modules/vigneto/views/vigneto-dashboard-standalone.html',
        'vigneti': 'modules/vigneto/views/vigneti-standalone.html',
        'frutteto': 'modules/frutteto/views/frutteto-dashboard-standalone.html',
        'frutteti': 'modules/frutteto/views/frutteti-standalone.html',
        'conto terzi': 'modules/conto-terzi/views/conto-terzi-home-standalone.html',
        'contoterzi': 'modules/conto-terzi/views/conto-terzi-home-standalone.html',
        'report': 'modules/report/views/report-standalone.html',
        'amministrazione': 'core/admin/amministrazione-standalone.html',
        'guasti': 'core/admin/gestione-guasti-standalone.html',
        'segnalazione guasti': 'core/admin/segnalazione-guasti-standalone.html',
        'abbonamento': 'core/admin/abbonamento-standalone.html',
        'impostazioni': 'core/admin/impostazioni-standalone.html',
        'diario': 'core/attivita-standalone.html'
    };

    var TONY_LABEL_MAP = {
        'terreni': 'Terreni', 'attivita': 'Diario Attività', 'attività': 'Diario Attività',
        'lavori': 'Gestione Lavori', 'gestione lavori': 'Gestione Lavori',
        'statistiche': 'Statistiche', 'magazzino': 'Magazzino', 'vigneto': 'Vigneto', 'vigneti': 'Vigneti',
        'frutteto': 'Frutteto', 'frutteti': 'Frutteti', 'conto terzi': 'Conto Terzi', 'contoterzi': 'Conto Terzi',
        'report': 'Report', 'amministrazione': 'Amministrazione', 'guasti': 'Gestione Guasti',
        'segnalazione guasti': 'Segnalazione Guasti', 'abbonamento': 'Abbonamento',
        'impostazioni': 'Impostazioni', 'diario': 'Diario Attività'
    };

    function getUrlForTarget(target, pathname) {
        pathname = pathname || (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
        var pathFromRoot = TONY_PAGE_MAP[target];
        if (!pathFromRoot) return null;
        var dir = pathname.replace(/\/[^/]*$/, '') || '/';
        var segments = dir.split('/').filter(Boolean);
        var depth = segments.length;
        var up = depth ? '../'.repeat(depth) : '';
        return up + pathFromRoot;
    }

    function injectWidget() {
        if (document.getElementById('tony-fab')) return;

        var fab = document.createElement('button');
        fab.type = 'button';
        fab.className = 'tony-widget-fab';
        fab.id = 'tony-fab';
        fab.title = 'Chiedi a Tony';
        fab.setAttribute('aria-label', 'Apri assistente Tony');
        fab.textContent = '🤖';

        var panel = document.createElement('div');
        panel.className = 'tony-widget-panel';
        panel.id = 'tony-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Chat con Tony');
        panel.innerHTML = '<div class="tony-widget-header">' +
            '<h2>🤖 Tony – Assistente</h2>' +
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
            '<button type="button" class="tony-widget-mic" id="tony-mic" title="Tieni premuto per parlare" aria-label="Microfono">🎤</button>' +
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
            t = t.replace(/\*\*(.*?)\*\*/g, '$1');
            t = t.replace(/\*(.*?)\*/g, '$1');
            t = t.replace(/_(.*?)_/g, '$1');
            t = t.replace(/\{.*?\}/g, '');
            t = t.replace(/[*_]/g, '');
            t = t.replace(/[""«»]/g, '');
            t = t.replace(/\b(asterisco|virgolette)\b/gi, '');
            return t.replace(/\s{2,}/g, ' ').trim();
        }

        fab.addEventListener('click', function() {
            panel.classList.add('is-open');
            if (messagesEl.children.length === 0) {
                appendMessage('Ciao! Sono Tony, il tuo assistente. Chiedimi di aprire un modulo, di mostrarti dati o di aiutarti con le attività. Prova ad esempio: "Apri il modulo attività" o "Portami ai terreni".', 'tony');
            }
            inputEl.focus();
        });

        var pendingVoiceText = null;
        closeBtn.addEventListener('click', function() {
            panel.classList.remove('is-open');
            pendingVoiceText = null;
            var vc = document.getElementById('tony-voice-confirm');
            if (vc) vc.style.display = 'none';
        });

        function speakWithTTS(testo, opts) {
            if (!opts.fromVoice || !testo || !window.speechSynthesis) return;
            window.speechSynthesis.cancel();
            var testoPulito = pulisciTestoPerVoce(testo);
            if (!testoPulito) return;
            var u = new SpeechSynthesisUtterance(testoPulito);
            u.lang = 'it-IT';
            u.rate = 1.05;
            u.pitch = 0.9;
            var voices = window.speechSynthesis.getVoices();
            var n = function(v) { return v.name.toLowerCase(); };
            var it = function(v) { return v.lang === 'it-IT' || v.lang.indexOf('it') === 0; };
            var male = function(v) { var x = n(v); return x.indexOf('paolo') !== -1 || x.indexOf('luca') !== -1 || x.indexOf('male') !== -1 || x.indexOf('uomo') !== -1; };
            var tonyVoice = voices.find(function(v) { return it(v) && male(v) && (n(v).indexOf('google') !== -1 || n(v).indexOf('natural') !== -1); })
                || voices.find(function(v) { return it(v) && male(v); })
                || voices.find(function(v) { return it(v) && (n(v).indexOf('google') !== -1 || n(v).indexOf('natural') !== -1); })
                || voices.find(function(v) { return it(v); });
            if (tonyVoice) u.voice = tonyVoice;
            window.speechSynthesis.speak(u);
        }

        function sendMessage(overrideText, opts) {
            opts = opts || {};
            var text = (overrideText != null ? String(overrideText).trim() : (inputEl.value || '').trim());
            if (!text) return;
            if (!window.Tony || !window.Tony.isReady()) {
                appendMessage('Tony non è ancora pronto. Attendi qualche secondo e riprova.', 'error');
                return;
            }
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            inputEl.value = '';
            appendMessage(text, 'user');
            sendBtn.disabled = true;
            inputEl.disabled = true;
            if (document.getElementById('tony-mic')) document.getElementById('tony-mic').disabled = true;
            appendMessage('Sto pensando...', 'typing');

            var useStream = typeof window.Tony.askStream === 'function';
            var streamingMsgEl = null;

            function onComplete(response) {
                removeTyping();
                if (streamingMsgEl) streamingMsgEl.remove();
                appendMessage(response || 'Nessuna risposta.', 'tony');
                speakWithTTS(response, opts);
            }

            function onError(err) {
                removeTyping();
                if (streamingMsgEl) streamingMsgEl.remove();
                appendMessage('Errore: ' + (err && err.message ? err.message : 'Riprova più tardi.'), 'error');
            }

            function onFinally() {
                sendBtn.disabled = false;
                inputEl.disabled = false;
                var micBtn = document.getElementById('tony-mic');
                if (micBtn) micBtn.disabled = false;
                inputEl.focus();
            }

            if (useStream) {
                window.Tony.askStream(text, {
                    onChunk: function(chunk) {
                        if (!streamingMsgEl) {
                            removeTyping();
                            streamingMsgEl = document.createElement('div');
                            streamingMsgEl.className = 'tony-msg tony streaming';
                            messagesEl.appendChild(streamingMsgEl);
                            messagesEl.scrollTop = messagesEl.scrollHeight;
                        }
                        streamingMsgEl.textContent = (streamingMsgEl.textContent || '') + chunk;
                        messagesEl.scrollTop = messagesEl.scrollHeight;
                    }
                }).then(onComplete).catch(onError).finally(onFinally);
            } else {
                window.Tony.ask(text).then(onComplete).catch(onError).finally(onFinally);
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
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'it-IT';

            recognition.onresult = function(e) {
                var transcript = '';
                for (var i = e.resultIndex; i < e.results.length; i++) {
                    transcript += e.results[i][0].transcript;
                }
                if (transcript.trim()) {
                    pendingVoiceText = transcript.trim();
                    voiceTranscriptEl.textContent = pendingVoiceText;
                    voiceConfirmEl.style.display = 'flex';
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
                } catch (err) { /* già in esecuzione */ }
            }
            function stopListening() {
                try { recognition.stop(); } catch (err) {}
                micBtn.classList.remove('tony-mic-active');
            }

            micBtn.addEventListener('mousedown', function(e) { e.preventDefault(); startListening(); });
            micBtn.addEventListener('mouseup', stopListening);
            micBtn.addEventListener('mouseleave', stopListening);
            micBtn.addEventListener('touchstart', function(e) { e.preventDefault(); startListening(); }, { passive: false });
            micBtn.addEventListener('touchend', function(e) { e.preventDefault(); stopListening(); }, { passive: false });

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
                    Tony.onAction(function(actionName, params) {
                        if (actionName !== 'APRI_PAGINA' && actionName !== 'apri_modulo') return;
                        var target = (params.target || params.modulo || '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
                        var url = getUrlForTarget(target);
                        if (!url) {
                            console.warn('[Tony] Pagina non mappata per target:', target, params);
                            return;
                        }
                        var label = TONY_LABEL_MAP[target] || target;
                        window.showTonyConfirmDialog('Aprire la pagina "' + label + '"?').then(function(ok) {
                            if (ok) window.location.href = url;
                        });
                    });
                    console.log('[Tony] Pronto (widget standalone).');
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

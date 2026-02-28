/**
 * Tony Widget – Voice/TTS: coda audio, playOneTTS, speakWithTTS.
 * @module core/js/tony/voice
 */

var lastTTSCache = { text: '', audioBase64: '' };

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
        t = t.replace(/\s{2,}/g, ' ').trim();
        t = t.replace(/\s*[{}]+\s*$/g, '').trim();
        return t;
    }

    /** Estrae solo il testo umano per TTS da stringa che può contenere JSON. */
    function extractTextForTTS(str) {
        if (!str || typeof str !== 'string') return '';
        var s = str.trim();
        var jsonStart = s.search(/\{\s*["']?text["']?\s*:/);
        if (jsonStart >= 0) {
            var jsonStr = s.slice(jsonStart).replace(/\b(text|command)\s*:/g, '"$1":');
            for (var tries = 0; tries < 25 && jsonStr.length > 15; tries++) {
                try {
                    var parsed = JSON.parse(jsonStr);
                    if (parsed && typeof parsed === 'object' && parsed.text != null) {
                        return String(parsed.text).replace(/\s+[}\]]\s*$/g, '').trim();
                    }
                } catch (_) {}
                jsonStr = jsonStr.slice(0, -1).trim();
            }
        }
        var textMatch = s.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (textMatch) return textMatch[1].replace(/\\"/g, '"');
        var beforeBrace = s.split(/\s*\{/)[0];
        if (beforeBrace && beforeBrace.trim().length > 0) return beforeBrace.trim();
        return s;
    }

/**
 * Inizializza il modulo voice. Restituisce { speakWithTTS }.
 * @param {{ onPlayEnd?: function(opts), onPlayStart?: function }} options
 * @returns {{ speakWithTTS: function }}
 */
export function initTonyVoice(options) {
    options = options || {};
    var onPlayEnd = options.onPlayEnd || function() {};
    var onPlayStart = options.onPlayStart || function() {};

    if (typeof window !== 'undefined') {
        window.__tonyAudioQueue = window.__tonyAudioQueue || [];
        window.__tonyIsSpeaking = window.__tonyIsSpeaking || false;
    }

        function processNextAudio() {
            if (window.__tonyIsSpeaking || !window.__tonyAudioQueue || window.__tonyAudioQueue.length === 0) return;
            var item = window.__tonyAudioQueue.shift();
            if (!item || !item.text) {
                processNextAudio();
                return;
            }
            window.__tonyIsSpeaking = true;
            playOneTTS(item.text, item.opts || {}, function() {
                window.__tonyIsSpeaking = false;
                processNextAudio();
            });
        }

        function schedulePlayOnFirstInteraction() {
            if (window.__tonyPlayOnInteractionScheduled) return;
            window.__tonyPlayOnInteractionScheduled = true;
            function once() {
                window.removeEventListener('click', once);
                window.removeEventListener('touchstart', once);
                window.removeEventListener('keydown', once);
                window.__tonyPlayOnInteractionScheduled = false;
                if (window.__tonyAudioQueue && window.__tonyAudioQueue.length > 0) processNextAudio();
            }
            window.addEventListener('click', once, { once: true, passive: true });
            window.addEventListener('touchstart', once, { once: true, passive: true });
            window.addEventListener('keydown', once, { once: true });
        }

        function playOneTTS(testoPulito, opts, onDone) {
            opts = opts || {};
            if (!onDone) onDone = function() {};
            if (opts.forceInterrupt) {
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                if (window.currentTonyAudio) {
                    window.currentTonyAudio.pause();
                    window.currentTonyAudio = null;
                }
            }

            if (testoPulito === lastTTSCache.text && lastTTSCache.audioBase64) {
                var audioSrc = 'data:audio/mp3;base64,' + lastTTSCache.audioBase64;
                window.currentTonyAudio = new Audio(audioSrc);
                window.currentTonyAudio.onplay = function() { onPlayStart(); };
                window.currentTonyAudio.onerror = function(e) { console.error('[Tony] Audio cached error:', e); onDone(); };
                window.currentTonyAudio.onended = function() {
                    window.currentTonyAudio = null;
                    onPlayEnd(opts);
                    onDone();
                };
                window.currentTonyAudio.play().catch(function(e) {
                    if (e && e.name === 'NotAllowedError') {
                        window.currentTonyAudio = null;
                        window.__tonyAudioQueue = window.__tonyAudioQueue || [];
                        window.__tonyAudioQueue.unshift({ text: testoPulito, opts: opts });
                        window.__tonyIsSpeaking = false;
                        schedulePlayOnFirstInteraction();
                        if (typeof console !== 'undefined' && console.log) console.log('[Tony] Audio rinviato: riproduzione al primo click (policy browser).');
                        return;
                    }
                    console.error('[Tony] Errore play cached:', e);
                    onDone();
                });
                return;
            }

            (async function() {
                var TTS_TIMEOUT_MS = 15000;
                try {
                    var firebaseService = await import('../../services/firebase-service.js');
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
                    if (result.data && result.data.audioContent) {
                        lastTTSCache.text = testoPulito;
                        lastTTSCache.audioBase64 = result.data.audioContent;
                        var audioSrc = 'data:audio/mp3;base64,' + result.data.audioContent;
                        window.currentTonyAudio = new Audio(audioSrc);
                        window.currentTonyAudio.onplay = function() { onPlayStart(); };
                        window.currentTonyAudio.onerror = function(e) { console.error('[Tony] Audio element error:', e); onDone(); };
                        window.currentTonyAudio.onended = function() {
                            window.currentTonyAudio = null;
                            onPlayEnd(opts);
                            onDone();
                        };
                        window.currentTonyAudio.play().catch(function(e) {
                            if (e && e.name === 'NotAllowedError') {
                                window.currentTonyAudio = null;
                                window.__tonyAudioQueue = window.__tonyAudioQueue || [];
                                window.__tonyAudioQueue.unshift({ text: testoPulito, opts: opts });
                                window.__tonyIsSpeaking = false;
                                schedulePlayOnFirstInteraction();
                                if (typeof console !== 'undefined' && console.log) console.log('[Tony] Audio rinviato: riproduzione al primo click (policy browser).');
                                return;
                            }
                            console.error('[Tony] Errore play():', e);
                            onDone();
                        });
                    } else {
                        onPlayEnd(opts);
                        onDone();
                    }
                } catch (err) {
                    console.error('[Tony] Errore critico getTonyAudio:', err);
                    onPlayEnd(opts);
                    onDone();
                }
            })();
        }

        function speakWithTTS(testo, opts) {
            opts = opts || {};
            if (!testo) {
                onPlayEnd(opts);
                return;
            }
            var testoPulito = pulisciTestoPerVoce(testo);
            if (testoPulito.indexOf('{') >= 0 || testoPulito.indexOf('"text"') >= 0 || /^\s*\{/.test(testoPulito)) {
                var extracted = extractTextForTTS(testoPulito);
                if (extracted) testoPulito = extracted;
            }
            if (!testoPulito || testoPulito.length < 2) {
                onPlayEnd(opts);
                return;
            }
            testoPulito = testoPulito.replace(/\s+[}\]]\s*$/g, '').trim();
            if (testoPulito.length < 15 && (/^(json\s*[}\]]?|[\s}\]]+)$/i.test(testoPulito) || /^\s*[}\]]\s*$/i.test(testoPulito))) {
                onPlayEnd(opts);
                return;
            }
            window.__tonyAudioQueue = window.__tonyAudioQueue || [];
            window.__tonyAudioQueue.push({ text: testoPulito, opts: opts });
            processNextAudio();
        }

    return { speakWithTTS: speakWithTTS };
}

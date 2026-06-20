/**
 * Tony Widget – Voice/TTS: coda audio, playOneTTS, speakWithTTS.
 * @module core/js/tony/voice
 */

var lastTTSCache = { text: '', audioBase64: '', voice: '' };
var ttsInflightFetches = new Map();
var getTonyAudioCallablePromise = null;

    function ttsCacheHit(testoPulito) {
        return testoPulito === lastTTSCache.text
            && !!lastTTSCache.audioBase64
            && !!lastTTSCache.voice;
    }

    function storeTTSCache(testoPulito, audioContent, voice) {
        lastTTSCache.text = testoPulito;
        lastTTSCache.audioBase64 = audioContent;
        lastTTSCache.voice = voice || '';
    }

    function buildMinimalTtsContextPayload() {
        try {
            var ctx = window.Tony && window.Tony.context;
            if (!ctx) return null;
            var dash = ctx.dashboard || {};
            var minimal = {};
            if (dash.tenantId) {
                minimal.dashboard = { tenantId: dash.tenantId };
            }
            if (dash.plan || dash.piano) {
                minimal.dashboard = minimal.dashboard || {};
                minimal.dashboard.plan = dash.plan || dash.piano;
            }
            return Object.keys(minimal).length ? minimal : null;
        } catch (_) {
            return null;
        }
    }

    async function resolveGetTonyAudioCallable() {
        if (getTonyAudioCallablePromise) return getTonyAudioCallablePromise;
        getTonyAudioCallablePromise = (async function() {
            var firebaseService = await import('../../services/firebase-service.js');
            var app = firebaseService.getAppInstance && firebaseService.getAppInstance();
            if (!app) throw new Error('Firebase non pronto');
            var firebaseFunctions = await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js');
            var functions = firebaseFunctions.getFunctions(app, 'europe-west1');
            return firebaseFunctions.httpsCallable(functions, 'getTonyAudio');
        })();
        return getTonyAudioCallablePromise;
    }

    function warmTonyTtsPipeline() {
        resolveGetTonyAudioCallable().catch(function() {});
    }

    /**
     * Fetch MP3 con dedup in-flight (prefetch + speak condividono la stessa Promise).
     * @param {string} testoPulito
     * @param {number} genAtStart
     * @returns {Promise<{ audioContent: string, voice: string }|null>}
     */
    async function fetchTonyAudioMp3(testoPulito, genAtStart) {
        if (ttsCacheHit(testoPulito)) {
            return { audioContent: lastTTSCache.audioBase64, voice: lastTTSCache.voice };
        }
        if (ttsInflightFetches.has(testoPulito)) {
            return ttsInflightFetches.get(testoPulito);
        }
        var fetchPromise = (async function() {
            try {
                var getTonyAudio = await resolveGetTonyAudioCallable();
                var ctxPayload = buildMinimalTtsContextPayload();
                var payload = ctxPayload
                    ? { text: testoPulito, context: ctxPayload }
                    : { text: testoPulito };
                var TTS_TIMEOUT_MS = 15000;
                var result = await Promise.race([
                    getTonyAudio(payload),
                    new Promise(function(_, reject) {
                        setTimeout(function() {
                            reject(new Error('getTonyAudio timeout ' + TTS_TIMEOUT_MS + 'ms'));
                        }, TTS_TIMEOUT_MS);
                    })
                ]);
                if (genAtStart !== currentGeneration()) return null;
                if (result.data && result.data.audioContent) {
                    storeTTSCache(testoPulito, result.data.audioContent, result.data.voice);
                    return { audioContent: result.data.audioContent, voice: result.data.voice };
                }
                return null;
            } finally {
                ttsInflightFetches.delete(testoPulito);
            }
        })();
        ttsInflightFetches.set(testoPulito, fetchPromise);
        return fetchPromise;
    }

    /** Trattini usati in range (es. 19–29°C). Va normalizzato prima dello strip Unicode che rimuove U+2013. */
    var TTS_DASH_CLASS = '[\\u2010-\\u2015\\-—–]';

    /**
     * Range e valori °C → forma parlata ("da 19 a 29 gradi").
     * @param {string} testo
     * @returns {string}
     */
    function normalizeTemperaturesForItalianTTS(testo) {
        if (!testo || typeof testo !== 'string') return testo;
        var dash = TTS_DASH_CLASS;
        var s = testo;
        s = s.replace(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*' + dash + '\\s*(\\d+(?:[.,]\\d+)?)\\s*°?\\s*C\\b', 'gi'), 'da $1 a $2 gradi');
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*°?\s*C\b/gi, '$1 gradi');
        s = s.replace(/\bgradi\s+celsius\b/gi, 'gradi');
        // Rete di sicurezza se en-dash già rimosso: "1929°C" / "1929 gradi" → "da 19 a 29 gradi"
        s = s.replace(/\b(\d{2})(\d{2})(?:\s*°?\s*C|\s+gradi)\b/gi, function(_m, a, b) {
            var lo = parseInt(a, 10);
            var hi = parseInt(b, 10);
            if (lo >= -15 && lo <= 50 && hi >= -15 && hi <= 50 && lo <= hi) {
                return 'da ' + lo + ' a ' + hi + ' gradi';
            }
            return _m;
        });
        s = s.replace(/\btemperature\s+(\d{2})(\d{2})\s+gradi\b/gi, function(_m, a, b) {
            var lo = parseInt(a, 10);
            var hi = parseInt(b, 10);
            if (lo >= -15 && lo <= 50 && hi >= -15 && hi <= 50 && lo <= hi) {
                return 'temperature da ' + lo + ' a ' + hi + ' gradi';
            }
            return _m;
        });
        return s;
    }

    /**
     * Sigle e codici unità → parole adatte alla lettura vocale (italiano).
     * Copre tutte le risposte Tony passate da speakWithTTS / pulisciTestoPerVoce
     * (indipendente dalla pagina: vendemmia, magazzino, concimazioni, ecc.).
     */
    function expandSpokenUnitsForItalianTTS(testo) {
        if (!testo || typeof testo !== 'string') return testo;
        var s = testo;
        // quintali
        s = s.replace(/\bq\.?\s*li\b/gi, 'quintali');
        s = s.replace(/\b(\d+(?:[.,]\d+)?)\s*ql\b/gi, '$1 quintali');
        // litri (maiuscola o minuscola dopo numero)
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*L\b/g, '$1 litri');
        s = s.replace(/(\d+(?:[.,]\d+)?)\s+l\b(?=\s|[.,;:!?]|$)/gi, '$1 litri');
        // ettari (sigla ha dopo numero — uso agricolo/ERP)
        s = s.replace(/(\d+(?:[.,]\d+)?)\s+ha\b/gi, '$1 ettari');
        // ettolitri, metri cubi, millilitri
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*hl\b/gi, '$1 ettolitri');
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*m3\b/gi, '$1 metri cubi');
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*mc\b/gi, '$1 metri cubi');
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*ml\b/gi, '$1 millilitri');
        // peso
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*kg\b/gi, '$1 chilogrammi');
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*g\b(?=\s|[.,;:!?]|$)/gi, '$1 grammi');
        // superficie
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*m2\b/gi, '$1 metri quadri');
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*mq\b/gi, '$1 metri quadri');
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*m²/g, '$1 metri quadri');
        s = normalizeTemperaturesForItalianTTS(s);
        // velocità vento
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*km\s*\/\s*h\b/gi, '$1 chilometri orari');
        // probabilità
        s = s.replace(/(\d+(?:[.,]\d+)?)\s*%/g, '$1 percento');
        return s;
    }

    function pulisciTestoPerVoce(testo) {
        if (!testo || typeof testo !== 'string') return '';
        var t = testo;
        t = normalizeTemperaturesForItalianTTS(t);
        t = t.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2016-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '');
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
        t = expandSpokenUnitsForItalianTTS(t);
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

    function prepareTextForTTS(testo) {
        if (!testo) return '';
        var testoPulito = pulisciTestoPerVoce(testo);
        if (testoPulito.indexOf('{') >= 0 || testoPulito.indexOf('"text"') >= 0 || /^\s*\{/.test(testoPulito)) {
            var extracted = extractTextForTTS(testoPulito);
            if (extracted) testoPulito = extracted;
        }
        if (!testoPulito || testoPulito.length < 2) return '';
        testoPulito = testoPulito.replace(/\s+[}\]]\s*$/g, '').trim();
        if (testoPulito.length < 15 && (/^(json\s*[}\]]?|[\s}\]]+)$/i.test(testoPulito) || /^\s*[}\]]\s*$/i.test(testoPulito))) {
            return '';
        }
        return testoPulito;
    }

    function currentGeneration() {
        return typeof window.__tonyGeneration === 'number' ? window.__tonyGeneration : 0;
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
        if (typeof window.__tonyGeneration !== 'number') window.__tonyGeneration = 0;
    }

        function stopCurrentTonyAudioElement() {
            if (!window.currentTonyAudio) return;
            try {
                var a = window.currentTonyAudio;
                a.onerror = null;
                a.onended = null;
                a.onplay = null;
                a.pause();
                a.currentTime = 0;
                a.removeAttribute('src');
                a.load();
            } catch (_) {}
            window.currentTonyAudio = null;
        }

        function clearTonyAudioPipeline(options) {
            options = options || {};
            if (options.bump === true) {
                window.__tonyGeneration = currentGeneration() + 1;
                lastTTSCache.text = '';
                lastTTSCache.audioBase64 = null;
                lastTTSCache.voice = '';
                ttsInflightFetches.clear();
            }
            window.__tonyAudioQueue = [];
            window.__tonyIsSpeaking = false;
            stopCurrentTonyAudioElement();
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            window.__tonyPlayOnInteractionScheduled = false;
            if (typeof console !== 'undefined' && console.log) {
                console.log('[Tony Voice] pipeline cleared', options.reason || '', 'gen=' + currentGeneration());
            }
        }

        function playAudioFromBase64(testoPulito, audioContent, opts, onDone, genAtStart) {
            opts = opts || {};
            if (!onDone) onDone = function() {};
            function isStale() { return genAtStart !== currentGeneration(); }

            var audioSrc = 'data:audio/mp3;base64,' + audioContent;
            window.currentTonyAudio = new Audio(audioSrc);
            window.currentTonyAudio.onplay = function() { onPlayStart(); };
            window.currentTonyAudio.onerror = function(e) {
                console.error('[Tony] Audio element error:', e);
                window.currentTonyAudio = null;
                onDone();
            };
            window.currentTonyAudio.onended = function() {
                window.currentTonyAudio = null;
                onPlayEnd(opts);
                onDone();
            };
            if (isStale()) { onDone(); return; }
            window.currentTonyAudio.play().catch(function(e) {
                if (e && e.name === 'NotAllowedError') {
                    window.currentTonyAudio = null;
                    window.__tonyAudioQueue = window.__tonyAudioQueue || [];
                    window.__tonyAudioQueue.unshift({ text: testoPulito, opts: opts, gen: genAtStart });
                    window.__tonyIsSpeaking = false;
                    schedulePlayOnFirstInteraction();
                    if (typeof console !== 'undefined' && console.log) {
                        console.log('[Tony] Audio rinviato: riproduzione al primo click (policy browser).');
                    }
                    return;
                }
                console.error('[Tony] Errore play():', e);
                onDone();
            });
        }

        function processNextAudio() {
            if (window.__tonyIsSpeaking || !window.__tonyAudioQueue || window.__tonyAudioQueue.length === 0) return;
            var item = window.__tonyAudioQueue.shift();
            if (!item || !item.text) {
                processNextAudio();
                return;
            }
            if (item.gen != null && item.gen !== currentGeneration()) {
                processNextAudio();
                return;
            }
            window.__tonyIsSpeaking = true;
            playOneTTS(item.text, item.opts || {}, function() {
                window.__tonyIsSpeaking = false;
                processNextAudio();
            }, item.gen);
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

        function playOneTTS(testoPulito, opts, onDone, genFromQueue) {
            opts = opts || {};
            if (!onDone) onDone = function() {};
            var genAtStart = genFromQueue != null ? genFromQueue : (opts.gen != null ? opts.gen : currentGeneration());
            function isStale() { return genAtStart !== currentGeneration(); }
            if (opts.forceInterrupt) clearTonyAudioPipeline({ bump: false, reason: 'force_interrupt' });
            if (isStale()) { onDone(); return; }

            if (ttsCacheHit(testoPulito)) {
                playAudioFromBase64(testoPulito, lastTTSCache.audioBase64, opts, onDone, genAtStart);
                return;
            }

            (async function() {
                try {
                    var audioResult = await fetchTonyAudioMp3(testoPulito, genAtStart);
                    if (isStale()) { onDone(); return; }
                    if (audioResult && audioResult.audioContent) {
                        playAudioFromBase64(testoPulito, audioResult.audioContent, opts, onDone, genAtStart);
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
            var testoPulito = prepareTextForTTS(testo);
            if (!testoPulito) {
                onPlayEnd(opts);
                return;
            }
            var gen = opts.gen != null ? opts.gen : currentGeneration();
            window.__tonyAudioQueue = window.__tonyAudioQueue || [];
            window.__tonyAudioQueue.push({ text: testoPulito, opts: opts, gen: gen });
            processNextAudio();
        }

        /** Avvia getTonyAudio in parallelo (warm cache) senza bloccare la UI chat. */
        function prefetchTonyTTS(testo, genOverride) {
            if (!testo || typeof testo !== 'string') return;
            var genAtStart = genOverride != null ? genOverride : currentGeneration();
            var testoPulito = prepareTextForTTS(testo);
            if (!testoPulito) return;
            if (ttsCacheHit(testoPulito)) return;
            fetchTonyAudioMp3(testoPulito, genAtStart).catch(function() {
                /* prefetch best-effort */
            });
        }

        if (typeof window !== 'undefined') {
            window.__tonyPrefetchTTS = prefetchTonyTTS;
            window.__tonyClearAudioPipeline = clearTonyAudioPipeline;
            window.__tonyWarmTTS = warmTonyTtsPipeline;
            window.__tonyTtsCanary = function runTonyTtsCanary(options) {
                options = options || {};
                var manifest = {
                    loaderBuild: window.__TONY_LOADER_BUILD || null,
                    clientBuild: window.__TONY_CLIENT_BUILD || null,
                    generation: currentGeneration(),
                    warmTts: typeof window.__tonyWarmTTS === 'function',
                    prefetchTts: typeof window.__tonyPrefetchTTS === 'function',
                    cacheText: lastTTSCache.text ? lastTTSCache.text.slice(0, 48) : null,
                    speakingRateNote: '1.05 default server (serve deploy CF getTonyAudio)',
                    features: {
                        callableCached: !!getTonyAudioCallablePromise,
                        inflightDedup: true,
                        minimalContext: true,
                        warmOnInit: true,
                        warmOnTyping: true
                    }
                };
                console.log('[Tony TTS Canary] manifest', manifest);
                if (typeof console.table === 'function') console.table(manifest.features);
                if (options.speakTest === true && typeof prefetchTonyTTS === 'function' && typeof speakWithTTS === 'function') {
                    var sample = 'Prova voce Tony. Uno due tre.';
                    var t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
                    warmTonyTtsPipeline();
                    prefetchTonyTTS(sample);
                    speakWithTTS(sample, { _canary: true });
                    var syncMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
                    console.log('[Tony TTS Canary] sample queued in ' + syncMs.toFixed(1) + ' ms (audio async via getTonyAudio)');
                }
                return manifest;
            };
            warmTonyTtsPipeline();
        }

    return {
        speakWithTTS: speakWithTTS,
        prefetchTonyTTS: prefetchTonyTTS,
        clearTonyAudioPipeline: clearTonyAudioPipeline,
        warmTonyTtsPipeline: warmTonyTtsPipeline
    };
}

export { expandSpokenUnitsForItalianTTS, normalizeTemperaturesForItalianTTS, pulisciTestoPerVoce };

/**
 * Tony Widget – Voice/TTS: coda audio, playOneTTS, speakWithTTS.
 * @module core/js/tony/voice
 */

import { tonyDebugLog } from './debug.js';
import { normalizeTonyTextWhitespace } from './engine.js';

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

    /**
     * Contrazioni con apostrofo che Chirp3 legge male (es. c'è → "cì").
     * Espande in forma parlata esplicita prima della sintesi.
     * @param {string} testo
     * @returns {string}
     */
    function normalizeItalianContractionsForTTS(testo) {
        if (!testo || typeof testo !== 'string') return testo;
        var apos = "['\u2019`\u00B4]";
        var s = testo;
        s = s.replace(new RegExp('\\b([Cc])' + apos + '?\\s*([eéèEÉÈ])(?:' + apos + ')?(?=[\\s.,;:!?]|$)', 'g'), function(_m, c1) {
            return (c1 === 'C' ? 'Ci' : 'ci') + ' è';
        });
        s = s.replace(new RegExp("\\bC'E'\\b", 'g'), 'Ci è');
        s = s.replace(new RegExp("\\bc'e'\\b", 'gi'), 'ci è');
        s = s.replace(new RegExp('\\bc' + apos + '?(era|erano)\\b', 'gi'), function(_m, tail) {
            return 'ci ' + String(tail).toLowerCase();
        });
        return s;
    }

    /** Parole che seguono un 1 pronominale: «da 1 a 5», «1 su 3», «ne ho 1». */
    var TTS_ONE_FOLLOWERS = {
        a: 1, ad: 1, al: 1, allo: 1, alla: 1, ai: 1, agli: 1, alle: 1,
        di: 1, del: 1, dello: 1, della: 1, dei: 1, degli: 1, delle: 1,
        da: 1, dal: 1, dallo: 1, dalla: 1, dai: 1, dagli: 1, dalle: 1,
        in: 1, nel: 1, nello: 1, nella: 1, nei: 1, negli: 1, nelle: 1,
        con: 1, su: 1, sul: 1, sullo: 1, sulla: 1, sui: 1, sugli: 1, sulle: 1,
        per: 1, tra: 1, fra: 1, e: 1, ed: 1, o: 1, od: 1, ma: 1, che: 1, se: 1,
        non: 1, piu: 1, 'più': 1, meno: 1, circa: 1, verso: 1, fino: 1, oltre: 1,
        dopo: 1, prima: 1, anche: 1, gia: 1, 'già': 1, ancora: 1, quasi: 1,
        proprio: 1, poi: 1, quindi: 1, oppure: 1, mentre: 1, quando: 1, dove: 1,
        come: 1, perche: 1, 'perché': 1, contro: 1, senza: 1, sopra: 1, sotto: 1,
        durante: 1
    };

    var TTS_ONE_NUMBER_WORDS = {
        zero: 1, due: 1, tre: 1, quattro: 1, cinque: 1, sei: 1, sette: 1, otto: 1, nove: 1,
        dieci: 1, undici: 1, dodici: 1, tredici: 1, quattordici: 1, quindici: 1, sedici: 1,
        diciassette: 1, diciotto: 1, diciannove: 1, venti: 1, trenta: 1, quaranta: 1,
        cinquanta: 1, sessanta: 1, settanta: 1, ottanta: 1, novanta: 1, cento: 1, mille: 1, mila: 1
    };

    var TTS_ONE_MONTHS = {
        gennaio: 1, febbraio: 1, marzo: 1, aprile: 1, maggio: 1, giugno: 1,
        luglio: 1, agosto: 1, settembre: 1, ottobre: 1, novembre: 1, dicembre: 1
    };

    /** Maschili in -a (non «una problema»). */
    var TTS_ONE_MASC_A = {
        problema: 1, sistema: 1, programma: 1, clima: 1, tema: 1, schema: 1,
        diploma: 1, poema: 1, panorama: 1, dramma: 1, fantasma: 1, cinema: 1,
        aroma: 1, teorema: 1, dilemma: 1, trauma: 1, pigiama: 1, delta: 1,
        coma: 1, karma: 1, sosia: 1, gorilla: 1, cobra: 1, boa: 1
    };

    /** Femminili che non finiscono in -a. */
    var TTS_ONE_FEM = {
        voce: 1, rete: 1, superficie: 1, specie: 1, serie: 1, analisi: 1,
        crisi: 1, sintesi: 1, ipotesi: 1, tesi: 1, mano: 1, auto: 1, moto: 1,
        foto: 1, radio: 1, notte: 1, chiave: 1, gente: 1, arte: 1, parte: 1,
        nave: 1, classe: 1, torre: 1, valle: 1, carne: 1, pelle: 1, fonte: 1,
        sorte: 1, luce: 1, pace: 1, croce: 1, neve: 1, fede: 1, legge: 1,
        macchine: 1, squadre: 1, giornate: 1, bolle: 1, fatture: 1, note: 1,
        schede: 1, pagine: 1, righe: 1, aziende: 1
    };

    var TTS_ONE_CLOCK_NEXT = {
        di: 1, del: 1, dello: 1, della: 1, dei: 1, degli: 1, delle: 1,
        in: 1, nel: 1, nello: 1, nella: 1, nei: 1, negli: 1, nelle: 1,
        punto: 1, passate: 1, circa: 1, e: 1, ed: 1, alle: 1, dalle: 1, le: 1, ore: 1,
        meno: 1, quarto: 1, mezza: 1, mezzo: 1, mattina: 1, pomeriggio: 1,
        sera: 1, notte: 1, preciso: 1, precisa: 1, spaccate: 1
    };

    var TTS_ONE_UNIT_SINGULAR = {
        'chilometri orari': 'chilometro orario',
        'metri cubi': 'metro cubo',
        'metri quadri': 'metro quadro',
        quintali: 'quintale',
        ettolitri: 'ettolitro',
        millilitri: 'millilitro',
        chilogrammi: 'chilogrammo',
        ettari: 'ettaro',
        litri: 'litro',
        grammi: 'grammo'
    };

    function ttsFirstWord(tail) {
        var m = String(tail || '').match(/^\s*[,;:.!?)»"'\]]*([0-9A-Za-zÀ-ÿ']+)/);
        return m ? m[1] : '';
    }

    function ttsRestAfterFirstWord(tail) {
        var m = String(tail || '').match(/^\s*[,;:.!?)»"'\]]*([0-9A-Za-zÀ-ÿ']+)([\s\S]*)$/);
        return m ? m[2] : '';
    }

    function ttsGenderOf(word) {
        var w = String(word || '').toLowerCase();
        if (!w) return null;
        if (TTS_ONE_MASC_A[w]) return 'm';
        if (TTS_ONE_FEM[w]) return 'f';
        if (/(?:zione|sione|gione|trice|zioni|sioni|gioni|trici)$/i.test(w)) return 'f';
        if (/[àù]$/i.test(w)) return 'f';
        if (/a$/i.test(w)) return 'f';
        if (/o$/i.test(w)) return 'm';
        return null;
    }

    function ttsNeedsUnoOnset(word) {
        return /^(?:s[^aeiouàèéìòù]|z|gn|ps|pn|x|y|i[aeiouàèéìòù])/i.test(word);
    }

    function ttsVowelSound(word) {
        return /^(?:h)?[aeiouàèéìòù]/i.test(word);
    }

    /**
     * Forma parlata del cardinale 1 davanti alla coda (parola successiva).
     * @param {string} tail
     * @returns {'un'|'uno'|'una'|'un\''|'primo'}
     */
    function italianOneForm(tail) {
        if (/^\s*[.)](?:\s|$)/.test(tail)) {
            var afterList = tail.replace(/^\s*[.)]\s*/, '');
            var listNext = ttsFirstWord(afterList);
            if (!listNext || /^[A-ZÀ-Ý]/.test(listNext)) return 'uno';
        }
        var word = ttsFirstWord(tail);
        if (!word) return 'uno';
        var low = word.toLowerCase();
        if (TTS_ONE_MONTHS[low]) return 'primo';
        if (/^\d/.test(word) || TTS_ONE_NUMBER_WORDS[low] || TTS_ONE_FOLLOWERS[low]) return 'uno';
        if (low === 'solo' || low === 'soltanto') {
            var secondOnly = ttsFirstWord(ttsRestAfterFirstWord(tail));
            var secondLow = secondOnly.toLowerCase();
            if (!secondOnly || /^\d/.test(secondOnly) || TTS_ONE_FOLLOWERS[secondLow] || TTS_ONE_NUMBER_WORDS[secondLow]) {
                return 'uno';
            }
        }
        var gender = ttsGenderOf(low);
        if (!gender) {
            var second = ttsFirstWord(ttsRestAfterFirstWord(tail));
            var secLow = second.toLowerCase();
            if (second && !TTS_ONE_FOLLOWERS[secLow] && !TTS_ONE_NUMBER_WORDS[secLow] && !/^\d/.test(second) && !TTS_ONE_MONTHS[secLow]) {
                gender = ttsGenderOf(secLow);
            }
        }
        if (gender === 'f') {
            var pluralish = /i$/i.test(low);
            if (!pluralish && ttsVowelSound(low)) return "un'";
            return 'una';
        }
        if (ttsNeedsUnoOnset(low)) return 'uno';
        return 'un';
    }

    function shapeSpokenOne(form, token, sentenceStart) {
        if (token && token !== '1' && token === token.toUpperCase()) return form.toUpperCase();
        var cap = sentenceStart || (token && token !== '1' && token.charAt(0) !== token.charAt(0).toLowerCase());
        if (!cap) return form;
        return form.charAt(0).toUpperCase() + form.slice(1);
    }

    function isTtsSentenceStart(full, offset) {
        var before = String(full || '').slice(0, offset).replace(/\s+$/, '');
        return before.length === 0 || /[.!?]$/.test(before);
    }

    function singularizeSpokenMeasure(unitChunk) {
        var key = String(unitChunk || '').replace(/^\s+/, '').replace(/\s+/g, ' ').toLowerCase();
        return TTS_ONE_UNIT_SINGULAR[key] || '';
    }

    function isClockTail(after) {
        var word = ttsFirstWord(after);
        if (!word) return true;
        if (/^\d/.test(word)) return true;
        return !!TTS_ONE_CLOCK_NEXT[word.toLowerCase()];
    }

    /**
     * «alle 1» / «dalle 1» / «le 1» → all'una / dall'una / l'una, se non segue un nome.
     * @param {string} testo
     * @returns {string}
     */
    function rewriteItalianOneOClock(testo) {
        if (!testo || typeof testo !== 'string') return testo;
        return testo.replace(/\b(alle|dalle|le|ore)\s+1(?!\d)(?![.,]\d)(?![:/%°ºª])/gi, function(full, prep, offset, str) {
            var after = str.slice(offset + full.length);
            if (!isClockTail(after)) return full;
            var low = prep.toLowerCase();
            var repl = low === 'alle' ? "all'una"
                : low === 'dalle' ? "dall'una"
                : low === 'le' ? "l'una"
                : 'ore una';
            if (prep.charAt(0) !== prep.charAt(0).toLowerCase()) {
                repl = repl.charAt(0).toUpperCase() + repl.slice(1);
            }
            return repl;
        });
    }

    /**
     * Cifra 1 (e «uno» già scritto) → un / uno / una / un' / primo, in base alla parola che segue.
     * Il 1 isolato: il TTS italiano lo legge sempre «uno» («uno trattore»).
     * @param {string} testo
     * @returns {string}
     */
    function normalizeItalianCardinalOneForTTS(testo) {
        if (!testo || typeof testo !== 'string') return testo;
        var s = rewriteItalianOneOClock(testo);
        var unitAlt = 'chilometri\\s+orari|metri\\s+cubi|metri\\s+quadri|quintali|ettolitri|millilitri|chilogrammi|ettari|litri|grammi';
        var re = new RegExp(
            "(^|[^0-9A-Za-zÀ-ÿ'’])(1|uno)(?![0-9A-Za-zÀ-ÿ])(?:\\s+(?:" + unitAlt + '))?',
            'gi'
        );
        s = s.replace(re, function(match, prefix, token, offset, full) {
            var tokenEnd = offset + String(prefix || '').length + String(token || '').length;
            var unitChunk = full.slice(tokenEnd, offset + match.length);
            var tail = full.slice(tokenEnd);
            if (/^1$/i.test(token)) {
                if (/^[.,]\d/.test(tail)) return match;
                if (/^[:/%°ºª]/.test(tail)) return match;
                if (/^\s*\//.test(tail)) return match;
                if (/^[-–—]\d/.test(tail) || /^\s*[-–—]\s*\d/.test(tail)) return match;
            }
            var singular = singularizeSpokenMeasure(unitChunk);
            var form = singular
                ? italianOneForm(' ' + singular)
                : italianOneForm(tail);
            if (!singular && token.toLowerCase() === 'uno' && form === 'uno') return match;
            var shaped = shapeSpokenOne(form, token, isTtsSentenceStart(full, offset));
            return prefix + shaped + (singular ? ' ' + singular : '');
        });
        s = s.replace(/([Uu])n'\s+/g, function(_m, u) {
            return u === 'U' ? "Un'" : "un'";
        });
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
        t = normalizeItalianContractionsForTTS(t);
        t = normalizeTonyTextWhitespace(t);
        t = normalizeItalianCardinalOneForTTS(t);
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
            tonyDebugLog('[Tony Voice] pipeline cleared', options.reason || '', 'gen=' + currentGeneration());
        }

        /**
         * iOS blocca HTMLAudioElement.play() dopo un await (getTonyAudio) se non
         * abbiamo sbloccato l'audio in un gesto utente (tap FAB / mic).
         * Uno WAV silenzioso suonato al tap sblocca la sessione.
         */
        var SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

        function prepareTonyAudioElement(audio) {
            if (!audio) return audio;
            try {
                audio.setAttribute('playsinline', 'true');
                audio.setAttribute('webkit-playsinline', 'true');
                audio.playsInline = true;
            } catch (_) { /* ignore */ }
            return audio;
        }

        function unlockTonyHtmlAudio() {
            if (typeof window === 'undefined' || window.__tonyHtmlAudioUnlocked) return;
            try {
                var a = window.__tonyUnlockAudioEl;
                if (!a) {
                    a = window.__tonyUnlockAudioEl = new Audio(SILENT_WAV);
                    prepareTonyAudioElement(a);
                    a.volume = 0.01;
                }
                var p = a.play();
                if (p && typeof p.then === 'function') {
                    p.then(function () {
                        try { a.pause(); a.currentTime = 0; } catch (_) {}
                        window.__tonyHtmlAudioUnlocked = true;
                    }).catch(function () { /* prossimo gesto */ });
                } else {
                    window.__tonyHtmlAudioUnlocked = true;
                }
            } catch (_) { /* ignore */ }
        }

        if (typeof window !== 'undefined') {
            window.__tonyUnlockHtmlAudio = unlockTonyHtmlAudio;
        }

        function playAudioFromBase64(testoPulito, audioContent, opts, onDone, genAtStart) {
            opts = opts || {};
            if (!onDone) onDone = function() {};
            function isStale() { return genAtStart !== currentGeneration(); }

            var audioSrc = 'data:audio/mp3;base64,' + audioContent;
            window.currentTonyAudio = prepareTonyAudioElement(new Audio(audioSrc));
            window.currentTonyAudio.onplay = function() { onPlayStart(); };
            window.currentTonyAudio.onerror = function(e) {
                console.error('[Tony] Audio element error:', e);
                window.currentTonyAudio = null;
                onDone();
            };
            window.currentTonyAudio.onended = function() {
                window.currentTonyAudio = null;
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
                    tonyDebugLog('[Tony] Audio rinviato: riproduzione al primo click (policy browser).');
                    return;
                }
                console.error('[Tony] Errore play():', e);
                onDone();
            });
        }

        /** Fine clip TTS: avanza coda o notifica idle (onPlayEnd) solo a pipeline vuota. */
        function completeTtsClip(clipOpts) {
            window.__tonyIsSpeaking = false;
            if (window.__tonyAudioQueue && window.__tonyAudioQueue.length > 0) {
                processNextAudio();
                return;
            }
            try {
                var a = window.currentTonyAudio;
                if (a && !a.ended && !a.paused) return;
            } catch (_) { /* ignore */ }
            onPlayEnd(clipOpts || {});
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
            if (window.__tonyAudioQueue && window.__tonyAudioQueue.length > 0) {
                window.__tonyAudioQueue.forEach(function(queued) {
                    if (queued && queued.text) {
                        fetchTonyAudioMp3(queued.text, queued.gen != null ? queued.gen : currentGeneration()).catch(function() {});
                    }
                });
            }
            playOneTTS(item.text, item.opts || {}, item.gen);
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

        function playOneTTS(testoPulito, opts, genFromQueue) {
            opts = opts || {};
            var genAtStart = genFromQueue != null ? genFromQueue : (opts.gen != null ? opts.gen : currentGeneration());
            function isStale() { return genAtStart !== currentGeneration(); }
            function afterClipDone() { completeTtsClip(opts); }
            if (opts.forceInterrupt) clearTonyAudioPipeline({ bump: false, reason: 'force_interrupt' });
            if (isStale()) { completeTtsClip(opts); return; }

            if (ttsCacheHit(testoPulito)) {
                playAudioFromBase64(testoPulito, lastTTSCache.audioBase64, opts, afterClipDone, genAtStart);
                return;
            }

            (async function() {
                try {
                    var audioResult = await fetchTonyAudioMp3(testoPulito, genAtStart);
                    if (isStale()) { completeTtsClip(opts); return; }
                    if (audioResult && audioResult.audioContent) {
                        playAudioFromBase64(testoPulito, audioResult.audioContent, opts, afterClipDone, genAtStart);
                    } else {
                        completeTtsClip(opts);
                    }
                } catch (err) {
                    console.error('[Tony] Errore critico getTonyAudio:', err);
                    completeTtsClip(opts);
                }
            })();
        }

        function speakWithTTS(testo, opts) {
            opts = opts || {};
            if (!testo) {
                return;
            }
            var testoPulito = prepareTextForTTS(testo);
            if (!testoPulito) {
                return;
            }
            var gen = opts.gen != null ? opts.gen : currentGeneration();
            window.__tonyAudioQueue = window.__tonyAudioQueue || [];
            window.__tonyAudioQueue.push({ text: testoPulito, opts: opts, gen: gen });
            if (window.__tonyIsSpeaking) {
                fetchTonyAudioMp3(testoPulito, gen).catch(function() {});
            }
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
                    speakingRateNote: '1.0 default server (serve deploy CF getTonyAudio)',
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
        warmTonyTtsPipeline: warmTonyTtsPipeline,
        unlockTonyHtmlAudio: unlockTonyHtmlAudio
    };
}

export { expandSpokenUnitsForItalianTTS, normalizeTemperaturesForItalianTTS, normalizeItalianContractionsForTTS, normalizeItalianCardinalOneForTTS, pulisciTestoPerVoce };

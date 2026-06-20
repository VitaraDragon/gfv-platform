/**
 * Fase 2 — TTS per frase durante streaming SSE Tony.
 * Estrae frasi complete (. ? ! o newline) senza spezzare decimali (es. 3.5 ha).
 * @module core/js/tony/stream-tts-chunk
 */

export const STREAM_TTS_MIN_SENTENCE_LEN = 3;

/**
 * Indice (esclusivo) fine prima frase completa da fromIndex, o -1.
 * @param {string} text
 * @param {number} fromIndex
 * @returns {number}
 */
export function findNextSentenceBoundary(text, fromIndex) {
  if (!text || fromIndex >= text.length) return -1;
  for (var i = fromIndex; i < text.length; i++) {
    var ch = text[i];
    if (ch !== '.' && ch !== '?' && ch !== '!' && ch !== '\n') continue;

    if (ch === '.') {
      if (i > 0 && i + 1 < text.length && /\d/.test(text[i - 1]) && /\d/.test(text[i + 1])) continue;
      if (i + 1 < text.length && text[i + 1] === '.') {
        while (i + 1 < text.length && text[i + 1] === '.') i += 1;
        continue;
      }
    }

    if (ch === '\n') {
      var line = text.slice(fromIndex, i).trim();
      if (line.length < STREAM_TTS_MIN_SENTENCE_LEN) continue;
      return i + 1;
    }

    return i + 1;
  }
  return -1;
}

/**
 * @param {string} text
 * @param {{ consumedLength?: number, lastCleanText?: string }} state
 * @returns {{ sentences: string[], state: { consumedLength: number, lastCleanText: string } }}
 */
export function consumeCompleteStreamingSentences(text, state) {
  var clean = text != null ? String(text) : '';
  state = state || {};
  var consumed = typeof state.consumedLength === 'number' ? state.consumedLength : 0;
  if (clean.length < consumed) consumed = 0;

  var sentences = [];
  var pos = consumed;

  while (pos < clean.length) {
    var boundary = findNextSentenceBoundary(clean, pos);
    if (boundary < 0) break;
    var sentence = clean.slice(pos, boundary).trim();
    pos = boundary;
    while (pos < clean.length && /\s/.test(clean[pos])) pos += 1;
    if (sentence.length >= STREAM_TTS_MIN_SENTENCE_LEN) {
      sentences.push(sentence);
      consumed = pos;
    } else if (sentence.length > 0) {
      consumed = pos;
    } else {
      consumed = pos;
    }
  }

  return {
    sentences: sentences,
    state: {
      consumedLength: consumed,
      lastCleanText: clean,
    },
  };
}

/**
 * Testo non ancora inviato a TTS (ultima frase incompleta o coda).
 * @param {string} text
 * @param {{ consumedLength?: number }} state
 * @returns {string}
 */
export function getStreamingTtsRemainder(text, state) {
  var clean = text != null ? String(text) : '';
  var consumed = state && typeof state.consumedLength === 'number' ? state.consumedLength : 0;
  if (clean.length < consumed) consumed = 0;
  return clean.slice(consumed).trim();
}

/**
 * Applica chunk TTS su testo stream pulito (prefetch + speak per ogni nuova frase).
 * @param {string} cleanText
 * @param {{ consumedLength?: number, lastCleanText?: string, active?: boolean, gen?: number }} state
 * @param {{ prefetch?: function, speak?: function, opts?: object, gen?: number }} handlers
 * @returns {{ state: object, spokeCount: number }}
 */
export function applyStreamingTtsChunks(cleanText, state, handlers) {
  handlers = handlers || {};
  var result = consumeCompleteStreamingSentences(cleanText, state);
  var gen = handlers.gen != null ? handlers.gen : (state && state.gen);
  var ttsOpts = Object.assign({}, handlers.opts || {}, gen != null ? { gen: gen } : {});
  var spokeCount = 0;

  result.sentences.forEach(function(sentence) {
    if (typeof handlers.prefetch === 'function') {
      try { handlers.prefetch(sentence, gen); } catch (_) { /* ignore */ }
    }
    if (typeof handlers.speak === 'function') {
      handlers.speak(sentence, ttsOpts);
      spokeCount += 1;
    }
  });

  return {
    state: Object.assign({}, result.state, {
      active: true,
      gen: gen != null ? gen : (state && state.gen),
    }),
    spokeCount: spokeCount,
  };
}

/**
 * TTS a frasi per risposte complete (quick reply, ask non-stream, onComplete stream).
 * @param {string} text
 * @param {{ prefetch?: function, speak?: function, opts?: object, gen?: number }} handlers
 * @returns {number} frasi inviate a speak
 */
export function speakTextInSentenceChunks(text, handlers) {
  handlers = handlers || {};
  var clean = text != null ? String(text).trim() : '';
  if (!clean || clean.length < 2) return 0;
  var gen = handlers.gen;
  var ttsOpts = Object.assign({}, handlers.opts || {}, gen != null ? { gen: gen } : {});
  var chunkResult = applyStreamingTtsChunks(clean, { consumedLength: 0, gen: gen }, {
    gen: gen,
    opts: ttsOpts,
    prefetch: handlers.prefetch,
    speak: handlers.speak,
  });
  var remainder = getStreamingTtsRemainder(clean, chunkResult.state);
  if (remainder && remainder.length >= 2) {
    if (typeof handlers.prefetch === 'function') {
      try {
        handlers.prefetch(remainder, gen);
      } catch (_) {
        /* ignore */
      }
    }
    if (typeof handlers.speak === 'function') {
      handlers.speak(remainder, ttsOpts);
      return chunkResult.spokeCount + 1;
    }
  }
  return chunkResult.spokeCount;
}

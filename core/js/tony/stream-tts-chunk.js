/**
 * Fase 2 — TTS per frase durante streaming SSE Tony.
 * Estrae frasi complete (. ? ! o newline) senza spezzare decimali (es. 3.5 ha).
 * @module core/js/tony/stream-tts-chunk
 */

export const STREAM_TTS_MIN_SENTENCE_LEN = 3;
/** Frasi per clip TTS: punti conservati (pause naturali Chirp3), meno gap rete tra clip. */
export const STREAM_TTS_BATCH_MAX_SENTENCES = 2;

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
  if (clean.length < consumed) {
    // Buffer visibile accorciato (JSON nascosto): riallinea l'offset, non resettare a zero.
    var prev = state.lastCleanText != null ? String(state.lastCleanText) : '';
    if (prev && prev.indexOf(clean) === 0) {
      consumed = Math.min(consumed, clean.length);
    } else {
      var realigned = consumeCompleteStreamingSentences(clean, { consumedLength: 0 });
      consumed = realigned.state.consumedLength;
    }
  }

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
  // Testo finale (post-sanitizer) più corto del buffer stream: non resettare consumed
  // (altrimenti si rilegge l'intera risposta a voce — bug mobile/PWA).
  if (clean.length < consumed) return '';
  return clean.slice(consumed).trim();
}

/**
 * Remainder voce dopo prima frase in stream: usa testo finale CF (non buffer parziale).
 * @param {string} finalText — testo pulito mostrato in chat
 * @param {{ consumedLength?: number, earlyVoiceSpoken?: boolean, spokeCount?: number }} state
 * @returns {string}
 */
export function resolveVoiceTtsRemainder(finalText, state) {
  state = state || {};
  var clean = finalText != null ? String(finalText).trim() : '';
  if (!clean || clean.length < 2) return '';
  if (!state.earlyVoiceSpoken) return clean;
  var remainder = getStreamingTtsRemainder(clean, state);
  if (remainder && remainder.length >= 2) return remainder;
  var reparsed = consumeCompleteStreamingSentences(clean, { consumedLength: 0 });
  if (reparsed.sentences.length > 1) {
    return joinSentencesForItalianTts(reparsed.sentences.slice(1));
  }
  if ((state.spokeCount || 0) > 0 && reparsed.sentences.length === 1) {
    var first = reparsed.sentences[0];
    var idx = clean.indexOf(first);
    if (idx >= 0) {
      var tail = clean.slice(idx + first.length).trim();
      if (tail.length >= 2) return tail;
    }
  }
  return '';
}

/**
 * Tutti i segmenti TTS (frasi complete + coda senza punto finale).
 * @param {string} text
 * @returns {string[]}
 */
export function extractAllTtsSegments(text) {
  var clean = text != null ? String(text).trim() : '';
  if (!clean || clean.length < 2) return [];
  var parsed = consumeCompleteStreamingSentences(clean, { consumedLength: 0 });
  var segments = parsed.sentences.slice();
  var tail = getStreamingTtsRemainder(clean, parsed.state);
  if (tail && tail.length >= 2) segments.push(tail);
  return segments;
}

/**
 * @param {string} seg
 * @returns {string}
 */
export function normalizeTtsSegmentKey(seg) {
  return String(seg).replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Segmento già in coda audio (match fuzzy su batch multi-frase).
 * @param {string} seg
 * @param {string[]} pendingTexts
 * @returns {boolean}
 */
export function isTtsSegmentPending(seg, pendingTexts) {
  if (!seg || !pendingTexts || !pendingTexts.length) return false;
  var key = normalizeTtsSegmentKey(seg);
  if (!key) return false;
  for (var i = 0; i < pendingTexts.length; i++) {
    var qt = normalizeTtsSegmentKey(pendingTexts[i]);
    if (!qt) continue;
    if (qt === key || qt.indexOf(key) >= 0 || key.indexOf(qt) >= 0) return true;
    if (key.length > 24 && qt.indexOf(key.slice(0, 24)) >= 0) return true;
  }
  return false;
}

/**
 * Segmenti voce non ancora letti rispetto al testo finale CF (no salti se stream ≠ finale).
 * @param {string} finalText
 * @param {{ earlyVoiceSpoken?: boolean, sentencesSpokenCount?: number }} state
 * @param {string[]} [pendingQueueTexts]
 * @returns {string[]}
 */
export function reconcileUnspokenVoiceSegments(finalText, state, pendingQueueTexts) {
  state = state || {};
  pendingQueueTexts = pendingQueueTexts || [];
  var segments = extractAllTtsSegments(finalText);
  if (!segments.length) return [];
  if (!state.earlyVoiceSpoken) return segments;
  var spoken = typeof state.sentencesSpokenCount === 'number' ? state.sentencesSpokenCount : 0;
  var unspoken = segments.slice(Math.min(spoken, segments.length));
  return unspoken.filter(function(seg) {
    return !isTtsSegmentPending(seg, pendingQueueTexts);
  });
}

/**
 * @param {string[]} sentences
 * @returns {string}
 */
export function joinSentencesForItalianTts(sentences) {
  if (!sentences || !sentences.length) return '';
  return sentences
    .map(function(s) { return String(s).trim(); })
    .filter(function(s) { return s.length > 0; })
    .join(' ');
}

/**
 * @param {string[]} sentences
 * @param {{ maxSentences?: number }} [options]
 * @returns {string[][]}
 */
export function batchSentencesForTts(sentences, options) {
  options = options || {};
  var max = options.maxSentences != null ? options.maxSentences : STREAM_TTS_BATCH_MAX_SENTENCES;
  if (!sentences || !sentences.length) return [];
  var batches = [];
  for (var i = 0; i < sentences.length; i += max) {
    batches.push(sentences.slice(i, i + max));
  }
  return batches;
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

  batchSentencesForTts(result.sentences).forEach(function(batch) {
    var ttsText = joinSentencesForItalianTts(batch);
    if (!ttsText || ttsText.length < 2) return;
    if (typeof handlers.prefetch === 'function') {
      try { handlers.prefetch(ttsText, gen); } catch (_) { /* ignore */ }
    }
    if (typeof handlers.speak === 'function') {
      handlers.speak(ttsText, ttsOpts);
      spokeCount += 1;
    }
  });

  return {
    state: Object.assign({}, result.state, {
      active: true,
      gen: gen != null ? gen : (state && state.gen),
    }),
    spokeCount: spokeCount,
    sentencesQueued: result.sentences.length,
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

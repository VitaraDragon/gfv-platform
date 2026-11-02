/** Pure helpers — intento congedo vocale/testo (testabili senza DOM). */

const GREETING_HINTS = [
  'tutto bene', 'tutto ok', 'come stai', 'come va',
  'buongiorno', 'buonasera', 'buon pomeriggio', 'bentornato',
];

const PHRASE_HITS = [
  'posto così', 'a posto', 'basta così', 'ottimo così', 'perfetto così',
  'va bene così', 'va bene cosi', 'ci sentiamo', 'a dopo', 'buon lavoro',
  'ciao tony a dopo', 'ciao tony grazie', 'arrivederci',
  'vai via', 'stai zitto',
];

const WORD_HITS = [
  'grazie', 'apposto', 'basta', 'chiudi', 'termina', 'fine', 'saluti',
  'vattene', 'fermati', 'smettila', 'ciao',
];

const INSULT_MARKERS = [
  'scemo', 'stupido', 'idiota', 'cretino', 'vaffa', 'vaffanculo',
  'minchia', 'stronzo', 'imbecille',
];

function normalizeFarewellText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function wordBoundaryMatch(t, w) {
  var esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?:^|[\\s,.!?;:])' + esc + '(?:$|[\\s,.!?;:])', 'i').test(t);
}

function looksLikeTaskOrQuestion(t) {
  if (/\?/.test(t)) return true;
  if (/\b(mi|puoi|potresti|vorrei|devi|segna|segni|apri|portami|quanto|quando|come|dove|perche|perché)\b/i.test(t)) {
    return true;
  }
  return false;
}

function isStandaloneCiao(t, words) {
  if (words.length !== 1) return false;
  return /^ciao[.!?]*$/i.test(words[0]);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isFarewellInsult(text) {
  var t = normalizeFarewellText(text);
  if (!t) return false;
  return INSULT_MARKERS.some(function (m) {
    if (m === 'vaffa') return /\bvaffa/i.test(t);
    return wordBoundaryMatch(t, m) || t.indexOf(m) !== -1;
  });
}

/**
 * @param {string} text
 * @param {{ tonyHaGiaRisposto?: boolean }} [opts]
 * @returns {boolean}
 */
export function checkFarewellIntent(text, opts) {
  opts = opts || {};
  if (!text || typeof text !== 'string') return false;
  var t = normalizeFarewellText(text);
  var words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 8) return false;
  if (GREETING_HINTS.some(function (g) { return t.indexOf(g) !== -1; })) return false;
  if (looksLikeTaskOrQuestion(t)) return false;

  if (isFarewellInsult(text)) return true;

  if (PHRASE_HITS.some(function (p) { return t.indexOf(p) !== -1; })) return true;

  if (isStandaloneCiao(t, words)) {
    return opts.tonyHaGiaRisposto === true;
  }

  return WORD_HITS.some(function (w) {
    if (w === 'ciao') {
      if (!opts.tonyHaGiaRisposto) return false;
      return wordBoundaryMatch(t, w);
    }
    return wordBoundaryMatch(t, w);
  });
}

/**
 * @param {string} text
 * @returns {string}
 */
export function getFarewellReplyText(text) {
  return isFarewellInsult(text) ? 'Va bene, mi fermo qui.' : 'Va bene, a presto!';
}

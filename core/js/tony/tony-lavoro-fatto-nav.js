/**
 * «Ho fatto / ho finito» un lavoro in campo (anche dialetto: «o' fatto la vigna»).
 * Manodopera spenta → Diario. Accesa → Gestione lavori.
 * Non inventa appezzamento o tipo di lavoro non detti.
 * @module core/js/tony/tony-lavoro-fatto-nav
 */

/** Frase intera, non un pezzo di un turno più lungo («… stamani», «quello grande»). */
const LAVORO_FATTO_PATTERNS = [
  /^(?:ho|o')\s+fatto\s+la\s+vigna[.!?]?$/,
  /^o\s+fatto\s+la\s+vigna[.!?]?$/,
  /^(?:ho|o')\s+fatto\s+(?:il\s+)?lavoro\s+in\s+vigna[.!?]?$/,
  /^fatto\s+(?:il\s+)?lavoro\s+in\s+vigna[.!?]?$/,
  /^(?:ho|o')\s+finito(?:\s+il\s+lavoro)?\s+in\s+vigna[.!?]?$/,
  /^(?:ho|o')\s+finito\s+la\s+vigna[.!?]?$/
];

const DIARIO_TO_LAVORO_FIELDS = {
  'attivita-terreno': 'lavoro-terreno',
  'attivita-tipo-lavoro': 'lavoro-tipo-lavoro',
  'attivita-tipo-lavoro-gerarchico': 'lavoro-tipo-lavoro',
  'attivita-categoria-principale': 'lavoro-categoria-principale',
  'attivita-sottocategoria': 'lavoro-sottocategoria',
  'attivita-data': 'lavoro-data-inizio',
  'attivita-note': 'lavoro-note'
};

export function normalizeLavoroFattoText(message) {
  return String(message || '')
    .toLowerCase()
    .replace(/[\u2019\u2018\u02bc]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isExcludedLavoroFatto(msg) {
  if (/\b(pieno|gasolio|diesel|benzina|adblue|cisterna|carburante|carico)\b/.test(msg)) return true;
  if (/\b(preventiv|nuovo\s+lavoro|crea(?:re)?\s+(?:un\s+)?lavoro)\b/.test(msg)) return true;
  return false;
}

/**
 * @param {string} message
 * @returns {boolean}
 */
export function isLavoroFattoInCampo(message) {
  const msg = normalizeLavoroFattoText(message);
  if (!msg || isExcludedLavoroFatto(msg)) return false;
  return LAVORO_FATTO_PATTERNS.some((re) => re.test(msg));
}

/**
 * @param {string} message
 * @param {{ hasManodopera?: boolean }} [opts]
 * @returns {{ target: string, text: string, pendingModal: string } | null}
 */
export function resolveLavoroFattoNav(message, opts) {
  if (!isLavoroFattoInCampo(message)) return null;
  const hasManodopera = !!(opts && opts.hasManodopera);
  if (hasManodopera) {
    return {
      target: 'gestione lavori',
      text: 'Ti porto alla gestione lavori.',
      pendingModal: 'lavoro-modal'
    };
  }
  return {
    target: 'attivita',
    text: 'Ti porto al diario.',
    pendingModal: 'attivita-modal'
  };
}

/**
 * Copia solo i campi già presenti nel payload diario. Non aggiunge valori nuovi.
 * @param {object|null|undefined} fields
 * @returns {object|null}
 */
export function mapDiarioFieldsToLavoro(fields) {
  if (!fields || typeof fields !== 'object') return null;
  const out = {};
  Object.keys(fields).forEach((key) => {
    const value = fields[key];
    if (value == null || String(value).trim() === '') return;
    if (DIARIO_TO_LAVORO_FIELDS[key]) out[DIARIO_TO_LAVORO_FIELDS[key]] = value;
    else if (key.indexOf('lavoro-') === 0) out[key] = value;
  });
  return Object.keys(out).length ? out : null;
}

/**
 * Riscrive «ti porto al diario» in Gestione lavori solo se il messaggio
 * corrente è proprio un lavoro fatto in vigna. Un OPEN_MODAL attività
 * su un altro turno (anfora, solo nome campo) non basta.
 * @param {string} speech
 * @param {string} userText
 * @param {object|null|undefined} command
 * @param {boolean} hasManodopera
 * @param {boolean} isFieldProfile
 * @returns {string}
 */
export function alignLavoroFattoSpeech(speech, userText, command, hasManodopera, isFieldProfile) {
  const original = speech == null ? '' : String(speech);
  if (!hasManodopera || isFieldProfile) return original;
  if (!isLavoroFattoInCampo(userText)) return original;
  if (!/\bdiario\b/i.test(original)) return original;
  if (!/\b(porto|andiamo|apro)\b/i.test(original)) return original;
  return 'Ti porto alla gestione lavori.';
}

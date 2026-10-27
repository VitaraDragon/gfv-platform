/**
 * Regole pure per App Check della landing (senza Firebase).
 * Usate dal modulo App Check della landing e dai test del passo 9.
 */

/**
 * Token di debug solo in sviluppo/anteprima su localhost (non dal telefono in LAN).
 * @param {{ dev?: boolean, modo?: string, hostname?: string }} opzioni
 * @returns {boolean}
 */
export function usaTokenDebug({ dev, modo, hostname } = {}) {
  const host = typeof hostname === 'string' ? hostname : '';
  const hostOk = host === 'localhost' || host === '127.0.0.1';
  if (!hostOk) return false;
  return dev === true || modo === 'anteprima';
}

/**
 * La chiave sito è configurata (stringa valida, senza spazi in mezzo).
 * @param {unknown} chiave
 * @returns {boolean}
 */
export function protezioneConfigurata(chiave) {
  if (typeof chiave !== 'string') return false;
  const s = chiave.trim();
  if (s.length < 20 || s.length > 100) return false;
  return /^[A-Za-z0-9_-]+$/.test(s);
}

/**
 * Codice errore breve per i log (mai il messaggio intero).
 * @param {unknown} err
 * @returns {string}
 */
export function codiceErrore(err) {
  const code = err && typeof err === 'object' ? /** @type {{ code?: unknown }} */ (err).code : undefined;
  if (typeof code !== 'string') return 'sconosciuto';
  if (!code || /\s/.test(code) || code.length > 80) return 'sconosciuto';
  return code;
}

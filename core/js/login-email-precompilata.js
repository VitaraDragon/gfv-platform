/**
 * Email nel frammento # del login (landing → app). Nessuna password nell'URL.
 */

const CHIAVI_PASSWORD = Object.freeze([
  'password',
  'pwd',
  'pass',
  'password-confirm',
  'confirm-password',
]);

/**
 * @param {string} hash
 * @returns {URLSearchParams}
 */
function paramsDaHash(hash) {
  const grezzo = String(hash || '');
  const senzaCancelletto = grezzo.charAt(0) === '#' ? grezzo.slice(1) : grezzo;
  try {
    return new URLSearchParams(senzaCancelletto);
  } catch {
    return new URLSearchParams();
  }
}

/**
 * @param {string} email
 * @returns {boolean}
 */
function emailAmmissibile(email) {
  if (typeof email !== 'string') return false;
  const v = email.trim();
  if (v.length < 3 || v.length > 254) return false;
  if (v.indexOf(' ') >= 0) return false;
  if (/[\x00-\x1f<>"'`]/.test(v)) return false;
  const parti = v.split('@');
  if (parti.length !== 2) return false;
  if (!parti[0] || !parti[1]) return false;
  return true;
}

/**
 * @param {string} [hash]
 * @returns {string}
 */
export function leggiEmailDaFrammento(hash) {
  const params = paramsDaHash(hash);
  for (const chiave of CHIAVI_PASSWORD) {
    if (params.has(chiave)) return '';
    for (const k of params.keys()) {
      if (String(k).toLowerCase() === chiave) return '';
    }
  }
  let grezza = '';
  if (params.has('email')) grezza = params.get('email') || '';
  else {
    for (const [k, v] of params.entries()) {
      if (String(k).toLowerCase() === 'email') {
        grezza = v || '';
        break;
      }
    }
  }
  let decodificata = grezza;
  try {
    decodificata = decodeURIComponent(grezza);
  } catch {
    return '';
  }
  const email = String(decodificata || '').trim().toLowerCase();
  if (!emailAmmissibile(email)) return '';
  return email;
}

/**
 * @param {string} [hash]
 * @returns {boolean}
 */
export function frammentoDaPulire(hash) {
  const params = paramsDaHash(hash);
  for (const k of params.keys()) {
    const low = String(k).toLowerCase();
    if (low === 'email') return true;
    if (CHIAVI_PASSWORD.indexOf(low) >= 0) return true;
  }
  return false;
}

/**
 * @param {string} urlLogin
 * @param {string} email
 * @param {{ registrato?: boolean }} [opts]
 * @returns {string}
 */
export function urlLoginConEmail(urlLogin, email, opts) {
  const base = String(urlLogin || '');
  const registrato = !!(opts && opts.registrato);
  const emailNorm = String(email || '').trim().toLowerCase();
  const emailOk = emailAmmissibile(emailNorm) && leggiEmailDaFrammento('#email=' + encodeURIComponent(emailNorm)) === emailNorm;

  let url = base;
  if (registrato) {
    url += url.indexOf('?') >= 0 ? '&registered=true' : '?registered=true';
  }
  if (!emailOk) return url;
  return url + '#email=' + encodeURIComponent(emailNorm);
}

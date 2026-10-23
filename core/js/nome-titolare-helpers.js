/**
 * Helper per nome/cognome facoltativi del titolare (landing passo 4).
 * @module core/js/nome-titolare-helpers
 */

/**
 * @param {string|URLSearchParams|null|undefined} search
 * @returns {boolean}
 */
export function isDaLanding(search) {
  let params;
  if (search instanceof URLSearchParams) {
    params = search;
  } else if (typeof search === 'string') {
    const raw = search.startsWith('?') ? search.slice(1) : search;
    params = new URLSearchParams(raw);
  } else {
    return false;
  }
  return params.get('da') === 'landing';
}

/**
 * Nome/cognome facoltativi solo con flag acceso E ?da=landing.
 * @param {{ flagAttivo?: boolean, daLanding?: boolean }} opts
 * @returns {boolean}
 */
export function isNomeCognomeFacoltativi(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  return o.flagAttivo === true && o.daLanding === true;
}

/**
 * Campi nome/cognome da scrivere su users: solo se compilati (niente stringhe vuote).
 * @param {string|null|undefined} nome
 * @param {string|null|undefined} cognome
 * @returns {{ nome?: string, cognome?: string }}
 */
export function buildCampiNomeCognomeSeCompilati(nome, cognome) {
  const out = {};
  const n = String(nome || '').trim();
  const c = String(cognome || '').trim();
  if (n) out.nome = n;
  if (c) out.cognome = c;
  return out;
}

/**
 * displayName Auth da nome+cognome (stringa vuota se entrambi vuoti; mai «undefined»).
 * @param {string|null|undefined} nome
 * @param {string|null|undefined} cognome
 * @returns {string}
 */
export function displayNameDaNomeCognome(nome, cognome) {
  return [String(nome || '').trim(), String(cognome || '').trim()].filter(Boolean).join(' ');
}

/**
 * Se su users mancano nome/cognome, copia dall'invito solo i campi vuoti.
 * @param {{ nome?: string|null, cognome?: string|null }} userData
 * @param {{ nome?: string|null, cognome?: string|null }} invito
 * @returns {{ nome?: string, cognome?: string }}
 */
export function campiNomeDaInvitoSeVuoti(userData, invito) {
  const u = userData && typeof userData === 'object' ? userData : {};
  const inv = invito && typeof invito === 'object' ? invito : {};
  const patch = {};
  const nomeUtente = String(u.nome || '').trim();
  const cognomeUtente = String(u.cognome || '').trim();
  const nomeInvito = String(inv.nome || '').trim();
  const cognomeInvito = String(inv.cognome || '').trim();
  if (!nomeUtente && nomeInvito) patch.nome = nomeInvito;
  if (!cognomeUtente && cognomeInvito) patch.cognome = cognomeInvito;
  return patch;
}

/**
 * Aggiunge ?da=landing (o &da=landing) a un URL di registrazione.
 * @param {string} url
 * @returns {string}
 */
export function urlRegistrazioneConDaLanding(url) {
  const base = String(url || '');
  if (!base) return '?da=landing';
  if (/[?&]da=landing(?:&|$)/.test(base)) return base;
  return base.includes('?') ? `${base}&da=landing` : `${base}?da=landing`;
}

/**
 * Conserva da=landing su un percorso relativo di ricarica/redirect della stessa pagina.
 * @param {string} pathOrUrl
 * @param {string|URLSearchParams|null|undefined} currentSearch
 * @returns {string}
 */
export function preservaDaLandingSuUrl(pathOrUrl, currentSearch) {
  const path = String(pathOrUrl || '');
  if (!isDaLanding(currentSearch)) return path;
  return urlRegistrazioneConDaLanding(path);
}

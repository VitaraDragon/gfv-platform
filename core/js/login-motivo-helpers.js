/**
 * Messaggi e decisioni pure per il ritorno al login (sessione / motivo URL).
 * Nessun DOM, nessun Firebase: testabile da Vitest.
 */

/** @type {Readonly<Record<string, string>>} */
export const MESSAGGI_MOTIVO_LOGIN = Object.freeze({
  'sessione-persa':
    'La sessione non è stata conservata: riprova; se sei in incognito usa una finestra normale.',
  'utente-cambiato':
    'L’accesso è cambiato in un’altra scheda. Accedi di nuovo con l’account che vuoi usare.',
  'profilo-mancante':
    'Profilo utente non trovato. Completa la registrazione o contatta l’amministratore.',
});

/**
 * @param {string|null|undefined} motivo
 * @returns {string}
 */
export function messaggioMotivoLogin(motivo) {
  const chiave = String(motivo || '').trim();
  if (!chiave) return '';
  return MESSAGGI_MOTIVO_LOGIN[chiave] || '';
}

/** Flag di sessione: l'utente ha premuto «Logout» (non è una sessione persa). */
export const CHIAVE_LOGOUT_VOLONTARIO = 'gfv_logout_volontario';

function storageSessione(storage) {
  if (storage) return storage;
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

/**
 * Da chiamare PRIMA di signOut() in ogni logout volontario: l'onAuthStateChanged(null)
 * che ne segue non deve portare a «sessione-persa».
 * @param {Storage} [storage]
 */
export function segnaLogoutVolontario(storage) {
  const s = storageSessione(storage);
  try {
    if (s) s.setItem(CHIAVE_LOGOUT_VOLONTARIO, '1');
  } catch {
    /* storage non disponibile */
  }
}

/**
 * Legge (e di default consuma) il flag di logout volontario.
 * @param {Storage} [storage]
 * @param {{ consuma?: boolean }} [opts]
 * @returns {boolean}
 */
export function logoutVolontarioPendente(storage, opts) {
  const s = storageSessione(storage);
  if (!s) return false;
  let presente = false;
  try {
    presente = s.getItem(CHIAVE_LOGOUT_VOLONTARIO) === '1';
    if (presente && !(opts && opts.consuma === false)) s.removeItem(CHIAVE_LOGOUT_VOLONTARIO);
  } catch {
    return false;
  }
  return presente;
}

/**
 * Percorso di login quando l'utente risulta null: logout volontario → login pulito
 * (senza motivo); sessione davvero persa → `?motivo=sessione-persa`.
 * @param {string} loginPath es. './auth/login-standalone.html'
 * @param {Storage} [storage]
 * @returns {string}
 */
export function loginPathDopoUtenteNullo(loginPath, storage) {
  return logoutVolontarioPendente(storage)
    ? loginPath
    : loginPath + (loginPath.indexOf('?') === -1 ? '?' : '&') + 'motivo=sessione-persa';
}

/**
 * Rimuove `motivo=sessione-persa` dall'URL di login (es. dopo logout volontario).
 * @param {string} search query string con o senza `?`
 * @returns {string} nuova query string (con `?` iniziale, o vuota)
 */
export function queryLoginSenzaSessionePersa(search) {
  const raw = String(search || '');
  const params = new URLSearchParams(raw.charAt(0) === '?' ? raw.slice(1) : raw);
  if (params.get('motivo') === 'sessione-persa') params.delete('motivo');
  const qs = params.toString();
  return qs ? '?' + qs : '';
}

/**
 * Scelta «Sei già collegato» solo se: registered, sessione già presente al primo
 * evento Auth, e non c’è un login manuale in corso.
 * @param {{ registered?: boolean, primoEvento?: boolean, accessoManualeInCorso?: boolean }} args
 * @returns {boolean}
 */
export function deveMostrareSceltaSessione(args) {
  const a = args && typeof args === 'object' ? args : {};
  return !!(a.registered && a.primoEvento && !a.accessoManualeInCorso);
}

/**
 * Prova a scrivere un valore di prova in localStorage e (se disponibile) IndexedDB.
 * @returns {Promise<boolean>}
 */
export async function browserPuoConservareSessione() {
  try {
    const chiave = '__gfv_sessione_prova__';
    window.localStorage.setItem(chiave, '1');
    window.localStorage.removeItem(chiave);
  } catch {
    return false;
  }

  if (typeof indexedDB === 'undefined' || !indexedDB) {
    return false;
  }

  try {
    await new Promise((resolve, reject) => {
      let richiesta;
      try {
        richiesta = indexedDB.open('__gfv_sessione_prova_db__', 1);
      } catch (err) {
        reject(err);
        return;
      }
      richiesta.onerror = () => reject(richiesta.error || new Error('indexedDB'));
      richiesta.onsuccess = () => {
        try {
          richiesta.result.close();
          const del = indexedDB.deleteDatabase('__gfv_sessione_prova_db__');
          del.onsuccess = () => resolve(true);
          del.onerror = () => resolve(true);
          del.onblocked = () => resolve(true);
        } catch (err) {
          reject(err);
        }
      };
    });
    return true;
  } catch {
    return false;
  }
}

export const MSG_BROWSER_SENZA_PERSISTENZA =
  'Questo browser non mi lascia ricordare l’accesso (finestra in incognito o cookie e dati dei siti bloccati). Apri GFV in una finestra normale oppure consenti i dati dei siti per questo sito.';

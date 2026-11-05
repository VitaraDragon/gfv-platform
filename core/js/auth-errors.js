/**
 * Messaggi di errore Firebase Auth in italiano, condivisi da login, registrazione,
 * invito e reset password. Nessun DOM, nessun Firebase: testabile da Vitest.
 */

const MSG_GENERICO = 'Operazione non riuscita. Riprova tra qualche istante.';

/** @type {Readonly<Record<string, string>>} */
export const MESSAGGI_ERRORE_AUTH = Object.freeze({
  'invalid-credential': 'Email o password errati.',
  'invalid-login-credentials': 'Email o password errati.',
  'user-not-found': 'Email o password errati.',
  'wrong-password': 'Email o password errati.',
  'invalid-email': 'Email non valida.',
  'user-disabled': 'Account disabilitato. Contatta l\u2019amministratore.',
  'too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
  'network-request-failed': 'Connessione assente o instabile. Controlla la rete e riprova.',
  'email-already-in-use': 'Esiste già un account con questa email. Prova ad accedere.',
  'weak-password': 'Password troppo debole: usa almeno 6 caratteri.',
  'missing-password': 'Inserisci la password.',
  'missing-email': 'Inserisci l\u2019email.',
  'expired-action-code': 'Il link è scaduto. Richiedine uno nuovo.',
  'invalid-action-code': 'Il link non è valido o è già stato usato. Richiedine uno nuovo.',
  'invalid-continue-uri': 'Indirizzo di ritorno non autorizzato. Contatta l\u2019assistenza.',
  'requires-recent-login': 'Per sicurezza accedi di nuovo e riprova.',
  'operation-not-allowed': 'Operazione non consentita. Contatta l\u2019assistenza.',
  'internal-error': MSG_GENERICO,
});

/**
 * Estrae il codice breve («invalid-credential») da un codice Firebase («auth/invalid-credential»)
 * o, in mancanza, dal testo «Firebase: Error (auth/xxx).».
 * @param {unknown} codeOrError stringa codice oppure oggetto errore
 * @returns {string}
 */
export function codiceErroreAuth(codeOrError) {
  let code = '';
  let message = '';
  if (codeOrError && typeof codeOrError === 'object') {
    code = String(codeOrError.code || '');
    message = String(codeOrError.message || '');
  } else {
    code = String(codeOrError || '');
  }
  if (!code && message) {
    const m = message.match(/\(auth\/([a-z0-9-]+)\)/i);
    if (m) code = m[1];
  }
  return code.replace(/^auth\//, '').toLowerCase();
}

/**
 * Messaggio da mostrare per un errore qualsiasi: codice Auth noto → italiano;
 * errore applicativo con testo proprio (es. «Account non attivo…») → quel testo;
 * testo «Firebase: Error …» o assente → fallback italiano.
 * @param {unknown} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function messaggioDaErrore(error, fallback) {
  const code = codiceErroreAuth(error);
  if (code && MESSAGGI_ERRORE_AUTH[code]) return MESSAGGI_ERRORE_AUTH[code];
  const testo = error && typeof error === 'object' && error.message ? String(error.message) : '';
  if (testo && !/firebase:|\(auth\/|^auth\//i.test(testo)) return testo;
  return fallback && !/firebase:/i.test(fallback) ? fallback : MSG_GENERICO;
}

/**
 * Messaggio italiano per un errore di Firebase Auth. Mai «Firebase: Error ...».
 * @param {unknown} codeOrError codice (`auth/...`) oppure oggetto errore
 * @param {string} [fallback] messaggio se il codice è sconosciuto (default generico)
 * @returns {string}
 */
export function messaggioErroreAuth(codeOrError, fallback) {
  const code = codiceErroreAuth(codeOrError);
  if (code && MESSAGGI_ERRORE_AUTH[code]) return MESSAGGI_ERRORE_AUTH[code];
  if (fallback && !/firebase:/i.test(fallback)) return fallback;
  return MSG_GENERICO;
}

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
  'Questo browser non mi lascia ricordare l’accesso (finestra in incognito o cookie e dati dei siti bloccati). Apri GFV in una finestra normale oppure consenti i dati dei siti per vitaradragon.github.io.';

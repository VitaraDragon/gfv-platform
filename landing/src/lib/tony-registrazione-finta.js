/**
 * Modo finto per prove locali della registrazione in chat.
 * Solo con import.meta.env.DEV e ?tonyreg= (Vite lo toglie dalla build).
 */

import {
  creaAccountTitolare,
  annullaRegistrazioneParziale,
} from '../../../core/services/registrazione-titolare-core.js';

/**
 * @param {string} [query]
 * @returns {string|null}
 */
export function parametroTonyReg(query) {
  const testo = String(query ?? '');
  const inizio = testo.indexOf('?');
  let q = inizio >= 0 ? testo.slice(inizio + 1) : testo;
  const hash = q.indexOf('#');
  if (hash >= 0) q = q.slice(0, hash);
  try {
    const v = new URLSearchParams(q).get('tonyreg');
    if (v) return String(v);
    const finto = new URLSearchParams(q).get('tonyfinto');
    if (finto) return 'ok';
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {string} scenario
 */
export function costruisciFbFinto(scenario) {
  /** @type {Map<string, object>} */
  const docs = new Map();
  /** @type {Map<string, { email: string, password: string, uid: string }>} */
  const utenti = new Map();
  let uidSeq = 0;

  function chiave(col, id) {
    return `${col}/${id}`;
  }

  const fb = {
    auth: {},
    db: {},
    createUserWithEmailAndPassword: async (_auth, email, password) => {
      if (scenario === 'email-usata') {
        const err = new Error('email in use');
        err.code = 'auth/email-already-in-use';
        throw err;
      }
      if (scenario === 'password-debole') {
        const err = new Error('weak');
        err.code = 'auth/weak-password';
        throw err;
      }
      if (scenario === 'rete') {
        const err = new Error('network');
        err.code = 'auth/network-request-failed';
        throw err;
      }
      uidSeq += 1;
      const uid = `uidfinto${String(uidSeq).padStart(4, '0')}`;
      const utente = { uid, email };
      utenti.set(email, { email, password, uid });
      return { user: utente };
    },
    deleteUser: async (utente) => {
      if (scenario === 'azienda-pulizia-fallita') {
        throw new Error('deleteUser fallito');
      }
      if (utente && utente.email) utenti.delete(utente.email);
    },
    doc: (_db, col, id) => ({ path: chiave(col, id), col, id }),
    setDoc: async (ref, data) => {
      if (ref.col === 'tenants') {
        if (scenario === 'azienda' || scenario === 'azienda-pulizia-fallita') {
          const err = new Error('Errore durante creazione tenant: simulato');
          err.code = 'permission-denied';
          throw err;
        }
      }
      docs.set(ref.path, { ...data });
    },
    getDoc: async (ref) => {
      if (ref.col === 'users' && scenario === 'profilo' && !docs.has(ref.path)) {
        return {
          exists: () => true,
          data: () => ({ id: ref.id, email: 'gia@esempio.it' }),
        };
      }
      const data = docs.get(ref.path);
      return {
        exists: () => !!data,
        data: () => (data ? { ...data } : undefined),
      };
    },
    deleteDoc: async (ref) => {
      docs.delete(ref.path);
      const err = new Error('rules deny delete');
      err.code = 'permission-denied';
      throw err;
    },
    serverTimestamp: () => ({ __ts: true }),
    chiamaAccettazione: async () => {
      if (scenario === 'legale') {
        throw new Error('accettazione fallita');
      }
    },
  };

  return fb;
}

/** Email dell'ultima registrazione finta (solo memoria). */
let ultimaEmail = '';

/**
 * @returns {string | null}
 */
export function ultimaEmailFinta() {
  return ultimaEmail || null;
}

/** Token di accesso finto per la fase account. */
export const TOKEN_ACCESSO_FINTO = 'token-finto';

/**
 * @param {{ scenario: string, dati: object, attendi?: Function }} opts
 */
export async function eseguiRegistrazioneFinta({ scenario, dati, attendi }) {
  const sc = scenario || 'ok';
  const fb = costruisciFbFinto(sc);
  const { eseguiRegistrazione } = await import('./tony-registrazione.js');

  const attendiEff =
    sc === 'lento'
      ? (ms) => new Promise((r) => setTimeout(r, Math.max(ms, 3000)))
      : attendi || ((ms) => new Promise((r) => setTimeout(r, 0)));

  const esito = await eseguiRegistrazione({ dati, fb, attendi: attendiEff });
  if (
    (esito.esito === 'ok' || esito.esito === 'ok-legale-rimandata') &&
    typeof esito.email === 'string'
  ) {
    ultimaEmail = esito.email;
  }
  return esito;
}

export { creaAccountTitolare, annullaRegistrazioneParziale };

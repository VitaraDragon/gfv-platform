/**
 * Auth + Firestore lite + Functions per la registrazione nella chat.
 * Usa l'app già creata da firebase-landing.js (con App Check). Non crea un'app nuova.
 */

import { getApps } from 'firebase/app';
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  initializeAuth,
  signOut,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore/lite';
import { getFunctions, httpsCallable } from 'firebase/functions';

/** @type {import('firebase/auth').Auth | null} */
let auth = null;
/** @type {import('firebase/firestore/lite').Firestore | null} */
let db = null;
/** @type {import('firebase/functions').Functions | null} */
let functions = null;

const ATTESA_AUTH_MS = 3000;

function erroreProtezione() {
  const err = new Error('protezione-non-pronta');
  err.code = 'protezione-non-pronta';
  return err;
}

async function assicuraAuth() {
  const apps = getApps();
  if (!apps || !apps[0]) return null;
  if (!auth) {
    auth = initializeAuth(apps[0], { persistence: browserSessionPersistence });
  }
  try {
    await Promise.race([
      auth.authStateReady(),
      new Promise((resolve) => {
        setTimeout(resolve, ATTESA_AUTH_MS);
      }),
    ]);
  } catch {
    /* auth non pronta */
  }
  return auth;
}

/**
 * @returns {Promise<{
 *   auth: import('firebase/auth').Auth,
 *   db: import('firebase/firestore/lite').Firestore,
 *   createUserWithEmailAndPassword: typeof createUserWithEmailAndPassword,
 *   deleteUser: typeof deleteUser,
 *   doc: typeof doc,
 *   setDoc: typeof setDoc,
 *   getDoc: typeof getDoc,
 *   deleteDoc: typeof deleteDoc,
 *   serverTimestamp: typeof serverTimestamp,
 *   chiamaAccettazione: (payload: object) => Promise<unknown>
 * }>}
 */
export async function strumentiRegistrazione() {
  const apps = getApps();
  if (!apps || !apps[0]) throw erroreProtezione();
  const app = apps[0];

  await assicuraAuth();
  if (!db) {
    db = getFirestore(app);
  }
  if (!functions) {
    functions = getFunctions(app, 'europe-west1');
  }

  const callable = httpsCallable(functions, 'registraAccettazioniLegali');

  return {
    auth,
    db,
    createUserWithEmailAndPassword,
    deleteUser,
    doc,
    setDoc,
    getDoc,
    deleteDoc,
    serverTimestamp,
    chiamaAccettazione: async (payload) => {
      await callable(payload);
    },
  };
}

/**
 * Chiude la sessione sulla landing: si entra dal login dell'app.
 * @returns {Promise<void>}
 */
export async function esciDopoRegistrazione() {
  await assicuraAuth();
  if (!auth) return;
  try {
    await signOut(auth);
  } catch {
    /* sessione già chiusa */
  }
}

/**
 * Token di accesso Firebase Auth (fase account / salvataggio).
 * @returns {Promise<string | null>}
 */
export async function tokenAccesso() {
  try {
    const istanza = await assicuraAuth();
    if (!istanza || !istanza.currentUser) return null;
    return await istanza.currentUser.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Email dell'utente collegato (solo per il link dashboard).
 * @returns {Promise<string | null>}
 */
export async function emailCollegata() {
  try {
    const istanza = await assicuraAuth();
    if (!istanza || !istanza.currentUser) return null;
    const email = istanza.currentUser.email;
    return typeof email === 'string' && email ? email : null;
  } catch {
    return null;
  }
}

/**
 * Chiama tonyLandingSetup con i dati della scheda Confermi.
 * @param {object} dati
 */
export async function salvaAziendaDaLanding(dati) {
  try {
    await strumentiRegistrazione();
    if (!functions) {
      return { ok: false, codice: 'non-collegato', motivo: 'non-collegato' };
    }
    if (!auth || !auth.currentUser) {
      return { ok: false, codice: 'non-collegato', motivo: 'non-collegato' };
    }
    const callable = httpsCallable(functions, 'tonyLandingSetup');
    const risultato = await callable(dati);
    return { ok: true, risposta: risultato && risultato.data ? risultato.data : risultato };
  } catch (err) {
    const raw = err && typeof err === 'object' ? err : {};
    let codice = typeof raw.code === 'string' ? raw.code : 'rete';
    if (codice.indexOf('functions/') === 0) codice = codice.slice('functions/'.length);
    const details = raw.details && typeof raw.details === 'object' ? raw.details : {};
    return {
      ok: false,
      codice,
      motivo: typeof details.motivo === 'string' ? details.motivo : codice,
      campi: Array.isArray(details.campi) ? details.campi : undefined,
      dettagli: {
        limite: details.limite,
        esistenti: details.esistenti,
        richiesti: details.richiesti,
      },
    };
  }
}

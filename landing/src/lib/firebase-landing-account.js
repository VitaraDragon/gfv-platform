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

function erroreProtezione() {
  const err = new Error('protezione-non-pronta');
  err.code = 'protezione-non-pronta';
  return err;
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

  if (!auth) {
    auth = initializeAuth(app, { persistence: browserSessionPersistence });
  }
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
  if (!auth) {
    const apps = getApps();
    if (!apps || !apps[0]) return;
    auth = initializeAuth(apps[0], { persistence: browserSessionPersistence });
  }
  try {
    await signOut(auth);
  } catch {
    /* sessione già chiusa */
  }
}

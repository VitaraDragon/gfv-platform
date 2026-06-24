/**
 * Connessione Firebase Emulator per sviluppo locale (simulatore + verifica UI).
 * Attivo con ?emulator=1 nell'URL o localStorage gfv_firebase_emulator=1
 * @module core/js/firebase-emulator-dev
 */

import { connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_HOST = '127.0.0.1';
const FIRESTORE_PORT = 8080;

let _connected = false;

export function shouldUseFirebaseEmulator() {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('gfv_firebase_emulator') === '1') return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('emulator') === '1') {
      localStorage.setItem('gfv_firebase_emulator', '1');
      return true;
    }
  } catch (_) { /* ignore */ }
  return false;
}

/**
 * Collegamento sincrono subito dopo getAuth/getFirestore (prima di qualsiasi operazione auth).
 * @param {{ getAuthInstance: Function, getDb: Function }} firebaseService
 * @returns {boolean}
 */
export function connectFirebaseEmulatorsIfDev(firebaseService) {
  if (_connected || !shouldUseFirebaseEmulator()) return false;

  const auth = firebaseService.getAuthInstance();
  const db = firebaseService.getDb();

  connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
  connectFirestoreEmulator(db, FIRESTORE_HOST, FIRESTORE_PORT);

  _connected = true;
  console.info('[GFV] Firebase Emulator — Auth 9099, Firestore 8080');
  return true;
}

/** Propaga ?emulator=1 su link interni se emulator attivo */
export function withEmulatorQuery(href) {
  if (!shouldUseFirebaseEmulator()) return href;
  try {
    const url = new URL(href, window.location.href);
    url.searchParams.set('emulator', '1');
    return url.pathname + url.search + url.hash;
  } catch (_) {
    return href.includes('?') ? `${href}&emulator=1` : `${href}?emulator=1`;
  }
}

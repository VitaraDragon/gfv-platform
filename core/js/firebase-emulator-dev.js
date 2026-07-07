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
const FUNCTIONS_HOST = '127.0.0.1';
const FUNCTIONS_PORT = 5001;

let _connected = false;

const SIM_PENDING_LOGIN_KEY = 'gfv_sim_pending_login';

/** Tony E2E tier 3 live — CF reale via Functions emulator (`?tonyE2eLive=1`). */
export function shouldUseTonyE2eLive() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.__GFV_TONY_E2E_LIVE) return true;
    const params = new URLSearchParams(window.location.search);
    return params.get('tonyE2eLive') === '1';
  } catch (_) { /* ignore */ }
  return false;
}

/** Base URL HTTP tonyAsk/tonyAskStream su Functions emulator (regione europe-west1). */
export function resolveTonyCfEmulatorBaseUrl() {
  if (!shouldUseFirebaseEmulator() || !shouldUseTonyE2eLive()) return null;
  try {
    const projectId =
      (typeof window !== 'undefined' && window.firebaseConfig && window.firebaseConfig.projectId) ||
      'gfv-platform';
    return `http://${FUNCTIONS_HOST}:${FUNCTIONS_PORT}/${projectId}/europe-west1`;
  } catch (_) {
    return null;
  }
}

export function shouldUseFirebaseEmulator() {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('gfv_firebase_emulator') === '1') return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('emulator') === '1') {
      localStorage.setItem('gfv_firebase_emulator', '1');
      return true;
    }
    // Sessione simulatore (Entra da simulator-dev) anche senza ?emulator=1 nell'URL
    if (sessionStorage.getItem(SIM_PENDING_LOGIN_KEY)) {
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

  if (shouldUseTonyE2eLive()) {
    const cfBase = resolveTonyCfEmulatorBaseUrl();
    if (cfBase && !window.__GFV_TONY_E2E_PROD_CF) window.__gfvTonyCfEmulatorBase = cfBase;
  }

  _connected = true;
  installEmulatorLinkPropagation();
  const liveLabel = shouldUseTonyE2eLive() ? ', Functions 5001 (Tony live)' : '';
  console.info(`[GFV] Firebase Emulator — Auth 9099, Firestore 8080${liveLabel}`);
  return true;
}

/** Aggiunge ?emulator=1 ai link interni (navigazione da dashboard → moduli). */
export function installEmulatorLinkPropagation() {
  if (typeof document === 'undefined' || !shouldUseFirebaseEmulator()) return;
  if (document.documentElement.dataset.gfvEmulatorLinks === '1') return;
  document.documentElement.dataset.gfvEmulatorLinks = '1';

  document.addEventListener(
    'click',
    (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || /^https?:\/\//i.test(href) || href.startsWith('mailto:')) {
        return;
      }
      if (!/[?&]emulator=1(?:&|$)/.test(href)) {
        a.setAttribute('href', withEmulatorQuery(href));
      }
    },
    true
  );
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

/**
 * Auth emulator per pagine standalone modulo (senza standalone-bootstrap).
 * @module core/js/simulator-standalone-page
 */

import { ensureStandaloneReadyPlaceholder } from './standalone-ready.js';

if (typeof document !== 'undefined') {
  ensureStandaloneReadyPlaceholder();
}

/**
 * Dopo initializeFirebase: connessione emulator + ripristino sessione simulatore.
 * @param {typeof import('../services/firebase-service.js')} firebaseService
 */
export async function afterFirebaseInit(firebaseService) {
  if (typeof firebaseService.awaitFirebaseEmulatorConnect === 'function') {
    await firebaseService.awaitFirebaseEmulatorConnect();
  }
  if (typeof firebaseService.awaitAuthStateReady === 'function') {
    await firebaseService.awaitAuthStateReady();
  }
  const auth = firebaseService.getAuthInstance();
  const { ensureSimulatorSession } = await import('./simulator-browser-auth.js');
  await ensureSimulatorSession(auth);
  return auth;
}

/**
 * Recupera l'utente Auth (emulator): currentUser, restore sessione, poi retry
 * dopo un tick null (il bootstrap può aver già consumato SIM_PENDING_LOGIN_KEY).
 * @param {import('firebase/auth').Auth} auth
 * @returns {Promise<import('firebase/auth').User|null>}
 */
export async function resolveAuthUser(auth) {
  if (auth?.currentUser) return auth.currentUser;
  try {
    const { ensureSimulatorSession } = await import('./simulator-browser-auth.js');
    const restored = await ensureSimulatorSession(auth);
    if (restored) return restored;
  } catch (_) { /* restore sessione opzionale */ }
  if (auth && typeof auth.authStateReady === 'function') {
    await auth.authStateReady();
  }
  if (auth?.currentUser) return auth.currentUser;
  await new Promise((r) => setTimeout(r, 150));
  if (auth?.currentUser) return auth.currentUser;
  try {
    const { ensureSimulatorSession } = await import('./simulator-browser-auth.js');
    return await ensureSimulatorSession(auth);
  } catch (_) {
    return auth?.currentUser || null;
  }
}

/**
 * Attende `window.GFVStandaloneReady` anche se lo script pagina parte prima del bootstrap.
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export async function waitForStandaloneReady(timeoutMs = 20000) {
  const ready = ensureStandaloneReadyPlaceholder();
  let timeoutId;
  let timedOut = false;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new Error('GFVStandaloneReady timeout'));
    }, timeoutMs);
  });
  try {
    await Promise.race([ready, timeout]);
  } catch (err) {
    if (!timedOut) throw err;
    console.warn('[waitForStandaloneReady]', err && err.message ? err.message : err);
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Alias: stessa logica di `resolveAuthUser` (retry incluso). */
export const resolveAuthUserWithRetry = resolveAuthUser;

/**
 * @param {string} path — path relativo alla pagina (es. '../../../core/auth/login-standalone.html')
 */
export async function loginPageUrl(path) {
  const { withEmulatorQuery } = await import('./firebase-emulator-dev.js');
  return withEmulatorQuery(path);
}

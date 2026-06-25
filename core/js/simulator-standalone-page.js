/**
 * Auth emulator per pagine standalone modulo (senza standalone-bootstrap).
 * @module core/js/simulator-standalone-page
 */

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
 * @param {import('firebase/auth').Auth} auth
 * @returns {Promise<import('firebase/auth').User|null>}
 */
export async function resolveAuthUser(auth) {
  if (auth?.currentUser) return auth.currentUser;
  const { ensureSimulatorSession } = await import('./simulator-browser-auth.js');
  return ensureSimulatorSession(auth);
}

/**
 * @param {string} path — path relativo alla pagina (es. '../../../core/auth/login-standalone.html')
 */
export async function loginPageUrl(path) {
  const { withEmulatorQuery } = await import('./firebase-emulator-dev.js');
  return withEmulatorQuery(path);
}

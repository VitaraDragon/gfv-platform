/**
 * Chiamata unica alla Cloud Function della scheda. Non legge i siti dal browser.
 * @module shared/js/registro-trattamenti-scheda-client
 */

export async function leggiSchedaRegistroTrattamento(payload) {
  const { getFunctions, httpsCallable, connectFunctionsEmulator } = await import(
    'https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js'
  );
  const { getAppInstance } = await import('../../core/services/firebase-service.js');
  const { shouldUseFirebaseEmulator } = await import('../../core/js/firebase-emulator-dev.js');
  const functions = getFunctions(getAppInstance(), 'europe-west1');
  if (shouldUseFirebaseEmulator()) {
    try { connectFunctionsEmulator(functions, '127.0.0.1', 5001); } catch (e) { /* già collegato */ }
  }
  const call = httpsCallable(functions, 'leggiSchedaRegistroTrattamento');
  const res = await call(payload || {});
  return res && res.data ? res.data : {};
}

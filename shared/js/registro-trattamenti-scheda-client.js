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

/** Righe già lette in anagrafica. Non chiama il Ministero. */
export async function leggiRigheSchedaProdotto(prodottoId) {
  if (!prodottoId) return [];
  const { getDb, collection, getDocs } = await import('../../core/services/firebase-service.js');
  const { getCurrentTenantId } = await import('../../core/services/tenant-service.js');
  const tenantId = getCurrentTenantId();
  if (!tenantId) return [];
  const snap = await getDocs(collection(getDb(), 'tenants', tenantId, 'prodotti', prodottoId, 'schedaImpieghi'));
  return snap.docs.map((docSnap) => docSnap.data());
}

/** Mette questo prodotto in cima alla coda. Non riscrive i trattamenti già salvati. */
export async function chiediRiletturaScheda(prodottoId) {
  if (!prodottoId) return;
  const { getDb, doc, updateDoc } = await import('../../core/services/firebase-service.js');
  const { getCurrentTenantId } = await import('../../core/services/tenant-service.js');
  const tenantId = getCurrentTenantId();
  if (!tenantId) return;
  await updateDoc(doc(getDb(), 'tenants', tenantId, 'prodotti', prodottoId), {
    letturaSchedaStato: 'in_corso',
    letturaSchedaMotivo: null,
    letturaSchedaRichiestaAt: new Date().toISOString()
  });
}

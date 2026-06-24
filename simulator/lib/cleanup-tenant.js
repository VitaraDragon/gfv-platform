/**
 * Rimozione tenant simulati da Firestore/Auth emulator.
 * @module simulator/lib/cleanup-tenant
 */

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} collectionPath
 */
export async function deleteCollectionPath(db, collectionPath) {
  const collRef = db.collection(collectionPath);
  const batchSize = 200;

  while (true) {
    const snapshot = await collRef.limit(batchSize).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('firebase-admin/auth').Auth} auth
 * @param {{ tenantId: string, userId?: string }} entry
 */
export async function deleteSimulatedTenant(db, auth, { tenantId, userId }) {
  if (!tenantId || !tenantId.startsWith('sim_')) {
    throw new Error(`Tenant non simulato o id mancante: ${tenantId}`);
  }

  const tenantRef = db.collection('tenants').doc(tenantId);
  const subcols = await tenantRef.listCollections();
  for (const sub of subcols) {
    await deleteCollectionPath(db, sub.path);
  }
  await tenantRef.delete();

  if (userId) {
    try {
      await db.collection('users').doc(userId).delete();
    } catch (_) { /* ignore */ }
    try {
      await auth.deleteUser(userId);
    } catch (_) { /* ignore */ }
  }
}

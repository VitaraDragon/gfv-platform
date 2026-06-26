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
 * Rimuove un tenant sim_ già presente (stesso seed → stesso tenantId) prima di un nuovo run.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('firebase-admin/auth').Auth} auth
 * @param {string} tenantId
 */
export async function ensureCleanSimTenant(db, auth, tenantId) {
  if (!tenantId?.startsWith('sim_')) return;

  const tenantRef = db.collection('tenants').doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) return;

  const userIds = new Set();
  const createdBy = tenantSnap.data()?.createdBy;
  if (createdBy) userIds.add(String(createdBy));

  const usersByTenant = await db.collection('users').where('tenantId', '==', tenantId).get();
  for (const doc of usersByTenant.docs) {
    userIds.add(doc.id);
  }

  const allUsers = await db.collection('users').get();
  for (const doc of allUsers.docs) {
    const data = doc.data();
    if (data?.tenantMemberships?.[tenantId]) {
      userIds.add(doc.id);
    }
  }

  await deleteSimulatedTenant(db, auth, {
    tenantId,
    userId: createdBy || [...userIds][0],
    personas: [...userIds].map((userId) => ({ userId }))
  });
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('firebase-admin/auth').Auth} auth
 * @param {{ tenantId: string, userId?: string, personas?: Array<{ userId?: string }> }} entry
 */
export async function deleteSimulatedTenant(db, auth, { tenantId, userId, personas }) {
  if (!tenantId || !tenantId.startsWith('sim_')) {
    throw new Error(`Tenant non simulato o id mancante: ${tenantId}`);
  }

  const tenantRef = db.collection('tenants').doc(tenantId);
  const subcols = await tenantRef.listCollections();
  for (const sub of subcols) {
    await deleteCollectionPath(db, sub.path);
  }
  await tenantRef.delete();

  const userIds = new Set();
  if (userId) userIds.add(userId);
  if (Array.isArray(personas)) {
    for (const p of personas) {
      if (p?.userId) userIds.add(p.userId);
    }
  }

  for (const uid of userIds) {
    try {
      await db.collection('users').doc(uid).delete();
    } catch (_) { /* ignore */ }
    try {
      await auth.deleteUser(uid);
    } catch (_) { /* ignore */ }
  }
}

/**
 * Podere di riferimento tenant (colture/categorie/tipi → seed-app-catalog.js).
 * @module simulator/lib/seed-reference-data
 */

import { addTenantDocument } from './firestore-write.js';

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {string} userId
 * @param {{ podereNome?: string }} [options]
 * @returns {Promise<{ podereNome: string }>}
 */
export async function seedTenantReferenceData(db, tenantId, userId, options = {}) {
  const podereNome = options.podereNome || 'Podere principale';

  const poderiSnap = await db.collection(`tenants/${tenantId}/poderi`).limit(1).get();
  if (poderiSnap.empty) {
    await addTenantDocument(db, tenantId, 'poderi', {
      nome: podereNome,
      indirizzo: '',
      note: 'Podere simulato GFV Farm Simulator',
      coordinate: { lat: 45.4, lng: 11.8 },
      creatoDa: userId,
    });
  }

  return { podereNome };
}

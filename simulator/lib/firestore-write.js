/**
 * Write Firestore via Admin SDK con normalizzazione Timestamp.
 * @module simulator/lib/firestore-write
 */

import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

function isPlainTimestampLike(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.seconds === 'number' &&
    typeof value.nanoseconds === 'number' &&
    typeof value.toDate !== 'function'
  );
}

/**
 * Normalizza ricorsivamente valori per Admin SDK.
 * @param {*} value
 * @returns {*}
 */
export function normalizeForAdmin(value) {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }

  if (value instanceof Timestamp) {
    return value;
  }

  if (isPlainTimestampLike(value)) {
    return new Timestamp(value.seconds, value.nanoseconds);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForAdmin);
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue;
      out[key] = normalizeForAdmin(nested);
    }
    return out;
  }

  return value;
}

function tenantDocPath(tenantId, collectionPath, docId) {
  const segments = collectionPath.split('/').filter(Boolean);
  return ['tenants', tenantId, ...segments, docId].join('/');
}

function rootDocPath(collection, docId) {
  return `${collection}/${docId}`;
}

function withTimestamps(data, { isCreate }) {
  const normalized = normalizeForAdmin(data);
  const now = FieldValue.serverTimestamp();
  if (isCreate) {
    return {
      ...normalized,
      createdAt: normalized.createdAt ?? now,
      updatedAt: normalized.updatedAt ?? now
    };
  }
  return {
    ...normalized,
    updatedAt: now
  };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
export async function setRootDocument(db, collection, docId, data, { merge = false } = {}) {
  const ref = db.doc(rootDocPath(collection, docId));
  const payload = withTimestamps(data, { isCreate: !merge });
  await ref.set(payload, { merge });
  return docId;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
export async function addTenantDocument(db, tenantId, collectionPath, data) {
  const payload = withTimestamps(data, { isCreate: true });
  const ref = await db.collection(`tenants/${tenantId}/${collectionPath}`).add(payload);
  return ref.id;
}

/**
 * Aggiunge documento in subcollection annidata (es. vigneti/{id}/potature).
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} tenantId
 * @param {string[]} segments — coppie [collection, docId, …, collectionFinale] es. ['vigneti', vignetoId, 'potature']
 */
export async function addTenantNestedDocument(db, tenantId, segments, data) {
  if (!segments.length || segments.length % 2 === 0) {
    throw new Error('addTenantNestedDocument: segments deve terminare con nome collection');
  }
  const payload = withTimestamps(data, { isCreate: true });
  let ref = db.collection('tenants').doc(tenantId);
  for (let i = 0; i < segments.length - 1; i += 2) {
    ref = ref.collection(segments[i]).doc(segments[i + 1]);
  }
  const lastCollection = segments[segments.length - 1];
  const docRef = await ref.collection(lastCollection).add(payload);
  return docRef.id;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
export async function setTenantDocument(db, tenantId, collectionPath, docId, data, { merge = false } = {}) {
  const ref = db.doc(tenantDocPath(tenantId, collectionPath, docId));
  const payload = withTimestamps(data, { isCreate: !merge });
  await ref.set(payload, { merge });
  return docId;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
export async function getTenantDocument(db, tenantId, collectionPath, docId) {
  const snap = await db.doc(tenantDocPath(tenantId, collectionPath, docId)).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
export async function getRootDocument(db, collection, docId) {
  const snap = await db.doc(rootDocPath(collection, docId)).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

export { getFirestore, Timestamp, FieldValue };

/**
 * Supporto seed catalogo: id documento deterministici, lock in memoria per tenant,
 * scritture batch delle sole voci nuove.
 * @module core/services/catalogo-seed
 */

import {
  getDb,
  getDocument,
  writeBatch,
  serverTimestamp
} from './firebase-service.js';

/** Limite Firestore per operazioni in un writeBatch. */
export const SEED_BATCH_MAX_OPS = 500;

/**
 * Slug per id documento: minuscolo, senza accenti, solo [a-z0-9_].
 * @param {unknown} value
 * @returns {string}
 */
export function slugCatalogo(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Id deterministico di una voce seed (stesso valore da ogni pagina/tab).
 * @param {unknown} codiceONome
 * @returns {string} es. `seed_vite`, `seed_fico_d_india`
 */
export function idSeed(codiceONome) {
  const slug = slugCatalogo(codiceONome);
  if (!slug) throw new Error('Codice seed vuoto');
  return `seed_${slug}`;
}

/**
 * Dati da scrivere in seed: senza id e senza timestamp del modello
 * (createdAt/updatedAt li aggiunge scriviSeedBatch sulle sole voci nuove).
 * @param {object} dati
 * @returns {object}
 */
export function datiSeed(dati) {
  const out = { ...(dati || {}) };
  delete out.id;
  delete out.createdAt;
  delete out.updatedAt;
  return out;
}

/**
 * Scrive voci seed mancanti in uno o più writeBatch (max 500 ops ciascuno).
 * Solo documenti nuovi: createdAt e updatedAt con serverTimestamp.
 * A lista vuota non scrive nulla. Id deterministici + merge evitano doppioni.
 *
 * @param {string} collectionName
 * @param {Array<{ id: string, data: object }>} voci
 * @param {string} tenantId
 * @returns {Promise<number>} numero di documenti scritti
 */
export async function scriviSeedBatch(collectionName, voci, tenantId) {
  if (!Array.isArray(voci) || voci.length === 0) return 0;
  if (!tenantId) throw new Error('tenantId obbligatorio per seed batch');

  const db = getDb();
  let scritte = 0;

  for (let i = 0; i < voci.length; i += SEED_BATCH_MAX_OPS) {
    const slice = voci.slice(i, i + SEED_BATCH_MAX_OPS);
    const batch = writeBatch(db);
    for (const voce of slice) {
      if (!voce || !voce.id) throw new Error('Voce seed senza id');
      const ref = getDocument(collectionName, voce.id, tenantId);
      batch.set(
        ref,
        {
          ...datiSeed(voce.data),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      scritte += 1;
    }
    await batch.commit();
  }

  return scritte;
}

const inCorso = new Map();

/**
 * Esegue `fn` una sola volta per (nome, tenant) finché è in corso: le chiamate concorrenti
 * ricevono la stessa promise. Terminata (bene o male), la chiamata successiva riparte.
 * @template T
 * @param {string} nome
 * @param {string} tenantId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function conLockSeed(nome, tenantId, fn) {
  const key = `${nome}:${tenantId}`;
  const esistente = inCorso.get(key);
  if (esistente) return esistente;
  const p = Promise.resolve()
    .then(fn)
    .finally(() => {
      if (inCorso.get(key) === p) inCorso.delete(key);
    });
  inCorso.set(key, p);
  return p;
}

/** Solo test: svuota i lock. */
export function _resetLockSeed() {
  inCorso.clear();
}

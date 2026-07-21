/**
 * Documenti acquisiti (Tony Occhi) — metadati Firestore + helper Storage.
 * Collection: tenants/{tenantId}/documentiAcquisiti/{sessionId}
 *
 * @module modules/magazzino/services/documenti-acquisiti-service
 */

import {
  getCollectionData,
  getDocumentData,
  setDocument,
  updateDocument,
  deleteDocument,
  getAppInstanceIfReady,
  getAppInstance,
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';

export const COLLECTION_NAME = 'documentiAcquisiti';

/**
 * @returns {string}
 */
function requireTenantId() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  return tenantId;
}

/**
 * @returns {Promise<import('firebase/app').FirebaseApp>}
 */
async function requireFirebaseApp() {
  let app = null;
  try {
    app = getAppInstanceIfReady ? getAppInstanceIfReady() : null;
  } catch (_) { /* ignore */ }
  if (!app && typeof getAppInstance === 'function') {
    try { app = getAppInstance(); } catch (_) { /* ignore */ }
  }
  if (!app) throw new Error('Firebase app non pronta per Storage.');
  return app;
}

/**
 * @param {string} sessionId
 * @param {object} data
 * @returns {Promise<void>}
 */
export async function saveDocumentoAcquisito(sessionId, data) {
  const tenantId = requireTenantId();
  if (!sessionId) throw new Error('sessionId obbligatorio');
  await setDocument(COLLECTION_NAME, sessionId, Object.assign({}, data || {}, { id: sessionId }), tenantId);
}

/**
 * @param {string} sessionId
 * @param {object} updates
 * @returns {Promise<void>}
 */
export async function updateDocumentoAcquisito(sessionId, updates) {
  const tenantId = requireTenantId();
  if (!sessionId) throw new Error('sessionId obbligatorio');
  await updateDocument(COLLECTION_NAME, sessionId, updates || {}, tenantId);
}

/**
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
export async function getDocumentoAcquisito(sessionId) {
  const tenantId = requireTenantId();
  if (!sessionId) throw new Error('sessionId obbligatorio');
  return getDocumentData(COLLECTION_NAME, sessionId, tenantId);
}

/**
 * @param {object} [options]
 * @param {string} [options.orderBy]
 * @param {string} [options.orderDirection]
 * @param {number} [options.limit]
 * @param {Array} [options.where]
 * @returns {Promise<object[]>}
 */
export async function getAllDocumentiAcquisiti(options = {}) {
  const tenantId = requireTenantId();
  const {
    orderBy = 'confermatoIl',
    orderDirection = 'desc',
    limit: limitCount = null,
    where: whereFilters = null,
  } = options;

  try {
    return await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereFilters && whereFilters.length ? whereFilters : undefined,
      limit: limitCount || undefined,
    });
  } catch (err) {
    // Indice mancante su confermatoIl → fallback senza order
    console.warn('[documenti-acquisiti] query ordinata fallita, fallback:', err && err.message);
    return getCollectionData(COLLECTION_NAME, {
      tenantId,
      limit: limitCount || undefined,
    });
  }
}

/**
 * Upload bytes su Firebase Storage (path già completo).
 * @param {string} storagePath
 * @param {Blob} blob
 * @param {{ contentType?: string }} [meta]
 * @returns {Promise<void>}
 */
export async function uploadDocumentoPage(storagePath, blob, meta = {}) {
  if (!storagePath) throw new Error('storagePath obbligatorio');
  if (!blob) throw new Error('blob obbligatorio');

  const app = await requireFirebaseApp();
  const { getStorage, ref, uploadBytes } = await import(
    'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js'
  );
  const storage = getStorage(app);
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, {
    contentType: meta.contentType || blob.type || 'application/octet-stream',
    customMetadata: {
      tenantId: requireTenantId(),
      uploadedAt: new Date().toISOString(),
    },
  });
}

/**
 * URL download on-demand per Apri/Stampa.
 * @param {string} storagePath
 * @returns {Promise<string>}
 */
export async function getDocumentoPageDownloadUrl(storagePath) {
  if (!storagePath) throw new Error('storagePath obbligatorio');
  const app = await requireFirebaseApp();
  const { getStorage, ref, getDownloadURL } = await import(
    'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js'
  );
  const storage = getStorage(app);
  return getDownloadURL(ref(storage, storagePath));
}

/**
 * Elimina originale(i) Storage + metadati Firestore.
 * Non elimina i movimenti magazzino collegati (restano i dati gestionali).
 * @param {string} sessionId
 * @param {{ pagine?: Array<{ storagePath?: string }> }|null} [docSnap] — se già caricato, evita re-fetch
 * @returns {Promise<{ storageDeleted: number, storageErrors: string[] }>}
 */
export async function deleteDocumentoAcquisito(sessionId, docSnap = null) {
  if (!sessionId) throw new Error('sessionId obbligatorio');
  const tenantId = requireTenantId();
  const existing = docSnap || (await getDocumentoAcquisito(sessionId));
  const pagine = existing && Array.isArray(existing.pagine) ? existing.pagine : [];
  const storageErrors = [];
  let storageDeleted = 0;

  if (pagine.length) {
    const app = await requireFirebaseApp();
    const { getStorage, ref, deleteObject } = await import(
      'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js'
    );
    const storage = getStorage(app);
    for (let i = 0; i < pagine.length; i++) {
      const path = pagine[i] && pagine[i].storagePath;
      if (!path) continue;
      try {
        await deleteObject(ref(storage, path));
        storageDeleted += 1;
      } catch (err) {
        const code = err && err.code ? String(err.code) : '';
        // object-not-found: già assente, ok
        if (code.indexOf('object-not-found') >= 0) {
          storageDeleted += 1;
        } else {
          storageErrors.push((path || 'page') + ': ' + (err.message || code || 'errore'));
        }
      }
    }
  }

  await deleteDocument(COLLECTION_NAME, sessionId, tenantId);
  return { storageDeleted: storageDeleted, storageErrors: storageErrors };
}

/**
 * Orchestrazione post-Registra: upload + metadati (dipendenze iniettabili via document-archive).
 * @param {object} params — v. persistDocumentArchiveAfterRegister
 * @returns {Promise<object>}
 */
export async function persistArchiveForSession(params) {
  const { persistDocumentArchiveAfterRegister } = await import(
    '../../../core/js/tony/document-archive.js'
  );
  const tenantId = requireTenantId();
  return persistDocumentArchiveAfterRegister({
    tenantId,
    sessionId: params.sessionId,
    pages: params.pages,
    estrazione: params.estrazione,
    movimentoIds: params.movimentoIds,
    documentoCollegatoId: params.documentoCollegatoId || null,
    userId: params.userId || null,
    uploadBytes: uploadDocumentoPage,
    saveDocumento: saveDocumentoAcquisito,
    linkDocumentoCollegato: async function (bollaSessionId, patch) {
      try {
        const existing = await getDocumentoAcquisito(bollaSessionId);
        if (existing) {
          await updateDocumentoAcquisito(bollaSessionId, patch || {});
        }
      } catch (e) {
        console.warn('[documenti-acquisiti] aggiornamento bolla collegata:', e);
      }
    },
  });
}

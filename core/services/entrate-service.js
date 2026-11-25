/**
 * Entrate Service — CRUD registro vendite ed entrate (multi-tenant).
 *
 * @module core/services/entrate-service
 */

import {
  createDocument,
  getDocumentData,
  updateDocument,
  deleteDocument,
  getCollectionData,
  getAuthInstance
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { Entrata, filtraEntrate } from '../models/Entrata.js';

const COLLECTION_NAME = 'entrate';

function requireTenantId() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Nessun tenant corrente disponibile');
  }
  return tenantId;
}

function currentUserId() {
  try {
    const auth = getAuthInstance();
    return (auth && auth.currentUser && auth.currentUser.uid) || null;
  } catch (_) {
    return null;
  }
}

/**
 * Tutte le entrate del tenant (ordinamento e filtri lato client — niente indici compositi).
 * @param {Object} [options]
 * @param {string} [options.orderBy='data']
 * @param {'asc'|'desc'} [options.orderDirection='desc']
 * @param {string|null} [options.tipo]
 * @param {string|null} [options.coltura]
 * @param {string|null} [options.start] YYYY-MM-DD
 * @param {string|null} [options.end] YYYY-MM-DD
 * @returns {Promise<Entrata[]>}
 */
export async function getAllEntrate(options = {}) {
  try {
    const tenantId = requireTenantId();
    const {
      orderBy = 'data',
      orderDirection = 'desc',
      tipo = null,
      coltura = null,
      start = null,
      end = null
    } = options;

    const documents = await getCollectionData(COLLECTION_NAME, { tenantId });
    let list = (documents || []).map((doc) => Entrata.fromData(doc));

    list = filtraEntrate(list, { tipo, coltura, start, end });

    const dir = orderDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const av = a && a[orderBy] != null ? String(a[orderBy]) : '';
      const bv = b && b[orderBy] != null ? String(b[orderBy]) : '';
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      const aid = a && a.id ? String(a.id) : '';
      const bid = b && b.id ? String(b.id) : '';
      return aid < bid ? -1 * dir : aid > bid ? 1 * dir : 0;
    });

    return list;
  } catch (error) {
    console.error('Errore recupero entrate:', error);
    throw new Error(`Errore recupero entrate: ${error.message}`);
  }
}

/**
 * @param {string} entrataId
 * @returns {Promise<Entrata|null>}
 */
export async function getEntrata(entrataId) {
  try {
    const tenantId = requireTenantId();
    if (!entrataId) throw new Error('ID entrata obbligatorio');
    const data = await getDocumentData(COLLECTION_NAME, entrataId, tenantId);
    if (!data) return null;
    return Entrata.fromData(data);
  } catch (error) {
    console.error('Errore recupero entrata:', error);
    throw new Error(`Errore recupero entrata: ${error.message}`);
  }
}

/**
 * @param {Object} entrataData
 * @returns {Promise<string>} ID creato
 */
export async function createEntrata(entrataData) {
  try {
    const tenantId = requireTenantId();
    const payload = { ...entrataData };
    if (!payload.createdBy) payload.createdBy = currentUserId();
    const entrata = new Entrata(payload);
    const validation = entrata.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    return await createDocument(COLLECTION_NAME, entrata.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore creazione entrata:', error);
    throw new Error(`Errore creazione entrata: ${error.message}`);
  }
}

/**
 * @param {string} entrataId
 * @param {Object} updates
 * @returns {Promise<void>}
 */
export async function updateEntrata(entrataId, updates) {
  try {
    const tenantId = requireTenantId();
    if (!entrataId) throw new Error('ID entrata obbligatorio');
    const esistente = await getEntrata(entrataId);
    if (!esistente) throw new Error('Entrata non trovata');
    esistente.update(updates);
    const validation = esistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    await updateDocument(COLLECTION_NAME, entrataId, esistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento entrata:', error);
    throw new Error(`Errore aggiornamento entrata: ${error.message}`);
  }
}

/**
 * @param {string} entrataId
 * @returns {Promise<void>}
 */
export async function deleteEntrata(entrataId) {
  try {
    const tenantId = requireTenantId();
    if (!entrataId) throw new Error('ID entrata obbligatorio');
    await deleteDocument(COLLECTION_NAME, entrataId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione entrata:', error);
    throw error;
  }
}

export default {
  getAllEntrate,
  getEntrata,
  createEntrata,
  updateEntrata,
  deleteEntrata
};

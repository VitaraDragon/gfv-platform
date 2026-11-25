/**
 * Consegne / bolle — CRUD con aggancio automatico al conferimento aperto.
 * @module core/services/consegne-service
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
import { Consegna } from '../models/Consegna.js';
import { ensureConferimentoAperto, annataCorrente } from './conferimenti-service.js';

const COLLECTION_NAME = 'consegne';

function requireTenantId() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
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

export async function getAllConsegne(options = {}) {
  const tenantId = requireTenantId();
  const docs = await getCollectionData(COLLECTION_NAME, { tenantId });
  let list = (docs || []).map((d) => Consegna.fromData(d));
  if (options.conferimentoId) {
    list = list.filter((c) => String(c.conferimentoId) === String(options.conferimentoId));
  }
  if (options.acquirenteId) {
    list = list.filter((c) => String(c.acquirenteId) === String(options.acquirenteId));
  }
  list.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  return list;
}

export async function getConsegna(id) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID consegna obbligatorio');
  const data = await getDocumentData(COLLECTION_NAME, id, tenantId);
  return data ? Consegna.fromData(data) : null;
}

/**
 * Crea una consegna; se manca conferimentoId, collega/crea il conferimento aperto
 * per acquirente + categoria + prodotto + annata.
 *
 * @param {Object} data
 * @param {{ categoriaProdotto?: string, annata?: string }} [meta]
 */
export async function createConsegna(data, meta = {}) {
  const tenantId = requireTenantId();
  const payload = { ...data };
  if (!payload.createdBy) payload.createdBy = currentUserId();

  if (!payload.conferimentoId) {
    if (!payload.acquirenteId) throw new Error('Acquirente obbligatorio');
    const categoriaProdotto = meta.categoriaProdotto || payload.categoriaProdotto;
    if (!categoriaProdotto) throw new Error('Categoria prodotto obbligatoria per creare il conferimento');
    const conf = await ensureConferimentoAperto({
      acquirenteId: payload.acquirenteId,
      categoriaProdotto,
      prodotto: payload.prodotto || '',
      annata: meta.annata || annataCorrente()
    });
    payload.conferimentoId = conf.id;
  }

  const row = new Consegna(payload);
  const v = row.validate();
  if (!v.valid) throw new Error(`Validazione fallita: ${v.errors.join(', ')}`);
  return createDocument(COLLECTION_NAME, row.toFirestore(), tenantId);
}

export async function updateConsegna(id, updates) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID consegna obbligatorio');
  const row = await getConsegna(id);
  if (!row) throw new Error('Consegna non trovata');
  row.update(updates);
  const v = row.validate();
  if (!v.valid) throw new Error(`Validazione fallita: ${v.errors.join(', ')}`);
  await updateDocument(COLLECTION_NAME, id, row.toFirestore(), tenantId);
}

export async function deleteConsegna(id) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID consegna obbligatorio');
  await deleteDocument(COLLECTION_NAME, id, tenantId);
}

export default {
  getAllConsegne,
  getConsegna,
  createConsegna,
  updateConsegna,
  deleteConsegna
};

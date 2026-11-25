/**
 * Acquirenti — anagrafica destinazioni vendita / conferimento.
 * @module core/services/acquirenti-service
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
import { Acquirente } from '../models/Acquirente.js';

const COLLECTION_NAME = 'acquirenti';

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

export async function getAllAcquirenti(options = {}) {
  const tenantId = requireTenantId();
  const docs = await getCollectionData(COLLECTION_NAME, { tenantId });
  let list = (docs || []).map((d) => Acquirente.fromData(d));
  const cat = options.categoriaProdotto ? String(options.categoriaProdotto) : '';
  if (cat) {
    list = list.filter(
      (a) =>
        !a.categorieProdotto.length ||
        a.categorieProdotto.includes(cat)
    );
  }
  list.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'it'));
  return list;
}

export async function getAcquirente(id) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID acquirente obbligatorio');
  const data = await getDocumentData(COLLECTION_NAME, id, tenantId);
  return data ? Acquirente.fromData(data) : null;
}

export async function createAcquirente(data) {
  const tenantId = requireTenantId();
  const payload = { ...data };
  if (!payload.createdBy) payload.createdBy = currentUserId();
  const row = new Acquirente(payload);
  const v = row.validate();
  if (!v.valid) throw new Error(`Validazione fallita: ${v.errors.join(', ')}`);
  return createDocument(COLLECTION_NAME, row.toFirestore(), tenantId);
}

export async function updateAcquirente(id, updates) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID acquirente obbligatorio');
  const row = await getAcquirente(id);
  if (!row) throw new Error('Acquirente non trovato');
  row.update(updates);
  const v = row.validate();
  if (!v.valid) throw new Error(`Validazione fallita: ${v.errors.join(', ')}`);
  await updateDocument(COLLECTION_NAME, id, row.toFirestore(), tenantId);
}

export async function deleteAcquirente(id) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID acquirente obbligatorio');
  await deleteDocument(COLLECTION_NAME, id, tenantId);
}

/**
 * Cerca per nome (case-insensitive). Usato dalla migrazione leggera testo → anagrafica.
 */
export async function findAcquirenteByNome(nome) {
  const needle = String(nome || '').trim().toLowerCase();
  if (!needle) return null;
  const all = await getAllAcquirenti();
  return all.find((a) => String(a.nome || '').trim().toLowerCase() === needle) || null;
}

export default {
  getAllAcquirenti,
  getAcquirente,
  createAcquirente,
  updateAcquirente,
  deleteAcquirente,
  findAcquirenteByNome
};

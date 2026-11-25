/**
 * Conferimenti — CRUD e lookup aperto per acquirente/prodotto/annata.
 * @module core/services/conferimenti-service
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
import { Conferimento } from '../models/Conferimento.js';

const COLLECTION_NAME = 'conferimenti';

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

function normProdotto(p) {
  return String(p || '').trim().toLowerCase();
}

export async function getAllConferimenti(options = {}) {
  const tenantId = requireTenantId();
  const docs = await getCollectionData(COLLECTION_NAME, { tenantId });
  let list = (docs || []).map((d) => Conferimento.fromData(d));
  if (options.acquirenteId) {
    list = list.filter((c) => String(c.acquirenteId) === String(options.acquirenteId));
  }
  if (options.categoriaProdotto) {
    list = list.filter((c) => c.categoriaProdotto === options.categoriaProdotto);
  }
  if (options.annata) {
    list = list.filter((c) => String(c.annata) === String(options.annata));
  }
  if (options.stato) {
    list = list.filter((c) => c.stato === options.stato);
  }
  list.sort((a, b) => String(b.annata || '').localeCompare(String(a.annata || '')));
  return list;
}

export async function getConferimento(id) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID conferimento obbligatorio');
  const data = await getDocumentData(COLLECTION_NAME, id, tenantId);
  return data ? Conferimento.fromData(data) : null;
}

/**
 * Trova un conferimento aperto con stesso acquirente, categoria, prodotto e annata.
 */
export async function findConferimentoAperto({
  acquirenteId,
  categoriaProdotto,
  prodotto = '',
  annata
}) {
  const list = await getAllConferimenti({
    acquirenteId,
    categoriaProdotto,
    annata,
    stato: 'aperto'
  });
  const p = normProdotto(prodotto);
  return (
    list.find((c) => normProdotto(c.prodotto) === p) ||
    (p === '' ? list[0] || null : null)
  );
}

/**
 * Restituisce il conferimento aperto esistente oppure ne crea uno.
 */
export async function ensureConferimentoAperto(data) {
  const existing = await findConferimentoAperto(data);
  if (existing) return existing;
  const id = await createConferimento({
    ...data,
    stato: 'aperto'
  });
  return getConferimento(id);
}

export async function createConferimento(data) {
  const tenantId = requireTenantId();
  const payload = { ...data };
  if (!payload.createdBy) payload.createdBy = currentUserId();
  if (!payload.stato) payload.stato = 'aperto';
  const row = new Conferimento(payload);
  const v = row.validate();
  if (!v.valid) throw new Error(`Validazione fallita: ${v.errors.join(', ')}`);
  return createDocument(COLLECTION_NAME, row.toFirestore(), tenantId);
}

export async function updateConferimento(id, updates) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID conferimento obbligatorio');
  const row = await getConferimento(id);
  if (!row) throw new Error('Conferimento non trovato');
  row.update(updates);
  const v = row.validate();
  if (!v.valid) throw new Error(`Validazione fallita: ${v.errors.join(', ')}`);
  await updateDocument(COLLECTION_NAME, id, row.toFirestore(), tenantId);
}

export async function deleteConferimento(id) {
  const tenantId = requireTenantId();
  if (!id) throw new Error('ID conferimento obbligatorio');
  await deleteDocument(COLLECTION_NAME, id, tenantId);
}

/** Annata agraria di riferimento (anno di inizio: 11 nov). */
export function annataCorrente(refDate = new Date()) {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const d = refDate.getDate();
  if (m < 10 || (m === 10 && d < 11)) return String(y - 1);
  return String(y);
}

export default {
  getAllConferimenti,
  getConferimento,
  findConferimentoAperto,
  ensureConferimentoAperto,
  createConferimento,
  updateConferimento,
  deleteConferimento,
  annataCorrente
};

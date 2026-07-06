/**
 * CRUD calcoli vendemmia meccanica salvati
 * @module modules/vendemmia-meccanica/services/calcoli-vm-service
 */

import {
  createDocument,
  getDocumentData,
  updateDocument,
  deleteDocument,
  getCollectionData
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { CALCOLI_VM_COLLECTION } from '../config/vm-constants.js';

/**
 * @param {Object} [options]
 * @returns {Promise<Array<Object>>}
 */
export async function getAllCalcoliVm(options = {}) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');

  const { orderBy = 'createdAt', orderDirection = 'desc', anno = null, clienteId = null } = options;
  const docs = await getCollectionData(CALCOLI_VM_COLLECTION, {
    tenantId,
    orderBy,
    orderDirection
  });

  let list = docs;
  if (anno != null) list = list.filter((d) => Number(d.anno) === Number(anno));
  if (clienteId) list = list.filter((d) => d.clienteId === clienteId);
  return list;
}

/**
 * @param {string} calcoloId
 */
export async function getCalcoloVm(calcoloId) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  return getDocumentData(CALCOLI_VM_COLLECTION, calcoloId, tenantId);
}

/**
 * @param {Object} breakdown — output calcolaCompensoVendemmia().breakdown + metadati
 */
export async function saveCalcoloVm(breakdown, extra = {}) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  if (!breakdown || !breakdown.clienteId) throw new Error('Breakdown calcolo non valido');

  const payload = {
    clienteId: breakdown.clienteId,
    clienteNome: breakdown.clienteNome || extra.clienteNome || '',
    dataVendemmia: extra.dataVendemmia || new Date().toISOString().slice(0, 10),
    anno: breakdown.anno,
    destinazioneTrasporto: breakdown.destinazioneTrasporto,
    quintali: breakdown.quintali,
    scontoMaggiorazione: breakdown.scontoMaggiorazione || 0,
    terreni: breakdown.terreni,
    totaleVendemmia: breakdown.totaleVendemmia,
    totaleTrasporto: breakdown.totaleTrasporto,
    totaleFinale: breakdown.totaleFinale,
    note: extra.note || '',
    preventivoId: extra.preventivoId || null,
    lavoroId: extra.lavoroId || null
  };

  return createDocument(CALCOLI_VM_COLLECTION, payload, tenantId);
}

/**
 * Aggiorna preventivo CT con riferimento al calcolo VM salvato.
 * @param {string} calcoloId
 * @param {string|null|undefined} preventivoId
 */
export async function linkCalcoloVmToPreventivo(calcoloId, preventivoId) {
  const tenantId = getCurrentTenantId();
  if (!tenantId || !calcoloId || !preventivoId) return null;
  await updateDocument('preventivi', preventivoId, { calcoloVmId: calcoloId }, tenantId);
  return calcoloId;
}

/**
 * Ricava preventivoId univoco dai terreni selezionati (stato piano stagione anno).
 * @param {Array<Object>} terreni
 * @param {number|string} anno
 * @returns {string|null}
 */
export function resolvePreventivoIdFromTerreni(terreni, anno) {
  const annoKey = String(anno);
  const ids = new Set();
  (Array.isArray(terreni) ? terreni : []).forEach((t) => {
    const raw = t._originalData || t;
    const vm = (raw.vendemmiaMeccanica || t.vendemmiaMeccanica || {})[annoKey] || {};
    if (vm.preventivoId) ids.add(String(vm.preventivoId));
  });
  if (ids.size === 1) return [...ids][0];
  return null;
}

export async function deleteCalcoloVm(calcoloId) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  await deleteDocument(CALCOLI_VM_COLLECTION, calcoloId, tenantId);
}

export async function updateCalcoloVm(calcoloId, updates) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  await updateDocument(CALCOLI_VM_COLLECTION, calcoloId, updates, tenantId);
}

export default {
  getAllCalcoliVm,
  getCalcoloVm,
  saveCalcoloVm,
  deleteCalcoloVm,
  updateCalcoloVm,
  linkCalcoloVmToPreventivo,
  resolvePreventivoIdFromTerreni
};

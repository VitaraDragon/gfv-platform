/**
 * Bilancio servizio vendemmia meccanica — ricavi − spese
 * @module modules/vendemmia-meccanica/services/bilancio-vm-service
 */

import { getCollectionData, createDocument, deleteDocument } from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { SPESE_VM_COLLECTION } from '../config/vm-constants.js';
import { getAllCalcoliVm } from './calcoli-vm-service.js';

/**
 * @param {number|string} anno
 * @returns {Promise<number>}
 */
export async function getRicaviAnno(anno) {
  const calcoli = await getAllCalcoliVm({ anno });
  return Math.round(calcoli.reduce((s, c) => s + (Number(c.totaleFinale) || 0), 0) * 100) / 100;
}

/**
 * @param {number|string} [anno]
 * @returns {Promise<Array<Object>>}
 */
export async function getSpeseVm(anno = null) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');

  const docs = await getCollectionData(SPESE_VM_COLLECTION, {
    tenantId,
    orderBy: 'data',
    orderDirection: 'desc'
  });
  if (anno == null) return docs;
  return docs.filter((d) => Number(d.anno) === Number(anno));
}

/**
 * @param {number|string} anno
 * @returns {Promise<number>}
 */
export async function getTotaleSpeseAnno(anno) {
  const spese = await getSpeseVm(anno);
  return Math.round(spese.reduce((s, sp) => s + (Number(sp.importo) || 0), 0) * 100) / 100;
}

/**
 * @param {number|string} anno
 * @returns {Promise<Object>}
 */
export async function getBilancioVmAnno(anno) {
  const [ricavi, speseTot, spese, calcoli] = await Promise.all([
    getRicaviAnno(anno),
    getTotaleSpeseAnno(anno),
    getSpeseVm(anno),
    getAllCalcoliVm({ anno })
  ]);
  const margine = Math.round((ricavi - speseTot) * 100) / 100;
  return {
    anno: Number(anno),
    ricavi,
    spese: speseTot,
    margine,
    numCalcoli: calcoli.length,
    numSpese: spese.length,
    dettaglioSpese: spese
  };
}

/**
 * @param {{ data: string, descrizione: string, importo: number, anno: number }} spesa
 */
export async function addSpesaVm(spesa) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  if (!spesa.descrizione || spesa.importo == null) {
    throw new Error('Descrizione e importo obbligatori');
  }
  return createDocument(SPESE_VM_COLLECTION, {
    data: spesa.data || new Date().toISOString().slice(0, 10),
    descrizione: spesa.descrizione,
    importo: Number(spesa.importo),
    anno: Number(spesa.anno)
  }, tenantId);
}

export async function deleteSpesaVm(spesaId) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  await deleteDocument(SPESE_VM_COLLECTION, spesaId, tenantId);
}

export default {
  getRicaviAnno,
  getSpeseVm,
  getTotaleSpeseAnno,
  getBilancioVmAnno,
  addSpesaVm,
  deleteSpesaVm
};

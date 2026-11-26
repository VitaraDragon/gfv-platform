/**
 * Impostazioni IVA tenant — documento unico sotto impostazioni/iva.
 *
 * @module core/services/iva-impostazioni-service
 */

import { getDocumentData, setDocument } from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { mergeIvaConfig } from '../models/IvaConfig.js';

const COLLECTION_NAME = 'impostazioni';
const DOC_ID = 'iva';

function requireTenantId() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  return tenantId;
}

/**
 * Legge config IVA (default se documento assente).
 * @returns {Promise<{ regime: string, aliquote: Array<object>, compensazione: Array<object> }>}
 */
export async function getIvaImpostazioni() {
  const tenantId = requireTenantId();
  try {
    const data = await getDocumentData(COLLECTION_NAME, DOC_ID, tenantId);
    return mergeIvaConfig(data || {});
  } catch (error) {
    console.error('Errore lettura impostazioni IVA:', error);
    return mergeIvaConfig({});
  }
}

/**
 * Salva config IVA (merge con default lato scrittura).
 * @param {{ regime?: string, aliquote?: Array<object>, compensazione?: Array<object> }} payload
 */
export async function saveIvaImpostazioni(payload = {}) {
  const tenantId = requireTenantId();
  const merged = mergeIvaConfig(payload);
  await setDocument(
    COLLECTION_NAME,
    DOC_ID,
    {
      regime: merged.regime,
      aliquote: merged.aliquote,
      compensazione: merged.compensazione,
      updatedAt: new Date().toISOString()
    },
    tenantId
  );
  return merged;
}

export { DOC_ID as IVA_IMPOSTAZIONI_DOC_ID };

export default {
  getIvaImpostazioni,
  saveIvaImpostazioni,
  IVA_IMPOSTAZIONI_DOC_ID: DOC_ID
};

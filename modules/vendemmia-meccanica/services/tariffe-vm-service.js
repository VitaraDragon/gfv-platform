/**
 * Tariffe vendemmia meccanica — impostazioni tenant
 * @module modules/vendemmia-meccanica/services/tariffe-vm-service
 */

import { getDocumentData, setDocument } from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import {
  TARIFFE_VM_DOC_PATH,
  MORFOLOGIE_VM,
  TIPI_PALO_VM,
  DESTINAZIONI_TRASPORTO_PRESET,
  COEFFICIENTI_SESTO_DEFAULT,
  tariffaVmKey
} from '../config/vm-constants.js';

const IMPOSTAZIONI_COLLECTION = 'impostazioni';

/**
 * Griglia tariffe vendemmia vuota (morf × palo).
 * @returns {Record<string, number>}
 */
export function buildDefaultTariffeVendemmia() {
  const out = {};
  MORFOLOGIE_VM.forEach((m) => {
    TIPI_PALO_VM.forEach((p) => {
      out[tariffaVmKey(m, p)] = 0;
    });
  });
  return out;
}

/**
 * Tariffe trasporto default da preset.
 * @returns {Record<string, number>}
 */
export function buildDefaultTariffeTrasporto() {
  const out = {};
  DESTINAZIONI_TRASPORTO_PRESET.forEach((d) => {
    out[d.id] = 0;
  });
  return out;
}

/**
 * Config tariffe completa con default.
 * @param {Object} [partial]
 * @returns {Object}
 */
export function normalizeTariffeVmConfig(partial = {}) {
  return {
    tariffeVendemmia: {
      ...buildDefaultTariffeVendemmia(),
      ...(partial.tariffeVendemmia || {})
    },
    coefficientiSesto: {
      ...COEFFICIENTI_SESTO_DEFAULT,
      ...(partial.coefficientiSesto || {})
    },
    tariffeTrasporto: {
      ...buildDefaultTariffeTrasporto(),
      ...(partial.tariffeTrasporto || {})
    }
  };
}

/**
 * @returns {Promise<Object>}
 */
export async function getTariffeVmConfig() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');

  const data = await getDocumentData(IMPOSTAZIONI_COLLECTION, TARIFFE_VM_DOC_PATH, tenantId);
  if (!data) return normalizeTariffeVmConfig();
  const { id, createdAt, updatedAt, ...rest } = data;
  return normalizeTariffeVmConfig(rest);
}

/**
 * @param {Object} config
 * @returns {Promise<void>}
 */
export async function saveTariffeVmConfig(config) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');

  const normalized = normalizeTariffeVmConfig(config);
  await setDocument(IMPOSTAZIONI_COLLECTION, TARIFFE_VM_DOC_PATH, normalized, tenantId);
  return normalized;
}

export default {
  buildDefaultTariffeVendemmia,
  buildDefaultTariffeTrasporto,
  normalizeTariffeVmConfig,
  getTariffeVmConfig,
  saveTariffeVmConfig
};

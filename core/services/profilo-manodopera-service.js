/**
 * Profilo manodopera per tenant — skill dichiarate e calcolate (scheda operaio).
 *
 * Firestore: tenants/{tenantId}/profiliManodopera/{userId}
 *
 * @module core/services/profilo-manodopera-service
 */

import {
  getDocumentData,
  updateDocument,
  setDocument,
  serverTimestamp
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { getDefaultDeclaredSkillIdsForTipoOperaio } from '../config/manodopera-skills-config.js';
import {
  normalizeProfiloManodopera,
  normalizeSkillDichiarateIds,
  summarizeProfiloForList
} from './profilo-manodopera-normalize.js';

export { normalizeSkillDichiarateIds, normalizeProfiloManodopera, summarizeProfiloForList };

export const COLLECTION_NAME = 'profiliManodopera';

/**
 * @param {string} userId
 * @param {string} [tenantId]
 * @returns {Promise<Object|null>}
 */
export async function getProfiloManodopera(userId, tenantId = null) {
  const tid = tenantId || getCurrentTenantId();
  if (!tid || !userId) {
    throw new Error('tenantId e userId obbligatori');
  }
  const data = await getDocumentData(COLLECTION_NAME, userId, tid);
  if (!data) return null;
  return normalizeProfiloManodopera({ ...data, userId });
}

/**
 * @param {string} userId
 * @param {string|null|undefined} tipoOperaio
 * @param {string} [tenantId]
 * @returns {Promise<Object>}
 */
export async function getProfiloManodoperaOrDefaults(userId, tipoOperaio, tenantId = null) {
  const existing = await getProfiloManodopera(userId, tenantId);
  if (existing) return existing;
  return normalizeProfiloManodopera({
    userId,
    skillDichiarate: getDefaultDeclaredSkillIdsForTipoOperaio(tipoOperaio),
    skillCalcolate: []
  });
}

/**
 * @param {string} userId
 * @param {{ skillDichiarate: string[], notaProfilo?: string, aggiornatoDa: string }} payload
 * @param {string} [tenantId]
 * @returns {Promise<void>}
 */
export async function saveProfiloManodoperaSkillDichiarate(userId, payload, tenantId = null) {
  const tid = tenantId || getCurrentTenantId();
  if (!tid || !userId) {
    throw new Error('tenantId e userId obbligatori');
  }
  if (!payload?.aggiornatoDa) {
    throw new Error('aggiornatoDa obbligatorio');
  }

  const skillDichiarate = normalizeSkillDichiarateIds(payload.skillDichiarate || []);
  const notaProfilo = payload.notaProfilo != null ? String(payload.notaProfilo).trim() : '';

  const existing = await getDocumentData(COLLECTION_NAME, userId, tid);
  const base = {
    userId,
    skillDichiarate,
    notaProfilo,
    aggiornatoDa: payload.aggiornatoDa,
    aggiornatoIl: serverTimestamp()
  };

  if (existing) {
    const patch = { ...base };
    if (Array.isArray(existing.skillCalcolate)) {
      patch.skillCalcolate = existing.skillCalcolate;
    }
    await updateDocument(COLLECTION_NAME, userId, patch, tid);
    return;
  }

  await setDocument(
    COLLECTION_NAME,
    userId,
    {
      ...base,
      skillCalcolate: []
    },
    tid
  );
}

/**
 * Accesso modulo Meteo (pay-per-use).
 * @module modules/meteo/services/meteo-module-service
 */

import { getCurrentTenantId, getCurrentTenant } from '../../../core/services/tenant-service.js';
import { getDocumentData } from '../../../core/services/firebase-service.js';
import { hasModuleAccessFromTenant } from '../../../core/utils/module-access-resolver.js';

/**
 * @returns {Promise<boolean>}
 */
export async function hasMeteoModuleAccess() {
  const tenantId = getCurrentTenantId();
  let tenantData = null;
  if (tenantId) {
    try {
      tenantData = await getDocumentData('tenants', tenantId);
    } catch (e) {
      // fallback
    }
  }
  if (!tenantData) {
    tenantData = await getCurrentTenant();
  }
  if (!tenantData) return false;
  if (hasModuleAccessFromTenant(tenantData, 'meteo')) return true;
  const legacy = Array.isArray(tenantData?.moduli_attivi) ? tenantData.moduli_attivi : [];
  return legacy.some((m) => String(m || '').toLowerCase() === 'meteo');
}

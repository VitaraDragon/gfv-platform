/**
 * Accesso modulo Meteo (pay-per-use).
 * @module modules/meteo/services/meteo-module-service
 */

import { getCurrentTenantId, getCurrentTenant } from '../../../core/services/tenant-service.js';
import { getDocumentData } from '../../../core/services/firebase-service.js';

/**
 * @returns {Promise<boolean>}
 */
export async function hasMeteoModuleAccess() {
  const tenantId = getCurrentTenantId();
  if (tenantId) {
    try {
      const tenantData = await getDocumentData('tenants', tenantId);
      const modules = Array.isArray(tenantData?.modules) ? tenantData.modules : [];
      if (modules.some((m) => String(m || '').toLowerCase() === 'meteo')) {
        return true;
      }
      const legacy = Array.isArray(tenantData?.moduli_attivi) ? tenantData.moduli_attivi : [];
      return legacy.some((m) => String(m || '').toLowerCase() === 'meteo');
    } catch (e) {
      // fallback
    }
  }
  const tenant = await getCurrentTenant();
  const modules = Array.isArray(tenant?.modules) ? tenant.modules : [];
  return modules.some((m) => String(m || '').toLowerCase() === 'meteo');
}

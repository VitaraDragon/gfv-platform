/**
 * Report Service - orchestratore report/bilancio cross-moduli (MVP)
 *
 * Nota: questo servizio non calcola tutto da solo; coordina "adapter" per modulo.
 */
import { getAvailableModules, getCurrentTenantId, getCurrentTenant } from '../../../core/services/tenant-service.js';
import { getDocumentData } from '../../../core/services/firebase-service.js';

/**
 * Verifica se il modulo report è attivo per il tenant corrente.
 * @returns {Promise<boolean>}
 */
export async function hasReportModuleAccess() {
  // Preferisci tenantId da sessionStorage (più affidabile su pagine nuove)
  const tenantId = getCurrentTenantId();
  if (tenantId) {
    try {
      const tenantData = await getDocumentData('tenants', tenantId);
      const modules = Array.isArray(tenantData?.modules) ? tenantData.modules : [];
      return modules.some(m => (m || '').toLowerCase() === 'report');
    } catch (e) {
      // fallback sotto
    }
  }

  // Fallback: usa tenant-service (può essere soggetto a race all'avvio)
  const tenant = await getCurrentTenant();
  const modules = Array.isArray(tenant?.modules) ? tenant.modules : [];
  return modules.some(m => (m || '').toLowerCase() === 'report');
}

/**
 * Ritorna lista moduli attivi (incluso core) per il tenant corrente.
 * @returns {Promise<string[]>}
 */
export async function getActiveModules() {
  return await getAvailableModules();
}


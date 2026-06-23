/**
 * Enforcement limiti piano Free (terreni, attività/mese).
 * @module core/services/plan-limits-service
 */

import { getPlanOperationalLimits } from '../config/subscription-plans.js';
import { getCollectionData } from './firebase-service.js';
import { getCurrentTenantId, getCurrentTenant } from './tenant-service.js';

const UPGRADE_HINT = 'Passa al piano Base dalla pagina Abbonamento per terreni e attività senza limiti.';

/**
 * @param {string|null|undefined} dateStr - YYYY-MM-DD
 * @returns {string} YYYY-MM
 */
export function monthKeyFromActivityDate(dateStr) {
  if (dateStr && typeof dateStr === 'string') {
    const match = dateStr.match(/^(\d{4})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * @param {string} monthKey - YYYY-MM
 * @returns {{ dataDa: string, dataA: string }}
 */
export function monthRangeFromKey(monthKey) {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    dataDa: `${monthKey}-01`,
    dataA: `${monthKey}-${String(lastDay).padStart(2, '0')}`
  };
}

/**
 * Terreni aziendali (esclusi terreni clienti conto terzi).
 * @param {string} tenantId
 */
export async function countAziendaTerreni(tenantId) {
  const docs = await getCollectionData('terreni', { tenantId });
  return docs.filter((d) => !d.clienteId || d.clienteId === '').length;
}

/**
 * @param {string} tenantId
 * @param {string} monthKey - YYYY-MM
 */
export async function countAttivitaInMonth(tenantId, monthKey) {
  const { dataDa, dataA } = monthRangeFromKey(monthKey);
  try {
    const docs = await getCollectionData('attivita', {
      tenantId,
      where: [
        ['data', '>=', dataDa],
        ['data', '<=', dataA]
      ]
    });
    return docs.length;
  } catch (error) {
    const docs = await getCollectionData('attivita', { tenantId });
    return docs.filter((d) => d.data >= dataDa && d.data <= dataA).length;
  }
}

/**
 * @param {object|null|undefined} tenantData
 */
export function getLimitsForTenantData(tenantData) {
  return getPlanOperationalLimits(tenantData?.plan || tenantData?.piano);
}

/**
 * @param {string|null} [tenantId]
 * @param {object|null} [tenantData]
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function assertCanCreateTerreno(tenantId = null, tenantData = null) {
  const tid = tenantId || getCurrentTenantId();
  if (!tid) {
    return { ok: false, message: 'Nessun tenant corrente disponibile.' };
  }
  const tenant = tenantData || (await getCurrentTenant());
  const { maxTerreni } = getLimitsForTenantData(tenant);
  if (maxTerreni == null) return { ok: true };

  const count = await countAziendaTerreni(tid);
  if (count >= maxTerreni) {
    return {
      ok: false,
      message: `Piano Free: massimo ${maxTerreni} terreni aziendali (ne hai già ${count}). ${UPGRADE_HINT}`
    };
  }
  return { ok: true };
}

/**
 * @param {string|null|undefined} activityDate - YYYY-MM-DD
 * @param {string|null} [tenantId]
 * @param {object|null} [tenantData]
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function assertCanCreateAttivita(activityDate, tenantId = null, tenantData = null) {
  const tid = tenantId || getCurrentTenantId();
  if (!tid) {
    return { ok: false, message: 'Nessun tenant corrente disponibile.' };
  }
  const tenant = tenantData || (await getCurrentTenant());
  const { maxAttivitaMese } = getLimitsForTenantData(tenant);
  if (maxAttivitaMese == null) return { ok: true };

  const monthKey = monthKeyFromActivityDate(activityDate);
  const count = await countAttivitaInMonth(tid, monthKey);
  if (count >= maxAttivitaMese) {
    return {
      ok: false,
      message: `Piano Free: massimo ${maxAttivitaMese} attività al mese (mese ${monthKey}: ne hai già ${count}). ${UPGRADE_HINT}`
    };
  }
  return { ok: true };
}

export default {
  monthKeyFromActivityDate,
  monthRangeFromKey,
  countAziendaTerreni,
  countAttivitaInMonth,
  getLimitsForTenantData,
  assertCanCreateTerreno,
  assertCanCreateAttivita
};

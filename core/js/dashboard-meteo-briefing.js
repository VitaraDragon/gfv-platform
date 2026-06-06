/**
 * Briefing meteo Tony su dashboard (modulo meteo + Tony Avanzato, manager/admin).
 * @module core/js/dashboard-meteo-briefing
 */

import { fetchMeteoTerreniCached } from '../services/meteo-service.js';
import {
  buildMeteoProactiveBriefingConsigli,
  formatMeteoConsigliProactive,
} from '../config/tony-meteo-rules.js';
import { compactSedeMeteoFromFetch } from './meteo-ui-helpers.js';

const METEO_MODULE_ID = 'meteo';
const TONY_MODULE_ID = 'tony';

function hasModule(modules, id) {
  return Array.isArray(modules) && modules.some((m) => String(m).toLowerCase() === id);
}

function compactSedeFromTerreniResponse(sedeResult) {
  if (!sedeResult || !sedeResult.ok || !sedeResult.meteo) return null;
  return compactSedeMeteoFromFetch(sedeResult.meteo);
}

/**
 * Carica consigli meteo per briefing dashboard (cache CF 15 min).
 * @param {string} tenantId
 * @returns {Promise<{ consigli: Array<object>, consigliCount: number, summaryMeteo: string, proactiveText: string }|null>}
 */
export async function loadTonyMeteoBriefingData(tenantId) {
  if (!tenantId) return null;

  const meteoRes = await fetchMeteoTerreniCached(tenantId);

  if (!meteoRes || !meteoRes.ok) return null;

  const sede = compactSedeFromTerreniResponse(meteoRes.sede);

  const consigli = buildMeteoProactiveBriefingConsigli(sede);
  if (!consigli.length) return null;

  const proactiveText = formatMeteoConsigliProactive(consigli);
  const summaryParts = consigli.slice(0, 5).map((c) => c.motivo).filter(Boolean);

  return {
    consigli,
    consigliCount: consigli.length,
    summaryMeteo: summaryParts.join('; '),
    proactiveText,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Gating: manager/admin + Tony Avanzato + modulo meteo.
 * @param {string[]} availableModules
 * @param {string[]} ruoli
 */
export function tonyMeteoBriefingAllowed(availableModules, ruoli) {
  const r = Array.isArray(ruoli) ? ruoli : [];
  const isManager = r.some((x) => x === 'manager' || x === 'amministratore');
  if (!isManager) return false;
  if (!hasModule(availableModules, METEO_MODULE_ID)) return false;
  if (!hasModule(availableModules, TONY_MODULE_ID)) return false;
  return true;
}

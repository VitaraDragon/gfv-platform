/**
 * Risposta meteo locale su dashboard (cache client già caricata) — evita round-trip CF lento.
 * @module core/js/tony/meteo-dashboard-quick-reply
 */

import { fetchMeteoTerreniCached } from '../../services/meteo-service.js';
import { compactSedeMeteoFromFetch } from '../meteo-ui-helpers.js';
import {
  isDashboardMeteoQuestion,
  isTonyDashboardPagePath,
  formatSedeMeteoReply,
} from './meteo-dashboard-quick-reply-utils.js';

export { isDashboardMeteoQuestion, isTonyDashboardPagePath } from './meteo-dashboard-quick-reply-utils.js';

async function resolveTenantId() {
  try {
    var mod = await import('../../services/tenant-service.js');
    if (mod.getCurrentTenantId) return mod.getCurrentTenantId();
  } catch (_) { /* ignore */ }
  return (typeof window !== 'undefined' && window.currentTenantId) ? window.currentTenantId : null;
}

/**
 * @param {string} text
 * @returns {Promise<{ handled: boolean, text?: string, voiceText?: string }>}
 */
export async function tryDashboardMeteoQuickReply(text) {
  if (!isDashboardMeteoQuestion(text)) return { handled: false };
  var tenantId = await resolveTenantId();
  if (!tenantId) return { handled: false };

  var res = await fetchMeteoTerreniCached(tenantId);
  if (!res || !res.ok || !res.sede || !res.sede.meteo) return { handled: false };

  var sede = compactSedeMeteoFromFetch(res.sede.meteo);
  var reply = formatSedeMeteoReply(text, sede);
  if (!reply) return { handled: false };

  return { handled: true, text: reply, voiceText: reply };
}

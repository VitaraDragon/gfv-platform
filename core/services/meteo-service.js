/**
 * Client — meteo via Cloud Functions (sede base, sede avanzata, terreni).
 * @module core/services/meteo-service
 */

import { getHttpsCallable } from './firebase-service.js';

/**
 * @param {string} tenantId
 * @returns {Promise<{ ok: boolean, code?: string, message?: string, cached?: boolean, meteo?: object }>}
 */
export async function fetchMeteoSede(tenantId) {
  if (!tenantId) {
    return { ok: false, code: 'NO_TENANT', message: 'Tenant non disponibile.' };
  }
  const callable = getHttpsCallable('getMeteoSede');
  const result = await callable({ tenantId: String(tenantId) });
  return result.data || { ok: false, message: 'Risposta meteo non valida.' };
}

/**
 * Meteo sede avanzato (modulo meteo attivo).
 * @param {string} tenantId
 */
export async function fetchMeteoSedeAvanzato(tenantId) {
  if (!tenantId) {
    return { ok: false, code: 'NO_TENANT', message: 'Tenant non disponibile.' };
  }
  const callable = getHttpsCallable('getMeteoSedeAvanzato');
  const result = await callable({ tenantId: String(tenantId) });
  return result.data || { ok: false, message: 'Risposta meteo non valida.' };
}

/**
 * Meteo per tutti i terreni aziendali + sede (modulo meteo attivo).
 * @param {string} tenantId
 */
export async function fetchMeteoTerreni(tenantId) {
  if (!tenantId) {
    return { ok: false, code: 'NO_TENANT', message: 'Tenant non disponibile.' };
  }
  const callable = getHttpsCallable('getMeteoTerreni');
  const result = await callable({ tenantId: String(tenantId) });
  return result.data || { ok: false, message: 'Risposta meteo non valida.' };
}

const TERRENI_CACHE_TTL_MS = 15 * 60 * 1000;
let _terreniMeteoCache = { tenantId: null, fetchedAt: 0, data: null };

/**
 * Meteo terreni con cache client (15 min, allineata a CF).
 * @param {string} tenantId
 * @param {{ maxAgeMs?: number, force?: boolean }} [opts]
 */
export async function fetchMeteoTerreniCached(tenantId, opts = {}) {
  const maxAgeMs = opts.maxAgeMs != null ? opts.maxAgeMs : TERRENI_CACHE_TTL_MS;
  const now = Date.now();
  if (
    !opts.force &&
    _terreniMeteoCache.tenantId === tenantId &&
    _terreniMeteoCache.data &&
    now - _terreniMeteoCache.fetchedAt < maxAgeMs
  ) {
    return _terreniMeteoCache.data;
  }
  const data = await fetchMeteoTerreni(tenantId);
  if (data && data.ok) {
    _terreniMeteoCache = { tenantId, fetchedAt: now, data };
  }
  return data;
}

/**
 * Riga meteo compatta per un terreno (usa cache fetchMeteoTerreniCached).
 * @param {string} tenantId
 * @param {string} terrenoId
 */
export async function fetchTerrenoMeteoRowCached(tenantId, terrenoId) {
  if (!tenantId || !terrenoId) return null;
  const res = await fetchMeteoTerreniCached(tenantId);
  if (!res || !res.ok || !Array.isArray(res.terreni)) return null;
  return res.terreni.find((r) => r && r.terrenoId === terrenoId) || null;
}

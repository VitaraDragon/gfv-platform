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

const SEDE_LS_PREFIX = 'gfv_meteo_sede_v1_';
const SEDE_CACHE_TTL_MS = 15 * 60 * 1000;

function sedeCacheKey(tenantId, advanced) {
  return `${SEDE_LS_PREFIX}${advanced ? 'adv' : 'base'}_${tenantId}`;
}

/**
 * @param {string} tenantId
 * @param {boolean} advanced
 * @returns {{ meteo: object, fetchedAt: number }|null}
 */
export function readMeteoSedeLocalCache(tenantId, advanced = false) {
  if (!tenantId) return null;
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(sedeCacheKey(tenantId, advanced));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.meteo) return null;
    return { meteo: parsed.meteo, fetchedAt: parsed.fetchedAt || 0 };
  } catch (_) {
    return null;
  }
}

/**
 * @param {string} tenantId
 * @param {boolean} advanced
 * @returns {{ ok: boolean, meteo: object, cached: boolean, stale?: boolean }|null}
 */
export function getMeteoSedeCachedPayload(tenantId, advanced = false) {
  const entry = readMeteoSedeLocalCache(tenantId, advanced);
  if (!entry) return null;
  const stale = Date.now() - entry.fetchedAt > SEDE_CACHE_TTL_MS;
  return { ok: true, meteo: entry.meteo, cached: true, stale };
}

function writeMeteoSedeLocalCache(tenantId, advanced, meteo) {
  if (!tenantId || !meteo) return;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      sedeCacheKey(tenantId, advanced),
      JSON.stringify({ meteo, fetchedAt: Date.now() })
    );
  } catch (e) {
    console.warn('writeMeteoSedeLocalCache:', e);
  }
}

/** Invalida cache meteo sede (es. cambio tenant). */
export function clearMeteoSedeLocalCache(tenantId) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (tenantId) {
      localStorage.removeItem(sedeCacheKey(tenantId, false));
      localStorage.removeItem(sedeCacheKey(tenantId, true));
      return;
    }
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SEDE_LS_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch (_) {
    /* ignore */
  }
}

/**
 * Fetch meteo sede con persistenza localStorage.
 * @param {string} tenantId
 * @param {{ advanced?: boolean }} [opts]
 */
export async function fetchMeteoSedeWithLocalCache(tenantId, opts = {}) {
  const advanced = !!opts.advanced;
  const fetchFn = advanced ? fetchMeteoSedeAvanzato : fetchMeteoSede;
  const result = await fetchFn(tenantId);
  if (result && result.ok && result.meteo) {
    writeMeteoSedeLocalCache(tenantId, advanced, result.meteo);
  }
  return result;
}

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

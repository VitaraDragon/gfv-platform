/**
 * Prefetch conteggi dashboard al login (prima del redirect).
 * @module core/js/dashboard-login-prefetch
 */

import {
  getDoc,
  doc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from '../services/firebase-service.js';

/**
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Object}
 */
export function buildDashboardPrefetchDependencies(db) {
  return { db, getDoc, doc, collection, getDocs, query, where, orderBy, limit };
}

/**
 * @param {string[]} modules
 */
function buildCountsCtx(modules) {
  const mods = Array.isArray(modules) ? modules : [];
  return {
    availableModules: mods,
    hasManodopera: mods.includes('manodopera'),
    hasContoTerzi: mods.includes('contoTerzi'),
    hasMeteoModule: mods.includes('meteo'),
  };
}

/**
 * Avvia prefetch snapshot in background (non blocca redirect).
 * @param {import('firebase/firestore').Firestore} db
 * @param {string|null|undefined} tenantId
 */
export function startDashboardPrefetchFromLogin(db, tenantId) {
  if (!db || !tenantId) return;
  void (async () => {
    try {
      const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
      const modules = tenantDoc.exists() ? tenantDoc.data().modules || [] : [];
      const { prefetchDashboardCountsSnapshot } = await import('./dashboard-counts-snapshot.js');
      await prefetchDashboardCountsSnapshot(tenantId, buildCountsCtx(modules), buildDashboardPrefetchDependencies(db));
    } catch (e) {
      console.warn('[dashboard prefetch login]', e);
    }
  })();
}

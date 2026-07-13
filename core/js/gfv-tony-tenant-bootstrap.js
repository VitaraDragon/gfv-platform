/**
 * Dopo initializeFirebase: pubblica piano/moduli tenant per il FAB Tony.
 * Copre pagine legacy (preventivi, clienti CT, …) che non chiamano tenant-service in auth.
 * @module core/js/gfv-tony-tenant-bootstrap
 */

import { onAuthStateChanged, getDocumentData, getAuthInstance } from '../services/firebase-service.js';
import {
  getCurrentTenantId,
  setCurrentTenantId,
  prefetchTenantForTony,
  getUserRolesForTenant
} from '../services/tenant-service.js';

function publishTonyUserRolesForCapture(tenantId, userId) {
  if (!tenantId || !userId) return Promise.resolve();
  return getUserRolesForTenant(tenantId, userId).then(function (ruoli) {
    if (!Array.isArray(ruoli) || ruoli.length === 0) return;
    try {
      sessionStorage.setItem('gfv_tony_utente_ruoli', JSON.stringify(ruoli));
    } catch (e) { /* ignore */ }
    var payload = { utente_corrente: { ruoli: ruoli } };
    if (typeof window.setTonyContext === 'function') {
      window.setTonyContext(payload);
    } else if (window.Tony && typeof window.Tony.setContext === 'function') {
      var d = (window.Tony.context && window.Tony.context.dashboard) || {};
      window.Tony.setContext('dashboard', Object.assign({}, d, payload));
      try { if (typeof window.__tonyDocCaptureRefresh === 'function') window.__tonyDocCaptureRefresh(); } catch (e2) { /* ignore */ }
    }
  }).catch(function () { /* ignore */ });
}

let authListenerRegistered = false;

function resolveCoreBaseForShell() {
  const path = (window.location.pathname || '').replace(/\\/g, '/');
  const isGH = path.indexOf('/gfv-platform/') >= 0;
  if (isGH) return `${window.location.origin}/gfv-platform/core`;
  if (path.indexOf('/core/dev/') >= 0) return '../';
  if (path.indexOf('/core/admin/') >= 0) return '../';
  if (path.indexOf('/core/mobile/') >= 0) return '../';
  if (path.indexOf('/modules/') >= 0) return '../../../core/';
  return '';
}

function ensureTonyLoaderShell() {
  const base = resolveCoreBaseForShell();
  const sep = base && !base.endsWith('/') ? '/' : '';
  const loaderSrc = `${base ? base + sep : ''}js/gfv-tony-loader.js?v=20260706`;

  if (!window.__gfvTonyLoaderRequested && !document.querySelector('script[src*="gfv-tony-loader"]')) {
    window.__gfvTonyLoaderRequested = true;
    const loader = document.createElement('script');
    loader.src = loaderSrc;
    document.head.appendChild(loader);
  }

  if (typeof window.gfvEnsureStandaloneShell === 'function') {
    window.gfvEnsureStandaloneShell();
    return;
  }
  if (window.__gfvStandaloneShellRequested) return;
  if (document.querySelector('script[src*="gfv-standalone-shell"]')) {
    window.__gfvStandaloneShellRequested = true;
    return;
  }
  window.__gfvStandaloneShellRequested = true;
  const s = document.createElement('script');
  s.src = `${base ? base + sep : ''}js/gfv-standalone-shell.js`;
  document.body.appendChild(s);
}

async function resolveTenantIdForUser(user) {
  let tid = getCurrentTenantId();
  if (tid) return tid;

  const userData = await getDocumentData('users', user.uid);
  if (!userData) return null;

  tid = userData.tenantId || null;
  if (!tid && userData.tenantMemberships && typeof userData.tenantMemberships === 'object') {
    const keys = Object.keys(userData.tenantMemberships);
    if (keys.length === 1) tid = keys[0];
  }
  return tid || null;
}

/**
 * Registra listener auth e pubblica contesto tenant → gfv-tony-loader.
 */
export function bootstrapTonyTenantFromAuth() {
  if (authListenerRegistered || typeof window === 'undefined') return;
  authListenerRegistered = true;

  ensureTonyLoaderShell();

  try {
    const auth = getAuthInstance();
    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const tid = await resolveTenantIdForUser(user);
        if (!tid) return;
        setCurrentTenantId(tid);
        await prefetchTenantForTony(tid);
        await publishTonyUserRolesForCapture(tid, user.uid);
      } catch (err) {
        console.warn('[Tony bootstrap] publish tenant:', err.message || err);
      }
    });
  } catch (err) {
    console.warn('[Tony bootstrap] auth listener:', err.message || err);
  }
}

export default { bootstrapTonyTenantFromAuth };

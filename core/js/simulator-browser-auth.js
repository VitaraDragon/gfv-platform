/**
 * Auto-login pagine GFV dopo "Entra" dalla pagina dev simulatore (emulator Auth).
 * @module core/js/simulator-browser-auth
 */

import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { shouldUseFirebaseEmulator } from './firebase-emulator-dev.js';

export const SIM_PENDING_LOGIN_KEY = 'gfv_sim_pending_login';
export const SIM_DEFAULT_PASSWORD = 'SimGFV2026!';

export function storeSimPendingLogin(entry, password = SIM_DEFAULT_PASSWORD) {
  if (!entry || !entry.email) return;
  try {
    sessionStorage.setItem(SIM_PENDING_LOGIN_KEY, JSON.stringify({
      email: entry.email,
      password,
      tenantId: entry.tenantId || '',
      userId: entry.userId || ''
    }));
    if (entry.tenantId) sessionStorage.setItem('gfv_current_tenant_id', entry.tenantId);
    if (entry.userId) sessionStorage.setItem('gfv_expected_user_id', entry.userId);
  } catch (_) { /* ignore */ }
}

/**
 * Attende auth e, se serve, rifà login da sessionStorage (navigazione cross-page emulator).
 * @param {import('firebase/auth').Auth} auth
 * @returns {Promise<import('firebase/auth').User|null>}
 */
export async function ensureSimulatorSession(auth) {
  if (!shouldUseFirebaseEmulator() || !auth) return auth?.currentUser || null;

  if (typeof auth.authStateReady === 'function') {
    await auth.authStateReady();
  }
  if (auth.currentUser) return auth.currentUser;

  let raw;
  try {
    raw = sessionStorage.getItem(SIM_PENDING_LOGIN_KEY);
  } catch (_) {
    return null;
  }
  if (!raw) return null;

  let pending;
  try {
    pending = JSON.parse(raw);
  } catch (_) {
    return null;
  }
  if (!pending.email || !pending.password) return null;

  try {
    const cred = await signInWithEmailAndPassword(auth, pending.email, pending.password);
    if (pending.tenantId) {
      sessionStorage.setItem('gfv_current_tenant_id', pending.tenantId);
      try {
        const { setCurrentTenantId } = await import('../services/tenant-service.js');
        setCurrentTenantId(pending.tenantId);
      } catch (_) { /* tenant-service optional on some pages */ }
    }
    if (pending.userId) {
      sessionStorage.setItem('gfv_expected_user_id', pending.userId);
    }
    sessionStorage.removeItem(SIM_PENDING_LOGIN_KEY);
    return cred.user;
  } catch (err) {
    console.warn('[simulator-auth] Auto-login fallito:', err.message);
    return null;
  }
}

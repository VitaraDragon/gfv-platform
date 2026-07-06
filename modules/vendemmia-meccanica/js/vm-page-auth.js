/**
 * Bootstrap comune pagine VM — auth, licenza, tenant
 * @module modules/vendemmia-meccanica/js/vm-page-auth
 */

import { initializeFirebase, getAuthInstance, getDb } from '../../../core/services/firebase-service.js';
import { onAuthStateChanged, getDoc, doc } from '../../../core/services/firebase-service.js';
import { setCurrentTenantId } from '../../../core/services/tenant-service.js';
import { MODULE_ID, REQUIRES_MODULES } from '../config/vm-constants.js';

function ensureGfvStandaloneShell() {
  if (typeof window === 'undefined') return;
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
  s.src = '../../../core/js/gfv-standalone-shell.js';
  document.body.appendChild(s);
}

export function waitForFirebaseConfig(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.firebaseConfig) {
      resolve(window.firebaseConfig);
      return;
    }
    let attempts = 0;
    const max = Math.ceil(timeoutMs / 100);
    const iv = setInterval(() => {
      attempts++;
      if (window.firebaseConfig) {
        clearInterval(iv);
        resolve(window.firebaseConfig);
      } else if (attempts >= max) {
        clearInterval(iv);
        reject(new Error('Firebase config timeout'));
      }
    }, 100);
  });
}

/**
 * @param {{ requireManager?: boolean }} [options]
 * @returns {Promise<{ user: object, tenantId: string, modules: string[] }>}
 */
export async function initVmPageAuth(options = {}) {
  ensureGfvStandaloneShell();
  const config = await waitForFirebaseConfig();
  initializeFirebase(config);
  const auth = getAuthInstance();
  const db = getDb();

  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = '../../../core/auth/login-standalone.html';
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          window.location.href = '../../../core/auth/login-standalone.html';
          return;
        }
        const userData = userDoc.data();
        const tenantId = userData.tenantId;
        setCurrentTenantId(tenantId);

        if (options.requireManager !== false) {
          const ruoli = userData.ruoli || [];
          const isManager = ruoli.some((r) => {
            const rl = String(r).toLowerCase();
            return rl.includes('manager') || rl.includes('amministratore');
          });
          if (!isManager) {
            reject(new Error('Permessi insufficienti'));
            return;
          }
        }

        const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
        const tenantData = tenantDoc.exists() ? tenantDoc.data() : {};
        const modules = tenantData.modules || [];
        const missing = [MODULE_ID, ...REQUIRES_MODULES].filter((m) => !modules.includes(m));
        if (missing.length) {
          reject(new Error('Moduli non attivi: ' + missing.join(', ')));
          return;
        }

        resolve({
          user,
          tenantId,
          modules,
          userData,
          tenantNome: tenantData.nome || userData.nomeAzienda || userData.ragioneSociale || ''
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export function showVmAlert(containerId, message, type) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const cls = type === 'error' ? 'alert-error' : type === 'success' ? 'alert-success' : 'alert-warning';
  el.innerHTML = '<div class="alert ' + cls + '">' + message + '</div>';
}

export function publishTonyTableData(pageType, summary, items) {
  window.currentTableData = { pageType, summary, items: items || [] };
  try {
    if (window.Tony && window.Tony.setContext) {
      const page = (window.Tony.context && window.Tony.context.page) || {};
      window.Tony.setContext('page', Object.assign({}, page, {
        tableDataSummary: summary,
        currentTableData: window.currentTableData
      }));
    }
  } catch (e) { /* ignore */ }
  try {
    window.dispatchEvent(new CustomEvent('table-data-ready', {
      detail: { currentTableData: window.currentTableData }
    }));
  } catch (e2) { /* ignore */ }
}

export default { waitForFirebaseConfig, initVmPageAuth, showVmAlert, publishTonyTableData };

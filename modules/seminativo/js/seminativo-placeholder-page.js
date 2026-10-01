/**
 * Init condiviso per le sottopagine placeholder del modulo Seminativo.
 * @module modules/seminativo/js/seminativo-placeholder-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { publishSeminativoTableData, placeholderTableData } from './seminativo-page-context.js';
import { getSeminativoHubCard } from '../config/seminativo-hub.js';

function readPageMeta() {
  const body = document.body || {};
  const cardId = body.getAttribute('data-seminativo-page') || '';
  const card = getSeminativoHubCard(cardId);
  return {
    cardId,
    card,
    pageType: body.getAttribute('data-page-type') || (card && card.pageType) || 'seminativo',
    title: (card && card.title) || document.title || 'Seminativo'
  };
}

function syncTonyModules(modules) {
  if (typeof window.syncTonyModules === 'function') {
    window.syncTonyModules(modules);
    return;
  }
  if (window.setTonyContext) {
    window.setTonyContext({ moduli_attivi: modules });
    return;
  }
  window.dispatchEvent(new CustomEvent('tony-module-updated', { detail: { modules } }));
}

export async function initSeminativoPlaceholderPage() {
  const meta = readPageMeta();
  publishSeminativoTableData(placeholderTableData(
    meta.pageType,
    'Caricamento dati in corso...'
  ));

  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[seminativo] Bootstrap failed:', err);
    throw err;
  }

  const firebaseServiceModule = await import(resolvePath('../../../core/services/firebase-service.js'));
  const tenantServiceModule = await import(resolvePath('../../../core/services/tenant-service.js'));
  const { getAuthInstance, onAuthStateChanged } = firebaseServiceModule;
  const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenantServiceModule;

  const auth = getAuthInstance();
  initializeTenantService();

  onAuthStateChanged(auth, async (user) => {
    if (!user) user = await resolveAuthUser(auth);
    if (!user) {
      window.location.href = await loginPageUrl(resolvePath('../../../core/auth/login-standalone.html'));
      return;
    }

    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      console.warn('[seminativo] Tenant non disponibile');
      return;
    }

    const tenant = await getCurrentTenant().catch(() => null);
    const modules = Array.isArray(tenant?.modules) ? tenant.modules.slice() : [];
    if (!modules.some((m) => String(m || '').toLowerCase() === 'seminativo')) {
      modules.push('seminativo');
    }
    if (!modules.some((m) => String(m || '').toLowerCase() === 'tony')) {
      modules.push('tony');
    }
    syncTonyModules(modules);

    publishSeminativoTableData(placeholderTableData(
      meta.pageType,
      'Scheletro modulo Seminativo: ' + meta.title + ' — dati in arrivo nelle prossime fasi.'
    ));
  });
}

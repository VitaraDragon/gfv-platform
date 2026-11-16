/**
 * Init condiviso per le sottopagine placeholder del modulo Orticole.
 * @module modules/orticole/js/orticole-placeholder-page
 */

import { resolvePath } from '../../../core/js/gfv-path.js';
import { resolveEffectiveModules } from '../../../core/utils/module-access-resolver.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';
import { publishOrticoleTableData, placeholderTableData } from './orticole-page-context.js';
import { getOrticoleHubCard } from '../config/orticole-hub.js';

function readPageMeta() {
  const body = document.body || {};
  const cardId = body.getAttribute('data-orticole-page') || '';
  const card = getOrticoleHubCard(cardId);
  return {
    cardId,
    card,
    pageType: body.getAttribute('data-page-type') || (card && card.pageType) || 'orticole',
    title: (card && card.title) || document.title || 'Orticole'
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

export async function initOrticolePlaceholderPage() {
  const meta = readPageMeta();
  publishOrticoleTableData(placeholderTableData(
    meta.pageType,
    'Caricamento dati in corso...'
  ));

  try {
    await window.GFVStandaloneReady;
  } catch (err) {
    console.error('[orticole] Bootstrap failed:', err);
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
      console.warn('[orticole] Tenant non disponibile');
      return;
    }

    const tenant = await getCurrentTenant().catch(() => null);
    const modules = resolveEffectiveModules(tenant);
    if (!modules.some((m) => String(m || '').toLowerCase() === 'orticole')) {
      modules.push('orticole');
    }
    if (!modules.some((m) => String(m || '').toLowerCase() === 'tony')) {
      modules.push('tony');
    }
    syncTonyModules(modules);

    publishOrticoleTableData(placeholderTableData(
      meta.pageType,
      'Scheletro modulo Orticole: ' + meta.title + ' — dati in arrivo nelle prossime fasi.'
    ));
  });
}

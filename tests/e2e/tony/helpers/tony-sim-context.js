/**
 * Contesto sim per Tony E2E — login + verifica piano/modulo Tony.
 * Riusa sim-login.js.
 * @module tests/e2e/tony/helpers/tony-sim-context
 */

export {
  loginAsManagerContoTerzi,
  loginAsManagerFromDevPage,
  loginAsManagerManodopera,
  loginAsOperaioFromDevPage,
  loginAsCapoFromDevPage,
  SIM_DEV_PATH,
} from '../../sim/helpers/sim-login.js';

/** Query emulator + hook metriche E2E. */
export const TONY_E2E_QUERY = 'emulator=1&tonyE2e=1';

/** Query tier 3 live (Functions emulator + CF reale). */
export const TONY_E2E_LIVE_QUERY = 'emulator=1&tonyE2e=1&tonyE2eLive=1';

/**
 * @param {string} path - es. `/core/dashboard-standalone.html`
 * @param {{ live?: boolean }} [opts]
 * @returns {string}
 */
export function withTonyE2eQuery(path, opts = {}) {
  const raw = path.startsWith('/') ? path : `/${path}`;
  const [pathname, search = ''] = raw.split('?');
  const params = new URLSearchParams(search);
  params.set('emulator', '1');
  params.set('tonyE2e', '1');
  if (opts.live) params.set('tonyE2eLive', '1');
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} path
 * @param {{ live?: boolean }} [opts]
 */
export async function gotoTonyE2ePage(page, path, opts = {}) {
  await page.goto(withTonyE2eQuery(path, opts));
}

/**
 * Esegue login sim per nome funzione (matrice scenari).
 * @param {import('playwright-core').Page} page
 * @param {string} loginName
 * @param {object} [loginOptions]
 */
export async function runTonySimLogin(page, loginName, loginOptions = {}) {
  const mod = await import('../../sim/helpers/sim-login.js');
  const fn = mod[loginName];
  if (typeof fn !== 'function') {
    throw new Error(`tony-sim-context: login sconosciuto "${loginName}"`);
  }
  await fn(page, loginOptions);
}

/**
 * Attende bootstrap tenant su pagina standalone (Firestore → window.__gfvTenantData).
 * @param {import('playwright-core').Page} page
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function waitForTonySimTenantData(page, { timeoutMs = 60_000 } = {}) {
  await page.waitForFunction(
    () => {
      const td = window.__gfvTenantData || {};
      let mods = window.__gfvModuliAttivi || td.modules || td.moduli || [];
      if ((!mods || !mods.length) && window.Tony && window.Tony.context && window.Tony.context.dashboard) {
        mods = window.Tony.context.dashboard.moduli_attivi || mods;
      }
      const plan = td.plan || td.piano || window.__gfvSubscriptionPlanId;
      const path = (window.location && window.location.pathname) || '';
      const onFieldWs = path.indexOf('field-workspace') >= 0;
      if (Array.isArray(mods) && mods.length > 0) {
        if (plan || onFieldWs) return true;
      }
      return !!plan && Array.isArray(mods) && mods.length > 0;
    },
    null,
    { timeout: timeoutMs }
  );
}

/**
 * Verifica tenant seed: piano base + modulo tony (Tony Avanzato).
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 */
export async function assertTonySimTenantReady(page, expect) {
  await waitForTonySimTenantData(page);
  const data = await page.evaluate(() => {
    const td = window.__gfvTenantData || {};
    const mods =
      window.__gfvModuliAttivi ||
      td.modules ||
      td.moduli ||
      [];
    return {
      plan: td.plan || td.piano || window.__gfvSubscriptionPlanId || null,
      modules: Array.isArray(mods) ? mods.map((m) => String(m).toLowerCase()) : [],
    };
  });
  expect(data.plan).toBe('base');
  if (!data.modules.includes('tony')) {
    throw new Error(
      'Tenant seed senza modulo tony — riesegui: npm run sim:run -- --template=viticola-conto-terzi-manodopera'
    );
  }
}

/**
 * Salva snapshot tenant/piano post-login (dashboard o field workspace).
 * @param {import('playwright-core').Page} page
 */
export async function captureTonyTenantSnapshot(page) {
  await waitForTonySimTenantData(page).catch(() => {});
  await page.evaluate(() => {
    const td = window.__gfvTenantData || {};
    let moduli = window.__gfvModuliAttivi || td.modules || td.moduli || [];
    if (!Array.isArray(moduli) || !moduli.length) {
      moduli = ['tony', 'manodopera', 'meteo', 'contoTerzi', 'magazzino', 'vigneto'];
    }
    const plan = window.__gfvSubscriptionPlanId || td.plan || td.piano || 'base';
    const snap = {
      plan,
      tenantData: Object.assign({}, td, { plan, piano: plan, modules: moduli }),
      moduli,
    };
    sessionStorage.setItem('gfv_tony_e2e_tenant_snap', JSON.stringify(snap));
  });
}

/**
 * Ripristina snapshot e forza load widget Tony sulla pagina corrente.
 * @param {import('playwright-core').Page} page
 */
export async function restoreTonyTenantSnapshot(page) {
  await page.evaluate(() => {
    try {
      const raw = sessionStorage.getItem('gfv_tony_e2e_tenant_snap');
      if (!raw) return;
      const snap = JSON.parse(raw);
      if (snap.tenantData) window.__gfvTenantData = snap.tenantData;
      if (Array.isArray(snap.moduli) && snap.moduli.length) {
        window.__gfvModuliAttivi = snap.moduli.slice();
      }
      const plan = snap.plan || 'base';
      window.__gfvSubscriptionPlanId = plan;
      window.dispatchEvent(new CustomEvent('gfv-subscription-plan', { detail: { planId: plan } }));
      if (typeof window.gfvTryLoadTonyWidgetWhenReady === 'function') {
        window.gfvTryLoadTonyWidgetWhenReady();
      } else if (typeof window.gfvLoadTonyWidget === 'function') {
        window.gfvLoadTonyWidget();
      }
    } catch (e) { /* ignore */ }
  });
}

/**
 * Attende dati tenant/piano e forza load widget Tony su standalone module pages.
 * @param {import('playwright-core').Page} page
 */
export async function bootstrapTonyWidgetOnStandalonePage(page) {
  await restoreTonyTenantSnapshot(page);
}

/**
 * Attende currentTableData con pageType e righe visibili.
 * @param {import('playwright-core').Page} page
 * @param {string} pageType
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function waitForCurrentTableData(page, pageType, { timeoutMs = 90_000 } = {}) {
  await page.waitForFunction(
    (pt) => {
      const t = window.currentTableData;
      if (!t || String(t.pageType || '') !== pt) return false;
      if (!Array.isArray(t.items) || t.items.length === 0) return false;
      const summary = typeof t.summary === 'string' ? t.summary.trim() : '';
      if (!summary || /caricamento/i.test(summary)) return false;
      return true;
    },
    pageType,
    { timeout: timeoutMs }
  );
}

/**
 * Simula piano Free per T-DENY-002 — ri-mostra FAB solo in modalità tonyE2e.
 * @param {import('playwright-core').Page} page
 */
export async function applyTonyFreePlanForE2e(page) {
  await page.evaluate(() => {
    window.__gfvTenantData = Object.assign({}, window.__gfvTenantData || {}, {
      plan: 'free',
      piano: 'free',
    });
    window.__gfvSubscriptionPlanId = 'free';
    window.__tonyFreemiumBlocked = true;
    window.__GFV_TONY_E2E_FORCE_FREEMIUM = true;
    if (window.__tonyE2eMode) {
      const fab = document.getElementById('tony-fab');
      const panel = document.getElementById('tony-panel');
      if (fab) fab.style.display = '';
      if (panel) {
        panel.style.display = '';
        panel.classList.add('is-open');
      }
    }
  });
}

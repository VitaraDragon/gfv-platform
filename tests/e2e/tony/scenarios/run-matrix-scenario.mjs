/**
 * Runner generico da matrice scenari Tony E2E (M-T3).
 * @module tests/e2e/tony/scenarios/run-matrix-scenario
 */

import { assertScenarioExpect, assertTurnExpect, waitForScenarioFormFields } from '../helpers/assert-scenario-expect.mjs';
import { simE2ePause } from '../../sim/helpers/sim-e2e-timeouts.mjs';
import { activateTonyMockCf, installTonyMockCf } from '../helpers/tony-mock-cf.js';
import {
  applyTonyFreePlanForE2e,
  assertTonySimTenantReady,
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  restoreTonyTenantSnapshot,
  runTonySimLogin,
  waitForCurrentTableData,
  waitForTonySimTenantData,
} from '../helpers/tony-sim-context.js';
import { captureTonyScenarioPerf, captureTonyScenarioReply } from '../helpers/tony-e2e-scenario-perf.mjs';
import {
  openTonyPanel,
  tonyConfirmNavigationIfNeeded,
  tonyGetExecutedCommands,
  tonyGetLastReplyText,
  tonySendMessage,
  tonySendMessageCrossPage,
  tonyWaitForReply,
  waitForTonyReady,
  waitForTonyReadyWithRetry,
  waitForTonyTurnPerf,
} from '../helpers/tony-widget.js';

const DEFAULT_START = '/core/dashboard-standalone.html';

/**
 * L'override deve vincere su un setContext tardivo del tenant (che ha Manodopera).
 * @param {import('playwright-core').Page} page
 * @param {string[]} mods
 */
async function applyModuliAttiviOverride(page, mods) {
  await page.evaluate((list) => {
    const modsNow = list.slice();
    window.__gfvModuliAttiviE2eOverride = modsNow.slice();
    try { sessionStorage.setItem('tony_moduli_attivi', JSON.stringify(modsNow)); } catch (e) { /* ignore */ }
    window.__gfvModuliAttivi = modsNow.slice();
    const tenant = window.__gfvTenantData;
    if (tenant && typeof tenant === 'object') {
      if (Array.isArray(tenant.modules)) {
        tenant.modules.splice(0, tenant.modules.length, ...modsNow);
      } else {
        tenant.modules = modsNow.slice();
      }
    }
    const tony = window.Tony;
    const dash = (tony && tony.context && tony.context.dashboard) || {};
    const info = Object.assign({}, dash.info_azienda || {}, { moduli_attivi: modsNow.slice() });
    if (tony && typeof tony.setContext === 'function') {
      tony.setContext('dashboard', Object.assign({}, dash, {
        moduli_attivi: modsNow.slice(),
        info_azienda: info
      }));
    } else if (tony && tony.context) {
      tony.context.dashboard = Object.assign({}, dash, {
        moduli_attivi: modsNow.slice(),
        info_azienda: info
      });
    }
    if (tony && tony.context) tony.context.moduli_attivi = modsNow.slice();
    if (typeof window.setTonyContext === 'function') {
      window.setTonyContext({ moduli_attivi: modsNow.slice() });
    }
  }, mods);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {string[]} mods
 */
async function assertOverrideManodoperaOff(page, expect, mods) {
  const wantsOff = !mods.some((m) => String(m).toLowerCase() === 'manodopera');
  if (!wantsOff) return;
  const has = await page.evaluate(() => {
    if (typeof window.__tonyModuliAttiviIncludeManodopera === 'function') {
      return window.__tonyModuliAttiviIncludeManodopera();
    }
    return null;
  });
  expect(has, 'hasManodopera sullo stesso path del client prima del send').toBe(false);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runMatrixScenario(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsManagerFromDevPage';

  if (scenario.mockCf) {
    await installTonyMockCf(page, { scenario });
  }

  const loginOptions = {};
  if (scenario.requiresSeedProfile) {
    loginOptions.preferTemplateId = scenario.requiresSeedProfile;
  }

  await runTonySimLogin(page, loginName, loginOptions);
  await captureTonyTenantSnapshot(page);

  const startPath = scenario.startUrl?.split('?')[0] || DEFAULT_START;
  const currentPath = new URL(page.url()).pathname;
  if (!currentPath.includes(startPath.replace(/^\//, '')) || !page.url().includes('tonyE2e=1')) {
    await gotoTonyE2ePage(page, scenario.startUrl || DEFAULT_START);
  }

  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });

  await bootstrapTonyWidgetOnStandalonePage(page);

  if (scenario.tier === 3) {
    await waitForTonyReadyWithRetry(page);
  } else {
    await waitForTonyReady(page);
  }

  if (scenario.id === 'T-SMOKE-001') {
    await assertTonySimTenantReady(page, expect);
  }

  if (scenario.mockCf) {
    await activateTonyMockCf(page, scenario);
  }

  if (scenario.id === 'T-PERF-002') {
    await waitForCurrentTableData(page, 'lavori');
  }

  if (scenario.id === 'T-PERF-003') {
    await waitForCurrentTableData(page, 'tariffe');
  }

  if (scenario.id === 'T-PERF-004' || scenario.id === 'T-PERF-005') {
    await waitForTonySimTenantData(page);
  }

  const replyTimeoutMs =
    typeof scenario.expect?.replyTimeoutMs === 'number'
      ? scenario.expect.replyTimeoutMs
      : scenario.tier === 3
        ? 60_000
        : 45_000;

  if (scenario.id === 'T-TYPO-001') {
    await page.locator('#quick-hours-form').waitFor({ state: 'visible', timeout: 30_000 });
  }

  if (scenario.id === 'T-DENY-001') {
    await page.evaluate(() => {
      try {
        const stored = sessionStorage.getItem('gfv_tony_utente_ruoli');
        if (stored) {
          const r = JSON.parse(stored);
          if (Array.isArray(r) && r.some((x) => /operaio/i.test(String(x)))) return;
        }
      } catch (e) { /* ignore */ }
      sessionStorage.setItem('gfv_tony_utente_ruoli', JSON.stringify(['operaio']));
    });
    await page.waitForFunction(
      () => {
        try {
          const stored = sessionStorage.getItem('gfv_tony_utente_ruoli');
          if (stored) {
            const r = JSON.parse(stored);
            if (Array.isArray(r) && r.some((x) => /operaio/i.test(String(x)))) return true;
          }
        } catch (e) { /* ignore */ }
        const d = window.Tony && window.Tony.context && window.Tony.context.dashboard;
        const ruoli = d && d.utente_corrente && d.utente_corrente.ruoli;
        return Array.isArray(ruoli) && ruoli.some((x) => /operaio/i.test(String(x)));
      },
      null,
      { timeout: 30_000 }
    );
  }

  await page.evaluate(() => {
    try { delete window.__gfvModuliAttiviE2eOverride; } catch (e) { /* ignore */ }
  });
  if (Array.isArray(scenario.moduliAttiviOverride)) {
    await applyModuliAttiviOverride(page, scenario.moduliAttiviOverride);
  }

  const urlBefore = page.url();
  const messages = Array.isArray(scenario.messages) ? scenario.messages : [];
  const turnExpects = Array.isArray(scenario.turnExpects) ? scenario.turnExpects : [];
  let turnCtx = {};

  if (messages.length === 0 && scenario.expect) {
    await openTonyPanel(page);
    await assertScenarioExpect(page, expect, scenario, { urlBefore });
    return;
  }

  if (scenario.expect?.navigation?.immediate && messages.length) {
    await page.addInitScript(() => {
      window.tonyDashboardBriefingFired = true;
      window.tonyMeteoBriefingFired = true;
    });
    const urlPart = String(scenario.expect.navigation.urlIncludes || '');
    const navPattern = new RegExp(urlPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    for (let turnIndex = 0; turnIndex < messages.length; turnIndex++) {
      if (Array.isArray(scenario.moduliAttiviOverride)) {
        await applyModuliAttiviOverride(page, scenario.moduliAttiviOverride);
        await assertOverrideManodoperaOff(page, expect, scenario.moduliAttiviOverride);
      }
      try {
        await tonySendMessageCrossPage(page, messages[turnIndex], { navUrlPattern: navPattern });
      } catch (err) {
        if (!navPattern.test(page.url())) throw err;
      }
    }
    await waitForTonyReady(page);
    await openTonyPanel(page);
    await page.waitForFunction(
      () => {
        const nodes = document.querySelectorAll('#tony-messages .tony-msg.tony');
        return Array.from(nodes).some((node) => /porto/i.test(node.textContent || ''));
      },
      null,
      { timeout: 20_000 }
    );
    const reply = await tonyGetLastReplyText(page);
    await assertScenarioExpect(page, expect, scenario, { urlBefore, lastReply: reply });
    return;
  }

  for (let turnIndex = 0; turnIndex < messages.length; turnIndex++) {
    const msg = messages[turnIndex];
    if (scenario.id === 'T-DENY-002') {
      await applyTonyFreePlanForE2e(page);
    }
    const tonyBefore = await tonySendMessage(page, msg);
    const reply = await tonyWaitForReply(page, { tonyCountBefore: tonyBefore, timeoutMs: replyTimeoutMs });
    const lastPerf = await waitForTonyTurnPerf(page);
    turnCtx = {
      lastReply: reply,
      lastPerf,
      lastCommands: await tonyGetExecutedCommands(page),
    };
    await captureTonyScenarioReply(page, reply);
    await captureTonyScenarioPerf(page, lastPerf);
    if (turnExpects[turnIndex]) {
      assertTurnExpect(expect, reply, turnExpects[turnIndex]);
      await waitForScenarioFormFields(page, turnExpects[turnIndex]);
    }
    if (scenario.id === 'T-DENY-001') {
      await page.waitForFunction(
        () => {
          const nodes = document.querySelectorAll('#tony-messages .tony-msg.tony');
          return Array.from(nodes).some((n) => /non posso/i.test(n.textContent || ''));
        },
        null,
        { timeout: 20_000 }
      );
      turnCtx.lastReply = await tonyGetLastReplyText(page);
    }
    if (scenario.expect?.navigation?.urlIncludes) {
      await tonyConfirmNavigationIfNeeded(page);
      await page.waitForTimeout(simE2ePause(400));
    }
  }

  await assertScenarioExpect(page, expect, scenario, { urlBefore, ...turnCtx });
}

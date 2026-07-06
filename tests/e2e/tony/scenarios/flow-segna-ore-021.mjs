/**
 * M-T4 — canary 3b-C21: segna ore workspace multi-turn → save → validazione manager.
 * @module tests/e2e/tony/scenarios/flow-segna-ore-021
 */

import { assertScenarioExpect } from '../helpers/assert-scenario-expect.mjs';
import { assertZeroCfAcrossTurns, tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
import {
  assertOrePendingInValidazione,
  goToSegnaOreSlide,
  selectFirstAssignedWork,
  TONY_E2E_ORE_NOTE,
  TONY_E2E_ORA_END,
  TONY_E2E_ORA_START,
} from '../helpers/tony-post-save.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import { waitForTonyReady } from '../helpers/tony-widget.js';

const DEFAULT_MESSAGES = ['segniamo le ore', '8', '17', '0', 'ok'];

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowSegnaOre021(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsOperaioFromDevPage';
  const messages = Array.isArray(scenario.messages) && scenario.messages.length
    ? scenario.messages
    : DEFAULT_MESSAGES;

  await runTonySimLogin(page, loginName);
  await captureTonyTenantSnapshot(page);

  await gotoTonyE2ePage(
    page,
    scenario.startUrl || '/core/mobile/field-workspace-standalone.html?emulator=1&tonyE2e=1'
  );

  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });

  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);

  await expect(page.locator('#field-swiper')).toBeVisible();
  await selectFirstAssignedWork(page);
  await goToSegnaOreSlide(page);
  await page.locator('#quick-hours-form').waitFor({ state: 'visible', timeout: 30_000 });

  const preSave = messages.slice(0, -1);
  const confirmMsg = messages[messages.length - 1];

  const result = preSave.length
    ? await tonyRunMultiTurn(page, preSave)
    : { perfTurns: [], lastReply: '', lastPerf: null, lastCommands: [] };

  if (preSave.length) {
    assertZeroCfAcrossTurns(expect, result.perfTurns, {
      cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
    });
  }

  if (Array.isArray(scenario.expect?.injectedFields) && scenario.expect.injectedFields.length) {
    await assertScenarioExpect(page, expect, {
      ...scenario,
      expect: {
        injectedFields: scenario.expect.injectedFields,
      },
    }, {
      lastPerf: result.lastPerf,
      lastCommands: result.lastCommands,
    });
  }

  const confirmTurn = await tonyRunMultiTurn(page, [confirmMsg], {
    beforeTurn: async (p, msg) => {
      const low = String(msg || '').trim().toLowerCase();
      if (low === 'ok' || low === 'salva' || low === 'ok salva') {
        await p.locator('#ora-note').fill(TONY_E2E_ORE_NOTE);
      }
    },
  });

  const perfTurns = [...(result.perfTurns || []), ...(confirmTurn.perfTurns || [])];
  assertZeroCfAcrossTurns(expect, perfTurns, {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  await page.locator('#hours-save-status').filter({ hasText: /Ore salvate:/i }).waitFor({
    timeout: 45_000,
  });

  const expectAfterSave = { ...(scenario.expect || {}) };
  delete expectAfterSave.injectedFields;
  if (Object.keys(expectAfterSave).length) {
    await assertScenarioExpect(page, expect, { ...scenario, expect: expectAfterSave }, {
      lastReply: confirmTurn.lastReply,
      lastPerf: confirmTurn.lastPerf,
      lastCommands: confirmTurn.lastCommands,
    });
  }

  await assertOrePendingInValidazione(page, expect, {
    note: TONY_E2E_ORE_NOTE,
    oraStart: TONY_E2E_ORA_START,
    oraEnd: TONY_E2E_ORA_END,
  });
}

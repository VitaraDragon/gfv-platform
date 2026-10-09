/**
 * Segna ore: un orario già occupato non va salvato.
 * Il seed di oggi ha 07:30–12:00: 10–11 ci cade dentro.
 * @module tests/e2e/tony/scenarios/flow-segna-ore-023
 */

import { assertZeroCfAcrossTurns, tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
import {
  goToSegnaOreSlide,
  selectFirstAssignedWork,
} from '../helpers/tony-post-save.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import { waitForTonyReady } from '../helpers/tony-widget.js';

const DEFAULT_MESSAGES = ['segniamo le ore', '10', '11', 'pausa 0'];

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowSegnaOre023(page, expect, scenario) {
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

  await selectFirstAssignedWork(page);
  await goToSegnaOreSlide(page);
  await page.locator('#quick-hours-form').waitFor({ state: 'visible', timeout: 30_000 });

  const replies = [];
  const result = await tonyRunMultiTurn(page, messages, {
    afterTurn: async (_page, _msg, ctx) => {
      replies.push(ctx.lastReply || '');
    },
  });
  assertZeroCfAcrossTurns(expect, result.perfTurns, {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  const idxAvviso = replies.findIndex((r) => /sovrappon/i.test(r));
  expect(idxAvviso, `risposte: ${replies.join(' | ')}`).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < idxAvviso; i += 1) {
    expect(replies[i]).not.toMatch(/minuti di pausa/i);
  }
  const status = await page.locator('#hours-save-status').textContent();
  expect(status || '').not.toMatch(/Ore salvate:/i);
}

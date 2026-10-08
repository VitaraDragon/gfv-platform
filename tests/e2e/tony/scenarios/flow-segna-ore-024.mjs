/**
 * Segna ore: «pausa 0» e poi «sì» salva senza richiedere di nuovo la pausa.
 * Fascia 18–19: fuori dal seed 07:30–12:00 e da T-FLOW-021 (13–17).
 * @module tests/e2e/tony/scenarios/flow-segna-ore-024
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

const DEFAULT_MESSAGES = ['segniamo le ore', '18', '19', 'pausa 0', 'sì'];
const NOTE = 'GFV_TONY_E2E_PAUSA0';

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowSegnaOre024(page, expect, scenario) {
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

  const preSave = messages.slice(0, -1);
  const confirmMsg = messages[messages.length - 1];
  const replies = [];

  const result = await tonyRunMultiTurn(page, preSave, {
    afterTurn: async (_page, _msg, ctx) => {
      replies.push(ctx.lastReply || '');
    },
  });

  const confirmTurn = await tonyRunMultiTurn(page, [confirmMsg], {
    beforeTurn: async (p) => {
      await p.locator('#ora-note').fill(NOTE);
    },
    afterTurn: async (_page, _msg, ctx) => {
      replies.push(ctx.lastReply || '');
    },
  });

  assertZeroCfAcrossTurns(expect, [...result.perfTurns, ...confirmTurn.perfTurns], {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  const tutti = replies.join('\n');
  expect(tutti).not.toMatch(/Prima di salvare indica i minuti di pausa/i);
  await page.locator('#hours-save-status').filter({ hasText: /Ore salvate:/i }).waitFor({
    timeout: 45_000,
  });
}

/**
 * M-T4 — canary 3b-C16: movimento entrata client-side → save → riga in lista.
 * @module tests/e2e/tony/scenarios/flow-movimento-016
 */

import { assertScenarioExpect } from '../helpers/assert-scenario-expect.mjs';
import { assertZeroCfAcrossTurns, tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
import {
  assertMovimentoEntrataInLista,
  TONY_E2E_MOVIMENTO_NOTE,
} from '../helpers/tony-post-save.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
  waitForCurrentTableData,
} from '../helpers/tony-sim-context.js';
import { waitForTonyReady } from '../helpers/tony-widget.js';

/** Prodotto fitofarmaco seed sim — substring «rame» matcha «Rame ossicloruro». */
const DEFAULT_CREATE_MSG = 'crea entrata rame 10 unità';
const DEFAULT_SAVE_MSG = 'salva';

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowMovimento016(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsManagerFromDevPage';
  const messages = Array.isArray(scenario.messages) && scenario.messages.length
    ? scenario.messages
    : [DEFAULT_CREATE_MSG, DEFAULT_SAVE_MSG];

  await runTonySimLogin(page, loginName);
  await captureTonyTenantSnapshot(page);

  await gotoTonyE2ePage(
    page,
    scenario.startUrl ||
      '/modules/magazzino/views/movimenti-standalone.html?emulator=1&tonyE2e=1'
  );

  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });

  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);
  await waitForCurrentTableData(page, 'movimenti');

  const result = await tonyRunMultiTurn(page, messages, {
    beforeTurn: async (p, msg) => {
      const low = String(msg || '').trim().toLowerCase();
      if (low === 'salva' || low === 'ok' || low === 'ok salva') {
        const noteField = p.locator('#mov-note');
        if (await noteField.isVisible().catch(() => false)) {
          await noteField.fill(TONY_E2E_MOVIMENTO_NOTE);
        }
      }
    },
  });

  assertZeroCfAcrossTurns(expect, result.perfTurns, {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  await assertScenarioExpect(page, expect, scenario, {
    lastReply: result.lastReply,
    lastPerf: result.lastPerf,
    lastCommands: result.lastCommands,
  });

  await assertMovimentoEntrataInLista(page, expect, {
    note: TONY_E2E_MOVIMENTO_NOTE,
    quantita: '10',
  });
}

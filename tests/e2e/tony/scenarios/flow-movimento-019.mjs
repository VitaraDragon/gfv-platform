/**
 * M-T4 — canary 3b-C19: cross-page movimento entrata → save → lista.
 * @module tests/e2e/tony/scenarios/flow-movimento-019
 */

import { assertScenarioExpect } from '../helpers/assert-scenario-expect.mjs';
import { assertZeroCfAcrossTurns, tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
import { bootstrapCrossPageMovimento } from '../helpers/tony-magazzino-cross-page.js';
import { confirmMovimentoSave } from '../helpers/tony-magazzino-save.js';
import {
  assertMovimentoEntrataInLista,
  TONY_E2E_MOVIMENTO_NOTE_CROSS,
} from '../helpers/tony-post-save.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import {
  tonyGetExecutedCommands,
  tonyGetLastPerfMetrics,
  waitForTonyReady,
} from '../helpers/tony-widget.js';

const DEFAULT_CROSS_MSG = 'crea entrata rame 10 unità';

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowMovimento019(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsManagerFromDevPage';
  const crossPageMsg =
    (Array.isArray(scenario.messages) && scenario.messages[0]) || DEFAULT_CROSS_MSG;

  await runTonySimLogin(page, loginName);
  await captureTonyTenantSnapshot(page);

  await gotoTonyE2ePage(
    page,
    scenario.startUrl || '/core/dashboard-standalone.html?emulator=1&tonyE2e=1'
  );

  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });

  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);

  const perfTurns = [];

  try {
    await bootstrapCrossPageMovimento(page, crossPageMsg);
  } catch (err) {
    throw new Error(`cross-page movimento: ${err.message}`);
  }

  const formReady = await page.evaluate(() => {
    const tipo = document.getElementById('mov-tipo')?.value;
    const qty = document.getElementById('mov-quantita')?.value;
    return !!(tipo && qty);
  });

  if (!formReady) {
    const retry = await tonyRunMultiTurn(page, [crossPageMsg], { turnDelayMs: 500 });
    perfTurns.push(...(retry.perfTurns || []));
  }

  const confirmTurn = await confirmMovimentoSave(page, { note: TONY_E2E_MOVIMENTO_NOTE_CROSS });
  perfTurns.push(...(confirmTurn.perfTurns || []));

  assertZeroCfAcrossTurns(expect, perfTurns, {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  await assertScenarioExpect(page, expect, scenario, {
    lastReply: confirmTurn.lastReply,
    lastPerf: confirmTurn.lastPerf || (await tonyGetLastPerfMetrics(page)),
    lastCommands: await tonyGetExecutedCommands(page),
  });

  await assertMovimentoEntrataInLista(page, expect, {
    note: TONY_E2E_MOVIMENTO_NOTE_CROSS,
    quantita: '10',
  });
}

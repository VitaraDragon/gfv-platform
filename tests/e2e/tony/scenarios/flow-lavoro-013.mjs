/**
 * M-T4 — canary 3b-C13: cross-page lavoro, terreni ambigui + operaio → save → lista.
 * @module tests/e2e/tony/scenarios/flow-lavoro-013
 */

import { assertScenarioExpect } from '../helpers/assert-scenario-expect.mjs';
import { loadLavoroFlowPlan } from '../helpers/tony-lavoro-flow-discover.js';
import { bootstrapCrossPageLavoro } from '../helpers/tony-lavoro-cross-page.js';
import { confirmLavoroSave } from '../helpers/tony-lavoro-save.js';
import { assertZeroCfAcrossTurns, tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
import {
  assertLavoroInLista,
  TONY_E2E_LAVORO_NOME,
  TONY_E2E_LAVORO_NOTE,
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

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowLavoro013(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsManagerManodopera';

  await runTonySimLogin(page, loginName);
  await captureTonyTenantSnapshot(page);

  const { messages, ctx } = await loadLavoroFlowPlan(page);
  const [crossPageMsg, ...restMessages] = messages;
  const preSaveFollowUps = restMessages.slice(0, -1);

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
    await bootstrapCrossPageLavoro(page, crossPageMsg);
  } catch (err) {
    throw new Error(`cross-page bootstrap: ${err.message}`);
  }
  perfTurns.push(await tonyGetLastPerfMetrics(page));

  let followResult;
  try {
    followResult = preSaveFollowUps.length
      ? await tonyRunMultiTurn(page, preSaveFollowUps, { turnDelayMs: 500 })
      : { perfTurns: [], lastReply: '', lastPerf: perfTurns[0], lastCommands: [] };
  } catch (err) {
    throw new Error(`intervista follow-up: ${err.message}`);
  }

  perfTurns.push(...(followResult.perfTurns || []));

  assertZeroCfAcrossTurns(expect, perfTurns, {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  let confirmTurn;
  try {
    confirmTurn = await confirmLavoroSave(page, expect, { note: TONY_E2E_LAVORO_NOTE, ctx });
  } catch (err) {
    throw new Error(`conferma salva: ${err.message}`);
  }
  assertZeroCfAcrossTurns(expect, confirmTurn.perfTurns || [], {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  try {
    await page.waitForFunction(
      (marker) => {
        const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
        if (Array.from(toasts).some((t) => /Lavoro creato con successo/i.test(t.textContent || ''))) {
          return true;
        }
        return Array.from(document.querySelectorAll('#lavori-container .lavori-table tbody tr')).some(
          (tr) => (tr.textContent || '').includes(marker)
        );
      },
      TONY_E2E_LAVORO_NOME,
      { timeout: 90_000 }
    );
  } catch (err) {
    throw new Error(`post-save record: ${err.message}`);
  }

  const expectAfterSave = { ...(scenario.expect || {}) };
  if (Object.keys(expectAfterSave).length) {
    await assertScenarioExpect(page, expect, { ...scenario, expect: expectAfterSave }, {
      lastReply: confirmTurn.lastReply,
      lastPerf: confirmTurn.lastPerf,
      lastCommands: await tonyGetExecutedCommands(page),
    });
  }

  await assertLavoroInLista(page, expect, {
    nome: TONY_E2E_LAVORO_NOME,
    note: TONY_E2E_LAVORO_NOTE,
  });
}

/**
 * M-T5 — T-FLOW-014-LIVE: preventivo CF reale (crea + disamb terreno) → save locale → lista.
 * @module tests/e2e/tony/scenarios/flow-preventivo-014-live
 */

import { assertScenarioExpect } from '../helpers/assert-scenario-expect.mjs';
import { loadPreventivoFlowPlan } from '../helpers/tony-preventivo-flow-discover.js';
import { runPreventivoCfDialog } from '../helpers/tony-preventivo-live.js';
import { confirmPreventivoSave } from '../helpers/tony-preventivo-save.js';
import {
  assertCfTurnsMin,
  assertZeroCfAcrossTurns,
} from '../helpers/tony-multi-turn.js';
import {
  assertPreventivoInLista,
  TONY_E2E_PREVENTIVO_SUPERFICIE,
} from '../helpers/tony-post-save.js';
import {
  captureTonyScenarioPerf,
  pickTonyScenarioPerfFromTurns,
} from '../helpers/tony-e2e-scenario-perf.mjs';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import { tonyGetExecutedCommands, waitForTonyReady } from '../helpers/tony-widget.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowPreventivo014Live(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsManagerContoTerzi';

  await runTonySimLogin(page, loginName);
  await captureTonyTenantSnapshot(page);

  const { ctx, messages } = await loadPreventivoFlowPlan(page);

  await gotoTonyE2ePage(
    page,
    scenario.startUrl ||
      '/modules/conto-terzi/views/nuovo-preventivo-standalone.html?emulator=1&tonyE2e=1&tonyE2eLive=1'
  );

  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });

  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);

  const replyTimeoutMs = scenario.expect?.replyTimeoutMs ?? 90_000;

  let cfTurn;
  try {
    cfTurn = await runPreventivoCfDialog(page, messages, { replyTimeoutMs, ctx });
  } catch (err) {
    throw new Error(`dialogo CF preventivo: ${err.message}`);
  }

  if (scenario.expect?.minCfTurns) {
    assertCfTurnsMin(expect, cfTurn.perfTurns || [], {
      minCfTurns: scenario.expect.minCfTurns,
    });
  }

  await captureTonyScenarioPerf(page, pickTonyScenarioPerfFromTurns(cfTurn.perfTurns || []));

  let confirmTurn;
  try {
    confirmTurn = await confirmPreventivoSave(page, expect, { ctx });
  } catch (err) {
    throw new Error(`conferma salva: ${err.message}`);
  }

  assertZeroCfAcrossTurns(expect, confirmTurn.perfTurns || [], {
    cfCallsMax: scenario.expect?.saveCfCallsMax ?? 0,
  });

  const expectAfterSave = { ...(scenario.expect || {}) };
  delete expectAfterSave.minCfTurns;
  delete expectAfterSave.saveCfCallsMax;
  delete expectAfterSave.replyTimeoutMs;

  if (Object.keys(expectAfterSave).length) {
    await assertScenarioExpect(page, expect, { ...scenario, expect: expectAfterSave }, {
      lastReply: confirmTurn.lastReply,
      lastPerf: confirmTurn.lastPerf,
      lastCommands: await tonyGetExecutedCommands(page),
    });
  }

  await assertPreventivoInLista(page, expect, {
    clienteNome: ctx.clienteNome,
    tipoLavoro: ctx.tipoLavoro.nome,
    superficie: TONY_E2E_PREVENTIVO_SUPERFICIE,
  });
}

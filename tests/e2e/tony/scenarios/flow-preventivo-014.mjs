/**
 * M-T4 — canary 3b-C14: preventivo multi-step — disamb. terreno → save locale → lista.
 * @module tests/e2e/tony/scenarios/flow-preventivo-014
 */

import { assertScenarioExpect } from '../helpers/assert-scenario-expect.mjs';
import { loadPreventivoFlowPlan } from '../helpers/tony-preventivo-flow-discover.js';
import {
  confirmPreventivoSave,
  injectPreventivoInitial,
  resolvePreventivoTerrenoChoice,
  waitForPreventivoTerrenoDisamb,
} from '../helpers/tony-preventivo-save.js';
import { assertZeroCfAcrossTurns } from '../helpers/tony-multi-turn.js';
import {
  assertPreventivoInLista,
  TONY_E2E_PREVENTIVO_SUPERFICIE,
} from '../helpers/tony-post-save.js';
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
export async function runFlowPreventivo014(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsManagerContoTerzi';

  await runTonySimLogin(page, loginName);
  await captureTonyTenantSnapshot(page);

  const { ctx } = await loadPreventivoFlowPlan(page);

  await gotoTonyE2ePage(
    page,
    scenario.startUrl ||
      '/modules/conto-terzi/views/nuovo-preventivo-standalone.html?emulator=1&tonyE2e=1'
  );

  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });

  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);

  const perfTurns = [];

  try {
    await injectPreventivoInitial(page, ctx);
    await waitForPreventivoTerrenoDisamb(page);
    await resolvePreventivoTerrenoChoice(page, ctx);
  } catch (err) {
    throw new Error(`inject/disamb terreno: ${err.message}`);
  }

  let confirmTurn;
  try {
    confirmTurn = await confirmPreventivoSave(page, expect, { ctx });
  } catch (err) {
    throw new Error(`conferma salva: ${err.message}`);
  }

  perfTurns.push(...(confirmTurn.perfTurns || []));

  assertZeroCfAcrossTurns(expect, perfTurns, {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  const expectAfterSave = { ...(scenario.expect || {}) };
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

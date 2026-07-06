/**
 * M-T4 — canary 3b-C15: inject prodotto completo → save locale → riga lista.
 * @module tests/e2e/tony/scenarios/flow-prodotto-015
 */

import { assertScenarioExpect } from '../helpers/assert-scenario-expect.mjs';
import { assertZeroCfAcrossTurns } from '../helpers/tony-multi-turn.js';
import {
  confirmProdottoSave,
  injectProdottoFormComplete,
} from '../helpers/tony-magazzino-save.js';
import {
  assertProdottoInLista,
  TONY_E2E_PRODOTTO_NOME_015,
  TONY_E2E_PRODOTTO_NOTE,
} from '../helpers/tony-post-save.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
  waitForCurrentTableData,
} from '../helpers/tony-sim-context.js';
import { tonyGetExecutedCommands, tonyGetLastPerfMetrics, waitForTonyReady } from '../helpers/tony-widget.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowProdotto015(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsManagerFromDevPage';

  await runTonySimLogin(page, loginName);
  await captureTonyTenantSnapshot(page);

  await gotoTonyE2ePage(
    page,
    scenario.startUrl ||
      '/modules/magazzino/views/prodotti-standalone.html?emulator=1&tonyE2e=1'
  );

  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });

  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);
  await waitForCurrentTableData(page, 'prodotti');

  await injectProdottoFormComplete(page, {
    'prodotto-nome': TONY_E2E_PRODOTTO_NOME_015,
    'prodotto-categoria': 'fitofarmaci',
    'prodotto-unita': 'L',
    'prodotto-scorta-minima': '50',
    'prodotto-prezzo': '45',
    'prodotto-dosaggio-min': '0.5',
    'prodotto-dosaggio-max': '1',
    'prodotto-giorni-carenza': '30',
    'prodotto-note': TONY_E2E_PRODOTTO_NOTE,
  });

  const confirmTurn = await confirmProdottoSave(page, {
    nome: TONY_E2E_PRODOTTO_NOME_015,
    note: TONY_E2E_PRODOTTO_NOTE,
  });

  assertZeroCfAcrossTurns(expect, confirmTurn.perfTurns || [], {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  await assertScenarioExpect(page, expect, scenario, {
    lastReply: confirmTurn.lastReply,
    lastPerf: confirmTurn.lastPerf,
    lastCommands: await tonyGetExecutedCommands(page),
  });

  await assertProdottoInLista(page, expect, { nome: TONY_E2E_PRODOTTO_NOME_015 });
}

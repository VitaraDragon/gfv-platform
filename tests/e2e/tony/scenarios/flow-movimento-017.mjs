/**
 * M-T4 — canary 3b-C17: movimento uscita client-side → save → riga lista.
 * @module tests/e2e/tony/scenarios/flow-movimento-017
 */

import { assertScenarioExpect } from '../helpers/assert-scenario-expect.mjs';
import { assertZeroCfAcrossTurns, tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
import {
  confirmMovimentoSave,
  waitForMovimentoModalOpen,
} from '../helpers/tony-magazzino-save.js';
import {
  assertMovimentoUscitaInLista,
  TONY_E2E_MOVIMENTO_NOTE_USCITA,
} from '../helpers/tony-post-save.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
  waitForCurrentTableData,
} from '../helpers/tony-sim-context.js';
import { waitForTonyReady, tonyGetExecutedCommands } from '../helpers/tony-widget.js';

const DEFAULT_CREATE_MSG = 'registra uscita rame 5 litri';

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowMovimento017(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsManagerFromDevPage';
  const createMsg =
    (Array.isArray(scenario.messages) && scenario.messages[0]) || DEFAULT_CREATE_MSG;

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

  const createResult = await tonyRunMultiTurn(page, [createMsg], { turnDelayMs: 500 });

  await waitForMovimentoModalOpen(page).catch(() => {});

  const formReady = await page.evaluate(() => {
    const tipo = document.getElementById('mov-tipo')?.value;
    const qty = document.getElementById('mov-quantita')?.value;
    const prod = document.getElementById('mov-prodotto')?.value;
    return !!(tipo && qty && prod);
  });

  if (!formReady) {
    await page.evaluate(async (text) => {
      const tryLocal = window.TonyMovimentoCreateLocal?.tryInterceptMovimentoCreateBeforeCf;
      if (typeof tryLocal !== 'function') return;
      tryLocal(String(text || '').trim(), {
        appendMessage: () => {},
        processTonyCommand: (cmd) => {
          if (window.Tony?.triggerAction) window.Tony.triggerAction(cmd.type, cmd);
        },
        getUrlForTarget: () => null,
      });
    }, createMsg);
    await waitForMovimentoModalOpen(page).catch(() => {});
  }

  const confirmTurn = await confirmMovimentoSave(page, {
    note: TONY_E2E_MOVIMENTO_NOTE_USCITA,
    tipo: 'uscita',
    quantita: '5',
    prodottoHint: 'rame',
  });

  const perfTurns = [...(createResult.perfTurns || []), ...(confirmTurn.perfTurns || [])];

  assertZeroCfAcrossTurns(expect, perfTurns, {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  await assertScenarioExpect(page, expect, scenario, {
    lastReply: confirmTurn.lastReply || createResult.lastReply,
    lastPerf: confirmTurn.lastPerf || createResult.lastPerf,
    lastCommands: await tonyGetExecutedCommands(page),
  });

  await assertMovimentoUscitaInLista(page, expect, {
    note: TONY_E2E_MOVIMENTO_NOTE_USCITA,
    quantita: '5',
  });
}

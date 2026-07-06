/**
 * M-T4 — canary 3b-C18: creazione prodotto client-side → save → lista.
 * @module tests/e2e/tony/scenarios/flow-prodotto-018
 */

import { assertScenarioExpect } from '../helpers/assert-scenario-expect.mjs';
import { assertZeroCfAcrossTurns, tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
import { waitForProdottoModalOpen } from '../helpers/tony-magazzino-save.js';
import {
  assertProdottoInLista,
  TONY_E2E_PRODOTTO_NOME_018,
  TONY_E2E_PRODOTTO_NOTE,
} from '../helpers/tony-post-save.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
  waitForCurrentTableData,
} from '../helpers/tony-sim-context.js';
import { waitForTonyReady } from '../helpers/tony-widget.js';

const DEFAULT_CREATE_MSG =
  'crea prodotto GFV SIM TONY E2E P018 fitofarmaci litri scorta 50 prezzo 45 dosaggio 0.5-1 carenza 30';

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowProdotto018(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsManagerFromDevPage';
  const messages = Array.isArray(scenario.messages) && scenario.messages.length
    ? scenario.messages
    : [DEFAULT_CREATE_MSG, 'salva'];

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

  const result = await tonyRunMultiTurn(page, messages, {
    beforeTurn: async (p, msg) => {
      const low = String(msg || '').trim().toLowerCase();
      if (low === 'salva' || low === 'ok' || low === 'ok salva') {
        await waitForProdottoModalOpen(p).catch(() => {});
        const noteField = p.locator('#prodotto-note');
        if (await noteField.isVisible().catch(() => false)) {
          await noteField.fill(TONY_E2E_PRODOTTO_NOTE);
        }
        const nomeField = p.locator('#prodotto-nome');
        if (await nomeField.isVisible().catch(() => false)) {
          const val = await nomeField.inputValue().catch(() => '');
          if (!val || val.length < 3) {
            await nomeField.fill(TONY_E2E_PRODOTTO_NOME_018);
          }
        }
      }
    },
    turnDelayMs: 500,
  });

  assertZeroCfAcrossTurns(expect, result.perfTurns, {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  await assertScenarioExpect(page, expect, scenario, {
    lastReply: result.lastReply,
    lastPerf: result.lastPerf,
    lastCommands: result.lastCommands,
  });

  await assertProdottoInLista(page, expect, { nome: TONY_E2E_PRODOTTO_NOME_018 });
}

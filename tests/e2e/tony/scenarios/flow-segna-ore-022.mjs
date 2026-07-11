/**
 * M-T4 — canary 3b-C22: segna ore desktop segnatura-ore one-shot → save → validazione manager.
 * @module tests/e2e/tony/scenarios/flow-segna-ore-022
 */

import { assertScenarioExpect } from '../helpers/assert-scenario-expect.mjs';
import { assertZeroCfAcrossTurns, tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
import {
  assertOrePendingInValidazione,
  TONY_E2E_ORE_NOTE,
  TONY_E2E_ORA_END,
  TONY_E2E_ORA_START,
} from '../helpers/tony-post-save.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import { waitForTonyReady } from '../helpers/tony-widget.js';

const DESKTOP_NOTE = `${TONY_E2E_ORE_NOTE}_DESK`;
const DEFAULT_MESSAGES = [
  'dalle 8 alle 17 con 0 minuti di pausa',
  'ok',
];

/**
 * Attende lavori segnabili in currentTableData (pagina segnatura-ore).
 * @param {import('playwright-core').Page} page
 */
async function waitForSegnaturaLavoriReady(page) {
  await page.waitForFunction(() => {
    const ctd = window.currentTableData;
    return ctd && Array.isArray(ctd.lavoriItems) && ctd.lavoriItems.length > 0;
  }, { timeout: 60_000 });
}

/**
 * Se il modal è aperto ma manca lavoro, seleziona il primo disponibile.
 * @param {import('playwright-core').Page} page
 */
async function ensureOraLavoroSelectedInModal(page) {
  const modal = page.locator('#ora-modal.active');
  if ((await modal.count()) === 0) return;
  const sel = page.locator('#ora-lavoro');
  const current = await sel.inputValue().catch(() => '');
  if (current && String(current).trim()) return;
  const firstValue = await sel.locator('option:not([value=""])').first().getAttribute('value');
  if (firstValue) await sel.selectOption(firstValue);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowSegnaOre022(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsCapoFromDevPage';
  const messages = Array.isArray(scenario.messages) && scenario.messages.length
    ? scenario.messages
    : DEFAULT_MESSAGES;

  await runTonySimLogin(page, loginName, { waitForWorkspace: false });
  await captureTonyTenantSnapshot(page);

  await gotoTonyE2ePage(
    page,
    scenario.startUrl || '/core/segnatura-ore-standalone.html?emulator=1&tonyE2e=1'
  );

  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });

  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);
  await waitForSegnaturaLavoriReady(page);

  const preSave = messages.slice(0, -1);
  const confirmMsg = messages[messages.length - 1];

  const result = preSave.length
    ? await tonyRunMultiTurn(page, preSave)
    : { perfTurns: [], lastReply: '', lastPerf: null, lastCommands: [] };

  if (preSave.length) {
    assertZeroCfAcrossTurns(expect, result.perfTurns, {
      cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
    });
  }

  await page.locator('#ora-modal.active').waitFor({ state: 'visible', timeout: 45_000 });
  await ensureOraLavoroSelectedInModal(page);

  if (Array.isArray(scenario.expect?.injectedFields) && scenario.expect.injectedFields.length) {
    await assertScenarioExpect(page, expect, {
      ...scenario,
      expect: { injectedFields: scenario.expect.injectedFields },
    }, {
      lastPerf: result.lastPerf,
      lastCommands: result.lastCommands,
    });
  }

  const confirmTurn = await tonyRunMultiTurn(page, [confirmMsg], {
    beforeTurn: async (p) => {
      await p.locator('#ora-modal.active').waitFor({ state: 'visible', timeout: 30_000 });
      await ensureOraLavoroSelectedInModal(p);
      await p.locator('#ora-note').fill(DESKTOP_NOTE);
    },
  });

  const perfTurns = [...(result.perfTurns || []), ...(confirmTurn.perfTurns || [])];
  assertZeroCfAcrossTurns(expect, perfTurns, {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  await page.waitForFunction(() => {
    const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert, #alert-container .alert-success');
    return Array.from(toasts).some((t) => /Ora segnata con successo/i.test(t.textContent || ''));
  }, { timeout: 45_000 });

  const expectAfterSave = { ...(scenario.expect || {}) };
  delete expectAfterSave.injectedFields;
  if (Object.keys(expectAfterSave).length) {
    await assertScenarioExpect(page, expect, { ...scenario, expect: expectAfterSave }, {
      lastReply: confirmTurn.lastReply,
      lastPerf: confirmTurn.lastPerf,
      lastCommands: confirmTurn.lastCommands,
    });
  }

  await assertOrePendingInValidazione(page, expect, {
    note: DESKTOP_NOTE,
    oraStart: TONY_E2E_ORA_START,
    oraEnd: TONY_E2E_ORA_END,
  });
}

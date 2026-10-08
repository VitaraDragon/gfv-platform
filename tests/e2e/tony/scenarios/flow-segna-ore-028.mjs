/**
 * Stesso elenco di T-FLOW-027, ma il modello finto risponde «Tutto pronto» senza il nome
 * e inietta il primo lavoro (Trinciatura). Il motore locale è saltato apposta,
 * per coprire il ritest in cui ha risposto il modello.
 * Fascia del testo utente 22:40–23:10, come 027: non si sovrappone al seed né a 025/026.
 * @module tests/e2e/tony/scenarios/flow-segna-ore-028
 */

import { tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
import { activateTonyMockCf, installTonyMockCf } from '../helpers/tony-mock-cf.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import { waitForTonyReady } from '../helpers/tony-widget.js';
import {
  leggiTenantIdSegnatura,
  pulisciLavoriRitest,
  seminaLavoriRitest,
} from '../helpers/segna-ore-lavori-e2e.mjs';

const START = '/core/segnatura-ore-standalone.html?emulator=1&tonyE2e=1';

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowSegnaOre028(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsCapoFromDevPage';
  let tenantId = '';
  try {
    await installTonyMockCf(page, { scenario });
    await runTonySimLogin(page, loginName, { waitForWorkspace: false });
    await captureTonyTenantSnapshot(page);
    await gotoTonyE2ePage(page, START);
    await page.evaluate(() => {
      window.tonyDashboardBriefingFired = true;
      window.tonyMeteoBriefingFired = true;
    });
    await bootstrapTonyWidgetOnStandalonePage(page);
    await waitForTonyReady(page);

    tenantId = await leggiTenantIdSegnatura(page);
    expect(tenantId).toBeTruthy();
    const seminati = await seminaLavoriRitest(tenantId);

    await gotoTonyE2ePage(page, START);
    await page.evaluate((firstId) => {
      window.tonyDashboardBriefingFired = true;
      window.tonyMeteoBriefingFired = true;
      window.__tonyE2eFirstLavoroId = firstId;
      window.__GFV_TONY_E2E_SKIP_SEGNA_ORE_LOCAL = true;
    }, seminati.trId);
    await bootstrapTonyWidgetOnStandalonePage(page);
    await waitForTonyReady(page);
    await activateTonyMockCf(page, scenario);

    await page.waitForFunction((id) => {
      const list = typeof window.gfvSegnaturaOreLavoriPerTony === 'function'
        ? window.gfvSegnaturaOreLavoriPerTony()
        : [];
      return Array.isArray(list) && list.some((l) => String(l.id) === id);
    }, seminati.oggiId, { timeout: 60_000 });

    const frase = 'segnami dalle 22:40 alle 23:10 oggi sul ripristino pali, nessuna pausa';
    const prima = await tonyRunMultiTurn(page, [frase]);
    const reply = prima.lastReply || '';
    expect(reply).not.toContain(seminati.nomeTr);
    expect(reply).not.toMatch(/Trinciatura/i);
    if (/Tutto pronto/i.test(reply)) {
      expect(reply).toContain(seminati.nomeOggi);
    }
    expect(reply).not.toBe('Tutto pronto: dalle 17:00 alle 17:30, pausa 0 min. Vuoi salvare?');

    const select = await page.evaluate(() => {
      const sel = document.getElementById('ora-lavoro');
      return sel ? String(sel.value || '') : '';
    });
    expect(select).not.toBe(seminati.trId);
  } finally {
    await pulisciLavoriRitest(tenantId).catch(() => {});
  }
}

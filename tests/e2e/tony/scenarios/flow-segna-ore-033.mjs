/**
 * Due messaggi prima che Tony sia pronto: restano in coda e partono in ordine.
 * @module tests/e2e/tony/scenarios/flow-segna-ore-033
 */

import { installTonyMockCf, activateTonyMockCf } from '../helpers/tony-mock-cf.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import { openTonyPanel } from '../helpers/tony-widget.js';

const START = '/core/segnatura-ore-standalone.html?emulator=1&tonyE2e=1';

async function inviaSenzaAttendere(page, text) {
  await page.evaluate((msg) => {
    const input = document.getElementById('tony-input');
    const send = document.getElementById('tony-send');
    if (input) {
      input.value = msg;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (send) send.click();
  }, text);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowSegnaOre033(page, expect, scenario) {
  await page.addInitScript(() => {
    window.__tonyRitardaPronto = true;
  });
  await installTonyMockCf(page, { scenario });
  await runTonySimLogin(page, scenario.login || 'loginAsCapoFromDevPage', { waitForWorkspace: false });
  await captureTonyTenantSnapshot(page);
  await gotoTonyE2ePage(page, START);
  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });
  await bootstrapTonyWidgetOnStandalonePage(page);
  await page.waitForFunction(() => {
    return window.Tony && typeof window.Tony.isReady === 'function' && window.Tony.isReady();
  }, null, { timeout: 90_000 });
  await activateTonyMockCf(page, scenario);
  await openTonyPanel(page);

  await inviaSenzaAttendere(page, 'ciao uno');
  await inviaSenzaAttendere(page, 'ciao due');

  const prima = await page.evaluate(() => {
    const box = document.getElementById('tony-messages');
    const testo = box ? box.textContent || '' : '';
    return {
      testo,
      coda: Array.isArray(window.__tonyInvioInAttesa) ? window.__tonyInvioInAttesa.map((v) => v.text) : [],
    };
  });
  expect(prima.testo).not.toMatch(/non è ancora pronto/i);
  expect(prima.testo).toMatch(/Sto preparando Tony/);
  expect(prima.coda).toEqual(['ciao uno', 'ciao due']);

  await page.evaluate(() => {
    window.__tonyRitardaPronto = false;
    window.dispatchEvent(new CustomEvent('tony-widget-ready'));
  });

  await page.waitForFunction(() => {
    const utenti = Array.from(document.querySelectorAll('#tony-messages .tony-msg.user'))
      .map((el) => (el.textContent || '').trim());
    const risposte = document.querySelectorAll('#tony-messages .tony-msg.tony').length;
    return utenti.join('|') === 'ciao uno|ciao due' && risposte >= 2;
  }, null, { timeout: 90_000 });

  const dopo = await page.evaluate(() => {
    const utenti = Array.from(document.querySelectorAll('#tony-messages .tony-msg.user'))
      .map((el) => (el.textContent || '').trim());
    const risposte = Array.from(document.querySelectorAll('#tony-messages .tony-msg.tony'))
      .map((el) => (el.textContent || '').trim());
    const input = document.getElementById('tony-input');
    return {
      utenti,
      risposte,
      campo: input ? input.value : null,
      errorePronto: /non è ancora pronto/i.test((document.getElementById('tony-messages') || {}).textContent || ''),
    };
  });
  expect(dopo.errorePronto).toBe(false);
  expect(dopo.utenti).toEqual(['ciao uno', 'ciao due']);
  expect(dopo.risposte.length).toBe(2);
  expect(dopo.campo).toBe('');
}

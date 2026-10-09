/**
 * Ingresso dopo il login, caricamento lavori con limite, chat senza conferme vecchie.
 * @module tests/e2e/tony/scenarios/flow-ingresso-035
 */

import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import { waitForTonyReady } from '../helpers/tony-widget.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowIngresso035(page, expect, scenario) {
  const log = [];
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.indexOf('[workspace] ingresso:') >= 0) log.push(t);
  });

  await runTonySimLogin(page, scenario.login || 'loginAsOperaioFromDevPage', { waitForWorkspace: true });
  const gia = log.length;
  await page.goto('/core/dashboard-standalone.html?emulator=1');
  await page.waitForURL(/field-workspace-standalone\.html/, { timeout: 60_000 });
  const decisioni = log.slice(gia).filter((t) => /ingresso: workspace/.test(t));
  expect(decisioni.length).toBe(1);
  expect(log.some((t) => /ingresso: dashboard/.test(t) && /motivo manager/.test(t))).toBe(false);

  await page.addInitScript(() => {
    window.__gfvTimeoutLavoriMs = 400;
    window.__gfvAttesaContestoLavoriMs = 500;
    window.__gfvLeggiLavoriCampo = function () {
      return new Promise(() => {});
    };
  });
  await page.goto('/core/mobile/field-workspace-standalone.html?emulator=1');
  await expect(page.locator('#selected-work')).toContainText('Non riesco a caricare i lavori', { timeout: 20_000 });
  await expect(page.locator('#btn-retry-lavori')).toBeVisible();

  await captureTonyTenantSnapshot(page);
  await gotoTonyE2ePage(page, '/core/segnatura-ore-standalone.html?emulator=1&tonyE2e=1');
  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);
  await page.evaluate(() => {
    const uid = sessionStorage.getItem('gfv_expected_user_id') || '';
    sessionStorage.setItem('tony_session_state', JSON.stringify({
      uid,
      timestamp: Date.now(),
      lastPath: window.location.pathname,
      chatHistory: [
        { role: 'user', parts: [{ text: 'Ciao sono io' }] },
        { role: 'model', parts: [{ text: 'Tutto pronto: Manutenzione, oggi 09/10. Vuoi salvare? Scrivi «sì» o «salva».' }] },
        { role: 'user', parts: [{ text: 'sì' }] },
        { role: 'model', parts: [{ text: 'Questa richiesta è scaduta. Dimmi di nuovo giorno, orario e lavoro.' }] },
      ],
    }));
  });
  await page.reload();
  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);
  await page.waitForFunction(() => {
    const box = document.getElementById('tony-messages');
    return box && /Ciao sono io/.test(box.textContent || '');
  }, null, { timeout: 20_000 });
  const testo = await page.locator('#tony-messages').innerText();
  expect(testo).toContain('Ciao sono io');
  expect(testo).not.toMatch(/Tutto pronto/i);
  expect(testo).not.toMatch(/scaduta/i);
  const utenti = await page.locator('#tony-messages .tony-msg.user').allTextContents();
  expect(utenti.map((t) => t.trim()).filter(Boolean)).toEqual(['Ciao sono io']);
}

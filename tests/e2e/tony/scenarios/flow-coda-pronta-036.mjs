/**
 * T-FLOW-036 — due messaggi prima che Tony sia pronto restano in attesa e partono in ordine.
 * Il ritardo vale solo qui: isReady resta falso finché lo scenario non lo rilascia.
 * @module tests/e2e/tony/scenarios/flow-coda-pronta-036
 */

import { activateTonyMockCf, installTonyMockCf } from '../helpers/tony-mock-cf.js';
import {
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import { openTonyPanel } from '../helpers/tony-widget.js';

const START = '/core/dashboard-standalone.html';

async function tieniTonyNonPronto(page) {
  await page.addInitScript(() => {
    window.__GFV_TONY_E2E_HOLD_READY = true;
    let value = window.Tony;
    function avvolgi(v) {
      if (!v || typeof v.isReady !== 'function' || v.__gfvHoldReadyWrapped) return v;
      const orig = v.isReady.bind(v);
      v.isReady = function () {
        let real = false;
        try { real = !!orig(); } catch (e) { real = false; }
        v.__gfvRealReady = real;
        if (window.__GFV_TONY_E2E_HOLD_READY) return false;
        return real;
      };
      v.__gfvHoldReadyWrapped = true;
      return v;
    }
    try {
      Object.defineProperty(window, 'Tony', {
        configurable: true,
        enumerable: true,
        get() { return value; },
        set(v) { value = avvolgi(v); },
      });
    } catch (e) { /* la pagina parte senza Tony */ }
  });
}

async function inviaPrimaDelPronto(page, text) {
  await page.evaluate((msg) => {
    const input = document.getElementById('tony-input');
    const send = document.getElementById('tony-send');
    if (input) {
      input.value = msg;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (send) send.click();
  }, text);
  await page.waitForFunction((expected) => {
    const nodes = document.querySelectorAll('#tony-messages .tony-msg.user');
    return Array.from(nodes).some((n) => (n.textContent || '').trim() === expected);
  }, text, { timeout: 10_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowCodaPronta036(page, expect, scenario) {
  await tieniTonyNonPronto(page);
  if (scenario.mockCf) await installTonyMockCf(page, { scenario });
  await runTonySimLogin(page, scenario.login || 'loginAsManagerFromDevPage');
  await gotoTonyE2ePage(page, START);
  await page.waitForFunction(() => {
    const input = document.getElementById('tony-input');
    return !!(window.Tony && window.Tony.__gfvRealReady === true && input);
  }, null, { timeout: 90_000 });
  if (scenario.mockCf) await activateTonyMockCf(page, scenario);
  await openTonyPanel(page);

  await inviaPrimaDelPronto(page, 'messaggio coda alfa');
  await inviaPrimaDelPronto(page, 'messaggio coda beta');

  const prima = await page.evaluate(() => {
    const stato = document.getElementById('tony-stato-preparazione');
    const chat = (document.getElementById('tony-messages') || {}).textContent || '';
    const input = document.getElementById('tony-input');
    return {
      stato: stato ? stato.textContent : '',
      chat,
      input: input ? input.value : null,
      pronto: !!(window.Tony && window.Tony.isReady && window.Tony.isReady()),
    };
  });
  expect(prima.pronto).toBe(false);
  expect(prima.stato).toContain('In attesa che Tony sia pronto');
  expect(prima.chat).not.toContain('non è ancora pronto');
  expect(prima.input).toBe('');

  await page.evaluate(() => {
    window.__GFV_TONY_E2E_HOLD_READY = false;
    window.dispatchEvent(new CustomEvent('tony-widget-ready'));
  });

  await page.waitForFunction(() => {
    const testi = Array.from(document.querySelectorAll('#tony-messages .tony-msg.tony')).map((n) => n.textContent || '');
    return testi.some((t) => t.indexOf('Ho letto il primo') >= 0)
      && testi.some((t) => t.indexOf('Ho letto il secondo') >= 0);
  }, null, { timeout: 20_000 });

  const dopo = await page.evaluate(() => {
    const tony = Array.from(document.querySelectorAll('#tony-messages .tony-msg.tony')).map((n) => n.textContent || '');
    const utenti = Array.from(document.querySelectorAll('#tony-messages .tony-msg.user')).map((n) => (n.textContent || '').trim());
    const chat = (document.getElementById('tony-messages') || {}).textContent || '';
    return { tony, utenti, chat };
  });
  const iPrimo = dopo.tony.findIndex((t) => t.indexOf('Ho letto il primo') >= 0);
  const iSecondo = dopo.tony.findIndex((t) => t.indexOf('Ho letto il secondo') >= 0);
  const ordineTony = dopo.tony.join(' | ');
  const ordineUtenti = dopo.utenti.join(' | ');
  expect(iPrimo, ordineTony).toBeGreaterThanOrEqual(0);
  expect(iSecondo, ordineTony).toBeGreaterThan(iPrimo);
  expect(dopo.utenti.indexOf('messaggio coda alfa'), ordineUtenti).toBeGreaterThanOrEqual(0);
  expect(dopo.utenti.indexOf('messaggio coda beta'), ordineUtenti).toBeGreaterThan(dopo.utenti.indexOf('messaggio coda alfa'));
  expect(dopo.chat).not.toContain('ancora occupato');
  expect(dopo.chat).not.toContain('non è ancora pronto');
}

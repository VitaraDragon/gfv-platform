/**
 * Lavoro sospeso di oggi e la sua ripresa.
 * Il seed condiviso non ha questa coppia: i due lavori esistono solo qui e si cancellano alla fine.
 * Fascia 23:15–23:45: non tocca il seed (07:30–12:00), gli scenari 13–17 e 18–19,
 * T-FLOW-025 (22:00–22:30), T-FLOW-026 (22:10–22:40) né T-FLOW-027 (22:40–23:10).
 * @module tests/e2e/tony/scenarios/flow-segna-ore-029
 */

import { assertZeroCfAcrossTurns, tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
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
  pulisciLavoroSospeso029,
  seminaLavoroSospeso029,
} from '../helpers/segna-ore-lavori-e2e.mjs';

const START = '/core/segnatura-ore-standalone.html?emulator=1&tonyE2e=1';
const FRASE = 'segnami dalle 23:15 alle 23:45 oggi sul ripristino pali, nessuna pausa';
const TESTO_VIETATO = 'Tutto pronto: dalle 17:00 alle 17:30, pausa 0 min. Vuoi salvare? Scrivi «sì» o «salva».';

async function apriSegnatura(page) {
  await gotoTonyE2ePage(page, START);
  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });
  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);
}

function assertNienteTuttoProntoSenzaNome(expect, reply) {
  const testo = String(reply || '');
  expect(testo).not.toBe(TESTO_VIETATO);
  expect(testo).not.toMatch(/Tutto pronto/i);
  expect(testo).toMatch(/sospeso|Su quale lavoro/i);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowSegnaOre029(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsCapoFromDevPage';
  let tenantId = '';
  try {
    await runTonySimLogin(page, loginName, { waitForWorkspace: false });
    await captureTonyTenantSnapshot(page);
    await apriSegnatura(page);
    tenantId = await leggiTenantIdSegnatura(page);
    expect(tenantId).toBeTruthy();
    const seminati = await seminaLavoroSospeso029(tenantId);
    await apriSegnatura(page);

    await page.waitForFunction((id) => {
      const sospesi = typeof window.gfvSegnaturaOreLavoriSospesiPerTony === 'function'
        ? window.gfvSegnaturaOreLavoriSospesiPerTony()
        : [];
      return Array.isArray(sospesi) && sospesi.some((l) => String(l.id) === id);
    }, seminati.sospesoId, { timeout: 60_000 });

    const modalAperto = await page.locator('#ora-modal.active').count();
    expect(modalAperto).toBe(0);

    const prima = await tonyRunMultiTurn(page, [FRASE]);
    assertZeroCfAcrossTurns(expect, prima.perfTurns, { cfCallsMax: 0 });
    assertNienteTuttoProntoSenzaNome(expect, prima.lastReply);
    expect(prima.lastReply || '').toContain('Grazie');

    const form = await page.evaluate(() => {
      const modal = document.getElementById('ora-modal');
      const sel = document.getElementById('ora-lavoro');
      return {
        aperto: !!(modal && modal.classList.contains('active')),
        vuoto: !sel || !String(sel.value || '').trim(),
      };
    });
    expect(form.aperto === false || form.vuoto).toBe(true);

    const salvata = await page.evaluate(() => {
      const items = (window.currentTableData && window.currentTableData.items) || [];
      return items.some((ora) => String(ora.orarioInizio || '').indexOf('23:15') === 0);
    });
    expect(salvata).toBe(false);

    await installTonyMockCf(page, { scenario });
    await apriSegnatura(page);
    await page.evaluate(() => {
      window.__GFV_TONY_E2E_SKIP_SEGNA_ORE_LOCAL = true;
      window.__GFV_TONY_E2E_CAMPO_LIKE = true;
    });
    await activateTonyMockCf(page, scenario);
    const conCampo = await tonyRunMultiTurn(page, [FRASE]);
    assertNienteTuttoProntoSenzaNome(expect, conCampo.lastReply);

    await page.evaluate(() => {
      window.__GFV_TONY_E2E_SKIP_SEGNA_ORE_LOCAL = true;
      window.__GFV_TONY_E2E_CAMPO_LIKE = false;
    });
    const senzaCampo = await tonyRunMultiTurn(page, [FRASE]);
    assertNienteTuttoProntoSenzaNome(expect, senzaCampo.lastReply);
  } finally {
    await pulisciLavoroSospeso029(tenantId).catch(() => {});
  }
}

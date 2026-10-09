/**
 * La data di una richiesta non si trascina dal turno prima.
 * Fascia 05:00–05:30: non tocca il seed (07:30–12:00), gli scenari 13–17 e 18–19,
 * T-FLOW-025 (22:00–22:30), T-FLOW-026 (22:10–22:40), T-FLOW-027 (22:40–23:10)
 * né T-FLOW-029 (23:15–23:45).
 * Il seed è solo di questo scenario: un sospeso e una manutenzione attiva.
 * @module tests/e2e/tony/scenarios/flow-segna-ore-030
 */

import { tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import { waitForTonyReady } from '../helpers/tony-widget.js';
import { assertSeTuttoProntoHaNome } from '../helpers/segna-ore-assert.mjs';
import {
  leggiTenantIdSegnatura,
  pulisciLavoroData030,
  seminaLavoroData030,
} from '../helpers/segna-ore-lavori-e2e.mjs';

const START = '/core/segnatura-ore-standalone.html?emulator=1&tonyE2e=1';

async function apriSegnatura(page) {
  await gotoTonyE2ePage(page, START);
  await page.evaluate(() => {
    window.tonyDashboardBriefingFired = true;
    window.tonyMeteoBriefingFired = true;
  });
  await bootstrapTonyWidgetOnStandalonePage(page);
  await waitForTonyReady(page);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowSegnaOre030(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsCapoFromDevPage';
  let tenantId = '';
  try {
    await runTonySimLogin(page, loginName, { waitForWorkspace: false });
    await captureTonyTenantSnapshot(page);
    await apriSegnatura(page);
    tenantId = await leggiTenantIdSegnatura(page);
    expect(tenantId).toBeTruthy();
    const seminati = await seminaLavoroData030(tenantId);
    await apriSegnatura(page);

    await page.waitForFunction((id) => {
      const list = typeof window.gfvSegnaturaOreLavoriPerTony === 'function'
        ? window.gfvSegnaturaOreLavoriPerTony()
        : [];
      return Array.isArray(list) && list.some((l) => String(l.id) === id);
    }, seminati.attivoId, { timeout: 60_000 });

    const fraseA = 'segnami dalle 05:00 alle 05:30 ieri sul ripristino pali, nessuna pausa';
    const passoA = await tonyRunMultiTurn(page, [fraseA]);
    expect(passoA.lastReply || '').not.toMatch(/Tutto pronto/i);
    expect(passoA.lastReply || '').toMatch(/sospeso/i);

    const fraseB = 'segnami dalle 05:00 alle 05:30 oggi sulla manutenzione attrezzi, nessuna pausa';
    const passoB = await tonyRunMultiTurn(page, [fraseB]);
    assertSeTuttoProntoHaNome(expect, passoB.lastReply, 'Manutenzione attrezzi');
    expect(passoB.lastReply || '').toMatch(/Tutto pronto/i);
    const form = await page.evaluate(() => {
      const el = document.getElementById('ora-data');
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      const oggi = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const breve = `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
      return { valore: el ? String(el.value || '') : '', oggi, breve };
    });
    expect(form.valore).toBe(form.oggi);
    expect(passoB.lastReply || '').toContain(`oggi ${form.breve}`);

    await page.evaluate(() => {
      if (typeof window.closeOraModal === 'function') window.closeOraModal();
    });
    const dopoAnnulla = await tonyRunMultiTurn(page, ['sì']);
    expect(dopoAnnulla.lastReply || '').toMatch(/Non c'è niente da salvare/i);
    const salvata = await page.evaluate(() => {
      const items = (window.currentTableData && window.currentTableData.items) || [];
      return items.some((ora) => String(ora.orarioInizio || '').indexOf('05:00') === 0);
    });
    expect(salvata).toBe(false);
  } finally {
    await pulisciLavoroData030(tenantId).catch(() => {});
  }
}

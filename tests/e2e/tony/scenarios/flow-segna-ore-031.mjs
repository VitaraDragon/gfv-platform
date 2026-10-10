/**
 * La conferma di Tony arriva dal salvataggio, non da un timer di 2 secondi.
 * Fascia 06:00–06:30: non tocca il seed (07:30–12:00), gli scenari 13–17 e 18–19,
 * T-FLOW-030 (05:00–05:30), T-FLOW-025 (22:00–22:30), T-FLOW-026 (22:10–22:40),
 * T-FLOW-027 (22:40–23:10) né T-FLOW-029 (23:15–23:45).
 * Il seed è solo di questo scenario: una manutenzione attiva.
 * @module tests/e2e/tony/scenarios/flow-segna-ore-031
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
  pulisciLavoroConferma031,
  seminaLavoroConferma031,
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
export async function runFlowSegnaOre031(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsCapoFromDevPage';
  let tenantId = '';
  try {
    await runTonySimLogin(page, loginName, { waitForWorkspace: false });
    await captureTonyTenantSnapshot(page);
    await apriSegnatura(page);
    tenantId = await leggiTenantIdSegnatura(page);
    expect(tenantId).toBeTruthy();
    const seminati = await seminaLavoroConferma031(tenantId);
    await apriSegnatura(page);

    await page.waitForFunction((id) => {
      const list = typeof window.gfvSegnaturaOreLavoriPerTony === 'function'
        ? window.gfvSegnaturaOreLavoriPerTony()
        : [];
      return Array.isArray(list) && list.some((l) => String(l.id) === id);
    }, seminati.attivoId, { timeout: 60_000 });

    const frase = 'segnami dalle 06:00 alle 06:30 oggi sulla manutenzione attrezzi, nessuna pausa';
    const passo = await tonyRunMultiTurn(page, [frase]);
    assertSeTuttoProntoHaNome(expect, passo.lastReply, 'Manutenzione attrezzi');
    expect(passo.lastReply || '').toMatch(/Tutto pronto/i);
    const form = await page.evaluate(() => {
      const el = document.getElementById('ora-data');
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      return {
        valore: el ? String(el.value || '') : '',
        oggi: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
        breve: `${p(d.getDate())}/${p(d.getMonth() + 1)}`,
      };
    });
    expect(form.valore).toBe(form.oggi);
    expect(passo.lastReply || '').toContain(`oggi ${form.breve}`);

    await page.evaluate(() => {
      const orig = window.handleSalvaOra;
      window.handleSalvaOra = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        return new Promise((resolve) => {
          setTimeout(() => resolve(orig(ev)), 3000);
        });
      };
    });

    const conferma = await tonyRunMultiTurn(page, ['sì'], { replyTimeoutMs: 45_000 });
    const fatto = conferma.lastReply || '';
    expect(fatto).toMatch(/Fatto:/i);
    expect(fatto).toContain('Manutenzione attrezzi');
    expect(fatto).toContain(`oggi ${form.breve}`);
    expect(fatto).toMatch(/06:00/);
    expect(fatto).toMatch(/06:30/);
    expect(fatto).toMatch(/la valida il (caposquadra|manager)/i);
    expect(fatto).not.toMatch(/Non vedo la conferma/i);
    expect(fatto).not.toMatch(/Non riesco a controllare/i);

    const salvata = await page.evaluate(() => {
      const items = (window.currentTableData && window.currentTableData.items) || [];
      return items.some((ora) => (
        String(ora.orarioInizio || '').indexOf('06:00') === 0
        && String(ora.stato || '') === 'da_validare'
      ));
    });
    expect(salvata).toBe(true);

    const diNuovo = await tonyRunMultiTurn(page, [frase]);
    let testoErrore = diNuovo.lastReply || '';
    if (/Tutto pronto/i.test(testoErrore)) {
      const siErrore = await tonyRunMultiTurn(page, ['sì']);
      testoErrore = siErrore.lastReply || '';
    }
    expect(testoErrore).toMatch(/sovrappon|occupato/i);
    expect(testoErrore).not.toMatch(/Non vedo la conferma/i);
    expect(testoErrore).not.toMatch(/^Fatto:/i);
  } finally {
    await pulisciLavoroConferma031(tenantId).catch(() => {});
  }
}

/**
 * Caso reale «ripristino pali»: due omonimi, solo uno è di oggi; la Trinciatura è prima in lista.
 * Fascia 22:40–23:10: libera rispetto al seed (07:30–12:00), agli scenari 13–17 e 18–19,
 * a T-FLOW-025 (22:00–22:30) e a T-FLOW-026 (22:10–22:40).
 * I lavori sono creati solo per questo scenario e cancellati alla fine.
 * @module tests/e2e/tony/scenarios/flow-segna-ore-027
 */

import { assertZeroCfAcrossTurns, tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
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
export async function runFlowSegnaOre027(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsCapoFromDevPage';
  let tenantId = '';
  try {
    await runTonySimLogin(page, loginName, { waitForWorkspace: false });
    await captureTonyTenantSnapshot(page);
    await apriSegnatura(page);
    tenantId = await leggiTenantIdSegnatura(page);
    expect(tenantId).toBeTruthy();
    const seminati = await seminaLavoriRitest(tenantId);
    await apriSegnatura(page);

    await page.waitForFunction((id) => {
      const list = typeof window.gfvSegnaturaOreLavoriPerTony === 'function'
        ? window.gfvSegnaturaOreLavoriPerTony()
        : [];
      return Array.isArray(list) && list.some((l) => String(l.id) === id);
    }, seminati.oggiId, { timeout: 60_000 });

    const primo = await page.evaluate(() => {
      const list = window.gfvSegnaturaOreLavoriPerTony() || [];
      const l = list[0] || {};
      return { id: String(l.id || ''), nome: String(l.nome || '') };
    });
    expect(primo.id).toBe(seminati.trId);
    expect(primo.nome).toContain('Trinciatura');

    const modalAperto = await page.locator('#ora-modal.active').count();
    expect(modalAperto).toBe(0);

    const frase = 'segnami dalle 22:40 alle 23:10 oggi sul ripristino pali, nessuna pausa';
    const prima = await tonyRunMultiTurn(page, [frase]);
    assertZeroCfAcrossTurns(expect, prima.perfTurns, {
      cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
    });

    const reply = prima.lastReply || '';
    expect(reply).not.toContain(seminati.nomeTr);
    expect(reply).not.toMatch(/Trinciatura/i);
    const tuttoPronto = /Tutto pronto/i.test(reply);
    const chiede = /Su quale lavoro/i.test(reply);
    expect(tuttoPronto || chiede).toBe(true);
    if (tuttoPronto) expect(reply).toContain(seminati.nomeOggi);

    const select = await page.evaluate(() => {
      const modal = document.getElementById('ora-modal');
      const sel = document.getElementById('ora-lavoro');
      return {
        aperto: !!(modal && modal.classList.contains('active')),
        value: sel ? String(sel.value || '') : '',
      };
    });
    expect(select.value).not.toBe(seminati.trId);

    if (!tuttoPronto) return;

    const conferma = await tonyRunMultiTurn(page, ['sì']);
    expect(conferma.lastReply || '').toMatch(/Fatto:/i);
    expect(conferma.lastReply || '').toContain(seminati.nomeOggi);

    await page.waitForFunction((lavoroId) => {
      const items = (window.currentTableData && window.currentTableData.items) || [];
      return items.some((ora) => ora
        && String(ora.lavoroId || '') === lavoroId
        && String(ora.orarioInizio || '').indexOf('22:40') === 0);
    }, seminati.oggiId, { timeout: 45_000 });
  } finally {
    await pulisciLavoriRitest(tenantId).catch(() => {});
  }
}

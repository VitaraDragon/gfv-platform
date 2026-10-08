/**
 * Segna ore desktop, form chiuso: salva sul lavoro nominato, non sul primo della lista.
 * Fascia 22:00–22:30: libera rispetto al seed (07:30–12:00) e agli altri scenari Tony (13–17, 18–19).
 * @module tests/e2e/tony/scenarios/flow-segna-ore-025
 */

import { assertZeroCfAcrossTurns, tonyRunMultiTurn } from '../helpers/tony-multi-turn.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import { waitForTonyReady } from '../helpers/tony-widget.js';

/**
 * @param {import('playwright-core').Page} page
 */
async function leggiLavoriSegnatura(page) {
  return page.evaluate(() => {
    const list = typeof window.gfvSegnaturaOreLavoriPerTony === 'function'
      ? window.gfvSegnaturaOreLavoriPerTony()
      : [];
    return (list || []).map((l) => ({ id: String(l.id || ''), nome: String(l.nome || '') }));
  });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowSegnaOre025(page, expect, scenario) {
  const loginName = scenario.login || 'loginAsCapoFromDevPage';

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

  await page.waitForFunction(() => {
    const list = typeof window.gfvSegnaturaOreLavoriPerTony === 'function'
      ? window.gfvSegnaturaOreLavoriPerTony()
      : [];
    return Array.isArray(list) && list.length >= 2;
  }, { timeout: 60_000 });

  const modalAperto = await page.locator('#ora-modal.active').count();
  expect(modalAperto).toBe(0);

  const lavori = await leggiLavoriSegnatura(page);
  const secondo = lavori[1];
  expect(secondo && secondo.id).toBeTruthy();
  expect(secondo.nome).toBeTruthy();

  const frase = `segnami dalle 22:00 alle 22:30 oggi sul ${secondo.nome}, nessuna pausa`;
  const replies = [];
  const prima = await tonyRunMultiTurn(page, [frase], {
    afterTurn: async (_p, _msg, ctx) => {
      replies.push(ctx.lastReply || '');
    },
  });
  expect(prima.lastReply || '').toMatch(/Tutto pronto/i);
  expect(prima.lastReply || '').toContain(secondo.nome);

  if (lavori[0] && lavori[0].id && lavori[0].id !== secondo.id) {
    const select = await page.evaluate(() => {
      const modal = document.getElementById('ora-modal');
      if (!modal || !modal.classList.contains('active')) return null;
      const sel = document.getElementById('ora-lavoro');
      if (!sel) return null;
      const first = Array.from(sel.options || []).find((o) => o.value);
      return { value: String(sel.value || ''), first: first ? String(first.value) : '' };
    });
    if (select) {
      expect(select.value).toBe(secondo.id);
      expect(select.value).not.toBe(select.first);
    }
  }

  const conferma = await tonyRunMultiTurn(page, ['sì'], {
    afterTurn: async (_p, _msg, ctx) => {
      replies.push(ctx.lastReply || '');
    },
  });
  assertZeroCfAcrossTurns(expect, [...prima.perfTurns, ...conferma.perfTurns], {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  expect(conferma.lastReply || '').toMatch(/Fatto:/i);
  expect(conferma.lastReply || '').toContain(secondo.nome);

  await page.waitForFunction((lavoroId) => {
    const items = (window.currentTableData && window.currentTableData.items) || [];
    return items.some((ora) => ora
      && String(ora.lavoroId || '') === lavoroId
      && String(ora.orarioInizio || '').indexOf('22:00') === 0);
  }, secondo.id, { timeout: 45_000 });
}

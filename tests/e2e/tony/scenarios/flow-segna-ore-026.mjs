/**
 * Segna ore desktop: un nome che corrisponde a due lavori non salva.
 * Fascia 22:10–22:40, diversa da T-FLOW-025 (22:00–22:30), così i due scenari non si pestano i piedi.
 * Il seed dei lavori squadra condivide la parola «squadra»: se c'è, si usa quella.
 * Se il seed non ha due lavori con una parola in comune, il test lo dice e non salva comunque.
 * @module tests/e2e/tony/scenarios/flow-segna-ore-026
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
 * Parola presente in almeno due nomi. «squadra» è la prima scelta, è nel seed dei lavori squadra.
 * @param {{ nome: string }[]} lavori
 * @returns {string}
 */
function parolaCondivisa(lavori) {
  const conti = new Map();
  for (const lavoro of lavori) {
    const visti = new Set(
      String(lavoro.nome || '')
        .toLowerCase()
        .split(/[^a-zàèéìòù0-9]+/i)
        .filter((t) => t && t.length >= 4)
    );
    for (const tok of visti) conti.set(tok, (conti.get(tok) || 0) + 1);
  }
  if ((conti.get('squadra') || 0) >= 2) return 'squadra';
  for (const [tok, n] of conti) {
    if (n >= 2) return tok;
  }
  return '';
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowSegnaOre026(page, expect, scenario) {
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
    return Array.isArray(list) && list.length >= 1;
  }, { timeout: 60_000 });

  const lavori = await page.evaluate(() => {
    const list = window.gfvSegnaturaOreLavoriPerTony();
    return list.map((l) => ({ id: String(l.id || ''), nome: String(l.nome || '') }));
  });
  const parola = parolaCondivisa(lavori);
  // Il seed squadra ha più lavori con «squadra» nel nome. Se manca, non inventiamo un seed.
  const frase = parola
    ? `segnami dalle 22:10 alle 22:40 oggi sul ${parola}, nessuna pausa`
    : 'segnami dalle 22:10 alle 22:40 oggi sul lavoro inesistente xyz, nessuna pausa';

  const result = await tonyRunMultiTurn(page, [frase]);
  assertZeroCfAcrossTurns(expect, result.perfTurns, {
    cfCallsMax: scenario.expect?.cfCallsMax ?? 0,
  });

  if (parola) {
    expect(result.lastReply || '').toMatch(/Su quale lavoro/i);
  } else {
    expect(result.lastReply || '').toMatch(/Non trovo un lavoro|Su quale lavoro/i);
  }
  expect(result.lastReply || '').not.toMatch(/Tutto pronto/i);

  const modal = await page.evaluate(() => {
    const el = document.getElementById('ora-modal');
    const aperto = !!(el && el.classList.contains('active'));
    const sel = document.getElementById('ora-lavoro');
    const vuoto = !sel || !String(sel.value || '').trim();
    return { aperto, vuoto };
  });
  expect(modal.aperto === false || modal.vuoto).toBe(true);

  const salvata = await page.evaluate(() => {
    const items = (window.currentTableData && window.currentTableData.items) || [];
    return items.some((ora) => String(ora.orarioInizio || '').indexOf('22:10') === 0);
  });
  expect(salvata).toBe(false);
}

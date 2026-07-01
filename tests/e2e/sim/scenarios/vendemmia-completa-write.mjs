/**
 * E2E catena A — completa vendemmia stub da lavoro (§11.3.12 scen. 52).
 * Template manodopera: fase 07 crea lavoro Vendemmia + vendemmia incompleta con lavoroId.
 * @module tests/e2e/sim/scenarios/vendemmia-completa-write
 */

import { gotoVendemmia, loginAsManagerManodopera } from '../helpers/sim-login.js';

export const E2E_VENDEMMIA_COMPLETA_QLI = '77.7';
export const E2E_VENDEMMIA_COMPLETA_NOTE = 'GFV_SIM_E2E_COMPLETA_VENDEMMIA';

/**
 * Righe vendemmia incomplete collegate a un lavoro (stub catena A).
 * @param {import('playwright-core').Page} page
 */
function incompleteVendemmiaFromLavoroRows(page) {
  return page.locator('#vendemmie-table tbody tr').filter({
    has: page.locator('.badge-incompleta'),
    hasText: /Vedi Lavoro/i,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
function completedMarkerRows(page) {
  return page.locator('#vendemmie-table tbody tr').filter({
    hasText: E2E_VENDEMMIA_COMPLETA_QLI,
    has: page.locator('.badge-completa'),
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function completeFirstStubVendemmiaFromLavoro(page) {
  const row = incompleteVendemmiaFromLavoroRows(page).first();
  await row.locator('button').filter({ hasText: /Modifica/i }).click();

  await page.locator('#vendemmia-modal.active').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(
    () => document.getElementById('lavoro-id-hidden')?.value?.length > 0,
    undefined,
    { timeout: 30_000 }
  );

  await page.locator('#quantitaQli').fill(E2E_VENDEMMIA_COMPLETA_QLI);
  const ettari = page.locator('#quantitaEttari');
  if (!(await ettari.inputValue())) {
    await ettari.fill('1.2');
  }
  await page.locator('#destinazione').selectOption('vino');
  await page.locator('#note').fill(E2E_VENDEMMIA_COMPLETA_NOTE);

  await page.locator('#vendemmia-form button[type="submit"]').click();

  await page.waitForFunction(
    (qli) => {
      const table = document.getElementById('vendemmie-table');
      if (!table || table.style.display === 'none') return false;
      const row = Array.from(table.querySelectorAll('tbody tr')).find(
        (tr) => tr.textContent.includes(qli) && tr.querySelector('.badge-completa')
      );
      return !!row;
    },
    E2E_VENDEMMIA_COMPLETA_QLI,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runVendemmiaCompletaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerManodopera(page);
  await gotoVendemmia(page);

  if ((await completedMarkerRows(page).count()) === 0) {
    expect(await incompleteVendemmiaFromLavoroRows(page).count()).toBeGreaterThanOrEqual(1);
    await completeFirstStubVendemmiaFromLavoro(page);
  }

  await expect(page.locator('#empty-state')).toBeHidden();
  expect(await completedMarkerRows(page).count()).toBeGreaterThanOrEqual(1);
  await expect(completedMarkerRows(page).first()).toContainText(E2E_VENDEMMIA_COMPLETA_QLI);
  await expect(completedMarkerRows(page).first().locator('.badge-completa')).toBeVisible();
  await expect(completedMarkerRows(page).first().locator('.link-lavoro')).toBeVisible();
}

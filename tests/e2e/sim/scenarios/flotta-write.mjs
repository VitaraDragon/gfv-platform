/**
 * E2E write — nuovo mezzo flotta da lista (§11.3 write residui parco macchine).
 * @module tests/e2e/sim/scenarios/flotta-write
 */

import { gotoFlottaList, loginAsManagerFromDevPage } from '../helpers/sim-login.js';

export const E2E_FLOTTA_WRITE_NOME = 'GFV SIM E2E WRITE FLOTTA';

/**
 * @param {import('playwright-core').Page} page
 */
function flottaRowsWithMarker(page) {
  return page.locator('#table-container .mezzi-table tbody tr').filter({
    hasText: E2E_FLOTTA_WRITE_NOME,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function createFlottaMarker(page) {
  await page.locator('#btn-nuovo').click();
  await page.locator('#modal-nuovo.active').waitFor({ state: 'visible', timeout: 30_000 });

  await page.locator('#nome').fill(E2E_FLOTTA_WRITE_NOME);
  await page.locator('#tipoMacchina').selectOption('furgone');
  await page.locator('#form-nuovo button[type="submit"]').click();

  await page.waitForFunction(
    (nome) => {
      const rows = document.querySelectorAll('#table-container .mezzi-table tbody tr');
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(nome));
    },
    E2E_FLOTTA_WRITE_NOME,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runFlottaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFromDevPage(page);
  await gotoFlottaList(page);

  if ((await flottaRowsWithMarker(page).count()) === 0) {
    await createFlottaMarker(page);
  }

  expect(await flottaRowsWithMarker(page).count()).toBeGreaterThanOrEqual(1);
  await expect(flottaRowsWithMarker(page).first()).toContainText(E2E_FLOTTA_WRITE_NOME);

  const countText = await page.locator('#count-label').textContent();
  const countMatch = (countText || '').match(/(\d+)/);
  expect(countMatch).not.toBeNull();
  expect(parseInt(countMatch[1], 10)).toBeGreaterThanOrEqual(5);
}

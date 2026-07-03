/**
 * E2E write — nuovo trattore da lista parco macchine (manager).
 * @module tests/e2e/sim/scenarios/trattori-write
 */

import { gotoTrattoriList, loginAsManagerFromDevPage } from '../helpers/sim-login.js';

export const E2E_TRATTORE_WRITE_NOME = 'GFV SIM E2E WRITE TRATTORE';

/**
 * @param {import('playwright-core').Page} page
 */
function trattoreRowsWithMarker(page) {
  return page.locator('#table-container .mezzi-table tbody tr').filter({
    hasText: E2E_TRATTORE_WRITE_NOME,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function createTrattoreMarker(page) {
  await page.locator('#btn-nuovo').click();
  await page.locator('#modal-nuovo.active').waitFor({ state: 'visible', timeout: 30_000 });

  await page.locator('#nome').fill(E2E_TRATTORE_WRITE_NOME);
  await page.locator('#cavalli').fill('88');
  await page.locator('#form-nuovo button[type="submit"]').click();

  await page.waitForFunction(
    (nome) => {
      const rows = document.querySelectorAll('#table-container .mezzi-table tbody tr');
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(nome));
    },
    E2E_TRATTORE_WRITE_NOME,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runTrattoriWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFromDevPage(page);
  await gotoTrattoriList(page);

  if ((await trattoreRowsWithMarker(page).count()) === 0) {
    await createTrattoreMarker(page);
  }

  expect(await trattoreRowsWithMarker(page).count()).toBeGreaterThanOrEqual(1);
  await expect(trattoreRowsWithMarker(page).first()).toContainText(E2E_TRATTORE_WRITE_NOME);

  const countText = await page.locator('#count-label').textContent();
  const countMatch = (countText || '').match(/(\d+)/);
  expect(countMatch).not.toBeNull();
  expect(parseInt(countMatch[1], 10)).toBeGreaterThanOrEqual(2);
}

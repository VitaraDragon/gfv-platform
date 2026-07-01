/**
 * E2E write — nuova attrezzatura da lista parco macchine (§11.3 scen. 54).
 * @module tests/e2e/sim/scenarios/attrezzi-write
 */

import { gotoAttrezziList, loginAsManagerFromDevPage } from '../helpers/sim-login.js';

export const E2E_ATTREZZO_WRITE_NOME = 'GFV SIM E2E WRITE ATTREZZO';

/**
 * @param {import('playwright-core').Page} page
 */
function attrezzoRowsWithMarker(page) {
  return page.locator('#table-container .mezzi-table tbody tr').filter({
    hasText: E2E_ATTREZZO_WRITE_NOME,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function createAttrezzoMarker(page) {
  await page.locator('#btn-nuovo').click();
  await page.locator('#modal-nuovo.active').waitFor({ state: 'visible', timeout: 30_000 });

  await page.waitForFunction(() => {
    const sel = document.getElementById('categoriaId');
    return sel && sel.querySelectorAll('option[value]:not([value=""])').length >= 1;
  }, undefined, { timeout: 60_000 });

  await page.locator('#nome').fill(E2E_ATTREZZO_WRITE_NOME);
  const categoria = page.locator('#categoriaId');
  const firstValue = await categoria.locator('option[value]:not([value=""])').first().getAttribute('value');
  await categoria.selectOption(firstValue || { index: 1 });
  await page.locator('#cavalliMinimiRichiesti').fill('55');

  await page.locator('#form-nuovo button[type="submit"]').click();

  await page.waitForFunction(
    (nome) => {
      const rows = document.querySelectorAll('#table-container .mezzi-table tbody tr');
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(nome));
    },
    E2E_ATTREZZO_WRITE_NOME,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runAttrezziWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFromDevPage(page);
  await gotoAttrezziList(page);

  if ((await attrezzoRowsWithMarker(page).count()) === 0) {
    await createAttrezzoMarker(page);
  }

  expect(await attrezzoRowsWithMarker(page).count()).toBeGreaterThanOrEqual(1);
  await expect(attrezzoRowsWithMarker(page).first()).toContainText(E2E_ATTREZZO_WRITE_NOME);

  const countText = await page.locator('#count-label').textContent();
  const countMatch = (countText || '').match(/(\d+)/);
  expect(countMatch).not.toBeNull();
  expect(parseInt(countMatch[1], 10)).toBeGreaterThanOrEqual(4);
}

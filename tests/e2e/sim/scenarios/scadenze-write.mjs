/**
 * E2E write — aggiorna scadenza scaduta (rinnova) da lista scadenze parco.
 * Idempotente: data fissa 2030-06-15 sul primo mezzo scaduto (tipo data).
 * @module tests/e2e/sim/scenarios/scadenze-write
 */

import { gotoScadenzeList, loginAsManagerFromDevPage } from '../helpers/sim-login.js';

export const E2E_SCADENZE_WRITE_DATE = '2030-06-15';

/**
 * @param {import('playwright-core').Page} page
 */
async function rowAlreadyRenewed(page) {
  const renewed = page.locator('.scadenze-table tbody tr').filter({ hasText: /2030/i });
  if ((await renewed.count()) === 0) return false;
  return (await renewed.first().locator('.status-dot.dot-black').count()) === 0;
}

/**
 * @param {import('playwright-core').Page} page
 */
async function renewFirstScadutaDataRow(page) {
  const scadutaRow = page.locator('.scadenze-table tbody tr.row-scaduto').first();
  await scadutaRow.waitFor({ state: 'visible', timeout: 60_000 });

  const mezzoName = ((await scadutaRow.locator('td').first().textContent()) || '').trim();
  await scadutaRow.locator('.btn-rinnova').click();

  await page.locator('#modal-rinnova.active').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#group-data').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#rinnova-data').fill(E2E_SCADENZE_WRITE_DATE);
  await page.locator('#form-rinnova button[type="submit"]').click();

  await page.waitForFunction(
    () => {
      const modal = document.getElementById('modal-rinnova');
      return modal && !modal.classList.contains('active');
    },
    { timeout: 90_000 }
  );

  await page.waitForFunction(
    (mezzo) => {
      const rows = document.querySelectorAll('.scadenze-table tbody tr');
      for (const tr of rows) {
        const text = tr.textContent || '';
        if (!text.includes(mezzo) || !text.includes('2030')) continue;
        if (tr.querySelector('.status-dot.dot-green, .status-dot.dot-yellow')) return true;
        if (/Ok|Entro/i.test(text)) return true;
      }
      return false;
    },
    mezzoName,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runScadenzeWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFromDevPage(page);
  await gotoScadenzeList(page);

  if (!(await rowAlreadyRenewed(page))) {
    await renewFirstScadutaDataRow(page);
  }

  const renewedRow = page
    .locator('.scadenze-table tbody tr')
    .filter({ hasText: /2030/i })
    .first();
  await expect(renewedRow).toBeVisible();
  expect(await renewedRow.locator('.status-dot.dot-black').count()).toBe(0);
  expect(await renewedRow.locator('.status-dot.dot-green, .status-dot.dot-yellow').count()).toBeGreaterThanOrEqual(
    1
  );
}

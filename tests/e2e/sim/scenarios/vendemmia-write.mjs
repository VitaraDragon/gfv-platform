/**
 * E2E write — nuova vendemmia su vigneto seed.
 * Idempotente: qli marker 88.8 + note distintiva.
 * @module tests/e2e/sim/scenarios/vendemmia-write
 */

import { gotoVendemmia, loginAsManagerFromDevPage } from '../helpers/sim-login.js';

export const E2E_VENDEMMIA_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_VENDEMMIA';
export const E2E_VENDEMMIA_WRITE_QLI = '88.8';

/**
 * @param {import('playwright-core').Page} page
 */
function vendemmiaRowsWithMarker(page) {
  return page.locator('#vendemmie-table tbody tr').filter({ hasText: E2E_VENDEMMIA_WRITE_QLI });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function createVendemmiaMarker(page) {
  page.once('dialog', (dialog) => dialog.accept());

  await page.getByRole('button', { name: /Nuova Vendemmia/i }).click();
  await page.locator('#vendemmia-modal.active').waitFor({ state: 'visible', timeout: 30_000 });

  await page.waitForFunction(() => {
    const sel = document.getElementById('vignetoId');
    return sel && sel.querySelectorAll('option:not([value=""])').length >= 1;
  }, { timeout: 60_000 });

  const vignetoValue = await page.locator('#vignetoId option:not([value=""])').first().getAttribute('value');
  await page.locator('#vignetoId').selectOption(vignetoValue || { index: 1 });

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  await page.locator('#data').fill(today);
  await page.locator('#quantitaQli').fill(E2E_VENDEMMIA_WRITE_QLI);
  await page.locator('#quantitaEttari').fill('1.5');
  await page.locator('#destinazione').selectOption('vino');
  await page.locator('#note').fill(E2E_VENDEMMIA_WRITE_NOTE);

  const operaioNome = page.locator('#operai-tabella-body .operaio-nome').first();
  if (await operaioNome.isVisible()) {
    await operaioNome.fill('E2E Sim Operaio');
    await page.locator('#operai-tabella-body .operaio-ore').first().fill('4');
  }

  await page.locator('#vendemmia-form button[type="submit"]').click();

  await page.waitForFunction(
    (qli) => {
      const table = document.getElementById('vendemmie-table');
      return table && table.style.display !== 'none' && (table.textContent || '').includes(qli);
    },
    E2E_VENDEMMIA_WRITE_QLI,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runVendemmiaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFromDevPage(page);
  await gotoVendemmia(page);

  if ((await vendemmiaRowsWithMarker(page).count()) === 0) {
    await createVendemmiaMarker(page);
  }

  await expect(page.locator('#empty-state')).toBeHidden();
  expect(await vendemmiaRowsWithMarker(page).count()).toBeGreaterThanOrEqual(1);
  await expect(vendemmiaRowsWithMarker(page).first()).toContainText(E2E_VENDEMMIA_WRITE_QLI);
}

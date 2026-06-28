/**
 * Assert hub magazzino + tracciabilità consumi (seed movimenti uscita).
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runMagazzinoHomeAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/magazzino-home-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Prodotti e Magazzino' })).toBeVisible();

  const prodottiStat = page.locator('#stat-prodotti');
  await expect(prodottiStat).not.toHaveText('-');
  expect(parseInt(await prodottiStat.textContent(), 10)).toBeGreaterThanOrEqual(5);

  const movimentiStat = page.locator('#stat-movimenti');
  await expect(movimentiStat).not.toHaveText('-');
  expect(parseInt(await movimentiStat.textContent(), 10)).toBeGreaterThanOrEqual(1);

  await expect(page.getByRole('link', { name: /Anagrafica Prodotti/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Tracciabilità consumi/i })).toBeVisible();
}

export async function runTracciabilitaConsumiAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/tracciabilita-consumi-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Tracciabilità consumi' })).toBeVisible();

  const container = page.locator('#tabella-container');
  await expect(container.locator('.loading')).toHaveCount(0);
  await expect(container.locator('.empty-state')).toHaveCount(0);

  const countText = await page.locator('#righe-count').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(8);

  expect(await container.locator('.movimenti-table tbody tr').count()).toBeGreaterThanOrEqual(1);
}

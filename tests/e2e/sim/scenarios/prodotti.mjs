/**
 * Assert DOM anagrafica prodotti magazzino — seed 5 prodotti.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runProdottiListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/prodotti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Anagrafica Prodotti' })).toBeVisible();

  const container = page.locator('#prodotti-container');
  const table = container.locator('.prodotti-table');
  await expect(table).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(5);

  const countText = await page.locator('#prodotti-count').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(5);

  await expect(table.locator('thead th', { hasText: 'Giacenza' })).toBeVisible();
  await expect(table.locator('.badge-attivo').first()).toBeVisible();
}

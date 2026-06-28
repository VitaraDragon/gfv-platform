/**
 * Assert DOM gestione lavori + validazione ore (manager) — seed manodopera v2.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGestioneLavoriAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/gestione-lavori-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Lavori' })).toBeVisible();

  const table = page.locator('#lavori-container .lavori-table');
  await expect(table).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);

  const countText = await page.locator('#lavori-count').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(3);
}

export async function runValidazioneOreAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/validazione-ore-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Validazione Ore' })).toBeVisible();

  const container = page.locator('#ore-container');
  await expect(container).toBeVisible();
  await expect(container.locator('.loading')).toHaveCount(0);

  const statDaValidare = page.locator('#stat-da-validare');
  await expect(statDaValidare).toBeVisible();
  const pendingCount = parseInt(await statDaValidare.textContent(), 10);
  expect(pendingCount).toBeGreaterThanOrEqual(2);

  const rows = container.locator('.ore-table tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(2);

  await expect(page.locator('#stat-validate')).toBeVisible();
}

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

  const totale = await page.locator('#stat-totale-lavori').textContent();
  expect(parseInt(totale, 10)).toBeGreaterThanOrEqual(3);
}

export async function runValidazioneOreAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/validazione-ore-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Validazione Ore' })).toBeVisible();

  const container = page.locator('#ore-container');
  await expect(container).toBeVisible();
  await expect(container.locator('.loading')).toHaveCount(0);

  await expect(page.locator('#stat-da-validare')).toBeVisible();

  const hasTable = (await container.locator('.ore-table tbody tr').count()) > 0;
  const hasEmpty = await container.locator('.empty-state').isVisible().catch(() => false);

  expect(hasTable || hasEmpty).toBe(true);

  if (hasEmpty) {
    await expect(container.getByText(/validate|rifiutate/i)).toBeVisible();
  }
}

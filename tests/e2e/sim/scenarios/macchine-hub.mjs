/**
 * Assert hub parco macchine + lista guasti.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runMacchineDashboardAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/macchine-dashboard-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Parco Macchine' })).toBeVisible();

  const trattoriVal = page.locator('#card-trattori-value');
  await expect(trattoriVal).not.toHaveText('—');
  expect(parseInt(await trattoriVal.textContent(), 10)).toBeGreaterThanOrEqual(1);

  const attrezziVal = page.locator('#card-attrezzature-value');
  await expect(attrezziVal).not.toHaveText('—');
  expect(parseInt(await attrezziVal.textContent(), 10)).toBeGreaterThanOrEqual(3);

  const flottaVal = page.locator('#card-flotta-value');
  await expect(flottaVal).not.toHaveText('—');
  expect(parseInt(await flottaVal.textContent(), 10)).toBeGreaterThanOrEqual(4);

  await expect(page.getByRole('link', { name: /Elenco trattori/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Scadenze/i }).first()).toBeVisible();
}

export async function runGuastiListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/guasti-list-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Officina' })).toBeVisible();

  const container = page.locator('#table-container');
  await expect(container.locator('.loading')).toHaveCount(0);

  const tableRows = container.locator('.guasti-table tbody tr');
  expect(await tableRows.count()).toBeGreaterThanOrEqual(2);

  const countLabel = await page.locator('#count-label').textContent();
  expect(countLabel).toMatch(/2 guasti/i);
  expect(countLabel).toMatch(/apert/i);

  await expect(container.locator('.badge-grave').first()).toBeVisible();
  await expect(container.locator('.badge-in-attesa').first()).toBeVisible();

  await page.locator('#filter-stato').selectOption('tutti');
  await expect(container.locator('.guasti-table tbody tr')).toHaveCount(3);
  await expect(container.locator('.badge-risolto').first()).toBeVisible();
}

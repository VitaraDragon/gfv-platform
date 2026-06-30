/**
 * Assert admin parco macchine + gestione guasti (seed 8 macchine, 3+ guasti).
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGestioneMacchineAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/gestione-macchine-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Macchine' })).toBeVisible();

  const container = page.locator('#macchine-container');
  await expect(container.locator('.loading')).toHaveCount(0);

  const rows = container.locator('.macchine-table tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(8);
  expect(await rows.count()).toBeLessThanOrEqual(12);

  const countText = await page.locator('#macchine-count').textContent();
  const countMatch = (countText || '').match(/(\d+)/);
  expect(countMatch).not.toBeNull();
  expect(parseInt(countMatch[1], 10)).toBeGreaterThanOrEqual(8);

  await expect(page.locator('#nuova-macchina-button')).toBeVisible();
}

export async function runGestioneGuastiAdminAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/gestione-guasti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Guasti' })).toBeVisible();

  const statTotali = page.locator('#stat-totali');
  await expect(statTotali).not.toHaveText('-');
  const totali = parseInt(await statTotali.textContent(), 10);
  expect(totali).toBeGreaterThanOrEqual(3);
  expect(totali).toBeLessThanOrEqual(10);

  const list = page.locator('#guasti-list');
  expect(await list.locator('.guasto-item').count()).toBeGreaterThanOrEqual(3);
  await expect(list.locator('.badge-grave, .badge-non-grave').first()).toBeVisible();
}

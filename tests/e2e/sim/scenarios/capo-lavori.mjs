/**
 * Assert vista caposquadra — lavori assegnati (desktop).
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runLavoriCaposquadraAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/lavori-caposquadra-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'I Miei Lavori' })).toBeVisible();

  const container = page.locator('#lavori-container');
  await expect(container.locator('.loading')).toHaveCount(0);

  const cards = container.locator('.lavoro-card');
  expect(await cards.count()).toBeGreaterThanOrEqual(1);

  await expect(cards.first().locator('.lavoro-title')).not.toHaveText('');
}

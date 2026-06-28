/**
 * Assert dashboard vigneto — panoramica moduli operativi.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runVignetoDashboardAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/vigneto-dashboard-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'VIGNETO' })).toBeVisible();

  const numeroVigneti = page.locator('#stat-numero-vigneti');
  await expect(numeroVigneti).not.toHaveText('-');
  expect(parseInt(await numeroVigneti.textContent(), 10)).toBeGreaterThanOrEqual(4);

  await expect(page.getByRole('link', { name: /Anagrafica Vigneti/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Potatura/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Trattamenti/i })).toBeVisible();
}

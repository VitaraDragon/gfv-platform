/**
 * Assert mappa aziendale + statistiche core (template viticola-conto-terzi-manodopera).
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runMappaAziendaleAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/mappa-aziendale-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Mappa aziendale' })).toBeVisible();
  await expect(page.locator('#mappa-aziendale-container')).toBeVisible();
  await expect(page.locator('#filtro-coltura, h2').filter({ hasText: /Mappa Aziendale/i }).first()).toBeVisible();
}

export async function runStatisticheCoreAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/statistiche-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Statistiche e Dashboard' })).toBeVisible();

  const terreni = page.locator('#metric-terreni');
  await expect(terreni).not.toHaveText('-');
  expect(parseInt(await terreni.textContent(), 10)).toBeGreaterThanOrEqual(4);

  const attivita = page.locator('#metric-attivita');
  await expect(attivita).not.toHaveText('-');
  expect(parseInt(await attivita.textContent(), 10)).toBeGreaterThanOrEqual(1);

  await expect(page.locator('#chart-ore-tipo')).toBeVisible();
  await expect(page.locator('#stat-terreni-affitto')).not.toHaveText('-');
}

/**
 * Assert hub manodopera + anagrafiche team + statistiche.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runManodoperaHomeAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/manodopera-home-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Manodopera' })).toBeVisible();

  await expect(page.getByRole('link', { name: /Gestione Lavori/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Validazione Ore/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Gestione Operai/i })).toBeVisible();
}

export async function runGestioneOperaiAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/gestione-operai-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Operai' })).toBeVisible();

  const table = page.locator('#operai-container .operai-table');
  await expect(table).toBeVisible();
  expect(await table.locator('tbody tr').count()).toBeGreaterThanOrEqual(3);

  const countText = await page.locator('#operai-count').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(3);
}

export async function runGestioneSquadreAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/gestione-squadre-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Squadre' })).toBeVisible();

  const table = page.locator('#squadre-container .squadre-table');
  await expect(table).toBeVisible();
  expect(await table.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);

  await expect(page.locator('#squadre-count')).not.toHaveText(/^0 squadre$/);
}

export async function runStatisticheManodoperaAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/statistiche-manodopera-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Statistiche Manodopera' })).toBeVisible();

  const lavoriTotali = page.locator('#stat-lavori-totali');
  await expect(lavoriTotali).not.toHaveText('-');
  expect(parseInt(await lavoriTotali.textContent(), 10)).toBeGreaterThanOrEqual(3);

  const squadreTotali = page.locator('#stat-squadre-totali');
  await expect(squadreTotali).not.toHaveText('-');
  expect(parseInt(await squadreTotali.textContent(), 10)).toBeGreaterThanOrEqual(1);
}

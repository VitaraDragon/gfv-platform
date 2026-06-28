/**
 * Assert DOM pagina scadenze parco macchine — condiviso tra spec Playwright e runner Node.
 * Dati seed (bucket black/red/yellow km/ore/date) validati da v3; assert su DOM visibile.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runScadenzeListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/scadenze-list-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Scadenze' })).toBeVisible();

  const table = page.locator('.scadenze-table');
  await expect(table).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(5);

  const countLabel = page.locator('#count-label');
  await expect(countLabel).not.toHaveText(/^0 scadenze$/);
  const countText = await countLabel.textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(5);

  const blackDots = table.locator('.status-dot.dot-black');
  const redDots = table.locator('.status-dot.dot-red');
  const yellowDots = table.locator('.status-dot.dot-yellow');

  expect(await blackDots.count()).toBeGreaterThanOrEqual(1);
  expect(await redDots.count()).toBeGreaterThanOrEqual(1);
  expect(await yellowDots.count()).toBeGreaterThanOrEqual(1);

  const statoTexts = await table.locator('tbody td:nth-child(4)').allTextContents();
  const hasUrgentText = statoTexts.some((t) =>
    /Scaduto|Superato|Entro 7 gg|< 15 ore|< 500 km|Entro 30 gg|< 50 ore|< 2\.?000 km/i.test(t)
  );
  expect(hasUrgentText).toBe(true);

  expect(await table.locator('tr.row-scaduto').count()).toBeGreaterThanOrEqual(1);

  const tipiScadenza = await table.locator('tbody td:nth-child(2)').allTextContents();
  const hasMixedTypes = tipiScadenza.some((t) => /Manutenzione|Tagliando|Revisione|Assicurazione/i.test(t));
  expect(hasMixedTypes).toBe(true);
}

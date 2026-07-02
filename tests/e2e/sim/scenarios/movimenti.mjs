/**
 * Assert DOM lista movimenti magazzino — condiviso tra spec Playwright e runner Node.
 * Seed catena B: uscite da trattamenti vigneto completati (origineTrattamento* + attivitaId).
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runMovimentiAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/movimenti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Movimenti Magazzino' })).toBeVisible();

  const container = page.locator('#movimenti-container');
  const table = container.locator('.movimenti-table');
  await expect(table).toBeVisible();

  const header = table.locator('thead tr');
  await expect(header.locator('th', { hasText: 'Data' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Prodotto' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Tipo' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Attività' })).toBeVisible();

  const rows = table.locator('tbody tr');
  const rowCount = await rows.count();
  // Seed sim: 12 uscite; + fino a 2 movimenti write E2E (entrata/uscita idempotenti)
  expect(rowCount).toBeGreaterThanOrEqual(10);
  expect(rowCount).toBeLessThanOrEqual(18);

  const countLabel = page.locator('#movimenti-count');
  await expect(countLabel).not.toHaveText(/^0 movimenti$/);
  const countText = await countLabel.textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(10);

  const usciteBadges = table.locator('.badge-uscita');
  expect(await usciteBadges.count()).toBeGreaterThanOrEqual(10);

  const attivitaCells = await table.locator('tbody td:nth-child(9)').allTextContents();
  const linkedAttivita = attivitaCells.filter(
    (t) => t.trim() !== '-' && /Trattamento|Concimazione|Controllo fitosanitario/i.test(t)
  );
  expect(linkedAttivita.length).toBeGreaterThanOrEqual(10);

  const seedTipi = ['Trattamento', 'Concimazione', 'Controllo fitosanitario'];
  const matchedTipi = seedTipi.filter((tipo) =>
    attivitaCells.some((t) => t.includes(tipo))
  );
  expect(matchedTipi.length).toBeGreaterThanOrEqual(2);

  const noteCells = await table.locator('tbody td:nth-child(10)').allTextContents();
  expect(noteCells.some((n) => /Scarico da trattamento/i.test(n))).toBe(true);

  const prodotti = await table.locator('tbody td:nth-child(2)').allTextContents();
  expect(prodotti.filter((p) => p.trim().length > 0 && p.trim() !== '-').length).toBeGreaterThanOrEqual(10);

  await expect(page.getByRole('heading', { name: 'Elenco Movimenti' })).toBeVisible();
}

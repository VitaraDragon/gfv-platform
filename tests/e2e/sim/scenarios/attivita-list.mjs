/**
 * Assert DOM lista diario attività — condiviso tra spec Playwright e runner Node.
 * Seed template solo-titolare-viticola: 20 attività (4 settimane); assert su DOM visibile.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runAttivitaListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/attivita-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Diario Attività' })).toBeVisible();
  await expect(page.locator('#user-info')).not.toHaveText('Caricamento...');

  const container = page.locator('#attivita-container');
  const table = container.locator('.attivita-table');
  await expect(table).toBeVisible();

  const header = table.locator('.attivita-header');
  await expect(header.locator('.col-data', { hasText: 'Data' })).toBeVisible();
  await expect(header.locator('.col-terreno', { hasText: 'Terreno' })).toBeVisible();
  await expect(header.locator('.col-tipo-lavoro', { hasText: 'Tipo Lavoro' })).toBeVisible();
  await expect(header.locator('.col-coltura', { hasText: 'Coltura' })).toBeVisible();
  await expect(header.locator('.col-ore', { hasText: 'Ore Nette' })).toBeVisible();

  const rows = table.locator('.attivita-row');
  const rowCount = await rows.count();
  // Seed sim: 20 attività; soglia ≥15 per tollerare filtri/date refresh parziali
  expect(rowCount).toBeGreaterThanOrEqual(15);
  expect(rowCount).toBeLessThanOrEqual(25);

  const tipiLavoro = await table.locator('.col-tipo-lavoro').allTextContents();
  const seedTipi = ['Potatura', 'Trattamento', 'Erpicatura', 'Concimazione', 'Controllo fitosanitario'];
  const matchedTipi = seedTipi.filter((tipo) =>
    tipiLavoro.some((t) => t.includes(tipo))
  );
  expect(matchedTipi.length).toBeGreaterThanOrEqual(3);

  const colture = await table.locator('.col-coltura').allTextContents();
  expect(colture.some((c) => /Vite/i.test(c))).toBe(true);

  const dateCells = await table.locator('.col-data').allTextContents();
  expect(dateCells.filter((d) => d.trim().length > 0).length).toBeGreaterThanOrEqual(15);

  await expect(page.getByRole('heading', { name: 'Le Tue Attività' })).toBeVisible();
}

/**
 * Assert DOM potature + trattamenti vigneto — condiviso tra spec Playwright e runner Node.
 * Seed solo-titolare-viticola: 4 potature + 12 trattamenti Firestore (8 fitosanitari in lista
 * Trattamenti + 4 concimazioni in lista Concimazioni); assert su DOM visibile.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runPotaturaListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/potatura-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Potatura Vigneto' })).toBeVisible();

  const tableWrap = page.locator('#table-wrap');
  await expect(tableWrap).toBeVisible();

  const table = tableWrap.locator('table');
  const header = table.locator('thead tr');
  await expect(header.locator('th', { hasText: 'Data' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Vigneto' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Tipo' })).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  expect(await rows.count()).toBeLessThanOrEqual(6);

  await expect(table.getByRole('link', { name: /Vedi Attività/i }).first()).toBeVisible();

  const tipi = await table.locator('tbody td:nth-child(3)').allTextContents();
  expect(tipi.some((t) => /Invernale|Verde|Rinnovo|Spollonatura/i.test(t))).toBe(true);
}

export async function runTrattamentiListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/trattamenti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Trattamenti Vigneto' })).toBeVisible();

  const tableWrap = page.locator('#table-wrap');
  await expect(tableWrap).toBeVisible();

  const table = tableWrap.locator('table');
  const header = table.locator('thead tr');
  await expect(header.locator('th', { hasText: 'Data' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Vigneto' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Prodotto' })).toBeVisible();

  const rows = table.locator('tbody tr');
  const rowCount = await rows.count();
  // Pagina fitosanitari: Trattamento + Controllo fitosanitario (seed 8); concimazioni su altra vista
  expect(rowCount).toBeGreaterThanOrEqual(6);
  expect(rowCount).toBeLessThanOrEqual(10);

  await expect(table.getByRole('link', { name: /Vedi Attività/i }).first()).toBeVisible();

  const prodotti = await table.locator('tbody td:nth-child(5)').allTextContents();
  expect(prodotti.filter((p) => p.trim() !== '-' && p.trim().length > 0).length).toBeGreaterThanOrEqual(6);

  const lavori = await table.locator('tbody td:nth-child(3)').allTextContents();
  const hasTrattamentoSeed = lavori.some((t) =>
    /Trattamento|Controllo fitosanitario|Attività simulata/i.test(t)
  );
  expect(hasTrattamentoSeed).toBe(true);
}

export async function runConcimazioniListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/concimazioni-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Concimazioni Vigneto' })).toBeVisible();

  const tableWrap = page.locator('#table-wrap');
  await expect(tableWrap).toBeVisible();

  const rows = tableWrap.locator('table tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  expect(await rows.count()).toBeLessThanOrEqual(6);

  await expect(
    tableWrap.locator('table').getByRole('link', { name: /Vedi Attività/i }).first()
  ).toBeVisible();
}

/** Potatura + trattamenti fitosanitari + concimazioni (12 trattamenti seed totali). */
export async function runVignetoAssertions(page, expect) {
  await runPotaturaListAssertions(page, expect);
  await runTrattamentiListAssertions(page, expect);
  await runConcimazioniListAssertions(page, expect);
}

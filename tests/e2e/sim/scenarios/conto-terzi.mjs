/**
 * Assert DOM moduli Conto Terzi — condiviso tra spec Playwright e runner Node.
 * Seed template viticola-conto-terzi*: 3 clienti, 8 tariffe, 5 preventivi, 6 terreni clienti
 * — validati da orchestrator + sim:audit; assert su DOM visibile.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runClientiListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/clienti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Anagrafica Clienti' })).toBeVisible();

  const container = page.locator('#clienti-container');
  const table = container.locator('.clienti-table');
  await expect(table).toBeVisible();

  const header = table.locator('thead tr');
  await expect(header.locator('th', { hasText: 'Ragione Sociale' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'P.IVA' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Stato' })).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  expect(await rows.count()).toBeLessThanOrEqual(5);

  const countLabel = page.locator('#clienti-count');
  const countText = await countLabel.textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(3);

  const attiviBadges = table.locator('.badge-success', { hasText: 'Attivo' });
  const sospesiBadges = table.locator('.badge-warning', { hasText: 'Sospeso' });
  expect(await attiviBadges.count()).toBeGreaterThanOrEqual(2);
  expect(await sospesiBadges.count()).toBeGreaterThanOrEqual(1);

  const ragioni = await table.locator('tbody td:nth-child(1)').allTextContents();
  expect(ragioni.filter((t) => t.trim().length > 0).length).toBeGreaterThanOrEqual(3);

  const pivaCells = await table.locator('tbody td:nth-child(2)').allTextContents();
  expect(pivaCells.filter((t) => /^\d{11}$/.test(t.trim())).length).toBeGreaterThanOrEqual(3);

  await expect(page.getByRole('heading', { name: 'Elenco Clienti' })).toBeVisible();
}

export async function runTariffeListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/tariffe-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Tariffe' })).toBeVisible();

  const container = page.locator('#tariffe-container');
  const table = container.locator('.tariffe-table');
  await expect(table).toBeVisible();

  const header = table.locator('thead tr');
  await expect(header.locator('th', { hasText: 'Tipo Lavoro' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Tipo Campo' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Stato' })).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(8);
  expect(await rows.count()).toBeLessThanOrEqual(12);

  const countText = await page.locator('#tariffe-count').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(8);

  const attiveBadges = table.locator('.badge-success', { hasText: 'Attiva' });
  const disattivateBadges = table.locator('.badge-secondary', { hasText: 'Disattivata' });
  expect(await attiveBadges.count()).toBeGreaterThanOrEqual(7);
  expect(await disattivateBadges.count()).toBeGreaterThanOrEqual(1);

  const tipiLavoro = await table.locator('tbody td:nth-child(1)').allTextContents();
  const seedTipi = ['Potatura', 'Trattamento', 'Erpicatura', 'Concimazione', 'Aratura'];
  const matchedTipi = seedTipi.filter((tipo) => tipiLavoro.some((t) => t.includes(tipo)));
  expect(matchedTipi.length).toBeGreaterThanOrEqual(3);

  const tariffeFinali = await table.locator('tbody td:nth-child(6)').allTextContents();
  expect(tariffeFinali.filter((t) => /€/.test(t)).length).toBeGreaterThanOrEqual(8);
}

export async function runPreventiviListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/preventivi-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Preventivi' })).toBeVisible();

  const container = page.locator('#preventivi-container');
  const table = container.locator('.preventivi-table');
  await expect(table).toBeVisible();

  const header = table.locator('thead tr');
  await expect(header.locator('th', { hasText: 'Numero' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Cliente' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Stato' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Totale' })).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(5);
  expect(await rows.count()).toBeLessThanOrEqual(8);

  const countText = await page.locator('#preventivi-count').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(5);

  const numeri = await table.locator('tbody td:nth-child(1)').allTextContents();
  expect(numeri.filter((n) => /PREV-\d{4}-\d{3}/.test(n.trim())).length).toBeGreaterThanOrEqual(5);

  const statiText = await table.locator('tbody td:nth-child(7)').allTextContents();
  const statiAttesi = ['Bozza', 'Inviato', 'Accettato', 'Rifiutato'];
  const statiTrovati = statiAttesi.filter((s) => statiText.some((t) => t.includes(s)));
  expect(statiTrovati.length).toBeGreaterThanOrEqual(4);

  const colture = await table.locator('tbody td:nth-child(4)').allTextContents();
  expect(colture.some((c) => /Vite da Vino/i.test(c))).toBe(true);

  const totali = await table.locator('tbody td:nth-child(6)').allTextContents();
  expect(totali.filter((t) => /€/.test(t)).length).toBeGreaterThanOrEqual(5);

  const superfici = await table.locator('tbody td:nth-child(5)').allTextContents();
  expect(superfici.filter((s) => /\d+[.,]\d{2}\s*ha/i.test(s)).length).toBeGreaterThanOrEqual(5);

  await page.locator('#filter-stato').selectOption('bozza');
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('#preventivi-container .preventivi-table tbody tr');
    if (!rows.length) return false;
    return Array.from(rows).every((tr) => /Bozza/i.test(tr.textContent || ''));
  }, { timeout: 30_000 });
  expect(await table.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);

  await page.locator('#filter-stato').selectOption('inviato');
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('#preventivi-container .preventivi-table tbody tr');
    if (!rows.length) return false;
    return Array.from(rows).every((tr) => /Inviato/i.test(tr.textContent || ''));
  }, { timeout: 30_000 });
  expect(await table.locator('tbody tr').count()).toBeGreaterThanOrEqual(1);

  await page.locator('#filter-stato').selectOption('');
}

export async function runTerreniClientiAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/terreni-clienti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Terreni Clienti' })).toBeVisible();

  const container = page.locator('#terreni-container');
  const cards = container.locator('.terreno-card');
  expect(await cards.count()).toBeGreaterThanOrEqual(1);
  expect(await cards.count()).toBeLessThanOrEqual(6);

  const countText = await page.locator('#terreni-count').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(1);

  const cardTexts = await cards.allTextContents();
  expect(cardTexts.some((t) => /Vite da Vino/i.test(t))).toBe(true);
  expect(cardTexts.some((t) => /Superficie:/i.test(t))).toBe(true);
  expect(cardTexts.some((t) => /Podere:/i.test(t))).toBe(true);
  expect(cardTexts.some((t) => /Mappa disponibile/i.test(t))).toBe(true);
}

/** Scenario completo conto terzi: clienti → tariffe → preventivi → terreni clienti. */
export async function runContoTerziAssertions(page, expect) {
  await runClientiListAssertions(page, expect);
  await runTariffeListAssertions(page, expect);
  await runPreventiviListAssertions(page, expect);
  await runTerreniClientiAssertions(page, expect);
}

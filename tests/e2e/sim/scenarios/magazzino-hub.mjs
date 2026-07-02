/**
 * Assert hub magazzino + tracciabilità consumi (seed movimenti uscita).
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runMagazzinoHomeAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/magazzino-home-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Prodotti e Magazzino' })).toBeVisible();

  const prodottiStat = page.locator('#stat-prodotti');
  await expect(prodottiStat).not.toHaveText('-');
  expect(parseInt(await prodottiStat.textContent(), 10)).toBeGreaterThanOrEqual(5);

  const movimentiStat = page.locator('#stat-movimenti');
  await expect(movimentiStat).not.toHaveText('-');
  // Hub: movimenti ultimi 30 gg — seed catena B genera uscite recenti
  expect(parseInt(await movimentiStat.textContent(), 10)).toBeGreaterThanOrEqual(8);

  await expect(page.getByRole('link', { name: /Anagrafica Prodotti/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Movimenti/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Tracciabilità consumi/i }).first()).toBeVisible();
}

export async function runTracciabilitaConsumiAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/tracciabilita-consumi-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Tracciabilità consumi' })).toBeVisible();

  const container = page.locator('#tabella-container');
  await expect(container.locator('.loading')).toHaveCount(0);
  await expect(container.locator('.empty-state')).toHaveCount(0);

  const countText = await page.locator('#righe-count').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(8);

  // Vista dettagliata: attendere .flat-wrap (non la tabella prodotto annidata della vista raggruppata)
  await page.locator('#filter-vista').selectOption('dettaglio');
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll(
      '#tabella-container .flat-wrap .movimenti-table tbody tr'
    );
    return rows.length >= 8;
  }, { timeout: 60_000 });

  const rows = container.locator('.flat-wrap .movimenti-table tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(8);

  const prodotti = await rows.locator('td:nth-child(2)').allTextContents();
  expect(prodotti.filter((p) => p.trim() && p.trim() !== '—' && p.trim() !== '-').length).toBeGreaterThanOrEqual(8);

  const contesti = await rows.locator('td:nth-child(5)').allTextContents();
  const trattamentoRows = contesti.filter((c) => /Trattamento/i.test(c));
  expect(trattamentoRows.length).toBeGreaterThanOrEqual(6);

  const note = await rows.locator('td:nth-child(6)').allTextContents();
  expect(note.some((n) => /Scarico da trattamento/i.test(n))).toBe(true);
}

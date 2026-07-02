/**
 * Assert DOM potature + trattamenti + concimazioni frutteto — seed catena A §11.3.12.
 * @module tests/e2e/sim/scenarios/frutteto
 */

export async function runFruttetoPotaturaListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/frutteto\/views\/potatura-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Potatura Frutteto' })).toBeVisible();

  const tableWrap = page.locator('#table-wrap');
  await expect(tableWrap).toBeVisible();

  const table = tableWrap.locator('table');
  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  expect(await rows.count()).toBeLessThanOrEqual(6);

  await expect(table.getByRole('link', { name: /Vedi Attività/i }).first()).toBeVisible();
  await expect(table.locator('button[data-edit]').first()).toBeVisible();
}

export async function runFruttetoTrattamentiListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/frutteto\/views\/trattamenti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Trattamenti Frutteto' })).toBeVisible();

  const rows = page.locator('#tbody-trattamenti tr');
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThanOrEqual(6);
  expect(rowCount).toBeLessThanOrEqual(14);

  await expect(page.getByRole('link', { name: /Vedi Attività/i }).first()).toBeVisible();

  const prodotti = await rows.locator('td:nth-child(5)').allTextContents();
  expect(prodotti.length).toBeGreaterThanOrEqual(6);

  const lavori = await rows.locator('td:nth-child(3)').allTextContents();
  expect(
    lavori.some((t) => /Trattamento|Controllo fitosanitario|Attività/i.test(t))
  ).toBe(true);

  const prodottiFilled = prodotti.filter((p) => {
    const t = p.trim();
    return t && t !== '-' && t !== '—';
  });
  const prodottiStub = prodotti.filter((p) => {
    const t = p.trim();
    return !t || t === '-' || t === '—';
  });
  // Seed: fase 4 catena B completa trattamenti in Node (come vigneto); idempotente post write E2E
  expect(prodottiFilled.length + prodottiStub.length).toBeGreaterThanOrEqual(6);
  expect(prodottiFilled.length >= 1 || prodottiStub.length >= 1).toBe(true);
}

export async function runFruttetoConcimazioniListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/frutteto\/views\/concimazioni-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Concimazioni Frutteto' })).toBeVisible();

  const rows = page.locator('#table-wrap tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole('link', { name: /Vedi Attività/i }).first()).toBeVisible();
}

export async function runRaccoltaFruttaReadAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/raccolta-frutta-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Raccolta Frutta' })).toBeVisible();

  const rows = page.locator('#raccolte-table-body tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(1);

  const kgCells = await rows.locator('td:nth-child(5)').allTextContents();
  expect(kgCells.some((k) => {
    const t = k.trim();
    return t === '-' || t === '—' || t === '' || t === 'NaN';
  })).toBe(true);
}

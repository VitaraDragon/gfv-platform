/**
 * Assert DOM potature + trattamenti vigneto — condiviso tra spec Playwright e runner Node.
 * Seed solo-titolare-viticola: 4 potature stub + 12 trattamenti stub (8 fitosanitari in lista
 * Trattamenti + 4 concimazioni); 1 vendemmia stub da attività diario; assert su DOM visibile.
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

  // Stub catena A: tipo o ceppi ancora da completare
  const ceppi = await table.locator('tbody td:nth-child(4)').allTextContents();
  const hasStubPotatura = tipi.some((t) => t.trim() === '-') || ceppi.some((c) => c.trim() === '-');
  expect(hasStubPotatura).toBe(true);
  expect(await table.getByRole('link', { name: /Vedi Attività/i }).count()).toBeGreaterThanOrEqual(1);
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
  // Pagina fitosanitari: seed 8 + stub catena A da lavoro (+ margine suite write)
  expect(rowCount).toBeGreaterThanOrEqual(6);
  expect(rowCount).toBeLessThanOrEqual(12);

  await expect(table.getByRole('link', { name: /Vedi Attività/i }).first()).toBeVisible();

  const prodotti = await table.locator('tbody td:nth-child(5)').allTextContents();
  // Stub catena A: prodotto vuoto fino a completamento UI; verifica righe e link attività/lavoro
  expect(prodotti.length).toBeGreaterThanOrEqual(6);

  const lavori = await table.locator('tbody td:nth-child(3)').allTextContents();
  const hasTrattamentoSeed = lavori.some((t) =>
    /Trattamento|Controllo fitosanitario|Attività simulata/i.test(t)
  );
  expect(hasTrattamentoSeed).toBe(true);

  const prodottiFilled = prodotti.filter((p) => {
    const t = p.trim();
    return t && t !== '-' && t !== '—';
  });
  const prodottiStub = prodotti.filter((p) => {
    const t = p.trim();
    return !t || t === '-' || t === '—';
  });
  expect(prodottiStub.length).toBeGreaterThanOrEqual(1);
  expect(prodottiFilled.length + prodottiStub.length).toBeGreaterThanOrEqual(6);
}

export async function runConcimazioniListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/concimazioni-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Concimazioni Vigneto' })).toBeVisible();

  const tableWrap = page.locator('#table-wrap');
  await expect(tableWrap).toBeVisible();

  const rows = tableWrap.locator('table tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  // Seed 4 concimazioni + fino a 1 riga E2E concimazione-diario-completa-write
  expect(await rows.count()).toBeLessThanOrEqual(7);

  await expect(
    tableWrap.locator('table').getByRole('link', { name: /Vedi Attività/i }).first()
  ).toBeVisible();

  const prodottoCells = await tableWrap.locator('table tbody td:nth-child(5)').allTextContents();
  const hasStubConcimazione = prodottoCells.some((p) => {
    const t = p.trim();
    return !t || t === '-' || t === '—';
  });
  const completaButtons = tableWrap.locator('[data-completa-row]');
  const stubActions = (await completaButtons.count()) + (hasStubConcimazione ? 1 : 0);
  expect(stubActions).toBeGreaterThanOrEqual(1);
}

/** Potatura + trattamenti fitosanitari + concimazioni (12 trattamenti seed totali). */
export async function runVignetoAssertions(page, expect) {
  await runPotaturaListAssertions(page, expect);
  await runTrattamentiListAssertions(page, expect);
  await runConcimazioniListAssertions(page, expect);
}

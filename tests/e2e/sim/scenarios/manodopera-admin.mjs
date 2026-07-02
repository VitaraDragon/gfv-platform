/**
 * Assert DOM gestione lavori + validazione ore (manager) — seed manodopera v2.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGestioneLavoriAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/gestione-lavori-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Lavori' })).toBeVisible();

  const table = page.locator('#lavori-container .lavori-table');
  await expect(table).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);

  const countText = await page.locator('#lavori-count').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(3);

  await expect(
    table.locator('.badge-assegnato, .badge-in_corso, .badge-completato').first()
  ).toBeVisible();
  expect(await table.locator('.caposquadra-name').count()).toBeGreaterThanOrEqual(1);

  const tbodyText = await table.locator('tbody').innerText();
  expect(/👥/.test(tbodyText)).toBe(true);

  const durataCells = await table.locator('tbody td').allTextContents();
  expect(durataCells.some((t) => /\d+\s+giorni/i.test(t))).toBe(true);
}

export async function runValidazioneOreAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/validazione-ore-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Validazione Ore' })).toBeVisible();

  const container = page.locator('#ore-container');
  await expect(container).toBeVisible();
  await expect(container.locator('.loading')).toHaveCount(0);

  const statDaValidare = page.locator('#stat-da-validare');
  await expect(statDaValidare).toBeVisible();
  const pendingCount = parseInt(await statDaValidare.textContent(), 10);
  expect(pendingCount).toBeGreaterThanOrEqual(2);

  const rows = container.locator('.ore-table tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(2);

  const firstRow = rows.first();
  await expect(firstRow.locator('td').nth(2)).not.toHaveText('');
  await expect(firstRow.locator('td').nth(3)).not.toHaveText('');
  await expect(firstRow.getByRole('button', { name: /Valida/i })).toBeVisible();
  const oreText = ((await firstRow.locator('td').nth(5).textContent()) || '').trim();
  expect(oreText).not.toBe('0h');
  expect(oreText.length).toBeGreaterThan(0);

  await expect(page.locator('#stat-validate')).toBeVisible();
}

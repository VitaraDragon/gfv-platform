/**
 * Assert DOM liste trattori, attrezzi, flotta — seed 1+3+4 macchine.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runTrattoriListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/trattori-list-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Trattori' })).toBeVisible();

  const table = page.locator('#table-container .mezzi-table');
  await expect(table).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(1);

  const countText = await page.locator('#count-label').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(1);

  const header = table.locator('thead tr');
  await expect(header.locator('th', { hasText: 'Ore' })).toBeVisible();
  await expect(header.locator('th', { hasText: 'Stato' })).toBeVisible();
}

export async function runAttrezziListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/attrezzi-list-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Attrezzature' })).toBeVisible();

  const table = page.locator('#table-container .mezzi-table');
  await expect(table).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);

  const countText = await page.locator('#count-label').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(3);

  await expect(table.locator('thead th', { hasText: 'CV min.' })).toBeVisible();
}

export async function runFlottaListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/flotta-list-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Flotta Aziendale' })).toBeVisible();

  const table = page.locator('#table-container .mezzi-table');
  await expect(table).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(4);

  const countText = await page.locator('#count-label').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(4);

  await expect(table.locator('thead th', { hasText: 'Km' })).toBeVisible();

  const kmCells = await table.locator('tbody td:nth-child(4)').allTextContents();
  expect(kmCells.filter((k) => /\d/.test(k)).length).toBeGreaterThanOrEqual(4);
}

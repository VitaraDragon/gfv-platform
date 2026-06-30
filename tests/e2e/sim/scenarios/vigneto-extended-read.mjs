/**
 * Assert pagine vigneto residue template viticola (statistiche, vendemmia, impianto).
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runVignetoStatisticheAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/vigneto-statistiche-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'STATISTICHE VIGNETO' })).toBeVisible();

  const filtroVigneto = page.locator('#filtro-vigneto');
  expect(await filtroVigneto.locator('option:not([value=""])').count()).toBeGreaterThanOrEqual(1);

  await expect(page.locator('#filtro-anno')).toBeVisible();
  await expect(page.locator('#alert-container')).toBeAttached();
}

export async function runVendemmiaReadAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/vendemmia-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Vendemmia' })).toBeVisible();
  await expect(page.locator('#loading')).toBeHidden();

  const tableVisible = await page.locator('#vendemmie-table').isVisible();
  const emptyVisible = await page.locator('#empty-state').isVisible();
  expect(tableVisible || emptyVisible).toBe(true);

  await expect(page.locator('#filter-vigneto')).toBeVisible();
}

export async function runCalcoloMaterialiReadAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/calcolo-materiali-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Calcolo Materiali Impianto' })).toBeVisible();

  const table = page.locator('#table-pianificazioni tbody');
  await expect(table).toBeVisible();
  const firstCell = table.locator('td').first();
  await expect(firstCell).not.toContainText('Caricamento pianificazioni');
}

export async function runPianificaImpiantoReadAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/pianifica-impianto-standalone\.html/);
  await expect(page.locator('#headerTitolo')).toContainText('Pianificazione');

  const terrenoSelect = page.locator('#terrenoSelect');
  expect(await terrenoSelect.locator('option:not([value=""])').count()).toBeGreaterThanOrEqual(1);

  await expect(page.locator('#linkDashboard')).toBeVisible();
}

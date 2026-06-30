/**
 * Assert apertura form nuovo preventivo (read — cascade clienti/tipi lavoro).
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runNuovoPreventivoReadAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/nuovo-preventivo-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Nuovo Preventivo' })).toBeVisible();

  const clienteSelect = page.locator('#cliente-id');
  expect(await clienteSelect.locator('option:not([value=""])').count()).toBeGreaterThanOrEqual(2);

  const categoriaSelect = page.locator('#lavoro-categoria-principale');
  expect(await categoriaSelect.locator('option:not([value=""])').count()).toBeGreaterThanOrEqual(1);

  await expect(page.locator('#preventivo-form')).toBeVisible();
  await expect(page.locator('#tipo-lavoro')).toBeVisible();
  await expect(page.locator('#superficie')).toBeVisible();
}

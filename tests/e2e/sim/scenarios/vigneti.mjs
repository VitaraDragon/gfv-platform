/**
 * Assert DOM anagrafica vigneti — seed 4 vigneti collegati ai terreni.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runVignetiListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/vigneti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Anagrafica Vigneti' })).toBeVisible();

  const table = page.locator('#vigneti-table');
  await expect(table).toBeVisible();

  const rows = page.locator('#vigneti-tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(4);

  const rowTexts = await rows.allTextContents();
  const varietaSeed = /Sangiovese|Merlot|Glera|Pinot Grigio|Barbera|Trebbiano/i;
  expect(rowTexts.some((t) => varietaSeed.test(t))).toBe(true);
}

/**
 * Assert DOM anagrafica frutteti — seed 4 frutteti collegati ai terreni.
 * @module tests/e2e/sim/scenarios/frutteti
 */

export async function runFruttetiListAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/frutteti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Anagrafica Frutteti' })).toBeVisible();

  const table = page.locator('#frutteti-table');
  await expect(table).toBeVisible();

  const rows = page.locator('#frutteti-table-body tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(4);

  const rowTexts = await rows.allTextContents();
  const specieSeed = /Melo|Pesco|Pero|Ciliegio|Gala|Redhaven|Ferrovia/i;
  expect(rowTexts.some((t) => specieSeed.test(t))).toBe(true);
}

/**
 * Assert dashboard frutteto — panoramica moduli operativi (M4 read).
 * @module tests/e2e/sim/scenarios/frutteto-hub
 */

export async function runFruttetoDashboardAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/frutteto-dashboard-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'FRUTTETO' })).toBeVisible();

  const statFrutteti = page.locator('#stat-numero-frutteti');
  await expect(statFrutteti).not.toHaveText('-');
  expect(parseInt(await statFrutteti.textContent(), 10)).toBeGreaterThanOrEqual(4);

  await expect(page.getByRole('link', { name: /Anagrafica Frutteti/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Potatura/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Trattamenti/i })).toBeVisible();
}

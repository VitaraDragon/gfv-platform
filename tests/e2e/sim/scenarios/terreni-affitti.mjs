/**
 * Assert DOM colonna affitti/semafori lista terreni — condiviso tra spec Playwright e runner Node.
 * Dati seed (4 affitti grey/red/yellow/green) validati da v3; assert su DOM visibile.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runTerreniAffittiAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/terreni-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Terreni' })).toBeVisible();
  await expect(page.locator('#user-info')).not.toHaveText('Caricamento...');

  const container = page.locator('#terreni-container');
  await expect(container.locator('.terreni-table')).toBeVisible();

  const rows = container.locator('.terreno-row');
  expect(await rows.count()).toBeGreaterThanOrEqual(4);

  const affittiBadges = container.locator('.col-possesso .badge-info', { hasText: 'Affitto' });
  expect(await affittiBadges.count()).toBeGreaterThanOrEqual(4);

  const greyDots = container.locator('.alert-dot-grey');
  const redDots = container.locator('.alert-dot-red');
  const yellowDots = container.locator('.alert-dot-yellow');
  const greenDots = container.locator('.alert-dot-green');

  expect(await greyDots.count()).toBeGreaterThanOrEqual(1);
  expect(await redDots.count()).toBeGreaterThanOrEqual(1);
  expect(await yellowDots.count()).toBeGreaterThanOrEqual(1);
  expect(await greenDots.count()).toBeGreaterThanOrEqual(1);

  const tooltipTitles = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#terreni-container .col-possesso [title*="Affitto"]'))
      .map((el) => el.getAttribute('title') || '')
  );
  const hasAffittoTooltip = tooltipTitles.some((t) =>
    /Scaduto|Scade tra|Scade il/i.test(t || '')
  );
  expect(hasAffittoTooltip).toBe(true);

  await expect(container.getByText(/I Tuoi Terreni \(\d+/)).toBeVisible();
}

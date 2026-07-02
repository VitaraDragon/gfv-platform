/**
 * Assert hub conto terzi + mappa clienti (select anagrafiche, senza Google Maps).
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runContoTerziHomeAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/conto-terzi-home-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'CONTO TERZI' })).toBeVisible();

  const statClienti = page.locator('#stat-clienti');
  await expect(statClienti).not.toHaveText('-');
  // Seed: 3 clienti totali, ultimo in stato sospeso → 2 attivi in hub/mappa
  expect(parseInt(await statClienti.textContent(), 10)).toBeGreaterThanOrEqual(2);

  await page.waitForFunction(() => {
    const ids = ['stat-lavori', 'stat-lavori-completati', 'stat-preventivi', 'stat-terreni'];
    return ids.every((id) => {
      const el = document.getElementById(id);
      if (!el) return false;
      const t = (el.textContent || '').trim();
      return t !== '-' && t !== '…' && !Number.isNaN(parseInt(t, 10));
    });
  }, { timeout: 60_000 });

  expect(parseInt(await page.locator('#stat-lavori').textContent(), 10)).toBeGreaterThanOrEqual(0);
  expect(parseInt(await page.locator('#stat-preventivi').textContent(), 10)).toBeGreaterThanOrEqual(1);
  expect(parseInt(await page.locator('#stat-terreni').textContent(), 10)).toBeGreaterThanOrEqual(1);

  await expect(page.getByRole('link', { name: /Anagrafica Clienti/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Preventivi/i }).first()).toBeVisible();
}

export async function runMappaClientiAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/mappa-clienti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Mappa Clienti' })).toBeVisible();

  const select = page.locator('#select-cliente');
  await page.waitForFunction(() => {
    const el = document.getElementById('select-cliente');
    return el && el.querySelectorAll('option:not([value=""])').length >= 2;
  }, { timeout: 90_000 });

  expect(await select.locator('option:not([value=""])').count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#mappa-container')).toBeVisible();
}

/**
 * Il login vero (form, non pagina dev) resta qui: i casi sulla query
 * sono in tests/auth-form-query-guard.test.js.
 */
import { test, expect } from './helpers/gfv-test.js';
import { DEFAULT_VITICOLA_E2E_TEMPLATE, pickManifestEntry } from './helpers/sim-login.js';

function assertClean(url) {
  const q = new URL(url).searchParams;
  expect(q.has('email')).toBe(false);
  expect(q.has('password')).toBe(false);
}

test.describe('GFV auth — login form senza segreti in query', () => {
  test('login con credenziali del seed arriva in dashboard senza segreti in query', async ({ page }) => {
    test.skip(!process.env.CI && process.env.GFV_AUTH_LOGIN_E2E !== '1', 'Richiede emulator e manifest del job sim:e2e');
    await page.goto('/core/auth/login-standalone.html?emulator=1');
    const entry = await pickManifestEntry(page, {
      preferTemplateId: DEFAULT_VITICOLA_E2E_TEMPLATE,
      preferSeedComplete: true,
    });
    await expect(page.locator('#login-button')).toBeEnabled({ timeout: 30000 });
    await page.fill('#email', entry.email);
    await page.fill('#password', 'SimGFV2026!');
    await page.click('#login-button');

    const selector = page.locator('.tenant-selector-item').first();
    await Promise.race([
      page.waitForURL(/dashboard-standalone\.html/, { timeout: 60000 }),
      selector.waitFor({ state: 'visible', timeout: 60000 }),
    ]);
    if (await selector.isVisible()) {
      await selector.click();
      await page.waitForURL(/dashboard-standalone\.html/, { timeout: 60000 });
    }
    assertClean(page.url());
    expect(page.url()).not.toContain('SimGFV2026');
  });
});

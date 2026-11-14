/**
 * Smoke: il login dalla pagina dev arriva in dashboard.
 * Gli altri test usano il login diretto.
 */
import { test, expect } from './helpers/gfv-test.js';
import { loginAsManagerFromDevPage } from './helpers/sim-login.js';

test.describe('Smoke login pagina dev', () => {
  test('login dev, poi dashboard', async ({ page, tenantEntry }) => {
    const slotRaw = process.env.TEST_PARALLEL_INDEX;
    const slot = slotRaw === undefined || slotRaw === '' ? 0 : Number(slotRaw);
    expect(Number(tenantEntry.slot ?? 0)).toBe(slot);
    expect(tenantEntry.email).toBeTruthy();
    await loginAsManagerFromDevPage(page, { viaDevPage: true });
    await expect(page).toHaveURL(/dashboard-standalone\.html/);
    await expect(page.locator('h1').first()).toBeVisible();
  });
});

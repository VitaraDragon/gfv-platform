/**
 * E2E read — vendemmia stub da lavoro (catena A §11.3.12 scen. 49).
 * Assert link lavoro + badge incompleta (seed) o completa (dopo scen. 52 idempotente).
 * @module tests/e2e/sim/scenarios/vendemmia-auto-read
 */

import { gotoVendemmia, loginAsManagerManodopera } from '../helpers/sim-login.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runVendemmiaAutoReadAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await loginAsManagerManodopera(page);
  await gotoVendemmia(page);

  await expect(page.locator('#empty-state')).toBeHidden();
  const table = page.locator('#vendemmie-table');
  await expect(table).toBeVisible();

  const fromLavoro = page.locator('#vendemmie-table tbody tr').filter({
    has: page.locator('.link-lavoro'),
  });
  expect(await fromLavoro.count()).toBeGreaterThanOrEqual(1);

  const first = fromLavoro.first();
  await expect(first.locator('.link-lavoro')).toContainText(/Vedi Lavoro/i);

  const hasIncompleta = (await first.locator('.badge-incompleta').count()) > 0;
  const hasCompleta = (await first.locator('.badge-completa').count()) > 0;
  expect(hasIncompleta || hasCompleta).toBe(true);

  if (hasIncompleta) {
    await expect(first.locator('td').nth(3)).toHaveText('-');
    await expect(first.locator('td').nth(6)).toContainText(/Vino|Vendita|—|-\s*$/i);
  }

  await expect(page.locator('#filter-vigneto')).toBeVisible();
}

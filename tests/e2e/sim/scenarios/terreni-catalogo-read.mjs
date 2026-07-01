/**
 * E2E read — catalogo terreni coltura/podere/ettari (§11.3 scen. 48).
 * Complementare a terreni-affitti (scen. 3): focus anagrafica, non semafori affitto.
 * @module tests/e2e/sim/scenarios/terreni-catalogo-read
 */

import { gotoTerreniList, loginAsManagerFromDevPage } from '../helpers/sim-login.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runTerreniCatalogoReadAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await loginAsManagerFromDevPage(page);
  await gotoTerreniList(page);

  await expect(page.locator('h1').filter({ hasText: 'Terreni' })).toBeVisible();

  const header = page.locator('#terreni-container .terreni-header');
  await expect(header.locator('.col-coltura')).toContainText('Coltura');
  await expect(header.locator('.col-podere')).toContainText('Podere');
  await expect(header.locator('.col-ettari')).toContainText('Ha');

  const rows = page.locator('#terreni-container .terreno-row');
  expect(await rows.count()).toBeGreaterThanOrEqual(4);

  const colture = await rows.locator('.col-coltura .terreno-coltura').allTextContents();
  expect(colture.filter((c) => c.trim() && c.trim() !== '-').length).toBeGreaterThanOrEqual(3);
  expect(colture.some((c) => /vite|vino|uva/i.test(c))).toBe(true);

  const poderi = await rows.locator('.col-podere .terreno-podere').allTextContents();
  expect(poderi.filter((p) => p.trim() && p.trim() !== '-').length).toBeGreaterThanOrEqual(2);

  const ettari = await rows.locator('.col-ettari .terreno-ettari').allTextContents();
  const haValues = ettari
    .map((t) => parseFloat((t || '').replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0);
  expect(haValues.length).toBeGreaterThanOrEqual(4);
}

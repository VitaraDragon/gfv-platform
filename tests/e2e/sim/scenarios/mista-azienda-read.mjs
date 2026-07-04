/**
 * Read E2E tenant misto — vigneto + frutteto + conto terzi sulla stessa azienda.
 * @module tests/e2e/sim/scenarios/mista-azienda-read
 */

import {
  gotoClientiList,
  gotoFruttetiList,
  gotoTerreniList,
  gotoVignetiList,
  loginAsManagerMisto,
} from '../helpers/sim-login.js';
import { runClientiListAssertions } from './conto-terzi.mjs';

const MIN_VIGNETI = 3;
const MIN_FRUTTETI = 3;
const MIN_TERRENI_AZIENDA = 6;

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runMistaAziendaReadAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerMisto(page);

  await gotoVignetiList(page, { minRows: 3 });
  await expect(page.locator('h1').filter({ hasText: 'Anagrafica Vigneti' })).toBeVisible();
  expect(await page.locator('#vigneti-tbody tr').count()).toBeGreaterThanOrEqual(MIN_VIGNETI);

  await gotoFruttetiList(page, { minRows: 3 });
  await expect(page.locator('h1').filter({ hasText: 'Anagrafica Frutteti' })).toBeVisible();
  expect(await page.locator('#frutteti-table-body tr').count()).toBeGreaterThanOrEqual(MIN_FRUTTETI);

  await gotoTerreniList(page);
  const container = page.locator('#terreni-container');
  await expect(container.locator('.terreni-table')).toBeVisible();
  const terreniRows = container.locator('.terreno-row');
  expect(await terreniRows.count()).toBeGreaterThanOrEqual(MIN_TERRENI_AZIENDA);
  const terreniText = (await terreniRows.allTextContents()).join(' ');
  expect(/Vite|Melo|Pesco|Pero/i.test(terreniText)).toBe(true);

  await gotoClientiList(page);
  await runClientiListAssertions(page, expect);
}

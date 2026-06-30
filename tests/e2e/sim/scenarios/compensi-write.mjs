/**
 * E2E write — calcolo compensi dopo ore validate (flusso business manodopera).
 * Idempotente: valida ore marker se necessario, poi assert righe compensi mese corrente.
 * @module tests/e2e/sim/scenarios/compensi-write
 */

import { gotoCompensiOperai, loginAsManagerManodopera } from '../helpers/sim-login.js';
import { runValidazioneOreWriteAssertions } from './validazione-ore-write.mjs';

/**
 * @param {import('playwright-core').Page} page
 */
async function compensiHaveRows(page) {
  return page.waitForFunction(() => {
    const tbody = document.getElementById('compensi-body');
    if (!tbody || tbody.querySelector('.loading')) return false;
    if (tbody.querySelector('.empty-state')) return false;
    return tbody.querySelectorAll('tr').length >= 1;
  }, { timeout: 8_000 }).then(() => true).catch(() => false);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runCompensiWriteAssertions(page, expect) {
  expect.configure({ timeout: 120_000 });

  await loginAsManagerManodopera(page);
  await gotoCompensiOperai(page);
  await page.locator('#filter-periodo').selectOption('mese');
  await page.getByRole('button', { name: 'Aggiorna' }).click();

  if (!(await compensiHaveRows(page))) {
    await runValidazioneOreWriteAssertions(page, expect);
    await gotoCompensiOperai(page);
    await page.locator('#filter-periodo').selectOption('mese');
    await page.getByRole('button', { name: 'Aggiorna' }).click();
  }

  await page.waitForFunction(() => {
    const tbody = document.getElementById('compensi-body');
    return tbody && !tbody.querySelector('.loading') && !tbody.querySelector('.empty-state');
  }, { timeout: 90_000 });

  const statOperai = page.locator('#stat-operai-compensati');
  await expect(statOperai).not.toHaveText('-');
  expect(parseInt(await statOperai.textContent(), 10)).toBeGreaterThanOrEqual(1);

  const statOre = page.locator('#stat-ore-compensate');
  await expect(statOre).not.toHaveText('-');

  expect(await page.locator('#compensi-body tr').count()).toBeGreaterThanOrEqual(1);
}

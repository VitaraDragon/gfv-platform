/**
 * E2E write — caposquadra segna ore da segnatura-ore-standalone (desktop).
 * Idempotente: marker note + orari 09:00–11:00; verifica in validazione ore manager.
 * @module tests/e2e/sim/scenarios/segnatura-ore-write
 */

import {
  gotoSegnaturaOre,
  gotoValidazioneOre,
  loginAsCapoFromDevPage,
  loginAsManagerManodopera,
} from '../helpers/sim-login.js';

export const E2E_SEGNATURA_ORE_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_ORE_CAPO';

const ORA_START = '09:00';
const ORA_END = '11:00';

/**
 * @param {import('playwright-core').Page} page
 */
function validazioneRowWithMarker(page) {
  return page
    .locator('#ore-container .ore-table tbody tr')
    .filter({ hasText: E2E_SEGNATURA_ORE_WRITE_NOTE });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function createOraAsCapo(page) {
  await loginAsCapoFromDevPage(page, { waitForWorkspace: false });
  await gotoSegnaturaOre(page);

  await page.getByRole('button', { name: /Segna Nuova Ora/i }).click();
  await page.locator('#ora-modal.active').waitFor({
    state: 'visible',
    timeout: 30_000,
  });

  await page.waitForFunction(() => {
    const sel = document.getElementById('ora-lavoro');
    return sel && sel.querySelectorAll('option:not([value=""])').length >= 1;
  }, { timeout: 60_000 });

  const lavoroSelect = page.locator('#ora-lavoro');
  const firstValue = await lavoroSelect.locator('option:not([value=""])').first().getAttribute('value');
  await lavoroSelect.selectOption(firstValue || { index: 1 });

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  await page.locator('#ora-data').fill(today);
  await page.locator('#ora-inizio').fill(ORA_START);
  await page.locator('#ora-fine').fill(ORA_END);
  await page.locator('#ora-pause').fill('0');
  await page.locator('#ora-note').fill(E2E_SEGNATURA_ORE_WRITE_NOTE);

  await page.locator('#ora-form button[type="submit"]').click();

  await page.waitForFunction(() => {
    const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert, #alert-container .alert-success');
    return Array.from(toasts).some((t) => /Ora segnata con successo/i.test(t.textContent || ''));
  }, { timeout: 60_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runSegnaturaOreWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerManodopera(page);
  await gotoValidazioneOre(page);

  if ((await validazioneRowWithMarker(page).count()) === 0) {
    await createOraAsCapo(page);
    await loginAsManagerManodopera(page);
    await gotoValidazioneOre(page);
  }

  const row = validazioneRowWithMarker(page).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await expect(row).toContainText(E2E_SEGNATURA_ORE_WRITE_NOTE);
  await expect(row).toContainText(`${ORA_START} - ${ORA_END}`);
}

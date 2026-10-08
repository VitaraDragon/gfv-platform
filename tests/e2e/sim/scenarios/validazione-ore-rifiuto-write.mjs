/**
 * E2E write — il manager rifiuta una riga in coda dalla pagina Validazione ore.
 * Fascia 22:00–22:45: libera rispetto al seed 07:30–12:00 e agli altri write
 * (14–16, 16–17:30 poi cancellata, 19–20 lasciata da validare da ore-modifica-annullo, 20:30–21:30).
 * @module tests/e2e/sim/scenarios/validazione-ore-rifiuto-write
 */

import {
  gotoFieldWorkspace,
  gotoValidazioneOre,
  loginAsManagerManodopera,
  loginAsOperaioFromDevPage,
} from '../helpers/sim-login.js';

export const E2E_ORE_RIFIUTO_VALIDAZIONE_NOTE = 'GFV_SIM_E2E_RIFIUTO_VALIDAZIONE';
const ORA_START = '22:00';
const ORA_END = '22:45';
const MOTIVO = 'Orario da rifare';

/**
 * @param {import('playwright-core').Page} page
 */
function codaRowWithMarker(page) {
  return page
    .locator('#ore-container .ore-table tbody tr')
    .filter({ hasText: E2E_ORE_RIFIUTO_VALIDAZIONE_NOTE });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function selectFirstAssignedWork(page) {
  const select = page.locator('#selected-work');
  await select.waitFor({ state: 'attached', timeout: 30_000 });
  const optionCount = await select.locator('option').count();
  if (optionCount < 2) {
    throw new Error('Nessun lavoro assegnato nel field workspace operaio');
  }
  await select.selectOption({ index: 1 });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function goToSegnaOreSlide(page) {
  await page.evaluate(() => {
    if (typeof window.gfvFieldWorkspaceGoToHoursSlide === 'function') {
      window.gfvFieldWorkspaceGoToHoursSlide();
    }
  });
  await page.locator('#quick-hours-form').waitFor({ state: 'attached', timeout: 30_000 });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function fillAndSubmitQuickHours(page) {
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  await page.locator('#ora-data').fill(today);
  await page.locator('#ora-start').fill(ORA_START);
  await page.locator('#ora-end').fill(ORA_END);
  await page.locator('#ora-break').fill('0');
  await page.locator('#ora-note').fill(E2E_ORE_RIFIUTO_VALIDAZIONE_NOTE);

  await page.evaluate(() => {
    if (typeof window.gfvFieldWorkspaceRecalcHours === 'function') {
      window.gfvFieldWorkspaceRecalcHours();
    }
    const status = document.getElementById('hours-save-status');
    if (status) status.textContent = '';
  });

  await page.locator('#quick-hours-form button[type="submit"]').click();
  const overlap = page.locator('#ore-sovrapposizione-msg');
  if (await overlap.isVisible()) {
    const testo = ((await overlap.textContent()) || '').trim();
    throw new Error('orario del test già occupato: ' + testo);
  }
  await page.locator('#hours-save-status').filter({ hasText: /Ore salvate:/i }).waitFor({
    timeout: 45_000,
  });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runValidazioneOreRifiutoAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsOperaioFromDevPage(page, { waitForWorkspace: false });
  await gotoFieldWorkspace(page);
  await selectFirstAssignedWork(page);
  await goToSegnaOreSlide(page);
  await fillAndSubmitQuickHours(page);

  await loginAsManagerManodopera(page);
  await gotoValidazioneOre(page);

  const row = codaRowWithMarker(page);
  await expect(row).toHaveCount(1);

  await row.getByRole('button', { name: '❌ Rifiuta' }).click();
  await page.locator('#rifiuta-motivo').fill(MOTIVO);
  await page.locator('#rifiuta-form button[type="submit"]').click();

  await expect(page.locator('#gfv-standalone-toast-layer .alert').filter({ hasText: 'Ora rifiutata' })).toBeVisible();
  await expect(codaRowWithMarker(page)).toHaveCount(0);
}

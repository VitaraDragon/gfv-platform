/**
 * E2E — il caposquadra rifiuta dal telefono una riga marker, con motivo obbligatorio.
 * La riga esce dalla coda «Valida ore». Fascia 20:30–21:30: non incrocia il seed 07:30–12:00
 * né le altre ore e2e dello stesso giro.
 * @module tests/e2e/sim/scenarios/field-workspace-rifiuto
 */

import {
  gotoFieldWorkspace,
  loginAsCapoFromDevPage,
  loginAsOperaioFromDevPage,
} from '../helpers/sim-login.js';

export const E2E_ORE_RIFIUTO_NOTE = 'GFV_SIM_E2E_RIFIUTO_ORE';
export const E2E_ORE_RIFIUTO_MOTIVO = 'Prova rifiuto e2e';

const ORA_START = '20:30';
const ORA_END = '21:30';
const ORA_LABEL = `${ORA_START} - ${ORA_END}`;

/**
 * @param {import('playwright-core').Page} page
 */
async function selectSquadWork(page) {
  const select = page.locator('#selected-work');
  await select.waitFor({ state: 'attached', timeout: 30_000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('selected-work');
    if (!el) return false;
    return Array.from(el.options).some((opt) => /squadra/i.test(opt.textContent || ''));
  }, { timeout: 30_000 });
  const value = await select.evaluate((el) => {
    const opt = Array.from(el.options).find((o) => /squadra/i.test(o.textContent || ''));
    return opt ? opt.value : '';
  });
  if (!value) throw new Error('Nessun lavoro di squadra nel field workspace operaio');
  await select.selectOption(value);
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
async function goToValidaOreSlide(page) {
  await page.evaluate(() => {
    if (typeof window.gfvFieldWorkspaceGoToSlide === 'function') {
      window.gfvFieldWorkspaceGoToSlide('valida-ore');
    }
  });
  await page.locator('#pending-hours-all-list').waitFor({ state: 'attached', timeout: 30_000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('pending-hours-all-list');
    const text = (el && el.textContent) || '';
    return text.length > 0 && !/Caricamento ore da validare/i.test(text);
  }, { timeout: 45_000 });
}

/**
 * @param {import('playwright-core').Page} page
 */
function pendingRowWithMarker(page) {
  return page.locator('#pending-hours-all-list .inline-item').filter({ hasText: ORA_LABEL });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function saveMarkerHours(page) {
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.locator('#ora-data').fill(today);
  await page.locator('#ora-start').fill(ORA_START);
  await page.locator('#ora-end').fill(ORA_END);
  await page.locator('#ora-break').fill('0');
  await page.locator('#ora-note').fill(E2E_ORE_RIFIUTO_NOTE);
  await page.evaluate(() => {
    const status = document.getElementById('hours-save-status');
    if (status) status.textContent = '';
    if (typeof window.gfvFieldWorkspaceRecalcHours === 'function') {
      window.gfvFieldWorkspaceRecalcHours();
    }
  });
  await page.waitForFunction(() => {
    const el = document.getElementById('ora-net-hours');
    return el && /1h/i.test(el.textContent || '');
  }, { timeout: 10_000 });
  await page.locator('#quick-hours-form button[type="submit"]').click();
  await page.locator('#hours-save-status').filter({ hasText: /Ore salvate:/i }).waitFor({
    timeout: 45_000,
  });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runFieldWorkspaceRifiutoAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsOperaioFromDevPage(page, { waitForWorkspace: false });
  await gotoFieldWorkspace(page);
  await selectSquadWork(page);
  await goToSegnaOreSlide(page);
  await saveMarkerHours(page);

  await loginAsCapoFromDevPage(page);
  await goToValidaOreSlide(page);

  const row = pendingRowWithMarker(page);
  await expect(row).toHaveCount(1);

  page.once('dialog', async (dialog) => {
    await dialog.accept(E2E_ORE_RIFIUTO_MOTIVO);
  });
  await row.locator('[data-reject-hour-id]').click();

  await expect(page.locator('#gfv-standalone-toast-layer .alert').filter({ hasText: 'Ora rifiutata' })).toBeVisible();
  await expect(pendingRowWithMarker(page)).toHaveCount(0);
}

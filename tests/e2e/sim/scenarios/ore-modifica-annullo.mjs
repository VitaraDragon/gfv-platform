/**
 * E2E — operaio modifica ed elimina una propria riga in attesa;
 * manager valida e poi annulla la validazione.
 * Fasce 05:00–06:00 e 06:00–07:00: non coincidono con i marker 09–11 e 14–16.
 * @module tests/e2e/sim/scenarios/ore-modifica-annullo
 */

import {
  gotoFieldWorkspace,
  gotoValidazioneOre,
  loginAsManagerManodopera,
  loginAsOperaioFromDevPage,
} from '../helpers/sim-login.js';

const NOTE_EDIT = 'GFV_SIM_E2E_ORE_MODIFICA';
const NOTE_ANNULLA = 'GFV_SIM_E2E_ORE_ANNULLA';

async function todayIso(page) {
  return page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

async function selectFirstWork(page) {
  const select = page.locator('#selected-work');
  await select.waitFor({ state: 'attached', timeout: 30_000 });
  await select.selectOption({ index: 1 });
}

async function goToHours(page) {
  await page.evaluate(() => {
    if (typeof window.gfvFieldWorkspaceGoToHoursSlide === 'function') {
      window.gfvFieldWorkspaceGoToHoursSlide();
    }
  });
  await page.locator('#quick-hours-form').waitFor({ state: 'attached', timeout: 30_000 });
}

async function saveHours(page, { start, end, note }) {
  await page.locator('#ora-data').fill(await todayIso(page));
  await page.locator('#ora-start').fill(start);
  await page.locator('#ora-end').fill(end);
  await page.locator('#ora-break').fill('0');
  await page.locator('#ora-note').fill(note);
  await page.evaluate(() => {
    const status = document.getElementById('hours-save-status');
    if (status) status.textContent = '';
    if (typeof window.gfvFieldWorkspaceRecalcHours === 'function') {
      window.gfvFieldWorkspaceRecalcHours();
    }
  });
  await page.locator('#quick-hours-form button[type="submit"]').click();
  await page.locator('#hours-save-status').filter({ hasText: /Ore salvate:/i }).waitFor({ timeout: 45_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runOreModificaAnnulloAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsOperaioFromDevPage(page, { waitForWorkspace: false });
  await gotoFieldWorkspace(page);
  await selectFirstWork(page);
  await goToHours(page);
  await saveHours(page, { start: '16:00', end: '17:00', note: NOTE_EDIT });
  await page.locator('#ore-giorno-riepilogo[data-state="ready"]').waitFor();
  const riga = page.locator('#ore-giorno-riepilogo div').filter({ hasText: '16:00–17:00' }).first();
  await expect(riga).toBeVisible();
  await riga.locator('[data-modifica-ora]').click();
  await expect(page.locator('#quick-hours-form button[type="submit"]')).toHaveText(/Salva modifiche/);
  await page.locator('#ora-end').fill('17:30');
  await page.evaluate(() => {
    const status = document.getElementById('hours-save-status');
    if (status) status.textContent = '';
  });
  await page.locator('#quick-hours-form button[type="submit"]').click();
  await page.locator('#hours-save-status').filter({ hasText: /Ore salvate:/i }).waitFor({ timeout: 45_000 });
  await expect(page.locator('#ore-giorno-riepilogo')).toContainText('17:30');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#ore-giorno-riepilogo div').filter({ hasText: '16:00–17:30' }).locator('[data-elimina-ora]').first().click();
  await expect(page.locator('#ore-giorno-riepilogo')).not.toContainText('16:00–17:30');

  await saveHours(page, { start: '19:00', end: '20:00', note: NOTE_ANNULLA });
  await expect(page.locator('#ore-giorno-riepilogo')).toContainText('19:00–20:00');

  await loginAsManagerManodopera(page);
  await gotoValidazioneOre(page);
  const coda = page.locator('#ore-container .ore-table tbody tr').filter({ hasText: NOTE_ANNULLA });
  await expect(coda.first()).toBeVisible({ timeout: 60_000 });
  await coda.first().getByRole('button', { name: '✅ Valida' }).click();
  await expect(coda).toHaveCount(0);

  const archivio = page.locator('#ore-validate-container').filter({ hasText: NOTE_ANNULLA });
  await expect(archivio).toBeVisible({ timeout: 60_000 });
  await page.locator('#ore-validate-container tr').filter({ hasText: '19:00 - 20:00' }).getByRole('button', { name: 'Annulla validazione' }).click();
  await page.locator('#azione-ore-motivo').fill('Prova annullo e2e');
  await page.locator('#azione-ore-form button[type="submit"]').click();

  await expect(page.locator('#ore-container .ore-table tbody tr').filter({ hasText: NOTE_ANNULLA })).toBeVisible({ timeout: 60_000 });
}

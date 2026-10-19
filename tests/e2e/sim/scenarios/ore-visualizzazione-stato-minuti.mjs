/**
 * E2E — riga rifiutata, poi modificata, poi validata.
 * Validazione ore mostra lo stato attuale in testa.
 * Il tab Ore del lavoro mostra i 20 minuti, non 0h.
 * Fascia 03:00–03:20: non incrocia il seed 07:30–12:00 né le altre ore e2e.
 * @module tests/e2e/sim/scenarios/ore-visualizzazione-stato-minuti
 */

import {
  gotoFieldWorkspace,
  gotoGestioneLavori,
  gotoValidazioneOre,
  loginAsManagerManodopera,
  loginAsOperaioFromDevPage,
} from '../helpers/sim-login.js';

const NOTE = 'GFV_SIM_E2E_ORE_STATO_MINUTI';
const ORA_START = '03:00';
const ORA_END = '03:20';
const MOTIVO = 'Orario da correggere';

async function todayIso(page) {
  return page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

async function selectWork(page, lavoroId) {
  const select = page.locator('#selected-work');
  await select.waitFor({ state: 'attached', timeout: 30_000 });
  if (lavoroId) {
    await select.selectOption(lavoroId);
    return lavoroId;
  }
  const optionCount = await select.locator('option').count();
  if (optionCount < 2) throw new Error('Nessun lavoro assegnato nel field workspace operaio');
  await select.selectOption({ index: 1 });
  return select.inputValue();
}

async function goToHours(page) {
  await page.evaluate(() => {
    if (typeof window.gfvFieldWorkspaceGoToHoursSlide === 'function') {
      window.gfvFieldWorkspaceGoToHoursSlide();
    }
  });
  await page.locator('#quick-hours-form').waitFor({ state: 'attached', timeout: 30_000 });
}

async function saveHours(page) {
  await page.locator('#ora-data').fill(await todayIso(page));
  await page.locator('#ora-start').fill(ORA_START);
  await page.locator('#ora-end').fill(ORA_END);
  await page.locator('#ora-break').fill('0');
  await page.locator('#ora-note').fill(NOTE);
  await page.evaluate(() => {
    const status = document.getElementById('hours-save-status');
    if (status) status.textContent = '';
    if (typeof window.gfvFieldWorkspaceRecalcHours === 'function') {
      window.gfvFieldWorkspaceRecalcHours();
    }
  });
  const overlap = page.locator('#ore-sovrapposizione-msg');
  await page.locator('#quick-hours-form button[type="submit"]').click();
  if (await overlap.isVisible()) {
    const testo = ((await overlap.textContent()) || '').trim();
    throw new Error('orario del test già occupato: ' + testo);
  }
  await page.locator('#hours-save-status').filter({ hasText: /Ore salvate:/i }).waitFor({ timeout: 45_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runOreVisualizzazioneStatoMinutiAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsOperaioFromDevPage(page, { waitForWorkspace: false });
  await gotoFieldWorkspace(page);
  const lavoroId = await selectWork(page);
  await goToHours(page);
  await saveHours(page);

  await loginAsManagerManodopera(page);
  await gotoValidazioneOre(page);
  const coda = page.locator('#ore-container .ore-table tbody tr').filter({ hasText: NOTE });
  await expect(coda).toHaveCount(1);
  await coda.getByRole('button', { name: '❌ Rifiuta' }).click();
  await page.locator('#rifiuta-motivo').fill(MOTIVO);
  await page.locator('#rifiuta-form button[type="submit"]').click();
  await expect(page.locator('#gfv-standalone-toast-layer .alert').filter({ hasText: 'Ora rifiutata' })).toBeVisible();
  await expect(coda).toHaveCount(0);

  await loginAsOperaioFromDevPage(page, { waitForWorkspace: false });
  await gotoFieldWorkspace(page);
  await selectWork(page, lavoroId);
  await goToHours(page);
  await page.locator('#ore-giorno-riepilogo[data-state="ready"]').waitFor({ timeout: 45_000 });
  const rigaRifiutata = page.locator('#ore-giorno-riepilogo div').filter({ hasText: `${ORA_START}–${ORA_END}` }).first();
  await expect(rigaRifiutata).toBeVisible();
  await rigaRifiutata.locator('[data-modifica-ora]').click();
  await expect(page.locator('#quick-hours-form button[type="submit"]')).toHaveText(/Salva modifiche/);
  await page.evaluate(() => {
    const status = document.getElementById('hours-save-status');
    if (status) status.textContent = '';
  });
  await page.locator('#quick-hours-form button[type="submit"]').click();
  await page.locator('#hours-save-status').filter({ hasText: /Ore salvate:/i }).waitFor({ timeout: 45_000 });

  await loginAsManagerManodopera(page);
  await gotoValidazioneOre(page);
  const daValidare = page.locator('#ore-container .ore-table tbody tr').filter({ hasText: NOTE });
  await expect(daValidare).toHaveCount(1);
  await daValidare.getByRole('button', { name: '✅ Valida' }).click();
  await expect(daValidare).toHaveCount(0);

  const archivio = page.locator('#ore-validate-container tr').filter({ hasText: NOTE });
  await expect(archivio).toBeVisible({ timeout: 60_000 });
  const stato = ((await archivio.locator('td').nth(7).innerText()) || '').replace(/\s+/g, ' ').trim();
  expect(stato.startsWith('Validata')).toBe(true);

  await gotoGestioneLavori(page);
  await page.locator(`#lavori-container button[onclick="openDettaglioModal('${lavoroId}')"]`).click();
  await page.locator('#dettaglio-modal.active').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('dettaglio-overview-content');
    if (!el) return false;
    const testo = el.textContent || '';
    return testo.length > 0 && !/Caricamento dettagli/.test(testo);
  }, { timeout: 60_000 });
  await page.locator('#dettaglio-modal button.modal-tab').filter({ hasText: 'Ore' }).click();
  await page.waitForFunction(() => {
    const el = document.getElementById('dettaglio-ore-content');
    if (!el) return false;
    const testo = el.textContent || '';
    return /Ore Validate/.test(testo) && !/Caricamento/.test(testo);
  }, { timeout: 60_000 });
  await expect(
    page.locator('#dettaglio-ore-content span[style*="2E8B57"]').filter({ hasText: '20min' })
  ).toBeVisible();
  await expect(
    page.locator('#dettaglio-ore-content .ore-stat-card').filter({ hasText: 'Ore Validate' }).locator('.ore-stat-value')
  ).toContainText('20min');
}

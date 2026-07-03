/**
 * E2E write — salva scheda competenze operaio (nota profilo) da Gestione Operai.
 * Idempotente: marker in #scheda-nota; evita validazione contratto su seed senza tipoContratto.
 * @module tests/e2e/sim/scenarios/operai-write
 */

import { gotoGestioneOperai, loginAsManagerManodopera } from '../helpers/sim-login.js';

export const E2E_OPERAI_WRITE_NOTE = 'GFV SIM E2E WRITE CONTRATTO';

/**
 * @param {import('playwright-core').Page} page
 */
async function openFirstSchedaModal(page) {
  const firstRow = page.locator('#operai-container .operai-table tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 60_000 });
  await firstRow.getByRole('button', { name: /Scheda/i }).click();
  await page.locator('#scheda-modal.active').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => {
    const form = document.getElementById('scheda-form');
    return form && form.style.display !== 'none';
  }, { timeout: 60_000 });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function closeSchedaModal(page) {
  await page.locator('#scheda-modal .close-btn').click();
  await page.waitForFunction(() => {
    const modal = document.getElementById('scheda-modal');
    return modal && !modal.classList.contains('active');
  }, { timeout: 15_000 });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function saveSchedaNoteIfNeeded(page) {
  const noteField = page.locator('#scheda-nota');
  const current = (await noteField.inputValue()) || '';
  if (current.includes(E2E_OPERAI_WRITE_NOTE)) {
    await closeSchedaModal(page);
    return;
  }

  await noteField.fill(E2E_OPERAI_WRITE_NOTE);
  await page.locator('#scheda-form button[type="submit"]').click();

  await page.waitForFunction(
    () => {
      const modal = document.getElementById('scheda-modal');
      return modal && !modal.classList.contains('active');
    },
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runOperaiWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerManodopera(page);
  await gotoGestioneOperai(page);

  await openFirstSchedaModal(page);
  await saveSchedaNoteIfNeeded(page);

  await openFirstSchedaModal(page);
  const savedNote = await page.locator('#scheda-nota').inputValue();
  expect(savedNote).toContain(E2E_OPERAI_WRITE_NOTE);
  await closeSchedaModal(page);

  expect(await page.locator('#operai-container .operai-table tbody tr').count()).toBeGreaterThanOrEqual(3);
}

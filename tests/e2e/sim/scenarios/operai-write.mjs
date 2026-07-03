/**
 * E2E write — aggiorna contratto operaio (note) da Gestione Operai.
 * Idempotente: marker in note-contratto; riapre modal per verifica.
 * @module tests/e2e/sim/scenarios/operai-write
 */

import { gotoGestioneOperai, loginAsManagerManodopera } from '../helpers/sim-login.js';

export const E2E_OPERAI_WRITE_NOTE = 'GFV SIM E2E WRITE CONTRATTO';

/**
 * @param {import('playwright-core').Page} page
 */
async function openFirstContrattoModal(page) {
  const firstRow = page.locator('#operai-container .operai-table tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 60_000 });
  await firstRow.getByRole('button', { name: /Contratto/i }).click();
  await page.locator('#contratto-modal.active').waitFor({ state: 'visible', timeout: 30_000 });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function closeContrattoModal(page) {
  await page.locator('#contratto-modal .close-btn').click();
  await page.locator('#contratto-modal.active').waitFor({ state: 'hidden', timeout: 15_000 });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function saveContrattoNoteIfNeeded(page) {
  const noteField = page.locator('#note-contratto');
  const current = (await noteField.inputValue()) || '';
  if (current.includes(E2E_OPERAI_WRITE_NOTE)) {
    await closeContrattoModal(page);
    return;
  }

  await noteField.fill(E2E_OPERAI_WRITE_NOTE);
  await page.locator('#contratto-form button[type="submit"]').click();

  await page.waitForFunction(
    () => {
      const modal = document.getElementById('contratto-modal');
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

  await openFirstContrattoModal(page);
  await saveContrattoNoteIfNeeded(page);

  await openFirstContrattoModal(page);
  const savedNote = await page.locator('#note-contratto').inputValue();
  expect(savedNote).toContain(E2E_OPERAI_WRITE_NOTE);
  await closeContrattoModal(page);

  expect(await page.locator('#operai-container .operai-table tbody tr').count()).toBeGreaterThanOrEqual(3);
}

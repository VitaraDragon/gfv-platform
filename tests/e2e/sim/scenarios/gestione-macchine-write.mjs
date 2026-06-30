/**
 * E2E write — nuova macchina trattore in gestione-macchine admin.
 * Idempotente: nome marker distintivo in tabella.
 * @module tests/e2e/sim/scenarios/gestione-macchine-write
 */

import { gotoGestioneMacchine, loginAsManagerFromDevPage } from '../helpers/sim-login.js';

export const E2E_MACCHINA_WRITE_NOME = 'GFV SIM E2E WRITE MACCHINA';

/**
 * @param {import('playwright-core').Page} page
 */
function macchinaRowsWithMarker(page) {
  return page.locator('#macchine-container .macchine-table tbody tr').filter({
    hasText: E2E_MACCHINA_WRITE_NOME,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function createMacchinaMarker(page) {
  await page.getByRole('button', { name: /Nuova Macchina/i }).click();
  await page.locator('#macchina-modal.active').waitFor({ state: 'visible', timeout: 30_000 });

  await page.locator('#tipo-trattore').check();
  await page.locator('#macchina-nome').fill(E2E_MACCHINA_WRITE_NOME);
  await page.locator('#macchina-stato').selectOption('disponibile');
  await page.locator('#macchina-cavalli').fill('99');

  await page.locator('#macchina-form button[type="submit"]').click();

  await page.waitForFunction(() => {
    const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert, #alert-container .alert-success');
    return Array.from(toasts).some((t) => /Macchina creata con successo/i.test(t.textContent || ''));
  }, { timeout: 60_000 });

  await page.waitForFunction(
    (nome) => {
      const rows = document.querySelectorAll('#macchine-container .macchine-table tbody tr');
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(nome));
    },
    E2E_MACCHINA_WRITE_NOME,
    { timeout: 60_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGestioneMacchineWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFromDevPage(page);
  await gotoGestioneMacchine(page);

  if ((await macchinaRowsWithMarker(page).count()) === 0) {
    await createMacchinaMarker(page);
  }

  expect(await macchinaRowsWithMarker(page).count()).toBeGreaterThanOrEqual(1);
  await expect(macchinaRowsWithMarker(page).first()).toContainText(E2E_MACCHINA_WRITE_NOME);
}

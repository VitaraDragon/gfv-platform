/**
 * E2E write — crea nuova squadra da Gestione Squadre.
 * Idempotente: marker nel nome squadra.
 * @module tests/e2e/sim/scenarios/squadre-write
 */

import { gotoGestioneSquadre, loginAsManagerManodopera } from '../helpers/sim-login.js';

export const E2E_SQUADRA_WRITE_NOME = 'GFV SIM E2E SQUADRA';

/**
 * @param {import('playwright-core').Page} page
 */
function squadraRowsWithMarker(page) {
  return page.locator('#squadre-container .squadre-table tbody tr').filter({
    hasText: E2E_SQUADRA_WRITE_NOME,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function createSquadraMarker(page) {
  page.once('dialog', (dialog) => dialog.accept());

  await page.locator('#btn-crea-squadra').click();
  await page.locator('#squadra-modal.active').waitFor({ state: 'visible', timeout: 30_000 });

  await page.waitForFunction(() => {
    const sel = document.getElementById('squadra-caposquadra');
    return sel && !sel.disabled && sel.querySelectorAll('option[value]:not([value=""])').length >= 1;
  }, { timeout: 60_000 });

  await page.locator('#squadra-nome').fill(E2E_SQUADRA_WRITE_NOME);

  const capoSelect = page.locator('#squadra-caposquadra');
  const capoValue = await capoSelect.locator('option[value]:not([value=""])').first().getAttribute('value');
  await capoSelect.selectOption(capoValue || { index: 1 });

  const firstCheckbox = page.locator('#operai-checkbox-group input[type="checkbox"]').first();
  if ((await firstCheckbox.count()) > 0) {
    await firstCheckbox.check();
  }

  await page.locator('#squadra-form button[type="submit"]').click();

  await page.waitForFunction(
    (nome) => {
      const rows = document.querySelectorAll('#squadre-container .squadre-table tbody tr');
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(nome));
    },
    E2E_SQUADRA_WRITE_NOME,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runSquadreWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerManodopera(page);
  await gotoGestioneSquadre(page);

  if ((await squadraRowsWithMarker(page).count()) === 0) {
    await createSquadraMarker(page);
  }

  expect(await squadraRowsWithMarker(page).count()).toBeGreaterThanOrEqual(1);
  await expect(squadraRowsWithMarker(page).first()).toContainText(E2E_SQUADRA_WRITE_NOME);

  const countText = await page.locator('#squadre-count').textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(1);
}

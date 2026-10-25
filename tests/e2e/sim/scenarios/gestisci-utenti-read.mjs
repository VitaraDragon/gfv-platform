/**
 * E2E read — gestisci utenti come manager (§11.3 scen. 45).
 * Entra, non vede casella Amministratore, niente azioni sulle righe admin.
 * @module tests/e2e/sim/scenarios/gestisci-utenti-read
 */

import { gotoGestisciUtenti, loginAsManagerManodopera } from '../helpers/sim-login.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGestisciUtentiReadAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerManodopera(page);
  await gotoGestisciUtenti(page);

  await expect(page.locator('h1').filter({ hasText: 'Gestisci Utenti' })).toBeVisible();

  // Manager: niente link Impostazioni
  const impostazioni = page.locator('#impostazioni-link');
  await expect(impostazioni).toBeHidden();

  const table = page.locator('#users-container .users-table');
  await expect(table).toBeVisible();

  const rows = table.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(4);

  const countText = await page.locator('#users-count').textContent();
  const countMatch = (countText || '').match(/(\d+)/);
  expect(countMatch).not.toBeNull();
  expect(parseInt(countMatch[1], 10)).toBeGreaterThanOrEqual(4);

  const ruoliCells = await table.locator('tbody td:nth-child(3)').allTextContents();
  expect(ruoliCells.some((r) => /amministratore|manager/i.test(r))).toBe(true);
  expect(ruoliCells.some((r) => /caposquadra/i.test(r))).toBe(true);
  expect(ruoliCells.some((r) => /operaio/i.test(r))).toBe(true);

  await expect(page.getByRole('button', { name: /Invita Utente/i })).toBeVisible();

  // Invita: casella Amministratore nascosta/disabilitata per il manager
  await page.getByRole('button', { name: /Invita Utente/i }).click();
  await expect(page.locator('#invita-modal')).toHaveClass(/active/);
  await expect(page.locator('#role-admin-item')).toBeHidden();
  await expect(page.locator('#role-admin')).toBeDisabled();
  await page.locator('#invita-modal .close-btn').click();

  // Righe amministratore: niente Disattiva / Riattiva / Rimuovi / Modifica ruoli
  const adminRows = table.locator('tbody tr[data-is-admin="1"]');
  expect(await adminRows.count()).toBeGreaterThanOrEqual(1);
  await expect(adminRows.first().getByRole('button', { name: /Ruoli/i })).toHaveCount(0);
  await expect(adminRows.first().getByRole('button', { name: /Disattiva|Attiva/i })).toHaveCount(0);
  await expect(adminRows.first().getByRole('button', { name: /Rimuovi/i })).toHaveCount(0);
}

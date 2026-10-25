/**
 * E2E read — gestisci utenti (§11.3 scen. 45).
 * Login seed «manager» (persona con ruolo amministratore) → entra e legge lista.
 * UI solo-manager (niente casella Amministratore / azioni su admin): covered by
 * tests/gestisci-utenti-manager-static.test.js — il seed non ha un manager puro.
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

  // Accesso via ruoli tenant: seed manager = amministratore → Impostazioni visibile
  await expect(page.locator('#impostazioni-link')).toBeVisible();

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

  // Modal Invita: casella Amministratore disponibile per admin seed
  await page.getByRole('button', { name: /Invita Utente/i }).click();
  await expect(page.locator('#invita-modal')).toHaveClass(/active/);
  await expect(page.locator('#role-admin-item')).toBeVisible();
  await expect(page.locator('#role-admin')).toBeEnabled();
  await page.locator('#invita-modal .close-btn').click();
}

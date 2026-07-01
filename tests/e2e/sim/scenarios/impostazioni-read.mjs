/**
 * E2E read — impostazioni tenant/account (§11.3 scen. 46).
 * @module tests/e2e/sim/scenarios/impostazioni-read
 */

import { gotoImpostazioni, loginAsManagerFromDevPage } from '../helpers/sim-login.js';

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runImpostazioniReadAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFromDevPage(page);
  await gotoImpostazioni(page);

  await expect(page.locator('h1').filter({ hasText: 'Impostazioni' })).toBeVisible();
  await expect(page.locator('#account-section')).toBeVisible();

  const nome = page.locator('#account-nome');
  const cognome = page.locator('#account-cognome');
  const email = page.locator('#account-email');

  await expect(nome).not.toHaveValue('');
  await expect(cognome).not.toHaveValue('');
  await expect(email).not.toHaveValue('');
  expect((await email.inputValue()).includes('@')).toBe(true);

  await expect(page.locator('#password-section')).toBeVisible();
  await expect(page.locator('#password-form')).toBeVisible();
}

/**
 * E2E write — caposquadra sospende lavoro assegnato (desktop lavori-caposquadra).
 * Usa un lavoro squadra già presente nel seed (no creazione via modale manager).
 * @module tests/e2e/sim/scenarios/lavori-caposquadra-write
 */

import {
  gotoLavoriCaposquadra,
  loginAsCapoForLavoriDesktop,
} from '../helpers/sim-login.js';

export const E2E_CAPO_SOSPENSIONE_CAUSA = 'GFV_SIM_E2E_CAPO_SOSPEND';

function cardWithSospendiButton(page) {
  return page.locator('#lavori-container .lavoro-card').filter({
    has: page.getByRole('button', { name: /Sospendi lavoro/i }),
  });
}

function cardSospesoWithCausa(page) {
  return page.locator('#lavori-container .lavoro-card').filter({
    hasText: E2E_CAPO_SOSPENSIONE_CAUSA,
  });
}

async function pickLavoroToSuspend(page) {
  const actionable = cardWithSospendiButton(page);
  if ((await actionable.count()) > 0) {
    return actionable.first();
  }
  const already = cardSospesoWithCausa(page);
  if ((await already.count()) > 0) {
    return null;
  }
  throw new Error('Nessun lavoro caposquadra sospendibile nel seed');
}

async function suspendLavoroAsCapo(page, expect) {
  const card = await pickLavoroToSuspend(page);
  if (!card) return;

  await card.waitFor({ state: 'visible', timeout: 60_000 });

  const sospendiBtn = card.getByRole('button', { name: /Sospendi lavoro/i });
  await expect(sospendiBtn).toBeVisible({ timeout: 30_000 });

  const dialogPromise = page.waitForEvent('dialog', { timeout: 15_000 });
  await sospendiBtn.click();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('prompt');
  await dialog.accept(E2E_CAPO_SOSPENSIONE_CAUSA);

  await page.waitForFunction(
    (causa) => {
      const cards = document.querySelectorAll('#lavori-container .lavoro-card');
      return Array.from(cards).some(
        (c) =>
          /Lavoro sospeso|sospeso/i.test(c.textContent || '') &&
          (c.textContent || '').includes(causa)
      );
    },
    E2E_CAPO_SOSPENSIONE_CAUSA,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runLavoriCaposquadraWriteAssertions(page, expect) {
  expect.configure({ timeout: 120_000 });

  await loginAsCapoForLavoriDesktop(page);
  await gotoLavoriCaposquadra(page);

  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    return container && !container.querySelector('.loading');
  }, { timeout: 45_000 });

  const actionable = await cardWithSospendiButton(page).count();
  const alreadyDone = await cardSospesoWithCausa(page).count();
  expect(actionable + alreadyDone).toBeGreaterThanOrEqual(1);

  await suspendLavoroAsCapo(page, expect);

  const suspended = cardSospesoWithCausa(page);
  await expect(suspended.first()).toBeVisible({ timeout: 30_000 });
  await expect(suspended.first()).toContainText(/sospeso/i);
}

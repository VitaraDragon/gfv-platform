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

/** Nomi lavori seed squadra su viticola-conto-terzi-manodopera (fase 07). */
const SEED_LAVORO_NAMES = [/Potatura squadra/i, /Trattamento squadra/i, /Erpicatura squadra/i];

function capoLavoroCardCandidates(page) {
  return page.locator('#lavori-container .lavoro-card').filter({
    hasText: /assegnato/i,
  });
}

async function pickSeedLavoroCard(page) {
  for (const pattern of SEED_LAVORO_NAMES) {
    const card = capoLavoroCardCandidates(page).filter({ hasText: pattern });
    if ((await card.count()) > 0) {
      return card.first();
    }
  }
  const fallback = capoLavoroCardCandidates(page).first();
  await fallback.waitFor({ state: 'visible', timeout: 60_000 });
  return fallback;
}

async function suspendLavoroAsCapo(page, expect) {
  const card = await pickSeedLavoroCard(page);
  await card.waitFor({ state: 'visible', timeout: 60_000 });

  const cardText = await card.textContent();
  if (/Lavoro sospeso/i.test(cardText || '') && (cardText || '').includes(E2E_CAPO_SOSPENSIONE_CAUSA)) {
    return;
  }

  const sospendiBtn = card.getByRole('button', { name: /Sospendi lavoro/i });
  await expect(sospendiBtn).toBeVisible({ timeout: 30_000 });

  page.once('dialog', async (dialog) => {
    await dialog.accept(E2E_CAPO_SOSPENSIONE_CAUSA);
  });
  await sospendiBtn.click();

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
    { timeout: 60_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runLavoriCaposquadraWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsCapoForLavoriDesktop(page);
  await gotoLavoriCaposquadra(page);

  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    return container && !container.querySelector('.loading');
  }, { timeout: 45_000 });

  expect(await capoLavoroCardCandidates(page).count()).toBeGreaterThanOrEqual(1);
  await suspendLavoroAsCapo(page, expect);

  const suspended = page.locator('#lavori-container .lavoro-card').filter({
    hasText: E2E_CAPO_SOSPENSIONE_CAUSA,
  });
  await expect(suspended.first()).toContainText(/sospeso/i);
}

/**
 * E2E write — caposquadra sospende lavoro assegnato (desktop lavori-caposquadra).
 * Usa un lavoro squadra già presente nel seed (no creazione via modale manager).
 * @module tests/e2e/sim/scenarios/lavori-caposquadra-write
 */

import {
  loginAsCapoForLavoriDesktop,
} from '../helpers/sim-login.js';

export const E2E_CAPO_SOSPENSIONE_CAUSA = 'GFV_SIM_E2E_CAPO_SOSPEND';

function cardWithSospendiButton(page) {
  return page.locator('#lavori-container .lavoro-card').filter({
    has: page.locator('button', { hasText: 'Sospendi lavoro' }),
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
  if ((await cardSospesoWithCausa(page).count()) > 0) {
    return null;
  }
  throw new Error('Nessun lavoro caposquadra sospendibile nel seed');
}

async function extractLavoroIdFromSospendiButton(page, card) {
  const sospendiBtn = card.locator('button', { hasText: 'Sospendi lavoro' });
  await expect(sospendiBtn).toBeVisible({ timeout: 30_000 });
  return sospendiBtn.evaluate((btn) => {
    const onclick = btn.getAttribute('onclick') || '';
    const match = onclick.match(/sospendiLavoroDaCaposquadra\('([^']+)'\)/);
    return match ? match[1] : null;
  });
}

async function trySuspendLavoroId(page, lavoroId) {
  return page.evaluate(
    async ({ id, causa }) => {
      if (typeof window.sospendiLavoroDaCaposquadra !== 'function') {
        return { ok: false, debug: { reason: 'missing_fn' } };
      }
      const ok = await window.sospendiLavoroDaCaposquadra(id, causa);
      return { ok: !!ok, debug: window.__gfvSuspendDebug || null };
    },
    { id: lavoroId, causa: E2E_CAPO_SOSPENSIONE_CAUSA }
  );
}

async function suspendLavoroAsCapo(page, expect) {
  const card = await pickLavoroToSuspend(page);
  if (!card) return;

  await card.waitFor({ state: 'visible', timeout: 60_000 });

  const cards = cardWithSospendiButton(page);
  const count = await cards.count();
  let lastDebug = null;

  for (let i = 0; i < count; i += 1) {
    const candidate = cards.nth(i);
    const lavoroId = await extractLavoroIdFromSospendiButton(page, candidate);
    expect(lavoroId).toBeTruthy();

    const suspended = await trySuspendLavoroId(page, lavoroId);
    lastDebug = suspended.debug;
    if (suspended.ok) {
      await expect(cardSospesoWithCausa(page).first()).toBeVisible({ timeout: 60_000 });
      return;
    }
  }

  expect(false, JSON.stringify(lastDebug || { reason: 'no_suspendable_lavoro' })).toBe(true);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runLavoriCaposquadraWriteAssertions(page, expect) {
  expect.configure({ timeout: 120_000 });

  await loginAsCapoForLavoriDesktop(page);

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

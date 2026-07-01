/**
 * E2E write — manager risolve guasto marker (scen. 44) in lista officina guasti.
 * Idempotente: marker dettagli da guasti-write + note risoluzione distintiva.
 * @module tests/e2e/sim/scenarios/guasti-resolve-write
 */

import {
  E2E_GUASTO_WRITE_DETTAGLI,
  createGuastoAsOperaio,
} from './guasti-write.mjs';
import {
  gotoGuastiList,
  loginAsManagerManodopera,
} from '../helpers/sim-login.js';

export const E2E_GUASTO_RESOLVE_NOTE = 'GFV_SIM_E2E_RESOLVE_GUASTO';

/**
 * @param {import('playwright-core').Page} page
 */
function guastoRowWithMarker(page) {
  return page.locator('#table-container .guasti-table tbody tr').filter({
    hasText: E2E_GUASTO_WRITE_DETTAGLI,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function ensureMarkerGuastoExists(page) {
  await loginAsManagerManodopera(page);
  await gotoGuastiList(page);
  await page.locator('#filter-stato').selectOption('tutti');
  if ((await guastoRowWithMarker(page).count()) === 0) {
    await createGuastoAsOperaio(page);
    await loginAsManagerManodopera(page);
    await gotoGuastiList(page);
    await page.locator('#filter-stato').selectOption('tutti');
  }
}

/**
 * @param {import('playwright-core').Page} page
 */
async function resolveMarkerGuastoFromList(page) {
  const row = guastoRowWithMarker(page).first();
  if ((await row.locator('.badge-risolto').count()) > 0) {
    return;
  }

  await row.getByRole('button', { name: /Segna risolto/i }).click();
  await page.locator('#modal-risolvi.active').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#risolvi-note').fill(E2E_GUASTO_RESOLVE_NOTE);
  await page.locator('#form-risolvi button[type="submit"]').click();

  await page.waitForFunction(() => {
    const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert, #alert-container .alert-success');
    return Array.from(toasts).some((t) => /Guasto segnato come risolto/i.test(t.textContent || ''));
  }, { timeout: 60_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGuastiResolveWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await ensureMarkerGuastoExists(page);

  await expect(guastoRowWithMarker(page).first()).toBeVisible({ timeout: 60_000 });
  await resolveMarkerGuastoFromList(page);

  const row = guastoRowWithMarker(page).first();
  await expect(row.locator('.badge-risolto')).toBeVisible();
  await expect(row).toContainText(E2E_GUASTO_WRITE_DETTAGLI);
}

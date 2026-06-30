/**
 * E2E write — manager risolve guasto marker (scen. 33) in gestione-guasti admin.
 * @module tests/e2e/sim/scenarios/guasti-resolve-write
 */

import {
  E2E_GUASTO_WRITE_DETTAGLI,
  createGuastoAsOperaio,
} from './guasti-write.mjs';
import {
  gotoGestioneGuastiAdmin,
  gotoGuastiList,
  loginAsManagerManodopera,
} from '../helpers/sim-login.js';

export const E2E_GUASTO_RESOLVE_NOTE = 'GFV_SIM_E2E_RESOLVE_GUASTO';

/**
 * @param {import('playwright-core').Page} page
 */
function guastoItemWithMarker(page) {
  return page.locator('#guasti-list .guasto-item').filter({ hasText: E2E_GUASTO_WRITE_DETTAGLI });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function ensureMarkerGuastoExists(page) {
  await loginAsManagerManodopera(page);
  await gotoGuastiList(page);
  await page.locator('#filter-stato').selectOption('tutti');
  const inList = page.locator('#table-container .guasti-table tbody tr').filter({
    hasText: E2E_GUASTO_WRITE_DETTAGLI,
  });
  if ((await inList.count()) === 0) {
    await createGuastoAsOperaio(page);
  }
}

/**
 * @param {import('playwright-core').Page} page
 */
async function resolveMarkerGuasto(page) {
  const item = guastoItemWithMarker(page);
  if ((await item.locator('.badge-risolto').count()) > 0) {
    return;
  }

  await item.getByRole('button', { name: /Risolvi Guasto/i }).click();
  await page.locator('#risolvi-modal.show').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#risolvi-note').fill(E2E_GUASTO_RESOLVE_NOTE);
  await page.getByRole('button', { name: /Conferma Risoluzione/i }).click();

  await page.waitForFunction(() => {
    const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert, #alert-container .alert-success');
    return Array.from(toasts).some((t) => /Guasto risolto con successo/i.test(t.textContent || ''));
  }, { timeout: 60_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGuastiResolveWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await ensureMarkerGuastoExists(page);

  await loginAsManagerManodopera(page);
  await gotoGestioneGuastiAdmin(page);
  await page.locator('#filter-stato').selectOption('');

  await expect(guastoItemWithMarker(page).first()).toBeVisible({ timeout: 60_000 });
  await resolveMarkerGuasto(page);

  const item = guastoItemWithMarker(page).first();
  await expect(item.locator('.badge-risolto')).toBeVisible();
  await expect(item).toContainText(E2E_GUASTO_RESOLVE_NOTE);
}

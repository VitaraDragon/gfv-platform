/**
 * E2E write — invio preventivo bozza conto terzi (§11.3.12 scen. 51).
 * Idempotente: superficie marker 8.88 ha (distinta da scen. 24 accetta 9.99).
 * @module tests/e2e/sim/scenarios/preventivi-invia-write
 */

import { gotoPreventiviList, loginAsManagerContoTerzi } from '../helpers/sim-login.js';
import {
  clearPreventiviFilters,
  fillAndSubmitNewPreventivo,
  openNuovoPreventivoPage,
} from './preventivi-write.mjs';

export const E2E_PREVENTIVO_INVIA_SUPERFICIE = '8.88';
export const E2E_PREVENTIVO_INVIA_NOTE = 'GFV_SIM_E2E_INVIA_PREVENTIVO';

const PREFERRED_TIPO_LAVORO = 'Erpicatura';

/**
 * @param {import('playwright-core').Page} page
 */
function inviaMarkerRow(page) {
  return page
    .locator('#preventivi-container .preventivi-table tbody tr')
    .filter({ hasText: E2E_PREVENTIVO_INVIA_SUPERFICIE })
    .filter({ hasText: PREFERRED_TIPO_LAVORO })
    .first();
}

/**
 * @param {import('playwright-core').Page} page
 */
async function waitForInviaMarkerInTable(page) {
  await page.waitForFunction(
    ({ superficie, tipo }) =>
      Array.from(document.querySelectorAll('#preventivi-container .preventivi-table tbody tr')).some(
        (tr) => {
          const text = tr.textContent || '';
          return text.includes(superficie) && text.includes(tipo);
        }
      ),
    { superficie: E2E_PREVENTIVO_INVIA_SUPERFICIE, tipo: PREFERRED_TIPO_LAVORO },
    { timeout: 60_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 */
async function createInviaMarkerPreventivo(page) {
  const totalBefore = await page.evaluate(
    () => document.querySelectorAll('#preventivi-container .preventivi-table tbody tr').length
  );

  await openNuovoPreventivoPage(page);
  await fillAndSubmitNewPreventivo(page, {
    note: E2E_PREVENTIVO_INVIA_NOTE,
    superficie: E2E_PREVENTIVO_INVIA_SUPERFICIE,
  });

  await page.waitForFunction(
    (before) =>
      document.querySelectorAll('#preventivi-container .preventivi-table tbody tr').length > before,
    totalBefore,
    { timeout: 60_000 }
  );
  await waitForInviaMarkerInTable(page);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runPreventiviInviaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerContoTerzi(page);
  await gotoPreventiviList(page);
  await clearPreventiviFilters(page);

  let row = inviaMarkerRow(page);
  if ((await row.count()) === 0) {
    await createInviaMarkerPreventivo(page);
    await clearPreventiviFilters(page);
    await waitForInviaMarkerInTable(page);
    row = inviaMarkerRow(page);
  }

  expect(await row.count()).toBeGreaterThanOrEqual(1);
  await expect(row.locator('td').nth(4)).toContainText(`${E2E_PREVENTIVO_INVIA_SUPERFICIE} ha`);

  const isBozza = (await row.locator('.badge-secondary').filter({ hasText: /Bozza/i }).count()) > 0;
  const isInviato = (await row.locator('.badge-info').filter({ hasText: /Inviato/i }).count()) > 0;

  if (isBozza) {
    await row.getByRole('button', { name: /^Invia$/i }).click();
    await page.waitForFunction(
      (superficie) =>
        Array.from(document.querySelectorAll('#preventivi-container .preventivi-table tbody tr')).some(
          (tr) => (tr.textContent || '').includes(superficie) && /Inviato/i.test(tr.textContent || '')
        ),
      E2E_PREVENTIVO_INVIA_SUPERFICIE,
      { timeout: 60_000 }
    );
    await clearPreventiviFilters(page);
    row = inviaMarkerRow(page);
  }

  await expect(row.locator('.badge-info').filter({ hasText: /Inviato/i })).toBeVisible();
  expect(isInviato || isBozza).toBe(true);
}

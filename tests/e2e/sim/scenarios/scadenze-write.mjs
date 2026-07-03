/**
 * E2E write — aggiorna scadenza (rinnova) da lista scadenze parco.
 * Idempotente: data 2030-06-15; verifica riga via data-macchina-id + data-campo sul pulsante.
 * @module tests/e2e/sim/scenarios/scadenze-write
 */

import { gotoScadenzeList, loginAsManagerFromDevPage } from '../helpers/sim-login.js';

export const E2E_SCADENZE_WRITE_DATE = '2030-06-15';

/**
 * @param {import('playwright-core').Page} page
 * @param {import('playwright-core').Locator} rinnovaBtn
 */
function rowForRinnovaButton(page, rinnovaBtn) {
  return page.locator('.scadenze-table tbody tr').filter({ has: rinnovaBtn }).first();
}

/**
 * @param {import('playwright-core').Page} page
 */
async function findRenewedMarkerRow(page) {
  const rows = page.locator('.scadenze-table tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const valore = ((await row.locator('td').nth(2).textContent()) || '').trim();
    if (!/2030/.test(valore)) continue;
    if ((await row.locator('.status-dot.dot-black').count()) === 0) return row;
  }
  return null;
}

/**
 * @param {import('playwright-core').Page} page
 */
async function pickRinnovaDataButton(page) {
  const candidates = page.locator('.scadenze-table tbody tr .btn-rinnova[data-tipo="data"]');
  const count = await candidates.count();
  for (let i = 0; i < count; i += 1) {
    const btn = candidates.nth(i);
    const row = rowForRinnovaButton(page, btn);
    const valore = ((await row.locator('td').nth(2).textContent()) || '').trim();
    if (!/2030/.test(valore)) return btn;
  }

  const scadutaBtn = page.locator('.scadenze-table tbody tr.row-scaduto .btn-rinnova[data-tipo="data"]').first();
  if ((await scadutaBtn.count()) > 0) return scadutaBtn;
  return page.locator('.scadenze-table tbody tr .btn-rinnova[data-tipo="data"]').first();
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} macchinaId
 * @param {string} campo
 */
async function waitForScadenzaRowUpdated(page, macchinaId, campo) {
  await page.waitForFunction(
    ({ id, field }) => {
      const btn = document.querySelector(
        `.btn-rinnova[data-macchina-id="${id}"][data-campo="${field}"]`
      );
      if (!btn) return false;
      const tr = btn.closest('tr');
      if (!tr) return false;
      const valore = (tr.querySelectorAll('td')[2]?.textContent || '').trim();
      if (!/2030|giugno/i.test(valore)) return false;
      return !!tr.querySelector('.status-dot.dot-green, .status-dot.dot-yellow');
    },
    { id: macchinaId, field: campo },
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 */
async function renewFirstScadutaDataRow(page) {
  const rinnovaBtn = await pickRinnovaDataButton(page);
  await rinnovaBtn.waitFor({ state: 'visible', timeout: 60_000 });

  const macchinaId = (await rinnovaBtn.getAttribute('data-macchina-id')) || '';
  const campo = (await rinnovaBtn.getAttribute('data-campo')) || 'prossimaManutenzione';
  if (!macchinaId) {
    throw new Error('Pulsante rinnova senza data-macchina-id');
  }

  await rinnovaBtn.click();

  await page.locator('#modal-rinnova.active').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#group-data').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#rinnova-data').fill(E2E_SCADENZE_WRITE_DATE);
  await page.locator('#form-rinnova button[type="submit"]').click();

  await page.waitForFunction(
    () => {
      const modal = document.getElementById('modal-rinnova');
      return modal && !modal.classList.contains('active');
    },
    { timeout: 90_000 }
  );

  await waitForScadenzaRowUpdated(page, macchinaId, campo);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runScadenzeWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFromDevPage(page);
  await gotoScadenzeList(page);

  let markerRow = await findRenewedMarkerRow(page);
  if (!markerRow) {
    await renewFirstScadutaDataRow(page);
    markerRow = await findRenewedMarkerRow(page);
  }

  expect(markerRow).not.toBeNull();
  await expect(markerRow).toBeVisible();
  await expect(markerRow.locator('td').nth(2)).toContainText(/2030|giugno/i);
  expect(await markerRow.locator('.status-dot.dot-black').count()).toBe(0);
  expect(await markerRow.locator('.status-dot.dot-green, .status-dot.dot-yellow').count()).toBeGreaterThanOrEqual(1);
}

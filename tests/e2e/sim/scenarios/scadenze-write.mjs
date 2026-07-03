/**
 * E2E write — aggiorna scadenza (rinnova) da lista scadenze parco.
 * Idempotente: data 2030-06-15; verifica riga via data-macchina-id + data-campo.
 * @module tests/e2e/sim/scenarios/scadenze-write
 */

import { gotoScadenzeList, loginAsManagerFromDevPage } from '../helpers/sim-login.js';

export const E2E_SCADENZE_WRITE_DATE = '2030-06-15';

/**
 * @param {import('playwright-core').Locator} rinnovaBtn
 */
async function valoreCellText(rinnovaBtn) {
  return rinnovaBtn.evaluate((btn) => {
    const tr = btn.closest('tr');
    return (tr?.querySelectorAll('td')[2]?.textContent || '').trim();
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function findRenewedMarkerRow(page) {
  const buttons = page.locator('.scadenze-table tbody tr .btn-rinnova[data-tipo="data"]');
  const count = await buttons.count();
  for (let i = 0; i < count; i += 1) {
    const btn = buttons.nth(i);
    const valore = await valoreCellText(btn);
    if (!/2030/.test(valore)) continue;
    const isBlack = await btn.evaluate((el) => !!el.closest('tr')?.querySelector('.status-dot.dot-black'));
    if (!isBlack) return btn;
  }
  return null;
}

/**
 * @param {import('playwright-core').Page} page
 */
async function pickRinnovaDataButton(page) {
  const buttons = page.locator('.scadenze-table tbody tr .btn-rinnova[data-tipo="data"]');
  await buttons.first().waitFor({ state: 'visible', timeout: 60_000 });

  const count = await buttons.count();
  for (let i = 0; i < count; i += 1) {
    const btn = buttons.nth(i);
    const valore = await valoreCellText(btn);
    if (!/2030/.test(valore)) return btn;
  }

  const scadutaBtn = page.locator('.scadenze-table tbody tr.row-scaduto .btn-rinnova[data-tipo="data"]').first();
  if ((await scadutaBtn.count()) > 0) return scadutaBtn;
  return buttons.first();
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

  let markerBtn = await findRenewedMarkerRow(page);
  if (!markerBtn) {
    await renewFirstScadutaDataRow(page);
    markerBtn = await findRenewedMarkerRow(page);
  }

  expect(markerBtn).not.toBeNull();
  const valore = await valoreCellText(markerBtn);
  expect(/2030|giugno/i.test(valore)).toBe(true);
  const isBlack = await markerBtn.evaluate((el) => !!el.closest('tr')?.querySelector('.status-dot.dot-black'));
  expect(isBlack).toBe(false);
}

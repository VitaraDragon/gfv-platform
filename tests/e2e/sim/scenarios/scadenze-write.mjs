/**
 * E2E write — aggiorna scadenza (rinnova) da lista scadenze parco.
 * Idempotente: data 2030-06-15; verifica cambio valore sulla riga target.
 * @module tests/e2e/sim/scenarios/scadenze-write
 */

import { gotoScadenzeList, loginAsManagerFromDevPage } from '../helpers/sim-login.js';

export const E2E_SCADENZE_WRITE_DATE = '2030-06-15';

/**
 * @param {import('playwright-core').Page} page
 */
async function waitForScadenzeTableReady(page) {
  await page.waitForFunction(
    () => {
      const container = document.getElementById('table-container');
      if (!container) return false;
      if (container.querySelector('.loading')) return false;
      if (/Caricamento/i.test(container.textContent || '')) return false;
      if (container.querySelector('.empty-state')) return false;
      return container.querySelector('.scadenze-table tbody tr') !== null;
    },
    { timeout: 90_000 }
  );
}

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
async function readScadenzaValore(page, macchinaId, campo) {
  const btn = page.locator(
    `.btn-rinnova[data-macchina-id="${macchinaId}"][data-campo="${campo}"]`
  ).first();
  if ((await btn.count()) === 0) return '';
  return valoreCellText(btn);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} macchinaId
 * @param {string} campo
 * @param {string} beforeValore
 */
async function waitForScadenzaValoreChanged(page, macchinaId, campo, beforeValore) {
  await page.waitForFunction(
    ({ id, field, before }) => {
      const btn = document.querySelector(
        `.btn-rinnova[data-macchina-id="${id}"][data-campo="${field}"]`
      );
      if (!btn) return false;
      const valore = (btn.closest('tr')?.querySelectorAll('td')[2]?.textContent || '').trim();
      if (!valore || valore === before) return false;
      return /2030|giugno/i.test(valore);
    },
    { id: macchinaId, field: campo, before: beforeValore },
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runScadenzeWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFromDevPage(page);
  await gotoScadenzeList(page);
  await waitForScadenzeTableReady(page);

  const rinnovaBtn = await pickRinnovaDataButton(page);
  const macchinaId = (await rinnovaBtn.getAttribute('data-macchina-id')) || '';
  const campo = (await rinnovaBtn.getAttribute('data-campo')) || 'prossimaManutenzione';
  if (!macchinaId) {
    throw new Error('Pulsante rinnova senza data-macchina-id');
  }

  let valore = await valoreCellText(rinnovaBtn);

  if (!/2030/.test(valore)) {
    const beforeValore = valore;
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

    await waitForScadenzeTableReady(page);
    await waitForScadenzaValoreChanged(page, macchinaId, campo, beforeValore);
    valore = await readScadenzaValore(page, macchinaId, campo);
  }

  if (!/2030|giugno/i.test(valore)) {
    await page.reload();
    await waitForScadenzeTableReady(page);
    valore = await readScadenzaValore(page, macchinaId, campo);
  }

  expect(/2030|giugno/i.test(valore)).toBe(true);
  const isBlack = await page
    .locator(`.btn-rinnova[data-macchina-id="${macchinaId}"][data-campo="${campo}"]`)
    .first()
    .evaluate((el) => !!el.closest('tr')?.querySelector('.status-dot.dot-black'));
  expect(isBlack).toBe(false);
}

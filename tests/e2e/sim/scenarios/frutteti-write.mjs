/**
 * E2E write — nuovo frutteto anagrafica (allineamento app, analogo vigneti-write scen. 50).
 * Idempotente: varietà marker + annata 2018 + superficie 0.66 ha.
 * @module tests/e2e/sim/scenarios/frutteti-write
 */

import { gotoFruttetiList, loginAsManagerFrutteto } from '../helpers/sim-login.js';

export const E2E_FRUTTETO_WRITE_SPECIE = 'Melo';
export const E2E_FRUTTETO_WRITE_VARIETA = 'GFV E2E Sim Boskoop';
export const E2E_FRUTTETO_WRITE_ANNATA = '2018';
export const E2E_FRUTTETO_WRITE_SUPERFICIE = '0.66';

/**
 * @param {import('playwright-core').Page} page
 */
function markerFruttetoRows(page) {
  return page.locator('#frutteti-table-body tr').filter({ hasText: E2E_FRUTTETO_WRITE_VARIETA });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function ensureVarietaInForm(page) {
  const varietaSelect = page.locator('#varieta');
  const hasOption = await varietaSelect.locator('option', { hasText: E2E_FRUTTETO_WRITE_VARIETA }).count();
  if (hasOption > 0) {
    await varietaSelect.selectOption({ label: E2E_FRUTTETO_WRITE_VARIETA });
    return;
  }
  await page.locator('button[title="Aggiungi nuova varietà"]').click();
  await page.locator('#add-varieta-modal.active').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#new-varieta').fill(E2E_FRUTTETO_WRITE_VARIETA);
  await page.locator('#add-varieta-modal form button[type="submit"]').click();
  await page.locator('#add-varieta-modal.active').waitFor({ state: 'hidden', timeout: 15_000 });
  await varietaSelect.selectOption({ label: E2E_FRUTTETO_WRITE_VARIETA });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function createMarkerFrutteto(page) {
  await page.getByRole('button', { name: /Nuovo Frutteto/i }).click();
  await page.locator('#frutteto-modal.active').waitFor({ state: 'visible', timeout: 30_000 });

  await page.waitForFunction(() => {
    const sel = document.getElementById('terrenoId');
    return sel && sel.querySelectorAll('option:not([value=""])').length >= 1;
  }, undefined, { timeout: 30_000 });

  await page.waitForFunction(() => {
    const sel = document.getElementById('specie');
    return sel && sel.querySelectorAll('option:not([value=""])').length >= 1;
  }, undefined, { timeout: 30_000 });

  const terrenoValue = await page.locator('#terrenoId option:not([value=""])').first().getAttribute('value');
  await page.locator('#terrenoId').selectOption(terrenoValue || { index: 1 });
  await page.locator('#specie').selectOption({ label: E2E_FRUTTETO_WRITE_SPECIE });
  await page.waitForFunction(() => {
    const sel = document.getElementById('varieta');
    return sel && sel.querySelectorAll('option:not([value=""])').length >= 1;
  }, undefined, { timeout: 30_000 });
  await ensureVarietaInForm(page);
  await page.locator('#annataImpianto').fill(E2E_FRUTTETO_WRITE_ANNATA);
  await page.locator('#formaAllevamento').selectOption({ index: 1 });
  await page.locator('#distanzaFile').fill('4.0');
  await page.locator('#distanzaUnita').fill('1.5');
  await page.waitForFunction(() => {
    const d = document.getElementById('densita');
    return d && parseFloat(d.value) > 0;
  }, undefined, { timeout: 15_000 });
  await page.locator('#superficieEttari').fill(E2E_FRUTTETO_WRITE_SUPERFICIE);
  await page.locator('#statoImpianto').selectOption('attivo');
  await page.locator('#note').fill('GFV_SIM_E2E_WRITE_FRUTTETO');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#frutteto-form button[type="submit"]').click();

  await page.waitForFunction(
    (varieta) => {
      const tbody = document.getElementById('frutteti-table-body');
      return tbody && (tbody.textContent || '').includes(varieta);
    },
    E2E_FRUTTETO_WRITE_VARIETA,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runFruttetiWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFrutteto(page);
  await gotoFruttetiList(page);

  if ((await markerFruttetoRows(page).count()) === 0) {
    await createMarkerFrutteto(page);
  }

  const row = markerFruttetoRows(page).first();
  expect(await markerFruttetoRows(page).count()).toBeGreaterThanOrEqual(1);
  await expect(row).toContainText(E2E_FRUTTETO_WRITE_VARIETA);
  await expect(row).toContainText(E2E_FRUTTETO_WRITE_ANNATA);
  await expect(row).toContainText(E2E_FRUTTETO_WRITE_SUPERFICIE);
}

/**
 * E2E write — nuovo vigneto anagrafica (§11.3.12 scen. 50).
 * Idempotente: varietà marker distintiva + annata 2019 + superficie 0.55 ha.
 * @module tests/e2e/sim/scenarios/vigneti-write
 */

import { gotoVignetiList, loginAsManagerManodopera } from '../helpers/sim-login.js';

export const E2E_VIGNETO_WRITE_VARIETA = 'GFV E2E Sim Noir';
export const E2E_VIGNETO_WRITE_ANNATA = '2019';
export const E2E_VIGNETO_WRITE_SUPERFICIE = '0.55';

/**
 * @param {import('playwright-core').Page} page
 */
function markerVignetoRows(page) {
  return page.locator('#vigneti-tbody tr').filter({ hasText: E2E_VIGNETO_WRITE_VARIETA });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function ensureVarietaInForm(page) {
  const varietaSelect = page.locator('#varieta');
  const hasOption = await varietaSelect.locator('option', { hasText: E2E_VIGNETO_WRITE_VARIETA }).count();
  if (hasOption > 0) {
    await varietaSelect.selectOption({ label: E2E_VIGNETO_WRITE_VARIETA });
    return;
  }
  await page.locator('button[title="Aggiungi nuova varietà"]').click();
  await page.locator('#add-varieta-modal.active').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#new-varieta').fill(E2E_VIGNETO_WRITE_VARIETA);
  await page.locator('#add-varieta-modal form button[type="submit"]').click();
  await page.locator('#add-varieta-modal.active').waitFor({ state: 'hidden', timeout: 15_000 });
  await varietaSelect.selectOption({ label: E2E_VIGNETO_WRITE_VARIETA });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function createMarkerVigneto(page) {
  await page.getByRole('button', { name: /Nuovo Vigneto/i }).click();
  await page.locator('#vigneto-modal.active').waitFor({ state: 'visible', timeout: 30_000 });

  await page.waitForFunction(() => {
    const sel = document.getElementById('terrenoId');
    return sel && sel.querySelectorAll('option:not([value=""])').length >= 1;
  }, undefined, { timeout: 30_000 });

  const terrenoValue = await page.locator('#terrenoId option:not([value=""])').first().getAttribute('value');
  await page.locator('#terrenoId').selectOption(terrenoValue || { index: 1 });
  await ensureVarietaInForm(page);
  await page.locator('#annataImpianto').fill(E2E_VIGNETO_WRITE_ANNATA);
  await page.locator('#formaAllevamento').selectOption({ index: 1 });
  await page.locator('#distanzaFile').fill('2.5');
  await page.locator('#distanzaUnita').fill('0.8');
  await page.waitForFunction(() => {
    const d = document.getElementById('densita');
    return d && parseFloat(d.value) > 0;
  }, undefined, { timeout: 15_000 });
  await page.locator('#superficieEttari').fill(E2E_VIGNETO_WRITE_SUPERFICIE);
  await page.locator('#tipoPalo').selectOption({ index: 1 });
  await page.locator('#destinazioneUva').selectOption('vino');
  await page.locator('#note').fill('GFV_SIM_E2E_WRITE_VIGNETO');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#vigneto-form button[type="submit"]').click();

  await page.waitForFunction(
    (varieta) => {
      const tbody = document.getElementById('vigneti-tbody');
      return tbody && (tbody.textContent || '').includes(varieta);
    },
    E2E_VIGNETO_WRITE_VARIETA,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runVignetiWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerManodopera(page);
  await gotoVignetiList(page);

  if ((await markerVignetoRows(page).count()) === 0) {
    await createMarkerVigneto(page);
  }

  const row = markerVignetoRows(page).first();
  expect(await markerVignetoRows(page).count()).toBeGreaterThanOrEqual(1);
  await expect(row).toContainText(E2E_VIGNETO_WRITE_VARIETA);
  await expect(row).toContainText(E2E_VIGNETO_WRITE_ANNATA);
  await expect(row).toContainText(E2E_VIGNETO_WRITE_SUPERFICIE);
}

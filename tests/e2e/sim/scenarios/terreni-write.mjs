/**
 * E2E write — nuovo terreno azienda (modale lista terreni).
 * Idempotente: marker nome + superficie 6.66 ha + note.
 * @module tests/e2e/sim/scenarios/terreni-write
 */

export const E2E_TERRENO_WRITE_NOME = 'GFV SIM E2E WRITE TERRENO';

export const E2E_TERRENO_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_TERRENO';

export const E2E_TERRENO_WRITE_SUPERFICIE = '6.66';

/**
 * @param {import('playwright-core').Page} page
 */
function terreniRowsWithMarker(page) {
  return page.locator('#terreni-container .terreno-row').filter({ hasText: E2E_TERRENO_WRITE_NOME });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function openNewTerrenoModal(page) {
  await page.locator('#add-terreno-button').click();
  await page.locator('#terreno-modal.active').waitFor({ timeout: 30_000 });
  await page.locator('#modal-title').filter({ hasText: 'Aggiungi Terreno' }).waitFor({ timeout: 15_000 });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function fillAndSubmitNewTerreno(page) {
  await page.locator('#terreno-nome').fill(E2E_TERRENO_WRITE_NOME);
  await page.locator('#terreno-superficie').fill(E2E_TERRENO_WRITE_SUPERFICIE);
  await page.locator('#terreno-tipo-possesso').selectOption('proprieta');
  await page.locator('#terreno-note').fill(E2E_TERRENO_WRITE_NOTE);

  await page.locator('#terreno-form button[type="submit"]').click();

  await page.getByText('Terreno creato con successo', { exact: false }).waitFor({
    timeout: 45_000,
  });
  await page.locator('#terreno-modal.active').waitFor({ state: 'hidden', timeout: 30_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runTerreniWriteAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/terreni-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Terreni' })).toBeVisible();

  await page.waitForFunction(() => {
    const container = document.getElementById('terreni-container');
    return container && container.querySelectorAll('.terreno-row').length >= 4;
  }, { timeout: 45_000 });

  let markerRows = terreniRowsWithMarker(page);
  let rowCount = await markerRows.count();

  if (rowCount === 0) {
    const totalBefore = await page.evaluate(
      () => document.querySelectorAll('#terreni-container .terreno-row').length
    );

    await openNewTerrenoModal(page);
    await fillAndSubmitNewTerreno(page);

    await page.waitForFunction(
      (before) =>
        document.querySelectorAll('#terreni-container .terreno-row').length > before,
      totalBefore,
      { timeout: 30_000 }
    );

    markerRows = terreniRowsWithMarker(page);
    rowCount = await markerRows.count();
  }

  expect(rowCount).toBeGreaterThanOrEqual(1);

  const row = markerRows.first();
  await expect(row.locator('.terreno-name')).toContainText(E2E_TERRENO_WRITE_NOME);
  await expect(row.locator('.terreno-ettari')).toContainText(E2E_TERRENO_WRITE_SUPERFICIE);
  await expect(row.locator('.col-note')).toContainText(E2E_TERRENO_WRITE_NOTE);
}

/**
 * E2E write — nuovo terreno cliente conto terzi (modale terreni clienti).
 * Idempotente: marker nome + superficie 8.88 ha + note.
 * @module tests/e2e/sim/scenarios/terreni-clienti-write
 */

export const E2E_TERRENO_CLIENTI_WRITE_NOME = 'GFV SIM E2E WRITE TERRENO CT';

export const E2E_TERRENO_CLIENTI_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_TERRENO_CT';

export const E2E_TERRENO_CLIENTI_WRITE_SUPERFICIE = '8.88';

/**
 * @param {import('playwright-core').Page} page
 */
function terreniClientiCardsWithMarker(page) {
  return page.locator('#terreni-container .terreno-card').filter({
    hasText: E2E_TERRENO_CLIENTI_WRITE_NOME,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function openNewTerrenoClientiModal(page) {
  await page.locator('#btn-nuovo-terreno').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(() => {
    const btn = document.getElementById('btn-nuovo-terreno');
    return btn && !btn.disabled;
  }, { timeout: 15_000 });
  await page.locator('#btn-nuovo-terreno').click();
  await page.locator('#terreno-modal.active').waitFor({ timeout: 30_000 });
  await page.locator('#modal-title').filter({ hasText: 'Nuovo Terreno' }).waitFor({ timeout: 15_000 });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function fillAndSubmitNewTerrenoCliente(page) {
  await page.locator('#terreno-nome').fill(E2E_TERRENO_CLIENTI_WRITE_NOME);
  await page.locator('#terreno-superficie').fill(E2E_TERRENO_CLIENTI_WRITE_SUPERFICIE);
  await page.locator('#terreno-note').fill(E2E_TERRENO_CLIENTI_WRITE_NOTE);

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
export async function runTerreniClientiWriteAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/terreni-clienti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Terreni Clienti' })).toBeVisible();

  await page.waitForFunction(() => {
    const cards = document.querySelectorAll('#terreni-container .terreno-card');
    return cards.length >= 1;
  }, { timeout: 45_000 });

  let markerCards = terreniClientiCardsWithMarker(page);
  let cardCount = await markerCards.count();

  if (cardCount === 0) {
    const totalBefore = await page.evaluate(
      () => document.querySelectorAll('#terreni-container .terreno-card').length
    );

    await openNewTerrenoClientiModal(page);
    await fillAndSubmitNewTerrenoCliente(page);

    await page.waitForFunction(
      (before) =>
        document.querySelectorAll('#terreni-container .terreno-card').length > before,
      totalBefore,
      { timeout: 30_000 }
    );

    markerCards = terreniClientiCardsWithMarker(page);
    cardCount = await markerCards.count();
  }

  expect(cardCount).toBeGreaterThanOrEqual(1);

  const card = markerCards.first();
  await expect(card).toContainText(E2E_TERRENO_CLIENTI_WRITE_NOME);
  await expect(card).toContainText(E2E_TERRENO_CLIENTI_WRITE_SUPERFICIE);
  await expect(card).toContainText(E2E_TERRENO_CLIENTI_WRITE_NOTE);
}

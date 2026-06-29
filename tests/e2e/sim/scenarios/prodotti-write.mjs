/**
 * E2E write — nuovo prodotto magazzino (modale anagrafica prodotti).
 * Idempotente: marker codice + nome; se già in tabella filtrata, salta la creazione.
 * @module tests/e2e/sim/scenarios/prodotti-write
 */

export const E2E_PRODOTTO_WRITE_CODICE = 'GFV_SIM_E2E_WRITE_PRODOTTO';

export const E2E_PRODOTTO_WRITE_NOME = 'GFV SIM E2E WRITE PRODOTTO';

export const E2E_PRODOTTO_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_PRODOTTO';

const WRITE_SCORTA_MINIMA = '5';

/**
 * @param {import('playwright-core').Page} page
 */
async function clearProdottiFilters(page) {
  await page.locator('#btn-reset-filtri').click();
  await page.waitForFunction(() => {
    const container = document.getElementById('prodotti-container');
    return container && !container.querySelector('.loading');
  }, { timeout: 15_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} marker
 */
async function filterProdottiByMarker(page, marker) {
  const input = page.locator('#filter-search');
  await input.fill('');
  await input.fill(marker);
  await page.waitForFunction(
    (text) => {
      const container = document.getElementById('prodotti-container');
      if (!container || /Caricamento prodotti/i.test(container.textContent || '')) return false;
      const rows = container.querySelectorAll('.prodotti-table tbody tr');
      if (rows.length === 0) {
        const empty = container.querySelector('.empty-state');
        return empty && !/Caricamento/i.test(empty.textContent || '');
      }
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(text));
    },
    marker,
    { timeout: 30_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} marker
 */
function prodottiRowsWithMarker(page, marker) {
  return page
    .locator('#prodotti-container .prodotti-table tbody tr')
    .filter({ hasText: marker });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function openNewProdottoModal(page) {
  await page.locator('#btn-nuovo-prodotto').click();
  await page.locator('#prodotto-modal.active').waitFor({ timeout: 30_000 });
  await page.locator('#prodotto-nome').waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ codice: string, nome: string, note: string }} opts
 */
async function fillAndSubmitNewProdotto(page, { codice, nome, note }) {
  await page.locator('#prodotto-codice').fill(codice);
  await page.locator('#prodotto-nome').fill(nome);
  await page.locator('#prodotto-categoria').selectOption('ricambi');
  await page.locator('#prodotto-unita').selectOption('pezzi');
  await page.locator('#prodotto-scorta-minima').fill(WRITE_SCORTA_MINIMA);
  await page.locator('#prodotto-note').fill(note);

  await page.locator('#prodotto-form button[type="submit"]').click();

  await page.getByText('Prodotto creato.', { exact: true }).waitFor({ timeout: 45_000 });
  await page.locator('#prodotto-modal.active').waitFor({ state: 'hidden', timeout: 30_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runProdottiWriteAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/prodotti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Anagrafica Prodotti' })).toBeVisible();

  await page.waitForFunction(() => {
    const container = document.getElementById('prodotti-container');
    return container && container.querySelectorAll('.prodotti-table tbody tr').length >= 5;
  }, { timeout: 45_000 });

  await clearProdottiFilters(page);
  await filterProdottiByMarker(page, E2E_PRODOTTO_WRITE_CODICE);

  let markerRows = prodottiRowsWithMarker(page, E2E_PRODOTTO_WRITE_CODICE);
  let rowCount = await markerRows.count();

  if (rowCount === 0) {
    const totalBefore = await page.evaluate(
      () => document.querySelectorAll('#prodotti-container .prodotti-table tbody tr').length
    );

    await page.locator('#filter-search').fill('');
    await page.waitForFunction(() => {
      const container = document.getElementById('prodotti-container');
      return container && container.querySelectorAll('.prodotti-table tbody tr').length >= 5;
    }, { timeout: 15_000 });

    await openNewProdottoModal(page);
    await fillAndSubmitNewProdotto(page, {
      codice: E2E_PRODOTTO_WRITE_CODICE,
      nome: E2E_PRODOTTO_WRITE_NOME,
      note: E2E_PRODOTTO_WRITE_NOTE,
    });

    await page.waitForFunction(
      (before) =>
        document.querySelectorAll('#prodotti-container .prodotti-table tbody tr').length > before,
      totalBefore,
      { timeout: 30_000 }
    );

    await clearProdottiFilters(page);
    await filterProdottiByMarker(page, E2E_PRODOTTO_WRITE_CODICE);
    markerRows = prodottiRowsWithMarker(page, E2E_PRODOTTO_WRITE_CODICE);
    rowCount = await markerRows.count();
  }

  expect(rowCount).toBeGreaterThanOrEqual(1);

  const row = markerRows.first();
  await expect(row.locator('td').nth(0)).toContainText(E2E_PRODOTTO_WRITE_CODICE);
  await expect(row.locator('td').nth(1)).toContainText(E2E_PRODOTTO_WRITE_NOME);
  await expect(row.locator('td').nth(2)).toContainText('ricambi');
  await expect(row.locator('td').nth(3)).toContainText('pezzi');
  await expect(row.locator('td').nth(4)).toContainText('0');
  await expect(row.locator('td').nth(5)).toContainText(WRITE_SCORTA_MINIMA);
  await expect(row.locator('.badge-attivo')).toBeVisible();
}

/**
 * E2E write — nuovo movimento magazzino (entrata) dal modale lista movimenti.
 * Idempotente: marker note fisso; se già in tabella, salta la creazione.
 * @module tests/e2e/sim/scenarios/movimenti-write
 */

export const E2E_MOVIMENTO_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_MOVIMENTO';

const WRITE_QUANTITA = '1';

/**
 * @param {import('playwright-core').Page} page
 * @param {string} marker
 */
async function waitForMovimentiTableWithMarker(page, marker) {
  await page.waitForFunction(
    (note) => {
      const container = document.getElementById('movimenti-container');
      if (!container || /Caricamento movimenti/i.test(container.textContent || '')) return false;
      const rows = container.querySelectorAll('.movimenti-table tbody tr');
      if (rows.length === 0) {
        const empty = container.querySelector('.empty-state');
        return empty && !/Caricamento/i.test(empty.textContent || '');
      }
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(note));
    },
    marker,
    { timeout: 30_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} marker
 */
function movimentiRowsWithMarker(page, marker) {
  return page.locator('#movimenti-container .movimenti-table tbody tr').filter({ hasText: marker });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function openNewMovimentoModal(page) {
  await page.locator('#btn-nuovo-movimento').click();
  await page.locator('#movimento-modal.active').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const sel = document.getElementById('mov-prodotto');
    return sel && sel.options.length > 1;
  }, { timeout: 45_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ note: string }} opts
 * @returns {Promise<{ prodottoLabel: string }>}
 */
async function fillAndSubmitNewMovimento(page, { note }) {
  const prodottoSelect = page.locator('#mov-prodotto');
  const prodottoLabel = ((await prodottoSelect.locator('option').nth(1).textContent()) || '').trim();
  await prodottoSelect.selectOption({ index: 1 });

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.locator('#mov-data').fill(today);
  await page.locator('#mov-tipo').selectOption('entrata');
  await page.locator('#mov-quantita').fill(WRITE_QUANTITA);
  await page.locator('#mov-note').fill(note);

  await page.locator('#movimento-form button[type="submit"]').click();

  await page.getByText('Movimento registrato.', { exact: true }).waitFor({ timeout: 45_000 });
  await page.locator('#movimento-modal.active').waitFor({ state: 'hidden', timeout: 30_000 });

  return { prodottoLabel };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runMovimentiWriteAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/movimenti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Movimenti Magazzino' })).toBeVisible();

  await page.waitForFunction(() => {
    const container = document.getElementById('movimenti-container');
    return container && container.querySelectorAll('.movimenti-table tbody tr').length >= 10;
  }, { timeout: 45_000 });

  let markerRows = movimentiRowsWithMarker(page, E2E_MOVIMENTO_WRITE_NOTE);
  let rowCount = await markerRows.count();

  let expectedProdotto = '';

  if (rowCount === 0) {
    const totalBefore = await page.evaluate(
      () => document.querySelectorAll('#movimenti-container .movimenti-table tbody tr').length
    );

    await openNewMovimentoModal(page);
    const created = await fillAndSubmitNewMovimento(page, { note: E2E_MOVIMENTO_WRITE_NOTE });
    expectedProdotto = created.prodottoLabel;

    await page.waitForFunction(
      (before) =>
        document.querySelectorAll('#movimenti-container .movimenti-table tbody tr').length > before,
      totalBefore,
      { timeout: 30_000 }
    );

    await waitForMovimentiTableWithMarker(page, E2E_MOVIMENTO_WRITE_NOTE);
    markerRows = movimentiRowsWithMarker(page, E2E_MOVIMENTO_WRITE_NOTE);
    rowCount = await markerRows.count();
  } else {
    const firstRow = markerRows.first();
    expectedProdotto = ((await firstRow.locator('td').nth(1).textContent()) || '').trim();
  }

  expect(rowCount).toBeGreaterThanOrEqual(1);

  const row = markerRows.first();
  await expect(row.locator('.badge-entrata')).toBeVisible();
  await expect(row).toContainText(E2E_MOVIMENTO_WRITE_NOTE);
  await expect(row.locator('td').nth(3)).toContainText(WRITE_QUANTITA);

  if (expectedProdotto) {
    const prodottoShort = expectedProdotto.split('(')[0].trim();
    await expect(row.locator('td').nth(1)).toContainText(prodottoShort);
  }
}

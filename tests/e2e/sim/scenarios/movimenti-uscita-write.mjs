/**
 * E2E write — nuovo movimento magazzino (uscita) dal modale lista movimenti.
 * Idempotente: marker note fisso; se già in tabella, salta la creazione.
 * @module tests/e2e/sim/scenarios/movimenti-uscita-write
 */

export const E2E_MOVIMENTO_USCITA_WRITE_NOTE = 'GFV_SIM_E2E_SCARICO';

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
    return sel && sel.options.length > 1 && Array.isArray(window.__gfvMagazzinoProdotti);
  }, { timeout: 45_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {number} minQty
 * @returns {Promise<{ id: string, label: string }>}
 */
async function pickProdottoWithGiacenza(page, minQty) {
  const picked = await page.evaluate((qty) => {
    const prodotti = window.__gfvMagazzinoProdotti || [];
    let best = null;
    for (const p of prodotti) {
      const giacenza = p.giacenza != null ? Number(p.giacenza) : 0;
      if (giacenza >= qty && (!best || giacenza > best.giacenza)) {
        best = { id: p.id, label: p.nome || p.codice || p.id, giacenza };
      }
    }
    return best;
  }, minQty);

  if (!picked?.id) {
    throw new Error(`Nessun prodotto con giacenza >= ${minQty} per uscita magazzino E2E`);
  }

  return { id: picked.id, label: picked.label };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ note: string, prodottoId: string }} opts
 * @returns {Promise<{ prodottoLabel: string }>}
 */
async function fillAndSubmitUscitaMovimento(page, { note, prodottoId }) {
  await page.locator('#mov-prodotto').selectOption(prodottoId);

  const prodottoLabel = ((await page.locator('#mov-prodotto option:checked').textContent()) || '').trim();

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.locator('#mov-data').fill(today);
  await page.locator('#mov-tipo').selectOption('uscita');
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
export async function runMovimentiUscitaWriteAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/movimenti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Movimenti Magazzino' })).toBeVisible();

  await page.waitForFunction(() => {
    const container = document.getElementById('movimenti-container');
    return container && container.querySelectorAll('.movimenti-table tbody tr').length >= 10;
  }, { timeout: 45_000 });

  let markerRows = movimentiRowsWithMarker(page, E2E_MOVIMENTO_USCITA_WRITE_NOTE);
  let rowCount = await markerRows.count();

  let expectedProdotto = '';

  if (rowCount === 0) {
    const totalBefore = await page.evaluate(
      () => document.querySelectorAll('#movimenti-container .movimenti-table tbody tr').length
    );

    await openNewMovimentoModal(page);
    const prodotto = await pickProdottoWithGiacenza(page, parseFloat(WRITE_QUANTITA));
    const created = await fillAndSubmitUscitaMovimento(page, {
      note: E2E_MOVIMENTO_USCITA_WRITE_NOTE,
      prodottoId: prodotto.id,
    });
    expectedProdotto = created.prodottoLabel || prodotto.label;

    await page.waitForFunction(
      (before) =>
        document.querySelectorAll('#movimenti-container .movimenti-table tbody tr').length > before,
      totalBefore,
      { timeout: 30_000 }
    );

    await waitForMovimentiTableWithMarker(page, E2E_MOVIMENTO_USCITA_WRITE_NOTE);
    markerRows = movimentiRowsWithMarker(page, E2E_MOVIMENTO_USCITA_WRITE_NOTE);
    rowCount = await markerRows.count();
  } else {
    const firstRow = markerRows.first();
    expectedProdotto = ((await firstRow.locator('td').nth(1).textContent()) || '').trim();
  }

  expect(rowCount).toBeGreaterThanOrEqual(1);

  const row = markerRows.first();
  await expect(row.locator('.badge-uscita')).toBeVisible();
  await expect(row).toContainText(E2E_MOVIMENTO_USCITA_WRITE_NOTE);
  await expect(row.locator('td').nth(3)).toContainText(WRITE_QUANTITA);

  if (expectedProdotto) {
    const prodottoShort = expectedProdotto.split('(')[0].trim();
    await expect(row.locator('td').nth(1)).toContainText(prodottoShort);
  }
}

/**
 * E2E catena A+B — completa trattamento frutteto stub da attività + scarico magazzino.
 * @module tests/e2e/sim/scenarios/trattamento-frutteto-completa-write
 */

import {
  gotoFruttetoTrattamentiList,
  gotoMovimentiList,
  loginAsManagerFrutteto,
} from '../helpers/sim-login.js';

export const E2E_TRATTAMENTO_FRUTTETO_NOTE = 'GFV_SIM_E2E_COMPLETA_TRATTAMENTO_FRUTTETO';
export const E2E_TRATTAMENTO_FRUTTETO_DOSAGGIO = '2.5';

function trattamentoStubFromAttivitaRows(page) {
  return page.locator('#tbody-trattamenti tr').filter({
    has: page.getByRole('link', { name: /Vedi Attività/i }),
  });
}

async function waitForTrattamentiTableReady(page) {
  await page.waitForFunction(() => {
    const loading = document.getElementById('loading');
    const wrap = document.getElementById('table-wrap');
    if (loading && loading.style.display !== 'none') return false;
    return wrap && wrap.style.display !== 'none' && document.querySelectorAll('#tbody-trattamenti tr').length >= 1;
  }, undefined, { timeout: 90_000 });
}

async function countFilledAttivitaStubRows(page) {
  const rows = trattamentoStubFromAttivitaRows(page);
  const count = await rows.count();
  let filled = 0;
  for (let i = 0; i < count; i += 1) {
    const prodotto = ((await rows.nth(i).locator('td').nth(4).textContent()) || '').trim();
    if (prodotto && prodotto !== '-' && prodotto !== '' && prodotto !== '—') filled += 1;
  }
  return filled;
}

async function countMovimentiUscita(page) {
  await page.waitForFunction(() => {
    const container = document.getElementById('movimenti-container');
    if (!container || /Caricamento movimenti/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.movimenti-table tbody tr').length >= 1;
  }, undefined, { timeout: 60_000 });
  return page.locator('#movimenti-container .movimenti-table tbody tr .badge-uscita').count();
}

/**
 * Attende almeno `minimum` uscite, ricaricando la pagina movimenti se Firestore non ha ancora propagato lo scarico.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 * @param {number} minimum
 */
async function waitForMovimentiUscitaAtLeast(page, expect, minimum) {
  await gotoMovimentiList(page);
  await expect.poll(
    async () => {
      const count = await countMovimentiUscita(page);
      if (count >= minimum) return count;
      await page.reload();
      return countMovimentiUscita(page);
    },
    {
      timeout: 90_000,
      intervals: [500, 1000, 2000, 3000],
      message: `Attesa almeno ${minimum} uscite in movimenti`,
    }
  ).toBeGreaterThanOrEqual(minimum);
}

async function findIncompleteTrattamentoRow(page) {
  const rows = trattamentoStubFromAttivitaRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const prodotto = ((await row.locator('td').nth(4).textContent()) || '').trim();
    if (prodotto === '-' || prodotto === '' || prodotto === '—') return row;
  }
  return null;
}

async function completeTrattamentoStub(page, filledBefore) {
  const row = await findIncompleteTrattamentoRow(page);
  if (!row) throw new Error('Nessuno stub trattamento frutteto incompleto');

  const modifica = row.getByRole('button', { name: /Modifica/i });
  const completa = row.getByRole('button', { name: /^Completa$/i });
  if (await modifica.count()) {
    await modifica.click();
  } else {
    await completa.click();
  }

  await page.locator('#modal-trattamento.active').waitFor({ state: 'visible', timeout: 30_000 });

  await page.waitForFunction(
    () => {
      const sel = document.querySelector('#tbody-prodotti-trattamento .prodotto-select');
      return sel && sel.querySelectorAll('option[value]:not([value=""])').length >= 1;
    },
    undefined,
    { timeout: 60_000 }
  );

  const productSelect = page.locator('#tbody-prodotti-trattamento .prodotto-select').first();
  const productOption = productSelect.locator('option[value]:not([value=""])').first();
  const productValue = await productOption.getAttribute('value');
  const productLabel = ((await productOption.textContent()) || '').trim();
  await productSelect.selectOption(productValue || { index: 1 });
  await page
    .locator('#tbody-prodotti-trattamento .prodotto-dosaggio')
    .first()
    .fill(E2E_TRATTAMENTO_FRUTTETO_DOSAGGIO);

  await page.locator('#trattamento-note').fill(E2E_TRATTAMENTO_FRUTTETO_NOTE);

  const scaricoGroup = page.locator('#trattamento-scarico-magazzino-group');
  const scaricoCb = page.locator('#trattamento-registra-scarico-magazzino');
  if (await scaricoGroup.isVisible()) {
    await scaricoCb.check();
  }

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#form-trattamento button[type="submit"]').click();
  await page.locator('#modal-trattamento.active').waitFor({ state: 'hidden', timeout: 90_000 });
  await waitForTrattamentiTableReady(page);

  await page.waitForFunction(
    (minFilled) => {
      const rows = document.querySelectorAll('#tbody-trattamenti tr');
      let filled = 0;
      for (const tr of rows) {
        if (!/Vedi Attività/i.test(tr.textContent || '')) continue;
        const prodotto = (tr.querySelectorAll('td')[4]?.textContent || '').trim();
        if (prodotto && prodotto !== '-' && prodotto !== '—') filled += 1;
      }
      return filled >= minFilled;
    },
    filledBefore + 1,
    { timeout: 90_000 }
  );

  return { productLabel };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runTrattamentoFruttetoCompletaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFrutteto(page);
  await gotoFruttetoTrattamentiList(page);
  await waitForTrattamentiTableReady(page);

  const filledBefore = await countFilledAttivitaStubRows(page);
  const incompleteRow = await findIncompleteTrattamentoRow(page);

  if (incompleteRow) {
    await gotoMovimentiList(page);
    const usciteBefore = await countMovimentiUscita(page);

    await gotoFruttetoTrattamentiList(page);
    await waitForTrattamentiTableReady(page);
    const { productLabel } = await completeTrattamentoStub(page, filledBefore);

    expect(await findIncompleteTrattamentoRow(page)).toBeNull();

    const filledAfter = await countFilledAttivitaStubRows(page);
    expect(filledAfter).toBeGreaterThanOrEqual(filledBefore + 1);

    if (productLabel) {
      const rowWithProduct = trattamentoStubFromAttivitaRows(page).filter({
        hasText: productLabel.slice(0, 12),
      });
      await expect(rowWithProduct.first()).toBeVisible({ timeout: 60_000 });
    }

    await waitForMovimentiUscitaAtLeast(page, expect, usciteBefore + 1);
  } else {
    expect(filledBefore).toBeGreaterThanOrEqual(1);
    await expect(trattamentoStubFromAttivitaRows(page).first().locator('td').nth(4)).not.toHaveText('-');
  }
}

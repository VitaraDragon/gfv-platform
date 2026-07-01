/**
 * E2E catena A+B — completa trattamento stub da lavoro + scarico magazzino (§11.3.12 scen. 53).
 * @module tests/e2e/sim/scenarios/trattamento-completa-write
 */

import {
  gotoMovimentiList,
  gotoTrattamentiList,
  loginAsManagerManodopera,
} from '../helpers/sim-login.js';

export const E2E_TRATTAMENTO_COMPLETA_NOTE = 'GFV_SIM_E2E_COMPLETA_TRATTAMENTO';
export const E2E_TRATTAMENTO_COMPLETA_DOSAGGIO = '2.5';

/**
 * Stub trattamento da lavoro manodopera (prodotto vuoto, link lavoro).
 * @param {import('playwright-core').Page} page
 */
function trattamentoStubFromLavoroRows(page) {
  return page.locator('#tbody-trattamenti tr').filter({
    has: page.getByRole('link', { name: /Vedi Lavoro/i }),
    hasText: /Trattamento/i,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function countMovimentiUscita(page) {
  return page.locator('#movimenti-container .movimenti-table tbody tr .badge-uscita').count();
}

/**
 * @param {import('playwright-core').Page} page
 */
async function findIncompleteTrattamentoLavoroRow(page) {
  const rows = trattamentoStubFromLavoroRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const prodotto = ((await row.locator('td').nth(4).textContent()) || '').trim();
    if (prodotto === '-' || prodotto === '') {
      return row;
    }
  }
  return null;
}

/**
 * @param {import('playwright-core').Page} page
 */
async function completeTrattamentoStubFromLavoro(page) {
  const row = await findIncompleteTrattamentoLavoroRow(page);
  if (!row) throw new Error('Nessuno stub trattamento da lavoro incompleto in lista');

  const lavoroLabel = ((await row.locator('td').nth(2).textContent()) || '').trim();

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
  await page.locator('#tbody-prodotti-trattamento .prodotto-dosaggio').first().fill(E2E_TRATTAMENTO_COMPLETA_DOSAGGIO);
  await page.locator('#trattamento-note').fill(E2E_TRATTAMENTO_COMPLETA_NOTE);

  const scaricoGroup = page.locator('#trattamento-scarico-magazzino-group');
  const scaricoCb = page.locator('#trattamento-registra-scarico-magazzino');
  if (await scaricoGroup.isVisible()) {
    await scaricoCb.check();
  }

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#form-trattamento button[type="submit"]').click();

  await page.locator('#modal-trattamento.active').waitFor({ state: 'hidden', timeout: 90_000 });
  await page.waitForFunction(
    (lavoroPrefix) => {
      const rows = document.querySelectorAll('#tbody-trattamenti tr');
      return Array.from(rows).some((tr) => {
        const t = tr.textContent || '';
        if (!t.includes(lavoroPrefix.slice(0, 15))) return false;
        const cells = tr.querySelectorAll('td');
        const prodotto = (cells[4]?.textContent || '').trim();
        return prodotto !== '-' && prodotto !== '';
      });
    },
    lavoroLabel,
    { timeout: 90_000 }
  );

  return { productLabel, lavoroLabel };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runTrattamentoCompletaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerManodopera(page);
  await gotoTrattamentiList(page);

  let incompleteRow = await findIncompleteTrattamentoLavoroRow(page);

  if (incompleteRow) {
    await gotoMovimentiList(page);
    const usciteBefore = await countMovimentiUscita(page);

    await gotoTrattamentiList(page);
    const { productLabel } = await completeTrattamentoStubFromLavoro(page);

    incompleteRow = await findIncompleteTrattamentoLavoroRow(page);
    expect(incompleteRow).toBeNull();

    const prodottoCell = trattamentoStubFromLavoroRows(page).first().locator('td').nth(4);
    await expect(prodottoCell).not.toHaveText('-');
    if (productLabel) {
      await expect(prodottoCell).toContainText(productLabel.slice(0, 12));
    }

    await gotoMovimentiList(page);
    const usciteAfter = await countMovimentiUscita(page);
    expect(usciteAfter).toBeGreaterThanOrEqual(usciteBefore + 1);
  } else {
    expect(await trattamentoStubFromLavoroRows(page).count()).toBeGreaterThanOrEqual(1);
    await expect(trattamentoStubFromLavoroRows(page).first().locator('td').nth(4)).not.toHaveText('-');
  }
}

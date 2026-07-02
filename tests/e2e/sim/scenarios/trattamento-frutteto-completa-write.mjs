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

async function countMovimentiUscita(page) {
  return page.locator('#movimenti-container .movimenti-table tbody tr .badge-uscita').count();
}

async function findIncompleteTrattamentoRow(page) {
  const rows = trattamentoStubFromAttivitaRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const prodotto = ((await row.locator('td').nth(4).textContent()) || '').trim();
    if (prodotto === '-' || prodotto === '') return row;
  }
  return null;
}

async function completeTrattamentoStub(page) {
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
  await productSelect.selectOption(productValue || { index: 1 });
  await page
    .locator('#tbody-prodotti-trattamento .prodotto-dosaggio')
    .first()
    .fill(E2E_TRATTAMENTO_FRUTTETO_DOSAGGIO);

  await page.locator('#trattamento-note').fill(E2E_TRATTAMENTO_FRUTTETO_NOTE);

  const scaricoCb = page.locator('#trattamento-registra-scarico-magazzino');
  if (await scaricoCb.isVisible()) {
    await scaricoCb.check({ force: true });
  }

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#form-trattamento button[type="submit"]').click();
  await page.locator('#modal-trattamento.active').waitFor({ state: 'hidden', timeout: 90_000 });
}

export async function runTrattamentoFruttetoCompletaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFrutteto(page);
  await gotoFruttetoTrattamentiList(page);

  const completedRows = trattamentoStubFromAttivitaRows(page).filter({
    hasText: E2E_TRATTAMENTO_FRUTTETO_NOTE,
  });

  let incompleteRow = await findIncompleteTrattamentoRow(page);

  if (incompleteRow) {
    await gotoMovimentiList(page);
    const usciteBefore = await countMovimentiUscita(page);

    await gotoFruttetoTrattamentiList(page);
    await completeTrattamentoStub(page);

    incompleteRow = await findIncompleteTrattamentoRow(page);
    expect(incompleteRow).toBeNull();

    await gotoMovimentiList(page);
    const usciteAfter = await countMovimentiUscita(page);
    expect(usciteAfter).toBeGreaterThanOrEqual(usciteBefore + 1);
  } else if ((await completedRows.count()) === 0) {
    expect(await trattamentoStubFromAttivitaRows(page).count()).toBeGreaterThanOrEqual(1);
    await expect(trattamentoStubFromAttivitaRows(page).first().locator('td').nth(4)).not.toHaveText('-');

    await gotoMovimentiList(page);
    expect(await countMovimentiUscita(page)).toBeGreaterThanOrEqual(1);
  } else {
    await expect(completedRows.first().locator('td').nth(4)).not.toHaveText('-');
  }
}

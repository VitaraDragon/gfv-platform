/**
 * E2E catena A+B — completa concimazione frutteto stub da attività seed + scarico magazzino.
 * @module tests/e2e/sim/scenarios/concimazione-frutteto-completa-write
 */

import {
  gotoFruttetoConcimazioniList,
  gotoMovimentiList,
  loginAsManagerFrutteto,
} from '../helpers/sim-login.js';

export const E2E_CONCIMAZIONE_FRUTTETO_NOTE = 'GFV_SIM_E2E_CONCIMAZIONE_FRUTTETO';
export const E2E_CONCIMAZIONE_FRUTTETO_DOSAGGIO = '3';

function concimazioneStubFromAttivitaRows(page) {
  return page.locator('#table-wrap tbody tr').filter({
    has: page.getByRole('link', { name: /Vedi Attività/i }),
  });
}

async function waitForConcimazioniTableReady(page) {
  await page.waitForFunction(() => {
    const loading = document.getElementById('loading');
    const wrap = document.getElementById('table-wrap');
    if (loading && loading.style.display !== 'none') return false;
    return wrap && wrap.style.display !== 'none' && document.querySelectorAll('#table-wrap tbody tr').length >= 1;
  }, undefined, { timeout: 90_000 });
}

async function countFilledAttivitaStubRows(page) {
  const rows = concimazioneStubFromAttivitaRows(page);
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

async function ensureSuperficieTrattamento(page) {
  const superficieInput = page.locator('#trattamento-superficie');
  const current = await superficieInput.inputValue();
  if (current && parseFloat(current) > 0) return;

  const cbAnagrafe = page.locator('#trattamento-superficie-anagrafe');
  const canUseAnagrafe = (await cbAnagrafe.count()) > 0
    && (await cbAnagrafe.isVisible())
    && !(await cbAnagrafe.isDisabled());

  if (canUseAnagrafe) {
    await cbAnagrafe.check();
    await page.waitForFunction(
      () => {
        const v = document.getElementById('trattamento-superficie')?.value;
        return v && parseFloat(v) > 0;
      },
      undefined,
      { timeout: 30_000 }
    );
  } else {
    await superficieInput.fill('1.5');
  }

  await page.waitForFunction(
    () => {
      const span = document.querySelector('#tbody-prodotti-trattamento .prodotto-quantita');
      const t = (span?.textContent || '').trim();
      return t && t !== '-' && parseFloat(t) > 0;
    },
    undefined,
    { timeout: 30_000 }
  );
}

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
      message: `Attesa almeno ${minimum} movimenti uscita in magazzino`,
    }
  ).toBeGreaterThanOrEqual(minimum);
}

async function findIncompleteConcimazioneRow(page) {
  const rows = concimazioneStubFromAttivitaRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const prodotto = ((await row.locator('td').nth(4).textContent()) || '').trim();
    if (prodotto === '-' || prodotto === '' || prodotto === '—') return row;
  }
  return null;
}

async function completeConcimazioneStub(page, filledBefore) {
  const row = await findIncompleteConcimazioneRow(page);
  if (!row) throw new Error('Nessuno stub concimazione frutteto incompleto');

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
    .fill(E2E_CONCIMAZIONE_FRUTTETO_DOSAGGIO);

  await ensureSuperficieTrattamento(page);
  await page.locator('#trattamento-note').fill(E2E_CONCIMAZIONE_FRUTTETO_NOTE);

  const scaricoGroup = page.locator('#trattamento-scarico-magazzino-group');
  const scaricoCb = page.locator('#trattamento-registra-scarico-magazzino');
  if (await scaricoGroup.isVisible()) {
    await scaricoCb.check();
  }

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#form-trattamento button[type="submit"]').click();
  await page.locator('#modal-trattamento.active').waitFor({ state: 'hidden', timeout: 90_000 });
  await waitForConcimazioniTableReady(page);

  await page.waitForFunction(
    (minFilled) => {
      const rows = document.querySelectorAll('#table-wrap tbody tr');
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
export async function runConcimazioneFruttetoCompletaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFrutteto(page);
  await gotoFruttetoConcimazioniList(page);
  await waitForConcimazioniTableReady(page);

  const filledBefore = await countFilledAttivitaStubRows(page);
  const incompleteRow = await findIncompleteConcimazioneRow(page);

  if (incompleteRow) {
    await gotoMovimentiList(page);
    const usciteBefore = await countMovimentiUscita(page);

    await gotoFruttetoConcimazioniList(page);
    await waitForConcimazioniTableReady(page);
    const { productLabel } = await completeConcimazioneStub(page, filledBefore);

    const filledAfter = await countFilledAttivitaStubRows(page);
    expect(filledAfter).toBeGreaterThanOrEqual(filledBefore + 1);

    if (productLabel) {
      const rowWithProduct = concimazioneStubFromAttivitaRows(page).filter({
        hasText: productLabel.slice(0, 12),
      });
      await expect(rowWithProduct.first()).toBeVisible({ timeout: 60_000 });
    }

    await waitForMovimentiUscitaAtLeast(page, expect, usciteBefore + 1);
  } else {
    expect(filledBefore).toBeGreaterThanOrEqual(1);
    await expect(concimazioneStubFromAttivitaRows(page).first().locator('td').nth(4)).not.toHaveText('-');
  }
}

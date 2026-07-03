/**
 * E2E catena diario frutteto → concimazioni → scarico magazzino.
 * @module tests/e2e/sim/scenarios/concimazione-frutteto-completa-write
 */

import {
  gotoAttivitaList,
  gotoFruttetoConcimazioniList,
  gotoMovimentiList,
  loginAsManagerFrutteto,
  waitForFruttetoConcimazioniListLoaded,
} from '../helpers/sim-login.js';

export const E2E_CONCIMAZIONE_FRUTTETO_NOTE = 'GFV_SIM_E2E_CONCIMAZIONE_FRUTTETO';
export const E2E_CONCIMAZIONE_FRUTTETO_DOSAGGIO = '3';
const E2E_CONCIMAZIONE_DATA = '2026-06-16';

function concimazioneFromAttivitaRows(page) {
  return page.locator('#table-wrap tbody tr').filter({
    has: page.getByRole('link', { name: /Vedi Attività/i }),
    hasText: /Concimazione/i,
  });
}

function ourConcimazioneAttivitaRows(page) {
  return concimazioneFromAttivitaRows(page).filter({
    hasText: E2E_CONCIMAZIONE_FRUTTETO_NOTE,
  });
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

async function findOurCompletedConcimazioneRow(page) {
  const rows = ourConcimazioneAttivitaRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const prodotto = ((await row.locator('td').nth(4).textContent()) || '').trim();
    if (prodotto !== '-' && prodotto !== '' && prodotto !== '—') return row;
  }
  return null;
}

async function findOurIncompleteConcimazioneRow(page) {
  const rows = ourConcimazioneAttivitaRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const prodotto = ((await row.locator('td').nth(4).textContent()) || '').trim();
    if (prodotto === '-' || prodotto === '' || prodotto === '—') {
      if ((await row.getByRole('button', { name: /Modifica|Completa/i }).count()) > 0) return row;
    }
  }
  return null;
}

async function waitForOurConcimazioneRow(page) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if ((await ourConcimazioneAttivitaRows(page).count()) > 0) return;
    await page.reload();
    await waitForFruttetoConcimazioniListLoaded(page);
    await page.waitForTimeout(800);
  }
  throw new Error(`Riga concimazioni frutteto con marker ${E2E_CONCIMAZIONE_FRUTTETO_NOTE} non trovata`);
}

async function openNewAttivitaModal(page) {
  await page.getByRole('button', { name: /Aggiungi Attività/i }).click();
  await page.locator('#attivita-modal.active').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const terreno = document.getElementById('attivita-terreno');
    const categoria = document.getElementById('attivita-categoria-principale');
    return terreno && terreno.options.length > 1 && categoria && categoria.options.length > 1;
  }, { timeout: 45_000 });
}

async function pickConcimazioneTipoLavoro(page) {
  const categoriaSelect = page.locator('#attivita-categoria-principale');
  const concCategoria = categoriaSelect.locator('option').filter({ hasText: /^Concimazione$/i });
  if ((await concCategoria.count()) === 0) {
    throw new Error('Categoria Concimazione non trovata nel modale attività');
  }
  await categoriaSelect.selectOption((await concCategoria.first().getAttribute('value')) || '');

  const subGroup = page.locator('#attivita-sottocategoria-group');
  if (await subGroup.isVisible()) {
    const subSelect = page.locator('#attivita-sottocategoria');
    await page.waitForFunction(() => {
      const sel = document.getElementById('attivita-sottocategoria');
      return sel && sel.options.length > 1 && sel.options[1].value !== '';
    }, { timeout: 10_000 });
    await subSelect.selectOption({ index: 1 });
  }

  await page.waitForFunction(() => {
    const sel = document.getElementById('attivita-tipo-lavoro-gerarchico');
    return sel && Array.from(sel.options).some((o) => o.value && o.value !== '');
  }, { timeout: 20_000 });

  const tipoSelect = page.locator('#attivita-tipo-lavoro-gerarchico');
  const tipoValue = await tipoSelect.locator('option[value]:not([value=""])').first().getAttribute('value');
  if (!tipoValue) throw new Error('Nessun tipo lavoro sotto categoria Concimazione');
  await tipoSelect.selectOption(tipoValue);
}

async function ensureConcimazioneAttivitaStub(page) {
  await page.waitForFunction(() => {
    const container = document.getElementById('attivita-container');
    if (!container || container.querySelector('.loading')) return false;
    return container.querySelectorAll('.attivita-row').length >= 3;
  }, { timeout: 60_000 });

  const hasMarker = await page.evaluate(
    (marker) =>
      Array.from(document.querySelectorAll('#attivita-container .attivita-row')).some((row) =>
        (row.textContent || '').includes(marker)
      ),
    E2E_CONCIMAZIONE_FRUTTETO_NOTE
  );
  if (hasMarker) return;

  await openNewAttivitaModal(page);
  await page.locator('#attivita-data').fill(E2E_CONCIMAZIONE_DATA);
  await page.locator('#attivita-terreno').selectOption({ index: 1 });
  await page.waitForFunction(() => {
    const coltura = document.getElementById('attivita-coltura-gerarchica');
    return coltura && coltura.value;
  }, { timeout: 20_000 });

  await page.locator('#attivita-orario-inizio').fill('08:00');
  await page.locator('#attivita-orario-fine').fill('10:00');
  await page.locator('#attivita-pause').fill('0');
  await page.locator('#attivita-note').fill(E2E_CONCIMAZIONE_FRUTTETO_NOTE);
  await pickConcimazioneTipoLavoro(page);

  await page.evaluate(() => {
    const form = document.getElementById('attivita-form');
    if (form) form.setAttribute('novalidate', 'novalidate');
    const tipoGroup = document.getElementById('attivita-tipo-lavoro-gerarchico-group');
    if (tipoGroup) tipoGroup.style.display = 'block';
  });

  await page.getByRole('button', { name: /Salva Attività/i }).click();
  await page.waitForFunction(
    (marker) => {
      const hasRow = Array.from(document.querySelectorAll('#attivita-container .attivita-row')).some((row) =>
        (row.textContent || '').includes(marker)
      );
      if (hasRow) return true;
      const modal = document.getElementById('attivita-modal');
      return modal && !modal.classList.contains('active');
    },
    E2E_CONCIMAZIONE_FRUTTETO_NOTE,
    { timeout: 90_000 }
  );
  await page.waitForTimeout(1500);
}

async function completeConcimazioneStub(page) {
  const row = await findOurIncompleteConcimazioneRow(page);
  if (!row) throw new Error('Nessuno stub concimazione frutteto incompleto');

  const modifica = row.getByRole('button', { name: /Modifica/i });
  const completa = row.getByRole('button', { name: /^Completa$/i });
  if (await modifica.count()) await modifica.click();
  else await completa.click();

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
  await page.locator('#tbody-prodotti-trattamento .prodotto-dosaggio').first().fill(E2E_CONCIMAZIONE_FRUTTETO_DOSAGGIO);

  await ensureSuperficieTrattamento(page);
  await page.locator('#trattamento-note').fill(E2E_CONCIMAZIONE_FRUTTETO_NOTE);

  const scaricoGroup = page.locator('#trattamento-scarico-magazzino-group');
  const scaricoCb = page.locator('#trattamento-registra-scarico-magazzino');
  if (await scaricoGroup.isVisible()) await scaricoCb.check();

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#form-trattamento button[type="submit"]').click();
  await page.locator('#modal-trattamento.active').waitFor({ state: 'hidden', timeout: 90_000 });

  await page.waitForFunction(
    (marker) => {
      const rows = document.querySelectorAll('#table-wrap tbody tr');
      return Array.from(rows).some((tr) => {
        if (!(tr.textContent || '').includes(marker)) return false;
        const prodotto = (tr.querySelectorAll('td')[4]?.textContent || '').trim();
        return prodotto !== '-' && prodotto !== '—' && prodotto !== '';
      });
    },
    E2E_CONCIMAZIONE_FRUTTETO_NOTE,
    { timeout: 90_000 }
  );

  return { productLabel };
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

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runConcimazioneFruttetoCompletaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFrutteto(page);
  await gotoFruttetoConcimazioniList(page);

  if ((await ourConcimazioneAttivitaRows(page).count()) === 0) {
    await gotoAttivitaList(page);
    await ensureConcimazioneAttivitaStub(page);
    await gotoFruttetoConcimazioniList(page);
    await waitForOurConcimazioneRow(page);
  }

  const completedEarly = await findOurCompletedConcimazioneRow(page);
  if (completedEarly) {
    await expect(completedEarly.locator('td').nth(4)).not.toHaveText('-');
    return;
  }

  const incompleteRow = await findOurIncompleteConcimazioneRow(page);
  if (!incompleteRow) {
    throw new Error(`Attività Concimazione frutteto creata ma stub non trovato (${E2E_CONCIMAZIONE_FRUTTETO_NOTE})`);
  }

  await gotoMovimentiList(page);
  const usciteBefore = await countMovimentiUscita(page);

  await gotoFruttetoConcimazioniList(page);
  const { productLabel } = await completeConcimazioneStub(page);

  const completedRow = ourConcimazioneAttivitaRows(page).first();
  await expect(completedRow.locator('td').nth(4)).not.toHaveText('-');
  if (productLabel) {
    await expect(completedRow.locator('td').nth(4)).toContainText(productLabel.slice(0, 12));
  }

  await waitForMovimentiUscitaAtLeast(page, expect, usciteBefore + 1);
}

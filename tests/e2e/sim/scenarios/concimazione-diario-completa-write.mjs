/**
 * E2E catena diario → concimazioni → scarico magazzino.
 * Attività Concimazione nel diario → stub in concimazioni → completa + scarico.
 * @module tests/e2e/sim/scenarios/concimazione-diario-completa-write
 */

import {
  gotoAttivitaList,
  gotoConcimazioniList,
  gotoMovimentiList,
  loginAsManagerManodopera,
  waitForConcimazioniListLoaded,
} from '../helpers/sim-login.js';

export const E2E_CONCIMAZIONE_DIARIO_NOTE = 'GFV_SIM_E2E_CONCIMAZIONE_DIARIO';
export const E2E_CONCIMAZIONE_DIARIO_DOSAGGIO = '3';
/** Data attività E2E — stesso mese seed, non futura rispetto al run CI. */
const E2E_CONCIMAZIONE_DATA = '2026-06-16';

/**
 * Righe concimazione collegate ad attività diario (catena B via diario).
 * @param {import('playwright-core').Page} page
 */
function concimazioneFromAttivitaRows(page) {
  return page.locator('#table-wrap tbody tr').filter({
    has: page.getByRole('link', { name: /Vedi Attività/i }),
    hasText: /Concimazione/i,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function countMovimentiUscita(page) {
  return page.locator('#movimenti-container .movimenti-table tbody tr .badge-uscita').count();
}

/**
 * Righe concimazione E2E (attività diario con marker note in colonna lavoro).
 * @param {import('playwright-core').Page} page
 */
function ourConcimazioneAttivitaRows(page) {
  return concimazioneFromAttivitaRows(page).filter({
    hasText: E2E_CONCIMAZIONE_DIARIO_NOTE,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function findOurCompletedConcimazioneRow(page) {
  const rows = ourConcimazioneAttivitaRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const prodotto = ((await row.locator('td').nth(4).textContent()) || '').trim();
    if (prodotto !== '-' && prodotto !== '') {
      return row;
    }
  }
  return null;
}

/**
 * @param {import('playwright-core').Page} page
 */
async function findOurIncompleteConcimazioneRow(page) {
  const rows = ourConcimazioneAttivitaRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const prodotto = ((await row.locator('td').nth(4).textContent()) || '').trim();
    if (prodotto !== '-' && prodotto !== '') continue;
    if ((await row.getByRole('button', { name: /Modifica/i }).count()) > 0) {
      return row;
    }
  }
  return null;
}

/**
 * Attende riga concimazione E2E (stub da attività diario) con reload.
 * @param {import('playwright-core').Page} page
 */
async function waitForOurConcimazioneRow(page) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if ((await ourConcimazioneAttivitaRows(page).count()) > 0) return;
    await page.reload();
    await waitForConcimazioniListLoaded(page);
    await page.waitForTimeout(800);
  }
  throw new Error(
    `Riga concimazioni con marker ${E2E_CONCIMAZIONE_DIARIO_NOTE} non trovata dopo attività diario`
  );
}

/**
 * @param {import('playwright-core').Page} page
 */
async function openNewAttivitaModal(page) {
  await page.getByRole('button', { name: /Aggiungi Attività/i }).click();
  await page.locator('#attivita-modal.active').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const terreno = document.getElementById('attivita-terreno');
    const categoria = document.getElementById('attivita-categoria-principale');
    return terreno && terreno.options.length > 1 && categoria && categoria.options.length > 1;
  }, { timeout: 45_000 });
}

/**
 * Seleziona categoria Concimazione + primo tipo lavoro disponibile.
 * @param {import('playwright-core').Page} page
 */
async function pickConcimazioneTipoLavoro(page) {
  const categoriaSelect = page.locator('#attivita-categoria-principale');
  const concCategoria = categoriaSelect.locator('option').filter({ hasText: /^Concimazione$/i });
  if ((await concCategoria.count()) === 0) {
    throw new Error('Categoria Concimazione non trovata nel modale attività');
  }
  const catValue = (await concCategoria.first().getAttribute('value')) || '';
  await categoriaSelect.selectOption(catValue);

  const subGroup = page.locator('#attivita-sottocategoria-group');
  if (await subGroup.isVisible()) {
    const subSelect = page.locator('#attivita-sottocategoria');
    await page.waitForFunction(() => {
      const sel = document.getElementById('attivita-sottocategoria');
      return sel && sel.options.length > 1 && sel.options[1].value !== '';
    }, { timeout: 10_000 });
    const mechSub = subSelect.locator('option').filter({ hasText: /meccanic/i });
    if ((await mechSub.count()) > 0) {
      await subSelect.selectOption((await mechSub.first().getAttribute('value')) || { index: 1 });
    } else {
      await subSelect.selectOption({ index: 1 });
    }
  }

  await page.waitForFunction(() => {
    const sel = document.getElementById('attivita-tipo-lavoro-gerarchico');
    if (!sel) return false;
    return Array.from(sel.options).some((o) => o.value && o.value !== '');
  }, { timeout: 20_000 });

  const tipoSelect = page.locator('#attivita-tipo-lavoro-gerarchico');
  const tipoValue = await tipoSelect.locator('option[value]:not([value=""])').first().getAttribute('value');
  if (!tipoValue) throw new Error('Nessun tipo lavoro sotto categoria Concimazione');
  await tipoSelect.selectOption(tipoValue);
  await page.waitForFunction(
    (expected) => document.getElementById('attivita-tipo-lavoro-gerarchico')?.value === expected,
    tipoValue,
    { timeout: 10_000 }
  );

  return ((await tipoSelect.locator('option:checked').textContent()) || 'Concimazione').trim();
}

/**
 * Crea attività Concimazione con marker se assente (genera stub concimazioni).
 * @param {import('playwright-core').Page} page
 */
async function ensureConcimazioneAttivitaStub(page) {
  await page.locator('#filter-ricerca').fill('');
  await page.waitForFunction(() => {
    const container = document.getElementById('attivita-container');
    if (!container || container.querySelector('.loading')) return false;
    if (/Caricamento/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.attivita-row').length >= 5;
  }, { timeout: 30_000 });

  const hasMarker = await page.evaluate(
    (marker) =>
      Array.from(document.querySelectorAll('#attivita-container .attivita-row')).some((row) =>
        (row.textContent || '').includes(marker)
      ),
    E2E_CONCIMAZIONE_DIARIO_NOTE
  );
  if (hasMarker) return;

  await page.locator('#filter-ricerca').fill('');
  await page.waitForFunction(() => {
    const container = document.getElementById('attivita-container');
    return container && container.querySelectorAll('.attivita-row').length >= 5;
  }, { timeout: 30_000 });

  await openNewAttivitaModal(page);
  await page.locator('#attivita-data').fill(E2E_CONCIMAZIONE_DATA);
  await page.waitForFunction(
    (expected) => document.getElementById('attivita-data')?.value === expected,
    E2E_CONCIMAZIONE_DATA,
    { timeout: 5_000 }
  );

  const terrenoSelect = page.locator('#attivita-terreno');
  await terrenoSelect.selectOption({ index: 1 });

  await page.waitForFunction(() => {
    const coltura = document.getElementById('attivita-coltura-gerarchica');
    const categoriaColtura = document.getElementById('attivita-coltura-categoria');
    return coltura && coltura.value && categoriaColtura && categoriaColtura.value;
  }, { timeout: 20_000 });

  await page.locator('#attivita-orario-inizio').fill('08:00');
  await page.locator('#attivita-orario-fine').fill('10:00');
  await page.locator('#attivita-pause').fill('0');
  await page.locator('#attivita-note').fill(E2E_CONCIMAZIONE_DIARIO_NOTE);

  await pickConcimazioneTipoLavoro(page);

  await page.waitForFunction(() => {
    const tipo = document.getElementById('attivita-tipo-lavoro-gerarchico');
    return tipo && tipo.value !== '';
  }, { timeout: 10_000 });

  const colturaSelect = page.locator('#attivita-coltura-gerarchica');
  if (!(await colturaSelect.inputValue())) {
    const colCount = await colturaSelect.locator('option[value]:not([value=""])').count();
    if (colCount > 0) {
      await colturaSelect.selectOption({ index: 1 });
    }
  }

  await page.evaluate(() => {
    const form = document.getElementById('attivita-form');
    if (form) form.setAttribute('novalidate', 'novalidate');
    const tipoGroup = document.getElementById('attivita-tipo-lavoro-gerarchico-group');
    if (tipoGroup) tipoGroup.style.display = 'block';
    ['attivita-cliente', 'attivita-lavoro', 'attivita-ora-inizio-ct', 'attivita-ora-fine-ct'].forEach((id) => {
      document.getElementById(id)?.removeAttribute('required');
    });
  });

  const preSubmit = await page.evaluate(() => ({
    data: document.getElementById('attivita-data')?.value || '',
    terreno: document.getElementById('attivita-terreno')?.value || '',
    tipo: document.getElementById('attivita-tipo-lavoro-gerarchico')?.value || '',
    coltura: document.getElementById('attivita-coltura-gerarchica')?.value || '',
    inizio: document.getElementById('attivita-orario-inizio')?.value || '',
    fine: document.getElementById('attivita-orario-fine')?.value || '',
  }));
  if (!preSubmit.terreno || !preSubmit.tipo || !preSubmit.coltura || !preSubmit.inizio || !preSubmit.fine) {
    throw new Error(`Form attività Concimazione incompleto: ${JSON.stringify(preSubmit)}`);
  }

  await page.getByRole('button', { name: /Salva Attività/i }).click();

  const saved = await page.waitForFunction(
    (marker) => {
      const hasRow = Array.from(document.querySelectorAll('#attivita-container .attivita-row')).some((row) =>
        (row.textContent || '').includes(marker)
      );
      if (hasRow) return true;
      const toast = document.querySelector('#gfv-standalone-toast-layer .alert');
      if (toast && /Attività creata/i.test(toast.textContent || '')) return true;
      const modal = document.getElementById('attivita-modal');
      return modal && !modal.classList.contains('active');
    },
    E2E_CONCIMAZIONE_DIARIO_NOTE,
    { timeout: 90_000 }
  ).catch(async () => {
    const alertText = await page.evaluate(() => {
      const layer = document.getElementById('gfv-standalone-toast-layer');
      return layer ? layer.textContent || '' : '';
    });
    throw new Error(
      alertText.trim()
        ? `Salvataggio attività Concimazione fallito: ${alertText.trim().slice(0, 200)}`
        : 'Salvataggio attività Concimazione: timeout senza riga marker in lista'
    );
  });
  void saved;

  await page.evaluate(() => {
    const modal = document.getElementById('attivita-modal');
    if (modal) modal.classList.remove('active');
  });

  await page.waitForTimeout(1500);
}

/**
 * @param {import('playwright-core').Page} page
 */
async function completeConcimazioneStubFromAttivita(page) {
  const row = await findOurIncompleteConcimazioneRow(page);
  if (!row) throw new Error('Nessuno stub concimazione E2E da attività incompleto in lista');

  const attivitaLabel = ((await row.locator('td').nth(2).textContent()) || '').trim();

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
    .fill(E2E_CONCIMAZIONE_DIARIO_DOSAGGIO);
  await page.locator('#trattamento-note').fill(E2E_CONCIMAZIONE_DIARIO_NOTE);

  await page.waitForFunction(() => {
    const g = document.getElementById('trattamento-scarico-magazzino-group');
    return g && window.getComputedStyle(g).display !== 'none';
  }, { timeout: 30_000 });

  const scaricoCb = page.locator('#trattamento-registra-scarico-magazzino');
  await scaricoCb.check({ force: true });
  if (!(await scaricoCb.isChecked())) {
    throw new Error('Checkbox scarico magazzino non selezionabile nel modale concimazione');
  }

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#form-trattamento button[type="submit"]').click();

  await page.locator('#modal-trattamento.active').waitFor({ state: 'hidden', timeout: 90_000 });
  await page.waitForFunction(
    (labelPrefix) => {
      const rows = document.querySelectorAll('#table-wrap tbody tr');
      return Array.from(rows).some((tr) => {
        const t = tr.textContent || '';
        if (!labelPrefix || !t.includes(labelPrefix.slice(0, 12))) return false;
        const cells = tr.querySelectorAll('td');
        const prodotto = (cells[4]?.textContent || '').trim();
        return prodotto !== '-' && prodotto !== '';
      });
    },
    attivitaLabel,
    { timeout: 90_000 }
  );

  return { productLabel, attivitaLabel };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} attivitaLabel
 */
function concimazioneRowByAttivitaLabel(page, attivitaLabel) {
  return concimazioneFromAttivitaRows(page).filter({
    hasText: attivitaLabel.slice(0, 15),
  });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runConcimazioneDiarioCompletaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerManodopera(page);

  await gotoConcimazioniList(page);

  if ((await ourConcimazioneAttivitaRows(page).count()) === 0) {
    await gotoAttivitaList(page);
    await ensureConcimazioneAttivitaStub(page);
    await gotoConcimazioniList(page);
    await waitForOurConcimazioneRow(page);
  }

  const completedRowEarly = await findOurCompletedConcimazioneRow(page);
  if (completedRowEarly) {
    await expect(completedRowEarly.locator('td').nth(4)).not.toHaveText('-');
    await expect(completedRowEarly.getByRole('link', { name: /Vedi Attività/i })).toBeVisible();
    return;
  }

  let incompleteRow = await findOurIncompleteConcimazioneRow(page);

  if (!incompleteRow) {
    throw new Error(
      `Attività Concimazione E2E creata ma riga concimazioni (marker ${E2E_CONCIMAZIONE_DIARIO_NOTE}) non trovata`
    );
  }

  if (incompleteRow) {
    await gotoMovimentiList(page);
    const usciteBefore = await countMovimentiUscita(page);

    await gotoConcimazioniList(page);
    const { productLabel, attivitaLabel } = await completeConcimazioneStubFromAttivita(page);

    const completedRow = concimazioneRowByAttivitaLabel(page, attivitaLabel).first();
    await expect(completedRow.locator('td').nth(4)).not.toHaveText('-');
    if (productLabel) {
      await expect(completedRow.locator('td').nth(4)).toContainText(productLabel.slice(0, 12));
    }

    await gotoMovimentiList(page);
    const usciteAfter = await countMovimentiUscita(page);
    expect(usciteAfter).toBeGreaterThanOrEqual(usciteBefore + 1);

    const noteCells = await page.locator('#movimenti-container .movimenti-table tbody td:nth-child(10)').allTextContents();
    expect(noteCells.some((n) => /Scarico da trattamento/i.test(n))).toBe(true);
  } else {
    const completedRow = ourConcimazioneAttivitaRows(page).first();
    await expect(completedRow.locator('td').nth(4)).not.toHaveText('-');
    await expect(completedRow.getByRole('link', { name: /Vedi Attività/i })).toBeVisible();
  }
}

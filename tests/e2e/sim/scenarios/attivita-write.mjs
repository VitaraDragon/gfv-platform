/**
 * E2E write — nuova attività dal modale diario (manager, template viticola completo).
 * Idempotente: marker note fisso; se già presente in lista filtrata, salta la creazione.
 * @module tests/e2e/sim/scenarios/attivita-write
 */

/** Marker univoco per filtro note — riutilizzabile tra run E2E sullo stesso tenant. */
export const E2E_ATTIVITA_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_ATTIVITA';

const PREFERRED_TIPO_LAVORO = 'Erpicatura';

/**
 * Riga attività E2E (orari fissi 15:00–17:00 nel test write).
 * @param {import('playwright-core').Page} page
 */
function e2eAttivitaWriteRow(page) {
  return page
    .locator('#attivita-container .attivita-row')
    .filter({ has: page.locator('.col-orari').filter({ hasText: '15:00' }) })
    .filter({ has: page.locator('.col-orari').filter({ hasText: '17:00' }) });
}

/**
 * Applica filtro note e attende che il render tabella sia coerente (non solo empty-state).
 * @param {import('playwright-core').Page} page
 * @param {string} note
 * @param {{ requireRows?: boolean, timeout?: number }} [opts]
 */
async function filterAttivitaByNote(page, note, opts = {}) {
  const { requireRows = false, timeout = 30_000 } = opts;
  const input = page.locator('#filter-ricerca');
  await input.fill('');
  await input.fill(note);
  await page.waitForFunction(
    ({ marker, mustHaveRows }) => {
      const inputEl = document.getElementById('filter-ricerca');
      if ((inputEl?.value || '') !== marker) return false;
      const container = document.getElementById('attivita-container');
      if (!container || container.style.display === 'none') return false;
      if (/Caricamento/i.test(container.textContent || '')) return false;
      const rows = container.querySelectorAll('.attivita-row');
      if (mustHaveRows) return rows.length >= 1;
      if (rows.length > 0) return true;
      const empty = container.querySelector('.empty-state');
      return empty && !/Caricamento/i.test(empty.textContent || '');
    },
    { marker: note, mustHaveRows: requireRows },
    { timeout }
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
 * Seleziona categoria/sottocategoria fino a un tipo lavoro utilizzabile.
 * Allineato a gestione-lavori-write (CI: attende dropdown stabile + value impostato).
 * @param {import('playwright-core').Page} page
 * @returns {Promise<string>} nome tipo lavoro selezionato
 */
async function pickTipoLavoroInModal(page) {
  const categoriaSelect = page.locator('#attivita-categoria-principale');
  const categoriaCount = await categoriaSelect.locator('option').count();

  for (let i = 1; i < categoriaCount; i += 1) {
    const value = await categoriaSelect.locator('option').nth(i).getAttribute('value');
    if (!value) continue;
    await categoriaSelect.selectOption(value);

    const subGroup = page.locator('#attivita-sottocategoria-group');
    if (await subGroup.isVisible()) {
      const subSelect = page.locator('#attivita-sottocategoria');
      const subCount = await subSelect.locator('option').count();
      if (subCount > 1) {
        const subValue = await subSelect.locator('option').nth(1).getAttribute('value');
        if (subValue) await subSelect.selectOption(subValue);
      }
    }

    const tipoSelect = page.locator('#attivita-tipo-lavoro-gerarchico');
    try {
      await page.waitForFunction(() => {
        const group = document.getElementById('attivita-tipo-lavoro-gerarchico-group');
        const sel = document.getElementById('attivita-tipo-lavoro-gerarchico');
        return group && group.style.display !== 'none' && sel && sel.options.length > 1 && sel.options[1].value !== '';
      }, { timeout: 8_000 });
      await page.waitForFunction(async () => {
        const sel = document.getElementById('attivita-tipo-lavoro-gerarchico');
        if (!sel || sel.options.length < 2) return false;
        const n = sel.options.length;
        await new Promise((r) => setTimeout(r, 400));
        return sel.options.length === n && sel.options[1].value !== '';
      }, { timeout: 8_000 });
    } catch {
      continue;
    }

    const preferred = tipoSelect.locator('option', { hasText: PREFERRED_TIPO_LAVORO });
    let selectedValue = '';
    if ((await preferred.count()) > 0) {
      selectedValue = (await preferred.first().getAttribute('value')) || '';
      if (selectedValue) await tipoSelect.selectOption(selectedValue);
    } else {
      selectedValue = (await tipoSelect.locator('option').nth(1).getAttribute('value')) || '';
      if (selectedValue) await tipoSelect.selectOption(selectedValue);
    }

    if (!selectedValue) continue;

    try {
      await page.waitForFunction(
        (expected) => document.getElementById('attivita-tipo-lavoro-gerarchico')?.value === expected,
        selectedValue,
        { timeout: 5_000 }
      );
    } catch {
      continue;
    }

    const label =
      (await tipoSelect.locator(`option[value="${selectedValue}"]`).textContent())?.trim() ||
      PREFERRED_TIPO_LAVORO;
    return label;
  }

  throw new Error('Impossibile selezionare un tipo lavoro nel modale attività');
}

/** Data nel mese seed sim (evita edge fuso/ora CI vs validazione «non futura»). */
const E2E_ATTIVITA_WRITE_DATA = '2026-06-15';

/**
 * @param {import('playwright-core').Page} page
 * @param {string} note
 */
async function waitForAttivitaSaveComplete(page, note) {
  await page.waitForFunction(
    (marker) => {
      const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
      const hasToast = Array.from(toasts).some((t) =>
        /Attività creata/i.test(t.textContent || '')
      );
      if (hasToast) return true;
      const modal = document.getElementById('attivita-modal');
      if (modal && !modal.classList.contains('active')) return true;
      return Array.from(document.querySelectorAll('#attivita-container .attivita-row')).some((row) =>
        (row.textContent || '').includes(marker)
      );
    },
    note,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ note: string }} opts
 * @returns {Promise<{ tipoLavoro: string, terrenoNome: string }>}
 */
async function fillAndSubmitNewAttivita(page, { note }) {
  await page.locator('#attivita-data').fill(E2E_ATTIVITA_WRITE_DATA);

  const terrenoSelect = page.locator('#attivita-terreno');
  const terrenoNome = ((await terrenoSelect.locator('option').nth(1).textContent()) || '').trim();
  await terrenoSelect.selectOption({ index: 1 });

  await page.waitForFunction(() => {
    const coltura = document.getElementById('attivita-coltura-gerarchica');
    const categoriaColtura = document.getElementById('attivita-coltura-categoria');
    return (
      coltura &&
      coltura.value &&
      categoriaColtura &&
      categoriaColtura.value
    );
  }, { timeout: 20_000 });

  const tipoLavoro = await pickTipoLavoroInModal(page);

  await page.waitForFunction(() => {
    const sel = document.getElementById('attivita-tipo-lavoro-gerarchico');
    return sel && sel.value !== '';
  }, { timeout: 10_000 });

  await page.locator('#attivita-orario-inizio').fill('15:00');
  await page.locator('#attivita-orario-fine').fill('17:00');
  await page.locator('#attivita-pause').fill('0');
  await page.locator('#attivita-note').fill(note);

  await page.evaluate(() => {
    const form = document.getElementById('attivita-form');
    if (form) form.setAttribute('novalidate', 'novalidate');
    const tipoGroup = document.getElementById('attivita-tipo-lavoro-gerarchico-group');
    if (tipoGroup) tipoGroup.style.display = 'block';
    ['attivita-cliente', 'attivita-lavoro', 'attivita-ora-inizio-ct', 'attivita-ora-fine-ct'].forEach((id) => {
      document.getElementById(id)?.removeAttribute('required');
    });
  });

  await page.locator('#attivita-form button[type="submit"]').click();
  await waitForAttivitaSaveComplete(page, note);

  return { tipoLavoro, terrenoNome };
}

/**
 * Crea (se assente) e verifica attività con marker note in lista filtrata.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runAttivitaWriteAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/attivita-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Diario Attività' })).toBeVisible();

  await filterAttivitaByNote(page, E2E_ATTIVITA_WRITE_NOTE);
  let rowCount = await e2eAttivitaWriteRow(page).count();

  let expectedTipo = PREFERRED_TIPO_LAVORO;
  let expectedTerreno = '';

  if (rowCount === 0) {
    const totalBefore = await page.evaluate(
      () => document.querySelectorAll('#attivita-container .attivita-row').length
    );

    await page.locator('#filter-ricerca').fill('');
    await page.waitForFunction(() => {
      const container = document.getElementById('attivita-container');
      return container && container.querySelectorAll('.attivita-row').length >= 15;
    }, { timeout: 30_000 });

    await openNewAttivitaModal(page);
    const created = await fillAndSubmitNewAttivita(page, { note: E2E_ATTIVITA_WRITE_NOTE });
    expectedTipo = created.tipoLavoro;
    expectedTerreno = created.terrenoNome;

    await page.waitForFunction(
      (before) => document.querySelectorAll('#attivita-container .attivita-row').length > before,
      totalBefore,
      { timeout: 60_000 }
    );

    await filterAttivitaByNote(page, E2E_ATTIVITA_WRITE_NOTE, { requireRows: true, timeout: 60_000 });
    rowCount = await e2eAttivitaWriteRow(page).count();
  } else {
    const firstRow = e2eAttivitaWriteRow(page).first();
    expectedTipo = ((await firstRow.locator('.col-tipo-lavoro').textContent()) || '').trim();
    expectedTerreno = ((await firstRow.locator('.col-terreno').textContent()) || '').trim();
  }

  expect(rowCount).toBeGreaterThanOrEqual(1);

  const row = e2eAttivitaWriteRow(page).first();
  await expect(row.locator('.col-tipo-lavoro')).toContainText(expectedTipo, { timeout: 15_000 });

  if (expectedTerreno) {
    await expect(row.locator('.col-terreno')).toContainText(expectedTerreno);
  }

  await expect(row.locator('.col-orari').filter({ hasText: '15:00' }).first()).toBeVisible();
  await expect(row.locator('.col-orari').filter({ hasText: '17:00' }).first()).toBeVisible();
}

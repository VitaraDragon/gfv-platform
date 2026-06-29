/**
 * E2E write — nuova attività dal modale diario (manager, template viticola completo).
 * Idempotente: marker note fisso; se già presente in lista filtrata, salta la creazione.
 * @module tests/e2e/sim/scenarios/attivita-write
 */

/** Marker univoco per filtro note — riutilizzabile tra run E2E sullo stesso tenant. */
export const E2E_ATTIVITA_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_ATTIVITA';

const PREFERRED_TIPO_LAVORO = 'Erpicatura';

/**
 * @param {import('playwright-core').Page} page
 */
async function filterAttivitaByNote(page, note) {
  const input = page.locator('#filter-ricerca');
  await input.fill('');
  await input.fill(note);
  await page.waitForFunction(
    (marker) => {
      const container = document.getElementById('attivita-container');
      if (!container || container.style.display === 'none') return false;
      const rows = container.querySelectorAll('.attivita-row');
      if (rows.length === 0) {
        const empty = container.querySelector('.empty-state');
        return empty && !/Caricamento/i.test(empty.textContent || '');
      }
      return true;
    },
    note,
    { timeout: 30_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 */
async function countVisibleAttivitaRows(page) {
  return page.locator('#attivita-container .attivita-row').count();
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
        const sel = document.getElementById('attivita-tipo-lavoro-gerarchico');
        return sel && sel.options.length > 1 && sel.options[1].value !== '';
      }, { timeout: 8_000 });
    } catch {
      continue;
    }

    const preferred = tipoSelect.locator('option', { hasText: PREFERRED_TIPO_LAVORO });
    if ((await preferred.count()) > 0) {
      await tipoSelect.selectOption({ label: PREFERRED_TIPO_LAVORO });
      return PREFERRED_TIPO_LAVORO;
    }

    const firstLabel = (await tipoSelect.locator('option').nth(1).textContent())?.trim();
    if (firstLabel) {
      await tipoSelect.selectOption({ index: 1 });
      return firstLabel;
    }
  }

  throw new Error('Impossibile selezionare un tipo lavoro nel modale attività');
}

/** Data nel mese seed sim (evita edge fuso/ora CI vs validazione «non futura»). */
const E2E_ATTIVITA_WRITE_DATA = '2026-06-15';

/**
 * Attende esito salvataggio: chiusura modale o toast (non richiede visibilità toast).
 * @param {import('playwright-core').Page} page
 */
async function waitForAttivitaSaveComplete(page) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const err = document.querySelector(
        '#gfv-standalone-toast-layer .alert-error, #gfv-standalone-toast-layer .alert-danger'
      );
      const errText = err?.textContent?.trim() || '';
      const modal = document.getElementById('attivita-modal');
      const modalOpen = modal?.classList.contains('active') ?? false;
      const success = document.querySelector('#gfv-standalone-toast-layer .alert-success');
      const okText = success?.textContent?.trim() || '';
      return { errText, modalOpen, okText };
    });
    if (state.errText) {
      throw new Error(`Salvataggio attività E2E: ${state.errText}`);
    }
    if (!state.modalOpen || /Attività creata/i.test(state.okText)) {
      return;
    }
    await page.waitForTimeout(400);
  }
  throw new Error('Salvataggio attività E2E: timeout (modale ancora aperta)');
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

  await page.locator('#attivita-orario-inizio').fill('15:00');
  await page.locator('#attivita-orario-fine').fill('17:00');
  await page.locator('#attivita-pause').fill('0');
  await page.locator('#attivita-note').fill(note);

  await page.locator('#attivita-form button[type="submit"]').click();
  await waitForAttivitaSaveComplete(page);

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
  let rowCount = await countVisibleAttivitaRows(page);

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
      { timeout: 30_000 }
    );

    await filterAttivitaByNote(page, E2E_ATTIVITA_WRITE_NOTE);
    rowCount = await countVisibleAttivitaRows(page);
  } else {
    const firstRow = page.locator('#attivita-container .attivita-row').first();
    expectedTipo = ((await firstRow.locator('.col-tipo-lavoro').textContent()) || '').trim();
    expectedTerreno = ((await firstRow.locator('.col-terreno').textContent()) || '').trim();
  }

  expect(rowCount).toBeGreaterThanOrEqual(1);

  const row = page.locator('#attivita-container .attivita-row').first();
  await expect(row.locator('.col-tipo-lavoro')).toContainText(expectedTipo);

  if (expectedTerreno) {
    await expect(row.locator('.col-terreno')).toContainText(expectedTerreno);
  }

  await expect(row.locator('.col-orari').filter({ hasText: '15:00' }).first()).toBeVisible();
  await expect(row.locator('.col-orari').filter({ hasText: '17:00' }).first()).toBeVisible();
}

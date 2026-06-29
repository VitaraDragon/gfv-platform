/**
 * E2E write — nuova tariffa conto terzi (modale gestione tariffe).
 * Idempotente: marker tariffa base 777.00 €/ha + tipo lavoro Erpicatura + montagna.
 * @module tests/e2e/sim/scenarios/tariffe-write
 */

export const E2E_TARIFFA_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_TARIFFA';

export const E2E_TARIFFA_WRITE_BASE = '777';

const PREFERRED_TIPO_LAVORO = 'Erpicatura';
const PREFERRED_COLTURA = 'Vite da Vino';
const TIPO_CAMPO = 'montagna';
const COEFFICIENTE = '1';

/**
 * @param {import('playwright-core').Page} page
 */
async function clearTariffeFilters(page) {
  const btn = page.getByRole('button', { name: /Pulisci Filtri/i });
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForFunction(() => {
      const container = document.getElementById('tariffe-container');
      return container && !container.querySelector('.loading');
    }, { timeout: 15_000 });
  }
}

/**
 * @param {import('playwright-core').Page} page
 */
function tariffeRowsWithMarker(page) {
  return page
    .locator('#tariffe-container .tariffe-table tbody tr')
    .filter({ hasText: `${E2E_TARIFFA_WRITE_BASE}.00` })
    .filter({ hasText: PREFERRED_TIPO_LAVORO });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function openNewTariffaModal(page) {
  await page.getByRole('button', { name: /Nuova Tariffa/i }).click();
  await page.locator('#tariffa-modal.active').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const categoria = document.getElementById('lavoro-categoria-principale');
    const colturaCat = document.getElementById('coltura-categoria');
    return (
      categoria &&
      categoria.options.length > 1 &&
      colturaCat &&
      colturaCat.options.length > 1
    );
  }, { timeout: 45_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<string>}
 */
async function pickTipoLavoroInModal(page) {
  const categoriaSelect = page.locator('#lavoro-categoria-principale');
  const categoriaCount = await categoriaSelect.locator('option').count();

  for (let i = 1; i < categoriaCount; i += 1) {
    const value = await categoriaSelect.locator('option').nth(i).getAttribute('value');
    if (!value) continue;
    await categoriaSelect.selectOption(value);

    const subGroup = page.locator('#lavoro-sottocategoria-group');
    if (await subGroup.isVisible()) {
      const subSelect = page.locator('#lavoro-sottocategoria');
      const subCount = await subSelect.locator('option').count();
      if (subCount > 1) {
        const subValue = await subSelect.locator('option').nth(1).getAttribute('value');
        if (subValue) await subSelect.selectOption(subValue);
      }
    }

    const tipoSelect = page.locator('#tipo-lavoro');
    try {
      await page.waitForFunction(() => {
        const sel = document.getElementById('tipo-lavoro');
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

  throw new Error('Impossibile selezionare un tipo lavoro nel modale tariffa');
}

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<string>}
 */
async function pickColturaInModal(page) {
  const categoriaSelect = page.locator('#coltura-categoria');
  const categoriaCount = await categoriaSelect.locator('option').count();

  for (let i = 1; i < categoriaCount; i += 1) {
    const value = await categoriaSelect.locator('option').nth(i).getAttribute('value');
    if (!value) continue;
    await categoriaSelect.selectOption(value);

    const colturaSelect = page.locator('#coltura');
    try {
      await page.waitForFunction(() => {
        const sel = document.getElementById('coltura');
        return sel && sel.options.length >= 1;
      }, { timeout: 8_000 });
    } catch {
      continue;
    }

    const preferred = colturaSelect.locator('option', { hasText: PREFERRED_COLTURA });
    if ((await preferred.count()) > 0) {
      await colturaSelect.selectOption({ label: PREFERRED_COLTURA });
      return PREFERRED_COLTURA;
    }

    if ((await colturaSelect.locator('option').count()) > 1) {
      const label = (await colturaSelect.locator('option').nth(1).textContent())?.trim();
      if (label) {
        await colturaSelect.selectOption({ index: 1 });
        return label;
      }
    }

    return '';
  }

  throw new Error('Impossibile selezionare categoria/coltura nel modale tariffa');
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ note: string }} opts
 * @returns {Promise<{ tipoLavoro: string, coltura: string }>}
 */
async function fillAndSubmitNewTariffa(page, { note }) {
  const tipoLavoro = await pickTipoLavoroInModal(page);
  const coltura = await pickColturaInModal(page);

  await page.locator('#tipo-campo').selectOption(TIPO_CAMPO);

  await page.waitForFunction(() => {
    const group = document.getElementById('coefficiente-group');
    return group && group.style.display !== 'none';
  }, { timeout: 10_000 });

  await page.locator('#tariffa-base').fill(E2E_TARIFFA_WRITE_BASE);
  await page.locator('#coefficiente').fill(COEFFICIENTE);
  await page.locator('#attiva').selectOption('true');
  await page.locator('#note').fill(note);

  await page.locator('#tariffa-form button[type="submit"]').click();

  await page.getByText('Tariffa creata con successo', { exact: false }).waitFor({
    timeout: 45_000,
  });
  await page.locator('#tariffa-modal.active').waitFor({ state: 'hidden', timeout: 30_000 });

  return { tipoLavoro, coltura };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runTariffeWriteAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/tariffe-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Tariffe' })).toBeVisible();

  await page.waitForFunction(() => {
    const container = document.getElementById('tariffe-container');
    return container && container.querySelectorAll('.tariffe-table tbody tr').length >= 8;
  }, { timeout: 45_000 });

  await clearTariffeFilters(page);

  let markerRows = tariffeRowsWithMarker(page);
  let rowCount = await markerRows.count();

  let expectedTipo = PREFERRED_TIPO_LAVORO;
  let expectedColtura = PREFERRED_COLTURA;

  if (rowCount === 0) {
    const totalBefore = await page.evaluate(
      () => document.querySelectorAll('#tariffe-container .tariffe-table tbody tr').length
    );

    await openNewTariffaModal(page);
    const created = await fillAndSubmitNewTariffa(page, { note: E2E_TARIFFA_WRITE_NOTE });
    expectedTipo = created.tipoLavoro;
    expectedColtura = created.coltura;

    await page.waitForFunction(
      (before) =>
        document.querySelectorAll('#tariffe-container .tariffe-table tbody tr').length > before,
      totalBefore,
      { timeout: 30_000 }
    );

    await clearTariffeFilters(page);
    markerRows = tariffeRowsWithMarker(page);
    rowCount = await markerRows.count();
  } else {
    const firstRow = markerRows.first();
    expectedTipo = ((await firstRow.locator('td').nth(0).textContent()) || '').trim();
    expectedColtura = ((await firstRow.locator('td').nth(1).textContent()) || '').trim();
  }

  expect(rowCount).toBeGreaterThanOrEqual(1);

  const row = markerRows.first();
  await expect(row.locator('td').nth(0)).toContainText(expectedTipo.split(' ')[0]);
  if (expectedColtura) {
    await expect(row.locator('td').nth(1)).toContainText(expectedColtura.split(' ')[0]);
  }
  await expect(row.locator('td').nth(2)).toContainText(/Montagna/i);
  await expect(row.locator('td').nth(3)).toContainText(`${E2E_TARIFFA_WRITE_BASE}.00`);
  await expect(row.locator('td').nth(5)).toContainText(`${E2E_TARIFFA_WRITE_BASE}.00`);
  await expect(row.locator('.badge-success').filter({ hasText: /Attiva/i })).toBeVisible();
}

/**
 * E2E write — nuovo preventivo conto terzi (pagina nuovo-preventivo-standalone).
 * Idempotente: marker in note + superficie distintiva 9.99 ha visibile in tabella.
 * @module tests/e2e/sim/scenarios/preventivi-write
 */

/** Marker in note — persistito in Firestore, non visibile in lista. */
export const E2E_PREVENTIVO_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_PREVENTIVO';

/** Superficie distintiva per riconoscere la riga E2E in tabella (assente nel seed). */
export const E2E_PREVENTIVO_WRITE_SUPERFICIE = '9.99';

const PREFERRED_TIPO_LAVORO = 'Erpicatura';
const PREFERRED_COLTURA = 'Vite da Vino';

/**
 * @param {import('playwright-core').Page} page
 */
async function clearPreventiviFilters(page) {
  const btn = page.getByRole('button', { name: /Pulisci Filtri/i });
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForFunction(() => {
      const container = document.getElementById('preventivi-container');
      return container && !container.querySelector('.loading');
    }, { timeout: 15_000 });
  }
}

/**
 * @param {import('playwright-core').Page} page
 */
function preventiviRowsWithMarker(page) {
  return page
    .locator('#preventivi-container .preventivi-table tbody tr')
    .filter({ hasText: E2E_PREVENTIVO_WRITE_SUPERFICIE })
    .filter({ hasText: PREFERRED_TIPO_LAVORO });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function openNuovoPreventivoPage(page) {
  await page.getByRole('link', { name: /Nuovo Preventivo/i }).click();
  await page.waitForURL(/nuovo-preventivo-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Nuovo Preventivo' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const cliente = document.getElementById('cliente-id');
    const categoria = document.getElementById('lavoro-categoria-principale');
    const colturaCat = document.getElementById('coltura-categoria');
    return (
      cliente &&
      cliente.options.length > 1 &&
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
async function pickTipoLavoroInForm(page) {
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
      await page.waitForFunction(async () => {
        const sel = document.getElementById('tipo-lavoro');
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

    const label =
      (await tipoSelect.locator(`option[value="${selectedValue}"]`).textContent())?.trim() ||
      PREFERRED_TIPO_LAVORO;
    return label;
  }

  throw new Error('Impossibile selezionare un tipo lavoro nel form nuovo preventivo');
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ note: string }} opts
 * @returns {Promise<{ clienteNome: string, tipoLavoro: string, coltura: string }>}
 */
async function fillAndSubmitNewPreventivo(page, { note }) {
  const clienteSelect = page.locator('#cliente-id');
  const clienteValue = (await clienteSelect.locator('option').nth(1).getAttribute('value')) || '';
  const clienteNome = ((await clienteSelect.locator('option').nth(1).textContent()) || '').trim();
  if (!clienteValue) {
    throw new Error('Nessun cliente disponibile nel form nuovo preventivo');
  }
  await clienteSelect.selectOption(clienteValue);

  await page.evaluate(async (selectedClienteId) => {
    const sel = document.getElementById('cliente-id');
    if (sel && sel.value !== selectedClienteId) {
      sel.value = selectedClienteId;
    }
    if (typeof window.onClienteChange === 'function') {
      window.onClienteChange();
    }
    if (typeof window.__preventivoAwaitTerreniClienteReady === 'function') {
      await window.__preventivoAwaitTerreniClienteReady(90_000);
    }
  }, clienteValue);

  await page.waitForFunction(() => {
    const terreno = document.getElementById('terreno-id');
    return terreno && terreno.options.length > 1;
  }, { timeout: 90_000 });

  const terrenoSelect = page.locator('#terreno-id');
  await terrenoSelect.selectOption({ index: 1 });

  await page.waitForFunction(() => {
    const coltura = document.getElementById('coltura');
    const superficie = document.getElementById('superficie');
    return coltura && coltura.value && superficie && parseFloat(superficie.value) > 0;
  }, { timeout: 25_000 });

  const colturaNome = ((await page.locator('#coltura').inputValue()) || '').trim();
  const tipoLavoro = await pickTipoLavoroInForm(page);

  await page.locator('#superficie').fill(E2E_PREVENTIVO_WRITE_SUPERFICIE);

  const dataPrevista = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.locator('#data-prevista').fill(dataPrevista);
  await page.locator('#note').fill(note);

  await page.evaluate(async () => {
    if (typeof window.calcolaTotale === 'function') await window.calcolaTotale();
  });

  const totaleOk = await page.waitForFunction(async () => {
    const morfologie = ['pianura', 'collina', 'montagna'];
    for (const m of morfologie) {
      const tipoCampo = document.getElementById('tipo-campo');
      if (tipoCampo) tipoCampo.value = m;
      if (typeof window.calcolaTotale === 'function') await window.calcolaTotale();
      const imponibile = document.getElementById('totale-imponibile');
      const val = parseFloat((imponibile?.textContent || '').replace('€', '').replace(',', '.').trim());
      if (Number.isFinite(val) && val > 0) return true;
    }
    return false;
  }, { timeout: 45_000 }).catch(() => null);

  if (!totaleOk) {
    throw new Error('Impossibile calcolare totale preventivo > 0 (tariffa non trovata)');
  }

  await page.locator('#preventivo-form button[type="submit"]').click();

  await page.getByText('Preventivo creato con successo!', { exact: false }).waitFor({
    timeout: 45_000,
  });
  await page.waitForURL(/preventivi-standalone\.html/, { timeout: 60_000 });

  return { clienteNome, tipoLavoro, coltura: colturaNome || PREFERRED_COLTURA };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runPreventiviWriteAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/preventivi-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Preventivi' })).toBeVisible();

  await page.waitForFunction(() => {
    const container = document.getElementById('preventivi-container');
    return container && container.querySelectorAll('.preventivi-table tbody tr').length >= 5;
  }, { timeout: 45_000 });

  await clearPreventiviFilters(page);

  let markerRows = preventiviRowsWithMarker(page);
  let rowCount = await markerRows.count();

  let expectedCliente = '';
  let expectedTipo = PREFERRED_TIPO_LAVORO;
  let expectedColtura = PREFERRED_COLTURA;
  let createdNew = false;

  if (rowCount === 0) {
    const totalBefore = await page.evaluate(
      () => document.querySelectorAll('#preventivi-container .preventivi-table tbody tr').length
    );

    await openNuovoPreventivoPage(page);
    const created = await fillAndSubmitNewPreventivo(page, { note: E2E_PREVENTIVO_WRITE_NOTE });
    expectedCliente = created.clienteNome;
    expectedTipo = created.tipoLavoro;
    expectedColtura = created.coltura;
    createdNew = true;

    await page.waitForFunction(
      (before) =>
        document.querySelectorAll('#preventivi-container .preventivi-table tbody tr').length > before,
      totalBefore,
      { timeout: 30_000 }
    );

    await clearPreventiviFilters(page);
    markerRows = preventiviRowsWithMarker(page);
    rowCount = await markerRows.count();
  } else {
    const firstRow = markerRows.first();
    expectedCliente = ((await firstRow.locator('td').nth(1).textContent()) || '').trim();
    expectedTipo = ((await firstRow.locator('td').nth(2).textContent()) || '').trim();
    expectedColtura = ((await firstRow.locator('td').nth(3).textContent()) || '').trim();
  }

  expect(rowCount).toBeGreaterThanOrEqual(1);

  const row = markerRows.first();
  await expect(row.locator('td').nth(4)).toContainText(`${E2E_PREVENTIVO_WRITE_SUPERFICIE} ha`);
  await expect(row.locator('td').nth(2)).toContainText(expectedTipo.split(' ')[0]);
  await expect(row.locator('td').nth(3)).toContainText(expectedColtura.split(' ')[0]);
  if (createdNew) {
    await expect(row.locator('.badge-secondary').filter({ hasText: /Bozza/i })).toBeVisible();
  }
  await expect(row.locator('td').nth(5)).toContainText('€');

  if (expectedCliente) {
    await expect(row.locator('td').nth(1)).toContainText(expectedCliente.split(' ')[0]);
  }
}

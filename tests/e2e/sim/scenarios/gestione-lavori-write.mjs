/**
 * E2E write — nuovo lavoro manodopera (modale gestione lavori, manager).
 * Idempotente: marker nel nome lavoro; se già in tabella, salta la creazione.
 * @module tests/e2e/sim/scenarios/gestione-lavori-write
 */

/** Marker visibile nella colonna Nome — riutilizzabile tra run E2E sullo stesso tenant. */
export const E2E_LAVORO_WRITE_NOME = 'GFV SIM E2E WRITE LAVORO';

export const E2E_LAVORO_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_LAVORO';

const PREFERRED_TIPO_LAVORO = 'Erpicatura';
const WRITE_DURATA = '3';

/**
 * @param {import('playwright-core').Page} page
 * @param {string} marker
 */
function lavoriRowsWithMarker(page, marker) {
  return page.locator('#lavori-container .lavori-table tbody tr').filter({ hasText: marker });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function clearLavoriFilters(page) {
  const btn = page.getByRole('button', { name: /Pulisci Filtri/i });
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForFunction(() => {
      const container = document.getElementById('lavori-container');
      return container && !container.querySelector('.loading');
    }, { timeout: 15_000 });
  }
}

/**
 * @param {import('playwright-core').Page} page
 */
async function openNewLavoroModal(page) {
  await page.locator('#crea-lavoro-button').click();
  await page.locator('#lavoro-modal.active').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const terreno = document.getElementById('lavoro-terreno');
    const categoria = document.getElementById('lavoro-categoria-principale');
    const capo = document.getElementById('lavoro-caposquadra');
    return (
      terreno &&
      terreno.options.length > 1 &&
      categoria &&
      categoria.options.length > 1 &&
      capo &&
      capo.options.length > 1
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

    const tipoSelect = page.locator('#lavoro-tipo-lavoro');
    try {
      await page.waitForFunction(() => {
        const group = document.getElementById('tipo-lavoro-group');
        const sel = document.getElementById('lavoro-tipo-lavoro');
        return group && group.style.display !== 'none' && sel && sel.options.length > 1 && sel.options[1].value !== '';
      }, { timeout: 8_000 });
      await page.waitForFunction(async () => {
        const sel = document.getElementById('lavoro-tipo-lavoro');
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
        (expected) => document.getElementById('lavoro-tipo-lavoro')?.value === expected,
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

  throw new Error('Impossibile selezionare un tipo lavoro nel modale gestione lavori');
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ nome: string, note: string }} opts
 * @returns {Promise<{ terrenoNome: string, caposquadraNome: string, tipoLavoro: string }>}
 */
async function fillAndSubmitNewLavoro(page, { nome, note }) {
  await page.locator('#lavoro-nome').fill(nome);

  const terrenoSelect = page.locator('#lavoro-terreno');
  const terrenoNome = ((await terrenoSelect.locator('option').nth(1).textContent()) || '').trim();
  await terrenoSelect.selectOption({ index: 1 });

  const tipoLavoro = await pickTipoLavoroInModal(page);

  await page.waitForFunction(() => {
    const sel = document.getElementById('lavoro-tipo-lavoro');
    return sel && sel.value !== '';
  }, { timeout: 10_000 });

  const caposquadraSelect = page.locator('#lavoro-caposquadra');
  const caposquadraNome = ((await caposquadraSelect.locator('option').nth(1).textContent()) || '').trim();
  await caposquadraSelect.selectOption({ index: 1 });

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.locator('#lavoro-data-inizio').fill(today);
  await page.locator('#lavoro-durata').fill(WRITE_DURATA);
  await page.locator('#lavoro-stato').selectOption('assegnato');
  await page.locator('#lavoro-note').fill(note);

  await page.evaluate(() => {
    const form = document.getElementById('lavoro-form');
    if (form) form.setAttribute('novalidate', 'novalidate');
    const tipoGroup = document.getElementById('tipo-lavoro-group');
    if (tipoGroup) tipoGroup.style.display = 'block';
  });

  await page.locator('#lavoro-form button[type="submit"]').click();

  await page.waitForFunction(
    (marker) => {
      const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
      const hasToast = Array.from(toasts).some((t) =>
        /Lavoro creato con successo/i.test(t.textContent || '')
      );
      if (hasToast) return true;
      return Array.from(document.querySelectorAll('#lavori-container .lavori-table tbody tr')).some(
        (tr) => (tr.textContent || '').includes(marker)
      );
    },
    E2E_LAVORO_WRITE_NOME,
    { timeout: 90_000 }
  );

  return { terrenoNome, caposquadraNome, tipoLavoro };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGestioneLavoriWriteAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/gestione-lavori-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Lavori' })).toBeVisible();

  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    return container && container.querySelectorAll('.lavori-table tbody tr').length >= 3;
  }, { timeout: 45_000 });

  await clearLavoriFilters(page);

  let markerRows = lavoriRowsWithMarker(page, E2E_LAVORO_WRITE_NOME);
  let rowCount = await markerRows.count();

  let expectedTerreno = '';
  let expectedCaposquadra = '';

  if (rowCount === 0) {
    const totalBefore = await page.evaluate(
      () => document.querySelectorAll('#lavori-container .lavori-table tbody tr').length
    );

    await openNewLavoroModal(page);
    const created = await fillAndSubmitNewLavoro(page, {
      nome: E2E_LAVORO_WRITE_NOME,
      note: E2E_LAVORO_WRITE_NOTE,
    });
    expectedTerreno = created.terrenoNome;
    expectedCaposquadra = created.caposquadraNome;

    await page.waitForFunction(
      (before) =>
        document.querySelectorAll('#lavori-container .lavori-table tbody tr').length > before,
      totalBefore,
      { timeout: 30_000 }
    );

    await clearLavoriFilters(page);
    markerRows = lavoriRowsWithMarker(page, E2E_LAVORO_WRITE_NOME);
    rowCount = await markerRows.count();
  } else {
    const firstRow = markerRows.first();
    expectedTerreno = ((await firstRow.locator('td').nth(1).textContent()) || '').trim();
    expectedCaposquadra = ((await firstRow.locator('td').nth(2).textContent()) || '').trim();
  }

  expect(rowCount).toBeGreaterThanOrEqual(1);

  const row = markerRows.first();
  await expect(row.locator('td').first()).toContainText(E2E_LAVORO_WRITE_NOME);
  await expect(
    row.locator('.badge-assegnato, .badge-in_corso, .badge-sospeso, .badge-completato, .badge-pianificato').first()
  ).toBeVisible({ timeout: 30_000 });
  await expect(row.locator('td').nth(4)).toContainText(`${WRITE_DURATA} giorni`);

  if (expectedTerreno) {
    await expect(row.locator('td').nth(1)).toContainText(expectedTerreno.split('(')[0].trim());
  }

  if (expectedCaposquadra) {
    const capoShort = expectedCaposquadra.replace(/^👥\s*/, '').trim().split(/\s+/).slice(0, 2).join(' ');
    if (capoShort) {
      await expect(row.locator('td').nth(2)).toContainText(capoShort.split(' ')[0]);
    }
  }
}

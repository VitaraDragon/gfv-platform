/**
 * E2E write — nuovo cliente conto terzi (modale anagrafica clienti).
 * Idempotente: marker ragione sociale + P.IVA; se già in tabella filtrata, salta la creazione.
 * @module tests/e2e/sim/scenarios/clienti-write
 */

export const E2E_CLIENTE_WRITE_RAGIONE = 'GFV SIM E2E WRITE CLIENTE';

export const E2E_CLIENTE_WRITE_PIVA = '99988877701';

export const E2E_CLIENTE_WRITE_EMAIL = 'gfv.sim.e2e.write.cliente@contoterzi.local';

export const E2E_CLIENTE_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_CLIENTE';

/**
 * @param {import('playwright-core').Page} page
 */
async function clearClientiFilters(page) {
  const btn = page.getByRole('button', { name: /Pulisci Filtri/i });
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForFunction(() => {
      const container = document.getElementById('clienti-container');
      return container && !container.querySelector('.loading');
    }, { timeout: 15_000 });
  }
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} marker
 */
async function filterClientiByMarker(page, marker) {
  const input = page.locator('#filter-search');
  await input.fill('');
  await input.fill(marker);
  await page.waitForFunction(
    (text) => {
      const container = document.getElementById('clienti-container');
      if (!container || /Caricamento clienti/i.test(container.textContent || '')) return false;
      const rows = container.querySelectorAll('.clienti-table tbody tr');
      if (rows.length === 0) {
        const empty = container.querySelector('.empty-state');
        return empty && !/Caricamento/i.test(empty.textContent || '');
      }
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(text));
    },
    marker,
    { timeout: 30_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} marker
 */
function clientiRowsWithMarker(page, marker) {
  return page.locator('#clienti-container .clienti-table tbody tr').filter({ hasText: marker });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function openNewClienteModal(page) {
  await page.getByRole('button', { name: /Nuovo Cliente/i }).click();
  await page.locator('#cliente-modal.active').waitFor({ timeout: 30_000 });
  await page.locator('#modal-title').filter({ hasText: 'Nuovo Cliente' }).waitFor({ timeout: 15_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ ragioneSociale: string, partitaIva: string, email: string, note: string }} opts
 */
async function fillAndSubmitNewCliente(page, { ragioneSociale, partitaIva, email, note }) {
  await page.locator('#ragione-sociale').fill(ragioneSociale);
  await page.locator('#partita-iva').fill(partitaIva);
  await page.locator('#indirizzo').fill('Via E2E Simulatore 1');
  await page.locator('#cap').fill('37100');
  await page.locator('#citta').fill('Verona');
  await page.locator('#provincia').fill('VR');
  await page.locator('#telefono').fill('+39 045 9990001');
  await page.locator('#email').fill(email);
  await page.locator('#stato').selectOption('attivo');
  await page.locator('#note').fill(note);

  await page.locator('#cliente-form button[type="submit"]').click();

  await page.getByText('Cliente creato con successo', { exact: false }).waitFor({
    timeout: 45_000,
  });
  await page.locator('#cliente-modal.active').waitFor({ state: 'hidden', timeout: 30_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runClientiWriteAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/clienti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Anagrafica Clienti' })).toBeVisible();

  await page.waitForFunction(() => {
    const container = document.getElementById('clienti-container');
    return container && container.querySelectorAll('.clienti-table tbody tr').length >= 3;
  }, { timeout: 45_000 });

  await clearClientiFilters(page);
  await filterClientiByMarker(page, E2E_CLIENTE_WRITE_RAGIONE);

  let markerRows = clientiRowsWithMarker(page, E2E_CLIENTE_WRITE_RAGIONE);
  let rowCount = await markerRows.count();

  if (rowCount === 0) {
    const totalBefore = await page.evaluate(
      () => document.querySelectorAll('#clienti-container .clienti-table tbody tr').length
    );

    await page.locator('#filter-search').fill('');
    await page.waitForFunction(() => {
      const container = document.getElementById('clienti-container');
      return container && container.querySelectorAll('.clienti-table tbody tr').length >= 3;
    }, { timeout: 15_000 });

    await openNewClienteModal(page);
    await fillAndSubmitNewCliente(page, {
      ragioneSociale: E2E_CLIENTE_WRITE_RAGIONE,
      partitaIva: E2E_CLIENTE_WRITE_PIVA,
      email: E2E_CLIENTE_WRITE_EMAIL,
      note: E2E_CLIENTE_WRITE_NOTE,
    });

    await page.waitForFunction(
      (before) =>
        document.querySelectorAll('#clienti-container .clienti-table tbody tr').length > before,
      totalBefore,
      { timeout: 30_000 }
    );

    await clearClientiFilters(page);
    await filterClientiByMarker(page, E2E_CLIENTE_WRITE_RAGIONE);
    markerRows = clientiRowsWithMarker(page, E2E_CLIENTE_WRITE_RAGIONE);
    rowCount = await markerRows.count();
  }

  expect(rowCount).toBeGreaterThanOrEqual(1);

  const row = markerRows.first();
  await expect(row.locator('td').nth(0)).toContainText(E2E_CLIENTE_WRITE_RAGIONE);
  await expect(row.locator('td').nth(1)).toContainText(E2E_CLIENTE_WRITE_PIVA);
  await expect(row.locator('td').nth(2)).toContainText(E2E_CLIENTE_WRITE_EMAIL);
  await expect(row.locator('.badge-success').filter({ hasText: /Attivo/i })).toBeVisible();
  await expect(row.locator('td').nth(4)).toContainText('0');
}

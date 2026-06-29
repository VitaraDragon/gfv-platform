/**
 * E2E write — accetta preventivo conto terzi (manager, lista preventivi).
 * Idempotente: usa il preventivo marker 9.99 ha (scen. 24); se già accettato, salta.
 * @module tests/e2e/sim/scenarios/preventivi-accetta-write
 */

import {
  E2E_PREVENTIVO_WRITE_SUPERFICIE,
  runPreventiviWriteAssertions,
} from './preventivi-write.mjs';

const PREFERRED_TIPO_LAVORO = 'Erpicatura';

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
function markerPreventivoRow(page) {
  return page
    .locator('#preventivi-container .preventivi-table tbody tr')
    .filter({ hasText: E2E_PREVENTIVO_WRITE_SUPERFICIE })
    .filter({ hasText: PREFERRED_TIPO_LAVORO })
    .first();
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runPreventiviAccettaWriteAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/preventivi-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Preventivi' })).toBeVisible();

  await page.waitForFunction(() => {
    const container = document.getElementById('preventivi-container');
    return container && container.querySelectorAll('.preventivi-table tbody tr').length >= 5;
  }, { timeout: 45_000 });

  await clearPreventiviFilters(page);

  let row = markerPreventivoRow(page);
  if ((await row.count()) === 0) {
    await runPreventiviWriteAssertions(page, expect);
    await clearPreventiviFilters(page);
    row = markerPreventivoRow(page);
  }

  expect(await row.count()).toBeGreaterThanOrEqual(1);

  const isBozza = (await row.locator('.badge-secondary').filter({ hasText: /Bozza/i }).count()) > 0;

  if (isBozza) {
    await row.getByRole('button', { name: /Accetta/i }).click();

    await page.getByText('Preventivo accettato con successo', { exact: false }).waitFor({
      timeout: 45_000,
    });

    await page.waitForFunction(
      (superficie) => {
        return Array.from(
          document.querySelectorAll('#preventivi-container .preventivi-table tbody tr')
        ).some(
          (tr) =>
            (tr.textContent || '').includes(superficie) &&
            /Accettato \(Manager\)/i.test(tr.textContent || '')
        );
      },
      E2E_PREVENTIVO_WRITE_SUPERFICIE,
      { timeout: 30_000 }
    );

    await clearPreventiviFilters(page);
    row = markerPreventivoRow(page);
  }

  const isPianificato =
    (await row.locator('.badge-success').filter({ hasText: /Pianificato/i }).count()) > 0;

  if (!isPianificato) {
    await expect(row.locator('.badge-success').filter({ hasText: /Accettato \(Manager\)/i })).toBeVisible();
    await expect(row.getByRole('button', { name: /Pianifica/i })).toBeVisible();
  }

  await expect(row.locator('td').nth(4)).toContainText(`${E2E_PREVENTIVO_WRITE_SUPERFICIE} ha`);
}

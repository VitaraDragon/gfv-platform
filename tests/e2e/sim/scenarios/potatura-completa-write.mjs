/**
 * E2E catena A — completa potatura stub da attività/lavoro (§11.3.12).
 * Seed fase 05: attività Potatura → stub incompleto (tipo/ceppi vuoti in Firestore).
 * @module tests/e2e/sim/scenarios/potatura-completa-write
 */

import { gotoPotaturaList, loginAsManagerManodopera } from '../helpers/sim-login.js';

export const E2E_POTATURA_COMPLETA_CEPPI = '8888';
export const E2E_POTATURA_COMPLETA_SUPERFICIE = '1.11';
export const E2E_POTATURA_COMPLETA_NOTE = 'GFV_SIM_E2E_COMPLETA_POTATURA';

/**
 * Righe potatura collegate a attività o lavoro (stub catena A).
 * @param {import('playwright-core').Page} page
 */
function potaturaStubFromTriggerRows(page) {
  return page.locator('#table-wrap tbody tr').filter({
    has: page.locator('.link-lavoro'),
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
function completedMarkerRows(page) {
  return page.locator('#table-wrap tbody tr').filter({
    hasText: E2E_POTATURA_COMPLETA_CEPPI,
  });
}

/**
 * Stub da completare: collegato a attività/lavoro, senza marker E2E in colonna ceppi.
 * La lista può mostrare ceppi/tipo prefill (getDatiPrecompilazionePotatura) anche se Firestore è incompleto.
 * @param {import('playwright-core').Page} page
 */
async function findPotaturaStubRowToComplete(page) {
  const rows = potaturaStubFromTriggerRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const ceppi = ((await row.locator('td').nth(3).textContent()) || '').trim();
    if (!ceppi.includes(E2E_POTATURA_COMPLETA_CEPPI)) {
      return row;
    }
  }
  return null;
}

/**
 * @param {import('playwright-core').Page} page
 */
async function completeFirstPotaturaStub(page) {
  const row = await findPotaturaStubRowToComplete(page);
  if (!row) throw new Error('Nessuno stub potatura da completare in lista');

  await row.locator('button').filter({ hasText: /Modifica/i }).click();

  await page.locator('#modal-potatura.active').waitFor({ state: 'visible', timeout: 30_000 });

  const attivitaId = await page.locator('#attivita-id-hidden').inputValue();
  const lavoroId = await page.locator('#lavoro-id-hidden').inputValue();
  if (!attivitaId && !lavoroId) {
    throw new Error('Stub potatura senza attivitaId/lavoroId');
  }

  const tipoSelect = page.locator('#potatura-tipo');
  await tipoSelect.selectOption('verde');

  await page.locator('#potatura-ceppi').fill(E2E_POTATURA_COMPLETA_CEPPI);

  const superficie = page.locator('#potatura-superficie-ha');
  if (!(await superficie.inputValue())) {
    await superficie.fill(E2E_POTATURA_COMPLETA_SUPERFICIE);
  }

  const ore = page.locator('#potatura-ore');
  if (!(await ore.inputValue())) {
    await ore.fill('6');
  }

  await page.locator('#potatura-note').fill(E2E_POTATURA_COMPLETA_NOTE);

  await page.locator('#form-potatura button[type="submit"]').click();

  await page.locator('#modal-potatura.active').waitFor({ state: 'hidden', timeout: 90_000 });
  await page.waitForFunction(
    (ceppi) => {
      const rows = document.querySelectorAll('#table-wrap tbody tr');
      return Array.from(rows).some(
        (tr) =>
          tr.textContent.includes(ceppi) &&
          !((tr.querySelectorAll('td')[3]?.textContent || '').trim() === '-')
      );
    },
    E2E_POTATURA_COMPLETA_CEPPI,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runPotaturaCompletaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerManodopera(page);
  await gotoPotaturaList(page);

  if ((await completedMarkerRows(page).count()) === 0) {
    expect(await potaturaStubFromTriggerRows(page).count()).toBeGreaterThanOrEqual(1);
    await completeFirstPotaturaStub(page);
  }

  await expect(page.locator('#empty-state')).toBeHidden();
  expect(await completedMarkerRows(page).count()).toBeGreaterThanOrEqual(1);

  const markerRow = completedMarkerRows(page).first();
  await expect(markerRow.locator('td').nth(3)).toContainText(E2E_POTATURA_COMPLETA_CEPPI);
  await expect(markerRow.locator('.link-lavoro')).toBeVisible();
  await expect(markerRow.locator('td').nth(2)).toContainText(/Invernale|Verde|Rinnovo|Spollonatura/i);
}

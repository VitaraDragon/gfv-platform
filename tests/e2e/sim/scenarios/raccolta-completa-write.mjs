/**
 * E2E catena A — completa raccolta stub da attività diario (§11.3.12, pari vendemmia).
 * @module tests/e2e/sim/scenarios/raccolta-completa-write
 */

import { gotoRaccoltaFrutta, loginAsManagerFrutteto } from '../helpers/sim-login.js';

export const E2E_RACCOLTA_COMPLETA_KG = '1555.5';
export const E2E_RACCOLTA_COMPLETA_NOTE = 'GFV_SIM_E2E_COMPLETA_RACCOLTA';

/**
 * Righe raccolta incomplete (kg vuoto, stub catena A).
 * @param {import('playwright-core').Page} page
 */
function incompleteRaccoltaStubRows(page) {
  return page.locator('#raccolte-table-body tr').filter({
    has: page.locator('button[data-action="edit"]'),
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
function completedMarkerRows(page) {
  return page.locator('#raccolte-table-body tr').filter({
    hasText: E2E_RACCOLTA_COMPLETA_KG,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function findRaccoltaStubToComplete(page) {
  const rows = incompleteRaccoltaStubRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const kg = ((await row.locator('td').nth(4).textContent()) || '').trim();
    const kgIncomplete = !kg || kg === '-' || kg === '—' || kg === 'NaN';
    if (kgIncomplete && !((await row.textContent()) || '').includes(E2E_RACCOLTA_COMPLETA_KG)) {
      return row;
    }
  }
  return null;
}

/**
 * @param {import('playwright-core').Page} page
 */
async function completeFirstRaccoltaStub(page) {
  const row = await findRaccoltaStubToComplete(page);
  if (!row) throw new Error('Nessuno stub raccolta da completare in lista');

  await row.locator('button[data-action="edit"]').click();

  await page.locator('#raccolta-modal.active').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(
    () => document.getElementById('attivita-id-hidden')?.value?.length > 0
      || document.getElementById('quantitaKg') != null,
    undefined,
    { timeout: 30_000 }
  );

  await page.locator('#quantitaKg').fill(E2E_RACCOLTA_COMPLETA_KG);
  const ettari = page.locator('#quantitaEttari');
  if (!(await ettari.inputValue())) {
    await ettari.fill('1.5');
  }
  await page.locator('#note').fill(E2E_RACCOLTA_COMPLETA_NOTE);

  await page.locator('#raccolta-form button[type="submit"]').click();

  await page.waitForFunction(
    (kg) => {
      const tbody = document.getElementById('raccolte-table-body');
      if (!tbody) return false;
      return Array.from(tbody.querySelectorAll('tr')).some((tr) => tr.textContent.includes(kg));
    },
    E2E_RACCOLTA_COMPLETA_KG,
    { timeout: 90_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runRaccoltaCompletaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFrutteto(page);
  await gotoRaccoltaFrutta(page);

  if ((await completedMarkerRows(page).count()) === 0) {
    expect(await incompleteRaccoltaStubRows(page).count()).toBeGreaterThanOrEqual(1);
    await completeFirstRaccoltaStub(page);
  }

  expect(await completedMarkerRows(page).count()).toBeGreaterThanOrEqual(1);
  await expect(completedMarkerRows(page).first()).toContainText(E2E_RACCOLTA_COMPLETA_KG);
}

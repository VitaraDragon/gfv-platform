/**
 * E2E catena A — completa potatura frutteto stub da attività (§11.3.12).
 * @module tests/e2e/sim/scenarios/potatura-frutteto-completa-write
 */

import { gotoFruttetoPotaturaList, loginAsManagerFrutteto } from '../helpers/sim-login.js';

export const E2E_POTATURA_FRUTTETO_PIANTE = '7777';
export const E2E_POTATURA_FRUTTETO_NOTE = 'GFV_SIM_E2E_COMPLETA_POTATURA_FRUTTETO';

function potaturaStubRows(page) {
  return page.locator('#table-wrap tbody tr').filter({
    has: page.locator('.link-lavoro'),
  });
}

function completedMarkerRows(page) {
  return page.locator('#table-wrap tbody tr').filter({
    hasText: E2E_POTATURA_FRUTTETO_PIANTE,
  });
}

async function findPotaturaStubRowToComplete(page) {
  const rows = potaturaStubRows(page);
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const piante = ((await row.locator('td').nth(3).textContent()) || '').trim();
    if (!piante.includes(E2E_POTATURA_FRUTTETO_PIANTE)) return row;
  }
  return null;
}

async function completeFirstPotaturaStub(page) {
  const row = await findPotaturaStubRowToComplete(page);
  if (!row) throw new Error('Nessuno stub potatura frutteto da completare');

  await row.locator('button').filter({ hasText: /Modifica/i }).click();
  await page.locator('#modal-potatura.active').waitFor({ state: 'visible', timeout: 30_000 });

  const tipoSelect = page.locator('#potatura-tipo');
  if (!(await tipoSelect.inputValue())) {
    await tipoSelect.selectOption('invernale');
  }

  await page.locator('#potatura-piante').fill(E2E_POTATURA_FRUTTETO_PIANTE);
  await page.locator('#potatura-note').fill(E2E_POTATURA_FRUTTETO_NOTE);

  await page.locator('#form-potatura button[type="submit"]').click();

  await page.waitForFunction(
    (marker) => {
      const rows = document.querySelectorAll('#table-wrap tbody tr');
      return Array.from(rows).some((tr) => tr.textContent.includes(marker));
    },
    E2E_POTATURA_FRUTTETO_PIANTE,
    { timeout: 90_000 }
  );
}

export async function runPotaturaFruttetoCompletaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerFrutteto(page);
  await gotoFruttetoPotaturaList(page);

  if ((await completedMarkerRows(page).count()) === 0) {
    expect(await potaturaStubRows(page).count()).toBeGreaterThanOrEqual(1);
    await completeFirstPotaturaStub(page);
  }

  expect(await completedMarkerRows(page).count()).toBeGreaterThanOrEqual(1);
  await expect(completedMarkerRows(page).first()).toContainText(E2E_POTATURA_FRUTTETO_PIANTE);
}

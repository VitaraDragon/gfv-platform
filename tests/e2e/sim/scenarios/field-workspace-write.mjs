/**
 * E2E write — operaio segna ore da field workspace mobile (quick-hours-form).
 * Verifica lato manager su validazione ore (DOM); idempotente via marker note.
 * @module tests/e2e/sim/scenarios/field-workspace-write
 */

import {
  gotoValidazioneOre,
  loginAsManagerManodopera,
  loginAsOperaioFromDevPage,
} from '../helpers/sim-login.js';

export const E2E_ORE_MOBILE_WRITE_NOTE = 'GFV_SIM_E2E_WRITE_ORE';

const ORA_START = '14:00';
const ORA_END = '16:00';

/**
 * @param {import('playwright-core').Page} page
 */
function validazioneRowWithMarker(page) {
  return page
    .locator('#ore-container .ore-table tbody tr')
    .filter({ hasText: E2E_ORE_MOBILE_WRITE_NOTE });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function selectFirstAssignedWork(page) {
  const select = page.locator('#selected-work');
  await select.waitFor({ state: 'attached', timeout: 30_000 });
  const optionCount = await select.locator('option').count();
  if (optionCount < 2) {
    throw new Error('Nessun lavoro assegnato nel field workspace operaio');
  }
  await select.selectOption({ index: 1 });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function goToSegnaOreSlide(page) {
  await page.evaluate(() => {
    if (typeof window.gfvFieldWorkspaceGoToHoursSlide === 'function') {
      window.gfvFieldWorkspaceGoToHoursSlide();
    }
  });
  await page.locator('#quick-hours-form').waitFor({ state: 'attached', timeout: 30_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ note: string }} opts
 */
async function fillAndSubmitQuickHours(page, { note }) {
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  await page.locator('#ora-data').fill(today);
  await page.locator('#ora-start').fill(ORA_START);
  await page.locator('#ora-end').fill(ORA_END);
  await page.locator('#ora-break').fill('0');
  await page.locator('#ora-note').fill(note);

  await page.evaluate(() => {
    if (typeof window.gfvFieldWorkspaceRecalcHours === 'function') {
      window.gfvFieldWorkspaceRecalcHours();
    }
  });

  await page.waitForFunction(() => {
    const el = document.getElementById('ora-net-hours');
    return el && /2h/i.test(el.textContent || '');
  }, { timeout: 10_000 });

  await page.locator('#quick-hours-form button[type="submit"]').click();

  await page.locator('#hours-save-status').filter({ hasText: /Ore salvate:/i }).waitFor({
    timeout: 45_000,
  });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runFieldWorkspaceOreWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await loginAsManagerManodopera(page);
  await gotoValidazioneOre(page);

  let markerRows = validazioneRowWithMarker(page);
  if ((await markerRows.count()) === 0) {
    await loginAsOperaioFromDevPage(page);

    await expect(page).toHaveURL(/field-workspace-standalone\.html/);
    await expect(page.locator('#field-swiper')).toBeVisible();

    const rolesText = await page.locator('#field-toolbar-user-roles').textContent();
    expect(rolesText || '').toMatch(/Operaio/i);

    await selectFirstAssignedWork(page);
    await goToSegnaOreSlide(page);
    await fillAndSubmitQuickHours(page, { note: E2E_ORE_MOBILE_WRITE_NOTE });

    await loginAsManagerManodopera(page);
    await gotoValidazioneOre(page);
    markerRows = validazioneRowWithMarker(page);
  }

  expect(await markerRows.count()).toBeGreaterThanOrEqual(1);

  const row = markerRows.first();
  await expect(row).toContainText(E2E_ORE_MOBILE_WRITE_NOTE);
  await expect(row).toContainText(`${ORA_START} - ${ORA_END}`);
  await expect(row.locator('td').nth(5)).toContainText('2h');
  await expect(row.getByRole('button', { name: '✅ Valida' })).toBeVisible();
}

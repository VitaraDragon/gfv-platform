/**
 * E2E write — manager valida ore segnate da operaio (marker scen. 22).
 * Idempotente: valida tutte le righe marker in coda; se assenti, assert stat validate ≥ 1.
 * @module tests/e2e/sim/scenarios/validazione-ore-write
 */

import {
  gotoFieldWorkspace,
  gotoValidazioneOre,
  loginAsManagerManodopera,
  loginAsOperaioFromDevPage,
  waitForValidazioneOreLoaded,
} from '../helpers/sim-login.js';
import {
  E2E_ORE_MOBILE_WRITE_NOTE,
} from './field-workspace-write.mjs';

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
 */
async function fillAndSubmitQuickHours(page) {
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  await page.locator('#ora-data').fill(today);
  await page.locator('#ora-start').fill(ORA_START);
  await page.locator('#ora-end').fill(ORA_END);
  await page.locator('#ora-break').fill('0');
  await page.locator('#ora-note').fill(E2E_ORE_MOBILE_WRITE_NOTE);

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
 */
async function ensurePendingOreWithMarker(page) {
  await loginAsOperaioFromDevPage(page, { waitForWorkspace: false });
  await gotoFieldWorkspace(page);
  await selectFirstAssignedWork(page);
  await goToSegnaOreSlide(page);
  await fillAndSubmitQuickHours(page);

  await loginAsManagerManodopera(page);
  await gotoValidazioneOre(page);

  await page.waitForFunction(
    (note) => {
      const rows = document.querySelectorAll('#ore-container .ore-table tbody tr');
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(note));
    },
    E2E_ORE_MOBILE_WRITE_NOTE,
    { timeout: 60_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 */
async function validateAllMarkerRows(page) {
  await page.evaluate(() => {
    window.confirm = () => true;
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const markerRows = validazioneRowWithMarker(page);
    const count = await markerRows.count();
    if (count === 0) return;

    const row = markerRows.first();
    const validaBtn = row.getByRole('button', { name: '✅ Valida' });
    if (!(await validaBtn.isVisible())) return;

    const validateBefore = parseInt(await page.locator('#stat-validate').textContent(), 10);

    await validaBtn.click();

    await page.waitForFunction(
      (before) => {
        const el = document.getElementById('stat-validate');
        const n = el ? parseInt(el.textContent, 10) : 0;
        return n > before;
      },
      validateBefore,
      { timeout: 60_000 }
    );
  }
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runValidazioneOreWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  const alreadyOnValidazione = /validazione-ore-standalone\.html/.test(page.url());
  if (alreadyOnValidazione) {
    await waitForValidazioneOreLoaded(page);
  } else {
    await loginAsManagerManodopera(page);
    await gotoValidazioneOre(page);
  }

  await expect(page).toHaveURL(/validazione-ore-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Validazione Ore' })).toBeVisible();

  const markerPending = await page
    .waitForFunction(
      (note) => {
        const rows = document.querySelectorAll('#ore-container .ore-table tbody tr');
        return Array.from(rows).some((tr) => (tr.textContent || '').includes(note));
      },
      E2E_ORE_MOBILE_WRITE_NOTE,
      { timeout: 8_000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!markerPending) {
    await ensurePendingOreWithMarker(page);
  }

  await validateAllMarkerRows(page);

  expect(await validazioneRowWithMarker(page).count()).toBe(0);

  const validateCount = parseInt(await page.locator('#stat-validate').textContent(), 10);
  expect(validateCount).toBeGreaterThanOrEqual(1);
}

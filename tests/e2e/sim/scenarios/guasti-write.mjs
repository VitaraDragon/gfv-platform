/**
 * E2E write — nuova segnalazione guasto macchina (operaio) → verifica lista officina (manager).
 * Idempotente: marker dettagli corto; stesso tenant manodopera per operaio e manager.
 * @module tests/e2e/sim/scenarios/guasti-write
 */

import {
  gotoGuastiList,
  gotoSegnalazioneGuasti,
  loginAsManagerManodopera,
  loginAsOperaioFromDevPage,
} from '../helpers/sim-login.js';

export const E2E_GUASTO_WRITE_DETTAGLI = 'GFV_SIM_E2E_WRITE_GUASTO';

/**
 * @param {import('playwright-core').Page} page
 */
function guastiRowsWithMarker(page) {
  return page.locator('#table-container .guasti-table tbody tr').filter({
    hasText: E2E_GUASTO_WRITE_DETTAGLI,
  });
}

/**
 * @param {import('playwright-core').Page} page
 */
async function hasOpenMarkerGuasto(page) {
  const rows = guastiRowsWithMarker(page);
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    if ((await rows.nth(i).locator('.badge-in-attesa').count()) > 0) {
      return true;
    }
  }
  return false;
}

/**
 * @param {import('playwright-core').Page} page
 */
async function markerAlreadyInGuastiList(page) {
  return (await guastiRowsWithMarker(page).count()) > 0;
}

const E2E_GUASTO_WRITE_UBICAZIONE = 'Podere E2E Sim';

/**
 * Seleziona segnalazione generica — retry dispatch change finché init form (post-auth) è pronto.
 * @param {import('playwright-core').Page} page
 */
async function selectGenericoSegnalazione(page) {
  await page.waitForFunction(() => {
    const alertText = (document.getElementById('alert-container')?.textContent || '').trim();
    if (/solo per operai|solo con il modulo Parco Macchine attivo/i.test(alertText)) return false;

    const tipoGenerico = document.getElementById('tipo-generico');
    const sezioneGenerico = document.getElementById('sezione-generico');
    if (!tipoGenerico || !sezioneGenerico) return false;

    tipoGenerico.checked = true;
    const tipoMacchina = document.getElementById('tipo-macchina');
    if (tipoMacchina) tipoMacchina.checked = false;
    tipoGenerico.dispatchEvent(new Event('change', { bubbles: true }));
    return sezioneGenerico.style.display !== 'none';
  }, { timeout: 90_000 });
}

/**
 * @param {import('playwright-core').Page} page
 */
export async function createGuastoAsOperaio(page) {
  await loginAsOperaioFromDevPage(page);
  await gotoSegnalazioneGuasti(page);

  await selectGenericoSegnalazione(page);

  await page.locator('#guasto-ubicazione').fill(E2E_GUASTO_WRITE_UBICAZIONE);
  await page.locator('#guasto-tipo-problema').selectOption('Altro');
  await page.locator('#gravita-non-grave').check();
  await page.locator('#guasto-dettagli').fill(E2E_GUASTO_WRITE_DETTAGLI);
  await page.locator('#segnala-guasto-form button[type="submit"]').click();

  await page.locator('.alert-success').filter({
    hasText: /Segnalazione inviata con successo/i,
  }).waitFor({ state: 'attached', timeout: 90_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGuastiWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });
  page.setDefaultTimeout(90_000);

  await loginAsManagerManodopera(page);
  await gotoGuastiList(page);
  await page.locator('#filter-stato').selectOption('tutti');

  if (!(await markerAlreadyInGuastiList(page)) || !(await hasOpenMarkerGuasto(page))) {
    await createGuastoAsOperaio(page);
    await loginAsManagerManodopera(page);
    await gotoGuastiList(page);
    await page.locator('#filter-stato').selectOption('tutti');
  }

  await expect(guastiRowsWithMarker(page).first()).toBeVisible({ timeout: 90_000 });

  const row = guastiRowsWithMarker(page).first();
  await expect(row.locator('td').nth(4)).toContainText(E2E_GUASTO_WRITE_DETTAGLI);
  await expect(row.locator('.badge-in-attesa').first()).toBeVisible();
  await expect(row.locator('.badge-non-grave').first()).toBeVisible();
}

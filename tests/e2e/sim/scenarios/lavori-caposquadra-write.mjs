/**
 * E2E write — caposquadra sospende lavoro assegnato (desktop lavori-caposquadra).
 * Usa un lavoro squadra già presente nel seed (no creazione via modale manager).
 * @module tests/e2e/sim/scenarios/lavori-caposquadra-write
 */

import {
  gotoSegnaturaOre,
  loginAsCapoForLavoriDesktop,
  loginAsOperaioFromDevPage,
} from '../helpers/sim-login.js';

export const E2E_CAPO_SOSPENSIONE_CAUSA = 'GFV_SIM_E2E_CAPO_SOSPEND';
export const E2E_ZONA_100_NOTA = 'GFV_SIM_E2E_ZONA_100';

function cardWithSospendiButton(page) {
  return page.locator('#lavori-container .lavoro-card').filter({
    has: page.locator('button', { hasText: 'Sospendi lavoro' }),
  });
}

function cardSospesoWithCausa(page) {
  return page.locator('#lavori-container .lavoro-card').filter({
    hasText: E2E_CAPO_SOSPENSIONE_CAUSA,
  });
}

async function pickLavoroToSuspend(page) {
  const actionable = cardWithSospendiButton(page);
  if ((await actionable.count()) > 0) {
    return actionable.first();
  }
  if ((await cardSospesoWithCausa(page).count()) > 0) {
    return null;
  }
  throw new Error('Nessun lavoro caposquadra sospendibile nel seed');
}

async function extractLavoroIdFromSospendiButton(page, card) {
  const sospendiBtn = card.locator('button', { hasText: 'Sospendi lavoro' });
  await sospendiBtn.waitFor({ state: 'visible', timeout: 30_000 });
  return sospendiBtn.evaluate((btn) => {
    const onclick = btn.getAttribute('onclick') || '';
    const match = onclick.match(/sospendiLavoroDaCaposquadra\('([^']+)'\)/);
    return match ? match[1] : null;
  });
}

async function trySuspendLavoroId(page, lavoroId) {
  return page.evaluate(
    async ({ id, causa }) => {
      if (typeof window.sospendiLavoroDaCaposquadra !== 'function') {
        return { ok: false, debug: { reason: 'missing_fn' } };
      }
      const ok = await window.sospendiLavoroDaCaposquadra(id, causa);
      return { ok: !!ok, debug: window.__gfvSuspendDebug || null };
    },
    { id: lavoroId, causa: E2E_CAPO_SOSPENSIONE_CAUSA }
  );
}

async function suspendLavoroAsCapo(page, expect) {
  const card = await pickLavoroToSuspend(page);
  if (!card) return;

  await card.waitFor({ state: 'visible', timeout: 60_000 });

  const cards = cardWithSospendiButton(page);
  const count = await cards.count();
  let lastDebug = null;

  for (let i = 0; i < count; i += 1) {
    const candidate = cards.nth(i);
    const lavoroId = await extractLavoroIdFromSospendiButton(page, candidate);
    expect(lavoroId).toBeTruthy();

    const suspended = await trySuspendLavoroId(page, lavoroId);
    lastDebug = suspended.debug;
    if (suspended.ok) {
      await expect(cardSospesoWithCausa(page).first()).toBeVisible({ timeout: 60_000 });
      return;
    }
  }

  expect(false, JSON.stringify(lastDebug || { reason: 'no_suspendable_lavoro' })).toBe(true);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runLavoriCaposquadraWriteAssertions(page, expect) {
  expect.configure({ timeout: 120_000 });

  await loginAsCapoForLavoriDesktop(page);

  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    return container && !container.querySelector('.loading');
  }, { timeout: 45_000 });

  const actionable = await cardWithSospendiButton(page).count();
  const alreadyDone = await cardSospesoWithCausa(page).count();
  expect(actionable + alreadyDone).toBeGreaterThanOrEqual(1);

  await suspendLavoroAsCapo(page, expect);

  const suspended = cardSospesoWithCausa(page);
  await expect(suspended.first()).toBeVisible({ timeout: 30_000 });
  await expect(suspended.first()).toContainText(/sospeso/i);
}

/**
 * Zona che copre il terreno → completato_da_approvare con completatoIl,
 * e l'operaio senza ore sul lavoro lo ritrova in Segna ore.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runLavoroZonaAlCentoVisibileInSegnaOre(page, expect) {
  expect.configure({ timeout: 180_000 });

  await loginAsCapoForLavoriDesktop(page);
  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    return container && !container.querySelector('.loading');
  }, { timeout: 45_000 });

  const chiuso = await page.evaluate(async (nota) => {
    if (typeof window.chiudiLavoroConZonaAlCento !== 'function') {
      return { ok: false, reason: 'missing_fn' };
    }
    return window.chiudiLavoroConZonaAlCento(nota);
  }, E2E_ZONA_100_NOTA);

  expect(chiuso && chiuso.ok, JSON.stringify(chiuso || { reason: 'no_result' })).toBe(true);
  expect(chiuso.stato).toBe('completato_da_approvare');
  expect(chiuso.completatoIl).toBe(true);
  expect(chiuso.completatoDa).toBeTruthy();

  const card = page.locator('#lavori-container .lavoro-card').filter({ hasText: chiuso.nome }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText(/In attesa approvazione/i);

  await loginAsOperaioFromDevPage(page, { waitForWorkspace: false });
  await gotoSegnaturaOre(page);

  const cardOre = page.locator('#lavori-container .lavoro-card').filter({ hasText: chiuso.nome }).first();
  await expect(cardOre).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: /Segna Nuova Ora/i }).click();
  await page.locator('#ora-modal.active').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator(`#ora-lavoro option[value="${chiuso.id}"]`)).toHaveCount(1);
}

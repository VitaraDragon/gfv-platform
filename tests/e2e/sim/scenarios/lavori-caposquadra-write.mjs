/**
 * E2E write — caposquadra sospende lavoro assegnato (desktop lavori-caposquadra).
 * @module tests/e2e/sim/scenarios/lavori-caposquadra-write
 */

import {
  gotoGestioneLavori,
  gotoLavoriCaposquadra,
  loginAsCapoForLavoriDesktop,
  loginAsManagerManodopera,
} from '../helpers/sim-login.js';

export const E2E_CAPO_SOSPEND_LAVORO = 'GFV SIM E2E CAPO SOSPEND';
export const E2E_CAPO_SOSPENSIONE_CAUSA = 'GFV_SIM_E2E_CAPO_SOSPEND';

const PREFERRED_TIPO_LAVORO = 'Erpicatura';
const WRITE_DURATA = '2';

function lavoriRowsWithMarker(page) {
  return page.locator('#lavori-container .lavori-table tbody tr').filter({
    hasText: E2E_CAPO_SOSPEND_LAVORO,
  });
}

function capoLavoroCardWithMarker(page) {
  return page.locator('#lavori-container .lavoro-card').filter({
    hasText: E2E_CAPO_SOSPEND_LAVORO,
  });
}

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
    } catch {
      continue;
    }

    const preferred = tipoSelect.locator('option', { hasText: PREFERRED_TIPO_LAVORO });
    if ((await preferred.count()) > 0) {
      await tipoSelect.selectOption((await preferred.first().getAttribute('value')) || { index: 1 });
    } else {
      await tipoSelect.selectOption({ index: 1 });
    }

    const selected = await tipoSelect.inputValue();
    if (selected) return;
  }

  throw new Error('Impossibile selezionare tipo lavoro per capo sospensione E2E');
}

async function ensureLavoroMarkerForCapo(page) {
  await loginAsManagerManodopera(page);
  await gotoGestioneLavori(page);
  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    return container && container.querySelectorAll('.lavori-table tbody tr').length >= 2;
  }, { timeout: 45_000 });
  await clearLavoriFilters(page);

  if ((await lavoriRowsWithMarker(page).count()) > 0) return;

  await openNewLavoroModal(page);
  await page.locator('#lavoro-nome').fill(E2E_CAPO_SOSPEND_LAVORO);
  await page.locator('#lavoro-terreno').selectOption({ index: 1 });
  await pickTipoLavoroInModal(page);
  await page.locator('#lavoro-caposquadra').selectOption({ index: 1 });

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.locator('#lavoro-data-inizio').fill(today);
  await page.locator('#lavoro-durata').fill(WRITE_DURATA);
  await page.locator('#lavoro-stato').selectOption('assegnato');
  await page.locator('#lavoro-note').fill(E2E_CAPO_SOSPENSIONE_CAUSA);

  await page.evaluate(() => {
    const form = document.getElementById('lavoro-form');
    if (form) form.setAttribute('novalidate', 'novalidate');
    const tipoGroup = document.getElementById('tipo-lavoro-group');
    if (tipoGroup) tipoGroup.style.display = 'block';
  });

  await page.locator('#lavoro-form button[type="submit"]').click();
  await page.waitForFunction(
    (marker) =>
      Array.from(document.querySelectorAll('#lavori-container .lavori-table tbody tr')).some((tr) =>
        (tr.textContent || '').includes(marker)
      ),
    E2E_CAPO_SOSPEND_LAVORO,
    { timeout: 90_000 }
  );
}

async function suspendLavoroAsCapo(page, expect) {
  const card = capoLavoroCardWithMarker(page);
  await card.waitFor({ state: 'visible', timeout: 60_000 });

  const cardText = await card.textContent();
  if (/Lavoro sospeso/i.test(cardText || '') && (cardText || '').includes(E2E_CAPO_SOSPENSIONE_CAUSA)) {
    return;
  }

  const sospendiBtn = card.getByRole('button', { name: /Sospendi lavoro/i });
  await expect(sospendiBtn).toBeVisible({ timeout: 30_000 });

  page.once('dialog', async (dialog) => {
    await dialog.accept(E2E_CAPO_SOSPENSIONE_CAUSA);
  });
  await sospendiBtn.click();

  await page.waitForFunction(
    (marker) => {
      const cards = document.querySelectorAll('#lavori-container .lavoro-card');
      return Array.from(cards).some(
        (c) =>
          (c.textContent || '').includes(marker) &&
          /Lavoro sospeso|sospeso/i.test(c.textContent || '')
      );
    },
    E2E_CAPO_SOSPEND_LAVORO,
    { timeout: 60_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runLavoriCaposquadraWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });

  await ensureLavoroMarkerForCapo(page);
  await loginAsCapoForLavoriDesktop(page);
  await gotoLavoriCaposquadra(page);

  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    return container && !container.querySelector('.loading');
  }, { timeout: 45_000 });

  expect(await capoLavoroCardWithMarker(page).count()).toBeGreaterThanOrEqual(1);
  await suspendLavoroAsCapo(page, expect);

  const card = capoLavoroCardWithMarker(page).first();
  await expect(card).toContainText(/sospeso/i);
  await expect(card).toContainText(E2E_CAPO_SOSPENSIONE_CAUSA);
}

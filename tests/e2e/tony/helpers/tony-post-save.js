/**
 * Assert post-save Firestore/DOM per flussi Tony E2E cross-module (M-T4).
 * @module tests/e2e/tony/helpers/tony-post-save
 */

import {
  gotoValidazioneOre,
  loginAsManagerManodopera,
  MOVIMENTI_LIST_PATH,
  PREVENTIVI_LIST_PATH,
  PRODOTTI_LIST_PATH,
} from '../../sim/helpers/sim-login.js';
import { withTonyE2eQuery } from './tony-sim-context.js';

export const TONY_E2E_ORE_NOTE = 'GFV_SIM_TONY_E2E_ORE';
export const TONY_E2E_ORA_START = '08:00';
export const TONY_E2E_ORA_END = '17:00';
export const TONY_E2E_NET_HOURS = '9h';

export const TONY_E2E_MOVIMENTO_NOTE = 'GFV_SIM_TONY_E2E_MOVIMENTO';
export const TONY_E2E_MOVIMENTO_NOTE_USCITA = 'GFV_SIM_TONY_E2E_USCITA';
export const TONY_E2E_MOVIMENTO_NOTE_CROSS = 'GFV_SIM_TONY_E2E_MOV_CROSS';

export const TONY_E2E_PRODOTTO_NOME_015 = 'GFV SIM TONY E2E P015';
export const TONY_E2E_PRODOTTO_NOME_018 = 'GFV SIM TONY E2E P018';
export const TONY_E2E_PRODOTTO_NOTE = 'GFV_SIM_TONY_E2E_PRODOTTO';

export const TONY_E2E_LAVORO_NOME = 'GFV SIM TONY E2E LAVORO';
export const TONY_E2E_LAVORO_NOTE = 'GFV_SIM_TONY_E2E_LAVORO';

export const TONY_E2E_PREVENTIVO_NOTE = 'GFV_SIM_TONY_E2E_PREVENTIVO';
export const TONY_E2E_PREVENTIVO_SUPERFICIE = '9.99';

/**
 * @param {import('playwright-core').Page} page
 * @param {string} marker
 */
function lavoriRowsWithMarker(page, marker) {
  return page.locator('#lavori-container .lavori-table tbody tr').filter({ hasText: marker });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} marker
 */
async function waitForLavoriTableWithMarker(page, marker) {
  await page.waitForFunction(
    (note) => {
      const container = document.getElementById('lavori-container');
      if (!container || /Caricamento/i.test(container.textContent || '')) return false;
      const rows = container.querySelectorAll('.lavori-table tbody tr');
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(note));
    },
    marker,
    { timeout: 45_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {{ nome?: string, note?: string }} [opts]
 */
export async function assertLavoroInLista(page, expect, opts = {}) {
  const nome = opts.nome || TONY_E2E_LAVORO_NOME;
  const note = opts.note || TONY_E2E_LAVORO_NOTE;

  expect.configure({ timeout: 90_000 });

  await expect(page).toHaveURL(/gestione-lavori-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Lavori' })).toBeVisible();

  await waitForLavoriTableWithMarker(page, nome);

  const row = lavoriRowsWithMarker(page, nome).first();
  await expect(row).toBeVisible();
  await expect(row.locator('td').first()).toContainText(nome);
  if (opts.assertNoteInLista) {
    await expect(row).toContainText(note);
  }
  await expect(row.locator('.badge-assegnato, .badge-pianificato, .badge-in_corso').first()).toBeVisible();
}

/**
 * @param {import('playwright-core').Page} page
 */
export async function selectFirstAssignedWork(page) {
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
export async function goToSegnaOreSlide(page) {
  await page.evaluate(() => {
    if (typeof window.gfvFieldWorkspaceGoToHoursSlide === 'function') {
      window.gfvFieldWorkspaceGoToHoursSlide();
    }
  });
  await page.locator('#quick-hours-form').waitFor({ state: 'attached', timeout: 30_000 });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} note
 * @param {number} [timeout]
 */
async function waitForMarkerInValidazioneQueue(page, note, timeout = 60_000) {
  await page.waitForFunction(
    (markerNote) => {
      const rows = document.querySelectorAll('#ore-container .ore-table tbody tr');
      return Array.from(rows).some((tr) => {
        const t = (tr.textContent || '').replace(/\s+/g, ' ').trim();
        return t.includes(markerNote) && !t.includes(`${markerNote}_`);
      });
    },
    note,
    { timeout }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {{
 *   note?: string,
 *   oraStart?: string,
 *   oraEnd?: string,
 *   netHours?: string,
 * }} [opts]
 */
export async function assertOrePendingInValidazione(page, expect, opts = {}) {
  const note = opts.note || TONY_E2E_ORE_NOTE;
  const oraStart = opts.oraStart || TONY_E2E_ORA_START;
  const oraEnd = opts.oraEnd || TONY_E2E_ORA_END;
  const netHours = opts.netHours || TONY_E2E_NET_HOURS;

  expect.configure({ timeout: 90_000 });

  await loginAsManagerManodopera(page);
  await gotoValidazioneOre(page);

  await waitForMarkerInValidazioneQueue(page, note);

  const row = page
    .locator('#ore-container .ore-table tbody tr')
    .filter({ hasText: note, hasNotText: `${note}_` })
    .first();

  await expect(row).toBeVisible();
  await expect(row).toContainText(note);
  await expect(row).toContainText(`${oraStart} - ${oraEnd}`);
  await expect(row.locator('td').nth(5)).toContainText(netHours);
  await expect(row.getByRole('button', { name: '✅ Valida' })).toBeVisible();
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} marker
 */
async function waitForMovimentiTableWithMarker(page, marker) {
  await page.waitForFunction(
    (note) => {
      const container = document.getElementById('movimenti-container');
      if (!container || /Caricamento movimenti/i.test(container.textContent || '')) return false;
      const rows = container.querySelectorAll('.movimenti-table tbody tr');
      if (rows.length === 0) {
        const empty = container.querySelector('.empty-state');
        return empty && !/Caricamento/i.test(empty.textContent || '');
      }
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(note));
    },
    marker,
    { timeout: 45_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {{ note?: string, quantita?: string }} [opts]
 */
export async function assertMovimentoEntrataInLista(page, expect, opts = {}) {
  const note = opts.note || TONY_E2E_MOVIMENTO_NOTE;
  const quantita = opts.quantita || '10';

  expect.configure({ timeout: 90_000 });

  await page.goto(withTonyE2eQuery(MOVIMENTI_LIST_PATH));
  await expect(page).toHaveURL(/movimenti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Movimenti Magazzino' })).toBeVisible();

  await waitForMovimentiTableWithMarker(page, note);

  const row = page
    .locator('#movimenti-container .movimenti-table tbody tr')
    .filter({ hasText: note })
    .filter({ has: page.locator('.badge-entrata') })
    .first();

  await expect(row).toBeVisible();
  await expect(row).toContainText(note);
  await expect(row).toContainText(quantita);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} marker
 */
async function waitForProdottiTableWithMarker(page, marker) {
  await page.waitForFunction(
    (nome) => {
      const container = document.getElementById('prodotti-container');
      if (!container || /Caricamento/i.test(container.textContent || '')) return false;
      const rows = container.querySelectorAll('.prodotti-table tbody tr');
      return Array.from(rows).some((tr) => (tr.textContent || '').includes(nome));
    },
    marker,
    { timeout: 45_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {{ nome?: string }} [opts]
 */
export async function assertProdottoInLista(page, expect, opts = {}) {
  const nome = opts.nome || TONY_E2E_PRODOTTO_NOME_018;

  expect.configure({ timeout: 90_000 });

  await page.goto(withTonyE2eQuery(PRODOTTI_LIST_PATH));
  await expect(page).toHaveURL(/prodotti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Anagrafica Prodotti' })).toBeVisible();

  await waitForProdottiTableWithMarker(page, nome);

  const row = page
    .locator('#prodotti-container .prodotti-table tbody tr')
    .filter({ hasText: nome })
    .first();

  await expect(row).toBeVisible();
  await expect(row).toContainText(nome);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {{ note?: string, quantita?: string }} [opts]
 */
export async function assertMovimentoUscitaInLista(page, expect, opts = {}) {
  const note = opts.note || TONY_E2E_MOVIMENTO_NOTE_USCITA;
  const quantita = opts.quantita || '5';

  expect.configure({ timeout: 90_000 });

  await page.goto(withTonyE2eQuery(MOVIMENTI_LIST_PATH));
  await expect(page).toHaveURL(/movimenti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Movimenti Magazzino' })).toBeVisible();

  await waitForMovimentiTableWithMarker(page, note);

  const row = page
    .locator('#movimenti-container .movimenti-table tbody tr')
    .filter({ hasText: note })
    .filter({ has: page.locator('.badge-uscita') })
    .first();

  await expect(row).toBeVisible();
  await expect(row).toContainText(note);
  await expect(row).toContainText(quantita);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} superficie
 * @param {string} tipoFragment
 */
async function waitForPreventiviTableWithMarker(page, superficie, tipoFragment) {
  await page.waitForFunction(
    ({ sup, tipo }) => {
      const container = document.getElementById('preventivi-container');
      if (!container || /Caricamento preventivi/i.test(container.textContent || '')) return false;
      const rows = container.querySelectorAll('.preventivi-table tbody tr');
      return Array.from(rows).some((tr) => {
        const t = tr.textContent || '';
        return t.includes(sup) && (!tipo || t.toLowerCase().includes(String(tipo).toLowerCase()));
      });
    },
    { sup: superficie, tipo: tipoFragment },
    { timeout: 45_000 }
  );
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {{
 *   clienteNome?: string,
 *   tipoLavoro?: string,
 *   superficie?: string,
 *   note?: string,
 * }} [opts]
 */
export async function assertPreventivoInLista(page, expect, opts = {}) {
  const superficie = opts.superficie || TONY_E2E_PREVENTIVO_SUPERFICIE;
  const tipoLavoro = opts.tipoLavoro || 'Erpicatura';
  const clienteNome = opts.clienteNome || '';

  expect.configure({ timeout: 90_000 });

  if (!/preventivi-standalone\.html/.test(page.url())) {
    await page.goto(withTonyE2eQuery(PREVENTIVI_LIST_PATH));
  }

  await expect(page).toHaveURL(/preventivi-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Preventivi' })).toBeVisible();

  const hasReset = await page.evaluate(() => typeof window.resetFilters === 'function');
  if (hasReset) {
    await page.evaluate(() => window.resetFilters());
  }

  await waitForPreventiviTableWithMarker(page, superficie, tipoLavoro.split(' ')[0]);

  const row = page
    .locator('#preventivi-container .preventivi-table tbody tr')
    .filter({ hasText: superficie })
    .filter({ hasText: tipoLavoro.split(' ')[0] })
    .first();

  await expect(row).toBeVisible();
  await expect(row.locator('td').nth(4)).toContainText(`${superficie} ha`);
  await expect(row.locator('.badge-secondary').filter({ hasText: /Bozza/i })).toBeVisible();
  await expect(row.locator('td').nth(5)).toContainText('€');
  if (clienteNome) {
    await expect(row.locator('td').nth(1)).toContainText(clienteNome.split(' ')[0]);
  }
}

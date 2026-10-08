/**
 * E2E — modifica lavoro: data inizio = giorno locale, non D−1 da toISOString UTC.
 * Il test forza Europe/Rome (vedi spec) e un Timestamp a mezzanotte locale,
 * così UTC è il giorno prima e il campo deve restare sul giorno salvato.
 * @module tests/e2e/sim/scenarios/gestione-lavori-data-edit
 */

import {
  clearLavoriFilters,
  fillAndSubmitNewLavoro,
  lavoriRowsWithMarker,
  openNewLavoroModal,
} from './gestione-lavori-write.mjs';

/** Marker dedicato: non sposta le date dei lavori di seed. */
export const E2E_LAVORO_DATA_NOME = 'GFV SIM E2E DATA LOCALE';

export const E2E_LAVORO_DATA_NOTE = 'GFV_SIM_E2E_DATA_LOCALE';

/** 29 settembre 2026, mezzanotte locale → in Europe/Rome (CEST) è ancora il 28 in UTC. */
export const E2E_LAVORO_DATA_ISO = '2026-09-29';

const E2E_LAVORO_DATA_UTC = '2026-09-28';

const E2E_LAVORO_DATA_LABEL = '29 settembre 2026';

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGestioneLavoriDataEditAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/gestione-lavori-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Gestione Lavori' })).toBeVisible();

  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    return container && container.querySelectorAll('.lavori-table tbody tr').length >= 1;
  }, { timeout: 45_000 });

  await clearLavoriFilters(page);

  let markerRows = lavoriRowsWithMarker(page, E2E_LAVORO_DATA_NOME);
  if ((await markerRows.count()) === 0) {
    await openNewLavoroModal(page);
    await fillAndSubmitNewLavoro(page, {
      nome: E2E_LAVORO_DATA_NOME,
      note: E2E_LAVORO_DATA_NOTE,
    });
    await page.waitForFunction(
      (marker) => Array.from(document.querySelectorAll('#lavori-container .lavori-table tbody tr')).some(
        (tr) => (tr.textContent || '').includes(marker)
      ),
      E2E_LAVORO_DATA_NOME,
      { timeout: 30_000 }
    );
    await clearLavoriFilters(page);
    markerRows = lavoriRowsWithMarker(page, E2E_LAVORO_DATA_NOME);
  }

  expect(await markerRows.count()).toBeGreaterThanOrEqual(1);

  const prepared = await page.evaluate(
    ({ marker, expected }) => {
      const list = window.lavoriState && window.lavoriState.lavoriList;
      if (!list) return { error: 'no-state' };
      const lav = list.find((l) => (l.nome || '').includes(marker));
      if (!lav) return { error: 'no-lavoro' };
      const parts = expected.split('-').map((n) => parseInt(n, 10));
      lav.dataInizio = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      const utc = lav.dataInizio.toISOString().slice(0, 10);
      const local = [
        lav.dataInizio.getFullYear(),
        String(lav.dataInizio.getMonth() + 1).padStart(2, '0'),
        String(lav.dataInizio.getDate()).padStart(2, '0'),
      ].join('-');
      return { id: lav.id, utc, local };
    },
    { marker: E2E_LAVORO_DATA_NOME, expected: E2E_LAVORO_DATA_ISO }
  );

  expect(prepared.error, JSON.stringify(prepared)).toBeUndefined();
  expect(prepared.local).toBe(E2E_LAVORO_DATA_ISO);
  expect(prepared.utc).toBe(E2E_LAVORO_DATA_UTC);

  await page.evaluate((id) => window.openModificaModal(id), prepared.id);
  await page.locator('#lavoro-modal.active').waitFor({ timeout: 30_000 });

  await page.waitForFunction(
    (expected) => {
      const data = document.getElementById('lavoro-data-inizio');
      const tipo = document.getElementById('lavoro-tipo-lavoro');
      const capo = document.getElementById('lavoro-caposquadra');
      const nome = document.getElementById('lavoro-nome');
      return (
        data &&
        data.value === expected &&
        tipo &&
        tipo.value &&
        capo &&
        capo.value &&
        nome &&
        nome.value.length >= 3
      );
    },
    E2E_LAVORO_DATA_ISO,
    { timeout: 30_000 }
  );

  await expect(page.locator('#lavoro-data-inizio')).toHaveValue(E2E_LAVORO_DATA_ISO);

  // Il modale riapplica assegnazione a 350 ms: attendi che finisca prima del submit.
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const form = document.getElementById('lavoro-form');
    if (form) form.setAttribute('novalidate', 'novalidate');
    const tipoGroup = document.getElementById('tipo-lavoro-group');
    if (tipoGroup) tipoGroup.style.display = 'block';
  });

  await page.locator('#lavoro-form button[type="submit"]').click();

  await page.waitForFunction(
    ({ marker, label }) => {
      const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert');
      const hasToast = Array.from(toasts).some((t) =>
        /Lavoro modificato con successo/i.test(t.textContent || '')
      );
      if (!hasToast) return false;
      return Array.from(document.querySelectorAll('#lavori-container .lavori-table tbody tr')).some(
        (tr) => (tr.textContent || '').includes(marker) && (tr.textContent || '').includes(label)
      );
    },
    { marker: E2E_LAVORO_DATA_NOME, label: E2E_LAVORO_DATA_LABEL },
    { timeout: 90_000 }
  );

  const row = lavoriRowsWithMarker(page, E2E_LAVORO_DATA_NOME).first();
  await expect(row).toContainText(E2E_LAVORO_DATA_LABEL);
  await expect(row).not.toContainText('28 settembre 2026');

  await page.evaluate((id) => window.openModificaModal(id), prepared.id);
  await page.locator('#lavoro-modal.active').waitFor({ timeout: 30_000 });
  await page.waitForFunction(
    (expected) => document.getElementById('lavoro-data-inizio')?.value === expected,
    E2E_LAVORO_DATA_ISO,
    { timeout: 30_000 }
  );
  await expect(page.locator('#lavoro-data-inizio')).toHaveValue(E2E_LAVORO_DATA_ISO);
}

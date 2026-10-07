/**
 * E2E — manager: Sospendi / Rinvia (sospensione operativa) distinta da Standby assenza.
 * Copre il modal Modifica (stato → sospeso scrive sospensioneCausa) e l'azione riga
 * con data ripresa opzionale. Non scrive in_standby.
 * @module tests/e2e/sim/scenarios/gestione-lavori-sospendi-rinvia
 */

import {
  clearLavoriFilters,
  fillAndSubmitNewLavoro,
  openNewLavoroModal,
} from './gestione-lavori-write.mjs';

export const E2E_LAVORO_SOSPENDI_MODIFICA = 'GFV SIM E2E SOSPENDI MODIFICA';
export const E2E_LAVORO_SOSPENDI_RIGA = 'GFV SIM E2E SOSPENDI RIGA';

/**
 * @param {import('playwright-core').Page} page
 * @param {string} nome
 * @returns {Promise<string|null>}
 */
async function lavoroIdByNome(page, nome) {
  return page.evaluate((marker) => {
    const list = window.lavoriState && window.lavoriState.lavoriList;
    const lav = (list || []).find((l) => (l.nome || '') === marker);
    return lav ? lav.id : null;
  }, nome);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} id
 */
async function readLavoro(page, id) {
  return page.evaluate((lavoroId) => {
    const list = window.lavoriState && window.lavoriState.lavoriList;
    const lav = (list || []).find((l) => l.id === lavoroId);
    if (!lav) return null;
    return {
      id: lav.id,
      nome: lav.nome || '',
      stato: lav.stato || null,
      sospensioneCausa: lav.sospensioneCausa || '',
      hasSospensioneIl: lav.sospensioneIl != null && lav.sospensioneIl !== '',
      standbyCausa: lav.standbyCausa ?? null,
      standbyNota: lav.standbyNota ?? null,
      standbyGiornoKey: lav.standbyGiornoKey ?? null,
      ripresaDaLavoroId: lav.ripresaDaLavoroId || null,
    };
  }, id);
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} origineId
 */
async function findRipresa(page, origineId, nomeBase) {
  return page.evaluate(({ id, nome }) => {
    const list = window.lavoriState && window.lavoriState.lavoriList;
    const lav = (list || []).find((l) => {
      const link = l.ripresaDaLavoroId === id;
      const byName = (l.nome || '') === `${nome} (ripresa)`;
      return link || byName;
    });
    if (!lav) return null;
    let dataIso = '';
    if (lav.dataInizio instanceof Date) {
      const d = lav.dataInizio;
      dataIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else if (lav.dataInizio && typeof lav.dataInizio.toDate === 'function') {
      const d = lav.dataInizio.toDate();
      dataIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return {
      id: lav.id,
      nome: lav.nome || '',
      stato: lav.stato || null,
      ripresaDaLavoroId: lav.ripresaDaLavoroId || null,
      dataIso,
    };
  }, { id: origineId, nome: nomeBase });
}

function assertNonStandby(expect, snap) {
  expect(snap.stato).toBe('sospeso');
  expect(snap.stato).not.toBe('in_standby');
  expect(snap.sospensioneCausa.length).toBeGreaterThan(0);
  expect(snap.hasSospensioneIl).toBe(true);
  expect(snap.standbyCausa).toBeNull();
  expect(snap.standbyGiornoKey).toBeNull();
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} nome
 * @param {string} note
 */
async function ensureLavoro(page, nome, note) {
  await clearLavoriFilters(page);
  let id = await lavoroIdByNome(page, nome);
  if (id) return id;
  await openNewLavoroModal(page);
  await fillAndSubmitNewLavoro(page, { nome, note });
  await page.waitForFunction((marker) => {
    const list = window.lavoriState && window.lavoriState.lavoriList;
    return (list || []).some((l) => l.nome === marker);
  }, nome, { timeout: 90_000 });
  await clearLavoriFilters(page);
  id = await lavoroIdByNome(page, nome);
  if (!id) throw new Error(`Lavoro non trovato dopo la creazione: ${nome}`);
  return id;
}

/**
 * @param {import('playwright-core').Page} page
 */
async function prepareModificaForm(page) {
  await page.locator('#lavoro-modal.active').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const tipo = document.getElementById('lavoro-tipo-lavoro');
    const capo = document.getElementById('lavoro-caposquadra');
    const nome = document.getElementById('lavoro-nome');
    return tipo && tipo.value && capo && capo.value && nome && nome.value.length >= 3;
  }, { timeout: 30_000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const form = document.getElementById('lavoro-form');
    if (form) form.setAttribute('novalidate', 'novalidate');
    const tipoGroup = document.getElementById('tipo-lavoro-group');
    if (tipoGroup) tipoGroup.style.display = 'block';
  });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGestioneLavoriSospendiRinviaAssertions(page, expect) {
  expect.configure({ timeout: 60_000 });

  await expect(page).toHaveURL(/gestione-lavori-standalone\.html/);
  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    return container && !container.querySelector('.loading');
  }, { timeout: 45_000 });

  const modificaId = await ensureLavoro(page, E2E_LAVORO_SOSPENDI_MODIFICA, 'GFV_SIM_E2E_SOSPENDI_MODIFICA');
  let modifica = await readLavoro(page, modificaId);
  expect(modifica).toBeTruthy();

  if (modifica.stato === 'assegnato' || modifica.stato === 'in_corso' || modifica.stato === 'attivo') {
    const row = page.locator(`#lavoro-row-${modificaId}`);
    await expect(row.getByRole('button', { name: /Sospendi \/ Rinvia/ })).toBeVisible();
    await expect(row.getByRole('button', { name: /Standby assenza/ })).toBeVisible();
    await expect(row.getByRole('button', { name: /Sospendi \/ Rinvia/ })).toHaveAttribute(
      'title',
      /Non è un'assenza del personale/
    );

    await page.evaluate((id) => window.openModificaModal(id), modificaId);
    await prepareModificaForm(page);
    await page.locator('#lavoro-stato').selectOption('sospeso');
    await expect(page.locator('#lavoro-sospensione-group')).toBeVisible();
    await page.locator('#lavoro-sospensione-motivo').selectOption('');
    await page.locator('#lavoro-form button[type="submit"]').click();
    await expect(page.locator('#gfv-standalone-toast-layer .alert').filter({ hasText: /motivo della sospensione/i }).last())
      .toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#lavoro-modal.active')).toBeVisible();

    const ancoraAperto = await readLavoro(page, modificaId);
    expect(ancoraAperto.stato === 'assegnato' || ancoraAperto.stato === 'in_corso' || ancoraAperto.stato === 'attivo').toBe(true);
    expect(ancoraAperto.stato).not.toBe('in_standby');

    await page.locator('#lavoro-sospensione-motivo').selectOption('guasto');
    await page.locator('#lavoro-form button[type="submit"]').click();
    await page.waitForFunction((id) => {
      const list = window.lavoriState && window.lavoriState.lavoriList;
      const lav = (list || []).find((l) => l.id === id);
      return lav && lav.stato === 'sospeso' && lav.sospensioneCausa === 'Guasto';
    }, modificaId, { timeout: 60_000 });
    modifica = await readLavoro(page, modificaId);
  }

  assertNonStandby(expect, modifica);
  expect(modifica.sospensioneCausa === 'Guasto' || modifica.sospensioneCausa.startsWith('Guasto')).toBe(true);
  await expect(page.locator(`#lavoro-row-${modificaId}`).getByRole('button', { name: /Crea ripresa/ })).toBeVisible();
  await expect(page.locator(`#lavoro-row-${modificaId}`).getByRole('button', { name: /Standby assenza/ })).toHaveCount(0);
  await expect(page.locator(`#lavoro-row-${modificaId}`).getByRole('button', { name: /Sospendi \/ Rinvia/ })).toHaveCount(0);

  await page.evaluate(() => {
    if (typeof window.closeLavoroModal === 'function') window.closeLavoroModal();
  });

  const rigaId = await ensureLavoro(page, E2E_LAVORO_SOSPENDI_RIGA, 'GFV_SIM_E2E_SOSPENDI_RIGA');
  let riga = await readLavoro(page, rigaId);
  expect(riga).toBeTruthy();

  if (riga.stato === 'assegnato' || riga.stato === 'in_corso' || riga.stato === 'attivo') {
    await page.evaluate((id) => window.openSospendiRinviaModal(id), rigaId);
    await page.locator('#sospendi-rinvia-modal.active').waitFor({ timeout: 15_000 });
    await page.locator('#sospendi-rinvia-conferma-btn').click();
    await expect(page.locator('#gfv-standalone-toast-layer .alert').filter({ hasText: /motivo della sospensione/i }).last())
      .toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#sospendi-rinvia-modal.active')).toBeVisible();
    const nonSalvato = await readLavoro(page, rigaId);
    expect(nonSalvato.stato).not.toBe('sospeso');
    expect(nonSalvato.stato).not.toBe('in_standby');

    const dataRipresa = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    await page.locator('#sospendi-rinvia-motivo').selectOption('maltempo');
    await page.locator('#sospendi-rinvia-data').fill(dataRipresa);
    await expect(page.locator('#sospendi-rinvia-conferma-btn')).toHaveText(/crea ripresa/i);
    await page.locator('#sospendi-rinvia-conferma-btn').click();

    await page.waitForFunction((id) => {
      const list = window.lavoriState && window.lavoriState.lavoriList;
      const lav = (list || []).find((l) => l.id === id);
      return lav && lav.stato === 'sospeso' && lav.sospensioneCausa === 'Maltempo';
    }, rigaId, { timeout: 60_000 });
    await page.waitForFunction(({ id, nome }) => {
      const list = window.lavoriState && window.lavoriState.lavoriList;
      return (list || []).some((l) => l.ripresaDaLavoroId === id || l.nome === `${nome} (ripresa)`);
    }, { id: rigaId, nome: E2E_LAVORO_SOSPENDI_RIGA }, { timeout: 60_000 });

    riga = await readLavoro(page, rigaId);
    const ripresa = await findRipresa(page, rigaId, E2E_LAVORO_SOSPENDI_RIGA);
    expect(ripresa).toBeTruthy();
    expect(ripresa.ripresaDaLavoroId).toBe(rigaId);
    expect(ripresa.dataIso).toBe(dataRipresa);
    expect(ripresa.stato).not.toBe('in_standby');
  }

  assertNonStandby(expect, riga);
  expect(riga.sospensioneCausa === 'Maltempo' || riga.sospensioneCausa.startsWith('Maltempo')).toBe(true);
  const ripresaFinale = await findRipresa(page, rigaId, E2E_LAVORO_SOSPENDI_RIGA);
  expect(ripresaFinale).toBeTruthy();
  expect(ripresaFinale.ripresaDaLavoroId).toBe(rigaId);
  expect(ripresaFinale.stato).not.toBe('in_standby');
}

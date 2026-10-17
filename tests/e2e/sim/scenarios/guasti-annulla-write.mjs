/**
 * E2E — l'operaio annulla o chiude da solo; il manager non vede l'annullato tra gli aperti.
 * Se il seed ha un trattore libero, l'annullo riporta la macchina allo stato di prima.
 * Se c'è anche un attrezzo, «Segna risolto» del manager rimette a posto tutti e due.
 * @module tests/e2e/sim/scenarios/guasti-annulla-write
 */

import {
  gotoGuastiList,
  gotoSegnalazioneGuasti,
  loginAsManagerManodopera,
  loginAsOperaioFromDevPage,
} from '../helpers/sim-login.js';

export const E2E_GUASTO_ANNULLA_MARKER = 'GFV_SIM_E2E_ANNULLA_GUASTO';

const FIRESTORE = 'http://127.0.0.1:8080';
const PROJECT = 'gfv-platform';

function cardGuasto(page, marker) {
  return page.locator('#guasti-list .guasto-item').filter({ hasText: marker });
}

function rigaManager(page, marker) {
  return page.locator('#table-container .guasti-table tbody tr').filter({ hasText: marker });
}

async function selectGenerico(page) {
  await page.locator('#tipo-generico').check();
  await page.locator('#sezione-generico').waitFor({ state: 'visible', timeout: 30_000 });
}

async function inviaGenerico(page, marker) {
  await selectGenerico(page);
  await page.locator('#guasto-ubicazione').fill('Podere E2E Annulla');
  await page.locator('#guasto-tipo-problema').selectOption('Altro');
  await page.locator('#gravita-non-grave').check();
  await page.locator('#guasto-dettagli').fill(marker);
  await page.locator('#segnala-guasto-form button[type="submit"]').click();
  await cardGuasto(page, marker).waitFor({ state: 'visible', timeout: 90_000 });
}

async function tenantId(page) {
  return page.evaluate(() => (
    sessionStorage.getItem('gfv_current_tenant_id')
    || localStorage.getItem('gfv_preferred_tenant_id')
  ));
}

async function statoMacchina(tenant, id) {
  const url = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/tenants/${tenant}/macchine/${id}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer owner' } });
  if (!res.ok) return null;
  const body = await res.json();
  return (body.fields && body.fields.stato && body.fields.stato.stringValue) || null;
}

async function attendiStato(tenant, id, atteso) {
  const started = Date.now();
  let ultimo = null;
  while (Date.now() - started < 25_000) {
    ultimo = await statoMacchina(tenant, id);
    if (ultimo === atteso) return ultimo;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Macchina ${id}: atteso «${atteso}», letto «${ultimo}»`);
}

async function mezziLiberi(page) {
  return page.evaluate(() => {
    const ids = (sel) => Array.from(document.querySelectorAll(`${sel} option`))
      .filter((opt) => opt.value && !opt.disabled)
      .map((opt) => opt.value);
    return { trattori: ids('#guasto-macchina'), attrezzi: ids('#guasto-attrezzo') };
  });
}

/**
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runGuastiAnnullaWriteAssertions(page, expect) {
  expect.configure({ timeout: 90_000 });
  page.setDefaultTimeout(90_000);
  const stamp = Date.now();
  const markerAnnulla = `${E2E_GUASTO_ANNULLA_MARKER} ${stamp}`;
  const markerRisolto = `${E2E_GUASTO_ANNULLA_MARKER} RISOLTO ${stamp}`;
  const markerMacchina = `${E2E_GUASTO_ANNULLA_MARKER} MACCHINA ${stamp}`;
  const markerEntrambi = `${E2E_GUASTO_ANNULLA_MARKER} ENTRAMBI ${stamp}`;

  await loginAsOperaioFromDevPage(page);
  await gotoSegnalazioneGuasti(page);

  await inviaGenerico(page, markerAnnulla);
  const cardAnnulla = cardGuasto(page, markerAnnulla);
  await expect(cardAnnulla.getByRole('button', { name: /Annulla segnalazione/i })).toBeVisible();
  await expect(cardAnnulla.getByRole('button', { name: /Risolto da me/i })).toBeVisible();
  await cardAnnulla.getByRole('button', { name: /Annulla segnalazione/i }).click();
  await page.locator('#annulla-modal.show').waitFor({ state: 'visible' });
  await page.locator('#annulla-guasto-form button[type="submit"]').click();
  await expect(cardAnnulla.locator('.badge-annullato')).toBeVisible();
  await expect(cardAnnulla.getByRole('button', { name: /Annulla segnalazione|Risolto da me/i })).toHaveCount(0);

  await inviaGenerico(page, markerRisolto);
  const cardRisolto = cardGuasto(page, markerRisolto);
  await cardRisolto.getByRole('button', { name: /Risolto da me/i }).click();
  await page.locator('#risolvi-modal.show').waitFor({ state: 'visible' });
  await page.locator('#risolvi-guasto-form button[type="submit"]').click();
  await expect(page.locator('#risolvi-note')).toHaveJSProperty('validity.valid', false);
  await expect(page.locator('#risolvi-modal.show')).toBeVisible();
  await page.locator('#risolvi-note').fill('Chiuso in campo durante la prova');
  await page.locator('#risolvi-costo').fill('12.5');
  await page.locator('#risolvi-guasto-form button[type="submit"]').click();
  await expect(cardRisolto.locator('.badge-risolto')).toBeVisible();
  await expect(cardRisolto.getByRole('button', { name: /Risolto da me|Annulla segnalazione/i })).toHaveCount(0);

  const tenant = await tenantId(page);
  await page.locator('#tipo-macchina').check();
  await page.locator('#sezione-macchina').waitFor({ state: 'visible' });
  const liberi = await mezziLiberi(page);
  let entrambi = null;

  if (tenant && liberi.trattori.length) {
    const trattoreId = liberi.trattori[0];
    const prima = await statoMacchina(tenant, trattoreId);
    if (prima === 'disponibile' || prima === 'in_uso') {
      await page.locator('#guasto-macchina').selectOption(trattoreId);
      await page.locator('#guasto-attrezzo').selectOption('');
      await page.locator('#guasto-componente').selectOption('trattore');
      await page.locator('#gravita-non-grave').check();
      await page.locator('#guasto-dettagli').fill(markerMacchina);
      await page.locator('#segnala-guasto-form button[type="submit"]').click();
      await cardGuasto(page, markerMacchina).waitFor({ state: 'visible', timeout: 90_000 });
      await attendiStato(tenant, trattoreId, 'guasto-lavoro-in-corso');
      const cardMacchina = cardGuasto(page, markerMacchina);
      await cardMacchina.getByRole('button', { name: /Annulla segnalazione/i }).click();
      await page.locator('#annulla-modal.show').waitFor({ state: 'visible' });
      await page.locator('#annulla-guasto-form button[type="submit"]').click();
      await expect(cardMacchina.locator('.badge-annullato')).toBeVisible();
      await attendiStato(tenant, trattoreId, prima);
      await page.waitForFunction((mezzoId) => {
        const opt = document.querySelector(`#guasto-macchina option[value="${mezzoId}"]`);
        return opt && !opt.disabled;
      }, trattoreId);
    } else {
      console.log(`[guasti-annulla] trattore ${trattoreId} è «${prima}»: salto il ripristino`);
    }
  } else {
    console.log('[guasti-annulla] nessun trattore libero: salto il ripristino della macchina');
  }

  const dopoMacchina = await mezziLiberi(page);
  if (tenant && dopoMacchina.trattori.length && dopoMacchina.attrezzi.length) {
    const trattoreId = dopoMacchina.trattori[0];
    const attrezzoId = dopoMacchina.attrezzi[0];
    const trattorePrima = await statoMacchina(tenant, trattoreId);
    const attrezzoPrima = await statoMacchina(tenant, attrezzoId);
    const statiOk = (trattorePrima === 'disponibile' || trattorePrima === 'in_uso')
      && (attrezzoPrima === 'disponibile' || attrezzoPrima === 'in_uso');
    if (statiOk) {
      entrambi = { trattoreId, attrezzoId, trattorePrima, attrezzoPrima };
      await page.locator('#guasto-macchina').selectOption(trattoreId);
      await page.locator('#guasto-attrezzo').selectOption(attrezzoId);
      await page.locator('#guasto-componente').selectOption('entrambi');
      await page.locator('#gravita-non-grave').check();
      await page.locator('#guasto-dettagli').fill(markerEntrambi);
      await page.locator('#segnala-guasto-form button[type="submit"]').click();
      await cardGuasto(page, markerEntrambi).waitFor({ state: 'visible', timeout: 90_000 });
      await attendiStato(tenant, trattoreId, 'guasto-lavoro-in-corso');
      await attendiStato(tenant, attrezzoId, 'guasto-lavoro-in-corso');
    } else {
      console.log('[guasti-annulla] la coppia libera non è disponibile/in uso: salto Segna risolto su Entrambi');
    }
  } else {
    console.log('[guasti-annulla] niente coppia trattore+attrezzo libera: salto Segna risolto su Entrambi');
  }

  await loginAsManagerManodopera(page);
  await gotoGuastiList(page);
  await page.locator('#filter-stato').selectOption('aperti');
  await expect(rigaManager(page, markerAnnulla)).toHaveCount(0);

  await page.locator('#filter-stato').selectOption('tutti');
  const riga = rigaManager(page, markerAnnulla).first();
  await expect(riga).toBeVisible();
  await expect(riga.locator('.badge-annullato')).toBeVisible();
  await expect(riga.getByRole('button', { name: /Segna risolto/i })).toHaveCount(0);

  if (entrambi) {
    await page.locator('#filter-stato').selectOption('aperti');
    const rigaEntrambi = rigaManager(page, markerEntrambi).first();
    await expect(rigaEntrambi).toBeVisible();
    await rigaEntrambi.getByRole('button', { name: /Segna risolto/i }).click();
    await page.locator('#modal-risolvi.active').waitFor({ state: 'visible' });
    await page.locator('#risolvi-note').fill('Chiuso dalla lista in prova');
    await page.locator('#form-risolvi button[type="submit"]').click();
    await page.waitForFunction(() => {
      const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert, #alert-container .alert-success');
      return Array.from(toasts).some((t) => /Guasto segnato come risolto/i.test(t.textContent || ''));
    }, { timeout: 60_000 });
    await attendiStato(tenant, entrambi.trattoreId, entrambi.trattorePrima);
    await attendiStato(tenant, entrambi.attrezzoId, entrambi.attrezzoPrima);
  }
}

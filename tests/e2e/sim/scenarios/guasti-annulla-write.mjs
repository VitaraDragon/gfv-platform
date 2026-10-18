/**
 * E2E — l'operaio annulla o chiude da solo; il manager non vede l'annullato tra gli aperti.
 * Se il seed ha un trattore libero, l'annullo riporta la macchina allo stato di prima.
 * Se c'è anche un attrezzo, «Segna risolto» del manager rimette a posto tutti e due.
 * @module tests/e2e/sim/scenarios/guasti-annulla-write
 */

import { isGuastoAttivo } from '../../../../core/services/guasto-stati.js';
import { idMezziCoinvolti } from '../../../../core/services/guasto-ripristino.js';
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

async function scriviStatoMacchina(tenant, id, stato) {
  const url = new URL(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/tenants/${tenant}/macchine/${id}`);
  url.searchParams.append('updateMask.fieldPaths', 'stato');
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: { stato: { stringValue: stato } } }),
  });
  if (!res.ok) throw new Error(`Ripristino seed macchina ${id}: ${res.status}`);
}

async function guastiDelTenant(tenant) {
  const out = [];
  let pageToken = '';
  do {
    const url = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/tenants/${tenant}/guasti?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: 'Bearer owner' } });
    if (!res.ok) return null;
    const body = await res.json();
    const docs = Array.isArray(body.documents) ? body.documents : [];
    docs.forEach((docItem) => {
      const fields = docItem.fields || {};
      const nome = String(docItem.name || '');
      const id = nome.slice(nome.lastIndexOf('/') + 1);
      const testo = (field) => (fields[field] && fields[field].stringValue) || '';
      out.push({
        id,
        stato: testo('stato'),
        tipoGuasto: testo('tipoGuasto'),
        componenteGuasto: testo('componenteGuasto'),
        macchinaId: testo('macchinaId'),
        attrezzoId: testo('attrezzoId'),
        dettagli: testo('dettagli'),
      });
    });
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return out;
}

function mezzoSenzaAltroGuasto(guasti, mezzoId) {
  return !guasti.some((g) => isGuastoAttivo(g.stato) && idMezziCoinvolti(g).includes(mezzoId));
}

async function cancellaGuasti(tenant, ids) {
  for (let i = 0; i < ids.length; i += 1) {
    if (!ids[i]) continue;
    await fetch(
      `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/tenants/${tenant}/guasti/${ids[i]}`,
      { method: 'DELETE', headers: { Authorization: 'Bearer owner' } }
    );
  }
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
  const idsGuasto = [];
  async function ricordaId(selector) {
    const id = await page.locator(selector).inputValue();
    if (id && idsGuasto.indexOf(id) < 0) idsGuasto.push(id);
  }

  await loginAsOperaioFromDevPage(page);
  await gotoSegnalazioneGuasti(page);

  await inviaGenerico(page, markerAnnulla);
  const cardAnnulla = cardGuasto(page, markerAnnulla);
  await expect(cardAnnulla.getByRole('button', { name: /Annulla segnalazione/i })).toBeVisible();
  await expect(cardAnnulla.getByRole('button', { name: /Risolto da me/i })).toBeVisible();
  await cardAnnulla.getByRole('button', { name: /Annulla segnalazione/i }).click();
  await page.locator('#annulla-modal.show').waitFor({ state: 'visible' });
  await ricordaId('#annulla-guasto-id');
  await page.locator('#annulla-guasto-form button[type="submit"]').click();
  await expect(cardAnnulla.locator('.badge-annullato')).toBeVisible();
  await expect(cardAnnulla.getByRole('button', { name: /Annulla segnalazione|Risolto da me/i })).toHaveCount(0);

  await inviaGenerico(page, markerRisolto);
  const cardRisolto = cardGuasto(page, markerRisolto);
  await cardRisolto.getByRole('button', { name: /Risolto da me/i }).click();
  await page.locator('#risolvi-modal.show').waitFor({ state: 'visible' });
  await ricordaId('#risolvi-guasto-id');
  await page.locator('#risolvi-guasto-form button[type="submit"]').click();
  await expect(page.locator('#risolvi-note')).toHaveJSProperty('validity.valid', false);
  await expect(page.locator('#risolvi-modal.show')).toBeVisible();
  await page.locator('#risolvi-note').fill('Chiuso in campo durante la prova');
  await page.locator('#risolvi-costo').fill('12.5');
  await page.locator('#risolvi-guasto-form button[type="submit"]').click();
  await expect(cardRisolto.locator('.badge-risolto')).toBeVisible();
  await expect(cardRisolto.getByRole('button', { name: /Risolto da me|Annulla segnalazione/i })).toHaveCount(0);

  const tenant = await tenantId(page);
  const ripristini = [];
  try {
  await page.locator('#tipo-macchina').check();
  await page.locator('#sezione-macchina').waitFor({ state: 'visible' });
  const liberi = await mezziLiberi(page);
  let entrambi = null;
  const elenco = tenant ? await guastiDelTenant(tenant) : null;
  const elencoOk = Array.isArray(elenco) && elenco.some((g) => (g.dettagli || '').indexOf(String(stamp)) >= 0);
  if (tenant && !elencoOk) {
    console.log('[guasti-annulla] elenco guasti non leggibile: salto il ripristino dei mezzi');
  }

  async function primoRipristinabile(ids) {
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      const stato = await statoMacchina(tenant, id);
      if (stato !== 'disponibile' && stato !== 'in_uso') continue;
      if (elencoOk && !mezzoSenzaAltroGuasto(elenco, id)) {
        console.log(`[guasti-annulla] ${id} ha già un guasto attivo: non lo uso per il ripristino`);
        continue;
      }
      return { id, stato };
    }
    return null;
  }

  const trattoreLibero = elencoOk ? await primoRipristinabile(liberi.trattori) : null;
  if (trattoreLibero) {
    ripristini.push({ id: trattoreLibero.id, prima: trattoreLibero.stato });
    await page.locator('#guasto-macchina').selectOption(trattoreLibero.id);
    await page.locator('#guasto-attrezzo').selectOption('');
    await page.locator('#guasto-componente').selectOption('trattore');
    await page.locator('#gravita-non-grave').check();
    await page.locator('#guasto-dettagli').fill(markerMacchina);
    await page.locator('#segnala-guasto-form button[type="submit"]').click();
    await cardGuasto(page, markerMacchina).waitFor({ state: 'visible', timeout: 90_000 });
    await attendiStato(tenant, trattoreLibero.id, 'guasto-lavoro-in-corso');
    const cardMacchina = cardGuasto(page, markerMacchina);
    await cardMacchina.getByRole('button', { name: /Annulla segnalazione/i }).click();
    await page.locator('#annulla-modal.show').waitFor({ state: 'visible' });
    await ricordaId('#annulla-guasto-id');
    await page.locator('#annulla-guasto-form button[type="submit"]').click();
    await expect(cardMacchina.locator('.badge-annullato')).toBeVisible();
    await attendiStato(tenant, trattoreLibero.id, trattoreLibero.stato);
  } else if (elencoOk) {
    console.log('[guasti-annulla] nessun trattore senza altri guasti: salto il ripristino della macchina');
  }

  const dopoMacchina = await mezziLiberi(page);
  const trattoreEntrambi = elencoOk ? await primoRipristinabile(dopoMacchina.trattori) : null;
  const attrezzoEntrambi = elencoOk ? await primoRipristinabile(dopoMacchina.attrezzi) : null;
  if (trattoreEntrambi && attrezzoEntrambi) {
    ripristini.push(
      { id: trattoreEntrambi.id, prima: trattoreEntrambi.stato },
      { id: attrezzoEntrambi.id, prima: attrezzoEntrambi.stato }
    );
    entrambi = {
      trattoreId: trattoreEntrambi.id,
      attrezzoId: attrezzoEntrambi.id,
      trattorePrima: trattoreEntrambi.stato,
      attrezzoPrima: attrezzoEntrambi.stato,
    };
    await page.locator('#guasto-macchina').selectOption(trattoreEntrambi.id);
    await page.locator('#guasto-attrezzo').selectOption(attrezzoEntrambi.id);
    await page.locator('#guasto-componente').selectOption('entrambi');
    await page.locator('#gravita-non-grave').check();
    await page.locator('#guasto-dettagli').fill(markerEntrambi);
    await page.locator('#segnala-guasto-form button[type="submit"]').click();
    await cardGuasto(page, markerEntrambi).waitFor({ state: 'visible', timeout: 90_000 });
    await attendiStato(tenant, trattoreEntrambi.id, 'guasto-lavoro-in-corso');
    await attendiStato(tenant, attrezzoEntrambi.id, 'guasto-lavoro-in-corso');
  } else if (elencoOk) {
    console.log('[guasti-annulla] niente coppia senza altri guasti: salto Segna risolto su Entrambi');
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
    await ricordaId('#risolvi-guasto-id');
    await page.locator('#risolvi-note').fill('Chiuso dalla lista in prova');
    await page.locator('#form-risolvi button[type="submit"]').click();
    await page.waitForFunction(() => {
      const toasts = document.querySelectorAll('#gfv-standalone-toast-layer .alert, #alert-container .alert-success');
      return Array.from(toasts).some((t) => /Guasto segnato come risolto/i.test(t.textContent || ''));
    }, { timeout: 60_000 });
    await attendiStato(tenant, entrambi.trattoreId, entrambi.trattorePrima);
    await attendiStato(tenant, entrambi.attrezzoId, entrambi.attrezzoPrima);
  }
  } finally {
    if (tenant) {
      for (let i = 0; i < ripristini.length; i += 1) {
        const item = ripristini[i];
        const attuale = await statoMacchina(tenant, item.id);
        if (attuale && attuale !== item.prima) {
          await scriviStatoMacchina(tenant, item.id, item.prima);
        }
      }
      const daCancellare = idsGuasto.slice();
      const rimasti = await guastiDelTenant(tenant);
      if (Array.isArray(rimasti)) {
        rimasti.forEach((g) => {
          if ((g.dettagli || '').indexOf(String(stamp)) >= 0 && daCancellare.indexOf(g.id) < 0) {
            daCancellare.push(g.id);
          }
        });
      }
      await cancellaGuasti(tenant, daCancellare);
    }
  }
}

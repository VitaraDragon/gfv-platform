/**
 * Il riepilogo del giorno cambia subito quando si elimina una riga, anche se la rilettura è lenta.
 * Fascia 03:40–04:10: non tocca il seed 07:30–12:00 né 025–031 (05:00, 06:00, 22:00–23:45).
 * Seed solo di questo scenario.
 * @module tests/e2e/tony/scenarios/flow-segna-ore-032
 */

import { initEmulatorAdmin } from '../../../../simulator/lib/emulator-context.js';
import { addTenantDocument } from '../../../../simulator/lib/firestore-write.js';
import {
  bootstrapTonyWidgetOnStandalonePage,
  captureTonyTenantSnapshot,
  gotoTonyE2ePage,
  runTonySimLogin,
} from '../helpers/tony-sim-context.js';
import { leggiTenantIdSegnatura } from '../helpers/segna-ore-lavori-e2e.mjs';

const START = '/core/segnatura-ore-standalone.html?emulator=1&tonyE2e=1';
const MARKER = 'T-FLOW-032';
const FASCIA = '03:40';

async function pulisci(tenantId) {
  if (!tenantId) return;
  const { db } = initEmulatorAdmin();
  const snap = await db.collection(`tenants/${tenantId}/lavori`)
    .where('gfvTonyE2eMarker', '==', MARKER)
    .get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function semina(tenantId) {
  const { db } = initEmulatorAdmin();
  await pulisci(tenantId);
  const esistenti = await db.collection(`tenants/${tenantId}/lavori`).limit(40).get();
  const sample = esistenti.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((d) => d.caposquadraId && !d.operaioId && d.gfvTonyE2eMarker !== MARKER);
  if (!sample) throw new Error('T-FLOW-032: nessun lavoro del caposquadra');
  const nome = 'Controllo siepe e2e032';
  const oggi = new Date();
  oggi.setHours(12, 0, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  const dataInizio = `${oggi.getFullYear()}-${p(oggi.getMonth() + 1)}-${p(oggi.getDate())}`;
  const attivoId = await addTenantDocument(db, tenantId, 'lavori', {
    caposquadraId: sample.caposquadraId,
    terrenoId: sample.terrenoId || null,
    gfvTonyE2eMarker: MARKER,
    tipoLavoro: 'Manutenzione',
    nome,
    stato: 'assegnato',
    dataInizio,
  });
  return { attivoId, nome };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {object} scenario
 */
export async function runFlowSegnaOre032(page, expect, scenario) {
  let tenantId = '';
  try {
    await runTonySimLogin(page, scenario.login || 'loginAsCapoFromDevPage', { waitForWorkspace: false });
    await captureTonyTenantSnapshot(page);
    await gotoTonyE2ePage(page, START);
    await bootstrapTonyWidgetOnStandalonePage(page);
    tenantId = await leggiTenantIdSegnatura(page);
    expect(tenantId).toBeTruthy();
    const seminati = await semina(tenantId);
    await gotoTonyE2ePage(page, START);
    await bootstrapTonyWidgetOnStandalonePage(page);
    await page.waitForFunction((id) => {
      const list = typeof window.gfvSegnaturaOreLavoriPerTony === 'function'
        ? window.gfvSegnaturaOreLavoriPerTony()
        : [];
      return Array.isArray(list) && list.some((l) => String(l.id) === id);
    }, seminati.attivoId, { timeout: 60_000 });

    await page.evaluate((id) => window.openSegnaOraModal(id), seminati.attivoId);
    await page.locator('#ora-inizio').fill('03:40');
    await page.locator('#ora-fine').fill('04:10');
    await page.locator('#ora-pause').fill('0');
    await page.locator('#ora-form').evaluate((form) => form.requestSubmit());
    await expect(page.locator('#ore-giorno-pagina')).toContainText(FASCIA, { timeout: 20_000 });
    await page.waitForFunction((fascia) => {
      const el = document.getElementById('ore-giorno-pagina');
      return el
        && el.getAttribute('data-state') === 'ready'
        && String(el.textContent || '').includes(fascia);
    }, FASCIA, { timeout: 20_000 });

    await page.evaluate(() => {
      window.__gfvRitardaLetturaOreMs = 2500;
    });
    page.once('dialog', (dialog) => dialog.accept());
    const started = Date.now();
    await page.locator('#ore-container tr', { hasText: FASCIA }).locator('[data-elimina-ora]').click();
    await page.waitForFunction((fascia) => {
      const el = document.getElementById('ore-giorno-pagina');
      if (!el) return false;
      const testo = String(el.textContent || '');
      return !testo.includes(fascia) && el.getAttribute('data-state') === 'loading';
    }, FASCIA, { timeout: 1000 });
    expect(Date.now() - started).toBeLessThan(1000);

    await page.waitForFunction((fascia) => {
      const el = document.getElementById('ore-giorno-pagina');
      return el
        && el.getAttribute('data-state') === 'ready'
        && !String(el.textContent || '').includes(fascia);
    }, FASCIA, { timeout: 15_000 });
  } finally {
    await pulisci(tenantId).catch(() => {});
  }
}

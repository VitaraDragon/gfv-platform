#!/usr/bin/env node
/**
 * Canary emulator: due scarichi concorrenti non perdono un delta di giacenza.
 * Richiede: npm run sim:emulators, npm start, seed (es. solo-titolare-viticola).
 *
 *   node scripts/magazzino-giacenza-canary.mjs
 *   node scripts/magazzino-giacenza-canary.mjs --tenant=sim_az_agr_ricci_208883
 */
import { chromium } from 'playwright-core';
import { assertSimulatorSafeToRun } from '../simulator/lib/guard-production.js';
import { getEmulatorDb } from '../simulator/lib/emulator-context.js';
import { isEmulatorAvailable } from '../simulator/lib/emulator-available.js';
import { addTenantDocument, getTenantDocument } from '../simulator/lib/firestore-write.js';
import { readManifest } from '../simulator/lib/manifest.js';

const BASE = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const ARG_TENANT = (process.argv.find((a) => a.startsWith('--tenant=')) || '').split('=')[1] || '';
const MARKER = `GFV_GIACENZA_${Date.now()}`;
const START = 100;

const results = [];
function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`  PASS  ${id}: ${detail}`);
}
function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.log(`  FAIL  ${id}: ${detail}`);
}

function pickTenant() {
  const list = readManifest();
  if (ARG_TENANT) {
    const hit = list.find((e) => e.tenantId === ARG_TENANT);
    if (!hit) throw new Error(`Tenant ${ARG_TENANT} assente in simulator/manifest.json`);
    return hit;
  }
  const hit = [...list].reverse().find((e) => (e.templateId || '').includes('viticola')) || list.at(-1);
  if (!hit) throw new Error('Nessun tenant in simulator/manifest.json — npm run sim:run');
  return hit;
}

async function loginManager(page, tenantId) {
  await page.goto('/core/dev/simulator-dev-standalone.html?emulator=1');
  await page.locator('.card').first().waitFor({ state: 'visible', timeout: 45_000 });
  const emptyMsg = page.getByText('Nessuna azienda in manifest');
  if (await emptyMsg.isVisible().catch(() => false)) {
    throw new Error('Nessuna azienda in manifest — npm run sim:run');
  }
  const card = page.locator('.card').filter({ hasText: tenantId });
  if ((await card.count()) === 0) {
    throw new Error(`Card tenant ${tenantId} non in manifest`);
  }
  await card.getByRole('button', { name: /Entra come manager/i }).click();
  await page.waitForURL(/dashboard-standalone\.html/, { timeout: 60_000 });
}

async function openMovimenti(page) {
  await page.goto('/modules/magazzino/views/movimenti-standalone.html?emulator=1');
  await page.locator('h1').filter({ hasText: 'Movimenti Magazzino' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => window.__firebaseReady === true, { timeout: 30_000 });
}

async function parallelCreateUscite(page, prodottoId, qtyList) {
  return page.evaluate(async ({ prodottoId: pid, qtyList: qtys, note }) => {
    const { createMovimento } = await import('../services/movimenti-service.js');
    const ids = await Promise.all(
      qtys.map((q) =>
        createMovimento({
          prodottoId: pid,
          tipo: 'uscita',
          quantita: q,
          data: new Date(),
          note,
        })
      )
    );
    return ids;
  }, { prodottoId, qtyList, note: MARKER });
}

async function parallelRenameAndUscita(page, prodottoId, newName, qty) {
  return page.evaluate(async ({ prodottoId: pid, newName: nome, qty: q, note }) => {
    const { updateProdotto } = await import('../services/prodotti-service.js');
    const { createMovimento } = await import('../services/movimenti-service.js');
    const [movId] = await Promise.all([
      createMovimento({
        prodottoId: pid,
        tipo: 'uscita',
        quantita: q,
        data: new Date(),
        note,
      }),
      updateProdotto(pid, { nome }),
    ]);
    return movId;
  }, { prodottoId, newName, qty, note: `${MARKER}_ANAG` });
}

async function parallelPageIncrements(page, tenantId, prodottoId, deltas) {
  return page.evaluate(async ({ tenantId: tid, prodottoId: pid, deltas: ds }) => {
    const { increment, updateDoc, doc, getDb } = await import('../../../core/services/firebase-service.js');
    const db = getDb();
    const ref = doc(db, 'tenants', tid, 'prodotti', pid);
    await Promise.all(
      ds.map((n) => updateDoc(ref, { giacenza: increment(n) }))
    );
  }, { tenantId, prodottoId, deltas });
}

async function main() {
  assertSimulatorSafeToRun();
  if (!(await isEmulatorAvailable())) {
    console.error('Emulator Firestore non raggiungibile');
    process.exit(1);
  }

  const entry = pickTenant();
  const tenantId = entry.tenantId;
  const db = getEmulatorDb();
  console.log(`[magazzino-giacenza-canary] tenant=${tenantId} base=${BASE}`);

  const prodottoId = await addTenantDocument(db, tenantId, 'prodotti', {
    codice: MARKER,
    nome: `${MARKER} Urea`,
    categoria: 'fertilizzanti',
    unitaMisura: 'kg',
    scortaMinima: 0,
    giacenza: START,
    dosaggioMin: 1,
    dosaggioMax: 2,
    attivo: true,
  });
  pass('seed:prodotto', `${prodottoId} giacenza=${START}`);

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.GFV_E2E_BROWSER_CHANNEL || 'chrome',
  });
  const context = await browser.newContext({ baseURL: BASE });
  await context.addInitScript(() => {
    try { localStorage.setItem('gfv_firebase_emulator', '1'); } catch (_) {}
  });
  const page = await context.newPage();

  const movimentoIds = [];
  try {
    await loginManager(page, tenantId);
    pass('login:manager', page.url());

    await openMovimenti(page);
    pass('ui:movimenti', 'pagina pronta');

    const ids = await parallelCreateUscite(page, prodottoId, [7, 5]);
    movimentoIds.push(...ids);
    const afterPair = await getTenantDocument(db, tenantId, 'prodotti', prodottoId);
    const g1 = Number(afterPair?.giacenza);
    if (g1 === START - 7 - 5) {
      pass('race:createMovimento', `giacenza ${START}→${g1} (7+5, ids=${ids.join(',')})`);
    } else {
      fail('race:createMovimento', `atteso ${START - 12}, letto ${g1}`);
    }

    const renamed = `${MARKER} Urea rinom`;
    const extraId = await parallelRenameAndUscita(page, prodottoId, renamed, 3);
    movimentoIds.push(extraId);
    const afterAnag = await getTenantDocument(db, tenantId, 'prodotti', prodottoId);
    const g2 = Number(afterAnag?.giacenza);
    if (g2 === START - 7 - 5 - 3 && afterAnag?.nome === renamed) {
      pass('race:anagrafica', `giacenza ${g2} e nome="${afterAnag.nome}"`);
    } else {
      fail('race:anagrafica', `giacenza=${g2} nome=${afterAnag?.nome}`);
    }

    await parallelPageIncrements(page, tenantId, prodottoId, [-4, -6]);
    const afterPage = await getTenantDocument(db, tenantId, 'prodotti', prodottoId);
    const g3 = Number(afterPage?.giacenza);
    if (g3 === START - 7 - 5 - 3 - 4 - 6) {
      pass('race:pageIncrement', `giacenza ${g3} (UI increment −4 e −6)`);
    } else {
      fail('race:pageIncrement', `atteso ${START - 25}, letto ${g3}`);
    }
  } finally {
    await browser.close();
    for (const id of movimentoIds) {
      try {
        await db.doc(`tenants/${tenantId}/movimentiMagazzino/${id}`).delete();
      } catch (_) { /* ignore */ }
    }
    try {
      await db.doc(`tenants/${tenantId}/prodotti/${prodottoId}`).delete();
    } catch (_) { /* ignore */ }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n[magazzino-giacenza-canary] ${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

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
import { getEmulatorDb, getEmulatorAuth } from '../simulator/lib/emulator-context.js';
import { isEmulatorAvailable } from '../simulator/lib/emulator-available.js';
import { addTenantDocument, getTenantDocument } from '../simulator/lib/firestore-write.js';

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

const PASSWORD = 'SimGFV2026!';

async function pickLiveTenant(db) {
  if (ARG_TENANT) {
    const snap = await db.doc(`tenants/${ARG_TENANT}`).get();
    if (!snap.exists) throw new Error(`Tenant ${ARG_TENANT} assente sull'emulator`);
    const users = await db.collection('users').where('tenantId', '==', ARG_TENANT).get();
    const admin = users.docs.find((d) => {
      const ruoli = d.data().ruoli || [];
      return ruoli.some((r) => /manager|amministratore/i.test(String(r)));
    });
    if (!admin) throw new Error(`Nessun manager/admin per ${ARG_TENANT}`);
    return { tenantId: ARG_TENANT, userId: admin.id, email: admin.data().email };
  }
  const tenants = await db.collection('tenants').get();
  if (tenants.empty) throw new Error('Nessun tenant sull\'emulator — npm run sim:run');
  const preferred = tenants.docs.find((d) => (d.data().modules || []).includes('magazzino')) || tenants.docs[0];
  const users = await db.collection('users').where('tenantId', '==', preferred.id).get();
  const admin = users.docs.find((d) => {
    const ruoli = d.data().ruoli || [];
    return ruoli.some((r) => /manager|amministratore/i.test(String(r)));
  });
  if (!admin) throw new Error(`Nessun manager/admin per ${preferred.id}`);
  return { tenantId: preferred.id, userId: admin.id, email: admin.data().email };
}

async function ensureAuthUser(entry) {
  const auth = getEmulatorAuth();
  try {
    await auth.getUser(entry.userId);
    await auth.updateUser(entry.userId, { password: PASSWORD, email: entry.email });
    return;
  } catch (_) { /* create below */ }
  try {
    const byEmail = await auth.getUserByEmail(entry.email);
    if (byEmail.uid !== entry.userId) {
      await auth.deleteUser(byEmail.uid);
    } else {
      await auth.updateUser(byEmail.uid, { password: PASSWORD });
      return;
    }
  } catch (_) { /* create */ }
  await auth.createUser({
    uid: entry.userId,
    email: entry.email,
    password: PASSWORD,
    displayName: entry.email,
    emailVerified: true,
  });
}

async function loginAndTenant(page, entry) {
  await ensureAuthUser(entry);
  await page.goto('/core/auth/login-standalone.html?emulator=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__firebaseReady === true, null, { timeout: 45_000 });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 45_000 });
  await page.locator('#email').fill(entry.email);
  await page.locator('#password').fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/dashboard-standalone\.html/, { timeout: 60_000, waitUntil: 'domcontentloaded' }),
    page.locator('#login-form').evaluate((form) => form.requestSubmit()),
  ]);
  return entry.tenantId;
}

async function openMovimenti(page) {
  await page.goto('/modules/magazzino/views/movimenti-standalone.html?emulator=1', {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('h1').filter({ hasText: 'Movimenti Magazzino' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const btn = document.getElementById('btn-nuovo-movimento');
    return window.__firebaseReady === true
      && btn
      && typeof btn.onclick === 'function'
      && !!sessionStorage.getItem('gfv_current_tenant_id');
  }, null, { timeout: 60_000 });
}

async function parallelCreateUscite(page, prodottoId, qtyList) {
  return page.evaluate(async ({ prodottoId: pid, qtyList: qtys, note }) => {
    const { createMovimento } = await import('/modules/magazzino/services/movimenti-service.js');
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
    const { updateProdotto } = await import('/modules/magazzino/services/prodotti-service.js');
    const { createMovimento } = await import('/modules/magazzino/services/movimenti-service.js');
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
    const { increment, updateDoc, doc, getDb } = await import('/core/services/firebase-service.js');
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

  const db = getEmulatorDb();
  const entry = await pickLiveTenant(db);
  console.log(`[magazzino-giacenza-canary] tenant=${entry.tenantId} email=${entry.email} base=${BASE}`);

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.GFV_E2E_BROWSER_CHANNEL || 'chrome',
  });
  const context = await browser.newContext({ baseURL: BASE });
  await context.addInitScript(() => {
    try { localStorage.setItem('gfv_firebase_emulator', '1'); } catch (_) {}
  });

  const movimentoIds = [];
  let tenantId = ARG_TENANT;
  let prodottoId = null;
  try {
    const page = await context.newPage();
    tenantId = await loginAndTenant(page, entry);
    pass('login:manager', `${tenantId} ${page.url()}`);

    prodottoId = await addTenantDocument(db, tenantId, 'prodotti', {
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
      if (prodottoId && tenantId) {
        await db.doc(`tenants/${tenantId}/prodotti/${prodottoId}`).delete();
      }
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

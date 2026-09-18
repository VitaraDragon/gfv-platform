#!/usr/bin/env node
/**
 * Canary emulator: numeri preventivo distinti in parallelo; seconda accettazione concorrente fallisce.
 * Richiede: npm run sim:emulators, npm start, seed (es. viticola-conto-terzi).
 *
 *   node scripts/preventivi-lock-canary.mjs
 *   node scripts/preventivi-lock-canary.mjs --tenant=sim_az_agr_ricci_208883
 */
import { chromium } from 'playwright-core';
import { assertSimulatorSafeToRun } from '../simulator/lib/guard-production.js';
import { getEmulatorDb, getEmulatorAuth } from '../simulator/lib/emulator-context.js';
import { isEmulatorAvailable } from '../simulator/lib/emulator-available.js';
import { addTenantDocument, getTenantDocument, getRootDocument } from '../simulator/lib/firestore-write.js';

const BASE = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const ARG_TENANT = (process.argv.find((a) => a.startsWith('--tenant=')) || '').split('=')[1] || '';
const MARKER = `GFV_PREV_LOCK_${Date.now()}`;
const YEAR = new Date().getFullYear();

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
  const preferred = tenants.docs.find((d) => (d.data().modules || []).includes('conto-terzi'))
    || tenants.docs[0];
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

async function openPreventivi(page) {
  await page.goto('/modules/conto-terzi/views/preventivi-standalone.html?emulator=1', {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('h1').filter({ hasText: 'Preventivi' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    return window.__firebaseReady === true
      && !!sessionStorage.getItem('gfv_current_tenant_id');
  }, null, { timeout: 60_000 });
}

function scadenzaFutura() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

async function seedPreventivo(db, tenantId, stato) {
  return addTenantDocument(db, tenantId, 'preventivi', {
    numero: `${MARKER}-${stato}-${Math.random().toString(36).slice(2, 8)}`,
    clienteId: MARKER,
    tipoLavoro: 'Erpicatura',
    coltura: 'vite',
    tipoCampo: 'pianura',
    superficie: 1,
    stato,
    totale: 10,
    iva: 22,
    tokenAccettazione: `${MARKER}_${Math.random().toString(36).slice(2, 10)}`,
    dataScadenza: scadenzaFutura(),
    note: MARKER,
  });
}

async function main() {
  assertSimulatorSafeToRun();
  if (!(await isEmulatorAvailable())) {
    console.error('Emulator Firestore non raggiungibile');
    process.exit(1);
  }

  const db = getEmulatorDb();
  const entry = await pickLiveTenant(db);
  console.log(`[preventivi-lock-canary] tenant=${entry.tenantId} email=${entry.email} base=${BASE}`);

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.GFV_E2E_BROWSER_CHANNEL || 'chrome',
  });
  const context = await browser.newContext({ baseURL: BASE });
  await context.addInitScript(() => {
    try { localStorage.setItem('gfv_firebase_emulator', '1'); } catch (_) {}
  });

  const createdIds = [];
  let tenantId = ARG_TENANT;
  try {
    const page = await context.newPage();
    tenantId = await loginAndTenant(page, entry);
    pass('login:manager', `${tenantId} ${page.url()}`);

    await openPreventivi(page);
    pass('ui:preventivi', 'pagina pronta');

    const numeri = await page.evaluate(async () => {
      const { allocatePreventivoNumero } = await import('/modules/conto-terzi/services/preventivi-service.js');
      return Promise.all([
        allocatePreventivoNumero(),
        allocatePreventivoNumero(),
      ]);
    });
    const unique = new Set(numeri);
    if (unique.size === 2 && [...unique].every((n) => new RegExp(`^PREV-${YEAR}-\\d+$`).test(n))) {
      pass('race:allocate', `numeri ${numeri.join(', ')}`);
    } else {
      fail('race:allocate', `attesi 2 PREV-${YEAR}-NNN distinti, letti ${JSON.stringify(numeri)}`);
    }

    const ids = await page.evaluate(async ({ marker }) => {
      const { createPreventivo } = await import('/modules/conto-terzi/services/preventivi-service.js');
      return Promise.all([
        createPreventivo({
          clienteId: marker,
          tipoLavoro: 'Erpicatura',
          coltura: 'vite',
          tipoCampo: 'pianura',
          superficie: 1,
          totale: 10,
          note: marker,
        }, false),
        createPreventivo({
          clienteId: marker,
          tipoLavoro: 'Erpicatura',
          coltura: 'vite',
          tipoCampo: 'pianura',
          superficie: 1,
          totale: 11,
          note: marker,
        }, false),
      ]);
    }, { marker: MARKER });
    createdIds.push(...ids);
    const docs = await Promise.all(ids.map((id) => getTenantDocument(db, tenantId, 'preventivi', id)));
    const createdNumeri = docs.map((d) => d && d.numero);
    if (new Set(createdNumeri).size === 2 && createdNumeri.every((n) => n && n.startsWith(`PREV-${YEAR}-`))) {
      pass('race:createPreventivo', `id=${ids.join(',')} numeri=${createdNumeri.join(', ')}`);
    } else {
      fail('race:createPreventivo', `numeri ${JSON.stringify(createdNumeri)}`);
    }

    const raceId = await seedPreventivo(db, tenantId, 'inviato');
    createdIds.push(raceId);
    const acceptOutcomes = await page.evaluate(async ({ preventivoId }) => {
      const { accettaPreventivo } = await import('/modules/conto-terzi/services/preventivi-service.js');
      const settled = await Promise.allSettled([
        accettaPreventivo(preventivoId, 'manager'),
        accettaPreventivo(preventivoId, 'email'),
      ]);
      return settled.map((s) => ({
        status: s.status,
        stato: s.status === 'fulfilled' ? (s.value && s.value.preventivo && s.value.preventivo.stato) : null,
        reason: s.status === 'rejected' ? String(s.reason && s.reason.message || s.reason) : null,
      }));
    }, { preventivoId: raceId });
    const afterAccept = await getTenantDocument(db, tenantId, 'preventivi', raceId);
    const fulfilled = acceptOutcomes.filter((o) => o.status === 'fulfilled');
    const rejected = acceptOutcomes.filter((o) => o.status === 'rejected');
    const statoOk = afterAccept && ['accettato_manager', 'accettato_email'].includes(afterAccept.stato);
    if (fulfilled.length === 1 && rejected.length === 1 && statoOk) {
      pass('race:accetta', `stato=${afterAccept.stato} fail=${rejected[0].reason}`);
    } else {
      fail('race:accetta', `outcomes=${JSON.stringify(acceptOutcomes)} stato=${afterAccept && afterAccept.stato}`);
    }

    const emailId = await seedPreventivo(db, tenantId, 'inviato');
    const managerId = await seedPreventivo(db, tenantId, 'inviato');
    createdIds.push(emailId, managerId);
    await page.evaluate(async ({ emailId: eId, managerId: mId }) => {
      const { accettaPreventivo, rifiutaPreventivo } = await import('/modules/conto-terzi/services/preventivi-service.js');
      await Promise.all([
        accettaPreventivo(mId, 'manager'),
        rifiutaPreventivo(eId),
      ]);
    }, { emailId, managerId });
    const afterManager = await getTenantDocument(db, tenantId, 'preventivi', managerId);
    const afterRifiuta = await getTenantDocument(db, tenantId, 'preventivi', emailId);
    if (afterManager && afterManager.stato === 'accettato_manager' && afterRifiuta && afterRifiuta.stato === 'rifiutato') {
      pass('tx:accettaRifiuta', `manager=${afterManager.stato} altro=${afterRifiuta.stato}`);
    } else {
      fail('tx:accettaRifiuta', `manager=${afterManager && afterManager.stato} altro=${afterRifiuta && afterRifiuta.stato}`);
    }

    const tenantDoc = await getRootDocument(db, 'tenants', tenantId);
    const seq = tenantDoc && tenantDoc.preventivoSeqByYear && tenantDoc.preventivoSeqByYear[String(YEAR)];
    if (Number(seq) >= 2) {
      pass('tenant:seq', `preventivoSeqByYear.${YEAR}=${seq}`);
    } else {
      fail('tenant:seq', `seq=${seq}`);
    }
  } finally {
    await browser.close();
    for (const id of createdIds) {
      try {
        await db.doc(`tenants/${tenantId}/preventivi/${id}`).delete();
      } catch (_) { /* ignore */ }
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n[preventivi-lock-canary] ${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

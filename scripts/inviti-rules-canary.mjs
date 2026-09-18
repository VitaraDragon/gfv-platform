#!/usr/bin/env node
/**
 * Canary emulator: /inviti non è più list/get pubblico; manager vede solo il proprio tenant;
 * getInvitoPubblico (Admin) restituisce l'invito sanitizzato.
 *
 * Richiede: npm run sim:emulators, npm start, seed (es. solo-titolare-viticola).
 * Ricarica firestore.rules sull'emulator in esecuzione.
 *
 *   node scripts/inviti-rules-canary.mjs
 *   node scripts/inviti-rules-canary.mjs --tenant=sim_az_agr_ricci_208883
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import { assertSimulatorSafeToRun } from '../simulator/lib/guard-production.js';
import { getEmulatorDb, getEmulatorAuth } from '../simulator/lib/emulator-context.js';
import { isEmulatorAvailable } from '../simulator/lib/emulator-available.js';

const require = createRequire(import.meta.url);
const { handleGetInvitoPubblico } = require('../functions/invito-pubblico.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const BASE = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const ARG_TENANT = (process.argv.find((a) => a.startsWith('--tenant=')) || '').split('=')[1] || '';
const MARKER = `GFV_INVITI_${Date.now()}`;
const PROJECT = 'gfv-platform';
const API_KEY = 'AIzaSyBOqH6Oax3_JRQhMaU8Fp36wxgYo3s_pw0';
const FIRESTORE = 'http://127.0.0.1:8080';
const AUTH = 'http://127.0.0.1:9099';
const PASSWORD = 'SimGFV2026!';

const results = [];
function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`  PASS  ${id}: ${detail}`);
}
function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.log(`  FAIL  ${id}: ${detail}`);
}

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
  const preferred = tenants.docs[0];
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

async function reloadEmulatorRules() {
  const content = readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const url = `${FIRESTORE}/emulator/v1/projects/${PROJECT}:securityRules`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ignore_errors: true,
      rules: { files: [{ name: 'security.rules', content }] },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Reload rules ${res.status}: ${text.slice(0, 400)}`);
  }
}

async function signInIdToken(email, password) {
  const url = `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await res.json();
  if (!body.idToken) {
    throw new Error(`signIn ${email}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body.idToken;
}

function isPermissionDenied(result) {
  if (result.status === 403) return true;
  const rows = Array.isArray(result.body) ? result.body : [result.body];
  return rows.some((row) => {
    const err = row && (row.error || row);
    return err && (err.code === 403 || err.status === 'PERMISSION_DENIED');
  });
}

function queryDocuments(result) {
  const rows = Array.isArray(result.body) ? result.body : [];
  return rows.filter((row) => row && row.document).map((row) => row.document);
}

async function firestoreRunQuery(idToken, structuredQuery) {
  const url = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ structuredQuery }),
  });
  let body;
  try {
    body = await res.json();
  } catch (_) {
    body = { parseError: true };
  }
  return { status: res.status, body };
}

async function firestoreGetDoc(idToken, docPath) {
  const url = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(url, { headers });
  let body;
  try {
    body = await res.json();
  } catch (_) {
    body = { parseError: true };
  }
  return { status: res.status, body };
}

function fieldEq(fieldPath, stringValue) {
  return {
    fieldFilter: {
      field: { fieldPath },
      op: 'EQUAL',
      value: { stringValue },
    },
  };
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

async function ensureOperaio(db, tenantId) {
  const users = await db.collection('users').where('tenantId', '==', tenantId).get();
  const found = users.docs.find((d) => {
    const ruoli = d.data().ruoli || [];
    const isField = ruoli.some((r) => /operaio|caposquadra/i.test(String(r)));
    const isMgr = ruoli.some((r) => /manager|amministratore/i.test(String(r)));
    return isField && !isMgr && d.data().email;
  });
  if (found) {
    return { userId: found.id, email: found.data().email, created: false };
  }
  const email = `canary.operaio.${MARKER.toLowerCase()}@gfv-sim.local`;
  const auth = getEmulatorAuth();
  const user = await auth.createUser({
    email,
    password: PASSWORD,
    emailVerified: true,
  });
  await db.doc(`users/${user.uid}`).set({
    email,
    nome: 'Canary',
    cognome: 'Operaio',
    ruoli: ['operaio'],
    tenantId,
    tenantMemberships: {
      [tenantId]: { ruoli: ['operaio'], stato: 'attivo', tenantIdPredefinito: true },
    },
    stato: 'attivo',
  });
  return { userId: user.uid, email, created: true };
}

async function main() {
  assertSimulatorSafeToRun();
  if (!(await isEmulatorAvailable())) {
    console.error('Emulator Firestore non raggiungibile');
    process.exit(1);
  }

  await reloadEmulatorRules();

  const db = getEmulatorDb();
  const entry = await pickLiveTenant(db);
  console.log(`[inviti-rules-canary] tenant=${entry.tenantId} email=${entry.email} base=${BASE}`);

  const token = `${MARKER}-tok-${Math.random().toString(36).slice(2, 12)}`;
  const inviteEmail = `canary.invite.${MARKER.toLowerCase()}@gfv-sim.local`;
  const otherToken = `${MARKER}-other-${Math.random().toString(36).slice(2, 12)}`;
  const scadeIl = new Date();
  scadeIl.setDate(scadeIl.getDate() + 7);

  const inviteRef = await db.collection('inviti').add({
    email: inviteEmail,
    nome: 'Canary',
    cognome: 'Invitato',
    ruoli: ['operaio'],
    tenantId: entry.tenantId,
    token,
    stato: 'invitato',
    inviatoDa: entry.userId,
    inviatoIl: new Date(),
    scadeIl,
    accettatoIl: null,
    isExistingUser: false,
    leakField: 'NON_LEAK',
  });
  const otherRef = await db.collection('inviti').add({
    email: `other.${MARKER.toLowerCase()}@gfv-sim.local`,
    nome: 'Altro',
    cognome: 'Tenant',
    ruoli: ['operaio'],
    tenantId: `other_${MARKER}`,
    token: otherToken,
    stato: 'invitato',
    inviatoDa: 'other-manager',
    scadeIl,
  });
  const createdUserIds = [];

  try {
    const unauthList = await firestoreRunQuery(null, {
      from: [{ collectionId: 'inviti' }],
    });
    if (isPermissionDenied(unauthList)) {
      pass('rules:unauthList', `status=${unauthList.status}`);
    } else {
      fail('rules:unauthList', `atteso PERMISSION_DENIED, got ${JSON.stringify(unauthList).slice(0, 240)}`);
    }

    const unauthToken = await firestoreRunQuery(null, {
      from: [{ collectionId: 'inviti' }],
      where: fieldEq('token', token),
    });
    if (isPermissionDenied(unauthToken)) {
      pass('rules:unauthTokenQuery', `status=${unauthToken.status}`);
    } else {
      fail('rules:unauthTokenQuery', `atteso DENIED, got ${JSON.stringify(unauthToken).slice(0, 240)}`);
    }

    const unauthGet = await firestoreGetDoc(null, `inviti/${inviteRef.id}`);
    if (unauthGet.status === 403 || isPermissionDenied(unauthGet)) {
      pass('rules:unauthGet', `status=${unauthGet.status}`);
    } else {
      fail('rules:unauthGet', `atteso 403, got ${unauthGet.status} ${JSON.stringify(unauthGet.body).slice(0, 160)}`);
    }

    await ensureAuthUser(entry);
    const managerToken = await signInIdToken(entry.email, PASSWORD);
    const managerOwn = await firestoreRunQuery(managerToken, {
      from: [{ collectionId: 'inviti' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            fieldEq('tenantId', entry.tenantId),
            fieldEq('stato', 'invitato'),
          ],
        },
      },
    });
    const ownDocs = queryDocuments(managerOwn);
    const sawOwn = ownDocs.some((d) => d.name && d.name.endsWith(`/inviti/${inviteRef.id}`));
    if (!isPermissionDenied(managerOwn) && sawOwn) {
      pass('rules:managerOwn', `docs=${ownDocs.length}`);
    } else {
      fail('rules:managerOwn', `denied=${isPermissionDenied(managerOwn)} sawOwn=${sawOwn} ${JSON.stringify(managerOwn).slice(0, 240)}`);
    }

    const managerOther = await firestoreRunQuery(managerToken, {
      from: [{ collectionId: 'inviti' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            fieldEq('tenantId', `other_${MARKER}`),
            fieldEq('stato', 'invitato'),
          ],
        },
      },
    });
    if (isPermissionDenied(managerOther) || queryDocuments(managerOther).length === 0) {
      pass('rules:managerOtherTenant', isPermissionDenied(managerOther) ? 'DENIED' : 'empty');
    } else {
      fail('rules:managerOtherTenant', `vide inviti di altro tenant: ${queryDocuments(managerOther).length}`);
    }

    const operaio = await ensureOperaio(db, entry.tenantId);
    if (operaio.created) createdUserIds.push(operaio.userId);
    await ensureAuthUser({ userId: operaio.userId, email: operaio.email });
    const operaioToken = await signInIdToken(operaio.email, PASSWORD);
    const operaioQ = await firestoreRunQuery(operaioToken, {
      from: [{ collectionId: 'inviti' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            fieldEq('tenantId', entry.tenantId),
            fieldEq('stato', 'invitato'),
          ],
        },
      },
    });
    if (isPermissionDenied(operaioQ)) {
      pass('rules:operaioList', `status=${operaioQ.status}`);
    } else {
      fail('rules:operaioList', `atteso DENIED, got ${JSON.stringify(operaioQ).slice(0, 240)}`);
    }

    const cf = await handleGetInvitoPubblico(db, token);
    const extraLeak = cf.invito && cf.invito.leakField;
    if (cf.ok && cf.invito && cf.invito.id === inviteRef.id && cf.invito.email === inviteEmail && !extraLeak) {
      pass('cf:getInvitoPubblico', `id=${cf.invito.id}`);
    } else {
      fail('cf:getInvitoPubblico', JSON.stringify(cf).slice(0, 240));
    }

    try {
      await handleGetInvitoPubblico(db, 'short');
      fail('cf:tokenCorto', 'doveva lanciare');
    } catch (e) {
      if (e && e.code === 'invalid-argument') pass('cf:tokenCorto', e.message);
      else fail('cf:tokenCorto', String(e && e.message || e));
    }

    const browser = await chromium.launch({
      headless: true,
      channel: process.env.GFV_E2E_BROWSER_CHANNEL || 'chrome',
    });
    try {
      const context = await browser.newContext({ baseURL: BASE });
      await context.addInitScript(() => {
        try { localStorage.setItem('gfv_firebase_emulator', '1'); } catch (_) {}
      });
      const page = await context.newPage();
      await loginAndTenant(page, entry);
      await page.goto('/core/admin/gestisci-utenti-standalone.html?emulator=1', {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForFunction(() => window.__firebaseReady === true, null, { timeout: 45_000 });
      const visible = await page.getByText(inviteEmail, { exact: false }).waitFor({ timeout: 45_000 })
        .then(() => true)
        .catch(() => false);
      if (visible) pass('ui:gestisciUtenti', inviteEmail);
      else fail('ui:gestisciUtenti', `invito non visibile su gestisci-utenti (${page.url()})`);
    } finally {
      await browser.close();
    }
  } finally {
    try { await inviteRef.delete(); } catch (_) { /* ignore */ }
    try { await otherRef.delete(); } catch (_) { /* ignore */ }
    const auth = getEmulatorAuth();
    for (const uid of createdUserIds) {
      try { await db.doc(`users/${uid}`).delete(); } catch (_) { /* ignore */ }
      try { await auth.deleteUser(uid); } catch (_) { /* ignore */ }
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n[inviti-rules-canary] ${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

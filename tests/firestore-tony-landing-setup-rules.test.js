/**
 * Regole tonyLandingSetup: tutto negato su esito e contatore; due chiamate contemporanee.
 * Emulatore Firestore su porta dedicata + REST + JWT non firmati.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-gfv-tony-landing-setup';
const HOST = '127.0.0.1';
const PORT = 8215;
const HUB_PORT = 4441;

const TENANT = 'tenant-landing';
const OWNER = 'owner-landing';
const GIORNO = '2026-11-03';

let emulator;
let tmpDir;
let emulatorLog = '';
let emulatorOk = false;
let adminApp;
let adminDb;
let handleTonyLandingSetup;

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function tokenUtente(uid, email) {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    sub: uid,
    user_id: uid,
    uid,
    email: email || `${uid}@test.local`,
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    auth_time: 0,
    iat: 0,
    exp: 2000000000,
    firebase: { identities: {}, sign_in_provider: 'custom' }
  });
  return `${header}.${payload}.`;
}

function valore(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(valore) } };
  const fields = {};
  for (const [key, item] of Object.entries(value)) fields[key] = valore(item);
  return { mapValue: { fields } };
}

function docUrl(docPath) {
  return new URL(
    `http://${HOST}:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`
  );
}

async function richiesta(method, docPath, { auth = 'owner', data, mask, exists, email } = {}) {
  const url = docUrl(docPath);
  if (mask) {
    for (const key of mask) url.searchParams.append('updateMask.fieldPaths', key);
  }
  if (exists === true) url.searchParams.set('currentDocument.exists', 'true');
  if (exists === false) url.searchParams.set('currentDocument.exists', 'false');
  const headers = {
    Authorization: `Bearer ${auth === 'owner' ? 'owner' : tokenUtente(auth, email)}`
  };
  const init = { method, headers };
  if (data) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify({ fields: valore(data).mapValue.fields });
  }
  const res = await fetch(url, init);
  const body = await res.text();
  return { status: res.status, body };
}

async function attendiEmulatore() {
  const started = Date.now();
  while (Date.now() - started < 60000) {
    try {
      const res = await fetch(`http://${HOST}:${PORT}/`, { method: 'GET' });
      if (res.status < 500) return;
    } catch {
      // non pronto
    }
    if (emulator && emulator.exitCode != null) {
      throw new Error(`Emulatore uscito con ${emulator.exitCode}\n${emulatorLog}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Emulatore non pronto\n${emulatorLog}`);
}

function avviaEmulatore() {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-tony-landing-setup-rules-'));
  writeFileSync(
    path.join(tmpDir, 'firebase.json'),
    JSON.stringify({
      firestore: {
        rules: path.join(root, 'firestore.rules'),
        indexes: path.join(root, 'firestore.indexes.json')
      },
      emulators: {
        firestore: { host: HOST, port: PORT },
        hub: { port: HUB_PORT },
        ui: { enabled: false }
      }
    })
  );
  const bin = path.join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
  emulator = spawn(
    process.execPath,
    [bin, 'emulators:start', '--only', 'firestore', '--project', PROJECT],
    { cwd: tmpDir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
  );
  const onData = (chunk) => {
    emulatorLog += chunk.toString();
    if (emulatorLog.length > 20000) emulatorLog = emulatorLog.slice(-20000);
  };
  emulator.stdout.on('data', onData);
  emulator.stderr.on('data', onData);
}

function fermaEmulatore() {
  if (!emulator || emulator.exitCode != null) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    emulator.once('exit', done);
    setTimeout(done, 8000);
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(emulator.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      });
    } else {
      emulator.kill('SIGTERM');
    }
  });
}

beforeAll(async () => {
  try {
    avviaEmulatore();
    await attendiEmulatore();
    emulatorOk = true;
  } catch (err) {
    emulatorLog += `\n[beforeAll] ${err && err.message}\n`;
    emulatorOk = false;
    throw new Error(`emulatore non raggiungibile: ${err && err.message}\n${emulatorLog.slice(-2000)}`);
  }

  const seed = [
    [
      `users/${OWNER}`,
      {
        email: 'owner-landing@test.local',
        tenantId: TENANT,
        ruoli: ['amministratore'],
        stato: 'attivo',
        tenantMemberships: {
          [TENANT]: { ruoli: ['amministratore'], stato: 'attivo', tenantIdPredefinito: true }
        }
      }
    ],
    [
      `tenants/${TENANT}`,
      {
        nome: 'Azienda Landing',
        creatoDa: OWNER,
        piano: 'free',
        stato: 'attivo'
      }
    ],
    [
      `tenants/${TENANT}/poderi/podere-seed`,
      {
        nome: 'Podere Seed',
        indirizzo: null,
        note: null,
        coordinate: null
      }
    ]
  ];
  for (const [pathDoc, data] of seed) {
    const res = await richiesta('PATCH', pathDoc, { data });
    if (res.status >= 400) throw new Error(`Seed ${pathDoc}: ${res.status} ${res.body}`);
  }

  process.env.FIRESTORE_EMULATOR_HOST = `${HOST}:${PORT}`;
  const requireFromFunctions = createRequire(path.join(root, 'functions', 'package.json'));
  const admin = requireFromFunctions('firebase-admin');
  if (!admin.apps.length) {
    adminApp = admin.initializeApp({ projectId: PROJECT }, 'tony-landing-setup-test');
  } else {
    try {
      adminApp = admin.app('tony-landing-setup-test');
    } catch {
      adminApp = admin.initializeApp({ projectId: PROJECT }, 'tony-landing-setup-test');
    }
  }
  adminDb = adminApp.firestore();
  handleTonyLandingSetup = requireFromFunctions('./tony-landing-setup.js').handleTonyLandingSetup;
}, 90000);

afterAll(async () => {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  if (adminApp) {
    try {
      await adminApp.delete();
    } catch {
      // ignore
    }
  }
  await fermaEmulatore();
  if (!tmpDir) return;
  for (let i = 0; i < 5; i += 1) {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
});

function requireEmulator() {
  if (!emulatorOk) throw new Error('emulatore non pronto');
}

describe('(25) Regole tutto negato', () => {
  it('nega get/create/update/delete su esito e contatore; poderi leggibili', async () => {
    requireEmulator();
    const esito = `tenants/${TENANT}/tonyLandingSetup/esito`;
    const quota = `tonyLandingSetupQuota/${GIORNO}_${OWNER}`;
    const podere = `tenants/${TENANT}/poderi/podere-seed`;

    const getPodere = await richiesta('GET', podere, { auth: OWNER });
    expect(getPodere.status).toBe(200);

    for (const docPath of [esito, quota]) {
      const getRes = await richiesta('GET', docPath, { auth: OWNER });
      expect(getRes.status).toBe(403);

      const createRes = await richiesta('PATCH', docPath, {
        auth: OWNER,
        data: { requestId: 'x', count: 1 },
        exists: false
      });
      expect(createRes.status).toBe(403);

      await richiesta('PATCH', docPath, { data: { marker: 'owner-seed' } });
      const updateRes = await richiesta('PATCH', docPath, {
        auth: OWNER,
        data: { marker: 'hack' },
        mask: ['marker'],
        exists: true
      });
      expect(updateRes.status).toBe(403);

      const delRes = await richiesta('DELETE', docPath, { auth: OWNER });
      expect(delRes.status).toBe(403);
    }
  });
});

describe('(7) Due chiamate contemporanee', () => {
  async function preparaTenantVuoto(suffix) {
    const uid = `owner-${suffix}`;
    const tenantId = `tenant-${suffix}`;
    await richiesta('PATCH', `users/${uid}`, {
      data: {
        tenantId,
        ruoli: ['amministratore'],
        stato: 'attivo',
        tenantMemberships: {
          [tenantId]: { ruoli: ['amministratore'], stato: 'attivo', tenantIdPredefinito: true }
        }
      }
    });
    await richiesta('PATCH', `tenants/${tenantId}`, {
      data: {
        nome: 'Azienda ' + suffix,
        creatoDa: uid,
        piano: 'free',
        stato: 'attivo'
      }
    });
    return { uid, tenantId };
  }

  function payload(requestId) {
    return {
      requestId,
      sede: {
        indirizzo: 'Via Emilia Ponente 10',
        citta: 'Faenza',
        cap: '48018',
        provincia: 'RA'
      },
      poderi: [{ nome: 'Casetti' }],
      terreni: [
        { nome: 'Campo grande', superficie: 2.34, coltura: 'Grano', podere: 'Casetti' },
        { nome: 'Meleto', superficie: 1.2, coltura: 'Melo', podere: null }
      ]
    };
  }

  it('stesso requestId → una ok e una giaSalvato; 2 terreni e 1 podere', async () => {
    requireEmulator();
    const { uid, tenantId } = await preparaTenantVuoto('conc-same');
    const data = payload('req-conc-same-01');
    const request = { auth: { uid }, data };
    const adesso = () => new Date('2026-11-03T10:00:00.000Z');
    const risultati = await Promise.all([
      handleTonyLandingSetup(request, { db: adminDb, adesso }),
      handleTonyLandingSetup(request, { db: adminDb, adesso })
    ]);
    const flags = risultati.map((r) => r.giaSalvato).sort();
    expect(flags).toEqual([false, true]);
    for (const r of risultati) {
      expect(r.ok).toBe(true);
      expect(r.terreniCreati).toBe(2);
      expect(r.poderiCreati).toBe(1);
    }
    const terreni = await adminDb.collection('tenants').doc(tenantId).collection('terreni').get();
    const poderi = await adminDb.collection('tenants').doc(tenantId).collection('poderi').get();
    expect(terreni.size).toBe(2);
    expect(poderi.size).toBe(1);
  });

  it('requestId diversi → una ok e una gia-preparato; sempre 2 terreni', async () => {
    requireEmulator();
    const { uid, tenantId } = await preparaTenantVuoto('conc-diff');
    const adesso = () => new Date('2026-11-03T11:00:00.000Z');
    const a = handleTonyLandingSetup(
      { auth: { uid }, data: payload('req-conc-diff-a') },
      { db: adminDb, adesso }
    );
    const b = handleTonyLandingSetup(
      { auth: { uid }, data: payload('req-conc-diff-b') },
      { db: adminDb, adesso }
    );
    const risultati = await Promise.allSettled([a, b]);
    const ok = risultati.filter((r) => r.status === 'fulfilled');
    const fail = risultati.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    expect(ok[0].value.ok).toBe(true);
    expect(fail[0].reason.code).toBe('already-exists');
    expect(fail[0].reason.details.motivo).toBe('gia-preparato');
    const terreni = await adminDb.collection('tenants').doc(tenantId).collection('terreni').get();
    expect(terreni.size).toBe(2);
  });
});

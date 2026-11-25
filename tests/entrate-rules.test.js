/**
 * Regole Firestore della collection entrate:
 * lettura/scrittura solo manager/admin del tenant.
 *
 * Avvia un emulatore Firestore dedicato e parla con la REST API.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-gfv-entrate-rules';
const HOST = '127.0.0.1';
const PORT = 8191;
const TENANT = 'tenant-a';
const ALTRO_TENANT = 'tenant-b';

const OPERAIO = 'operaio-a';
const MANAGER = 'manager-a';
const ALTRO = 'manager-b';

let emulator;
let tmpDir;
let emulatorLog = '';

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function tokenUtente(uid) {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    sub: uid,
    user_id: uid,
    uid,
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

async function richiesta(method, docPath, { auth = 'owner', data, mask, exists } = {}) {
  const url = docUrl(docPath);
  if (mask) {
    for (const key of mask) url.searchParams.append('updateMask.fieldPaths', key);
  }
  if (exists === true) url.searchParams.set('currentDocument.exists', 'true');
  if (exists === false) url.searchParams.set('currentDocument.exists', 'false');
  const headers = {
    Authorization: `Bearer ${auth === 'owner' ? 'owner' : tokenUtente(auth)}`
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
      // non ancora pronto
    }
    if (emulator && emulator.exitCode != null) {
      throw new Error(`Emulatore uscito con ${emulator.exitCode}\n${emulatorLog}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Emulatore non pronto\n${emulatorLog}`);
}

function avviaEmulatore() {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-entrate-rules-'));
  writeFileSync(
    path.join(tmpDir, 'firebase.json'),
    JSON.stringify({
      firestore: {
        rules: path.join(root, 'firestore.rules'),
        indexes: path.join(root, 'firestore.indexes.json')
      },
      emulators: {
        firestore: { host: HOST, port: PORT },
        hub: { port: 4421 },
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

function membership(tenantId, ruolo, stato = 'attivo') {
  return {
    tenantMemberships: {
      [tenantId]: { stato, ruoli: [ruolo] }
    }
  };
}

const sample = {
  data: '2026-03-01',
  tipo: 'altro',
  descrizione: 'test',
  importo: 50,
  incassato: false
};

beforeAll(async () => {
  avviaEmulatore();
  await attendiEmulatore();

  const utenti = [
    [OPERAIO, membership(TENANT, 'operaio')],
    [MANAGER, membership(TENANT, 'manager')],
    [ALTRO, membership(ALTRO_TENANT, 'manager')]
  ];
  for (const [uid, data] of utenti) {
    const res = await richiesta('PATCH', `users/${uid}`, { data });
    if (res.status >= 400) throw new Error(`Seed utente ${uid}: ${res.status} ${res.body}`);
  }

  const seed = await richiesta('PATCH', `tenants/${TENANT}/entrate/e-seed`, { data: sample });
  if (seed.status >= 400) throw new Error(`Seed entrata: ${seed.status} ${seed.body}`);
}, 90000);

afterAll(async () => {
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
}, 20000);

describe('entrate rules', () => {
  it('operaio non legge né scrive', async () => {
    const get = await richiesta('GET', `tenants/${TENANT}/entrate/e-seed`, { auth: OPERAIO });
    expect(get.status).toBe(403);

    const create = await richiesta('PATCH', `tenants/${TENANT}/entrate/e-operaio`, {
      auth: OPERAIO,
      data: sample,
      exists: false
    });
    expect(create.status).toBe(403);
  });

  it('manager legge e scrive sul proprio tenant', async () => {
    const get = await richiesta('GET', `tenants/${TENANT}/entrate/e-seed`, { auth: MANAGER });
    expect(get.status).toBeLessThan(400);

    const create = await richiesta('PATCH', `tenants/${TENANT}/entrate/e-manager`, {
      auth: MANAGER,
      data: { ...sample, descrizione: 'ok manager' },
      exists: false
    });
    expect(create.status).toBeLessThan(400);

    const update = await richiesta('PATCH', `tenants/${TENANT}/entrate/e-manager`, {
      auth: MANAGER,
      data: { descrizione: 'aggiornata' },
      mask: ['descrizione'],
      exists: true
    });
    expect(update.status).toBeLessThan(400);
  });

  it('manager di altro tenant è negato', async () => {
    const get = await richiesta('GET', `tenants/${TENANT}/entrate/e-seed`, { auth: ALTRO });
    expect(get.status).toBe(403);

    const create = await richiesta('PATCH', `tenants/${TENANT}/entrate/e-altro`, {
      auth: ALTRO,
      data: sample,
      exists: false
    });
    expect(create.status).toBe(403);
  });
});

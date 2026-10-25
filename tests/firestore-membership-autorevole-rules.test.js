/**
 * Membership autorevole nelle rules: disattivata + tenantId deprecato → niente lettura tenant.
 * Emulatore Firestore su porta dedicata.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-gfv-membership-autorevole';
const HOST = '127.0.0.1';
const PORT = 8203;

const TENANT_A = 'tenant-a';
const ADMIN_LEGACY = 'admin-legacy';
const ADMIN_DISABLED = 'admin-disabled-mem';
const OPERAIO_MEM = 'operaio-mem';
const LEGACY_DISATTIVATO = 'legacy-disattivato';

let emulator;
let tmpDir;
let emulatorLog = '';
let emulatorOk = false;

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
    firebase: { identities: {}, sign_in_provider: 'custom' },
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
    Authorization: `Bearer ${auth === 'owner' ? 'owner' : tokenUtente(auth)}`,
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
      /* wait */
    }
    if (emulator && emulator.exitCode != null) {
      throw new Error(`Emulatore uscito con ${emulator.exitCode}\n${emulatorLog}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Emulatore non pronto\n${emulatorLog}`);
}

function avviaEmulatore() {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-mem-auth-rules-'));
  writeFileSync(
    path.join(tmpDir, 'firebase.json'),
    JSON.stringify({
      firestore: {
        rules: path.join(root, 'firestore.rules'),
        indexes: path.join(root, 'firestore.indexes.json'),
      },
      emulators: {
        firestore: { host: HOST, port: PORT },
        hub: { port: 4423 },
        ui: { enabled: false },
      },
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
        windowsHide: true,
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
    emulatorLog += String(err && err.message);
    emulatorOk = false;
    throw new Error(`emulatore non raggiungibile: ${err && err.message}\n${emulatorLog.slice(-2000)}`);
  }

  const utenti = [
    [ADMIN_LEGACY, { tenantId: TENANT_A, ruoli: ['amministratore'] }],
    [
      ADMIN_DISABLED,
      {
        tenantId: TENANT_A,
        ruoli: ['amministratore'],
        tenantMemberships: {
          [TENANT_A]: { stato: 'disattivato', ruoli: ['amministratore'] },
        },
      },
    ],
    [
      OPERAIO_MEM,
      {
        tenantMemberships: {
          [TENANT_A]: { stato: 'attivo', ruoli: ['operaio'] },
        },
      },
    ],
    [
      LEGACY_DISATTIVATO,
      {
        tenantId: TENANT_A,
        ruoli: ['operaio'],
        stato: 'disattivato',
      },
    ],
  ];
  for (const [uid, data] of utenti) {
    const res = await richiesta('PATCH', `users/${uid}`, { data });
    if (res.status >= 400) throw new Error(`Seed utente ${uid}: ${res.status} ${res.body}`);
  }
  const checkDisabled = await richiesta('GET', `users/${ADMIN_DISABLED}`, { auth: 'owner' });
  if (checkDisabled.status >= 400) {
    throw new Error(`Seed verify ${ADMIN_DISABLED}: ${checkDisabled.status} ${checkDisabled.body}`);
  }
  if (!checkDisabled.body.includes('disattivato')) {
    throw new Error(`Seed membership disattivata assente: ${checkDisabled.body.slice(0, 500)}`);
  }
  const checkLegacyOff = await richiesta('GET', `users/${LEGACY_DISATTIVATO}`, { auth: 'owner' });
  if (checkLegacyOff.status >= 400) {
    throw new Error(`Seed verify ${LEGACY_DISATTIVATO}: ${checkLegacyOff.status} ${checkLegacyOff.body}`);
  }
  if (!checkLegacyOff.body.includes('disattivato')) {
    throw new Error(`Seed legacy disattivato assente: ${checkLegacyOff.body.slice(0, 500)}`);
  }
  const terreno = await richiesta('PATCH', `tenants/${TENANT_A}/terreni/t1`, {
    data: { nome: 'Campo 1', creatoDa: ADMIN_LEGACY },
  });
  if (terreno.status >= 400) {
    throw new Error(`Seed terreno: ${terreno.status} ${terreno.body}`);
  }
}, 90000);

afterAll(async () => {
  await fermaEmulatore();
  if (tmpDir) {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe('belongsToTenant membership autorevole', () => {
  it('emulatore disponibile', () => {
    if (!emulatorOk) {
      throw new Error('emulatore non raggiungibile');
    }
    expect(emulatorOk).toBe(true);
  });

  it('membership disattivata + tenantId deprecato: non legge terreni', async () => {
    const res = await richiesta('GET', `tenants/${TENANT_A}/terreni/t1`, {
      auth: ADMIN_DISABLED,
    });
    expect(res.status).toBe(403);
  });

  it('solo deprecato: continua a leggere', async () => {
    const res = await richiesta('GET', `tenants/${TENANT_A}/terreni/t1`, {
      auth: ADMIN_LEGACY,
    });
    expect(res.status).toBeLessThan(400);
  });

  it('membership attiva: legge', async () => {
    const res = await richiesta('GET', `tenants/${TENANT_A}/terreni/t1`, {
      auth: OPERAIO_MEM,
    });
    expect(res.status).toBeLessThan(400);
  });

  it('legacy stato disattivato senza membership: terreni negato', async () => {
    const res = await richiesta('GET', `tenants/${TENANT_A}/terreni/t1`, {
      auth: LEGACY_DISATTIVATO,
    });
    expect(res.status).toBe(403);
  });
});

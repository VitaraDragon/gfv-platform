/**
 * Storage rules + membership autorevole (firestore.get su users).
 * Emulatori Firestore + Storage su porte dedicate.
 * @vitest-environment node
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-gfv-storage-membership';
const HOST = '127.0.0.1';
const FS_PORT = 8211;
const ST_PORT = 9211;
const HUB_PORT = 4431;
const BUCKET = `${PROJECT}.appspot.com`;

const TENANT = 'tenant-st';
const UID_ACTIVE_MEM = 'u-active-mem';
const UID_REMOVED_DEP = 'u-removed-dep';
const UID_INVITE_MEM = 'u-invite-mem';
const UID_LEGACY_OK = 'u-legacy-ok';
const UID_LEGACY_OFF = 'u-legacy-off';
const UID_MANAGER = 'u-manager';

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

async function seedUser(uid, data) {
  const url = new URL(
    `http://${HOST}:${FS_PORT}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`
  );
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: valore(data).mapValue.fields }),
  });
  const body = await res.text();
  if (res.status >= 400) throw new Error(`Seed user ${uid}: ${res.status} ${body}`);
}

async function storageRead(objectPath, uid) {
  const encoded = encodeURIComponent(objectPath);
  const url = `http://${HOST}:${ST_PORT}/v0/b/${BUCKET}/o/${encoded}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokenUtente(uid)}` },
  });
  return res.status;
}

async function storageUpload(objectPath, uid, bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) {
  const url =
    `http://${HOST}:${ST_PORT}/v0/b/${BUCKET}/o` +
    `?uploadType=media&name=${encodeURIComponent(objectPath)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenUtente(uid)}`,
      'Content-Type': 'image/png',
    },
    body: bytes,
  });
  return res.status;
}

async function storageUploadAsOwner(objectPath, bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) {
  const url =
    `http://${HOST}:${ST_PORT}/v0/b/${BUCKET}/o` +
    `?uploadType=media&name=${encodeURIComponent(objectPath)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'image/png',
    },
    body: bytes,
  });
  const text = await res.text();
  if (res.status >= 400) throw new Error(`Owner upload ${objectPath}: ${res.status} ${text}`);
}

async function attendiEmulatore(timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (/All emulators ready/i.test(emulatorLog)) {
      // Piccola attesa post-ready per bind completo
      await new Promise((r) => setTimeout(r, 800));
      return;
    }
    if (emulator && emulator.exitCode != null) {
      throw new Error(`Emulatore uscito con ${emulator.exitCode}\n${emulatorLog}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Emulatore non pronto\n${emulatorLog}`);
}

function avviaEmulatore() {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-storage-mem-rules-'));
  writeFileSync(
    path.join(tmpDir, 'firebase.json'),
    JSON.stringify({
      firestore: {
        rules: path.join(root, 'firestore.rules'),
        indexes: path.join(root, 'firestore.indexes.json'),
      },
      storage: { rules: path.join(root, 'storage.rules') },
      emulators: {
        firestore: { host: HOST, port: FS_PORT },
        storage: { host: HOST, port: ST_PORT },
        hub: { port: HUB_PORT },
        ui: { enabled: false },
      },
    })
  );
  const bin = path.join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
  emulator = spawn(
    process.execPath,
    [bin, 'emulators:start', '--only', 'firestore,storage', '--project', PROJECT],
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
    emulatorOk = false;
    throw new Error(`emulatore non raggiungibile: ${err && err.message}\n${emulatorLog.slice(-2000)}`);
  }

  await seedUser(UID_ACTIVE_MEM, {
    tenantMemberships: {
      [TENANT]: { stato: 'attivo', ruoli: ['operaio'] },
    },
  });
  await seedUser(UID_REMOVED_DEP, {
    tenantId: TENANT,
    ruoli: ['operaio'],
    tenantMemberships: {
      [TENANT]: { stato: 'rimosso', ruoli: ['operaio'] },
    },
  });
  await seedUser(UID_INVITE_MEM, {
    tenantMemberships: {
      [TENANT]: { stato: 'attivo', ruoli: ['operaio'] },
    },
  });
  await seedUser(UID_LEGACY_OK, {
    tenantId: TENANT,
    ruoli: ['operaio'],
    stato: 'attivo',
  });
  await seedUser(UID_LEGACY_OFF, {
    tenantId: TENANT,
    ruoli: ['operaio'],
    stato: 'disattivato',
  });
  await seedUser(UID_MANAGER, {
    tenantMemberships: {
      [TENANT]: { stato: 'attivo', ruoli: ['manager'] },
    },
  });

  const logoPath = `tenants/${TENANT}/logo_test.png`;
  await storageUploadAsOwner(logoPath);
}, 120000);

afterAll(async () => {
  await fermaEmulatore();
  if (tmpDir) {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}, 20000);

describe('storage.rules membership autorevole', () => {
  const logoPath = `tenants/${TENANT}/logo_test.png`;

  it('membership attiva → lettura ok', async () => {
    const status = await storageRead(logoPath, UID_ACTIVE_MEM);
    expect(status).toBeLessThan(400);
  });

  it('membership rimosso + tenantId deprecato → lettura negata', async () => {
    const status = await storageRead(logoPath, UID_REMOVED_DEP);
    expect(status).toBe(403);
  });

  it('invitato solo via membership → lettura ok', async () => {
    const status = await storageRead(logoPath, UID_INVITE_MEM);
    expect(status).toBeLessThan(400);
  });

  it('legacy solo deprecato attivo → lettura ok', async () => {
    const status = await storageRead(logoPath, UID_LEGACY_OK);
    expect(status).toBeLessThan(400);
  });

  it('legacy stato disattivato senza membership → lettura negata', async () => {
    const status = await storageRead(logoPath, UID_LEGACY_OFF);
    expect(status).toBe(403);
  });

  it('scrittura logo: manager ok, operaio negato', async () => {
    const pathMgr = `tenants/${TENANT}/logo_mgr.png`;
    const pathOp = `tenants/${TENANT}/logo_op.png`;
    const mgr = await storageUpload(pathMgr, UID_MANAGER);
    expect(mgr).toBeLessThan(400);
    const op = await storageUpload(pathOp, UID_ACTIVE_MEM);
    expect(op).toBe(403);
  });
});

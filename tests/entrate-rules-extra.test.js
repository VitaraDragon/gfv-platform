/**
 * Rules: acquirenti / conferimenti / consegne — manager ok, operaio e altro tenant no.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-gfv-conf-rules';
const HOST = '127.0.0.1';
const PORT = 8192;
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
    sub: uid, user_id: uid, uid,
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT,
    auth_time: 0, iat: 0, exp: 2000000000,
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
  return new URL(`http://${HOST}:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`);
}
async function richiesta(method, docPath, { auth = 'owner', data, exists } = {}) {
  const url = docUrl(docPath);
  if (exists === true) url.searchParams.set('currentDocument.exists', 'true');
  if (exists === false) url.searchParams.set('currentDocument.exists', 'false');
  const headers = { Authorization: `Bearer ${auth === 'owner' ? 'owner' : tokenUtente(auth)}` };
  const init = { method, headers };
  if (data) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify({ fields: valore(data).mapValue.fields });
  }
  const res = await fetch(url, init);
  return { status: res.status, body: await res.text() };
}
async function attendiEmulatore() {
  const started = Date.now();
  while (Date.now() - started < 60000) {
    try {
      const res = await fetch(`http://${HOST}:${PORT}/`, { method: 'GET' });
      if (res.status < 500) return;
    } catch { /* wait */ }
    if (emulator && emulator.exitCode != null) {
      throw new Error(`Emulatore uscito\n${emulatorLog}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Emulatore non pronto\n${emulatorLog}`);
}
function avviaEmulatore() {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-conf-rules-'));
  writeFileSync(path.join(tmpDir, 'firebase.json'), JSON.stringify({
    firestore: { rules: path.join(root, 'firestore.rules'), indexes: path.join(root, 'firestore.indexes.json') },
    emulators: { firestore: { host: HOST, port: PORT }, hub: { port: 4422 }, ui: { enabled: false } }
  }));
  const bin = path.join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
  emulator = spawn(process.execPath, [bin, 'emulators:start', '--only', 'firestore', '--project', PROJECT], {
    cwd: tmpDir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
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
    emulator.once('exit', () => resolve());
    setTimeout(resolve, 8000);
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(emulator.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else emulator.kill('SIGTERM');
  });
}
function membership(tenantId, ruolo) {
  return { tenantMemberships: { [tenantId]: { stato: 'attivo', ruoli: [ruolo] } } };
}

beforeAll(async () => {
  avviaEmulatore();
  await attendiEmulatore();
  for (const [uid, data] of [
    [OPERAIO, membership(TENANT, 'operaio')],
    [MANAGER, membership(TENANT, 'manager')],
    [ALTRO, membership(ALTRO_TENANT, 'manager')]
  ]) {
    const res = await richiesta('PATCH', `users/${uid}`, { data });
    if (res.status >= 400) throw new Error(`Seed ${uid}: ${res.status}`);
  }
  for (const [pathDoc, data] of [
    [`tenants/${TENANT}/acquirenti/a1`, { nome: 'Cantina', tipo: 'cantina_sociale' }],
    [`tenants/${TENANT}/conferimenti/c1`, { acquirenteId: 'a1', categoriaProdotto: 'uva', annata: '2025', stato: 'aperto' }],
    [`tenants/${TENANT}/consegne/d1`, { data: '2026-01-01', acquirenteId: 'a1', conferimentoId: 'c1', quantitaNetta: 10, unita: 'q' }]
  ]) {
    const res = await richiesta('PATCH', pathDoc, { data });
    if (res.status >= 400) throw new Error(`Seed ${pathDoc}: ${res.status} ${res.body}`);
  }
}, 90000);

afterAll(async () => {
  await fermaEmulatore();
  if (tmpDir) {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}, 20000);

describe.each(['acquirenti/a1', 'conferimenti/c1', 'consegne/d1'])('collection %s', (rel) => {
  it('operaio negato, manager ok, altro tenant negato', async () => {
    const pathDoc = `tenants/${TENANT}/${rel}`;
    expect((await richiesta('GET', pathDoc, { auth: OPERAIO })).status).toBe(403);
    expect((await richiesta('GET', pathDoc, { auth: MANAGER })).status).toBeLessThan(400);
    expect((await richiesta('GET', pathDoc, { auth: ALTRO })).status).toBe(403);
  });
});

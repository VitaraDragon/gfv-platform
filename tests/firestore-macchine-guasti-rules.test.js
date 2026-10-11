/**
 * Regole Firestore: caposquadra e operaio possono aggiornare una macchina
 * solo con le chiavi stato e updatedAt, e solo se stato è disponibile,
 * guasto o guasto-lavoro-in-corso, nello stesso tenant.
 *
 * Avvia l'emulatore Firestore su una porta dedicata e parla con la REST API.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-gfv-macchine-rules';
const HOST = '127.0.0.1';
const PORT = 8181;
const TENANT = 'tenant-a';
const ALTRO_TENANT = 'tenant-b';

let emulator;
let tmpDir;
let emulatorLog = '';

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** JWT non firmato: l'emulatore locale lo accetta, la produzione no. */
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

function fields(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      out[key] = {
        arrayValue: { values: value.map((item) => ({ stringValue: String(item) })) },
      };
    } else {
      out[key] = { stringValue: String(value) };
    }
  }
  return out;
}

function docUrl(docPath, mask) {
  const url = new URL(
    `http://${HOST}:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`
  );
  if (mask) {
    for (const key of mask) url.searchParams.append('updateMask.fieldPaths', key);
  }
  return url;
}

async function scrivi(docPath, data, auth, mask) {
  const bearer = auth === 'owner' ? 'owner' : tokenUtente(auth);
  const res = await fetch(docUrl(docPath, mask), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: fields(data) }),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function attendiEmulatore() {
  const started = Date.now();
  while (Date.now() - started < 60000) {
    try {
      const res = await fetch(`http://${HOST}:${PORT}/`, { method: 'GET' });
      if (res.status < 500) return;
    } catch {
      // l'emulatore non ha ancora aperto la porta
    }
    if (emulator && emulator.exitCode != null) {
      throw new Error(`Emulatore uscito con ${emulator.exitCode}\n${emulatorLog}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Emulatore non pronto\n${emulatorLog}`);
}

function avviaEmulatore() {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-rules-'));
  writeFileSync(
    path.join(tmpDir, 'firebase.json'),
    JSON.stringify({
      firestore: {
        rules: path.join(root, 'firestore.rules'),
        indexes: path.join(root, 'firestore.indexes.json'),
      },
      emulators: {
        firestore: { host: HOST, port: PORT },
        hub: { port: 4411 },
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
      spawn('taskkill', ['/pid', String(emulator.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      emulator.kill('SIGTERM');
    }
  });
}

beforeAll(async () => {
  avviaEmulatore();
  await attendiEmulatore();

  const utenti = [
    ['operaio-a', { tenantId: TENANT, ruoli: ['operaio'] }],
    ['capo-a', { tenantId: TENANT, ruoli: ['caposquadra'] }],
    ['operaio-b', { tenantId: ALTRO_TENANT, ruoli: ['operaio'] }],
  ];
  for (const [uid, data] of utenti) {
    const res = await scrivi(`users/${uid}`, data, 'owner');
    if (res.status >= 400) throw new Error(`Seed utente ${uid}: ${res.status} ${res.body}`);
  }

  const macchine = [
    'op-guasto',
    'op-corso',
    'op-disponibile',
    'capo-guasto',
    'capo-corso',
    'stato-negato',
    'campo-negato',
    'altro-tenant',
  ];
  for (const id of macchine) {
    const res = await scrivi(
      `tenants/${TENANT}/macchine/${id}`,
      { nome: 'Trattore', tipo: 'trattore', stato: 'disponibile', updatedAt: '2026-01-01' },
      'owner'
    );
    if (res.status >= 400) throw new Error(`Seed macchina ${id}: ${res.status} ${res.body}`);
  }
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

describe('macchine: guasto per caposquadra e operaio', () => {
  async function aggiornaStato(macchinaId, uid, stato, extra) {
    const data = { stato, ...(extra || {}) };
    const mask = Object.keys(data);
    return scrivi(`tenants/${TENANT}/macchine/${macchinaId}`, data, uid, mask);
  }

  it('l’operaio può segnare guasto', async () => {
    const res = await aggiornaStato('op-guasto', 'operaio-a', 'guasto');
    expect(res.status).toBeLessThan(400);
  });

  it('l’operaio può segnare guasto-lavoro-in-corso', async () => {
    const res = await aggiornaStato('op-corso', 'operaio-a', 'guasto-lavoro-in-corso', {
      updatedAt: '2026-10-10',
    });
    expect(res.status).toBeLessThan(400);
  });

  it('il caposquadra può segnare guasto', async () => {
    const res = await aggiornaStato('capo-guasto', 'capo-a', 'guasto', { updatedAt: '2026-10-10' });
    expect(res.status).toBeLessThan(400);
  });

  it('il caposquadra può segnare guasto-lavoro-in-corso', async () => {
    const res = await aggiornaStato('capo-corso', 'capo-a', 'guasto-lavoro-in-corso');
    expect(res.status).toBeLessThan(400);
  });

  it('l’operaio può ancora liberare la macchina', async () => {
    const res = await aggiornaStato('op-disponibile', 'operaio-a', 'disponibile');
    expect(res.status).toBeLessThan(400);
  });

  it('un altro stato è negato', async () => {
    const res = await aggiornaStato('stato-negato', 'operaio-a', 'in_uso');
    expect(res.status).toBe(403);
  });

  it('un altro campo è negato', async () => {
    const res = await aggiornaStato('campo-negato', 'operaio-a', 'guasto', { nome: 'Altro nome' });
    expect(res.status).toBe(403);
  });

  it('un operaio di un altro tenant è negato', async () => {
    const res = await aggiornaStato('altro-tenant', 'operaio-b', 'guasto');
    expect(res.status).toBe(403);
  });
});

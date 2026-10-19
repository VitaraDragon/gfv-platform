/**
 * Regole Firestore: caposquadra e operaio possono riportare un lavoro
 * da sospeso ad assegnato, con le sole chiavi della ripresa.
 *
 * Avvia l'emulatore Firestore su una porta dedicata e parla con la REST API.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSospendiLavoroPatch } from '../core/services/lavoro-sospensione.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-gfv-macchine-rules';
const HOST = '127.0.0.1';
const PORT = 8184;
const TENANT = 'tenant-a';

const CAPO = 'capo-a';
const CAPO_ALTRO = 'capo-altro';
const OPERAIO = 'operaio-a';
const OPERAIO_ALTRO = 'operaio-altro';
const MANAGER = 'manager-a';

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
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-lavori-ripresa-'));
  writeFileSync(
    path.join(tmpDir, 'firebase.json'),
    JSON.stringify({
      firestore: {
        rules: path.join(root, 'firestore.rules'),
        indexes: path.join(root, 'firestore.indexes.json'),
      },
      emulators: {
        firestore: { host: HOST, port: PORT },
        hub: { port: 4414 },
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
    [CAPO, { tenantId: TENANT, ruoli: ['caposquadra'] }],
    [CAPO_ALTRO, { tenantId: TENANT, ruoli: ['caposquadra'] }],
    [OPERAIO, { tenantId: TENANT, ruoli: ['operaio'] }],
    [OPERAIO_ALTRO, { tenantId: TENANT, ruoli: ['operaio'] }],
    [MANAGER, { tenantId: TENANT, ruoli: ['manager'] }],
  ];
  for (const [uid, data] of utenti) {
    const res = await richiesta('PATCH', `users/${uid}`, { data });
    if (res.status >= 400) throw new Error(`Seed utente ${uid}: ${res.status} ${res.body}`);
  }

  const lavori = [
    ['lav-sospeso', { nome: 'Squadra sospesa', caposquadraId: CAPO, stato: 'sospeso', sospensioneCausa: 'Guasto macchina grave' }],
    ['lav-altro', { nome: 'Altra squadra', caposquadraId: CAPO_ALTRO, stato: 'sospeso' }],
    ['lav-corso', { nome: 'In corso', caposquadraId: CAPO, stato: 'in_corso' }],
    ['lav-completato', { nome: 'Completato', caposquadraId: CAPO, stato: 'completato' }],
    ['lav-chiavi', { nome: 'Chiavi', caposquadraId: CAPO, stato: 'sospeso' }],
    ['lav-operaio', { nome: 'Autonomo', operaioId: OPERAIO, stato: 'sospeso', sospensioneCausa: 'Guasto macchina grave' }],
    ['lav-operaio-altro', { nome: 'Autonomo altrui', operaioId: OPERAIO_ALTRO, stato: 'sospeso' }],
    ['lav-regress-sospeso', { nome: 'Da sospendere', caposquadraId: CAPO, stato: 'in_corso' }],
    ['lav-regress-completa', { nome: 'Da completare', caposquadraId: CAPO, stato: 'in_corso' }],
    ['lav-manager', { nome: 'Manager', caposquadraId: CAPO, stato: 'in_corso' }],
    ['lav-op-assegnato', { nome: 'Autonomo assegnato', operaioId: OPERAIO, stato: 'assegnato' }],
    ['lav-op-corso', { nome: 'Autonomo in corso', operaioId: OPERAIO, stato: 'in_corso' }],
    ['lav-squadra-operaio', { nome: 'Squadra', caposquadraId: CAPO, stato: 'assegnato' }],
  ];
  for (const [id, data] of lavori) {
    const res = await richiesta('PATCH', `tenants/${TENANT}/lavori/${id}`, { data });
    if (res.status >= 400) throw new Error(`Seed lavoro ${id}: ${res.status} ${res.body}`);
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

describe('lavori: ripresa dopo un guasto', () => {
  const ripresa = {
    stato: 'assegnato',
    sospensioneCausa: null,
    sospensioneIl: null,
    aggiornatoIl: '2026-10-17',
  };

  function aggiorna(id, uid, data) {
    return richiesta('PATCH', `tenants/${TENANT}/lavori/${id}`, {
      auth: uid,
      data,
      mask: Object.keys(data),
      exists: true,
    });
  }

  it('il caposquadra del lavoro di squadra sospeso lo riporta ad assegnato', async () => {
    const res = await aggiorna('lav-sospeso', CAPO, ripresa);
    expect(res.status).toBeLessThan(400);
  });

  it('un caposquadra non riprende il lavoro di un altro', async () => {
    const res = await aggiorna('lav-altro', CAPO, ripresa);
    expect(res.status).toBe(403);
  });

  it('da in corso non si torna ad assegnato', async () => {
    const res = await aggiorna('lav-corso', CAPO, ripresa);
    expect(res.status).toBe(403);
  });

  it('da completato non si torna ad assegnato', async () => {
    const res = await aggiorna('lav-completato', CAPO, ripresa);
    expect(res.status).toBe(403);
  });

  it('la ripresa non può cambiare il caposquadra', async () => {
    const res = await aggiorna('lav-chiavi', CAPO, {
      ...ripresa,
      caposquadraId: CAPO_ALTRO,
    });
    expect(res.status).toBe(403);
  });

  it('l’operaio del lavoro autonomo sospeso lo riporta ad assegnato', async () => {
    const res = await aggiorna('lav-operaio', OPERAIO, ripresa);
    expect(res.status).toBeLessThan(400);
  });

  it('un operaio non riprende un lavoro non suo', async () => {
    const res = await aggiorna('lav-operaio-altro', OPERAIO, ripresa);
    expect(res.status).toBe(403);
  });

  it('il caposquadra può ancora sospendere e mandare in approvazione', async () => {
    const sospeso = await aggiorna('lav-regress-sospeso', CAPO, {
      stato: 'sospeso',
      sospensioneCausa: 'Guasto macchina grave',
      sospensioneIl: '2026-10-17',
      aggiornatoIl: '2026-10-17',
    });
    expect(sospeso.status).toBeLessThan(400);
    const completa = await aggiorna('lav-regress-completa', CAPO, {
      stato: 'completato_da_approvare',
      aggiornatoIl: '2026-10-17',
    });
    expect(completa.status).toBeLessThan(400);
  });

  it('il manager può aggiornare il lavoro', async () => {
    const res = await aggiorna('lav-manager', MANAGER, { stato: 'assegnato' });
    expect(res.status).toBeLessThan(400);
  });
});

describe('lavori: operaio e sospensione per guasto grave', () => {
  function datiSospensione() {
    const built = buildSospendiLavoroPatch('Guasto macchina grave', new Date('2026-10-18T08:00:00.000Z'));
    if (!built.ok) throw new Error(built.error);
    const data = {};
    Object.entries(built.patch).forEach(([key, value]) => {
      data[key] = value instanceof Date ? '2026-10-18' : value;
    });
    return data;
  }

  function aggiorna(id, uid, data) {
    return richiesta('PATCH', `tenants/${TENANT}/lavori/${id}`, {
      auth: uid,
      data,
      mask: Object.keys(data),
      exists: true,
    });
  }

  it('l’operaio autonomo sospende un lavoro assegnato con le sole chiavi della patch', async () => {
    const data = datiSospensione();
    expect(Object.keys(data).sort()).toEqual(['aggiornatoIl', 'sospensioneCausa', 'sospensioneIl', 'stato']);
    const res = await aggiorna('lav-op-assegnato', OPERAIO, data);
    if (res.status >= 400) expect.fail(`${res.status} ${res.body}`);
  });

  it('l’operaio autonomo sospende un lavoro in corso', async () => {
    const res = await aggiorna('lav-op-corso', OPERAIO, datiSospensione());
    if (res.status >= 400) expect.fail(`${res.status} ${res.body}`);
  });

  it('l’operaio di un lavoro di squadra non può sospenderlo', async () => {
    const res = await aggiorna('lav-squadra-operaio', OPERAIO, datiSospensione());
    expect(res.status).toBe(403);
  });
});

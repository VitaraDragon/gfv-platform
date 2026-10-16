/**
 * Regole Firestore della collection guasti.
 * Chi segnala crea in-attesa e può ritirare o risolvere finché il manager
 * non ha deciso. Il manager può modificare e cancellare. Un altro tenant no.
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
const PORT = 8183;
const TENANT = 'tenant-a';
const ALTRO_TENANT = 'tenant-b';

const CAPO = 'capo-membership';
const LEGACY = 'operaio-legacy';
const ALTRO = 'operaio-b';
const SOSPESO = 'capo-sospeso';
const COLLEGA = 'operaio-collega';
const MANAGER = 'manager-a';

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
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-guasti-rules-'));
  writeFileSync(
    path.join(tmpDir, 'firebase.json'),
    JSON.stringify({
      firestore: {
        rules: path.join(root, 'firestore.rules'),
        indexes: path.join(root, 'firestore.indexes.json'),
      },
      emulators: {
        firestore: { host: HOST, port: PORT },
        hub: { port: 4413 },
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

function membership(tenantId, ruolo, stato = 'attivo') {
  return {
    tenantMemberships: {
      [tenantId]: { stato, ruoli: [ruolo] },
    },
  };
}

beforeAll(async () => {
  avviaEmulatore();
  await attendiEmulatore();

  const utenti = [
    [CAPO, membership(TENANT, 'caposquadra')],
    [LEGACY, { tenantId: TENANT, ruoli: ['operaio'] }],
    [ALTRO, { tenantId: ALTRO_TENANT, ruoli: ['operaio'] }],
    [SOSPESO, membership(TENANT, 'caposquadra', 'sospeso')],
    [COLLEGA, membership(TENANT, 'operaio')],
    [MANAGER, membership(TENANT, 'manager')],
  ];
  for (const [uid, data] of utenti) {
    const res = await richiesta('PATCH', `users/${uid}`, { data });
    if (res.status >= 400) throw new Error(`Seed utente ${uid}: ${res.status} ${res.body}`);
  }

  const guasti = [
    ['g-lettura', { segnalatoDa: CAPO, stato: 'in-attesa', risolto: false, dettagli: 'lettura' }],
    ['g-annulla', { segnalatoDa: CAPO, stato: 'in-attesa', risolto: false, dettagli: 'da ritirare' }],
    ['g-risolvi', { segnalatoDa: LEGACY, stato: 'in-attesa', risolto: false, dettagli: 'da chiudere' }],
    ['g-vecchio-annulla', { segnalatoDa: CAPO, risolto: false, dettagli: 'senza stato' }],
    ['g-vecchio-risolvi', { segnalatoDa: CAPO, risolto: false, dettagli: 'senza stato' }],
    ['g-approvato', { segnalatoDa: CAPO, stato: 'approvato-continuazione', risolto: false }],
    ['g-sospeso', { segnalatoDa: CAPO, stato: 'sospeso', risolto: false }],
    ['g-riparato', { segnalatoDa: CAPO, stato: 'riparato', risolto: true }],
    ['g-altrui', { segnalatoDa: CAPO, stato: 'in-attesa', risolto: false }],
    ['g-manager', { segnalatoDa: CAPO, stato: 'in-attesa', risolto: false, gravita: 'lieve' }],
    ['g-del-capo', { segnalatoDa: CAPO, stato: 'in-attesa', risolto: false }],
    ['g-del-manager', { segnalatoDa: CAPO, stato: 'in-attesa', risolto: false }],
    ['g-gravita', { segnalatoDa: CAPO, stato: 'in-attesa', risolto: false, gravita: 'lieve' }],
  ];
  for (const [id, data] of guasti) {
    const res = await richiesta('PATCH', `tenants/${TENANT}/guasti/${id}`, { data });
    if (res.status >= 400) throw new Error(`Seed guasto ${id}: ${res.status} ${res.body}`);
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

describe('guasti: chi segnala, finché il manager non decide', () => {
  function crea(id, uid, data) {
    return richiesta('PATCH', `tenants/${TENANT}/guasti/${id}`, {
      auth: uid,
      data,
      exists: false,
    });
  }

  function aggiorna(id, uid, data) {
    return richiesta('PATCH', `tenants/${TENANT}/guasti/${id}`, {
      auth: uid,
      data,
      mask: Object.keys(data),
      exists: true,
    });
  }

  it('il caposquadra con solo tenantMemberships crea un guasto in attesa', async () => {
    const res = await crea('g-crea-capo', CAPO, {
      segnalatoDa: CAPO,
      stato: 'in-attesa',
      risolto: false,
      dettagli: 'perdita olio',
    });
    expect(res.status).toBeLessThan(400);
  });

  it('l’utente legacy con solo tenantId crea un guasto in attesa', async () => {
    const res = await crea('g-crea-legacy', LEGACY, {
      segnalatoDa: LEGACY,
      stato: 'in-attesa',
      risolto: false,
    });
    expect(res.status).toBeLessThan(400);
  });

  it('un utente di tenant-b non legge un guasto di tenant-a', async () => {
    const res = await richiesta('GET', `tenants/${TENANT}/guasti/g-lettura`, { auth: ALTRO });
    expect(res.status).toBe(403);
  });

  it('un utente di tenant-b non crea un guasto su tenant-a', async () => {
    const res = await crea('g-crea-b', ALTRO, {
      segnalatoDa: ALTRO,
      stato: 'in-attesa',
    });
    expect(res.status).toBe(403);
  });

  it('una membership sospesa non crea', async () => {
    const res = await crea('g-crea-sospeso', SOSPESO, {
      segnalatoDa: SOSPESO,
      stato: 'in-attesa',
    });
    expect(res.status).toBe(403);
  });

  it('non si crea un guasto a nome di un altro', async () => {
    const res = await crea('g-crea-altrui', CAPO, {
      segnalatoDa: LEGACY,
      stato: 'in-attesa',
    });
    expect(res.status).toBe(403);
  });

  it('non si crea un guasto con stato aperto', async () => {
    const res = await crea('g-crea-aperto', CAPO, {
      segnalatoDa: CAPO,
      stato: 'aperto',
    });
    expect(res.status).toBe(403);
  });

  it('non si crea un guasto già risolto', async () => {
    const res = await crea('g-crea-risolto', CAPO, {
      segnalatoDa: CAPO,
      stato: 'risolto',
    });
    expect(res.status).toBe(403);
  });

  it('il segnalatore annulla il proprio guasto ancora in attesa', async () => {
    const res = await aggiorna('g-annulla', CAPO, {
      stato: 'annullato',
      annullatoDa: CAPO,
      annullatoIl: '2026-10-16',
    });
    expect(res.status).toBeLessThan(400);
  });

  it('il segnalatore risolve il proprio guasto ancora in attesa', async () => {
    const res = await aggiorna('g-risolvi', LEGACY, {
      stato: 'risolto',
      risolto: true,
      risoltoDa: LEGACY,
      risoltoIl: '2026-10-16',
      noteRisoluzione: 'ripartito',
    });
    expect(res.status).toBeLessThan(400);
  });

  it('il segnalatore annulla un guasto vecchio senza campo stato', async () => {
    const res = await aggiorna('g-vecchio-annulla', CAPO, {
      stato: 'annullato',
      annullatoDa: CAPO,
      annullatoIl: '2026-10-16',
    });
    expect(res.status).toBeLessThan(400);
  });

  it('il segnalatore risolve un guasto vecchio senza campo stato', async () => {
    const res = await aggiorna('g-vecchio-risolvi', CAPO, {
      stato: 'risolto',
      risolto: true,
      risoltoDa: CAPO,
      risoltoIl: '2026-10-16',
      noteRisoluzione: 'chiuso sul posto',
    });
    expect(res.status).toBeLessThan(400);
  });

  it('il segnalatore non modifica un guasto approvato-continuazione', async () => {
    const res = await aggiorna('g-approvato', CAPO, { stato: 'risolto', risolto: true });
    expect(res.status).toBe(403);
  });

  it('il segnalatore non modifica un guasto sospeso', async () => {
    const res = await aggiorna('g-sospeso', CAPO, { stato: 'risolto', risolto: true });
    expect(res.status).toBe(403);
  });

  it('il segnalatore non modifica un guasto legacy riparato', async () => {
    const res = await aggiorna('g-riparato', CAPO, { stato: 'risolto' });
    expect(res.status).toBe(403);
  });

  it('un altro operaio non modifica il guasto', async () => {
    const res = await aggiorna('g-altrui', COLLEGA, {
      stato: 'annullato',
      annullatoDa: COLLEGA,
      annullatoIl: '2026-10-16',
    });
    expect(res.status).toBe(403);
  });

  it('il segnalatore non cambia un campo fuori elenco', async () => {
    const res = await aggiorna('g-gravita', CAPO, { gravita: 'grave' });
    expect(res.status).toBe(403);
  });

  it('il manager chiude e modifica anche un campo fuori elenco', async () => {
    const res = await aggiorna('g-manager', MANAGER, {
      stato: 'risolto',
      risolto: true,
      gravita: 'grave',
    });
    expect(res.status).toBeLessThan(400);
  });

  it('il caposquadra non cancella un guasto', async () => {
    const res = await richiesta('DELETE', `tenants/${TENANT}/guasti/g-del-capo`, { auth: CAPO });
    expect(res.status).toBe(403);
    const ancora = await richiesta('GET', `tenants/${TENANT}/guasti/g-del-capo`, { auth: CAPO });
    expect(ancora.status).toBeLessThan(400);
  });

  it('il manager cancella un guasto', async () => {
    const res = await richiesta('DELETE', `tenants/${TENANT}/guasti/g-del-manager`, { auth: MANAGER });
    expect(res.status).toBeLessThan(400);
    const sparito = await richiesta('GET', `tenants/${TENANT}/guasti/g-del-manager`, { auth: MANAGER });
    expect(sparito.status).toBe(404);
  });
});

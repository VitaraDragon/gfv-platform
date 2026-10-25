/**
 * Regole users / inviti: niente auto-assegnazione ruoli/membership; lettura per tenant.
 * Emulatore Firestore su porta dedicata + REST + JWT non firmati.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-gfv-users-membership-rules';
const HOST = '127.0.0.1';
const PORT = 8195;

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ADMIN_A = 'admin-a';
const ADMIN_B = 'admin-b';
const OPERAIO_A = 'operaio-a';
const MANAGER_A = 'manager-a';
const MEMBER_ONLY = 'member-only-a';
const REG_UID = 'reg-new-owner';

let emulator;
let tmpDir;
let emulatorLog = '';
let emulatorOk = false;

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

async function richiesta(method, docPath, { auth = 'owner', data, mask, exists, email } = {}) {
  const url = docUrl(docPath);
  if (mask) {
    for (const key of mask) url.searchParams.append('updateMask.fieldPaths', key);
  }
  if (exists === true) url.searchParams.set('currentDocument.exists', 'true');
  if (exists === false) url.searchParams.set('currentDocument.exists', 'false');
  const headers = {
    Authorization: `Bearer ${auth === 'owner' ? 'owner' : tokenUtente(auth, email)}`,
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

async function runQuery(auth, structuredQuery, email) {
  const url = new URL(
    `http://${HOST}:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`
  );
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth === 'owner' ? 'owner' : tokenUtente(auth, email)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });
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
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-users-membership-rules-'));
  writeFileSync(
    path.join(tmpDir, 'firebase.json'),
    JSON.stringify({
      firestore: {
        rules: path.join(root, 'firestore.rules'),
        indexes: path.join(root, 'firestore.indexes.json'),
      },
      emulators: {
        firestore: { host: HOST, port: PORT },
        hub: { port: 4415 },
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
      `users/${ADMIN_A}`,
      {
        email: 'admin-a@test.local',
        tenantId: TENANT_A,
        ruoli: ['amministratore'],
        stato: 'attivo',
      },
    ],
    [
      `users/${ADMIN_B}`,
      {
        email: 'admin-b@test.local',
        tenantId: TENANT_B,
        ruoli: ['amministratore'],
        stato: 'attivo',
      },
    ],
    [
      `users/${OPERAIO_A}`,
      {
        email: 'op-a@test.local',
        tenantId: TENANT_A,
        ruoli: ['operaio'],
        stato: 'attivo',
      },
    ],
    [
      `users/${MANAGER_A}`,
      {
        email: 'mgr-a@test.local',
        tenantId: TENANT_A,
        ruoli: ['manager'],
        stato: 'attivo',
      },
    ],
    [
      `users/${MEMBER_ONLY}`,
      {
        email: 'member@test.local',
        stato: 'attivo',
        tenantMemberships: {
          [TENANT_A]: { stato: 'attivo', ruoli: ['operaio'] },
        },
      },
    ],
    [`tenants/${TENANT_A}`, { nome: 'Azienda A', creatoDa: ADMIN_A, stato: 'attivo' }],
    [`tenants/${TENANT_B}`, { nome: 'Azienda B', creatoDa: ADMIN_B, stato: 'attivo' }],
    [
      'inviti/inv-a1',
      {
        email: 'guest@test.local',
        tenantId: TENANT_A,
        token: 'token-invito-aaaaaa',
        stato: 'invitato',
        inviatoDa: MANAGER_A,
        ruoli: ['operaio'],
      },
    ],
  ];
  for (const [pathDoc, data] of seed) {
    const res = await richiesta('PATCH', pathDoc, { data });
    if (res.status >= 400) throw new Error(`Seed ${pathDoc}: ${res.status} ${res.body}`);
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

function skipIfNoEmu() {
  if (!emulatorOk) {
    throw new Error('emulatore non raggiungibile');
  }
  return false;
}

describe('users membership rules', () => {
  it('utente non può aggiungersi membership / cambiare ruoli / stato / email / tariffa', async () => {
    if (skipIfNoEmu()) return;
    const deny = async (mask, data) => {
      const res = await richiesta('PATCH', `users/${ADMIN_A}`, {
        auth: ADMIN_A,
        mask,
        data,
        exists: true,
      });
      expect(res.status).toBe(403);
    };
    await deny(['tenantMemberships'], {
      tenantMemberships: {
        [TENANT_B]: { stato: 'attivo', ruoli: ['amministratore'] },
      },
    });
    await deny(['ruoli'], { ruoli: ['amministratore', 'manager'] });
    await deny(['tenantId'], { tenantId: TENANT_B });
    await deny(['stato'], { stato: 'disattivato' });
    await deny(['email'], { email: 'altro@test.local' });
    await deny(['tariffaPersonalizzata'], { tariffaPersonalizzata: 99 });
  });

  it('utente può aggiornare campi profilo whitelist', async () => {
    if (skipIfNoEmu()) return;
    const res = await richiesta('PATCH', `users/${ADMIN_A}`, {
      auth: ADMIN_A,
      mask: ['nome', 'cognome', 'telefono', 'cellulare', 'ultimoAccesso', 'isOnline', 'lastSeen', 'notificationPrefs'],
      data: {
        nome: 'Ada',
        cognome: 'Admin',
        telefono: '011',
        cellulare: '333',
        ultimoAccesso: '2026-10-24T10:00:00.000Z',
        isOnline: true,
        lastSeen: '2026-10-24T10:00:00.000Z',
        notificationPrefs: { email: true },
      },
      exists: true,
    });
    expect(res.status).toBe(200);
  });

  it('create con tenant altrui o membership su altro tenant → 403; registrazione legittima → 200', async () => {
    if (skipIfNoEmu()) return;
    const hijack = await richiesta('PATCH', `users/${REG_UID}`, {
      auth: REG_UID,
      email: 'reg@test.local',
      exists: false,
      data: {
        email: 'reg@test.local',
        tenantId: TENANT_A,
        ruoli: ['amministratore'],
        stato: 'attivo',
        creatoDa: REG_UID,
        tenantMemberships: {
          [TENANT_A]: { ruoli: ['amministratore'], stato: 'attivo' },
        },
      },
    });
    expect(hijack.status).toBe(403);

    const tenantMine = `tenant_reg_${REG_UID.slice(0, 8)}`;
    const seedTenant = await richiesta('PATCH', `tenants/${tenantMine}`, {
      auth: REG_UID,
      email: 'reg@test.local',
      exists: false,
      data: { nome: 'Nuova', creatoDa: REG_UID, stato: 'attivo', piano: 'free', moduli: [] },
    });
    // Create tenant senza users doc: rules Caso 2
    expect(seedTenant.status).toBeLessThan(400);

    const ok = await richiesta('PATCH', `users/${REG_UID}`, {
      auth: REG_UID,
      email: 'reg@test.local',
      exists: false,
      data: {
        id: REG_UID,
        email: 'reg@test.local',
        tenantId: tenantMine,
        ruoli: ['amministratore'],
        stato: 'attivo',
        creatoDa: REG_UID,
        tenantMemberships: {
          [tenantMine]: { ruoli: ['amministratore'], stato: 'attivo', tenantIdPredefinito: true },
        },
      },
    });
    expect(ok.status).toBe(200);
  });

  it('manager Caso 2 campi contratto operaio stesso tenant → 200', async () => {
    if (skipIfNoEmu()) return;
    const res = await richiesta('PATCH', `users/${OPERAIO_A}`, {
      auth: MANAGER_A,
      mask: ['tipoOperaio', 'tipoContratto', 'tariffaPersonalizzata'],
      data: {
        tipoOperaio: 'stagionale',
        tipoContratto: 'determinato',
        tariffaPersonalizzata: 12.5,
      },
      exists: true,
    });
    expect(res.status).toBe(200);
  });

  it('manager non può cambiare tenantId/email di un invito', async () => {
    if (skipIfNoEmu()) return;
    const res = await richiesta('PATCH', 'inviti/inv-a1', {
      auth: MANAGER_A,
      mask: ['tenantId', 'email'],
      data: { tenantId: TENANT_B, email: 'manager-a@test.local' },
      exists: true,
    });
    expect(res.status).toBe(403);
  });

  it('invito: solo transizione invitato → annullato; non si riapre accettato/annullato', async () => {
    if (skipIfNoEmu()) return;
    const baseInvito = {
      email: 'guest2@test.local',
      tenantId: TENANT_A,
      token: 'token-invito-bbbbbb',
      inviatoDa: MANAGER_A,
      ruoli: ['operaio'],
    };
    const seedAcc = await richiesta('PATCH', 'inviti/inv-acc', {
      data: { ...baseInvito, token: 'token-invito-accccc', stato: 'accettato' },
    });
    expect(seedAcc.status).toBeLessThan(400);
    const seedAnn = await richiesta('PATCH', 'inviti/inv-ann', {
      data: { ...baseInvito, token: 'token-invito-annnnn', stato: 'annullato' },
    });
    expect(seedAnn.status).toBeLessThan(400);

    const reopenAcc = await richiesta('PATCH', 'inviti/inv-acc', {
      auth: MANAGER_A,
      mask: ['stato'],
      data: { stato: 'invitato' },
      exists: true,
    });
    expect(reopenAcc.status).toBe(403);

    const reopenAnn = await richiesta('PATCH', 'inviti/inv-ann', {
      auth: MANAGER_A,
      mask: ['stato'],
      data: { stato: 'invitato' },
      exists: true,
    });
    expect(reopenAnn.status).toBe(403);

    const annulla = await richiesta('PATCH', 'inviti/inv-a1', {
      auth: MANAGER_A,
      mask: ['stato'],
      data: { stato: 'annullato' },
      exists: true,
    });
    expect(annulla.status).toBe(200);
  });

  it('lettura users: cross-tenant 403; query email senza tenant 403; stesso tenant 200 anche solo membership', async () => {
    if (skipIfNoEmu()) return;
    const cross = await richiesta('GET', `users/${ADMIN_B}`, { auth: ADMIN_A });
    expect(cross.status).toBe(403);

    const emailQ = await runQuery(ADMIN_A, {
      from: [{ collectionId: 'users' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'email' },
          op: 'EQUAL',
          value: { stringValue: 'admin-b@test.local' },
        },
      },
    });
    expect(emailQ.status).toBe(403);

    const tenantQ = await runQuery(ADMIN_A, {
      from: [{ collectionId: 'users' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'tenantId' },
          op: 'EQUAL',
          value: { stringValue: TENANT_A },
        },
      },
    });
    expect(tenantQ.status).toBe(200);

    const memberRead = await richiesta('GET', `users/${OPERAIO_A}`, { auth: MEMBER_ONLY });
    expect(memberRead.status).toBe(200);

    // Auto-membership fallita: ADMIN_A non legge B dopo tentativo (già 403 sopra); conferma di nuovo
    const still = await richiesta('GET', `users/${ADMIN_B}`, { auth: ADMIN_A });
    expect(still.status).toBe(403);
  });

  it('delete del proprio doc → 403', async () => {
    if (skipIfNoEmu()) return;
    const res = await richiesta('DELETE', `users/${OPERAIO_A}`, { auth: OPERAIO_A });
    expect(res.status).toBe(403);
  });
});

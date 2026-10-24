/**
 * Regole tenants: piano/moduli/prove/Stripe/creato* non scrivibili dal client.
 * Emulatore Firestore su porta dedicata + REST + JWT non firmati.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-gfv-tenant-billing-rules';
const HOST = '127.0.0.1';
const PORT = 8193;
const HUB_PORT = 4416;

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ADMIN_A = 'admin-a';
const ADMIN_B = 'admin-b';
const MANAGER_A = 'manager-a';
const OPERAIO_A = 'operaio-a';
const REG_UID = 'reg-new-owner';

const PROTECTED_UPDATE_KEYS = [
  'plan',
  'piano',
  'modules',
  'moduleTrials',
  'activeBundles',
  'stripeSubscriptionId',
  'stripeAddons',
  'status',
  'expiryDate',
  'startDate',
  'tonyGuidaOnboardingEndsAt',
];

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
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-tenant-billing-rules-'));
  writeFileSync(
    path.join(tmpDir, 'firebase.json'),
    JSON.stringify({
      firestore: {
        rules: path.join(root, 'firestore.rules'),
        indexes: path.join(root, 'firestore.indexes.json'),
      },
      emulators: {
        firestore: { host: HOST, port: PORT },
        hub: { port: HUB_PORT },
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
    console.warn('[firestore-tenant-billing-rules] Emulatore non avviato:', err && err.message);
    return;
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
      `users/${MANAGER_A}`,
      {
        email: 'mgr-a@test.local',
        tenantId: TENANT_A,
        ruoli: ['manager'],
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
      `tenants/${TENANT_A}`,
      {
        nome: 'Azienda A',
        creatoDa: ADMIN_A,
        creatoIl: new Date('2026-01-01T00:00:00.000Z'),
        piano: 'free',
        moduli: [],
        stato: 'attivo',
      },
    ],
    [
      `tenants/${TENANT_B}`,
      {
        nome: 'Azienda B',
        creatoDa: ADMIN_B,
        piano: 'free',
        stato: 'attivo',
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
    console.warn('SKIP: emulatore Firestore non disponibile (es. Java 21 mancante)');
  }
  return !emulatorOk;
}

describe('abbonamento-standalone statico', () => {
  it('non scrive più campi protetti su tenants via updateDoc', () => {
    const html = readFileSync(
      path.join(root, 'core/admin/abbonamento-standalone.html'),
      'utf8'
    );
    expect(html).not.toMatch(/applyCustomPlan/);
    expect(html).not.toMatch(/Costruisci il tuo Piano/);

    // Nessun updateDoc sul doc tenant con chiavi di fatturazione/piano
    const updateTenantBlocks = [
      ...html.matchAll(/updateDoc\(\s*doc\(\s*db\s*,\s*['"]tenants['"]\s*,[\s\S]*?\)\s*,\s*\{([\s\S]*?)\}\s*\)/g),
    ];
    for (const match of updateTenantBlocks) {
      const body = match[1];
      for (const key of [
        'plan',
        'piano',
        'modules',
        'moduli',
        'moduleTrials',
        'activeBundles',
        'expiryDate',
        'startDate',
        'stripeCustomerId',
        'stripeSubscriptionId',
        'stripeAddons',
        'status',
        'stato',
        'tonyGuidaOnboardingEndsAt',
        'billingPaymentFailedAt',
      ]) {
        expect(body).not.toMatch(new RegExp(`\\b${key}\\s*:`));
      }
    }
    // selectPlan non deve più aggiornare il doc tenant direttamente
    expect(html).not.toMatch(/await updateDoc\(doc\(db,\s*['"]tenants['"],\s*currentTenantId\),\s*updates\)/);
  });
});

describe('tenants billing rules', () => {
  it('admin/manager: update anagrafica e flag operativi → ok', async () => {
    if (skipIfNoEmu()) return;

    const adminRes = await richiesta('PATCH', `tenants/${TENANT_A}`, {
      auth: ADMIN_A,
      mask: ['nome', 'piva', 'logoUrl', 'featureFlags', 'manodoperaModuloOsservato', 'preventivoSeqByYear'],
      data: {
        nome: 'Azienda A rinominata',
        piva: 'IT123',
        logoUrl: 'https://example.com/logo.png',
        featureFlags: { preview: true },
        manodoperaModuloOsservato: true,
        preventivoSeqByYear: { 2026: 3 },
      },
      exists: true,
    });
    expect(adminRes.status).toBe(200);

    const mgrRes = await richiesta('PATCH', `tenants/${TENANT_A}`, {
      auth: MANAGER_A,
      mask: ['nome', 'note'],
      data: { nome: 'Azienda A da manager', note: 'ok' },
      exists: true,
    });
    expect(mgrRes.status).toBe(200);
  });

  it('admin: update creatoDa → negato', async () => {
    if (skipIfNoEmu()) return;
    const res = await richiesta('PATCH', `tenants/${TENANT_A}`, {
      auth: ADMIN_A,
      mask: ['creatoDa'],
      data: { creatoDa: MANAGER_A },
      exists: true,
    });
    expect(res.status).toBe(403);
  });

  it('admin/manager: update campi fatturazione (singoli e misti) → negato', async () => {
    if (skipIfNoEmu()) return;

    const samples = {
      plan: 'base',
      piano: 'base',
      modules: ['manodopera'],
      moduleTrials: { manodopera: { endsAt: 'x' } },
      activeBundles: ['bundle-x'],
      stripeSubscriptionId: 'sub_hack',
      stripeAddons: { manodopera: { type: 'module' } },
      status: 'active',
      expiryDate: new Date(Date.now() + 86400000),
      startDate: new Date(),
      tonyGuidaOnboardingEndsAt: new Date(Date.now() + 365 * 86400000),
    };

    for (const key of PROTECTED_UPDATE_KEYS) {
      const res = await richiesta('PATCH', `tenants/${TENANT_A}`, {
        auth: ADMIN_A,
        mask: [key],
        data: { [key]: samples[key] },
        exists: true,
      });
      expect(res.status, key).toBe(403);
    }

    const mixed = await richiesta('PATCH', `tenants/${TENANT_A}`, {
      auth: MANAGER_A,
      mask: ['nome', 'plan', 'modules'],
      data: { nome: 'Hacker', plan: 'base', modules: ['magazzino'] },
      exists: true,
    });
    expect(mixed.status).toBe(403);
  });

  it('altro tenant / non manager → update negato', async () => {
    if (skipIfNoEmu()) return;

    const other = await richiesta('PATCH', `tenants/${TENANT_A}`, {
      auth: ADMIN_B,
      mask: ['nome'],
      data: { nome: 'Hijack' },
      exists: true,
    });
    expect(other.status).toBe(403);

    const operaio = await richiesta('PATCH', `tenants/${TENANT_A}`, {
      auth: OPERAIO_A,
      mask: ['nome'],
      data: { nome: 'No' },
      exists: true,
    });
    expect(operaio.status).toBe(403);
  });

  it('registrazione: create Free reale → ok; payload a pagamento → negato', async () => {
    if (skipIfNoEmu()) return;

    const endsAtOk = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const ok = await richiesta('PATCH', `tenants/reg_${REG_UID}`, {
      auth: REG_UID,
      email: 'reg@test.local',
      exists: false,
      data: {
        nome: 'Nuova Azienda',
        creatoDa: REG_UID,
        creatoIl: new Date(),
        piano: 'free',
        moduli: [],
        stato: 'attivo',
        tonyGuidaOnboardingEndsAt: endsAtOk,
      },
    });
    expect(ok.status).toBe(200);

    const denyCases = [
      { plan: 'base', nome: 'X', creatoDa: REG_UID },
      { piano: 'free', modules: ['manodopera'], nome: 'X', creatoDa: REG_UID },
      {
        piano: 'free',
        moduli: [],
        moduleTrials: { manodopera: { startedAt: 'x' } },
        nome: 'X',
        creatoDa: REG_UID,
      },
      {
        piano: 'free',
        moduli: [],
        stripeSubscriptionId: 'sub_x',
        nome: 'X',
        creatoDa: REG_UID,
      },
      {
        piano: 'free',
        moduli: [],
        tonyGuidaOnboardingEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        nome: 'X',
        creatoDa: REG_UID,
      },
    ];

    let i = 0;
    for (const data of denyCases) {
      i += 1;
      const res = await richiesta('PATCH', `tenants/reg_deny_${i}_${REG_UID}`, {
        auth: REG_UID,
        email: 'reg@test.local',
        exists: false,
        data,
      });
      expect(res.status, JSON.stringify(data)).toBe(403);
    }
  });
});

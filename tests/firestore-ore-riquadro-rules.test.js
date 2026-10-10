/**
 * Letture del riquadro ore del campo, con le regole del repo.
 * Operaio con tenantMemberships.<t>.stato = attivo.
 * Non modifica firestore.rules: verifica solo se il repo già le consente.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-gfv-ore-riquadro';
const HOST = '127.0.0.1';
const PORT = 8197;
const TENANT = 'tenant-ore-a';
const ALTRO = 'tenant-ore-b';
const OPERAIO = 'operaio-ore';
const CAPO = 'capo-ore';
const MANAGER = 'manager-ore';
const ESTRANEO = 'estraneo-ore';

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
  return `http://${HOST}:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`;
}

async function scrivi(docPath, data) {
  const res = await fetch(docUrl(docPath), {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: valore(data).mapValue.fields }),
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function eseguiQuery(parentPath, collectionId, auth, field, ugualeA) {
  const structuredQuery = { from: [{ collectionId }] };
  if (field) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: field },
        op: 'EQUAL',
        value: { stringValue: ugualeA },
      },
    };
  }
  const res = await fetch(`${docUrl(parentPath)}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenUtente(auth)}`,
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
      // porta non ancora aperta
    }
    if (emulator && emulator.exitCode != null) {
      throw new Error(`Emulatore uscito con ${emulator.exitCode}\n${emulatorLog}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Emulatore non pronto\n${emulatorLog}`);
}

function avviaEmulatore() {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-ore-rules-'));
  writeFileSync(
    path.join(tmpDir, 'firebase.json'),
    JSON.stringify({
      firestore: {
        rules: path.join(root, 'firestore.rules'),
        indexes: path.join(root, 'firestore.indexes.json'),
      },
      emulators: {
        firestore: { host: HOST, port: PORT },
        hub: { port: 4497 },
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
    [OPERAIO, TENANT, ['operaio']],
    [CAPO, TENANT, ['caposquadra']],
    [MANAGER, TENANT, ['manager']],
    [ESTRANEO, ALTRO, ['operaio']],
  ];
  for (const [uid, tenant, ruoli] of utenti) {
    const res = await scrivi(`users/${uid}`, {
      tenantMemberships: {
        [tenant]: { stato: 'attivo', ruoli },
      },
    });
    if (res.status >= 400) throw new Error(`Seed utente ${uid}: ${res.status} ${res.body}`);
  }

  const lavori = [
    ['lav-mio', { nome: 'Mio', operaioId: OPERAIO }],
    ['lav-altro', { nome: 'Altro', operaioId: 'operaio-collega' }],
  ];
  for (const [id, data] of lavori) {
    const res = await scrivi(`tenants/${TENANT}/lavori/${id}`, data);
    if (res.status >= 400) throw new Error(`Seed lavoro ${id}: ${res.status} ${res.body}`);
  }
  const ora = await scrivi(`tenants/${TENANT}/lavori/lav-mio/oreOperai/ora-1`, {
    operaioId: OPERAIO,
    stato: 'da_validare',
  });
  if (ora.status >= 400) throw new Error(`Seed ora: ${ora.status} ${ora.body}`);
  const squadra = await scrivi(`tenants/${TENANT}/squadre/sq-1`, {
    caposquadraId: CAPO,
    nome: 'Squadra',
  });
  if (squadra.status >= 400) throw new Error(`Seed squadra: ${squadra.status} ${squadra.body}`);
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

describe('riquadro ore: letture con le regole del repo', () => {
  const campiLavoro = ['operaioId', 'operatoreMacchinaId', 'assenzaSostitutoOperaioId', 'caposquadraId'];

  async function attendiConsentita(nome, res) {
    expect(res.status, `${nome} ${res.status} ${res.body}`).toBeLessThan(400);
  }

  it('l’operaio legge lavori, squadre e le proprie ore', async () => {
    for (const campo of campiLavoro) {
      const res = await eseguiQuery(`tenants/${TENANT}`, 'lavori', OPERAIO, campo, OPERAIO);
      await attendiConsentita(`lavori ${campo}`, res);
    }
    const squadre = await eseguiQuery(`tenants/${TENANT}`, 'squadre', OPERAIO);
    await attendiConsentita('squadre', squadre);
    const ore = await eseguiQuery(
      `tenants/${TENANT}/lavori/lav-mio`,
      'oreOperai',
      OPERAIO,
      'operaioId',
      OPERAIO
    );
    await attendiConsentita('oreOperai', ore);
  });

  it('caposquadra e manager leggono le stesse query nel tenant', async () => {
    for (const uid of [CAPO, MANAGER]) {
      const lavori = await eseguiQuery(`tenants/${TENANT}`, 'lavori', uid, 'operaioId', OPERAIO);
      await attendiConsentita(`${uid} lavori`, lavori);
      const squadre = await eseguiQuery(`tenants/${TENANT}`, 'squadre', uid);
      await attendiConsentita(`${uid} squadre`, squadre);
      const ore = await eseguiQuery(
        `tenants/${TENANT}/lavori/lav-mio`,
        'oreOperai',
        uid,
        'operaioId',
        OPERAIO
      );
      await attendiConsentita(`${uid} ore`, ore);
    }
  });

  it('un operaio di un altro tenant è negato', async () => {
    const res = await eseguiQuery(`tenants/${TENANT}`, 'lavori', ESTRANEO, 'operaioId', OPERAIO);
    expect(res.status).toBe(403);
  });
});

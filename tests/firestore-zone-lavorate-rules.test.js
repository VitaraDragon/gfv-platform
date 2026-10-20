/**
 * Regole di zoneLavorate: chi crea, chi aggiorna, proprietà immutabile.
 * Emulatore Firestore dedicato, REST con JWT non firmato.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-gfv-zone-lavorate';
const HOST = '127.0.0.1';
const PORT = 8199;
const TENANT = 'tenant-zone-a';
const ALTRO = 'tenant-zone-b';

const MANAGER = 'manager-zone';
const ADMIN = 'admin-zone';
const CAPO = 'capo-zone';
const CAPO_ALTRO = 'capo-altro-zone';
const OPERAIO = 'operaio-zone';
const OPERAIO_ALTRO = 'operaio-altro-zone';
const DUAL = 'dual-zone';
const SOST = 'sostituto-zone';
const SOST_SENZA = 'sostituto-senza-ruolo';
const MANAGER_ALTRO = 'manager-altro-tenant';

let emulator;
let tmpDir;
let emulatorLog = '';
let seq = 0;

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

function zonaId() {
  seq += 1;
  return `z-${Date.now().toString(36)}-${seq}`;
}

async function richiesta(method, docPath, { auth = 'owner', data, mask, exists } = {}) {
  const url = docUrl(docPath);
  if (mask) {
    for (const key of mask) url.searchParams.append('updateMask.fieldPaths', key);
  }
  if (exists === true) url.searchParams.set('currentDocument.exists', 'true');
  if (exists === false) url.searchParams.set('currentDocument.exists', 'false');
  const headers = {};
  if (auth != null) {
    headers.Authorization = `Bearer ${auth === 'owner' ? 'owner' : tokenUtente(auth)}`;
  }
  const init = { method, headers };
  if (data) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify({ fields: valore(data).mapValue.fields });
  }
  const res = await fetch(url, init);
  const body = await res.text();
  return { status: res.status, body };
}

async function listaZone(lavoroId, auth) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth != null) headers.Authorization = `Bearer ${tokenUtente(auth)}`;
  const res = await fetch(
    `http://${HOST}:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents/tenants/${TENANT}/lavori/${lavoroId}:runQuery`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        structuredQuery: { from: [{ collectionId: 'zoneLavorate' }] },
      }),
    }
  );
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
  tmpDir = mkdtempSync(path.join(tmpdir(), 'gfv-zone-rules-'));
  writeFileSync(
    path.join(tmpDir, 'firebase.json'),
    JSON.stringify({
      firestore: {
        rules: path.join(root, 'firestore.rules'),
        indexes: path.join(root, 'firestore.indexes.json'),
      },
      emulators: {
        firestore: { host: HOST, port: PORT },
        hub: { port: 4499 },
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

function membership(tenantId, ruoli) {
  return {
    tenantMemberships: {
      [tenantId]: { stato: 'attivo', ruoli },
    },
  };
}

const lavori = {
  squadra: { caposquadraId: CAPO },
  autonomo: { operaioId: OPERAIO },
  autonomoCapoVuoto: { operaioId: OPERAIO, caposquadraId: '' },
  sporco: { caposquadraId: CAPO, operaioId: OPERAIO },
  squadraAltrui: { caposquadraId: CAPO_ALTRO },
  autonomoAltrui: { operaioId: OPERAIO_ALTRO },
  dualSquadra: { caposquadraId: DUAL },
  dualAutonomo: { operaioId: DUAL },
  sostAutonomo: { operaioId: OPERAIO, assenzaSostitutoOperaioId: SOST },
  sostSquadra: { caposquadraId: CAPO, assenzaSostitutoOperaioId: SOST },
};

const zoneSeed = {};

async function semina(docPath, data) {
  const res = await richiesta('PATCH', docPath, { data });
  if (res.status >= 400) throw new Error(`Seed ${docPath}: ${res.status} ${res.body}`);
}

async function seminaZona(lavoroId, data) {
  const id = zonaId();
  await semina(`tenants/${TENANT}/lavori/${lavoroId}/zoneLavorate/${id}`, data);
  return id;
}

beforeAll(async () => {
  avviaEmulatore();
  await attendiEmulatore();

  const utenti = [
    [MANAGER, membership(TENANT, ['manager'])],
    [ADMIN, membership(TENANT, ['amministratore'])],
    [CAPO, membership(TENANT, ['caposquadra'])],
    [CAPO_ALTRO, membership(TENANT, ['caposquadra'])],
    [OPERAIO, membership(TENANT, ['operaio'])],
    [OPERAIO_ALTRO, membership(TENANT, ['operaio'])],
    [DUAL, membership(TENANT, ['caposquadra', 'operaio'])],
    [SOST, membership(TENANT, ['operaio'])],
    [SOST_SENZA, membership(TENANT, ['contabile'])],
    [MANAGER_ALTRO, membership(ALTRO, ['manager'])],
  ];
  for (const [uid, data] of utenti) await semina(`users/${uid}`, data);
  for (const [id, data] of Object.entries(lavori)) {
    await semina(`tenants/${TENANT}/lavori/${id}`, data);
  }

  zoneSeed.ahmed = await seminaZona('squadra', { operaioId: OPERAIO, note: 'ahmed' });
  zoneSeed.opAutonomo = await seminaZona('autonomo', { operaioId: OPERAIO, note: 'auto' });
  zoneSeed.capoProprio = await seminaZona('squadra', { caposquadraId: CAPO, note: 'capo' });
  zoneSeed.senzaProprietario = await seminaZona('squadra', { note: 'senza' });
  zoneSeed.zonaCapo = await seminaZona('squadra', { caposquadraId: CAPO, note: 'zona-capo' });
  zoneSeed.zonaAutonomo = await seminaZona('autonomo', { operaioId: OPERAIO, note: 'zona-auto' });
  zoneSeed.dualAltrui = await seminaZona('squadraAltrui', { operaioId: OPERAIO, note: 'dual' });
  zoneSeed.stessoOperaio = await seminaZona('autonomo', { operaioId: OPERAIO, note: 'prima' });
  zoneSeed.cambiaOperaio = await seminaZona('autonomo', { operaioId: OPERAIO, note: 'cambio' });
  zoneSeed.aggiungeCapo = await seminaZona('squadra', { operaioId: OPERAIO, note: 'aggiunge' });
  zoneSeed.managerCambiaCapo = await seminaZona('squadra', { caposquadraId: CAPO, note: 'mgr' });
  zoneSeed.toglieOperaio = await seminaZona('autonomo', { operaioId: OPERAIO, note: 'togli' });
  zoneSeed.lista = await seminaZona('squadra', { operaioId: OPERAIO, note: 'lista' });
  zoneSeed.deleteProprio = await seminaZona('autonomo', { operaioId: OPERAIO, note: 'del-si' });
  zoneSeed.deleteAltro = await seminaZona('autonomo', { operaioId: OPERAIO, note: 'del-no' });
  zoneSeed.deleteManager = await seminaZona('autonomo', { operaioId: OPERAIO, note: 'del-mgr' });
  zoneSeed.sostPropria = await seminaZona('sostAutonomo', { operaioId: SOST, note: 'sost' });
  zoneSeed.titolare = await seminaZona('sostAutonomo', { operaioId: OPERAIO, note: 'titolare' });
  zoneSeed.capoSquadraSost = await seminaZona('sostSquadra', { caposquadraId: CAPO, note: 'capo-squadra' });
  zoneSeed.intestare = await seminaZona('sostAutonomo', { operaioId: SOST, note: 'intestare' });
  zoneSeed.prendersi = await seminaZona('sostAutonomo', { operaioId: OPERAIO, note: 'prendersi' });
  zoneSeed.altroSuSost = await seminaZona('sostAutonomo', { operaioId: SOST, note: 'altro-su-sost' });
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

function crea(lavoroId, uid, data = { note: 'nuova' }) {
  const id = zonaId();
  return richiesta('PATCH', `tenants/${TENANT}/lavori/${lavoroId}/zoneLavorate/${id}`, {
    auth: uid,
    data,
    exists: false,
  });
}

function aggiorna(lavoroId, id, uid, data) {
  return richiesta('PATCH', `tenants/${TENANT}/lavori/${lavoroId}/zoneLavorate/${id}`, {
    auth: uid,
    data,
    mask: Object.keys(data),
    exists: true,
  });
}

function consentita(nome, res) {
  expect(res.status, `${nome} ${res.status} ${res.body}`).toBeLessThan(400);
}

function negata(nome, res) {
  expect(res.status, `${nome} ${res.status} ${res.body}`).toBeGreaterThanOrEqual(400);
}

describe('zoneLavorate: create', () => {
  it('manager e admin su squadra e autonomo', async () => {
    consentita('manager squadra', await crea('squadra', MANAGER));
    consentita('manager autonomo', await crea('autonomo', MANAGER));
    consentita('admin squadra', await crea('squadra', ADMIN));
    consentita('admin autonomo', await crea('autonomo', ADMIN));
  });

  it('capo sul proprio lavoro e sul lavoro sporco', async () => {
    consentita('capo proprio', await crea('squadra', CAPO));
    consentita('capo sporco', await crea('sporco', CAPO));
  });

  it('operaio sul proprio autonomo, senza capo e con capo vuoto', async () => {
    consentita('autonomo', await crea('autonomo', OPERAIO));
    consentita('capo vuoto', await crea('autonomoCapoVuoto', OPERAIO));
  });

  it('capo e operaio insieme sui propri lavori', async () => {
    consentita('dual squadra', await crea('dualSquadra', DUAL));
    consentita('dual autonomo', await crea('dualAutonomo', DUAL));
  });

  it('nega operaio su squadra e su lavoro sporco', async () => {
    negata('operaio squadra', await crea('squadra', OPERAIO));
    negata('operaio sporco', await crea('sporco', OPERAIO));
  });

  it('nega altro capo, capo su autonomo, altro operaio, dual su squadra altrui', async () => {
    negata('altro capo', await crea('squadra', CAPO_ALTRO));
    negata('capo autonomo', await crea('autonomo', CAPO));
    negata('altro operaio', await crea('autonomo', OPERAIO_ALTRO));
    negata('dual altrui', await crea('squadraAltrui', DUAL));
  });

  it('nega manager di un altro tenant, lavoro inesistente e non autenticato', async () => {
    negata('manager altro tenant', await crea('squadra', MANAGER_ALTRO));
    negata('lavoro inesistente', await crea('lavoro-che-non-c-e', CAPO));
    negata('anonimo', await crea('squadra', null));
  });
});

describe('zoneLavorate: update', () => {
  it('operaio proprietario su zona vecchia di squadra e sul proprio autonomo', async () => {
    consentita('ahmed', await aggiorna('squadra', zoneSeed.ahmed, OPERAIO, { note: 'aggiornata' }));
    consentita('autonomo', await aggiorna('autonomo', zoneSeed.opAutonomo, OPERAIO, { note: 'aggiornata' }));
  });

  it('capo proprietario e capo del lavoro padre', async () => {
    consentita('capo proprietario', await aggiorna('squadra', zoneSeed.capoProprio, CAPO, { note: 'sua' }));
    consentita(
      'capo su zona operaio',
      await aggiorna('squadra', zoneSeed.ahmed, CAPO, { note: 'dal capo' })
    );
    consentita(
      'capo su zona senza proprietario',
      await aggiorna('squadra', zoneSeed.senzaProprietario, CAPO, { note: 'dal capo' })
    );
  });

  it('manager, admin e riscrittura dello stesso operaioId', async () => {
    consentita('manager', await aggiorna('squadra', zoneSeed.ahmed, MANAGER, { note: 'manager' }));
    consentita('admin', await aggiorna('squadra', zoneSeed.ahmed, ADMIN, { note: 'admin' }));
    consentita(
      'stesso operaioId',
      await aggiorna('autonomo', zoneSeed.stessoOperaio, OPERAIO, {
        operaioId: OPERAIO,
        note: 'stessa proprieta',
      })
    );
  });

  it('nega altro operaio, operaio sulla zona del capo, altro capo, capo su autonomo', async () => {
    negata('altro operaio', await aggiorna('autonomo', zoneSeed.zonaAutonomo, OPERAIO_ALTRO, { note: 'no' }));
    negata('operaio su zona capo', await aggiorna('squadra', zoneSeed.zonaCapo, OPERAIO, { note: 'no' }));
    negata('altro capo', await aggiorna('squadra', zoneSeed.zonaCapo, CAPO_ALTRO, { note: 'no' }));
    negata('capo su autonomo', await aggiorna('autonomo', zoneSeed.zonaAutonomo, CAPO, { note: 'no' }));
  });

  it('nega dual su squadra altrui, manager di un altro tenant e non autenticato', async () => {
    negata('dual altrui', await aggiorna('squadraAltrui', zoneSeed.dualAltrui, DUAL, { note: 'no' }));
    negata('manager altro', await aggiorna('squadra', zoneSeed.ahmed, MANAGER_ALTRO, { note: 'no' }));
    negata('anonimo', await aggiorna('squadra', zoneSeed.ahmed, null, { note: 'no' }));
  });

  it('operaioId e caposquadraId della zona non cambiano', async () => {
    negata(
      'cambia operaioId',
      await aggiorna('autonomo', zoneSeed.cambiaOperaio, OPERAIO, { operaioId: OPERAIO_ALTRO, note: 'no' })
    );
    negata(
      'aggiunge caposquadraId',
      await aggiorna('squadra', zoneSeed.aggiungeCapo, OPERAIO, { caposquadraId: CAPO, note: 'no' })
    );
    negata(
      'manager cambia caposquadraId',
      await aggiorna('squadra', zoneSeed.managerCambiaCapo, MANAGER, { caposquadraId: CAPO_ALTRO })
    );
    negata(
      'proprietario toglie operaioId',
      await aggiorna('autonomo', zoneSeed.toglieOperaio, OPERAIO, { operaioId: null, note: 'tolto' })
    );
  });
});

describe('zoneLavorate: letture e delete invariati', () => {
  it('list e get delle zone vecchie', async () => {
    consentita('get', await richiesta('GET', `tenants/${TENANT}/lavori/squadra/zoneLavorate/${zoneSeed.lista}`, { auth: OPERAIO_ALTRO }));
    consentita('list', await listaZone('squadra', OPERAIO_ALTRO));
  });

  it('delete del proprietario sì, di un altro no, del manager sì', async () => {
    consentita(
      'delete proprio',
      await richiesta('DELETE', `tenants/${TENANT}/lavori/autonomo/zoneLavorate/${zoneSeed.deleteProprio}`, { auth: OPERAIO })
    );
    negata(
      'delete altro',
      await richiesta('DELETE', `tenants/${TENANT}/lavori/autonomo/zoneLavorate/${zoneSeed.deleteAltro}`, { auth: OPERAIO_ALTRO })
    );
    consentita(
      'delete manager',
      await richiesta('DELETE', `tenants/${TENANT}/lavori/autonomo/zoneLavorate/${zoneSeed.deleteManager}`, { auth: MANAGER })
    );
  });
});

describe('zoneLavorate: sostituto', () => {
  it('lista e get delle zone del titolare sull’autonomo', async () => {
    consentita('list', await listaZone('sostAutonomo', SOST));
    consentita(
      'get',
      await richiesta('GET', `tenants/${TENANT}/lavori/sostAutonomo/zoneLavorate/${zoneSeed.titolare}`, { auth: SOST })
    );
  });

  it('create sull’autonomo dove è sostituto', async () => {
    consentita('sostituto autonomo', await crea('sostAutonomo', SOST));
  });

  it('create negata su squadra, dove non è sostituto, a un operaio qualsiasi e senza ruolo operaio', async () => {
    negata('squadra', await crea('sostSquadra', SOST));
    negata('non sostituto', await crea('autonomo', SOST));
    negata('operaio qualsiasi', await crea('sostAutonomo', OPERAIO_ALTRO));
    negata('senza ruolo', await crea('sostAutonomo', SOST_SENZA));
  });

  it('aggiorna la propria zona e non quella del titolare né quella del capo', async () => {
    consentita('propria', await aggiorna('sostAutonomo', zoneSeed.sostPropria, SOST, { note: 'mia' }));
    negata('titolare', await aggiorna('sostAutonomo', zoneSeed.titolare, SOST, { note: 'no' }));
    negata('capo squadra', await aggiorna('sostSquadra', zoneSeed.capoSquadraSost, SOST, { note: 'no' }));
    negata(
      'operaio sulla zona del sostituto',
      await aggiorna('sostAutonomo', zoneSeed.altroSuSost, OPERAIO_ALTRO, { note: 'no' })
    );
  });

  it('la proprietà non si sposta nei due versi', async () => {
    negata(
      'intestare al titolare',
      await aggiorna('sostAutonomo', zoneSeed.intestare, SOST, { operaioId: OPERAIO })
    );
    negata(
      'prendersi la zona del titolare',
      await aggiorna('sostAutonomo', zoneSeed.prendersi, SOST, { operaioId: SOST, note: 'mia' })
    );
  });
});

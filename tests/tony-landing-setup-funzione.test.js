/**
 * @vitest-environment node
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUBSCRIPTION_PLANS } from '../core/config/subscription-plans.js';

const require = createRequire(import.meta.url);
const {
  handleTonyLandingSetup,
  LIMITE_TERRENI_FREE,
  LIMITE_CHIAMATE_ORA,
  LIMITE_CHIAMATE_GIORNO,
  ORE_SCADENZA_CONTATORE,
  chiaviContatore,
  prossimoContatore,
  tenantDalDocumentoUtente,
  contaTerreniAziendali
} = require('../functions/tony-landing-setup.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UID = 'titolare1';
const TENANT = 'az_titolare1';
const REQUEST_ID = 'setup-faenza-casetti-01';

const ESEMPIO = {
  requestId: REQUEST_ID,
  sede: {
    indirizzo: 'Via Emilia Ponente 10',
    citta: 'Faenza',
    cap: '48018',
    provincia: 'RA'
  },
  poderi: [{ nome: 'Casetti' }],
  terreni: [
    { nome: 'Campo grande', superficie: 2.34, coltura: 'Grano', podere: 'Casetti' },
    { nome: 'Meleto', superficie: 1.2, coltura: 'Melo', podere: null }
  ]
};

/** Dati aziendali che non devono mai comparire in risposta o details. */
const VALORI_DATI_AZIENDA = [
  'Via Emilia Ponente 10',
  'Faenza',
  '48018',
  'Casetti',
  'Campo grande',
  'Meleto',
  'Grano',
  'Melo',
  '2.34',
  '1.2'
];

function seedBase(extra) {
  return Object.assign(
    {
      ['users/' + UID]: {
        tenantId: TENANT,
        ruoli: ['amministratore'],
        tenantMemberships: {
          [TENANT]: {
            ruoli: ['amministratore'],
            stato: 'attivo',
            tenantIdPredefinito: true
          }
        },
        stato: 'attivo'
      },
      ['tenants/' + TENANT]: {
        nome: 'Azienda Prova',
        creatoDa: UID,
        piano: 'free',
        stato: 'attivo'
      }
    },
    extra || {}
  );
}

/**
 * Finto Firestore in memoria: documenti in Map, transazioni con scritture differite.
 */
function fakeDb(seed, opzioni) {
  const docs = new Map(Object.entries(seed || {}));
  let autoId = 0;
  const failOnWriteN = opzioni && opzioni.failOnWriteN != null ? opzioni.failOnWriteN : null;
  let writeCount = 0;

  function isCollectionPath(p) {
    return (p.split('/').length % 2) === 1;
  }

  function childrenOf(colPath) {
    const prefix = colPath + '/';
    const rows = [];
    docs.forEach((data, p) => {
      if (!p.startsWith(prefix)) return;
      const resto = p.slice(prefix.length);
      if (resto.includes('/')) return;
      rows.push({
        id: resto,
        exists: true,
        ref: makeDoc(p),
        data: () => structuredClone(data)
      });
    });
    return rows;
  }

  function makeDoc(fullPath) {
    return {
      path: fullPath,
      id: fullPath.split('/').pop(),
      parent: { path: fullPath.split('/').slice(0, -1).join('/') },
      collection(name) {
        return makeCol(fullPath + '/' + name);
      },
      async get() {
        if (!docs.has(fullPath)) return { exists: false, data: () => undefined, id: fullPath.split('/').pop(), ref: makeDoc(fullPath) };
        return {
          exists: true,
          id: fullPath.split('/').pop(),
          ref: makeDoc(fullPath),
          data: () => structuredClone(docs.get(fullPath))
        };
      }
    };
  }

  function makeCol(colPath) {
    return {
      path: colPath,
      _isCollection: true,
      doc(id) {
        if (id == null || id === '') {
          autoId += 1;
          id = 'auto_' + String(autoId).padStart(4, '0');
        }
        return makeDoc(colPath + '/' + id);
      },
      async get() {
        const rows = childrenOf(colPath);
        return {
          docs: rows,
          empty: rows.length === 0,
          size: rows.length,
          forEach(fn) {
            rows.forEach(fn);
          }
        };
      }
    };
  }

  function applyWrites(pending) {
    // Conta e fallisce prima di applicare: come Firestore, tutto o niente nella transazione.
    for (let i = 0; i < pending.length; i++) {
      writeCount += 1;
      if (failOnWriteN != null && writeCount === failOnWriteN) {
        const err = new Error('scrittura simulata fallita');
        err.code = 'simulated-write-fail';
        throw err;
      }
    }
    for (const w of pending) {
      if (w.op === 'set') {
        if (w.merge) {
          const prev = docs.has(w.path) ? docs.get(w.path) : {};
          docs.set(w.path, Object.assign({}, prev, structuredClone(w.data)));
        } else {
          docs.set(w.path, structuredClone(w.data));
        }
      } else if (w.op === 'update') {
        if (!docs.has(w.path)) {
          const err = new Error('not-found');
          err.code = 5;
          throw err;
        }
        docs.set(w.path, Object.assign({}, docs.get(w.path), structuredClone(w.data)));
      } else if (w.op === 'create') {
        if (docs.has(w.path)) {
          const err = new Error('already-exists');
          err.code = 6;
          throw err;
        }
        docs.set(w.path, structuredClone(w.data));
      }
    }
  }

  return {
    docs,
    collection(name) {
      return makeCol(name);
    },
    async runTransaction(fn) {
      const pending = [];
      const tx = {
        async get(ref) {
          if (ref && ref._isCollection) {
            const rows = childrenOf(ref.path);
            return {
              docs: rows,
              empty: rows.length === 0,
              size: rows.length,
              forEach(cb) {
                rows.forEach(cb);
              }
            };
          }
          const p = ref.path;
          if (!docs.has(p)) {
            return { exists: false, data: () => undefined, id: p.split('/').pop(), ref };
          }
          return {
            exists: true,
            id: p.split('/').pop(),
            ref,
            data: () => structuredClone(docs.get(p))
          };
        },
        set(ref, data, opts) {
          pending.push({
            op: 'set',
            path: ref.path,
            data,
            merge: !!(opts && opts.merge)
          });
        },
        update(ref, data) {
          pending.push({ op: 'update', path: ref.path, data });
        },
        create(ref, data) {
          pending.push({ op: 'create', path: ref.path, data });
        }
      };
      const risultato = await fn(tx);
      applyWrites(pending);
      return risultato;
    }
  };
}

function fotografia(db) {
  const out = new Map();
  db.docs.forEach((v, k) => {
    if (k.startsWith('tonyLandingSetupQuota/')) return;
    out.set(k, structuredClone(v));
  });
  return out;
}

function mapUguale(a, b) {
  expect([...a.keys()].sort()).toEqual([...b.keys()].sort());
  a.forEach((v, k) => {
    expect(b.get(k)).toEqual(v);
  });
}

function richiesta(authUid, data) {
  const req = { data: data == null ? structuredClone(ESEMPIO) : data };
  if (authUid !== null) {
    req.auth = authUid === undefined ? { uid: UID } : { uid: authUid };
  }
  return req;
}

function adessoFisso(iso) {
  const d = new Date(iso);
  return () => new Date(d.getTime());
}

function docsCol(db, colPath) {
  const prefix = colPath + '/';
  const rows = [];
  db.docs.forEach((data, p) => {
    if (p.startsWith(prefix) && !p.slice(prefix.length).includes('/')) {
      rows.push({ path: p, data });
    }
  });
  return rows;
}

function assertNienteSensibile(oggetto) {
  const json = JSON.stringify(oggetto);
  for (const v of VALORI_DATI_AZIENDA) {
    expect(json.includes(String(v))).toBe(false);
  }
}

describe('tonyLandingSetup funzione — limite allineato e pulizia codice', () => {
  it('LIMITE_TERRENI_FREE coincide con SUBSCRIPTION_PLANS.free.maxTerreni', () => {
    expect(LIMITE_TERRENI_FREE).toBe(SUBSCRIPTION_PLANS.free.maxTerreni);
  });

  it('il modulo non importa Sentry né moduli Tony/Gemini', () => {
    const testo = fs
      .readFileSync(path.join(root, 'functions', 'tony-landing-setup.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(testo).not.toMatch(/@sentry|Sentry\.|resolveTenantIdForTony|tony-gemini|GEMINI|ELEVENLABS/);
    const dataHits = testo.match(/request\.data/g) || [];
    expect(dataHits.length).toBe(1);
    const requires = [...testo.matchAll(/require\(([^)]+)\)/g)].map((m) => m[1].replace(/['"]/g, ''));
    expect(requires.sort()).toEqual(
      [
        'firebase-admin',
        'firebase-admin/firestore',
        'firebase-functions/v2/https',
        './lib/tony-landing-setup-core',
        './lib/tenant-membership-access',
        './tenant-plan'
      ].sort()
    );
  });
});

describe('(1) Caso felice', () => {
  it('salva sede, podere e due terreni con i campi dell\'app', async () => {
    const db = fakeDb(seedBase());
    const res = await handleTonyLandingSetup(richiesta(), { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') });
    expect(res).toEqual({
      ok: true,
      requestId: REQUEST_ID,
      giaSalvato: false,
      sedeAggiornata: true,
      poderiCreati: 1,
      poderiGiaPresenti: 0,
      terreniCreati: 2
    });
    assertNienteSensibile(res);

    const tenant = db.docs.get('tenants/' + TENANT);
    expect(tenant.indirizzo).toBe('Via Emilia Ponente 10');
    expect(tenant.citta).toBe('Faenza');
    expect(tenant.cap).toBe('48018');
    expect(tenant.provincia).toBe('RA');
    expect(tenant.aggiornatoIl).toBeTruthy();
    expect(tenant.nome).toBe('Azienda Prova');
    expect(tenant.piano).toBe('free');
    expect(tenant.creatoDa).toBe(UID);
    expect(tenant.stato).toBe('attivo');

    const poderi = docsCol(db, 'tenants/' + TENANT + '/poderi');
    expect(poderi).toHaveLength(1);
    expect(Object.keys(poderi[0].data).sort()).toEqual(
      ['aggiornatoIl', 'coordinate', 'creatoIl', 'indirizzo', 'nome', 'note'].sort()
    );
    expect(poderi[0].data.nome).toBe('Casetti');
    expect(poderi[0].data.indirizzo).toBeNull();
    expect(poderi[0].data.note).toBeNull();
    expect(poderi[0].data.coordinate).toBeNull();

    const terreni = docsCol(db, 'tenants/' + TENANT + '/terreni');
    expect(terreni).toHaveLength(2);
    const grande = terreni.find((t) => t.data.nome === 'Campo grande');
    const meleto = terreni.find((t) => t.data.nome === 'Meleto');
    expect(Object.keys(grande.data).sort()).toEqual(
      [
        'coltura',
        'colturaCategoria',
        'createdAt',
        'nome',
        'podere',
        'superficie',
        'tipoPossesso',
        'updatedAt'
      ].sort()
    );
    expect(grande.data.superficie).toBe(2.34);
    expect(grande.data.coltura).toBe('Grano');
    expect(grande.data.colturaCategoria).toBe('seminativo');
    expect(grande.data.podere).toBe('Casetti');
    expect(grande.data.tipoPossesso).toBe('proprieta');
    expect(Object.keys(meleto.data).sort()).toEqual(
      [
        'coltura',
        'colturaCategoria',
        'createdAt',
        'nome',
        'superficie',
        'tipoPossesso',
        'updatedAt'
      ].sort()
    );
    expect(meleto.data.colturaCategoria).toBe('frutteto');
    expect(meleto.data.podere).toBeUndefined();

    const esito = db.docs.get('tenants/' + TENANT + '/tonyLandingSetup/esito');
    expect(Object.keys(esito).sort()).toEqual(
      [
        'completatoIl',
        'poderiCreati',
        'poderiGiaPresenti',
        'requestId',
        'sedeAggiornata',
        'terreniCreati',
        'uid'
      ].sort()
    );
    expect(esito.requestId).toBe(REQUEST_ID);
    expect(esito.uid).toBe(UID);
    expect(esito.sedeAggiornata).toBe(true);
    expect(esito.poderiCreati).toBe(1);
    expect(esito.poderiGiaPresenti).toBe(0);
    expect(esito.terreniCreati).toBe(2);
  });
});

describe('(3) Sesto terreno per somma', () => {
  it('rifiuta 3+3 sul Free e non scrive niente', async () => {
    const extra = {};
    for (let i = 1; i <= 3; i++) {
      extra['tenants/' + TENANT + '/terreni/t' + i] = { nome: 'Esistente ' + i, superficie: 1 };
    }
    const db = fakeDb(seedBase(extra));
    const prima = fotografia(db);
    const data = structuredClone(ESEMPIO);
    data.requestId = 'req-limite-3';
    data.terreni = [
      { nome: 'Nuovo A', superficie: 1, coltura: 'Grano' },
      { nome: 'Nuovo B', superficie: 1, coltura: 'Grano' },
      { nome: 'Nuovo C', superficie: 1, coltura: 'Grano' }
    ];
    await expect(handleTonyLandingSetup(richiesta(UID, data), { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') }))
      .rejects.toMatchObject({
        code: 'failed-precondition',
        details: { motivo: 'limite-terreni', limite: 5, esistenti: 3, richiesti: 3 }
      });
    mapUguale(fotografia(db), prima);
  });
});

describe('(3b) Solo sede con 5 terreni già presenti', () => {
  it('passa con terreniCreati 0', async () => {
    const extra = {};
    for (let i = 1; i <= 5; i++) {
      extra['tenants/' + TENANT + '/terreni/t' + i] = { nome: 'Esistente ' + i, superficie: 1 };
    }
    const db = fakeDb(seedBase(extra));
    const res = await handleTonyLandingSetup(
      richiesta(UID, {
        requestId: 'req-solo-sede',
        sede: { indirizzo: 'Via Roma 1', citta: 'Faenza', cap: '48018', provincia: 'RA' },
        poderi: [],
        terreni: []
      }),
      { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') }
    );
    expect(res.ok).toBe(true);
    expect(res.terreniCreati).toBe(0);
    expect(res.sedeAggiornata).toBe(true);
    expect(docsCol(db, 'tenants/' + TENANT + '/terreni')).toHaveLength(5);
  });
});

describe('(4) Conto terzi', () => {
  it('i terreni con clienteId non contano nel limite Free', async () => {
    const extra = {};
    for (let i = 1; i <= 4; i++) {
      extra['tenants/' + TENANT + '/terreni/ct' + i] = {
        nome: 'CT ' + i,
        superficie: 1,
        clienteId: 'cli1'
      };
    }
    const db = fakeDb(seedBase(extra));
    const data = structuredClone(ESEMPIO);
    data.requestId = 'req-ct-5';
    data.terreni = [
      { nome: 'A1', superficie: 1, coltura: 'Grano' },
      { nome: 'A2', superficie: 1, coltura: 'Grano' },
      { nome: 'A3', superficie: 1, coltura: 'Grano' },
      { nome: 'A4', superficie: 1, coltura: 'Grano' },
      { nome: 'A5', superficie: 1, coltura: 'Grano' }
    ];
    data.poderi = [];
    const res = await handleTonyLandingSetup(richiesta(UID, data), {
      db,
      adesso: adessoFisso('2026-11-03T10:00:00.000Z')
    });
    expect(res.ok).toBe(true);
    expect(res.terreniCreati).toBe(5);

    const db2 = fakeDb(
      seedBase({
        ['tenants/' + TENANT + '/terreni/vuoto']: { nome: 'Vuoto', superficie: 1, clienteId: '' }
      })
    );
    expect(contaTerreniAziendali([{ data: () => ({ clienteId: '' }) }])).toBe(1);
    expect(contaTerreniAziendali([{ data: () => ({ clienteId: 'x' }) }])).toBe(0);
    await expect(
      handleTonyLandingSetup(
        richiesta(UID, {
          requestId: 'req-vuoto-cliente',
          sede: null,
          poderi: [],
          terreni: [
            { nome: 'N1', superficie: 1, coltura: 'Grano' },
            { nome: 'N2', superficie: 1, coltura: 'Grano' },
            { nome: 'N3', superficie: 1, coltura: 'Grano' },
            { nome: 'N4', superficie: 1, coltura: 'Grano' },
            { nome: 'N5', superficie: 1, coltura: 'Grano' }
          ]
        }),
        { db: db2, adesso: adessoFisso('2026-11-03T11:00:00.000Z') }
      )
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      details: { motivo: 'limite-terreni', esistenti: 1, richiesti: 5 }
    });
  });
});

describe('(5) Base', () => {
  it('nessun limite con plan base o Stripe attivo', async () => {
    const extra = { ['tenants/' + TENANT]: { nome: 'Azienda Prova', creatoDa: UID, plan: 'base', stato: 'attivo' } };
    for (let i = 1; i <= 7; i++) {
      extra['tenants/' + TENANT + '/terreni/t' + i] = { nome: 'T' + i, superficie: 1 };
    }
    const db = fakeDb(seedBase(extra));
    const data = {
      requestId: 'req-base-3',
      sede: null,
      poderi: [],
      terreni: [
        { nome: 'Nuovo1', superficie: 1, coltura: 'Grano' },
        { nome: 'Nuovo2', superficie: 1, coltura: 'Grano' },
        { nome: 'Nuovo3', superficie: 1, coltura: 'Grano' }
      ]
    };
    const res = await handleTonyLandingSetup(richiesta(UID, data), {
      db,
      adesso: adessoFisso('2026-11-03T10:00:00.000Z')
    });
    expect(res.ok).toBe(true);
    expect(res.terreniCreati).toBe(3);

    const stripeExtra = {
      ['tenants/' + TENANT]: {
        nome: 'Azienda Prova',
        creatoDa: UID,
        piano: 'free',
        stripeSubscriptionId: 'sub_x',
        status: 'active',
        stato: 'attivo'
      }
    };
    for (let i = 1; i <= 7; i++) {
      stripeExtra['tenants/' + TENANT + '/terreni/s' + i] = { nome: 'EsistenteS' + i, superficie: 1 };
    }
    const dbStripe = fakeDb(seedBase(stripeExtra));
    const res2 = await handleTonyLandingSetup(
      richiesta(UID, {
        requestId: 'req-stripe-base',
        sede: null,
        poderi: [],
        terreni: [
          { nome: 'S1', superficie: 1, coltura: 'Grano' },
          { nome: 'S2', superficie: 1, coltura: 'Grano' },
          { nome: 'S3', superficie: 1, coltura: 'Grano' }
        ]
      }),
      { db: dbStripe, adesso: adessoFisso('2026-11-03T12:00:00.000Z') }
    );
    expect(res2.ok).toBe(true);
    expect(res2.terreniCreati).toBe(3);
  });
});

describe('(6) Doppio clic', () => {
  it('seconda chiamata stesso requestId → giaSalvato true', async () => {
    const db = fakeDb(seedBase());
    const opts = { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') };
    const r1 = await handleTonyLandingSetup(richiesta(), opts);
    expect(r1.giaSalvato).toBe(false);
    const r2 = await handleTonyLandingSetup(richiesta(), opts);
    expect(r2).toEqual({
      ok: true,
      requestId: REQUEST_ID,
      giaSalvato: true,
      sedeAggiornata: true,
      poderiCreati: 1,
      poderiGiaPresenti: 0,
      terreniCreati: 2
    });
    expect(docsCol(db, 'tenants/' + TENANT + '/terreni')).toHaveLength(2);

    const diversa = structuredClone(ESEMPIO);
    diversa.sede.citta = 'Ravenna';
    const r3 = await handleTonyLandingSetup(richiesta(UID, diversa), opts);
    expect(r3.giaSalvato).toBe(true);
    expect(db.docs.get('tenants/' + TENANT).citta).toBe('Faenza');
  });
});

describe('(8) Altro requestId dopo setup', () => {
  it('already-exists / gia-preparato senza scrivere', async () => {
    const db = fakeDb(seedBase());
    await handleTonyLandingSetup(richiesta(), { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') });
    const prima = fotografia(db);
    await expect(
      handleTonyLandingSetup(
        richiesta(UID, Object.assign(structuredClone(ESEMPIO), { requestId: 'altro-request-99' })),
        { db, adesso: adessoFisso('2026-11-03T10:05:00.000Z') }
      )
    ).rejects.toMatchObject({
      code: 'already-exists',
      details: { motivo: 'gia-preparato' }
    });
    mapUguale(fotografia(db), prima);
  });
});

describe('(9) Nessun utente collegato', () => {
  it('unauthenticated e nessun contatore', async () => {
    const db = fakeDb(seedBase());
    await expect(handleTonyLandingSetup({ data: ESEMPIO }, { db })).rejects.toMatchObject({
      code: 'unauthenticated'
    });
    await expect(handleTonyLandingSetup({ auth: {}, data: ESEMPIO }, { db })).rejects.toMatchObject({
      code: 'unauthenticated'
    });
    expect([...db.docs.keys()].filter((k) => k.startsWith('tonyLandingSetupQuota/'))).toEqual([]);
  });
});

describe('(10) Utente senza azienda', () => {
  it('permission-denied / senza-azienda in vari casi', async () => {
    const casi = [
      fakeDb({ ['tenants/' + TENANT]: { nome: 'X', creatoDa: UID, piano: 'free', stato: 'attivo' } }),
      fakeDb(seedBase({ ['users/' + UID]: { stato: 'attivo', ruoli: ['amministratore'] } })),
      fakeDb(seedBase({ ['users/' + UID]: { tenantId: 'inesistente', ruoli: ['amministratore'], stato: 'attivo' } })),
      fakeDb(
        seedBase({
          ['tenants/' + TENANT]: { nome: 'X', creatoDa: UID, piano: 'free', stato: 'sospeso' }
        })
      )
    ];
    for (const db of casi) {
      const prima = fotografia(db);
      await expect(
        handleTonyLandingSetup(richiesta(), { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') })
      ).rejects.toMatchObject({
        code: 'permission-denied',
        details: { motivo: 'senza-azienda' }
      });
      mapUguale(fotografia(db), prima);
    }
  });
});

describe('(10b) Tenant dalla membership', () => {
  it('usa tenantIdPredefinito senza campo tenantId', async () => {
    const db = fakeDb(
      seedBase({
        ['users/' + UID]: {
          ruoli: ['amministratore'],
          tenantMemberships: {
            [TENANT]: { ruoli: ['amministratore'], stato: 'attivo', tenantIdPredefinito: true }
          },
          stato: 'attivo'
        }
      })
    );
    expect(tenantDalDocumentoUtente(db.docs.get('users/' + UID))).toBe(TENANT);
    const res = await handleTonyLandingSetup(richiesta(), {
      db,
      adesso: adessoFisso('2026-11-03T10:00:00.000Z')
    });
    expect(res.ok).toBe(true);
    expect(db.docs.has('tenants/' + TENANT + '/tonyLandingSetup/esito')).toBe(true);
  });
});

describe('(11) Tenant di un altro', () => {
  it('non-autorizzato se creatoDa diverso o ruolo non admin', async () => {
    const db = fakeDb(
      seedBase({
        ['users/' + UID]: {
          tenantId: 'az_altro',
          ruoli: ['amministratore'],
          tenantMemberships: {
            az_altro: { ruoli: ['amministratore'], stato: 'attivo', tenantIdPredefinito: true }
          },
          stato: 'attivo'
        },
        'tenants/az_altro': { nome: 'Altro', creatoDa: 'altro', piano: 'free', stato: 'attivo' }
      })
    );
    const prima = fotografia(db);
    await expect(
      handleTonyLandingSetup(richiesta(), { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') })
    ).rejects.toMatchObject({
      code: 'permission-denied',
      details: { motivo: 'non-autorizzato' }
    });
    mapUguale(fotografia(db), prima);

    const dbMgr = fakeDb(
      seedBase({
        ['users/' + UID]: {
          tenantId: TENANT,
          ruoli: ['manager'],
          tenantMemberships: {
            [TENANT]: { ruoli: ['manager'], stato: 'attivo', tenantIdPredefinito: true }
          },
          stato: 'attivo'
        }
      })
    );
    const primaMgr = fotografia(dbMgr);
    await expect(
      handleTonyLandingSetup(richiesta(), { db: dbMgr, adesso: adessoFisso('2026-11-03T10:00:00.000Z') })
    ).rejects.toMatchObject({
      code: 'permission-denied',
      details: { motivo: 'non-autorizzato' }
    });
    mapUguale(fotografia(dbMgr), primaMgr);
  });
});

describe('(12) tenantId dal browser', () => {
  it('invalid-argument e niente scritto', async () => {
    const db = fakeDb(
      seedBase({
        'tenants/az_altro': { nome: 'Altro', creatoDa: 'altro', piano: 'free', stato: 'attivo' }
      })
    );
    const prima = fotografia(db);
    const data = Object.assign(structuredClone(ESEMPIO), { tenantId: 'az_altro' });
    const err = await handleTonyLandingSetup(richiesta(UID, data), {
      db,
      adesso: adessoFisso('2026-11-03T10:00:00.000Z')
    }).catch((e) => e);
    expect(err.code).toBe('invalid-argument');
    expect(err.details.motivo).toBe('dati-non-validi');
    expect(err.details.campi.some((c) => c.campo === 'tenantId')).toBe(true);
    mapUguale(fotografia(db), prima);
  });
});

describe('(13) Campi in più', () => {
  it('rifiuta piva e polygonCoords', async () => {
    const db = fakeDb(seedBase());
    const prima = fotografia(db);
    const data = structuredClone(ESEMPIO);
    data.sede.piva = '123';
    data.terreni[0].polygonCoords = [[0, 0]];
    await expect(
      handleTonyLandingSetup(richiesta(UID, data), { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') })
    ).rejects.toMatchObject({ code: 'invalid-argument', details: { motivo: 'dati-non-validi' } });
    mapUguale(fotografia(db), prima);
  });
});

describe('(14) Superficie', () => {
  it('arrotonda 2.345 → 2.35 e rifiuta 0', async () => {
    const db = fakeDb(seedBase());
    const res = await handleTonyLandingSetup(
      richiesta(UID, {
        requestId: 'req-surf-ok',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Arrot', superficie: 2.345, coltura: 'Grano' }]
      }),
      { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') }
    );
    expect(res.ok).toBe(true);
    const t = docsCol(db, 'tenants/' + TENANT + '/terreni')[0];
    expect(t.data.superficie).toBe(2.35);

    await expect(
      handleTonyLandingSetup(
        richiesta(UID, {
          requestId: 'req-surf-0',
          sede: null,
          poderi: [],
          terreni: [{ nome: 'Zero', superficie: 0, coltura: 'Grano' }]
        }),
        { db: fakeDb(seedBase()), adesso: adessoFisso('2026-11-03T10:00:00.000Z') }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('(15) Coltura', () => {
  it('normalizza, rifiuta categorie, omette null, accetta personalizzate', async () => {
    const db = fakeDb(seedBase());
    await handleTonyLandingSetup(
      richiesta(UID, {
        requestId: 'req-colt-melo',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'M1', superficie: 1, coltura: 'melo' }]
      }),
      { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') }
    );
    expect(docsCol(db, 'tenants/' + TENANT + '/terreni')[0].data.coltura).toBe('Melo');

    await expect(
      handleTonyLandingSetup(
        richiesta(UID, {
          requestId: 'req-seminativo',
          sede: null,
          poderi: [],
          terreni: [{ nome: 'S1', superficie: 1, coltura: 'seminativo' }]
        }),
        { db: fakeDb(seedBase()), adesso: adessoFisso('2026-11-03T10:00:00.000Z') }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    const dbNull = fakeDb(seedBase());
    await handleTonyLandingSetup(
      richiesta(UID, {
        requestId: 'req-colt-null',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'N1', superficie: 1, coltura: null }]
      }),
      { db: dbNull, adesso: adessoFisso('2026-11-03T10:00:00.000Z') }
    );
    expect(docsCol(dbNull, 'tenants/' + TENANT + '/terreni')[0].data.coltura).toBeUndefined();

    const dbAz = fakeDb(
      seedBase({
        ['tenants/' + TENANT + '/colture/c1']: { nome: 'Sangiovese' }
      })
    );
    await handleTonyLandingSetup(
      richiesta(UID, {
        requestId: 'req-sangiovese',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Vigna', superficie: 1, coltura: 'Sangiovese' }]
      }),
      { db: dbAz, adesso: adessoFisso('2026-11-03T10:00:00.000Z') }
    );
    expect(docsCol(dbAz, 'tenants/' + TENANT + '/terreni')[0].data.coltura).toBe('Sangiovese');
  });
});

describe('(16) Podere', () => {
  it('rifiuta podere sconosciuto e riusa il nome esatto in azienda', async () => {
    await expect(
      handleTonyLandingSetup(
        richiesta(UID, {
          requestId: 'req-pod-manca',
          sede: null,
          poderi: [],
          terreni: [{ nome: 'X', superficie: 1, coltura: 'Grano', podere: 'Casetti' }]
        }),
        { db: fakeDb(seedBase()), adesso: adessoFisso('2026-11-03T10:00:00.000Z') }
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    const db = fakeDb(
      seedBase({
        ['tenants/' + TENANT + '/poderi/p1']: { nome: 'casetti ' }
      })
    );
    const res = await handleTonyLandingSetup(
      richiesta(UID, {
        requestId: 'req-pod-match',
        sede: null,
        poderi: [{ nome: 'Casetti' }],
        terreni: [{ nome: 'Campo', superficie: 1, coltura: 'Grano', podere: 'Casetti' }]
      }),
      { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') }
    );
    expect(res.poderiCreati).toBe(0);
    expect(res.poderiGiaPresenti).toBe(1);
    expect(docsCol(db, 'tenants/' + TENANT + '/poderi')).toHaveLength(1);
    expect(docsCol(db, 'tenants/' + TENANT + '/terreni')[0].data.podere).toBe('casetti ');
  });
});

describe('(18) Nome già in azienda', () => {
  it('invalid-argument senza scrivere', async () => {
    const db = fakeDb(
      seedBase({
        ['tenants/' + TENANT + '/terreni/t1']: { nome: 'Campo grande', superficie: 1 }
      })
    );
    const prima = fotografia(db);
    await expect(
      handleTonyLandingSetup(richiesta(), { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    mapUguale(fotografia(db), prima);
  });
});

describe('(19) Niente da salvare', () => {
  it('invalid-argument / niente-da-salvare ma il contatore sale', async () => {
    const db = fakeDb(seedBase());
    const adesso = adessoFisso('2026-11-03T10:00:00.000Z');
    await expect(
      handleTonyLandingSetup(
        richiesta(UID, { requestId: 'req-vuoto-1234', sede: null, poderi: [], terreni: [] }),
        { db, adesso }
      )
    ).rejects.toMatchObject({
      code: 'invalid-argument',
      details: { motivo: 'niente-da-salvare' }
    });
    const chiavi = chiaviContatore(adesso());
    const quota = db.docs.get('tonyLandingSetupQuota/' + chiavi.giorno + '_' + UID);
    expect(quota.count).toBe(1);
  });
});

describe('(20) Limite chiamate', () => {
  it('prossimoContatore e chiaviContatore puri', () => {
    const k1 = chiaviContatore(new Date('2026-11-03T22:30:00.000Z'));
    expect(k1.giorno).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(k1.ora).toBe(k1.giorno + 'T' + k1.ora.slice(-2));
    const notte = chiaviContatore(new Date('2026-11-03T22:30:00.000Z'));
    expect(notte.ora.endsWith('T23') || notte.ora.endsWith('T22')).toBe(true);

    expect(prossimoContatore(null, { giorno: '2026-11-03', ora: '2026-11-03T10' })).toEqual({
      consentito: true,
      nuovi: { count: 1, oraChiave: '2026-11-03T10', oraCount: 1 }
    });
    expect(
      prossimoContatore(
        { count: 4, oraChiave: '2026-11-03T10', oraCount: 4 },
        { giorno: '2026-11-03', ora: '2026-11-03T10' }
      )
    ).toEqual({
      consentito: true,
      nuovi: { count: 5, oraChiave: '2026-11-03T10', oraCount: 5 }
    });
    expect(
      prossimoContatore(
        { count: 5, oraChiave: '2026-11-03T10', oraCount: 5 },
        { giorno: '2026-11-03', ora: '2026-11-03T10' }
      )
    ).toEqual({ consentito: false });
    expect(
      prossimoContatore(
        { count: 5, oraChiave: '2026-11-03T10', oraCount: 5 },
        { giorno: '2026-11-03', ora: '2026-11-03T11' }
      )
    ).toEqual({
      consentito: true,
      nuovi: { count: 6, oraChiave: '2026-11-03T11', oraCount: 1 }
    });
    expect(
      prossimoContatore(
        { count: 10, oraChiave: '2026-11-03T11', oraCount: 1 },
        { giorno: '2026-11-03', ora: '2026-11-03T11' }
      )
    ).toEqual({ consentito: false });
    expect(LIMITE_CHIAMATE_ORA).toBe(5);
    expect(LIMITE_CHIAMATE_GIORNO).toBe(10);
    expect(ORE_SCADENZA_CONTATORE).toBe(48);
  });

  it('6ª chiamata nella stessa ora → troppe-chiamate; 11ª del giorno dopo cambio ora', async () => {
    const db = fakeDb(seedBase());
    let t = new Date('2026-11-03T10:00:00.000Z');
    const cattiva = {
      requestId: 'bad-xxxx',
      sede: { indirizzo: 'Ab', citta: 'Faenza' },
      poderi: [],
      terreni: []
    };
    for (let i = 0; i < 5; i++) {
      await expect(
        handleTonyLandingSetup(richiesta(UID, cattiva), { db, adesso: () => new Date(t.getTime()) })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    }
    const prima = fotografia(db);
    await expect(
      handleTonyLandingSetup(richiesta(), { db, adesso: () => new Date(t.getTime()) })
    ).rejects.toMatchObject({
      code: 'resource-exhausted',
      details: { motivo: 'troppe-chiamate' }
    });
    mapUguale(fotografia(db), prima);

    const chiavi = chiaviContatore(t);
    const quota = db.docs.get('tonyLandingSetupQuota/' + chiavi.giorno + '_' + UID);
    expect(Object.keys(quota).sort()).toEqual(
      ['aggiornatoIl', 'count', 'expireAt', 'oraChiave', 'oraCount'].sort()
    );
    expect(quota.count).toBe(5);
    expect(quota.oraCount).toBe(5);
    const expireMs = quota.expireAt.toMillis
      ? quota.expireAt.toMillis()
      : quota.expireAt._seconds
        ? quota.expireAt._seconds * 1000
        : Number(quota.expireAt);
    expect(expireMs - t.getTime()).toBe(ORE_SCADENZA_CONTATORE * 3600 * 1000);

    t = new Date(t.getTime() + 3600 * 1000);
    for (let i = 0; i < 5; i++) {
      await expect(
        handleTonyLandingSetup(richiesta(UID, cattiva), { db, adesso: () => new Date(t.getTime()) })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    }
    expect(db.docs.get('tonyLandingSetupQuota/' + chiaviContatore(t).giorno + '_' + UID).count).toBe(10);
    await expect(
      handleTonyLandingSetup(richiesta(), { db, adesso: () => new Date(t.getTime()) })
    ).rejects.toMatchObject({
      code: 'resource-exhausted',
      details: { motivo: 'troppe-chiamate' }
    });
  });
});

describe('(21) Tutto o niente', () => {
  it('fallimento al secondo terreno → internal e database invariato', async () => {
    // scritture: 1=contatore, 2=sede, 3=podere, 4=terreno1, 5=terreno2
    const db = fakeDb(seedBase(), { failOnWriteN: 5 });
    const prima = fotografia(db);
    await expect(
      handleTonyLandingSetup(richiesta(), { db, adesso: adessoFisso('2026-11-03T10:00:00.000Z') })
    ).rejects.toMatchObject({
      code: 'internal',
      message: 'Non è stato salvato niente. Riprova tra poco.'
    });
    mapUguale(fotografia(db), prima);
  });
});

describe('(22) Export con App Check', () => {
  it('index.js espone tonyLandingSetup avvolto con enforceAppCheck', () => {
    const testo = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    expect(testo).toMatch(/require\("\.\/tony-landing-setup"\)/);
    expect(testo).toMatch(/exports\.tonyLandingSetup\s*=\s*onCall\(/);
    const blocco = testo.slice(testo.indexOf('exports.tonyLandingSetup'));
    const fine = blocco.indexOf(';\n\nexports.');
    const corpo = fine >= 0 ? blocco.slice(0, fine) : blocco.slice(0, 500);
    expect(corpo).toMatch(/region:\s*"europe-west1"/);
    expect(corpo).toMatch(/enforceAppCheck:\s*true/);
    expect(corpo).toMatch(/\(request\)\s*=>\s*handleTonyLandingSetup\(request\)/);
  });
});

describe('(23) Log puliti', () => {
  let spie;
  beforeEach(() => {
    spie = ['log', 'info', 'warn', 'error'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
  });
  afterEach(() => {
    spie.forEach((s) => s.mockRestore());
  });

  function righe() {
    return spie.flatMap((s) => s.mock.calls.map((c) => c.map(String).join(' ')));
  }

  it('una sola riga [tonyLandingSetup] senza dati sensibili nei casi 1, 3, 13, 21', async () => {
    const db1 = fakeDb(seedBase());
    await handleTonyLandingSetup(richiesta(), { db: db1, adesso: adessoFisso('2026-11-03T10:00:00.000Z') });

    const extra = {};
    for (let i = 1; i <= 3; i++) extra['tenants/' + TENANT + '/terreni/t' + i] = { nome: 'E' + i, superficie: 1 };
    const db3 = fakeDb(seedBase(extra));
    await handleTonyLandingSetup(
      richiesta(UID, {
        requestId: 'req-log-limite',
        sede: { indirizzo: 'Via Emilia Ponente 10', citta: 'Faenza', cap: '48018', provincia: 'RA' },
        poderi: [],
        terreni: [
          { nome: 'Nuovo A', superficie: 1, coltura: 'Grano' },
          { nome: 'Nuovo B', superficie: 1, coltura: 'Grano' },
          { nome: 'Nuovo C', superficie: 1, coltura: 'Grano' }
        ]
      }),
      { db: db3, adesso: adessoFisso('2026-11-03T10:00:00.000Z') }
    ).catch(() => {});

    const data13 = structuredClone(ESEMPIO);
    data13.requestId = 'req-log-extra';
    data13.sede.piva = 'x';
    await handleTonyLandingSetup(richiesta(UID, data13), {
      db: fakeDb(seedBase()),
      adesso: adessoFisso('2026-11-03T10:00:00.000Z')
    }).catch(() => {});

    await handleTonyLandingSetup(richiesta(), {
      db: fakeDb(seedBase(), { failOnWriteN: 5 }),
      adesso: adessoFisso('2026-11-03T10:00:00.000Z')
    }).catch(() => {});

    const tony = righe().filter((r) => r.includes('[tonyLandingSetup]'));
    expect(tony.length).toBe(4);
    for (const r of tony) {
      expect(r.startsWith('[tonyLandingSetup]')).toBe(true);
      for (const v of [
        'Via Emilia Ponente 10',
        'Faenza',
        '48018',
        'Casetti',
        'Campo grande',
        'Meleto',
        'Grano',
        UID,
        TENANT,
        REQUEST_ID,
        'req-log-limite',
        'req-log-extra'
      ]) {
        expect(r.includes(v)).toBe(false);
      }
    }
  });
});

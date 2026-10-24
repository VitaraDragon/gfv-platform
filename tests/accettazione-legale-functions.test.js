/**
 * @vitest-environment node
 */
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { handleRegistraAccettazioniLegali } = require('../functions/accettazione-legale.js');
const { idAccettazione } = require('../functions/lib/accettazione-legale-core.js');

function documentiAdmin() {
  return [
    { tipo: 'termini-b2b', versione: 'termini-b2b-2026-03-01', versioneTestoCasella: 'casella-registrazione-v1' },
    { tipo: 'privacy', versione: 'privacy-2026-03-01', versioneTestoCasella: 'casella-registrazione-v1' },
    { tipo: 'dpa', versione: 'dpa-2026-03-01', versioneTestoCasella: 'casella-registrazione-v1' }
  ];
}

function fakeDb(seed) {
  const docs = new Map(Object.entries(seed || {}));
  function ref(path) {
    return {
      path,
      async get() {
        if (!docs.has(path)) return { exists: false, data: () => undefined };
        return { exists: true, data: () => docs.get(path) };
      },
      async create(data) {
        if (docs.has(path)) {
          const err = new Error('already exists');
          err.code = 6;
          throw err;
        }
        docs.set(path, Object.assign({}, data));
      }
    };
  }
  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          return ref(name + '/' + id);
        },
        where(field, _op, value) {
          return {
            async get() {
              const rows = [];
              docs.forEach((data, path) => {
                if (path.startsWith(name + '/') && data && data[field] === value) {
                  rows.push({ id: path.split('/').pop(), data: () => data });
                }
              });
              return {
                docs: rows,
                forEach(fn) { rows.forEach(fn); }
              };
            }
          };
        }
      };
    }
  };
}

function baseSeed() {
  return {
    'users/admin1': { ruoli: ['amministratore'], tenantId: 'az1' },
    'tenants/az1': { creatoDa: 'admin1', nome: 'Azienda' }
  };
}

describe('registraAccettazioniLegali', () => {
  it('rifiuta chi non è autenticato', async () => {
    await expect(handleRegistraAccettazioniLegali({ data: {} }, fakeDb())).rejects.toMatchObject({
      code: 'unauthenticated'
    });
  });

  it('rifiuta l\'amministratore che non ha creato il tenant', async () => {
    const db = fakeDb({
      'users/admin1': { ruoli: ['amministratore'], tenantId: 'az1' },
      'tenants/az1': { creatoDa: 'altro', nome: 'Azienda' }
    });
    await expect(handleRegistraAccettazioniLegali({
      auth: { uid: 'admin1' },
      data: {
        azione: 'registra',
        canale: 'registrazione',
        tenantId: 'az1',
        ruolo: 'amministratore',
        documenti: documentiAdmin()
      }
    }, db)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rifiuta la registrazione senza DPA', async () => {
    const documenti = documentiAdmin().filter((doc) => doc.tipo !== 'dpa');
    await expect(handleRegistraAccettazioniLegali({
      auth: { uid: 'admin1' },
      data: {
        azione: 'registra',
        canale: 'registrazione',
        tenantId: 'az1',
        ruolo: 'amministratore',
        documenti
      }
    }, fakeDb(baseSeed()))).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('ignora il documento già presente e non lo sovrascrive', async () => {
    const id = idAccettazione('admin1', 'az1', 'dpa', 'dpa-2026-03-01');
    const db = fakeDb(Object.assign(baseSeed(), {
      ['accettazioniLegali/' + id]: {
        uid: 'admin1',
        tipo: 'dpa',
        versione: 'dpa-2026-03-01',
        marker: 'vecchio'
      }
    }));
    const res = await handleRegistraAccettazioniLegali({
      auth: { uid: 'admin1' },
      data: {
        azione: 'registra',
        canale: 'registrazione',
        tenantId: 'az1',
        ruolo: 'amministratore',
        documenti: documentiAdmin()
      }
    }, db);
    expect(res).toEqual({ ok: true });
    expect(db.docs.get('accettazioniLegali/' + id).marker).toBe('vecchio');
    expect(db.docs.has('accettazioniLegali/' + idAccettazione('admin1', 'az1', 'privacy', 'privacy-2026-03-01'))).toBe(true);
  });

  it('non copia uid, email o ip dal payload: l\'uid della riga è quello di auth', async () => {
    const db = fakeDb(baseSeed());
    await handleRegistraAccettazioniLegali({
      auth: { uid: 'admin1' },
      data: {
        azione: 'registra',
        canale: 'registrazione',
        tenantId: 'az1',
        ruolo: 'amministratore',
        documenti: documentiAdmin(),
        uid: 'spoof',
        email: 'segreto@example.com',
        ip: '203.0.113.5'
      }
    }, db);
    const path = 'accettazioniLegali/' + idAccettazione('admin1', 'az1', 'termini-b2b', 'termini-b2b-2026-03-01');
    const row = db.docs.get(path);
    expect(row.uid).toBe('admin1');
    expect(row.email).toBeUndefined();
    expect(row.ip).toBeUndefined();
    expect(Object.keys(row).sort()).toEqual([
      'accettatoIl', 'canale', 'ruolo', 'tenantId', 'tipo', 'uid', 'versione', 'versioneTestoCasella'
    ]);
    expect(JSON.stringify(row)).not.toMatch(/spoof|segreto@example.com|203\.0\.113\.5/);
  });

  it('rifiuta il DPA sul canale invito', async () => {
    const db = fakeDb({
      'users/op1': { ruoli: ['operaio'], tenantId: 'az1' },
      'tenants/az1': { creatoDa: 'admin1', nome: 'Azienda' }
    });
    await expect(handleRegistraAccettazioniLegali({
      auth: { uid: 'op1' },
      data: {
        azione: 'registra',
        canale: 'invito',
        tenantId: 'az1',
        ruolo: 'operaio',
        documenti: [{
          tipo: 'dpa',
          versione: 'dpa-2026-03-01',
          versioneTestoCasella: 'casella-invito-v1'
        }]
      }
    }, db)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

});

function informativa() {
  return [{
    tipo: 'informativa-lavoratori',
    versione: 'informativa-lavoratori-2026-03-01',
    versioneTestoCasella: 'casella-invito-v1'
  }];
}

function seedDueAziende() {
  return {
    'users/op1': {
      ruoli: ['operaio'],
      tenantId: 'az1',
      tenantMemberships: {
        az1: { ruoli: ['operaio'], stato: 'attivo' },
        az2: { ruoli: ['operaio'], stato: 'attivo' }
      }
    },
    'tenants/az1': { creatoDa: 'admin1', nome: 'Azienda 1' },
    'tenants/az2': { creatoDa: 'admin2', nome: 'Azienda 2' }
  };
}

function registraInvito(db, tenantId) {
  return handleRegistraAccettazioniLegali({
    auth: { uid: 'op1' },
    data: { azione: 'registra', canale: 'invito', tenantId, ruolo: 'operaio', documenti: informativa() }
  }, db);
}

function stato(db, tenantId, uid = 'op1') {
  return handleRegistraAccettazioniLegali({ auth: { uid }, data: { azione: 'stato', tenantId } }, db);
}

describe('accettazioni per azienda', () => {
  it('id diverso per azienda, stesso utente, documento e versione', () => {
    const a = idAccettazione('op1', 'az1', 'informativa-lavoratori', 'informativa-lavoratori-2026-03-01');
    const b = idAccettazione('op1', 'az2', 'informativa-lavoratori', 'informativa-lavoratori-2026-03-01');
    expect(a).not.toBe(b);
    expect(a).toBe('op1_az1_informativa-lavoratori_informativa-lavoratori-2026-03-01');
    expect(() => idAccettazione('op1', '', 'dpa', 'dpa-2026-03-01')).toThrow();
  });

  it('la seconda azienda crea una riga sua (niente already-exists silenzioso)', async () => {
    const db = fakeDb(seedDueAziende());
    await registraInvito(db, 'az1');
    await registraInvito(db, 'az2');
    const righe = [...db.docs.keys()].filter((k) => k.startsWith('accettazioniLegali/'));
    expect(righe.sort()).toEqual([
      'accettazioniLegali/op1_az1_informativa-lavoratori_informativa-lavoratori-2026-03-01',
      'accettazioniLegali/op1_az2_informativa-lavoratori_informativa-lavoratori-2026-03-01'
    ]);
    expect(db.docs.get(righe.sort()[1]).tenantId).toBe('az2');
  });

  it('ripetere nella stessa azienda è idempotente e non sovrascrive', async () => {
    const db = fakeDb(seedDueAziende());
    await registraInvito(db, 'az1');
    const id = 'accettazioniLegali/op1_az1_informativa-lavoratori_informativa-lavoratori-2026-03-01';
    db.docs.get(id).marker = 'primo';
    await expect(registraInvito(db, 'az1')).resolves.toEqual({ ok: true });
    expect(db.docs.get(id).marker).toBe('primo');
  });

  it('stato filtrato per azienda: accettata in az1, mancante in az2', async () => {
    const db = fakeDb(seedDueAziende());
    await registraInvito(db, 'az1');
    expect(await stato(db, 'az1')).toEqual({
      documenti: [{ tipo: 'informativa-lavoratori', versione: 'informativa-lavoratori-2026-03-01' }]
    });
    expect(await stato(db, 'az2')).toEqual({ documenti: [] });
  });

  it('stato senza tenantId: invalid-argument', async () => {
    await expect(handleRegistraAccettazioniLegali({ auth: { uid: 'op1' }, data: { azione: 'stato' } }, fakeDb(seedDueAziende())))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('stato di un\'azienda a cui non appartieni: permission-denied', async () => {
    await expect(stato(fakeDb(seedDueAziende()), 'az3')).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('tenantId con "/" rifiutato', async () => {
    await expect(registraInvito(fakeDb(seedDueAziende()), 'az1/x')).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

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
    const id = idAccettazione('admin1', 'dpa', 'dpa-2026-03-01');
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
    expect(db.docs.has('accettazioniLegali/' + idAccettazione('admin1', 'privacy', 'privacy-2026-03-01'))).toBe(true);
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
    const path = 'accettazioniLegali/' + idAccettazione('admin1', 'termini-b2b', 'termini-b2b-2026-03-01');
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

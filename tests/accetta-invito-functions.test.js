/**
 * @vitest-environment node
 * Unit: handleAccettaInvito con db finto (transazione).
 */
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  handleAccettaInvito,
  AccettaInvitoError,
  campiNomeDaInvitoSeVuoti,
  migraTenantIdDeprecato,
} = require('../functions/accetta-invito.js');

const TOKEN = 'inv-test-token-abcdefghij';
const NOW = new Date('2026-10-24T12:00:00.000Z');

function fakeDb(seed) {
  const docs = new Map(Object.entries(seed || {}));

  function ref(path) {
    return {
      path,
      id: path.split('/').pop(),
      async get() {
        if (!docs.has(path)) return { exists: false, data: () => undefined, id: this.id };
        return { exists: true, data: () => structuredClone(docs.get(path)), id: this.id };
      },
    };
  }

  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          return ref(`${name}/${id}`);
        },
        where(field, _op, value) {
          return {
            limit() {
              return {
                async get() {
                  const rows = [];
                  docs.forEach((data, path) => {
                    if (path.startsWith(`${name}/`) && data && data[field] === value) {
                      rows.push({
                        id: path.split('/').pop(),
                        data: () => structuredClone(data),
                      });
                    }
                  });
                  return { empty: rows.length === 0, docs: rows };
                },
              };
            },
          };
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(docRef) {
          return docRef.get();
        },
        set(docRef, data) {
          docs.set(docRef.path, structuredClone(data));
        },
        update(docRef, data) {
          const cur = docs.get(docRef.path) || {};
          docs.set(docRef.path, Object.assign({}, cur, structuredClone(data)));
        },
      };
      return fn(tx);
    },
  };
}

function baseSeed(extra = {}) {
  return Object.assign(
    {
      'users/mgr1': {
        tenantId: 'az1',
        ruoli: ['manager'],
        stato: 'attivo',
        email: 'mgr@test.local',
      },
      'users/admin1': {
        tenantId: 'az1',
        ruoli: ['amministratore'],
        stato: 'attivo',
        email: 'admin@test.local',
      },
      'inviti/inv1': {
        email: 'nuovo@test.local',
        tenantId: 'az1',
        token: TOKEN,
        stato: 'invitato',
        inviatoDa: 'mgr1',
        ruoli: ['operaio'],
        nome: 'Nuovo',
        cognome: 'Utente',
        scadeIl: new Date('2027-01-01T00:00:00.000Z'),
      },
    },
    extra
  );
}

describe('campiNomeDaInvitoSeVuoti / migraTenantIdDeprecato', () => {
  it('copia nome solo se vuoto', () => {
    expect(campiNomeDaInvitoSeVuoti({ nome: '', cognome: 'X' }, { nome: 'Ada', cognome: 'Y' })).toEqual({
      nome: 'Ada',
    });
  });

  it('migra tenantId deprecato', () => {
    const out = migraTenantIdDeprecato({}, { tenantId: 'old', ruoli: ['amministratore'], stato: 'attivo' });
    expect(out.old).toEqual({
      ruoli: ['amministratore'],
      stato: 'attivo',
      tenantIdPredefinito: true,
    });
  });
});

describe('handleAccettaInvito', () => {
  it('utente nuovo → doc con membership, invito accettato', async () => {
    const db = fakeDb(baseSeed());
    const res = await handleAccettaInvito(
      db,
      { auth: { uid: 'uid-new', token: { email: 'nuovo@test.local' } } },
      { token: TOKEN },
      NOW
    );
    expect(res).toEqual({ ok: true, tenantId: 'az1', isNewUser: true });
    const user = db.docs.get('users/uid-new');
    expect(user.tenantMemberships.az1.ruoli).toEqual(['operaio']);
    expect(user.tenantMemberships.az1.tenantIdPredefinito).toBe(true);
    expect(user.invitoId).toBe('inv1');
    expect(db.docs.get('inviti/inv1').stato).toBe('accettato');
    expect(db.docs.get('inviti/inv1').accettatoDa).toBe('uid-new');
  });

  it('utente esistente con tenantId deprecato → migra + nuova membership; globali invariati', async () => {
    const db = fakeDb(
      baseSeed({
        'users/uid-ex': {
          email: 'nuovo@test.local',
          tenantId: 'azienda-vecchia',
          ruoli: ['amministratore'],
          stato: 'attivo',
          nome: '',
          cognome: '',
        },
        'inviti/inv1': {
          email: 'nuovo@test.local',
          tenantId: 'az1',
          token: TOKEN,
          stato: 'invitato',
          inviatoDa: 'mgr1',
          ruoli: ['operaio'],
          nome: 'NomeInv',
          cognome: 'CogInv',
          scadeIl: new Date('2027-01-01T00:00:00.000Z'),
        },
      })
    );
    const res = await handleAccettaInvito(
      db,
      { auth: { uid: 'uid-ex', token: { email: 'nuovo@test.local' } } },
      { token: TOKEN },
      NOW
    );
    expect(res.isNewUser).toBe(false);
    const user = db.docs.get('users/uid-ex');
    expect(user.tenantId).toBe('azienda-vecchia');
    expect(user.ruoli).toEqual(['amministratore']);
    expect(user.stato).toBe('attivo');
    expect(user.tenantMemberships['azienda-vecchia'].tenantIdPredefinito).toBe(true);
    expect(user.tenantMemberships.az1.ruoli).toEqual(['operaio']);
    expect(user.tenantMemberships.az1.tenantIdPredefinito).toBe(false);
    expect(user.nome).toBe('NomeInv');
  });

  it('invito scaduto / già accettato / email diversa → rifiuto senza scritture', async () => {
    const scaduto = fakeDb(
      baseSeed({
        'inviti/inv1': {
          email: 'nuovo@test.local',
          tenantId: 'az1',
          token: TOKEN,
          stato: 'invitato',
          inviatoDa: 'mgr1',
          ruoli: ['operaio'],
          scadeIl: new Date('2020-01-01T00:00:00.000Z'),
        },
      })
    );
    await expect(
      handleAccettaInvito(
        scaduto,
        { auth: { uid: 'u1', token: { email: 'nuovo@test.local' } } },
        { token: TOKEN },
        NOW
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(scaduto.docs.get('users/u1')).toBeUndefined();

    const accettato = fakeDb(
      baseSeed({
        'inviti/inv1': {
          email: 'nuovo@test.local',
          tenantId: 'az1',
          token: TOKEN,
          stato: 'accettato',
          inviatoDa: 'mgr1',
          ruoli: ['operaio'],
          scadeIl: new Date('2027-01-01T00:00:00.000Z'),
        },
      })
    );
    await expect(
      handleAccettaInvito(
        accettato,
        { auth: { uid: 'u1', token: { email: 'nuovo@test.local' } } },
        { token: TOKEN },
        NOW
      )
    ).rejects.toMatchObject({ code: 'not-found' });

    const emailDiff = fakeDb(baseSeed());
    await expect(
      handleAccettaInvito(
        emailDiff,
        { auth: { uid: 'u1', token: { email: 'altro@test.local' } } },
        { token: TOKEN },
        NOW
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(emailDiff.docs.get('users/u1')).toBeUndefined();
    expect(emailDiff.docs.get('inviti/inv1').stato).toBe('invitato');
  });

  it('già membro attivo → already-exists', async () => {
    const db = fakeDb(
      baseSeed({
        'users/uid-ex': {
          email: 'nuovo@test.local',
          tenantMemberships: {
            az1: { stato: 'attivo', ruoli: ['operaio'] },
          },
        },
      })
    );
    await expect(
      handleAccettaInvito(
        db,
        { auth: { uid: 'uid-ex', token: { email: 'nuovo@test.local' } } },
        { token: TOKEN },
        NOW
      )
    ).rejects.toMatchObject({ code: 'already-exists' });
    expect(db.docs.get('inviti/inv1').stato).toBe('invitato');
  });

  it('inviatoDa non più manager del tenant dell\'invito → permission-denied', async () => {
    const db = fakeDb(
      baseSeed({
        'users/mgr1': {
          tenantId: 'altro',
          ruoli: ['manager'],
          stato: 'attivo',
        },
        'inviti/inv1': {
          email: 'nuovo@test.local',
          tenantId: 'az1',
          token: TOKEN,
          stato: 'invitato',
          inviatoDa: 'mgr1',
          ruoli: ['operaio'],
          scadeIl: new Date('2027-01-01T00:00:00.000Z'),
        },
      })
    );
    await expect(
      handleAccettaInvito(
        db,
        { auth: { uid: 'u1', token: { email: 'nuovo@test.local' } } },
        { token: TOKEN },
        NOW
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('invito amministratore da solo manager → permission-denied', async () => {
    const db = fakeDb(
      baseSeed({
        'inviti/inv1': {
          email: 'nuovo@test.local',
          tenantId: 'az1',
          token: TOKEN,
          stato: 'invitato',
          inviatoDa: 'mgr1',
          ruoli: ['amministratore'],
          scadeIl: new Date('2027-01-01T00:00:00.000Z'),
        },
      })
    );
    await expect(
      handleAccettaInvito(
        db,
        { auth: { uid: 'u1', token: { email: 'nuovo@test.local' } } },
        { token: TOKEN },
        NOW
      )
    ).rejects.toBeInstanceOf(AccettaInvitoError);
  });
});

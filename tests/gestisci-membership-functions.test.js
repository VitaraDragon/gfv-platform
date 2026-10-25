/**
 * @vitest-environment node
 */
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { FieldValue, FieldPath } = require('firebase-admin/firestore');
const {
  handleGestisciMembershipUtente,
  handleElencaUtentiTenant,
  countActiveAdminsInTx,
} = require('../functions/gestisci-membership.js');

function isDeleteSentinel(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.__delete === true) return true;
  if (value.constructor && value.constructor.name === 'DeleteTransform') return true;
  try {
    return typeof value.isEqual === 'function' && value.isEqual(FieldValue.delete());
  } catch {
    return false;
  }
}

function fieldKey(key) {
  if (key && typeof key === 'object' && Array.isArray(key.segments)) {
    return key.segments.join('.');
  }
  if (key instanceof FieldPath) {
    return String(key).replace(/`/g, '');
  }
  return String(key);
}

function fakeDb(seed) {
  const docs = new Map(Object.entries(seed || {}));

  function applyUpdate(path, data) {
    const cur = Object.assign({}, docs.get(path) || {});
    for (const [rawKey, value] of Object.entries(data)) {
      const key = fieldKey(rawKey);
      if (isDeleteSentinel(value)) {
        const parts = key.split('.');
        if (parts.length === 2 && parts[0] === 'tenantMemberships') {
          const mem = Object.assign({}, cur.tenantMemberships || {});
          delete mem[parts[1]];
          cur.tenantMemberships = mem;
        } else {
          delete cur[key];
        }
      } else if (key === 'tenantMemberships') {
        cur.tenantMemberships = value;
      } else if (key.startsWith('tenantMemberships.')) {
        const tid = key.slice('tenantMemberships.'.length);
        const mem = Object.assign({}, cur.tenantMemberships || {});
        if (isDeleteSentinel(value)) delete mem[tid];
        else mem[tid] = value;
        cur.tenantMemberships = mem;
      } else {
        cur[key] = value;
      }
    }
    docs.set(path, cur);
  }

  function ref(path) {
    return {
      path,
      id: path.split('/').pop(),
      async get() {
        if (!docs.has(path)) return { exists: false, data: () => undefined, id: path.split('/').pop() };
        return { exists: true, data: () => docs.get(path), id: path.split('/').pop(), ref: ref(path) };
      },
      async update(dataOrField, maybeValue) {
        if (maybeValue !== undefined) {
          applyUpdate(path, { [fieldKey(dataOrField)]: maybeValue });
        } else {
          applyUpdate(path, dataOrField);
        }
      },
    };
  }

  function runWhere(name, filters) {
    const rows = [];
    docs.forEach((data, path) => {
      if (!path.startsWith(name + '/')) return;
      const ok = filters.every((f) => {
        let cur = data;
        if (f.field.includes('.')) {
          for (const p of f.field.split('.')) cur = cur && cur[p];
        } else {
          cur = data && data[f.field];
        }
        if (f.op === '==') return cur === f.value;
        if (f.op === 'in') return Array.isArray(f.value) && f.value.includes(cur);
        return false;
      });
      if (ok) rows.push({ id: path.split('/').pop(), data: () => data, ref: ref(path) });
    });
    return {
      empty: rows.length === 0,
      docs: rows,
      forEach(fn) {
        rows.forEach(fn);
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
        where(field, op, value) {
          const filters = [{ field, op, value }];
          const api = {
            where(field2, op2, value2) {
              filters.push({ field: field2, op: op2, value: value2 });
              return api;
            },
            async get() {
              return runWhere(name, filters);
            },
            _filters: filters,
            _collection: name,
          };
          return api;
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(docRefOrQuery) {
          if (docRefOrQuery && typeof docRefOrQuery.get === 'function' && docRefOrQuery.path) {
            return docRefOrQuery.get();
          }
          // Query in transaction
          if (docRefOrQuery && docRefOrQuery._filters && docRefOrQuery._collection) {
            return runWhere(docRefOrQuery._collection, docRefOrQuery._filters);
          }
          if (docRefOrQuery && typeof docRefOrQuery.get === 'function') {
            return docRefOrQuery.get();
          }
          throw new Error('tx.get: tipo non supportato nel fakeDb');
        },
        update(docRef, dataOrField, maybeValue) {
          if (maybeValue !== undefined) {
            applyUpdate(docRef.path, { [fieldKey(dataOrField)]: maybeValue });
          } else {
            applyUpdate(docRef.path, dataOrField);
          }
        },
      };
      return fn(tx);
    },
  };
}

describe('gestisciMembershipUtente', () => {
  const adminA = {
    email: 'a@x.it',
    nome: 'Ada',
    cognome: 'Admin',
    tenantId: 'T1',
    ruoli: ['amministratore'],
    tenantMemberships: {
      T1: { ruoli: ['amministratore'], stato: 'attivo' },
    },
  };

  it('disattiva da admin stesso tenant: solo membership T1', async () => {
    const db = fakeDb({
      'users/admin1': adminA,
      'users/op1': {
        email: 'o@x.it',
        tenantMemberships: {
          T1: { ruoli: ['operaio'], stato: 'attivo' },
          T2: { ruoli: ['manager'], stato: 'attivo' },
        },
      },
    });
    await handleGestisciMembershipUtente(db, {
      auth: { uid: 'admin1' },
      data: { tenantId: 'T1', uid: 'op1', azione: 'disattiva' },
    });
    const op = db.docs.get('users/op1');
    expect(op.tenantMemberships.T1.stato).toBe('disattivato');
    expect(op.tenantMemberships.T2.stato).toBe('attivo');
    expect(op.email).toBe('o@x.it');
  });

  it('riattiva ripristina stato attivo', async () => {
    const db = fakeDb({
      'users/admin1': adminA,
      'users/op1': {
        tenantMemberships: { T1: { ruoli: ['operaio'], stato: 'disattivato' } },
      },
    });
    await handleGestisciMembershipUtente(db, {
      auth: { uid: 'admin1' },
      data: { tenantId: 'T1', uid: 'op1', azione: 'riattiva' },
    });
    expect(db.docs.get('users/op1').tenantMemberships.T1.stato).toBe('attivo');
  });

  it('riattiva su rimosso → failed-precondition', async () => {
    const db = fakeDb({
      'users/admin1': adminA,
      'users/op1': {
        tenantMemberships: { T1: { ruoli: ['operaio'], stato: 'rimosso' } },
      },
    });
    await expect(
      handleGestisciMembershipUtente(db, {
        auth: { uid: 'admin1' },
        data: { tenantId: 'T1', uid: 'op1', azione: 'riattiva' },
      })
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringMatching(/nuovo invito/i),
    });
    expect(db.docs.get('users/op1').tenantMemberships.T1.stato).toBe('rimosso');
  });

  it('rimuovi con tenantId deprecato == T1: stato rimosso (non delete chiave)', async () => {
    const db = fakeDb({
      'users/admin1': adminA,
      'users/target': {
        tenantId: 'T1',
        ruoli: ['operaio'],
        tenantMemberships: {
          T1: { ruoli: ['operaio'], stato: 'attivo' },
        },
      },
    });
    db.docs.set('users/admin2', {
      tenantMemberships: { T1: { ruoli: ['amministratore'], stato: 'attivo' } },
    });
    await handleGestisciMembershipUtente(db, {
      auth: { uid: 'admin1' },
      data: { tenantId: 'T1', uid: 'target', azione: 'rimuovi' },
    });
    const t = db.docs.get('users/target');
    expect(t.tenantMemberships.T1.stato).toBe('rimosso');
    expect(t.tenantId).toBe('T1');
  });

  it('rimuovi senza tenantId deprecato: delete chiave via FieldPath', async () => {
    const db = fakeDb({
      'users/admin1': adminA,
      'users/op1': {
        tenantMemberships: {
          T1: { ruoli: ['operaio'], stato: 'attivo' },
          T2: { ruoli: ['manager'], stato: 'attivo' },
        },
      },
    });
    await handleGestisciMembershipUtente(db, {
      auth: { uid: 'admin1' },
      data: { tenantId: 'T1', uid: 'op1', azione: 'rimuovi' },
    });
    const op = db.docs.get('users/op1');
    expect(op.tenantMemberships.T1).toBeUndefined();
    expect(op.tenantMemberships.T2.stato).toBe('attivo');
  });

  it('ruoli: scrive solo membership.ruoli', async () => {
    const db = fakeDb({
      'users/admin1': adminA,
      'users/op1': {
        ruoli: ['operaio'],
        tenantMemberships: { T1: { ruoli: ['operaio'], stato: 'attivo' } },
      },
    });
    await handleGestisciMembershipUtente(db, {
      auth: { uid: 'admin1' },
      data: { tenantId: 'T1', uid: 'op1', azione: 'ruoli', ruoli: ['manager', 'operaio'] },
    });
    const op = db.docs.get('users/op1');
    expect(op.tenantMemberships.T1.ruoli).toEqual(['manager', 'operaio']);
    expect(op.ruoli).toEqual(['operaio']);
  });

  it('target solo deprecato: crea membership poi aggiorna', async () => {
    const db = fakeDb({
      'users/admin1': adminA,
      'users/legacy': {
        tenantId: 'T1',
        ruoli: ['operaio'],
        stato: 'attivo',
      },
    });
    db.docs.set('users/admin2', {
      tenantMemberships: { T1: { ruoli: ['amministratore'], stato: 'attivo' } },
    });
    await handleGestisciMembershipUtente(db, {
      auth: { uid: 'admin1' },
      data: { tenantId: 'T1', uid: 'legacy', azione: 'disattiva' },
    });
    const leg = db.docs.get('users/legacy');
    expect(leg.tenantMemberships.T1.stato).toBe('disattivato');
    expect(leg.tenantMemberships.T1.ruoli).toEqual(['operaio']);
  });

  it('permission-denied: admin altro tenant / operaio / caposquadra', async () => {
    const db = fakeDb({
      'users/adminB': {
        tenantMemberships: { T2: { ruoli: ['amministratore'], stato: 'attivo' } },
      },
      'users/op1': {
        tenantMemberships: { T1: { ruoli: ['operaio'], stato: 'attivo' } },
      },
      'users/capo1': {
        tenantMemberships: { T1: { ruoli: ['caposquadra'], stato: 'attivo' } },
      },
      'users/target': {
        tenantMemberships: { T1: { ruoli: ['operaio'], stato: 'attivo' } },
      },
    });
    await expect(
      handleGestisciMembershipUtente(db, {
        auth: { uid: 'adminB' },
        data: { tenantId: 'T1', uid: 'target', azione: 'disattiva' },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      handleGestisciMembershipUtente(db, {
        auth: { uid: 'op1' },
        data: { tenantId: 'T1', uid: 'target', azione: 'disattiva' },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      handleGestisciMembershipUtente(db, {
        auth: { uid: 'capo1' },
        data: { tenantId: 'T1', uid: 'target', azione: 'disattiva' },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rifiuta auto-disattivazione e ultimo admin', async () => {
    const dbSelf = fakeDb({
      'users/admin1': adminA,
    });
    await expect(
      handleGestisciMembershipUtente(dbSelf, {
        auth: { uid: 'admin1' },
        data: { tenantId: 'T1', uid: 'admin1', azione: 'disattiva' },
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    const dbLast = fakeDb({
      'users/soloAdmin': {
        tenantMemberships: { T1: { ruoli: ['amministratore'], stato: 'attivo' } },
      },
      'users/manager1': {
        tenantMemberships: { T1: { ruoli: ['manager'], stato: 'attivo' } },
      },
    });
    // Manager non può toccare un admin (permission-denied, prima del conteggio)
    await expect(
      handleGestisciMembershipUtente(dbLast, {
        auth: { uid: 'manager1' },
        data: { tenantId: 'T1', uid: 'soloAdmin', azione: 'disattiva' },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });

    // Unico admin che tenta di declassarsi → failed-precondition (conteggio in TX)
    await expect(
      handleGestisciMembershipUtente(dbLast, {
        auth: { uid: 'soloAdmin' },
        data: { tenantId: 'T1', uid: 'soloAdmin', azione: 'ruoli', ruoli: ['manager'] },
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('manager non può assegnare amministratore', async () => {
    const db = fakeDb({
      'users/manager1': {
        tenantMemberships: { T1: { ruoli: ['manager'], stato: 'attivo' } },
      },
      'users/op1': {
        tenantMemberships: { T1: { ruoli: ['operaio'], stato: 'attivo' } },
      },
    });
    await expect(
      handleGestisciMembershipUtente(db, {
        auth: { uid: 'manager1' },
        data: { tenantId: 'T1', uid: 'op1', azione: 'ruoli', ruoli: ['amministratore'] },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  describe('target admin: solo un amministratore può modificare', () => {
    const manager = {
      tenantMemberships: { T1: { ruoli: ['manager'], stato: 'attivo' } },
    };
    const adminTarget = {
      tenantMemberships: { T1: { ruoli: ['amministratore'], stato: 'attivo' } },
    };
    const adminDisabled = {
      tenantMemberships: { T1: { ruoli: ['amministratore'], stato: 'disattivato' } },
    };

    for (const azione of ['disattiva', 'rimuovi', 'riattiva', 'ruoli']) {
      it(`manager negato su ${azione} verso admin (nessuna scrittura)`, async () => {
        const target =
          azione === 'riattiva'
            ? adminDisabled
            : Object.assign({}, adminTarget);
        const db = fakeDb({
          'users/manager1': manager,
          'users/adminTarget': JSON.parse(JSON.stringify(target)),
          'users/adminOther': {
            tenantMemberships: { T1: { ruoli: ['amministratore'], stato: 'attivo' } },
          },
        });
        const before = JSON.stringify(db.docs.get('users/adminTarget'));
        const data = { tenantId: 'T1', uid: 'adminTarget', azione };
        if (azione === 'ruoli') data.ruoli = ['manager'];
        await expect(
          handleGestisciMembershipUtente(db, { auth: { uid: 'manager1' }, data })
        ).rejects.toMatchObject({
          code: 'permission-denied',
          message: expect.stringMatching(/Solo un amministratore/i),
        });
        expect(JSON.stringify(db.docs.get('users/adminTarget'))).toBe(before);
      });
    }

    it('manager non può riattivare admin disattivato', async () => {
      const db = fakeDb({
        'users/manager1': manager,
        'users/adminTarget': adminDisabled,
        'users/adminOther': {
          tenantMemberships: { T1: { ruoli: ['amministratore'], stato: 'attivo' } },
        },
      });
      await expect(
        handleGestisciMembershipUtente(db, {
          auth: { uid: 'manager1' },
          data: { tenantId: 'T1', uid: 'adminTarget', azione: 'riattiva' },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
      expect(db.docs.get('users/adminTarget').tenantMemberships.T1.stato).toBe('disattivato');
    });

    it('admin agisce su altro admin (terzo admin presente) → ok', async () => {
      const db = fakeDb({
        'users/admin1': adminA,
        'users/admin2': {
          tenantMemberships: { T1: { ruoli: ['amministratore'], stato: 'attivo' } },
        },
        'users/admin3': {
          tenantMemberships: { T1: { ruoli: ['amministratore'], stato: 'attivo' } },
        },
      });
      await handleGestisciMembershipUtente(db, {
        auth: { uid: 'admin1' },
        data: { tenantId: 'T1', uid: 'admin2', azione: 'disattiva' },
      });
      expect(db.docs.get('users/admin2').tenantMemberships.T1.stato).toBe('disattivato');
    });
  });

  it('chiamante disattivato tra controllo esterno e commit TX → negato', async () => {
    const db = fakeDb({
      'users/manager1': {
        tenantMemberships: { T1: { ruoli: ['manager'], stato: 'attivo' } },
      },
      'users/op1': {
        tenantMemberships: { T1: { ruoli: ['operaio'], stato: 'attivo' } },
      },
    });
    const orig = db.runTransaction.bind(db);
    db.runTransaction = async (fn) => {
      db.docs.set('users/manager1', {
        tenantMemberships: { T1: { ruoli: ['manager'], stato: 'disattivato' } },
      });
      return orig(fn);
    };
    await expect(
      handleGestisciMembershipUtente(db, {
        auth: { uid: 'manager1' },
        data: { tenantId: 'T1', uid: 'op1', azione: 'disattiva' },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(db.docs.get('users/op1').tenantMemberships.T1.stato).toBe('attivo');
  });

  it('conteggio ultimo admin usa tx.get (query in transazione)', async () => {
    const db = fakeDb({
      'users/soloAdmin': {
        tenantMemberships: { T1: { ruoli: ['amministratore'], stato: 'attivo' } },
      },
    });
    const txGets = [];
    const tx = {
      async get(q) {
        txGets.push(q);
        if (q && q.path) return q.get();
        if (q && q._filters) {
          const rows = [];
          db.docs.forEach((data, path) => {
            if (!path.startsWith('users/')) return;
            const ok = q._filters.every((f) => {
              let cur = data;
              if (f.field.includes('.')) {
                for (const p of f.field.split('.')) cur = cur && cur[p];
              } else cur = data && data[f.field];
              if (f.op === '==') return cur === f.value;
              return false;
            });
            if (ok) rows.push({ id: path.split('/').pop(), data: () => data });
          });
          return { forEach: (fn) => rows.forEach(fn), docs: rows, empty: rows.length === 0 };
        }
        throw new Error('unexpected');
      },
    };
    const n = await countActiveAdminsInTx(db, tx, 'T1', 'soloAdmin');
    expect(n).toBe(0);
    expect(txGets.length).toBeGreaterThanOrEqual(2);
    expect(txGets.some((g) => g && g._filters)).toBe(true);
  });
});

describe('elencaUtentiTenant', () => {
  it('solo manager/admin e include utenti via membership', async () => {
    const db = fakeDb({
      'users/admin1': {
        tenantMemberships: { T1: { ruoli: ['amministratore'], stato: 'attivo' } },
      },
      'users/viaMem': {
        email: 'm@x.it',
        nome: 'Via',
        cognome: 'Mem',
        tenantMemberships: { T1: { ruoli: ['operaio'], stato: 'attivo' } },
      },
      'users/viaDep': {
        email: 'd@x.it',
        nome: 'Via',
        cognome: 'Dep',
        tenantId: 'T1',
        ruoli: ['manager'],
      },
      'users/opOther': {
        tenantMemberships: { T1: { ruoli: ['operaio'], stato: 'attivo' } },
      },
    });
    db.docs.set('users/opCaller', {
      tenantMemberships: { T1: { ruoli: ['operaio'], stato: 'attivo' } },
    });
    await expect(
      handleElencaUtentiTenant(db, { auth: { uid: 'opCaller' }, data: { tenantId: 'T1' } })
    ).rejects.toMatchObject({ code: 'permission-denied' });

    const res = await handleElencaUtentiTenant(db, {
      auth: { uid: 'admin1' },
      data: { tenantId: 'T1' },
    });
    const ids = res.utenti.map((u) => u.id);
    expect(ids).toContain('viaMem');
    expect(ids).toContain('viaDep');
  });
});

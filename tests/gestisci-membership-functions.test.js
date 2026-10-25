/**
 * @vitest-environment node
 */
import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach } from 'vitest';

const require = createRequire(import.meta.url);
const {
  handleGestisciMembershipUtente,
  handleElencaUtentiTenant,
} = require('../functions/gestisci-membership.js');

function fakeDb(seed) {
  const docs = new Map(Object.entries(seed || {}));

  function applyUpdate(path, data) {
    const cur = Object.assign({}, docs.get(path) || {});
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && value.__delete) {
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
        if (value && value.__delete) delete mem[tid];
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
      async update(data) {
        applyUpdate(path, data);
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
            },
          };
          return api;
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(docRef) {
          return docRef.get();
        },
        update(docRef, data) {
          applyUpdate(docRef.path, data);
        },
      };
      return fn(tx);
    },
  };
}

const FieldValue = {
  delete: () => ({ __delete: true }),
};

// Patch FieldValue used by gestisci-membership (loaded at require time via firebase-admin).
// In test we intercept path updates with __delete above; ensure require uses our sentinel.
beforeEach(() => {
  // no-op: fake applyUpdate already understands __delete
});

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
    // secondo admin per non bloccare ultimo admin
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
    await expect(
      handleGestisciMembershipUtente(dbLast, {
        auth: { uid: 'manager1' },
        data: { tenantId: 'T1', uid: 'soloAdmin', azione: 'disattiva' },
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
    // operaio cannot list
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

// silence unused
void FieldValue;

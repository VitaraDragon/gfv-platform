/**
 * Cascata disattivazione Conto Terzi → Vendemmia Meccanica (Stripe finto).
 * Non tocca Firestore reale.
 */
import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { handleCancelStripeAddon } = require('../functions/stripe-billing.js');

const PERIOD = 1_790_000_000;

function createFakeDb(tenants, users) {
  const tenantStore = new Map(
    Object.entries(tenants).map(([id, data]) => [id, Object.assign({}, data)])
  );
  const userStore = new Map(
    Object.entries(users || {}).map(([id, data]) => [id, Object.assign({}, data)])
  );
  function collection(store) {
    return {
      doc(id) {
        return {
          async get() {
            const data = store.get(id);
            return {
              exists: !!data,
              id,
              data: () => (data ? Object.assign({}, data) : undefined),
            };
          },
          async update(patch) {
            if (!store.has(id)) throw new Error('not found: ' + id);
            store.set(id, Object.assign({}, store.get(id), patch));
          },
        };
      },
    };
  }
  return {
    collection(name) {
      if (name === 'tenants') return collection(tenantStore);
      if (name === 'users') return collection(userStore);
      throw new Error('collection non prevista: ' + name);
    },
    read(id) {
      return tenantStore.get(id);
    },
  };
}

const USERS = {
  u1: { tenantId: 't1', ruoli: ['amministratore'], stato: 'attivo' },
};

function request(addonId) {
  return {
    auth: { uid: 'u1' },
    data: { tenantId: 't1', addonId, addonType: 'module' },
  };
}

function fakeStripe(calls, opts) {
  const options = opts || {};
  let vmFailures = 0;
  return {
    subscriptions: {
      async update(id, params) {
        calls.push({ id, params });
        if (id === 'sub_vm' && options.failVmOnce && vmFailures === 0) {
          vmFailures += 1;
          const err = new Error('stripe temporaneo');
          err.type = 'StripeAPIError';
          throw err;
        }
        return { id, current_period_end: PERIOD, items: { data: [] } };
      },
    },
  };
}

function tenantConDueModuli() {
  return {
    modules: ['contoTerzi', 'vendemmiaMeccanica', 'manodopera'],
    activeBundles: [],
    stripeSubscriptionId: 'sub_base',
    stripeAddons: {
      contoTerzi: { type: 'module', subscriptionId: 'sub_ct', periodEnd: PERIOD },
      vendemmiaMeccanica: { type: 'module', subscriptionId: 'sub_vm', periodEnd: PERIOD },
    },
  };
}

describe('handleCancelStripeAddon cascata CT → VM', () => {
  it('cascata normale: annulla solo gli abbonamenti dei due moduli', async () => {
    const calls = [];
    const db = createFakeDb({ t1: tenantConDueModuli() }, USERS);
    const res = await handleCancelStripeAddon(db, 'sk_test_x', request('contoTerzi'), fakeStripe(calls));
    expect(res.ok).toBe(true);
    expect(res.addonId).toBe('contoTerzi');
    expect(res.deactivatesAt).toBe(PERIOD);
    expect(res.cascaded).toEqual([{ id: 'vendemmiaMeccanica', deactivatesAt: PERIOD }]);
    expect(calls.map((c) => c.id)).toEqual(['sub_ct', 'sub_vm']);
    const td = db.read('t1');
    expect(td.modules).not.toContain('contoTerzi');
    expect(td.modules).not.toContain('vendemmiaMeccanica');
    expect(td.stripeAddons.contoTerzi.pendingDeactivation).toBe(true);
    expect(td.stripeAddons.vendemmiaMeccanica.pendingDeactivation).toBe(true);

    const diNuovo = await handleCancelStripeAddon(
      db,
      'sk_test_x',
      request('vendemmiaMeccanica'),
      fakeStripe(calls)
    );
    expect(diNuovo.ok).toBe(true);
    expect(diNuovo.addonId).toBe('vendemmiaMeccanica');
    expect(calls.map((c) => c.id)).toEqual(['sub_ct', 'sub_vm']);
  });

  it('VM coperta da gfv-completo: nessuna chiamata Stripe sul bundle né sul piano Base', async () => {
    const calls = [];
    const db = createFakeDb({
      t1: {
        modules: [
          'manodopera',
          'parcoMacchine',
          'contoTerzi',
          'vendemmiaMeccanica',
          'vigneto',
          'frutteto',
          'magazzino',
          'tony',
          'report',
          'meteo',
        ],
        activeBundles: ['gfv-completo'],
        stripeSubscriptionId: 'sub_base',
        stripeAddons: {
          contoTerzi: { type: 'module', subscriptionId: 'sub_ct', periodEnd: PERIOD },
          'gfv-completo': { type: 'bundle', subscriptionId: 'sub_bundle', periodEnd: PERIOD },
        },
      },
    }, USERS);
    const res = await handleCancelStripeAddon(db, 'sk_test_x', request('contoTerzi'), fakeStripe(calls));
    expect(res.addonId).toBe('contoTerzi');
    expect(res.deactivatesAt).toBe(PERIOD);
    expect(res.cascaded).toEqual([]);
    expect(res.skipped).toEqual([{ id: 'vendemmiaMeccanica', reason: 'billedViaBundleId' }]);
    expect(calls.map((c) => c.id)).toEqual(['sub_ct']);
    expect(calls.map((c) => c.id)).not.toContain('sub_bundle');
    expect(calls.map((c) => c.id)).not.toContain('sub_base');
    const td = db.read('t1');
    expect(td.modules).not.toContain('contoTerzi');
    expect(td.modules).toContain('vendemmiaMeccanica');
    expect(td.stripeAddons['gfv-completo'].pendingDeactivation).not.toBe(true);
  });

  it('nuovo tentativo dopo un errore parziale completa la VM', async () => {
    const calls = [];
    const db = createFakeDb({ t1: tenantConDueModuli() }, USERS);
    const stripe = fakeStripe(calls, { failVmOnce: true });
    await expect(
      handleCancelStripeAddon(db, 'sk_test_x', request('contoTerzi'), stripe)
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    let td = db.read('t1');
    expect(td.modules).not.toContain('contoTerzi');
    expect(td.modules).toContain('vendemmiaMeccanica');
    expect(td.stripeAddons.contoTerzi.pendingDeactivation).toBe(true);

    const res = await handleCancelStripeAddon(db, 'sk_test_x', request('contoTerzi'), stripe);
    expect(res.ok).toBe(true);
    expect(res.addonId).toBe('contoTerzi');
    expect(res.deactivatesAt).toBe(PERIOD);
    expect(res.cascaded).toEqual([{ id: 'vendemmiaMeccanica', deactivatesAt: PERIOD }]);
    expect(calls.map((c) => c.id)).toEqual(['sub_ct', 'sub_vm', 'sub_vm']);
    td = db.read('t1');
    expect(td.modules).not.toContain('vendemmiaMeccanica');
    expect(td.stripeAddons.vendemmiaMeccanica.pendingDeactivation).toBe(true);
  });

  it('VM in prova senza Stripe si spegne senza chiamate Stripe', async () => {
    const calls = [];
    const db = createFakeDb({
      t1: {
        modules: ['contoTerzi'],
        activeBundles: [],
        stripeSubscriptionId: 'sub_base',
        moduleTrials: {
          vendemmiaMeccanica: { status: 'active', endsAt: Date.now() + 10 * 24 * 60 * 60 * 1000 },
        },
        stripeAddons: {
          contoTerzi: { type: 'module', subscriptionId: 'sub_ct', periodEnd: PERIOD },
        },
      },
    }, USERS);
    const res = await handleCancelStripeAddon(db, 'sk_test_x', request('contoTerzi'), fakeStripe(calls));
    expect(calls.map((c) => c.id)).toEqual(['sub_ct']);
    expect(res.cascaded).toEqual([{ id: 'vendemmiaMeccanica', deactivatesAt: null }]);
    const td = db.read('t1');
    expect(td.moduleTrials.vendemmiaMeccanica.status).toBe('expired');
    expect(td.modules).not.toContain('contoTerzi');
  });
});

/**
 * Fulfillment Stripe lato server (functions/stripe-billing.js):
 * - `applyCheckoutSessionToTenant` condiviso tra callable `fulfillStripeCheckout` e webhook;
 * - webhook `checkout.session.completed` attiva piano/moduli senza dipendere dal ritorno del client
 *   (web app iOS installata: Stripe si apre nel browser in-app, la sessione app non è condivisa);
 * - sync subscription piano via webhook non riporta mai il tenant a `plan: 'free'`.
 */
import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  applyCheckoutSessionToTenant,
  handleStripeCheckoutSessionCompleted,
  tenantIdFromCheckoutSession,
  syncAddonFromStripeSubscription,
} = require('../functions/stripe-billing.js');

/** Firestore minimale in memoria: solo tenants/{id} get/update + where su stripeSubscriptionId. */
function createFakeDb(tenants) {
  const store = new Map(Object.entries(tenants).map(([id, data]) => [id, Object.assign({}, data)]));
  const updates = [];
  function docRef(id) {
    return {
      async get() {
        const data = store.get(id);
        return { exists: !!data, data: () => (data ? Object.assign({}, data) : undefined), id };
      },
      async update(patch) {
        if (!store.has(id)) throw new Error('not found: ' + id);
        updates.push({ id, patch });
        store.set(id, Object.assign({}, store.get(id), patch));
      },
    };
  }
  return {
    collection(name) {
      if (name !== 'tenants') throw new Error('collection non prevista nel fake: ' + name);
      return {
        doc: docRef,
        where(field, op, value) {
          return {
            limit() {
              return {
                async get() {
                  const docs = [];
                  store.forEach((data, id) => {
                    if (data[field] === value) docs.push({ id, data: () => data });
                  });
                  return { empty: docs.length === 0, docs };
                },
              };
            },
          };
        },
        async get() {
          const docs = [];
          store.forEach((data, id) => docs.push({ id, data: () => data }));
          return { docs };
        },
      };
    },
    _store: store,
    _updates: updates,
    read(id) {
      return store.get(id);
    },
  };
}

const PERIOD_END = 1_790_000_000;

function createFakeStripe() {
  return {
    subscriptions: {
      async retrieve(id) {
        return { id, status: 'active', current_period_end: PERIOD_END, items: { data: [] } };
      },
    },
  };
}

function checkoutSession(overrides) {
  return Object.assign(
    {
      id: 'cs_test_1',
      mode: 'subscription',
      payment_status: 'paid',
      status: 'complete',
      customer: 'cus_1',
      subscription: 'sub_base_1',
      client_reference_id: 't1',
      metadata: { tenantId: 't1', checkoutType: 'plan', catalogId: 'base', planId: 'base', uid: 'u1' },
    },
    overrides || {}
  );
}

/** Doc tenant come lo lascia la registrazione (`piano`, non `plan`). */
function freshFreeTenant() {
  return { nome: 'Azienda Test', piano: 'free', moduli: [], stato: 'attivo' };
}

describe('tenantIdFromCheckoutSession', () => {
  it('metadata prima di client_reference_id', () => {
    expect(tenantIdFromCheckoutSession({ metadata: { tenantId: 'a' }, client_reference_id: 'b' })).toBe('a');
    expect(tenantIdFromCheckoutSession({ metadata: {}, client_reference_id: 'b' })).toBe('b');
    expect(tenantIdFromCheckoutSession({})).toBeNull();
  });
});

describe('applyCheckoutSessionToTenant — Free → Base', () => {
  it('scrive plan base + stripeSubscriptionId + expiryDate sul tenant registrato Free', async () => {
    const db = createFakeDb({ t1: freshFreeTenant() });
    const res = await applyCheckoutSessionToTenant(db, createFakeStripe(), checkoutSession(), 't1');
    expect(res.ok).toBe(true);
    expect(res.checkoutType).toBe('plan');
    const td = db.read('t1');
    expect(td.plan).toBe('base');
    expect(td.status).toBe('active');
    expect(td.stripeSubscriptionId).toBe('sub_base_1');
    expect(td.stripeCustomerId).toBe('cus_1');
    expect(td.expiryDate).toBeTruthy();
    // `piano: 'free'` storico resta nel doc: il resolver server deve dare priorità a `plan`.
    expect(td.piano).toBe('free');
  });

  it('rifiuta sessione di un altro tenant', async () => {
    const db = createFakeDb({ t1: freshFreeTenant(), t2: freshFreeTenant() });
    await expect(
      applyCheckoutSessionToTenant(db, createFakeStripe(), checkoutSession(), 't2')
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rifiuta pagamento non completato', async () => {
    const db = createFakeDb({ t1: freshFreeTenant() });
    const session = checkoutSession({ payment_status: 'unpaid', status: 'open' });
    await expect(
      applyCheckoutSessionToTenant(db, createFakeStripe(), session, 't1')
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('applyCheckoutSessionToTenant — modulo', () => {
  it('aggiunge il modulo a modules[] e registra stripeAddons (idempotente)', async () => {
    const db = createFakeDb({
      t1: { plan: 'base', piano: 'free', modules: ['magazzino'], stripeSubscriptionId: 'sub_base_1' },
    });
    const session = checkoutSession({
      id: 'cs_mod',
      subscription: 'sub_tony_1',
      metadata: { tenantId: 't1', checkoutType: 'module', catalogId: 'tony', moduleId: 'tony', uid: 'u1' },
    });
    await applyCheckoutSessionToTenant(db, createFakeStripe(), session, 't1');
    await applyCheckoutSessionToTenant(db, createFakeStripe(), session, 't1');
    const td = db.read('t1');
    expect(td.modules).toEqual(['magazzino', 'tony']);
    expect(td.stripeAddons.tony.type).toBe('module');
    expect(td.stripeAddons.tony.subscriptionId).toBe('sub_tony_1');
    expect(td.stripeAddons.tony.periodEnd).toBe(PERIOD_END);
    expect(td.plan).toBe('base');
  });
});

describe('webhook checkout.session.completed', () => {
  it('attiva il piano Base anche senza ritorno del client', async () => {
    const db = createFakeDb({ t1: freshFreeTenant() });
    const out = await handleStripeCheckoutSessionCompleted(db, createFakeStripe(), checkoutSession());
    expect(out.ok).toBe(true);
    expect(out.tenantId).toBe('t1');
    expect(db.read('t1').plan).toBe('base');
  });

  it('attiva un modulo da metadata', async () => {
    const db = createFakeDb({ t1: { plan: 'base', modules: [] } });
    const session = checkoutSession({
      subscription: 'sub_mod_1',
      metadata: { tenantId: 't1', checkoutType: 'module', catalogId: 'vigneto', moduleId: 'vigneto' },
    });
    const out = await handleStripeCheckoutSessionCompleted(db, createFakeStripe(), session);
    expect(out.ok).toBe(true);
    expect(db.read('t1').modules).toEqual(['vigneto']);
  });

  it('ignora sessioni non subscription, non pagate o senza tenant', async () => {
    const db = createFakeDb({ t1: freshFreeTenant() });
    const stripe = createFakeStripe();
    expect((await handleStripeCheckoutSessionCompleted(db, stripe, checkoutSession({ mode: 'payment' }))).ok).toBe(false);
    expect(
      (await handleStripeCheckoutSessionCompleted(db, stripe, checkoutSession({ payment_status: 'unpaid', status: 'open' }))).ok
    ).toBe(false);
    expect(
      (await handleStripeCheckoutSessionCompleted(db, stripe, checkoutSession({ metadata: {}, client_reference_id: null }))).ok
    ).toBe(false);
    expect(db.read('t1').plan).toBeUndefined();
    expect(db._updates).toHaveLength(0);
  });
});

describe('webhook customer.subscription.updated — subscription del piano', () => {
  it('tenant registrato Free (solo piano) → plan base, mai plan free', async () => {
    const db = createFakeDb({ t1: freshFreeTenant() });
    const subscription = {
      id: 'sub_base_1',
      status: 'active',
      customer: 'cus_1',
      current_period_end: PERIOD_END,
      cancel_at_period_end: false,
      metadata: { tenantId: 't1', checkoutType: 'plan', catalogId: 'base', planId: 'base' },
    };
    const out = await syncAddonFromStripeSubscription(db, subscription, 'customer.subscription.updated');
    expect(out).toMatchObject({ ok: true, scope: 'plan', action: 'sync' });
    const td = db.read('t1');
    expect(td.plan).toBe('base');
    expect(td.stripeSubscriptionId).toBe('sub_base_1');
  });

  it('subscription del piano cancellata → status expired (plan invariato)', async () => {
    const db = createFakeDb({ t1: { plan: 'base', stripeSubscriptionId: 'sub_base_1' } });
    const subscription = {
      id: 'sub_base_1',
      status: 'canceled',
      metadata: { tenantId: 't1', checkoutType: 'plan' },
    };
    const out = await syncAddonFromStripeSubscription(db, subscription, 'customer.subscription.deleted');
    expect(out).toMatchObject({ ok: true, scope: 'plan', action: 'expired' });
    expect(db.read('t1').status).toBe('expired');
    expect(db.read('t1').plan).toBe('base');
  });
});

/**
 * Piano tenant lato server (functions/tenant-plan.js): la regola usata da tonyAsk,
 * getTonyAudio, tonyTranscribeAudio, tonyExtractDocument, meteo e checkout Stripe.
 *
 * Caso reale: registrazione scrive `piano: 'free'`, Stripe scrive `plan: 'base'`.
 * Il doc contiene entrambi e `plan` deve vincere; un abbonamento Stripe Base attivo
 * vale Base anche se `plan` non è stato aggiornato (stessa regola del client).
 */
import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  normalizeSubscriptionPlanId,
  resolveTenantPlanId,
  hasActiveStripeBaseSubscription,
} = require('../functions/tenant-plan.js');

describe('tenant-plan — normalizeSubscriptionPlanId', () => {
  it('free / freemium → free, tutto il resto → base', () => {
    expect(normalizeSubscriptionPlanId('free')).toBe('free');
    expect(normalizeSubscriptionPlanId(' Freemium ')).toBe('free');
    expect(normalizeSubscriptionPlanId('base')).toBe('base');
    expect(normalizeSubscriptionPlanId('professional')).toBe('base');
    expect(normalizeSubscriptionPlanId(null)).toBe('base');
    expect(normalizeSubscriptionPlanId('')).toBe('base');
  });
});

describe('tenant-plan — resolveTenantPlanId', () => {
  it('tenant appena registrato (solo piano: free) → free', () => {
    expect(resolveTenantPlanId({ piano: 'free', moduli: [], stato: 'attivo' })).toBe('free');
  });

  it('dopo Stripe: plan base vince su piano free rimasto dalla registrazione', () => {
    const td = { piano: 'free', plan: 'base', stripeSubscriptionId: 'sub_1', status: 'active' };
    expect(resolveTenantPlanId(td)).toBe('base');
  });

  it('plan free ma abbonamento Stripe Base attivo → base (coerente con il client)', () => {
    const td = { piano: 'free', stripeSubscriptionId: 'sub_1', status: 'active' };
    expect(resolveTenantPlanId(td)).toBe('base');
    expect(resolveTenantPlanId({ plan: 'free', stripeSubscriptionId: 'sub_2' })).toBe('base');
    expect(resolveTenantPlanId({ plan: 'free', stripeSubscriptionId: 'sub_3', status: 'trialing' })).toBe('base');
  });

  it('plan free con abbonamento Stripe scaduto → resta free', () => {
    expect(resolveTenantPlanId({ plan: 'free', stripeSubscriptionId: 'sub_1', status: 'expired' })).toBe('free');
    expect(resolveTenantPlanId({ plan: 'free', stripeSubscriptionId: 'sub_1', status: 'canceled' })).toBe('free');
  });

  it('doc senza plan/piano: usa il valore inviato dal client, altrimenti base', () => {
    expect(resolveTenantPlanId({ nome: 'X' }, { fallbackRaw: 'free' })).toBe('free');
    expect(resolveTenantPlanId({ nome: 'X' })).toBe('base');
  });

  it('il valore client non sovrascrive il doc Firestore', () => {
    expect(resolveTenantPlanId({ plan: 'base' }, { fallbackRaw: 'free' })).toBe('base');
    expect(resolveTenantPlanId({ piano: 'free' }, { fallbackRaw: 'base' })).toBe('free');
  });

  it('hasActiveStripeBaseSubscription', () => {
    expect(hasActiveStripeBaseSubscription({})).toBe(false);
    expect(hasActiveStripeBaseSubscription({ stripeSubscriptionId: 'sub_1' })).toBe(true);
    expect(hasActiveStripeBaseSubscription({ stripeSubscriptionId: 'sub_1', status: 'expiring' })).toBe(true);
    expect(hasActiveStripeBaseSubscription({ stripeSubscriptionId: 'sub_1', status: 'expired' })).toBe(false);
  });
});

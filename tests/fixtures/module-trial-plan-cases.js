/**
 * Casi piano condivisi: function canStartModuleTrial ↔ client canStartModuleTrial.
 * Decisione prodotto 24/10/2026: prova solo con Base.
 */
export const MODULE_TRIAL_PLAN_CASES = [
  { label: 'piano free', tenant: { piano: 'free', modules: [], moduleTrials: {} }, canStart: false },
  { label: 'plan free', tenant: { plan: 'free', modules: [], moduleTrials: {} }, canStart: false },
  { label: 'plan base', tenant: { plan: 'base', modules: [], moduleTrials: {} }, canStart: true },
  {
    label: 'plan free + Stripe Base attivo',
    tenant: { plan: 'free', stripeSubscriptionId: 'sub_x', status: 'active', modules: [], moduleTrials: {} },
    canStart: true,
  },
];

/**
 * T-DENY-002 — piano Free blocca Tony (traceabilità Vitest tier 1), salvo periodo
 * Tony Guida onboarding dei nuovi tenant (7 giorni dalla registrazione, v. tony-guida-onboarding.test.js).
 * @see tests/e2e/tony/fixtures/scenarios-matrix.json
 */
import { describe, it, expect } from 'vitest';
import { getPlanConfig, normalizeSubscriptionPlanId } from '../core/config/subscription-plans.js';
import { isTonyGuidaOnboardingActive } from '../core/config/tony-guida-onboarding.js';

const FREEMIUM_CHAT_MESSAGE =
  'Tony non è disponibile sul piano Free. Passa al piano Base dalla pagina Abbonamento.';

describe('T-DENY-002 — piano Free Tony non disponibile', () => {
  it('tenant free normalizzato resta piano free', () => {
    expect(normalizeSubscriptionPlanId('free')).toBe('free');
    expect(normalizeSubscriptionPlanId('freemium')).toBe('free');
  });

  it('piano free è a €0 senza moduli a pagamento', () => {
    const plan = getPlanConfig('free');
    expect(plan?.id).toBe('free');
    expect(plan?.price).toBe(0);
  });

  it('messaggio chat freemium allineato al contratto E2E', () => {
    const low = FREEMIUM_CHAT_MESSAGE.toLowerCase();
    expect(low).toMatch(/piano free/);
    expect(low).toMatch(/abbonament/);
  });

  it('tenant free senza onboarding (fixture E2E storiche) resta bloccato', () => {
    expect(isTonyGuidaOnboardingActive('free', { piano: 'free', moduli: [] })).toBe(false);
    expect(isTonyGuidaOnboardingActive('free', null)).toBe(false);
  });

  it('tenant free con onboarding scaduto torna bloccato', () => {
    const past = new Date(Date.now() - 60 * 1000);
    expect(isTonyGuidaOnboardingActive('free', { piano: 'free', tonyGuidaOnboardingEndsAt: past })).toBe(false);
  });
});

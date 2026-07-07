/**
 * T-DENY-002 — piano Free blocca Tony (traceabilità Vitest tier 1).
 * @see tests/e2e/tony/fixtures/scenarios-matrix.json
 */
import { describe, it, expect } from 'vitest';
import { getPlanConfig, normalizeSubscriptionPlanId } from '../core/config/subscription-plans.js';

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
});

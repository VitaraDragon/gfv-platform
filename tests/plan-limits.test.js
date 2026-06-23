import { describe, it, expect } from 'vitest';
import {
  normalizeSubscriptionPlanId,
  getPlanOperationalLimits
} from '../core/config/subscription-plans.js';
import {
  monthKeyFromActivityDate,
  monthRangeFromKey,
  getLimitsForTenantData
} from '../core/services/plan-limits-service.js';

describe('subscription plan normalization', () => {
  it('maps freemium aliases to free', () => {
    expect(normalizeSubscriptionPlanId('free')).toBe('free');
    expect(normalizeSubscriptionPlanId('freemium')).toBe('free');
  });

  it('maps legacy starter to base', () => {
    expect(normalizeSubscriptionPlanId('starter')).toBe('base');
    expect(normalizeSubscriptionPlanId('professional')).toBe('base');
  });

  it('returns free limits from tenant piano', () => {
    const limits = getLimitsForTenantData({ piano: 'free' });
    expect(limits.planId).toBe('free');
    expect(limits.maxTerreni).toBe(5);
    expect(limits.maxAttivitaMese).toBe(30);
  });

  it('returns unlimited limits for base', () => {
    const limits = getPlanOperationalLimits('base');
    expect(limits.planId).toBe('base');
    expect(limits.maxTerreni).toBeNull();
    expect(limits.maxAttivitaMese).toBeNull();
  });
});

describe('plan-limits month helpers', () => {
  it('extracts month from activity date', () => {
    expect(monthKeyFromActivityDate('2026-06-15')).toBe('2026-06');
  });

  it('builds month range', () => {
    expect(monthRangeFromKey('2026-06')).toEqual({
      dataDa: '2026-06-01',
      dataA: '2026-06-30'
    });
  });
});

import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';
import { MODULE_TRIAL_PLAN_CASES } from './fixtures/module-trial-plan-cases.js';

const require = createRequire(import.meta.url);
const {
  MODULE_TRIAL_DAYS,
  MODULE_TRIAL_REQUIRES_BASE_REASON,
  canStartModuleTrial,
  resolveEffectiveModules,
  expireStaleModuleTrials,
  markModuleTrialConverted,
  handleStartModuleTrial,
} = require('../functions/module-trial.js');

function makeFakeDb({ userData, tenantData }) {
  let writeCount = 0;
  const lastUpdates = [];
  const tenantState = { ...(tenantData || {}) };

  const db = {
    collection(name) {
      return {
        doc(id) {
          if (name === 'users') {
            return {
              get: async () => ({
                exists: true,
                data: () => userData,
              }),
            };
          }
          if (name === 'tenants') {
            return {
              get: async () => ({
                exists: true,
                id,
                data: () => ({ ...tenantState }),
              }),
              update: async (payload) => {
                writeCount += 1;
                lastUpdates.push(payload);
                Object.assign(tenantState, payload);
              },
            };
          }
          return {
            get: async () => ({ exists: false, data: () => null }),
          };
        },
      };
    },
  };

  return {
    db,
    getWriteCount: () => writeCount,
    getLastUpdates: () => lastUpdates,
  };
}

describe('module-trial', () => {
  it('MODULE_TRIAL_DAYS is 30', () => {
    expect(MODULE_TRIAL_DAYS).toBe(30);
  });

  it.each(MODULE_TRIAL_PLAN_CASES)(
    'canStartModuleTrial — $label → canStart=$canStart',
    ({ tenant, canStart }) => {
      const result = canStartModuleTrial(tenant, 'vigneto');
      expect(result.canStart).toBe(canStart);
      if (!canStart && (tenant.plan === 'free' || tenant.piano === 'free') && !tenant.stripeSubscriptionId) {
        expect(result.reason).toBe(MODULE_TRIAL_REQUIRES_BASE_REASON);
      }
    }
  );

  it('canStartModuleTrial blocks first trial on free tenant', () => {
    const tenant = { plan: 'free', modules: [], moduleTrials: {} };
    const result = canStartModuleTrial(tenant, 'vigneto');
    expect(result.canStart).toBe(false);
    expect(result.reason).toMatch(/piano Base/i);
  });

  it('canStartModuleTrial allows first trial on base tenant', () => {
    const tenant = { plan: 'base', modules: [], moduleTrials: {} };
    const result = canStartModuleTrial(tenant, 'vigneto');
    expect(result.canStart).toBe(true);
  });

  it('handleStartModuleTrial rejects free plan without writing', async () => {
    const { db, getWriteCount } = makeFakeDb({
      userData: {
        tenantId: 't1',
        ruoli: ['manager'],
        tenantMemberships: { t1: { stato: 'attivo', ruoli: ['manager'] } },
      },
      tenantData: { plan: 'free', modules: [], moduleTrials: {} },
    });

    await expect(
      handleStartModuleTrial(db, {
        auth: { uid: 'u1' },
        data: { tenantId: 't1', moduleId: 'vigneto' },
      })
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: MODULE_TRIAL_REQUIRES_BASE_REASON,
    });
    expect(getWriteCount()).toBe(0);
  });

  it('canStartModuleTrial blocks second trial on different module while one active', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const tenant = {
      plan: 'base',
      modules: [],
      moduleTrials: {
        vigneto: {
          status: 'active',
          endsAt: new Date('2026-07-01T12:00:00Z'),
        },
      },
    };
    const result = canStartModuleTrial(tenant, 'frutteto', now);
    expect(result.canStart).toBe(false);
  });

  it('canStartModuleTrial allows vendemmiaMeccanica when contoTerzi active', () => {
    const tenant = { plan: 'base', modules: ['contoTerzi'], moduleTrials: {} };
    const result = canStartModuleTrial(tenant, 'vendemmiaMeccanica');
    expect(result.canStart).toBe(true);
  });

  it('canStartModuleTrial blocks vendemmiaMeccanica without contoTerzi', () => {
    const tenant = { plan: 'base', modules: [], moduleTrials: {} };
    const result = canStartModuleTrial(tenant, 'vendemmiaMeccanica');
    expect(result.canStart).toBe(false);
    expect(result.reason).toMatch(/Conto Terzi/i);
  });

  it('canStartModuleTrial blocks repeat trial for same module', () => {
    const tenant = {
      plan: 'base',
      modules: [],
      moduleTrials: {
        vigneto: { status: 'expired', endsAt: new Date('2026-01-01') },
      },
    };
    const result = canStartModuleTrial(tenant, 'vigneto');
    expect(result.canStart).toBe(false);
    expect(result.reason).toMatch(/già usato/i);
  });

  it('resolveEffectiveModules merges paid and active trial', () => {
    const tenant = {
      modules: ['manodopera'],
      moduleTrials: {
        vigneto: {
          status: 'active',
          endsAt: new Date('2030-01-01'),
        },
      },
    };
    expect(resolveEffectiveModules(tenant)).toEqual(['manodopera', 'vigneto']);
  });

  it('markModuleTrialConverted updates status', () => {
    const updated = markModuleTrialConverted(
      { vigneto: { status: 'active' } },
      'vigneto'
    );
    expect(updated.vigneto.status).toBe('converted');
  });

  it('expireStaleModuleTrials marks expired trials', async () => {
    const updates = [];
    const db = {
      collection: () => ({
        doc: () => ({
          update: async (payload) => updates.push(payload),
        }),
      }),
    };
    const tenant = {
      moduleTrials: {
        vigneto: {
          status: 'active',
          endsAt: new Date('2020-01-01'),
        },
      },
    };
    const result = await expireStaleModuleTrials(db, 'tenant-1', tenant, new Date('2026-01-01'));
    expect(result.expired).toEqual(['vigneto']);
    expect(updates[0]['moduleTrials.vigneto.status']).toBe('expired');
  });
});

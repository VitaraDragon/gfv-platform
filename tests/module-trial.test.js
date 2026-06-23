import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  MODULE_TRIAL_DAYS,
  canStartModuleTrial,
  resolveEffectiveModules,
  expireStaleModuleTrials,
  markModuleTrialConverted,
} = require('../functions/module-trial.js');

describe('module-trial', () => {
  it('MODULE_TRIAL_DAYS is 30', () => {
    expect(MODULE_TRIAL_DAYS).toBe(30);
  });

  it('canStartModuleTrial allows first trial on free tenant', () => {
    const tenant = { plan: 'free', modules: [], moduleTrials: {} };
    const result = canStartModuleTrial(tenant, 'vigneto');
    expect(result.canStart).toBe(true);
  });

  it('canStartModuleTrial blocks second trial on different module while one active', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const tenant = {
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

  it('canStartModuleTrial blocks repeat trial for same module', () => {
    const tenant = {
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

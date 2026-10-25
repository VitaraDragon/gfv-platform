import { readFileSync } from 'node:fs';
import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';
import {
  hasModuleAccessFromTenant,
  resolveEffectiveModules,
  getEffectiveModulesFromTenant,
  canStartModuleTrial,
  resolveModuleToggleIntent,
  MODULE_TRIAL_REQUIRES_BASE_REASON,
} from '../core/utils/module-access-resolver.js';
import { MODULE_TRIAL_PLAN_CASES } from './fixtures/module-trial-plan-cases.js';

const require = createRequire(import.meta.url);
const { canStartModuleTrial: canStartModuleTrialServer } = require('../functions/module-trial.js');

const now = new Date('2026-09-18T12:00:00Z');

describe('hasModuleAccessFromTenant — magazzino trial', () => {
  it('nega magazzino se né pagato né in prova', () => {
    const tenant = { modules: ['vigneto'], moduleTrials: {} };
    expect(hasModuleAccessFromTenant(tenant, 'magazzino', now)).toBe(false);
  });

  it('concede magazzino se pagato in tenant.modules', () => {
    const tenant = { modules: ['vigneto', 'magazzino'], moduleTrials: {} };
    expect(hasModuleAccessFromTenant(tenant, 'magazzino', now)).toBe(true);
  });

  it('concede magazzino se trial active anche senza modules pagati', () => {
    const tenant = {
      modules: ['vigneto'],
      moduleTrials: {
        magazzino: {
          status: 'active',
          endsAt: new Date('2026-10-18T12:00:00Z'),
        },
      },
    };
    expect(hasModuleAccessFromTenant(tenant, 'magazzino', now)).toBe(true);
    expect(resolveEffectiveModules(tenant, now)).toEqual(['vigneto', 'magazzino']);
  });

  it('nega magazzino se trial scaduto', () => {
    const tenant = {
      modules: ['vigneto'],
      moduleTrials: {
        magazzino: {
          status: 'active',
          endsAt: new Date('2026-08-01T12:00:00Z'),
        },
      },
    };
    expect(hasModuleAccessFromTenant(tenant, 'magazzino', now)).toBe(false);
  });

  it('nega magazzino se trial expired/converted', () => {
    const expired = {
      modules: [],
      moduleTrials: { magazzino: { status: 'expired', endsAt: new Date('2026-10-18') } },
    };
    const converted = {
      modules: [],
      moduleTrials: { magazzino: { status: 'converted', endsAt: new Date('2026-10-18') } },
    };
    expect(hasModuleAccessFromTenant(expired, 'magazzino', now)).toBe(false);
    expect(hasModuleAccessFromTenant(converted, 'magazzino', now)).toBe(false);
  });
});

describe('canStartModuleTrial client — allineato alla function (piano Base)', () => {
  it.each(MODULE_TRIAL_PLAN_CASES)(
    'client e server: $label → canStart=$canStart',
    ({ tenant, canStart }) => {
      const client = canStartModuleTrial(tenant, 'vigneto', { availableModuleIds: ['vigneto'] });
      const server = canStartModuleTrialServer(tenant, 'vigneto');
      expect(client.canStart).toBe(canStart);
      expect(server.canStart).toBe(canStart);
      expect(client.canStart).toBe(server.canStart);
      if (!canStart && !tenant.stripeSubscriptionId) {
        expect(client.reason).toBe(MODULE_TRIAL_REQUIRES_BASE_REASON);
        expect(server.reason).toBe(MODULE_TRIAL_REQUIRES_BASE_REASON);
      }
    }
  );
});

describe('getEffectiveModulesFromTenant', () => {
  it('include manodopera con sola prova attiva', () => {
    const tenant = {
      modules: [],
      moduleTrials: {
        manodopera: {
          status: 'active',
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    };
    expect(getEffectiveModulesFromTenant(tenant)).toContain('manodopera');
  });

  it('esclude prova scaduta (endsAt passato)', () => {
    const tenant = {
      modules: [],
      moduleTrials: {
        manodopera: {
          status: 'active',
          endsAt: new Date('2020-01-01'),
        },
      },
    };
    expect(getEffectiveModulesFromTenant(tenant, now)).not.toContain('manodopera');
  });

  it('esclude prova con status expired', () => {
    const tenant = {
      modules: [],
      moduleTrials: {
        manodopera: {
          status: 'expired',
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    };
    expect(getEffectiveModulesFromTenant(tenant, now)).not.toContain('manodopera');
  });

  it('gate manodopera: solo-prova aperto, scaduta bloccato', () => {
    const open = getEffectiveModulesFromTenant({
      modules: [],
      moduleTrials: {
        manodopera: { status: 'active', endsAt: new Date('2030-01-01') },
      },
    }, now);
    const closed = getEffectiveModulesFromTenant({
      modules: [],
      moduleTrials: {
        manodopera: { status: 'active', endsAt: new Date('2020-01-01') },
      },
    }, now);
    expect(open.includes('manodopera')).toBe(true);
    expect(closed.includes('manodopera')).toBe(false);
  });
});

describe('resolveModuleToggleIntent — Free prima della prova', () => {
  it('su Free non propone start_trial', () => {
    const intent = resolveModuleToggleIntent(
      { plan: 'free', modules: [], moduleTrials: {} },
      'vigneto',
      { availableModuleIds: ['vigneto'] }
    );
    expect(intent.action).toBe('require_base');
    expect(intent.action).not.toBe('start_trial');
    expect(intent.reason).toBe(MODULE_TRIAL_REQUIRES_BASE_REASON);
  });

  it('su Base propone start_trial se eleggibile', () => {
    const intent = resolveModuleToggleIntent(
      { plan: 'base', modules: [], moduleTrials: {} },
      'vigneto',
      { availableModuleIds: ['vigneto'] }
    );
    expect(intent.action).toBe('start_trial');
  });
});

describe('pagine gate — moduli effettivi (statico)', () => {
  it('Gestione lavori usa getEffectiveModulesFromTenant, non tenantData.modules grezzo per il gate', () => {
    const src = readFileSync(
      new URL('../core/admin/gestione-lavori-standalone.html', import.meta.url),
      'utf8'
    );
    expect(src).toContain('getEffectiveModulesFromTenant');
    expect(src).not.toMatch(
      /const modules = Array\.isArray\(tenantData\?\.modules\) \? tenantData\.modules : \[\]/
    );
  });

  it('home Manodopera usa getEffectiveModulesFromTenant, non tenantDoc.data().modules grezzo', () => {
    const src = readFileSync(
      new URL('../modules/manodopera/views/manodopera-home-standalone.html', import.meta.url),
      'utf8'
    );
    expect(src).toContain('getEffectiveModulesFromTenant');
    expect(src).not.toMatch(
      /Array\.isArray\(tenantDoc\.data\(\)\.modules\) \? tenantDoc\.data\(\)\.modules/
    );
  });

  it('Abbonamento valuta Free (require_base) prima di startModuleTrial', () => {
    const src = readFileSync(
      new URL('../core/admin/abbonamento-standalone.html', import.meta.url),
      'utf8'
    );
    expect(src).toContain('resolveModuleToggleIntent');
    const requireIdx = src.indexOf("toggleIntent.action === 'require_base'");
    const trialIdx = src.indexOf("toggleIntent.action === 'start_trial'");
    const callableIdx = src.indexOf("getHttpsCallable('startModuleTrial')");
    expect(requireIdx).toBeGreaterThan(-1);
    expect(trialIdx).toBeGreaterThan(requireIdx);
    expect(callableIdx).toBeGreaterThan(trialIdx);
  });
});

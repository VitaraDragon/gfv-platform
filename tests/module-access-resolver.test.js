import { describe, it, expect } from 'vitest';
import {
  hasModuleAccessFromTenant,
  resolveEffectiveModules,
} from '../core/utils/module-access-resolver.js';

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

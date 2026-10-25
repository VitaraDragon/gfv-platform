/**
 * @vitest-environment node
 */
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  belongsToTenant,
  hasRole,
  rolesForTenant,
  isManagerOrAdmin,
} = require('../../functions/lib/tenant-membership-access.js');

describe('tenant-membership-access (membership autorevole)', () => {
  it('membership disattivata vince sul tenantId deprecato: niente accesso', () => {
    const user = {
      tenantId: 'A',
      ruoli: ['amministratore'],
      tenantMemberships: {
        A: { ruoli: ['amministratore'], stato: 'disattivato' },
      },
    };
    expect(belongsToTenant(user, 'A')).toBe(false);
    expect(hasRole(user, 'amministratore', 'A')).toBe(false);
    expect(rolesForTenant(user, 'A')).toEqual([]);
  });

  it('solo deprecato: accesso e ruoli ok (compatibilità)', () => {
    const user = { tenantId: 'A', ruoli: ['amministratore'] };
    expect(belongsToTenant(user, 'A')).toBe(true);
    expect(hasRole(user, 'amministratore', 'A')).toBe(true);
    expect(isManagerOrAdmin(user, 'A')).toBe(true);
  });

  it('membership attiva: accesso; chiave assente su altro tenant: no', () => {
    const user = {
      tenantId: 'A',
      ruoli: ['amministratore'],
      tenantMemberships: {
        B: { ruoli: ['operaio'], stato: 'attivo' },
      },
    };
    expect(belongsToTenant(user, 'A')).toBe(true);
    expect(belongsToTenant(user, 'B')).toBe(true);
    expect(rolesForTenant(user, 'B')).toEqual(['operaio']);
    expect(rolesForTenant(user, 'A')).toEqual(['amministratore']);
  });

  it('membership A presente con ruoli diversi: ignora ruoli deprecati', () => {
    const user = {
      tenantId: 'A',
      ruoli: ['amministratore'],
      tenantMemberships: {
        A: { ruoli: ['operaio'], stato: 'attivo' },
      },
    };
    expect(rolesForTenant(user, 'A')).toEqual(['operaio']);
    expect(hasRole(user, 'amministratore', 'A')).toBe(false);
  });
});

/**
 * Client: getUserTenantsFromData, resolver, accesso membership.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../core/services/firebase-service.js', () => ({
  getDocumentData: vi.fn(),
  getCollectionData: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  getAuthInstance: vi.fn(() => ({ currentUser: null })),
  getCollection: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

import {
  getUserTenantsFromData,
  userHasAccessToTenant,
  resolveTenantIdForUser,
  getUserRolesFromData,
} from '../core/services/tenant-service.js';

function voceCambiaAziendaVisibile(numeroAziende) {
  const n = Number(numeroAziende);
  return Number.isFinite(n) && n >= 2;
}

async function aziendePerSwitch(userData, { getUserTenantsFromData: getTenants, getUserTenantsWithNamesFromData }) {
  if (!userData) return [];
  const memberships = getTenants(userData);
  if (memberships.length <= 1) return memberships;
  return getUserTenantsWithNamesFromData(userData);
}

describe('getUserTenantsFromData / resolver membership', () => {
  const store = {};
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    const storageApi = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    };
    vi.stubGlobal('sessionStorage', storageApi);
    vi.stubGlobal('localStorage', storageApi);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unisce tenantId deprecato e membership B senza doppioni su A', () => {
    const user = {
      tenantId: 'A',
      ruoli: ['amministratore'],
      tenantMemberships: {
        B: { ruoli: ['operaio'], stato: 'attivo' },
      },
    };
    const tenants = getUserTenantsFromData(user);
    expect(tenants.map((t) => t.tenantId).sort()).toEqual(['A', 'B']);
    expect(tenants.find((t) => t.tenantId === 'A').ruoli).toEqual(['amministratore']);
    expect(tenants.find((t) => t.tenantId === 'B').ruoli).toEqual(['operaio']);
    expect(tenants.find((t) => t.tenantId === 'A').tenantIdPredefinito).toBe(true);
  });

  it('solo deprecato → [A]; membership A presente → nessun doppione', () => {
    expect(getUserTenantsFromData({ tenantId: 'A', ruoli: ['manager'] })).toEqual([
      expect.objectContaining({ tenantId: 'A', ruoli: ['manager'], tenantIdPredefinito: true }),
    ]);
    const withMem = getUserTenantsFromData({
      tenantId: 'A',
      ruoli: ['amministratore'],
      tenantMemberships: { A: { ruoli: ['operaio'], stato: 'attivo' } },
    });
    expect(withMem).toHaveLength(1);
    expect(withMem[0].ruoli).toEqual(['operaio']);
  });

  it('aziendePerSwitch e voceCambiaAziendaVisibile → 2 aziende', async () => {
    const user = {
      tenantId: 'A',
      ruoli: ['amministratore'],
      tenantMemberships: { B: { ruoli: ['operaio'], stato: 'attivo' } },
    };
    const list = await aziendePerSwitch(user, {
      getUserTenantsFromData,
      getUserTenantsWithNamesFromData: async (ud) =>
        getUserTenantsFromData(ud).map((t) => ({ ...t, nome: t.tenantId })),
    });
    expect(list).toHaveLength(2);
    expect(voceCambiaAziendaVisibile(list.length)).toBe(true);
  });

  it('resolver: sessionStorage valido rispettato, non valido ignorato', () => {
    const user = {
      tenantId: 'A',
      ruoli: ['amministratore'],
      tenantMemberships: {
        B: { ruoli: ['operaio'], stato: 'attivo' },
      },
    };
    store.gfv_current_tenant_id = 'B';
    expect(resolveTenantIdForUser(user)).toBe('B');
    store.gfv_current_tenant_id = 'Z-inexistent';
    const tid = resolveTenantIdForUser(user);
    expect(['A', 'B']).toContain(tid);
    expect(tid).not.toBe('Z-inexistent');
  });

  it('userHasAccessToTenant: membership disattivata vince sul deprecato', () => {
    const user = {
      tenantId: 'A',
      ruoli: ['amministratore'],
      tenantMemberships: { A: { ruoli: ['amministratore'], stato: 'disattivato' } },
    };
    expect(userHasAccessToTenant(user, 'A')).toBe(false);
    expect(getUserRolesFromData(user, 'A')).toEqual([]);
  });
});

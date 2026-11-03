/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  updateDoc: vi.fn(async () => {}),
  getDb: vi.fn(() => ({})),
  getCurrentTenantId: vi.fn(() => 't1'),
  doc: (...args) => ({ path: args.join('/'), id: args[args.length - 1] }),
}));

vi.mock('../core/services/firebase-service.js', () => ({
  getDb: mocks.getDb,
  getDoc: mocks.getDoc,
  updateDoc: mocks.updateDoc,
  doc: mocks.doc,
}));

vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: mocks.getCurrentTenantId,
}));

import { aggiornaOreMacchinaDaUtilizzo } from '../modules/parco-macchine/services/macchine-utilizzo-service.js';

describe('macchine-utilizzo-service con prova Parco Macchine', () => {
  beforeEach(() => {
    mocks.getDoc.mockReset();
    mocks.updateDoc.mockReset();
  });

  it('con Parco Macchine solo in prova, oreAttuali aumenta', async () => {
    const futuro = new Date(Date.now() + 86400000);
    mocks.getDoc.mockImplementation(async (ref) => {
      const path = String(ref.path || '');
      if (path.includes('tenants/t1') && !path.includes('macchine')) {
        return {
          exists: () => true,
          data: () => ({
            modules: [],
            moduleTrials: { parcoMacchine: { status: 'active', endsAt: futuro } }
          })
        };
      }
      if (path.includes('macchine')) {
        return {
          exists: () => true,
          data: () => ({ oreAttuali: 10, oreIniziali: 10 })
        };
      }
      return { exists: () => false, data: () => ({}) };
    });

    const result = await aggiornaOreMacchinaDaUtilizzo({
      macchinaId: 'm1',
      oreMacchina: 2,
      tenantId: 't1'
    });

    expect(result.macchinaAggiornata).toBe(true);
    expect(mocks.updateDoc).toHaveBeenCalled();
    const updateArg = mocks.updateDoc.mock.calls.find((c) => c[1] && c[1].oreAttuali != null);
    expect(updateArg[1].oreAttuali).toBe(12);
  });
});

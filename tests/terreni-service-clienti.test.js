import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../core/services/firebase-service.js', () => ({
  getCollectionData: vi.fn()
}));

vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => 'tenant-1')
}));

vi.mock('../core/services/plan-limits-service.js', () => ({
  assertCanCreateTerreno: vi.fn()
}));

import { getCollectionData } from '../core/services/firebase-service.js';
import { getAllTerreni } from '../core/services/terreni-service.js';

describe('getAllTerreni includeTerreniClienti', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCollectionData.mockResolvedValue([
      { id: 'a1', nome: 'Azienda', clienteId: null },
      { id: 'c1', nome: 'Vigneto Rossi', clienteId: 'cliente-1', colturaCategoria: 'vite-cat' },
      { id: 'c2', nome: 'Frutteto Rossi', clienteId: 'cliente-1', colturaCategoria: 'frutt-cat' }
    ]);
  });

  it('default esclude terreni clienti', async () => {
    const list = await getAllTerreni();
    expect(list.map((t) => t.id)).toEqual(['a1']);
  });

  it('includeTerreniClienti restituisce anche terreni CT', async () => {
    const list = await getAllTerreni({ includeTerreniClienti: true });
    expect(list.map((t) => t.id).sort()).toEqual(['a1', 'c1', 'c2']);
  });

  it('clienteId filtra un solo cliente', async () => {
    const list = await getAllTerreni({ clienteId: 'cliente-1' });
    expect(list.map((t) => t.id).sort()).toEqual(['c1', 'c2']);
  });
});

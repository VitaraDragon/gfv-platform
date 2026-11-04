import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../core/services/firebase-service.js', () => ({
  getCollectionData: vi.fn()
}));

vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => 'tenant-1'),
  getCurrentTenant: vi.fn()
}));

import { getCollectionData } from '../core/services/firebase-service.js';
import { countAziendaTerreni } from '../core/services/plan-limits-service.js';

describe('countAziendaTerreni', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCollectionData.mockResolvedValue([
      { id: 'a', nome: 'Attivo' },
      { id: 'b', nome: 'Vecchio', stato: 'archiviato' },
      { id: 'c', nome: 'Cliente', clienteId: 'cli-1' },
      { id: 'd', nome: 'Senza stato' }
    ]);
  });

  it('gli archiviati e i terreni cliente non contano', async () => {
    await expect(countAziendaTerreni('tenant-1')).resolves.toBe(2);
  });
});

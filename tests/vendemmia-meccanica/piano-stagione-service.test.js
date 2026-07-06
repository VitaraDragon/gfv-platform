import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockUpdateDocument = vi.fn();
const mockGetTerreno = vi.fn();
const mockGetCurrentTenantId = vi.fn(() => 'tenant-1');

vi.mock('../../core/services/terreni-service.js', () => ({
  getTerreno: (...args) => mockGetTerreno(...args),
  getAllTerreni: vi.fn()
}));

vi.mock('../../core/services/firebase-service.js', () => ({
  updateDocument: (...args) => mockUpdateDocument(...args)
}));

vi.mock('../../core/services/tenant-service.js', () => ({
  getCurrentTenantId: () => mockGetCurrentTenantId()
}));

vi.mock('../../conto-terzi/services/clienti-service.js', () => ({
  getAllClienti: vi.fn()
}));

import { updateStagioneTerreno } from '../../modules/vendemmia-meccanica/services/piano-stagione-service.js';

describe('updateStagioneTerreno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTerreno.mockResolvedValue({
      id: 't1',
      superficie: 5,
      vendemmiaMeccanica: { '2025': { inPiano: true } }
    });
    mockUpdateDocument.mockResolvedValue(undefined);
  });

  test('persiste zoneEscluse con update parziale su vendemmiaMeccanica', async () => {
    const zones = [{
      coordinates: [
        { lat: 44.1, lng: 11.1 },
        { lat: 44.2, lng: 11.1 },
        { lat: 44.15, lng: 11.2 }
      ]
    }];

    const saved = await updateStagioneTerreno('t1', 2026, {
      zoneEscluse: zones,
      ettariEsclusi: 0.8,
      ettariVendemmiati: 4.2
    });

    expect(mockUpdateDocument).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDocument.mock.calls[0][2];
    expect(payload.vendemmiaMeccanica['2026'].zoneEscluse).toHaveLength(1);
    expect(payload.vendemmiaMeccanica['2026'].ettariEsclusi).toBe(0.8);
    expect(payload.vendemmiaMeccanica['2026'].ettariVendemmiati).toBe(4.2);
    expect(payload.vendemmiaMeccanica['2025'].inPiano).toBe(true);
    expect(saved.zoneEscluse).toHaveLength(1);
  });
});

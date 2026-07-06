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

vi.mock('../../modules/conto-terzi/services/clienti-service.js', () => ({
  getAllClienti: vi.fn()
}));

vi.mock('../../modules/vendemmia-meccanica/services/calcolo-compenso-vm-service.js', () => ({
  getEttariEffettivi: vi.fn(() => ({ ettari: 5, warning: null }))
}));

vi.mock('../../modules/vendemmia-meccanica/services/zone-escluse-service.js', () => ({
  buildStagioneWithNetArea: vi.fn((merged) => merged),
  sanitizeZoneEscluse: vi.fn((z) => z)
}));

vi.mock('../../modules/vendemmia-meccanica/services/piano-stagione-utils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    filterRigheVigneto: vi.fn((rows) => rows),
    buildVignetoDetectionContext: vi.fn()
  };
});

import { getAllTerreni } from '../../core/services/terreni-service.js';
import { getAllClienti } from '../../modules/conto-terzi/services/clienti-service.js';
import { updateStagioneTerreno, getPianoStagioneRows } from '../../modules/vendemmia-meccanica/services/piano-stagione-service.js';

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

describe('getPianoStagioneRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllClienti.mockResolvedValue([
      { id: 'c1', ragioneSociale: 'Rossi' }
    ]);
    getAllTerreni.mockResolvedValue([
      {
        id: 't1',
        nome: 'Vigneto A',
        clienteId: 'c1',
        superficie: 3,
        colturaCategoria: 'vite',
        vendemmiaMeccanica: {
          '2026': {
            inPiano: true,
            vendemmiato: true,
            lavoroId: 'lav-1',
            preventivoId: 'prev-1'
          }
        }
      }
    ]);
  });

  test('espone lavoroId e preventivoId sulla riga', async () => {
    const rows = await getPianoStagioneRows(2026, { soloVigneti: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].lavoroId).toBe('lav-1');
    expect(rows[0].preventivoId).toBe('prev-1');
    expect(rows[0].clienteNome).toBe('Rossi');
  });
});

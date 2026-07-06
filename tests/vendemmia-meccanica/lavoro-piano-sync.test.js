import { describe, test, expect } from 'vitest';
import {
  zoneLavorateToVendemmiate,
  deriveAnnoStagioneFromLavoro,
  sumSuperficieHaZoneLavorate
} from '../../modules/vendemmia-meccanica/services/lavoro-piano-sync-service.js';

describe('lavoro-piano-sync-service', () => {
  test('zoneLavorateToVendemmiate — solo poligoni chiusi', () => {
    const out = zoneLavorateToVendemmiate([
      {
        isChiuso: true,
        tipo: 'poligono',
        coordinate: [
          { lat: 44.1, lng: 11.1 },
          { lat: 44.2, lng: 11.1 },
          { lat: 44.15, lng: 11.2 }
        ],
        superficieHa: 1.2,
        data: '2026-09-10'
      },
      {
        isChiuso: false,
        coordinate: [{ lat: 44, lng: 11 }, { lat: 44.01, lng: 11.01 }]
      }
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].superficieHa).toBe(1.2);
    expect(out[0].data).toBe('2026-09-10');
    expect(out[0].coordinates).toHaveLength(3);
  });

  test('deriveAnnoStagioneFromLavoro — da dataInizio', () => {
    expect(deriveAnnoStagioneFromLavoro({ dataInizio: new Date('2026-08-01') })).toBe(2026);
  });

  test('sumSuperficieHaZoneLavorate', () => {
    expect(sumSuperficieHaZoneLavorate([
      { superficieHa: 1.5 },
      { superficieHa: 0.5 },
      { superficieHa: null }
    ])).toBe(2);
  });
});

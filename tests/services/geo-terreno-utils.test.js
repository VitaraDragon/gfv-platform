/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  haversineKm,
  resolveTerrenoPoint,
  computeProximityMeta
} from '../../core/services/geo-terreno-utils.js';

describe('geo-terreno-utils', () => {
  test('haversine: stessa posizione → 0', () => {
    expect(haversineKm({ lat: 45, lng: 9 }, { lat: 45, lng: 9 })).toBeCloseTo(0, 5);
  });

  test('haversine: distanza Milano–Roma ~477 km', () => {
    const km = haversineKm(
      { lat: 45.4642, lng: 9.19 },
      { lat: 41.9028, lng: 12.4964 }
    );
    expect(km).toBeGreaterThan(450);
    expect(km).toBeLessThan(520);
  });

  test('resolveTerrenoPoint preferisce coordinate', () => {
    const p = resolveTerrenoPoint({
      coordinate: { lat: 45.1, lng: 9.2 },
      polygonCoords: [
        { lat: 0, lng: 0 },
        { lat: 1, lng: 1 },
        { lat: 0, lng: 1 }
      ]
    });
    expect(p).toEqual({ lat: 45.1, lng: 9.2 });
  });

  test('stesso terreno → 0 km e label', () => {
    const meta = computeProximityMeta(
      { id: 'T1', podere: 'Nord', coordinate: { lat: 45, lng: 9 } },
      { id: 'T1', podere: 'Nord', coordinate: { lat: 45, lng: 9 } },
      'T1',
      'T1'
    );
    expect(meta.stessoTerreno).toBe(true);
    expect(meta.distanzaKm).toBe(0);
    expect(meta.prossimitaLabel).toBe('Stesso terreno');
  });

  test('stesso podere diverso terreno', () => {
    const meta = computeProximityMeta(
      { id: 'T1', podere: 'Nord', coordinate: { lat: 45.0, lng: 9.0 } },
      { id: 'T2', podere: 'Nord', coordinate: { lat: 45.01, lng: 9.01 } },
      'T1',
      'T2'
    );
    expect(meta.stessoTerreno).toBe(false);
    expect(meta.stessoPodere).toBe(true);
    expect(meta.distanzaKm).not.toBeNull();
    expect(meta.prossimitaLabel).toMatch(/Stesso podere/);
  });
});

/**
 * Test zone escluse VM — helper puri
 */

import { describe, test, expect } from 'vitest';
import {
  normalizeLatLngCoord,
  serializePolygonPath,
  sanitizeZoneEscluse,
  computeEttariVendemmiati,
  sumExcludedAreaHectares,
  buildStagioneWithNetArea,
  shouldAutoGenerateZoneEscluse,
  computeZoneEscluseAutomatiche
} from '../../modules/vendemmia-meccanica/services/zone-escluse-service.js';

describe('zone-escluse-service', () => {
  test('normalizeLatLngCoord da plain object', () => {
    expect(normalizeLatLngCoord({ lat: 44.1, lng: 11.2 })).toEqual({ lat: 44.1, lng: 11.2 });
  });

  test('normalizeLatLngCoord da LatLng-like', () => {
    expect(normalizeLatLngCoord({ lat: () => 44.5, lng: () => 11.3 })).toEqual({ lat: 44.5, lng: 11.3 });
  });

  test('serializePolygonPath filtra invalidi', () => {
    const path = [{ lat: 1, lng: 2 }, null, { lat: 3, lng: 4 }];
    expect(serializePolygonPath(path)).toEqual([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]);
  });

  test('sumExcludedAreaHectares con mock geometry', () => {
    const mockMaps = {
      LatLng: function (lat, lng) { this.lat = lat; this.lng = lng; },
      geometry: {
        spherical: {
          computeArea: () => 25000
        }
      }
    };
    const zones = [{ coordinates: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }] }];
    expect(sumExcludedAreaHectares(zones, mockMaps)).toBe(2.5);
  });

  test('buildStagioneWithNetArea calcola ettari da poligoni', () => {
    const mockMaps = {
      LatLng: function (lat, lng) { this.lat = lat; this.lng = lng; },
      geometry: { spherical: { computeArea: () => 10000 } }
    };
    const out = buildStagioneWithNetArea(
      { zoneEscluse: [{ coordinates: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }] }] },
      5,
      { mapsApi: mockMaps }
    );
    expect(out.ettariEsclusi).toBe(1);
    expect(out.ettariVendemmiati).toBe(4);
  });

  test('sanitizeZoneEscluse filtra zone invalide', () => {
    const out = sanitizeZoneEscluse([
      { coordinates: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }] },
      { coordinates: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }] }
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].coordinates).toHaveLength(3);
  });

  test('computeEttariVendemmiati rispetta override manuale', () => {
    expect(computeEttariVendemmiati(10, { ettariVendemmiatiManuali: 7.5 })).toBe(7.5);
  });

  test('shouldAutoGenerateZoneEscluse — rispetta flag manuali', () => {
    expect(shouldAutoGenerateZoneEscluse(null)).toBe(true);
    expect(shouldAutoGenerateZoneEscluse({ zoneEscluseModificateManualmente: true })).toBe(false);
    expect(shouldAutoGenerateZoneEscluse({
      zoneEscluse: [{ coordinates: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }] }],
      zoneEscluseAutoDaLavoro: true
    })).toBe(true);
    expect(shouldAutoGenerateZoneEscluse({
      zoneEscluse: [{ coordinates: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }] }]
    })).toBe(false);
  });

  test('computeZoneEscluseAutomatiche — differenza geometrica terreno/vendemmiato', async () => {
    const terreno = [
      { lat: 44.0, lng: 11.0 },
      { lat: 44.0, lng: 11.01 },
      { lat: 44.01, lng: 11.01 },
      { lat: 44.01, lng: 11.0 }
    ];
    const zoneVendemmiate = [{
      coordinates: [
        { lat: 44.0, lng: 11.0 },
        { lat: 44.0, lng: 11.005 },
        { lat: 44.005, lng: 11.005 },
        { lat: 44.005, lng: 11.0 }
      ]
    }];
    const out = await computeZoneEscluseAutomatiche({
      terrenoPolygonCoords: terreno,
      zoneVendemmiate,
      ettariTotali: 10,
      ettariVendemmiati: 2.5
    });
    expect(out.ettariEsclusi).toBe(7.5);
    expect(out.fromGeometry).toBe(true);
    expect(out.zoneEscluse.length).toBeGreaterThan(0);
  });
});

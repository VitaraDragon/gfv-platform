/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  leggiEsitoAutoPinLocale,
  memorizzaEsitoAutoPinLocale,
  risolviPinSedeConRipiego,
  tryAutoSaveSedePinOnFirstAccess,
  ottieniGeocoder,
} from '../core/js/sede-auto-pin.js';

const FIX = join(process.cwd(), 'tests/fixtures/geocode');

function loadResults(name) {
  return JSON.parse(readFileSync(join(FIX, name), 'utf8')).results;
}

function makeGeocoder(map) {
  return {
    geocode(req, cb) {
      const key = String(req.address || '');
      let results = [];
      for (const [needle, name] of Object.entries(map)) {
        if (key.toLowerCase().includes(needle.toLowerCase())) {
          results = loadResults(name);
          break;
        }
      }
      cb(results, results.length ? 'OK' : 'ZERO_RESULTS');
    },
  };
}

describe('sede-auto-pin', () => {
  const tenantId = 't-test-pin';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('chiave v2: esito vecchio v1 non blocca un nuovo tentativo', () => {
    localStorage.setItem(
      'gfv_sede_auto_pin_' + tenantId,
      JSON.stringify({ attempted: true, failed: true })
    );
    expect(leggiEsitoAutoPinLocale(tenantId)).toEqual({ attempted: false, failed: false });
    memorizzaEsitoAutoPinLocale(tenantId, { attempted: true, failed: true });
    expect(localStorage.getItem('gfv_sede_auto_pin_v2_' + tenantId)).toBeTruthy();
    expect(leggiEsitoAutoPinLocale(tenantId).failed).toBe(true);
  });

  it('Lugo: civico a Fusignano → ripiego al centro di Lugo', async () => {
    const geocoder = makeGeocoder({
      'Via Garibaldi': 'via-garibaldi-10-lugo.json',
      Lugo: 'lugo-ra.json',
    });
    const r = await risolviPinSedeConRipiego({
      geocoder,
      queryIndirizzo: 'Via Garibaldi 10, Lugo, RA, Italia',
      comune: 'Lugo',
      provincia: 'RA',
    });
    expect(r.mode).toBe('centro');
    expect(r.coords.lat).toBeCloseTo(44.4213, 3);
  });

  it('Bagnacavallo: civico trovato (admin3) → pin sul civico', async () => {
    const geocoder = makeGeocoder({
      Mazzini: 'via-mazzini-5-bagnacavallo.json',
      Bagnacavallo: 'bagnacavallo-ra.json',
    });
    const r = await risolviPinSedeConRipiego({
      geocoder,
      queryIndirizzo: 'Via Mazzini 5, Bagnacavallo, RA, Italia',
      comune: 'Bagnacavallo',
      provincia: 'RA',
    });
    expect(r.mode).toBe('civico');
    expect(r.coords.lat).toBeCloseTo(44.4175, 3);
  });

  it('tryAutoSave: Geocoder da importLibrary → salva', async () => {
    const geocoderInstance = makeGeocoder({
      Mazzini: 'via-mazzini-5-bagnacavallo.json',
    });
    const Geocoder = function () {
      return geocoderInstance;
    };
    vi.stubGlobal('google', {
      maps: {
        Geocoder,
        importLibrary: vi.fn(async (name) => {
          if (name === 'geocoding') {
            google.maps.Geocoder = Geocoder;
          }
          return {};
        }),
      },
    });
    // simula Geocoder assente finché non arriva importLibrary
    delete google.maps.Geocoder;

    const updates = [];
    const avvisi = [];
    const out = await tryAutoSaveSedePinOnFirstAccess({
      tenantId,
      ruolo: 'admin',
      tenantData: {
        indirizzo: 'Via Mazzini 5',
        citta: 'Bagnacavallo',
        provincia: 'RA',
      },
      loadGoogleMapsAPI: async () => {},
      updateTenant: async (data) => {
        updates.push(data);
      },
      onAvviso: (m) => avvisi.push(m),
    });
    expect(out.saved).toBe(true);
    expect(updates[0].sedeCoordinate.lat).toBeCloseTo(44.4175, 3);
    expect(avvisi).toHaveLength(0);
  });

  it('ottieniGeocoder usa importLibrary se Geocoder manca', async () => {
    const Geocoder = function () {
      return { geocode() {} };
    };
    vi.stubGlobal('google', {
      maps: {
        importLibrary: vi.fn(async () => {
          google.maps.Geocoder = Geocoder;
          return {};
        }),
      },
    });
    const g = await ottieniGeocoder();
    expect(g).toBeTruthy();
    expect(google.maps.importLibrary).toHaveBeenCalledWith('geocoding');
  });
});

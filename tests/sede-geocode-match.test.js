import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  normalizzaComunePerMatch,
  scegliGeocodeNelComune,
  scegliCentroComune,
  nomiComuneDaGeocodeResult,
  deveTentareAutoPinSede,
} from '../core/js/sede-geocode-match.js';

const FIX = join(process.cwd(), 'tests/fixtures/geocode');

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIX, name), 'utf8'));
}

function withLatLngFns(results) {
  return results.map((r) => {
    const loc = r.geometry && r.geometry.location;
    if (!loc) return r;
    return {
      ...r,
      geometry: {
        ...r.geometry,
        location: {
          lat: typeof loc.lat === 'function' ? loc.lat : () => loc.lat,
          lng: typeof loc.lng === 'function' ? loc.lng : () => loc.lng,
        },
      },
    };
  });
}

function result(comune, types = ['locality'], extra = {}) {
  return {
    formatted_address: `Via Garibaldi 10, ${comune}`,
    geometry: { location: { lat: () => 1, lng: () => 2 } },
    address_components: [{ long_name: comune, short_name: comune, types }],
    ...extra,
  };
}

describe('sede-geocode-match', () => {
  it('sceglie Lugo anche se results[0] è Fusignano', () => {
    const chosen = scegliGeocodeNelComune(
      [result('Fusignano'), result('Lugo')],
      'Lugo'
    );
    expect(chosen).toBeTruthy();
    expect(chosen.address_components[0].long_name).toBe('Lugo');
  });

  it('nessun risultato nel comune → null', () => {
    expect(scegliGeocodeNelComune([result('Fusignano'), result('Bagnacavallo')], 'Lugo')).toBeNull();
  });

  it('accenti e maiuscole non contano', () => {
    const chosen = scegliGeocodeNelComune(
      [result('Forlì'), result('Cesena')],
      'FORLI'
    );
    expect(chosen.address_components[0].long_name).toBe('Forlì');
    expect(normalizzaComunePerMatch("Sant'Agata")).toBe('santagata');
  });

  it('accetta admin3 = comune anche se locality è frazione', () => {
    const fx = withLatLngFns(loadFixture('via-mazzini-5-bagnacavallo.json').results);
    const chosen = scegliGeocodeNelComune(fx, 'Bagnacavallo');
    expect(chosen).toBeTruthy();
    expect(nomiComuneDaGeocodeResult(chosen)).toEqual(
      expect.arrayContaining(['Villanova', 'Bagnacavallo'])
    );
  });

  it('preferisce street_address senza partial_match rispetto a route', () => {
    const route = {
      types: ['route'],
      partial_match: true,
      geometry: { location: { lat: () => 1, lng: () => 1 } },
      address_components: [
        { long_name: 'Lugo', short_name: 'Lugo', types: ['locality', 'political'] },
      ],
    };
    const civico = {
      types: ['street_address'],
      geometry: { location: { lat: () => 2, lng: () => 2 } },
      address_components: [
        { long_name: 'Lugo', short_name: 'Lugo', types: ['locality', 'political'] },
      ],
    };
    expect(scegliGeocodeNelComune([route, civico], 'Lugo')).toBe(civico);
  });

  it('fixture Lugo indirizzo → nessun match; centro Lugo → ok', () => {
    const via = withLatLngFns(loadFixture('via-garibaldi-10-lugo.json').results);
    expect(scegliGeocodeNelComune(via, 'Lugo')).toBeNull();
    const centro = withLatLngFns(loadFixture('lugo-ra.json').results);
    const chosen = scegliCentroComune(centro, 'LUGO');
    expect(chosen).toBeTruthy();
    expect(chosen.geometry.location.lat()).toBeCloseTo(44.4213, 3);
  });

  it('deveTentareAutoPinSede: solo con via+città e senza coordinate / tentativi', () => {
    expect(deveTentareAutoPinSede({ indirizzo: 'Via Roma 1', citta: 'Lugo' })).toBe(true);
    expect(
      deveTentareAutoPinSede({
        indirizzo: 'Via Roma 1',
        citta: 'Lugo',
        sedeCoordinate: { lat: 44.4, lng: 11.9 },
      })
    ).toBe(false);
    expect(
      deveTentareAutoPinSede({
        indirizzo: 'Via Roma 1',
        citta: 'Lugo',
        autoPinAttempted: true,
      })
    ).toBe(false);
    expect(deveTentareAutoPinSede({ indirizzo: 'Via Roma 1' })).toBe(false);
  });
});

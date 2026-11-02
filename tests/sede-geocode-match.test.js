import { describe, it, expect } from 'vitest';
import {
  normalizzaComunePerMatch,
  scegliGeocodeNelComune,
  deveTentareAutoPinSede,
} from '../core/js/sede-geocode-match.js';

function result(comune, types = ['locality']) {
  return {
    formatted_address: `Via Garibaldi 10, ${comune}`,
    geometry: { location: { lat: () => 1, lng: () => 2 } },
    address_components: [{ long_name: comune, short_name: comune, types }],
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

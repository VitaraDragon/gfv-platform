import { describe, it, expect } from 'vitest';
import { normalizeTonyTextWhitespace } from '../core/js/tony/engine.js';

describe('normalizeTonyTextWhitespace', () => {
  it('collassa spazi doppi dopo il punto', () => {
    expect(normalizeTonyTextWhitespace('controllo.  Primo, hai un riepilogo.')).toBe(
      'controllo. Primo, hai un riepilogo.'
    );
  });

  it('a capo dopo punto → spazio singolo (no pausa TTS da newline)', () => {
    expect(normalizeTonyTextWhitespace('scorta.\nPoi, puoi gestire')).toBe('scorta. Poi, puoi gestire');
  });

  it('testo utente magazzino: spazi normali invariati', () => {
    var sample =
      'controllo. Primo, hai un riepilogo chiaro. Poi, puoi gestire l\'anagrafica.';
    expect(normalizeTonyTextWhitespace(sample)).toBe(sample);
  });
});

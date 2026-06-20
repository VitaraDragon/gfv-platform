import { describe, it, expect } from 'vitest';
import { pulisciTestoPerVoce } from '../core/js/tony/voice.js';

describe('Tony voice — normalizzazione italiano TTS', () => {
  it('c\'è / c\'e / C\'E\' → ci è', () => {
    expect(pulisciTestoPerVoce('Oggi c\'è sole.')).toContain('ci è');
    expect(pulisciTestoPerVoce('Oggi c\'e vento.')).toContain('ci è');
    expect(pulisciTestoPerVoce('C\'E\' un trattore in uso.')).toContain('Ci è');
  });

  it('c\'era / c\'erano → ci era / ci erano', () => {
    expect(pulisciTestoPerVoce('Ieri c\'era pioggia.')).toContain('ci era');
    expect(pulisciTestoPerVoce('Prima c\'erano tre squadre.')).toContain('ci erano');
  });
});

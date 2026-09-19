import { describe, it, expect } from 'vitest';
import {
  normalizeItalianSttTranscript,
  collapseDuplicateVoiceTranscript,
  scoreItalianSttLexicon,
} from '../core/js/tony/engine.js';

describe('Tony voce — normalizeItalianSttTranscript', () => {
  it('corregge allah → alla', () => {
    expect(normalizeItalianSttTranscript('allah')).toBe('alla');
    expect(normalizeItalianSttTranscript('portami Allah pagina magazzino')).toBe(
      'portami alla pagina magazzino'
    );
  });

  it('corregge typo magazzino / terreni', () => {
    expect(normalizeItalianSttTranscript('apri il magazino')).toBe('apri il magazzino');
    expect(normalizeItalianSttTranscript('vai ai tereni')).toBe('vai ai terreni');
  });

  it('rimuove H isolate senza toccare «ho»', () => {
    expect(normalizeItalianSttTranscript('portami H alla pagina')).toBe('portami alla pagina');
    expect(normalizeItalianSttTranscript('ho finito')).toBe('ho finito');
  });

  it('non altera frasi già corrette né orari', () => {
    expect(normalizeItalianSttTranscript('portami alla pagina del magazzino')).toBe(
      'portami alla pagina del magazzino'
    );
    expect(normalizeItalianSttTranscript('segna le ore dalle 7 alle 19')).toBe(
      'segna le ore dalle 7 alle 19'
    );
  });

  it('corregge mishear potatura / plurali tipo lavoro', () => {
    expect(normalizeItalianSttTranscript('statura di produzione')).toBe('potatura di produzione');
    expect(normalizeItalianSttTranscript('potature di produzione su Monte Olivo')).toBe(
      'potatura di produzione su Monte Olivo'
    );
  });

  it('penalizza alternative con allah e premia lessico GFV', () => {
    expect(scoreItalianSttLexicon('portami Allah pagina magazzino')).toBeLessThan(
      scoreItalianSttLexicon('portami alla pagina magazzino')
    );
  });
});

describe('Tony voce — collapseDuplicateVoiceTranscript', () => {
  it('collapse metà identiche', () => {
    const s = 'portami al magazzino portami al magazzino';
    expect(collapseDuplicateVoiceTranscript(s)).toBe('portami al magazzino');
  });

  it('crea lavoro ripetuto: tiene la seconda copia più completa', () => {
    const dup =
      'crea un lavoro di squadra per Mario Rossi inizio domani durata 4 giorni su Monte Olivo ' +
      'crea un lavoro di squadra per Mario Rossi inizio domani durata 4 giorni su Monte Olivo potatura di produzione';
    const out = collapseDuplicateVoiceTranscript(dup);
    expect(out.toLowerCase()).toContain('potatura di produzione');
    expect(out.toLowerCase().indexOf('crea un lavoro')).toBe(
      out.toLowerCase().lastIndexOf('crea un lavoro')
    );
  });

  it('collapse eco fascia «dalle X alle dalle X alle Y»', () => {
    expect(
      collapseDuplicateVoiceTranscript('dalle 7:00 alle dalle 7:00 alle 18:00 pausa ha 45')
    ).toBe('dalle 7:00 alle 18:00 pausa ha 45');
  });
});

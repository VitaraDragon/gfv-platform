import { describe, it, expect } from 'vitest';
import {
  findNextSentenceBoundary,
  consumeCompleteStreamingSentences,
  getStreamingTtsRemainder,
  applyStreamingTtsChunks,
  speakTextInSentenceChunks,
  resolveVoiceTtsRemainder,
  extractAllTtsSegments,
  reconcileUnspokenVoiceSegments,
  joinSentencesForItalianTts,
  batchSentencesForTts,
} from '../core/js/tony/stream-tts-chunk.js';

describe('stream-tts-chunk (Fase 2)', () => {
  it('trova confini . ? !', () => {
    expect(findNextSentenceBoundary('Ciao. Poi altro', 0)).toBe(5);
    expect(findNextSentenceBoundary('Come va?', 0)).toBe(8);
    expect(findNextSentenceBoundary('Pronto!', 0)).toBe(7);
  });

  it('non spezza decimali', () => {
    expect(findNextSentenceBoundary('Superficie 3.5 ha oggi.', 0)).toBe(23);
    expect(findNextSentenceBoundary('Superficie 3.5 ha oggi.', 10)).toBe(23);
  });

  it('non spezza ellipsis', () => {
    expect(findNextSentenceBoundary('Aspetta... forse.', 0)).toBe(17);
  });

  it('consume emette frasi incrementali', () => {
    var state = { consumedLength: 0 };
    var r1 = consumeCompleteStreamingSentences('Prima frase. Seconda', state);
    expect(r1.sentences).toEqual(['Prima frase.']);
    state = r1.state;

    var r2 = consumeCompleteStreamingSentences('Prima frase. Seconda frase.', state);
    expect(r2.sentences).toEqual(['Seconda frase.']);
    expect(getStreamingTtsRemainder('Prima frase. Seconda frase.', r2.state)).toBe('');
  });

  it('remainder cattura ultima frase senza punto', () => {
    var state = { consumedLength: 0 };
    var r = consumeCompleteStreamingSentences('Ok. Quasi finito', state);
    expect(r.sentences).toEqual(['Ok.']);
    expect(getStreamingTtsRemainder('Ok. Quasi finito', r.state)).toBe('Quasi finito');
  });

  it('remainder vuoto se testo finale più corto del buffer stream (no doppio TTS)', () => {
    var state = { consumedLength: 120, lastCleanText: 'Frase lunga già letta a voce durante lo stream SSE.' };
    expect(getStreamingTtsRemainder('Testo finale più corto.', state)).toBe('');
  });

  it('riallinea consumed se il buffer visibile si accorcia (prefisso)', () => {
    var state = { consumedLength: 25, lastCleanText: 'Prima frase completa. Seconda' };
    var r = consumeCompleteStreamingSentences('Prima frase', state);
    expect(r.sentences).toEqual([]);
    expect(r.state.consumedLength).toBe(11);
  });

  it('joinSentencesForItalianTts: mantiene i punti tra le frasi', () => {
    expect(joinSentencesForItalianTts(['Prima frase.', 'Seconda frase.'])).toBe('Prima frase. Seconda frase.');
    expect(joinSentencesForItalianTts(['Come va?', 'Bene.'])).toBe('Come va? Bene.');
  });

  it('applyStreamingTtsChunks raggruppa 2 frasi per clip con punti', () => {
    var spoken = [];
    var prefetched = [];
    var state = { consumedLength: 0, gen: 7 };
    applyStreamingTtsChunks('Uno. Due.', state, {
      gen: 7,
      prefetch: (t, g) => prefetched.push({ t, g }),
      speak: (t, o) => spoken.push({ t, o }),
    });
    expect(spoken.map((x) => x.t)).toEqual(['Uno. Due.']);
    expect(prefetched.map((x) => x.t)).toEqual(['Uno. Due.']);
    expect(spoken[0].o.gen).toBe(7);
  });

  it('speakTextInSentenceChunks raggruppa a coppie di frasi', () => {
    var spoken = [];
    var count = speakTextInSentenceChunks('Intro breve. Modulo uno. Modulo due.', {
      gen: 3,
      speak: (t, o) => spoken.push({ t, o }),
    });
    expect(count).toBe(2);
    expect(spoken.map((x) => x.t)).toEqual(['Intro breve. Modulo uno.', 'Modulo due.']);
  });

  it('batchSentencesForTts spezza oltre il max frasi', () => {
    var batches = batchSentencesForTts(['A.', 'B.', 'C.', 'D.'], { maxSentences: 2 });
    expect(batches.length).toBe(2);
    expect(batches[0]).toEqual(['A.', 'B.']);
    expect(batches[1]).toEqual(['C.', 'D.']);
  });

  it('resolveVoiceTtsRemainder: testo finale completo dopo prima frase stream', () => {
    var finalText =
      'Primo vantaggio del magazzino. Secondo vantaggio importante. Terzo punto finale.';
    var state = { consumedLength: 28, earlyVoiceSpoken: true, spokeCount: 1, lastCleanText: 'Primo vantaggio del magazzino.' };
    var rem = resolveVoiceTtsRemainder(finalText, state);
    expect(rem).toContain('Secondo vantaggio');
    expect(rem).toContain('Terzo punto');
  });

  it('reconcileUnspokenVoiceSegments: recupera frasi mancanti a fine stream', () => {
    var finalText =
      'Primo. Secondo importante. Terzo finale.';
    var state = { earlyVoiceSpoken: true, sentencesSpokenCount: 3 };
    var unspoken = reconcileUnspokenVoiceSegments(finalText, state, ['Primo.', 'Terzo finale.']);
    expect(unspoken.length).toBe(1);
    expect(unspoken[0]).toContain('Secondo');
  });

  it('reconcileUnspokenVoiceSegments: non duplica segmenti già in coda o già letti', () => {
    var finalText = 'Uno. Due. Tre.';
    var state = { earlyVoiceSpoken: true, sentencesSpokenCount: 1 };
    var covered = ['Uno.', 'Due. Tre.'];
    expect(reconcileUnspokenVoiceSegments(finalText, state, covered)).toEqual([]);
  });

  it('reconcileUnspokenVoiceSegments: risposta lunga stile meteo (4 frasi, gap centrale)', () => {
    var finalText =
      'Con il modulo attivo, vedi le previsioni. Ti fornirebbe alert su vento e pioggia. Al momento non è attivo. Attivalo da Abbonamento.';
    var covered = [
      'Con il modulo attivo, vedi le previsioni.',
      'Al momento non è attivo. Attivalo da Abbonamento.',
    ];
    var unspoken = reconcileUnspokenVoiceSegments(finalText, { earlyVoiceSpoken: true }, covered);
    expect(unspoken.length).toBe(1);
    expect(unspoken[0]).toContain('alert su vento');
  });
});

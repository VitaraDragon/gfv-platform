import { describe, it, expect } from 'vitest';
import {
  findNextSentenceBoundary,
  consumeCompleteStreamingSentences,
  getStreamingTtsRemainder,
  applyStreamingTtsChunks,
  speakTextInSentenceChunks,
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

  it('applyStreamingTtsChunks invoca prefetch e speak', () => {
    var spoken = [];
    var prefetched = [];
    var state = { consumedLength: 0, gen: 7 };
    applyStreamingTtsChunks('Uno. Due.', state, {
      gen: 7,
      prefetch: (t, g) => prefetched.push({ t, g }),
      speak: (t, o) => spoken.push({ t, o }),
    });
    expect(spoken.map((x) => x.t)).toEqual(['Uno.', 'Due.']);
    expect(prefetched.map((x) => x.t)).toEqual(['Uno.', 'Due.']);
    expect(spoken[0].o.gen).toBe(7);
  });

  it('speakTextInSentenceChunks spezza risposte complete', () => {
    var spoken = [];
    var count = speakTextInSentenceChunks('Intro breve. Modulo uno. Modulo due.', {
      gen: 3,
      speak: (t, o) => spoken.push({ t, o }),
    });
    expect(count).toBe(3);
    expect(spoken.map((x) => x.t)).toEqual(['Intro breve.', 'Modulo uno.', 'Modulo due.']);
  });
});

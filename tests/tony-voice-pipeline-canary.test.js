/**
 * Canary Fase 1 pipeline audio Tony (generation token + pulizia TTS).
 * Mappa scenari T1–T7 di PIANO_AUDIO_PIPELINE_BARGEIN.md §8 (logica testabile in Node).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTonyVoice } from '../core/js/tony/voice.js';

function setupWindow() {
  const listeners = {};
  global.window = {
    __tonyGeneration: 0,
    __tonyAudioQueue: [],
    __tonyIsSpeaking: false,
    currentTonyAudio: null,
    __tonyPlayOnInteractionScheduled: false,
    speechSynthesis: { cancel: vi.fn() },
    addEventListener: vi.fn((ev, fn) => { listeners[ev] = fn; }),
    removeEventListener: vi.fn(),
    Tony: { context: {} },
  };
  global.window.Audio = class MockAudio {
    constructor() {
      this.paused = false;
      this.currentTime = 0;
      this.src = '';
      this.onplay = null;
      this.onended = null;
      this.onerror = null;
    }
    play() {
      this.paused = false;
      if (this.onplay) this.onplay();
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  };
  return listeners;
}

describe('Tony voice pipeline canary (Fase 1 barge-in)', () => {
  let api;

  beforeEach(() => {
    setupWindow();
    api = initTonyVoice({ onPlayEnd: vi.fn(), onPlayStart: vi.fn() });
  });

  afterEach(() => {
    delete global.window;
  });

  it('T3/T4: bump svuota coda e incrementa generation', () => {
    window.__tonyAudioQueue = [{ text: 'risposta vecchia', opts: {}, gen: 0 }];
    window.__tonyIsSpeaking = true;
    window.currentTonyAudio = new window.Audio();

    api.clearTonyAudioPipeline({ bump: true, reason: 'user_turn' });

    expect(window.__tonyGeneration).toBe(1);
    expect(window.__tonyAudioQueue).toEqual([]);
    expect(window.__tonyIsSpeaking).toBe(false);
    expect(window.currentTonyAudio).toBeNull();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it('T3: chiusura pannello — clear senza bump', () => {
    window.__tonyGeneration = 3;
    window.__tonyAudioQueue = [{ text: 'in coda', opts: {}, gen: 3 }];

    api.clearTonyAudioPipeline({ bump: false, reason: 'panel_close' });

    expect(window.__tonyGeneration).toBe(3);
    expect(window.__tonyAudioQueue).toEqual([]);
  });

  it('T6/T7: item con generation stale non resta in coda attiva dopo bump', () => {
    window.__tonyIsSpeaking = true;
    api.speakWithTTS('Prima risposta lunga del turno precedente.', { gen: 0 });
    expect(window.__tonyAudioQueue.length).toBe(1);
    const staleGen = window.__tonyAudioQueue[0].gen;

    api.clearTonyAudioPipeline({ bump: true, reason: 'barge_in_mic' });

    window.__tonyIsSpeaking = true;
    api.speakWithTTS('Solo questa deve restare valida.', { gen: window.__tonyGeneration });
    expect(window.__tonyGeneration).toBe(staleGen + 1);
    expect(window.__tonyAudioQueue.every((item) => item.gen === window.__tonyGeneration)).toBe(true);
  });

  it('T2: bump su barge-in invalida prefetch gen precedente (simulato)', () => {
    const genBefore = window.__tonyGeneration;
    api.clearTonyAudioPipeline({ bump: true, reason: 'barge_in_speech' });
    expect(window.__tonyGeneration).toBe(genBefore + 1);
    // prefetch con gen stale: in voice.js genAtStart !== currentGeneration() → no cache write
    const stalePrefetchGen = genBefore;
    expect(stalePrefetchGen).not.toBe(window.__tonyGeneration);
  });

  it('espone warm pipeline TTS e dedup fetch in-flight', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const voiceSrc = fs.readFileSync(
      path.join(process.cwd(), 'core/js/tony/voice.js'),
      'utf8'
    );
    expect(voiceSrc).toMatch(/warmTonyTtsPipeline/);
    expect(voiceSrc).toMatch(/ttsInflightFetches/);
    expect(voiceSrc).toMatch(/buildMinimalTtsContextPayload/);
    expect(typeof api.warmTonyTtsPipeline).toBe('function');
  });
});

describe('Tony parlato — pulizia testo TTS (canary)', () => {
  let api;

  beforeEach(() => {
    setupWindow();
    api = initTonyVoice({});
  });

  afterEach(() => {
    delete global.window;
  });

  it('rimuove markdown/JSON e espande unità agricole', () => {
    window.__tonyIsSpeaking = true;
    api.speakWithTTS('**Pinot**: 12 q.li su 3 ha. {"command":null}', {});
    expect(window.__tonyAudioQueue.length).toBe(1);
    const spoken = window.__tonyAudioQueue[0].text;
    expect(spoken).not.toMatch(/\*\*|q\.?\s*li|\{|\}/);
    expect(spoken).toMatch(/quintali/i);
    expect(spoken).toMatch(/ettari/i);
  });

  it('payload JSON-only: niente voce (blocco rimosso da pulisciTestoPerVoce)', () => {
    window.__tonyIsSpeaking = true;
    api.speakWithTTS('{"text":"Vuoi che salvi il lavoro?","command":null}', {});
    expect(window.__tonyAudioQueue.length).toBe(0);
  });

  it('prosa prima di JSON: mantiene solo testo umano (JSON rimosso)', () => {
    window.__tonyIsSpeaking = true;
    api.speakWithTTS('Ok compilato. {"text":"Vuoi che salvi il lavoro?","command":null}', {});
    const spoken = window.__tonyAudioQueue[0].text;
    expect(spoken).toBe('Ok compilato.');
    expect(spoken).not.toMatch(/\{|command/i);
  });

  it('ignora residui JSON troppo corti', () => {
    api.speakWithTTS('{}', {});
    expect(window.__tonyAudioQueue.length).toBe(0);
  });
});

describe('Tony Fase 2 chunking TTS — wiring main.js (canary)', () => {
  it('main.js collega stream SSE a applyStreamingTtsChunks e remainder in doDisplay', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const mainSrc = fs.readFileSync(
      path.join(process.cwd(), 'core/js/tony/main.js'),
      'utf8'
    );
    expect(mainSrc).toMatch(/import \{ applyStreamingTtsChunks, getStreamingTtsRemainder, speakTextInSentenceChunks \}/);
    expect(mainSrc).toMatch(/applyStreamingTtsChunks\(daMostrare, streamTtsState/);
    expect(mainSrc).toMatch(/getStreamingTtsRemainder\(ttsSource, streamTtsState\)/);
    expect(mainSrc).toMatch(/streamTtsState\.lastCleanText/);
    expect(mainSrc).toMatch(/function tonySpeakAssistantText/);
  });
});

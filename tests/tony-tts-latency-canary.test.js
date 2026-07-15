/**
 * Canary TTS latenza — wiring build 2026-06-19a + speakingRate 1.05.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// Fonte di verità: build corrente in main.js (il canary verifica l'allineamento del loader).
const EXPECTED_BUILD = read('core/js/tony/main.js').match(/TONY_CLIENT_BUILD\s*=\s*'([^']+)'/)[1];

describe('Tony TTS latency canary (2026-06-19a)', () => {
  it('voice.js — pipeline ottimizzata senza context JSON completo', () => {
    const src = read('core/js/tony/voice.js');
    expect(src).toMatch(/fetchTonyAudioMp3/);
    expect(src).toMatch(/ttsInflightFetches/);
    expect(src).toMatch(/buildMinimalTtsContextPayload/);
    expect(src).toMatch(/window\.__tonyTtsCanary/);
    expect(src).not.toMatch(/JSON\.parse\(JSON\.stringify\(window\.Tony\.context\)\)/);
  });

  it('main.js — warm su typing + chunking + build tag', () => {
    const src = read('core/js/tony/main.js');
    expect(src).toMatch(new RegExp(`TONY_CLIENT_BUILD = '${EXPECTED_BUILD}'`));
    expect(src).toMatch(/__tonyWarmTTS/);
    expect(src).toMatch(/speakTextInSentenceChunks/);
    expect(src).toMatch(/function tonySpeakAssistantText/);
  });

  it('widget loader — build allineato', () => {
    const src = read('core/js/tony-widget-standalone.js');
    expect(src).toMatch(new RegExp(`TONY_LOADER_BUILD = '${EXPECTED_BUILD}'`));
  });

  it('getTonyAudio — speakingRate default 1.0', () => {
    const src = read('functions/index.js');
    expect(src).toMatch(/TONY_TTS_SPEAKING_RATE = Number\(process\.env\.TONY_TTS_SPEAKING_RATE \|\| "1\.0"\)/);
  });

  it('script canary eseguibile presente', () => {
    const src = read('scripts/tony-tts-canary.mjs');
    expect(src).toMatch(/Tony TTS canary/);
    expect(src).toMatch(/TONY_CLIENT_BUILD/);
  });
});

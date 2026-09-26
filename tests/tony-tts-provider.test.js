import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  TONY_TTS_ELEVEN_VOICE_DEFAULT,
  TONY_TTS_GOOGLE_VOICE_DEFAULT,
  isGoogleVoiceName,
  clampElevenSpeed,
  resolveTonyTtsConfig,
  synthesizeElevenLabsAudio,
} = require('../functions/tony-tts-provider.js');

describe('tony-tts-provider — resolve', () => {
  it('usa ElevenLabs e la voce salvata se c’è la chiave', () => {
    const cfg = resolveTonyTtsConfig({
      env: { TONY_TTS_PROVIDER: 'elevenlabs' },
      elevenLabsApiKey: 'sk-test',
    });
    expect(cfg.provider).toBe('elevenlabs');
    expect(cfg.voice).toBe(TONY_TTS_ELEVEN_VOICE_DEFAULT);
    expect(cfg.voice).toBe('5zD2eYSLIo8c2zkowMfP');
  });

  it('non manda a ElevenLabs un nome Chirp rimasto in TONY_TTS_VOICE', () => {
    const cfg = resolveTonyTtsConfig({
      env: {
        TONY_TTS_PROVIDER: 'elevenlabs',
        TONY_TTS_VOICE: 'it-IT-Chirp3-HD-Charon',
      },
      elevenLabsApiKey: 'sk-test',
    });
    expect(cfg.voice).toBe('5zD2eYSLIo8c2zkowMfP');
  });

  it('senza chiave torna a Google Chirp', () => {
    const cfg = resolveTonyTtsConfig({
      env: { TONY_TTS_PROVIDER: 'elevenlabs' },
      elevenLabsApiKey: '',
    });
    expect(cfg.provider).toBe('google');
    expect(cfg.voice).toBe(TONY_TTS_GOOGLE_VOICE_DEFAULT);
    expect(cfg.fallbackReason).toBe('missing_elevenlabs_key');
  });

  it('TONY_TTS_PROVIDER=google forza Chirp anche con chiave', () => {
    const cfg = resolveTonyTtsConfig({
      env: { TONY_TTS_PROVIDER: 'google' },
      elevenLabsApiKey: 'sk-test',
    });
    expect(cfg.provider).toBe('google');
    expect(cfg.voice).toBe(TONY_TTS_GOOGLE_VOICE_DEFAULT);
  });
});

describe('tony-tts-provider — helper', () => {
  it('riconosce i nomi Google', () => {
    expect(isGoogleVoiceName('it-IT-Chirp3-HD-Charon')).toBe(true);
    expect(isGoogleVoiceName('5zD2eYSLIo8c2zkowMfP')).toBe(false);
  });

  it('limita speed ElevenLabs a 0.7–1.2', () => {
    expect(clampElevenSpeed(0.5)).toBe(0.7);
    expect(clampElevenSpeed(1.05)).toBe(1.05);
    expect(clampElevenSpeed(2)).toBe(1.2);
  });
});

describe('tony-tts-provider — synthesizeElevenLabsAudio', () => {
  it('chiama l’API con voice id, Flash e MP3', async () => {
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from('fake-mp3'),
      };
    };
    const b64 = await synthesizeElevenLabsAudio({
      text: 'Ti porto alle tariffe.',
      voice: '5zD2eYSLIo8c2zkowMfP',
      modelId: 'eleven_flash_v2_5',
      speakingRate: 1,
      apiKey: 'sk-test',
      fetchFn,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/text-to-speech/5zD2eYSLIo8c2zkowMfP');
    expect(calls[0].url).toContain('output_format=mp3_44100_128');
    expect(calls[0].init.headers['xi-api-key']).toBe('sk-test');
    const body = JSON.parse(calls[0].init.body);
    expect(body.model_id).toBe('eleven_flash_v2_5');
    expect(body.text).toBe('Ti porto alle tariffe.');
    expect(b64).toBe(Buffer.from('fake-mp3').toString('base64'));
  });

  it('propaga errore HTTP', async () => {
    await expect(
      synthesizeElevenLabsAudio({
        text: 'ciao',
        voice: 'x',
        modelId: 'eleven_flash_v2_5',
        speakingRate: 1,
        apiKey: 'sk-test',
        fetchFn: async () => ({
          ok: false,
          status: 401,
          text: async () => 'unauthorized',
        }),
      })
    ).rejects.toThrow(/401/);
  });
});

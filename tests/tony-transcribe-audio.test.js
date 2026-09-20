import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  handleTonyTranscribeAudio,
  normalizeAudioMimeType,
  validateAudioPayload,
  buildTranscribePrompt,
  parseTranscriptionResponse,
  MAX_AUDIO_BASE64_CHARS,
} = require('../functions/tony-transcribe-audio.js');

describe('tony-transcribe-audio — helper puri', () => {
  it('normalizeAudioMimeType toglie codecs e risolve alias', () => {
    expect(normalizeAudioMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(normalizeAudioMimeType('AUDIO/MP4')).toBe('audio/mp4');
    expect(normalizeAudioMimeType('audio/x-m4a')).toBe('audio/m4a');
    expect(normalizeAudioMimeType('audio/mp3')).toBe('audio/mpeg');
    expect(normalizeAudioMimeType('')).toBe('');
    expect(normalizeAudioMimeType(null)).toBe('');
  });

  it('validateAudioPayload accetta mp4 Safari e webm Chrome', () => {
    const a = validateAudioPayload({ mimeType: 'audio/mp4', data: 'QUJD', durationMs: 1234.6 });
    expect(a).toEqual({ mimeType: 'audio/mp4', data: 'QUJD', durationMs: 1235 });
    const b = validateAudioPayload({ mimeType: 'audio/webm;codecs=opus', data: 'QUJD' });
    expect(b.mimeType).toBe('audio/webm');
    expect(b.durationMs).toBeNull();
  });

  it('validateAudioPayload rifiuta formati, vuoti, base64 sporco e clip lunghi', () => {
    expect(() => validateAudioPayload(null)).toThrow(/obbligatorio/);
    expect(() => validateAudioPayload({ mimeType: 'video/mp4', data: 'QUJD' })).toThrow(/non supportato/);
    expect(() => validateAudioPayload({ mimeType: 'audio/mp4', data: '' })).toThrow(/vuoto/i);
    expect(() => validateAudioPayload({ mimeType: 'audio/mp4', data: 'data:audio/mp4;base64,QUJD' })).toThrow(/base64/);
    expect(() => validateAudioPayload({ mimeType: 'audio/mp4', data: 'A'.repeat(MAX_AUDIO_BASE64_CHARS + 1) })).toThrow(/troppo lungo/);
    expect(() => validateAudioPayload({ mimeType: 'audio/mp4', data: 'QUJD', durationMs: 61000 })).toThrow(/60 secondi/);
  });

  it('buildTranscribePrompt è solo trascrizione, con hint opzionale troncato', () => {
    const p = buildTranscribePrompt({ lang: 'it-IT' });
    expect(p).toMatch(/italiano/);
    expect(p).toMatch(/hasSpeech=false/);
    expect(p).not.toMatch(/Termini frequenti/);
    const withHint = buildTranscribePrompt({ hint: 'Sangiovese, erpicatura' });
    expect(withHint).toMatch(/Termini frequenti.*Sangiovese, erpicatura/);
    const longHint = buildTranscribePrompt({ hint: 'x'.repeat(1000) });
    expect(longHint.length).toBeLessThan(p.length + 500);
  });

  it('parseTranscriptionResponse legge JSON, fence markdown e testo nudo', () => {
    expect(parseTranscriptionResponse('{"hasSpeech":true,"transcript":" Dalle 7 alle 12 "}')).toEqual({
      transcript: 'Dalle 7 alle 12',
      hasSpeech: true,
    });
    expect(parseTranscriptionResponse('```json\n{"hasSpeech":false,"transcript":""}\n```')).toEqual({
      transcript: '',
      hasSpeech: false,
    });
    expect(parseTranscriptionResponse('{"hasSpeech":false,"transcript":"rumore"}')).toEqual({
      transcript: '',
      hasSpeech: false,
    });
    expect(parseTranscriptionResponse('Crea un lavoro di potatura')).toEqual({
      transcript: 'Crea un lavoro di potatura',
      hasSpeech: true,
    });
    expect(parseTranscriptionResponse('')).toEqual({ transcript: '', hasSpeech: false });
  });
});

describe('handleTonyTranscribeAudio — callable', () => {
  const db = {};
  const deps = {
    resolveTenantId: vi.fn(async () => 'tenant-1'),
    resolvePlan: vi.fn(async () => 'base'),
  };
  const origFetch = global.fetch;
  const origKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    deps.resolveTenantId.mockClear();
    deps.resolvePlan.mockClear();
  });
  afterEach(() => {
    global.fetch = origFetch;
    if (origKey == null) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = origKey;
  });

  function mkRequest(data, auth = { uid: 'u1' }) {
    return { auth, data };
  }

  it('rifiuta non autenticato', async () => {
    await expect(
      handleTonyTranscribeAudio(db, mkRequest({ audio: { mimeType: 'audio/mp4', data: 'QUJD' } }, null), deps)
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rifiuta piano Free', async () => {
    deps.resolvePlan.mockResolvedValueOnce('free');
    await expect(
      handleTonyTranscribeAudio(db, mkRequest({ audio: { mimeType: 'audio/mp4', data: 'QUJD' } }), deps)
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rifiuta audio non valido con invalid-argument', async () => {
    await expect(
      handleTonyTranscribeAudio(db, mkRequest({ audio: { mimeType: 'text/plain', data: 'QUJD' } }), deps)
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('invia inlineData a Gemini e restituisce il testo', async () => {
    let sentBody = null;
    global.fetch = vi.fn(async (url, init) => {
      sentBody = JSON.parse(init.body);
      expect(String(url)).toMatch(/generateContent\?key=test-key$/);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"hasSpeech":true,"transcript":"Ho trinciato 6 ore nel Sangiovese"}' }] } }],
        }),
      };
    });

    const res = await handleTonyTranscribeAudio(
      db,
      mkRequest({
        audio: { mimeType: 'audio/webm;codecs=opus', data: 'QUJD', durationMs: 2500 },
        lang: 'it-IT',
        context: { dashboard: { tenantId: 'tenant-1' } },
      }),
      deps
    );

    expect(res.ok).toBe(true);
    expect(res.transcript).toBe('Ho trinciato 6 ore nel Sangiovese');
    expect(res.hasSpeech).toBe(true);
    expect(res.tenantId).toBe('tenant-1');
    expect(deps.resolveTenantId).toHaveBeenCalledWith(db, 'u1', { tenantId: 'tenant-1' }, expect.any(Object), undefined);

    const parts = sentBody.contents[0].parts;
    expect(parts[0].text).toMatch(/Trascrivi fedelmente/);
    expect(parts[1].inlineData).toEqual({ mimeType: 'audio/webm', data: 'QUJD' });
    expect(sentBody.generationConfig.responseMimeType).toBe('application/json');
    expect(sentBody.generationConfig.temperature).toBe(0);
  });

  it('senza parlato restituisce hasSpeech=false e transcript vuoto', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"hasSpeech":false,"transcript":""}' }] } }] }),
    }));
    const res = await handleTonyTranscribeAudio(db, mkRequest({ audio: { mimeType: 'audio/mp4', data: 'QUJD' } }), deps);
    expect(res.hasSpeech).toBe(false);
    expect(res.transcript).toBe('');
  });

  it('senza GEMINI_API_KEY → failed-precondition', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      handleTonyTranscribeAudio(db, mkRequest({ audio: { mimeType: 'audio/mp4', data: 'QUJD' } }), deps)
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

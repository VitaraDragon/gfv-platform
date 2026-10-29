/**
 * @vitest-environment node
 * Logica pura voce landing + isolamento + export + regole (passo 12b).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
  COSTANTI_VOCE,
  preparaTestoVoce,
  impronta,
  nuovoIdVoce,
  datiBiglietto,
  validaRichiestaVoce,
  decidiVoce,
  corpoElevenLabs,
  urlElevenLabs,
  statoPerCodice
} = require('../functions/lib/tony-landing-voce.js');
const {
  TONY_TTS_ELEVEN_VOICE_DEFAULT,
  TONY_TTS_ELEVEN_MODEL_DEFAULT
} = require('../functions/tony-tts-provider.js');

describe('preparaTestoVoce', () => {
  it('esempi del prompt e casi markdown/link/emoji', () => {
    expect(preparaTestoVoce('Con GFV gestisci i terreni.')).toBe(
      'Con Gi, effe, vu gestisci i terreni.'
    );
    expect(preparaTestoVoce('Il Base costa 5 € al mese.')).toBe(
      'Il Base costa 5 euro al mese.'
    );
    expect(preparaTestoVoce('**GFV**')).toBe('Gi, effe, vu');
    expect(preparaTestoVoce('GFVX')).toBe('GFVX');
    expect(preparaTestoVoce('Vedi https://esempio.it ok')).toBe('Vedi ok');
    expect(preparaTestoVoce('Ciao 🌾 mondo')).toBe('Ciao mondo');
    expect(preparaTestoVoce('  spazi   multipli  ')).toBe('spazi multipli');
  });
});

describe('impronta biglietto id', () => {
  it('impronta e nuovoIdVoce e datiBiglietto senza testo/sessione', () => {
    expect(impronta('abc')).toMatch(/^[a-f0-9]{64}$/);
    expect(impronta('abc')).not.toBe(impronta('abcd'));
    const id = nuovoIdVoce(() => Buffer.from('0123456789abcdef'));
    expect(id).toBe('30313233343536373839616263646566');
    expect(id).toHaveLength(32);

    const dati = datiBiglietto({
      testo: 'Con GFV.',
      sessione: 'sessione-di-prova-ok',
      adesso: 1_000_000,
      expireAt: { __fake: true }
    });
    expect(dati.hashTesto).toBe(impronta('Con GFV.'));
    expect(dati.hashSessione).toBe(impronta('sessione-di-prova-ok'));
    expect(dati.caratteri).toBe(preparaTestoVoce('Con GFV.').length);
    expect(dati.usato).toBe(false);
    expect(dati.scadeIlMs).toBe(1_000_000 + COSTANTI_VOCE.VALIDITA_BIGLIETTO_MS);
    const serial = JSON.stringify(dati);
    expect(serial).not.toContain('Con GFV');
    expect(serial).not.toContain('sessione-di-prova-ok');
  });
});

describe('validaRichiestaVoce e decidiVoce', () => {
  const baseOk = {
    idVoce: 'a'.repeat(32),
    sessione: 'abcdef0123456789',
    testo: 'Ciao GFV'
  };

  it('valida ogni codice di A4', () => {
    expect(validaRichiestaVoce({ ...baseOk, extra: 1 }).codice).toBe(
      'richiesta-non-valida'
    );
    expect(validaRichiestaVoce({ ...baseOk, idVoce: 'ZZ' }).codice).toBe(
      'id-voce-non-valido'
    );
    expect(validaRichiestaVoce({ ...baseOk, sessione: 'corta' }).codice).toBe(
      'sessione-non-valida'
    );
    expect(validaRichiestaVoce({ ...baseOk, testo: '' }).codice).toBe('testo-vuoto');
    expect(
      validaRichiestaVoce({ ...baseOk, testo: 'x'.repeat(801) }).codice
    ).toBe('testo-troppo-lungo');
    expect(validaRichiestaVoce(baseOk).ok).toBe(true);
    expect(validaRichiestaVoce({ ...baseOk, testo: 'x'.repeat(800) }).ok).toBe(
      true
    );
  });

  it('decidiVoce ordine: spenta prima di biglietto sbagliato', () => {
    const biglietto = {
      hashTesto: impronta('Ciao'),
      hashSessione: impronta('abcdef0123456789'),
      caratteri: 4,
      usato: false,
      scadeIlMs: Date.now() + 60_000
    };
    expect(
      decidiVoce({
        config: { enabled: true, voiceEnabled: false },
        biglietto: null,
        hashTesto: 'x',
        hashSessione: 'y',
        adessoMs: Date.now(),
        caratteriGiorno: 0,
        spesaMeseEur: 0
      }).codice
    ).toBe('voce-spenta');
    expect(
      decidiVoce({
        config: { enabled: true, voiceEnabled: true, dailyVoiceCharCap: 60000 },
        biglietto: null,
        hashTesto: impronta('Ciao'),
        hashSessione: impronta('abcdef0123456789'),
        adessoMs: Date.now(),
        caratteriGiorno: 0,
        spesaMeseEur: 0
      }).codice
    ).toBe('voce-non-valida');
    expect(
      decidiVoce({
        config: { enabled: true, voiceEnabled: true, dailyVoiceCharCap: 60000 },
        biglietto: { ...biglietto, usato: true },
        hashTesto: biglietto.hashTesto,
        hashSessione: biglietto.hashSessione,
        adessoMs: Date.now(),
        caratteriGiorno: 0,
        spesaMeseEur: 0
      }).codice
    ).toBe('voce-gia-usata');
    expect(
      decidiVoce({
        config: { enabled: true, voiceEnabled: true, dailyVoiceCharCap: 60000 },
        biglietto,
        hashTesto: biglietto.hashTesto,
        hashSessione: biglietto.hashSessione,
        adessoMs: biglietto.scadeIlMs + 1,
        caratteriGiorno: 0,
        spesaMeseEur: 0
      }).codice
    ).toBe('voce-scaduta');
    expect(
      decidiVoce({
        config: {
          enabled: true,
          voiceEnabled: true,
          dailyVoiceCharCap: 60000,
          monthlyBudgetEur: 30
        },
        biglietto,
        hashTesto: biglietto.hashTesto,
        hashSessione: biglietto.hashSessione,
        adessoMs: Date.now(),
        caratteriGiorno: 0,
        spesaMeseEur: 24
      }).codice
    ).toBe('tetto-voce');
    expect(
      decidiVoce({
        config: { enabled: true, voiceEnabled: true, dailyVoiceCharCap: 100 },
        biglietto: { ...biglietto, caratteri: 50 },
        hashTesto: biglietto.hashTesto,
        hashSessione: biglietto.hashSessione,
        adessoMs: Date.now(),
        caratteriGiorno: 60,
        spesaMeseEur: 0
      }).codice
    ).toBe('tetto-voce');
    expect(
      decidiVoce({
        config: { enabled: true, voiceEnabled: true, dailyVoiceCharCap: 60000 },
        biglietto,
        hashTesto: biglietto.hashTesto,
        hashSessione: biglietto.hashSessione,
        adessoMs: Date.now(),
        caratteriGiorno: 0,
        spesaMeseEur: 0
      })
    ).toEqual({ consentita: true, codice: 'ok', caratteri: 4 });
  });

  it('corpo e url ElevenLabs e stati HTTP', () => {
    expect(corpoElevenLabs('ciao')).toEqual({
      text: 'ciao',
      model_id: 'eleven_flash_v2_5',
      language_code: 'it'
    });
    expect(urlElevenLabs()).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/5zD2eYSLIo8c2zkowMfP/stream?output_format=mp3_44100_128'
    );
    expect(statoPerCodice('voce-errore')).toBe(502);
    expect(statoPerCodice('tetto-voce')).toBe(429);
    expect(statoPerCodice('voce-spenta')).toBe(503);
  });
});

describe('stessa voce dell’app e isolamento', () => {
  it('costanti uguali a tony-tts-provider', () => {
    expect(COSTANTI_VOCE.VOCE_ID).toBe(TONY_TTS_ELEVEN_VOICE_DEFAULT);
    expect(COSTANTI_VOCE.VOCE_ID).toBe('5zD2eYSLIo8c2zkowMfP');
    expect(COSTANTI_VOCE.MODELLO).toBe(TONY_TTS_ELEVEN_MODEL_DEFAULT);
  });

  it('file voce/audio isolati e export index', () => {
    const voce = fs.readFileSync(
      path.join(ROOT, 'functions/lib/tony-landing-voce.js'),
      'utf8'
    );
    const audio = fs.readFileSync(
      path.join(ROOT, 'functions/tony-landing-audio.js'),
      'utf8'
    );
    for (const testo of [voce, audio]) {
      expect(testo).not.toMatch(/\btenants\b/);
      expect(testo).not.toMatch(/\busers\b/);
      expect(testo).not.toContain('require("./index")');
      expect(testo).not.toContain('tony-gemini-api');
      expect(testo).not.toContain('tony-tts-provider');
      expect(testo).not.toContain('getTonyAudio');
      expect(testo).not.toContain('text-to-speech.googleapis');
      expect(testo).not.toContain('TONY_TTS_');
      expect(testo).not.toContain('process.env');
    }
    expect(audio).toContain('defineSecret("ELEVENLABS_API_KEY")');
    expect(audio).toContain('firebase-admin/app-check');
    expect(audio).toContain('./lib/tony-landing-limiti');
    expect(audio).toContain('tonyLandingQuota');
    expect(audio).not.toMatch(/sk_[a-zA-Z0-9]+/);
    expect(audio).not.toMatch(/xi-api-key['"]\s*:\s*['"][^'"]+['"]/);

    const index = fs.readFileSync(path.join(ROOT, 'functions/index.js'), 'utf8');
    expect(index).toContain('exports.tonyLandingAudio = tonyLandingAudio');
    expect(index).toContain('exports.getTonyAudio');
    expect(index).toContain('exports.tonyLandingAsk');
    expect(index).toContain('exports.tonyAsk');
  });

  it('regole firestore invariate', () => {
    const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
    expect(rules).toMatch(
      /match\s+\/tonyLandingQuota\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/
    );
    expect(rules).toMatch(
      /match\s+\/config\/tonyLanding\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/
    );
    expect(rules.toLowerCase()).not.toContain('appcheck');
    expect(rules).not.toContain('request.app');
  });
});

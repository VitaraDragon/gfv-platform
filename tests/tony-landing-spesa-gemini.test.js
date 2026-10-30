/**
 * @vitest-environment node
 * Spesa Gemini (listino) separata dalla voce ElevenLabs.
 */
import { createRequire } from 'node:module';
import { describe, expect, it, beforeEach } from 'vitest';

const require = createRequire(import.meta.url);
const {
  COSTANTI,
  costoStimatoEur,
  costoGeminiEur,
  spesaGeminiDaDocumento,
  normalizzaConfig,
  decidiDomanda,
} = require('../functions/lib/tony-landing-limiti.js');
const {
  normalizzaSubscription,
  decidiMargineVoce,
  sogliaVoceDaAvvisare,
  leggiSubscriptionElevenLabs,
  svuotaCacheElevenLabs,
} = require('../functions/lib/tony-landing-elevenlabs-quota.js');
const {
  testoEmailSpesa,
  testoEmailVoceEleven,
} = require('../functions/lib/tony-landing-avvisi.js');

describe('costo Gemini solo listino', () => {
  it('1M ingresso = 0,30 €; 1M uscita = 2,50 €; niente fisso né voce', () => {
    expect(COSTANTI.PREZZO_INGRESSO_EUR_PER_MILIONE).toBe(0.3);
    expect(COSTANTI.PREZZO_USCITA_EUR_PER_MILIONE).toBe(2.5);
    expect(COSTANTI.COSTO_FISSO_RICHIESTA_EUR).toBeUndefined();
    expect(COSTANTI.PREZZO_VOCE_EUR_PER_1000_CARATTERI).toBeUndefined();
    expect(costoStimatoEur({ tokenIngresso: 1000000, tokenUscita: 0 })).toBeCloseTo(
      0.3,
      6
    );
    expect(costoStimatoEur({ tokenIngresso: 0, tokenUscita: 1000000 })).toBeCloseTo(
      2.5,
      6
    );
    expect(costoStimatoEur({})).toBe(0);
    expect(
      costoStimatoEur({
        tokenIngresso: 3000,
        tokenUscita: 200,
        caratteriVoce: 10000,
      })
    ).toBeCloseTo(0.0014, 6);
    expect(costoGeminiEur({ tokenIngresso: 3000, tokenUscita: 200 })).toBe(
      costoStimatoEur({ tokenIngresso: 3000, tokenUscita: 200 })
    );
  });

  it('spesaGeminiDaDocumento: token → ricalcolo; senza token e senza flag → 0 da ripartire', () => {
    expect(
      spesaGeminiDaDocumento({
        tokenIngresso: 1000000,
        tokenUscita: 0,
        costoEur: 99,
      }).spesaGeminiEur
    ).toBeCloseTo(0.3, 6);
    expect(
      spesaGeminiDaDocumento({ costoEur: 2.67 }).daRipartire
    ).toBe(true);
    expect(spesaGeminiDaDocumento({ costoEur: 2.67 }).spesaGeminiEur).toBe(0);
    expect(
      spesaGeminiDaDocumento({
        costoEur: 0.11,
        spesaGeminiRipartita: true,
      }).spesaGeminiEur
    ).toBeCloseTo(0.11, 6);
  });

  it('decidiDomanda: voce indipendente dal tetto euro (solo voiceEnabled)', () => {
    const config = normalizzaConfig({
      enabled: true,
      voiceEnabled: true,
      monthlyBudgetEur: 5,
    });
    expect(
      decidiDomanda({ config, spesaMeseEur: 4.5, domandeGiorno: 0 }).voce
    ).toBe(true);
    expect(
      decidiDomanda({
        config: normalizzaConfig({ enabled: true, voiceEnabled: false }),
        spesaMeseEur: 0,
      }).voce
    ).toBe(false);
  });
});

describe('margine ElevenLabs', () => {
  beforeEach(() => {
    svuotaCacheElevenLabs();
  });

  it('normalizzaSubscription e riserva', () => {
    const n = normalizzaSubscription({
      character_count: 97000,
      character_limit: 100000,
      next_character_count_reset_unix: 1731400000,
    });
    expect(n.rimanenti).toBe(3000);
    expect(n.percentUsati).toBeCloseTo(97, 5);
    expect(
      decidiMargineVoce({
        sub: {
          character_count: 97000,
          character_limit: 100000,
        },
        voiceReserveChars: 20000,
      }).consentita
    ).toBe(false);
    expect(
      decidiMargineVoce({
        sub: {
          character_count: 50000,
          character_limit: 100000,
        },
        voiceReserveChars: 20000,
      }).consentita
    ).toBe(true);
  });

  it('API fallita → voce non bloccata', () => {
    expect(decidiMargineVoce({ apiFallita: true }).consentita).toBe(true);
    expect(decidiMargineVoce({ apiFallita: true }).motivo).toBe(
      'margine-non-leggibile'
    );
  });

  it('soglie 80 e 95', () => {
    expect(
      sogliaVoceDaAvvisare({ percentUsati: 79, giaInviate: {} })
    ).toBeNull();
    expect(
      sogliaVoceDaAvvisare({ percentUsati: 80, giaInviate: {} }).soglia
    ).toBe(80);
    expect(
      sogliaVoceDaAvvisare({ percentUsati: 96, giaInviate: {} }).soglia
    ).toBe(95);
    expect(
      sogliaVoceDaAvvisare({
        percentUsati: 96,
        giaInviate: { e80: true, e95: true },
      })
    ).toBeNull();
  });

  it('leggiSubscriptionElevenLabs in cache e su errore', async () => {
    const fetchOk = async () => ({
      ok: true,
      json: async () => ({
        character_count: 1000,
        character_limit: 100000,
      }),
    });
    const a = await leggiSubscriptionElevenLabs({
      chiave: 'x',
      fetchFn: fetchOk,
      adessoMs: 1000,
    });
    expect(a.ok).toBe(true);
    const b = await leggiSubscriptionElevenLabs({
      chiave: 'x',
      fetchFn: async () => {
        throw new Error('non deve chiamare');
      },
      adessoMs: 2000,
    });
    expect(b.cached).toBe(true);
    expect(b.ok).toBe(true);

    svuotaCacheElevenLabs();
    const fail = await leggiSubscriptionElevenLabs({
      chiave: 'x',
      fetchFn: async () => ({ ok: false, status: 401 }),
      adessoMs: 1,
    });
    expect(fail.ok).toBe(false);
    expect(fail.errore).toBe('http-401');
  });
});

describe('email spesa', () => {
  it('testo Gemini con prezzi di listino e voce a parte', () => {
    const mail = testoEmailSpesa({
      soglia: 50,
      spesaMeseEur: 0.11,
      budgetEur: 5,
      domandeMese: 62,
      mese: 'ottobre 2026',
      voceEleven: {
        usati: 61200,
        limite: 100000,
        landing: 9800,
        rimanenti: 38800,
        resetLabel: 'il 12 novembre',
      },
    });
    expect(mail.oggetto).toMatch(/Gemini/i);
    expect(mail.testo).toMatch(/Gemini \(landing\): 0,11 €/);
    expect(mail.testo).toMatch(/prezzi di listino/);
    expect(mail.testo).toMatch(/Voce ElevenLabs/);
    expect(mail.testo).toMatch(/61\.200/);
    expect(mail.testo).toMatch(/Non devi fare niente/);
  });

  it('email voce 80% e 95%', () => {
    const e80 = testoEmailVoceEleven({
      soglia: 80,
      usati: 80000,
      limite: 100000,
      landing: 5000,
      rimanenti: 20000,
      resetLabel: 'il 1 dicembre',
    });
    expect(e80.oggetto).toMatch(/80%/);
    expect(e80.testo).toMatch(/Non devi fare niente/);
    const e95 = testoEmailVoceEleven({
      soglia: 95,
      usati: 96000,
      limite: 100000,
      landing: 5000,
      rimanenti: 4000,
    });
    expect(e95.testo).toMatch(/Vicino alla riserva/);
  });
});

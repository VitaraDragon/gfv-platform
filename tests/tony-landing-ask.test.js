/**
 * @vitest-environment node
 * Logica pura di tonyLandingAsk (passo 10) + controlli isolamento / regole / export.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const limiti = require('../functions/lib/tony-landing-limiti.js');
const {
  COSTANTI,
  ORIGINI_AMMESSE,
  MESSAGGI,
  PROMPT_SISTEMA_PROVVISORIO,
  origineAmmessa,
  normalizzaConfig,
  chiaviTempo,
  scadenze,
  ipDaRichiesta,
  idVisitatore,
  idSessione,
  storiaPulita,
  validaRichiesta,
  contieneDatiPersonali,
  decidiDomanda,
  decidiDomandaAccount,
  messaggioPerCodice,
  costoStimatoEur,
  tokenDaUsage,
  corpoRichiestaGemini,
  testoDaPayloadGemini,
  rigaSse
} = limiti;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testoLimiti = fs.readFileSync(
  path.join(root, 'functions/lib/tony-landing-limiti.js'),
  'utf8'
);
const testoAsk = fs.readFileSync(
  path.join(root, 'functions/tony-landing-ask.js'),
  'utf8'
);
const testoAccount = fs.readFileSync(
  path.join(root, 'functions/lib/tony-landing-account.js'),
  'utf8'
);
const testoRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const indexes = JSON.parse(
  fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8')
);
const testoIndex = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');

const spie = [];
beforeAll(() => {
  for (const metodo of ['log', 'info', 'warn', 'error']) {
    spie.push(vi.spyOn(console, metodo).mockImplementation(() => {}));
  }
});
afterAll(() => {
  spie.forEach((s) => s.mockRestore());
});

const configAcceso = {
  enabled: true,
  voiceEnabled: true,
  dailyQuestionCap: 1000,
  dailyVoiceCharCap: 60000,
  monthlyBudgetEur: 30
};

const PAROLE_VIETATE = [
  'certificato',
  'collegato al SIAN',
  'a norma',
  'quaderno di campagna'
];

describe('Costanti', () => {
  it('limiti e modello come da brief', () => {
    expect(COSTANTI.MAX_DOMANDE_SESSIONE).toBe(15);
    expect(COSTANTI.MAX_DOMANDE_VISITATORE_GIORNO).toBe(30);
    expect(COSTANTI.MAX_DOMANDE_GIORNO_PREDEFINITO).toBe(1000);
    expect(COSTANTI.MAX_DOMANDE_GIORNO_ASSOLUTO).toBe(3000);
    expect(COSTANTI.MAX_CARATTERI_DOMANDA).toBe(300);
    expect(COSTANTI.MAX_BATTUTE_STORIA).toBe(6);
    expect(COSTANTI.TETTO_MENSILE_EUR).toBe(30);
    expect(COSTANTI.SOGLIA_AVVISO_GEMINI_50).toBe(0.5);
    expect(COSTANTI.SOGLIA_AVVISO_GEMINI_80).toBe(0.8);
    expect(COSTANTI.ORE_SCADENZA_CONTATORI).toBe(48);
    expect(COSTANTI.CACHE_CONFIG_MS).toBe(60000);
    expect(COSTANTI.MODELLO_GEMINI).toBe('gemini-2.5-flash');
    expect(COSTANTI.MAX_TOKEN_RISPOSTA).toBe(200);
  });
});

describe('normalizzaConfig', () => {
  it('documento mancante o vuoto → spento con predefiniti', () => {
    for (const v of [undefined, null, {}]) {
      const c = normalizzaConfig(v);
      expect(c.enabled).toBe(false);
      expect(c.voiceEnabled).toBe(false);
      expect(c.dailyQuestionCap).toBe(1000);
      expect(c.dailyVoiceCharCap).toBe(60000);
      expect(c.monthlyBudgetEur).toBe(30);
    }
  });

  it('enabled solo se booleano true', () => {
    expect(normalizzaConfig({ enabled: 'true' }).enabled).toBe(false);
    expect(normalizzaConfig({ enabled: 1 }).enabled).toBe(false);
    expect(normalizzaConfig({ enabled: true }).enabled).toBe(true);
  });

  it('monthlyBudgetEur e dailyQuestionCap', () => {
    expect(normalizzaConfig({ monthlyBudgetEur: 50 }).monthlyBudgetEur).toBe(30);
    expect(normalizzaConfig({ monthlyBudgetEur: 10 }).monthlyBudgetEur).toBe(10);
    expect(normalizzaConfig({ monthlyBudgetEur: -1 }).monthlyBudgetEur).toBe(30);
    expect(normalizzaConfig({ monthlyBudgetEur: '30' }).monthlyBudgetEur).toBe(30);
    expect(normalizzaConfig({ monthlyBudgetEur: NaN }).monthlyBudgetEur).toBe(30);
    expect(normalizzaConfig({ dailyQuestionCap: 5000 }).dailyQuestionCap).toBe(1000);
    expect(normalizzaConfig({ dailyQuestionCap: 3000 }).dailyQuestionCap).toBe(3000);
    expect(normalizzaConfig({ dailyQuestionCap: 2.5 }).dailyQuestionCap).toBe(1000);
    expect(normalizzaConfig({ dailyQuestionCap: 0 }).dailyQuestionCap).toBe(0);
  });
});

describe('decidiDomanda', () => {
  it('spento anche con contatori a 0', () => {
    const r = decidiDomanda({
      config: { ...configAcceso, enabled: false },
      spesaMeseEur: 0,
      domandeGiorno: 0,
      domandeVisitatore: 0,
      domandeSessione: 0
    });
    expect(r).toEqual({ consentita: false, codice: 'spento', voce: false });
  });

  it('tetto al 100% e budget 0', () => {
    expect(
      decidiDomanda({ config: configAcceso, spesaMeseEur: 30 }).codice
    ).toBe('tetto');
    expect(
      decidiDomanda({ config: configAcceso, spesaMeseEur: 29.99 }).consentita
    ).toBe(true);
    expect(
      decidiDomanda({
        config: { ...configAcceso, monthlyBudgetEur: 0 },
        spesaMeseEur: 0
      }).codice
    ).toBe('tetto');
  });

  it('limiti globale / sessione / visitatore', () => {
    expect(
      decidiDomanda({ config: configAcceso, domandeGiorno: 1000 }).codice
    ).toBe('limite-globale');
    expect(
      decidiDomanda({ config: configAcceso, domandeGiorno: 999 }).consentita
    ).toBe(true);
    expect(
      decidiDomanda({ config: configAcceso, domandeSessione: 15 }).codice
    ).toBe('limite-sessione');
    expect(
      decidiDomanda({ config: configAcceso, domandeSessione: 14 }).consentita
    ).toBe(true);
    expect(
      decidiDomanda({ config: configAcceso, domandeVisitatore: 30 }).codice
    ).toBe('limite-giorno');
    expect(
      decidiDomanda({ config: configAcceso, domandeVisitatore: 29 }).consentita
    ).toBe(true);
  });

  it('ordine: spento prima di tetto, tetto prima dei limiti', () => {
    expect(
      decidiDomanda({
        config: { ...configAcceso, enabled: false },
        spesaMeseEur: 30,
        domandeGiorno: 1000,
        domandeSessione: 15,
        domandeVisitatore: 30
      }).codice
    ).toBe('spento');
    expect(
      decidiDomanda({
        config: configAcceso,
        spesaMeseEur: 30,
        domandeGiorno: 1000,
        domandeSessione: 15
      }).codice
    ).toBe('tetto');
  });

  it('voce: solo voiceEnabled (spesa Gemini non spegne la voce)', () => {
    expect(
      decidiDomanda({
        config: configAcceso,
        spesaMeseEur: 23.99
      }).voce
    ).toBe(true);
    expect(
      decidiDomanda({
        config: configAcceso,
        spesaMeseEur: 24
      }).voce
    ).toBe(true);
    expect(
      decidiDomanda({
        config: { ...configAcceso, voiceEnabled: false },
        spesaMeseEur: 10
      }).voce
    ).toBe(false);
    expect(
      decidiDomanda({
        config: { ...configAcceso, enabled: false },
        spesaMeseEur: 0
      }).voce
    ).toBe(false);
  });

  it('valori mancanti come 0', () => {
    const r = decidiDomanda({ config: configAcceso });
    expect(r.consentita).toBe(true);
    expect(r.codice).toBe('ok');
  });
});

describe('decidiDomandaAccount', () => {
  it('non applica il limite globale giornaliero', () => {
    expect(
      decidiDomandaAccount({
        config: configAcceso,
        domandeGiorno: 9999,
        domandeAccount: 0
      }).consentita
    ).toBe(true);
  });

  it('blocca solo al limite account', () => {
    expect(
      decidiDomandaAccount({
        config: configAcceso,
        domandeAccount: COSTANTI.MAX_DOMANDE_ACCOUNT
      }).codice
    ).toBe('limite-account');
  });
});

describe('validaRichiesta raccolti', () => {
  it('accetta raccolti solo in fase account entro 1KB', () => {
    const ok = validaRichiesta({
      domanda: 'ciao',
      sessione: 'abcdefghijklmnop',
      storia: [],
      fase: 'account',
      argomento: 'sede',
      raccolti: 'Sede: Faenza'
    });
    expect(ok.ok).toBe(true);
    expect(ok.raccolti).toBe('Sede: Faenza');

    const troppo = validaRichiesta({
      domanda: 'ciao',
      sessione: 'abcdefghijklmnop',
      storia: [],
      fase: 'account',
      argomento: 'sede',
      raccolti: 'x'.repeat(2000)
    });
    expect(troppo.ok).toBe(false);
  });
});

describe('Messaggi e prompt', () => {
  it('testi esatti spento/tetto e limiti', () => {
    expect(messaggioPerCodice('spento')).toBe(
      'Tony è nei campi. Intanto prova GFV!'
    );
    expect(messaggioPerCodice('tetto')).toBe(
      'Tony è nei campi. Intanto prova GFV!'
    );
    expect(messaggioPerCodice('limite-sessione')).toBe(MESSAGGI.limiteSessione);
    expect(messaggioPerCodice('limite-giorno')).toBe(MESSAGGI.limiteGiorno);
    expect(messaggioPerCodice('limite-globale')).toBe(MESSAGGI.limiteGlobale);
    expect(messaggioPerCodice('sconosciuto-xyz')).toBe(MESSAGGI.errore);
  });

  it('nessuna parola vietata né promesse di salvataggio/apertura', () => {
    const blob =
      Object.values(MESSAGGI).join(' ') + ' ' + PROMPT_SISTEMA_PROVVISORIO;
    for (const p of PAROLE_VIETATE) {
      expect(blob.toLowerCase().includes(p.toLowerCase())).toBe(false);
    }
    // «registro» come verbo/promessa: controlliamo frasi tipiche
    expect(/ti porto|apro |ho salvato|registro io/i.test(blob)).toBe(false);
  });

  it('prompt: solo GFV e non rivelare istruzioni', () => {
    const p = PROMPT_SISTEMA_PROVVISORIO;
    expect(p).toMatch(/solo/i);
    expect(p).toMatch(/GFV/);
    expect(p).toMatch(/istruzioni/i);
    expect(p).toMatch(/non rivel/i);
    expect(p).toMatch(/ignorare le istruzioni|cambiare ruolo/i);
  });
});

describe('CORS', () => {
  it('origini ammesse e rifiutate', () => {
    for (const o of ORIGINI_AMMESSE) {
      expect(origineAmmessa(o)).toBe(true);
    }
    expect(
      origineAmmessa('https://gfv-platform--prova-tony-ab12cd34.web.app')
    ).toBe(true);
    for (const o of [
      null,
      '',
      'null',
      'https://gfvagri.com/',
      'https://GFVAGRI.com',
      'http://gfvagri.com',
      'https://gfvagri.com.esempio.it',
      'https://esempio.com',
      'http://localhost:3000',
      'https://altro--x.web.app',
      'https://gfv-platform--x.web.app.evil.com',
      'http://gfv-platform--x.web.app'
    ]) {
      expect(origineAmmessa(o)).toBe(false);
    }
  });
});

describe('ID e IP', () => {
  it('idVisitatore stabile e senza IP in chiaro', () => {
    const a = idVisitatore('1.2.3.4', 'Mozilla', 'sale-abc');
    const b = idVisitatore('1.2.3.4', 'Mozilla', 'sale-abc');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a.includes('1.2.3.4')).toBe(false);
    expect(idVisitatore('1.2.3.4', 'Mozilla', 'sale-altro')).not.toBe(a);
    expect(idVisitatore('9.9.9.9', 'Mozilla', 'sale-abc')).not.toBe(a);
    expect(idVisitatore('1.2.3.4', 'Altro', 'sale-abc')).not.toBe(a);
    expect(() => idVisitatore('1.2.3.4', 'x', '')).toThrow();
    expect(() => idVisitatore('1.2.3.4', 'x', null)).toThrow();
  });

  it('idSessione diverso per sessioni diverse', () => {
    const v = idVisitatore('1.1.1.1', 'ua', 'sale');
    expect(idSessione(v, 'aaaaaaaaaaaaaaaa')).not.toBe(
      idSessione(v, 'bbbbbbbbbbbbbbbb')
    );
  });

  it('ipDaRichiesta prende l’ultimo X-Forwarded-For', () => {
    expect(ipDaRichiesta({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }, '9.9.9.9')).toBe(
      '2.2.2.2'
    );
    expect(ipDaRichiesta({}, '8.8.8.8')).toBe('8.8.8.8');
    expect(ipDaRichiesta({}, null)).toBe('sconosciuto');
  });
});

describe('validaRichiesta e storiaPulita', () => {
  const sessioneOk = '01234567-89ab-cdef';

  it('domanda e chiavi', () => {
    expect(validaRichiesta({ domanda: '', sessione: sessioneOk }).codice).toBe(
      'domanda-vuota'
    );
    expect(validaRichiesta({ domanda: '   ', sessione: sessioneOk }).codice).toBe(
      'domanda-vuota'
    );
    expect(
      validaRichiesta({ domanda: 'a'.repeat(301), sessione: sessioneOk }).codice
    ).toBe('domanda-troppo-lunga');
    expect(
      validaRichiesta({ domanda: 'a'.repeat(300), sessione: sessioneOk }).ok
    ).toBe(true);
    expect(
      validaRichiesta({
        domanda: 'ciao',
        sessione: sessioneOk,
        extra: 1
      }).codice
    ).toBe('richiesta-non-valida');
  });

  it('sessione', () => {
    expect(validaRichiesta({ domanda: 'ciao', sessione: 'corta' }).codice).toBe(
      'sessione-non-valida'
    );
    expect(
      validaRichiesta({ domanda: 'ciao', sessione: 'aaaaaaaa aaaaaaaa' }).codice
    ).toBe('sessione-non-valida');
    expect(
      validaRichiesta({ domanda: 'ciao', sessione: 'aaaaaaaa/aaaaaaaa' }).codice
    ).toBe('sessione-non-valida');
    expect(
      validaRichiesta({
        domanda: 'ciao',
        sessione: 'a1b2c3d4-e5f6-7890-abcd'
      }).ok
    ).toBe(true);
  });

  it('storiaPulita: ultime 6, ruoli, tagli', () => {
    const dieci = [];
    for (let i = 0; i < 10; i++) {
      dieci.push({ ruolo: i % 2 === 0 ? 'utente' : 'tony', testo: 't' + i });
    }
    const s = storiaPulita(dieci);
    expect(s).toHaveLength(6);
    expect(s[0].testo).toBe('t4');
    expect(storiaPulita([{ ruolo: 'admin', testo: 'x' }])).toEqual([]);
    expect(
      storiaPulita([{ ruolo: 'utente', testo: 'a'.repeat(400) }])[0].testo
    ).toHaveLength(300);
    expect(
      storiaPulita([{ ruolo: 'tony', testo: 'b'.repeat(700) }])[0].testo
    ).toHaveLength(600);
    expect(storiaPulita(null)).toEqual([]);
  });
});

describe('contieneDatiPersonali', () => {
  it('email e password', () => {
    expect(
      contieneDatiPersonali('la mia mail è mario.rossi@esempio.it')
    ).toBe(true);
    expect(contieneDatiPersonali('password: ciao123')).toBe(true);
    expect(contieneDatiPersonali('quanto costa GFV?')).toBe(false);
  });
});

describe('Tempo e scadenze', () => {
  it('chiaviTempo a Roma dopo mezzanotte UTC di Capodanno', () => {
    // 31 dic 23:30 UTC = 1 gen 00:30 Europe/Rome
    const d = new Date('2025-12-31T23:30:00.000Z');
    const k = chiaviTempo(d);
    expect(k.giorno).toBe('2026-01-01');
    expect(k.mese).toBe('2026-01');
  });

  it('scadenze +48h e +90g', () => {
    const d = new Date('2026-10-28T08:00:00.000Z');
    const s = scadenze(d);
    expect(s.contatori.getTime() - d.getTime()).toBe(48 * 60 * 60 * 1000);
    expect(s.mese.getTime() - d.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });
});

describe('Spesa', () => {
  it('prezzi listino senza fisso né voce', () => {
    expect(
      costoStimatoEur({ tokenIngresso: 1000000, tokenUscita: 0 })
    ).toBeCloseTo(0.3, 6);
    expect(
      costoStimatoEur({ tokenIngresso: 0, tokenUscita: 1000000 })
    ).toBeCloseTo(2.5, 6);
    expect(costoStimatoEur({})).toBe(0);
    expect(costoStimatoEur({ tokenIngresso: -10, tokenUscita: -5 })).toBe(0);
  });

  it('tokenDaUsage con e senza metadata', () => {
    expect(
      tokenDaUsage(
        { promptTokenCount: 10, candidatesTokenCount: 3, thoughtsTokenCount: 2 },
        'x',
        'y'
      )
    ).toEqual({ tokenIngresso: 10, tokenUscita: 5 });
    const stima = tokenDaUsage(null, 'ciao', 'risposta');
    expect(stima.tokenIngresso).toBeGreaterThanOrEqual(1500);
  });

  it('esempio: 3000+200 ≈ 0,0014 €; tetto mensile ferma anche sotto il cap giornaliero', () => {
    // 3000 * 0.30/1e6 + 200 * 2.50/1e6 = 0.0009 + 0.0005 = 0.0014
    const una = costoStimatoEur({ tokenIngresso: 3000, tokenUscita: 200 });
    expect(una).toBeCloseTo(0.0014, 6);
    // 1000/giorno × 31 ≈ 43,40 € > 30 → il tetto mensile è il freno vero
    expect(una * 1000 * 31).toBeGreaterThan(30);
    const sotto = una * 600 * 31;
    expect(sotto).toBeLessThan(30);
    expect(sotto).toBeCloseTo(26.04, 2);
    const blocco = decidiDomanda({
      config: configAcceso,
      spesaMeseEur: 30,
      domandeGiorno: 200
    });
    expect(blocco.codice).toBe('tetto');
    expect(blocco.consentita).toBe(false);
  });
});

describe('Corpo Gemini', () => {
  it('solo chiavi ammesse, storia e config', () => {
    const corpo = corpoRichiestaGemini({
      promptSistema: 'sys',
      storia: [
        { ruolo: 'utente', testo: 'ciao' },
        { ruolo: 'tony', testo: 'ciao!' }
      ],
      domanda: 'cos\'è GFV?'
    });
    expect(Object.keys(corpo).sort()).toEqual([
      'contents',
      'generationConfig',
      'systemInstruction'
    ]);
    expect(corpo).not.toHaveProperty('tools');
    expect(corpo).not.toHaveProperty('toolConfig');
    expect(corpo.generationConfig.maxOutputTokens).toBe(200);
    expect(corpo.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
    expect(corpo.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
    expect(corpo.contents[2].parts[0].text).toBe("cos'è GFV?");
  });
});

describe('testoDaPayloadGemini e rigaSse', () => {
  it('pezzi vari senza errori', () => {
    expect(testoDaPayloadGemini(null)).toEqual({
      delta: '',
      usageMetadata: null,
      finishReason: null
    });
    expect(
      testoDaPayloadGemini({
        candidates: [{ content: { parts: [{ text: 'ciao' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 1 }
      })
    ).toMatchObject({ delta: 'ciao', finishReason: 'STOP' });
    expect(testoDaPayloadGemini({ candidates: [{}] }).delta).toBe('');
    expect(rigaSse('done', { codice: 'ok' })).toBe(
      'event: done\ndata: {"codice":"ok"}\n\n'
    );
  });
});

describe('Isolamento', () => {
  it('niente tenants/users e require ammessi', () => {
    for (const t of [testoLimiti, testoAsk, testoAccount]) {
      expect(t).not.toMatch(/\btenants\b/);
      expect(t).not.toMatch(/\busers\b/);
      expect(t).not.toMatch(/tonyLandingSetup(?!Quota)/);
      expect(t).not.toMatch(/require\(["']\.\/index["']\)/);
      expect(t).not.toMatch(/handleTonyAskRequest/);
      expect(t).not.toMatch(/tony-gemini-api/);
      expect(t).not.toMatch(/tony-tts-provider/);
    }
    expect(testoLimiti).toMatch(/require\(["']node:crypto["']\)/);
    expect(testoAsk).toMatch(/firebase-functions\/v2\/https/);
    expect(testoAsk).toMatch(/firebase-admin\/app-check/);
    expect(testoAsk).toMatch(/\.\/lib\/tony-landing-limiti/);
    expect(testoAsk).toMatch(/tonyLandingQuota/);
    expect(testoAsk).toMatch(/config\/tonyLanding|DOC_CONFIG/);
    expect(testoAsk).not.toMatch(/\btools\b.*functionDeclarations|functionDeclarations/);
  });
});

describe('Regole e TTL', () => {
  it('blocchi deny e TTL entrambi', () => {
    expect(testoRules).toMatch(/match \/tonyLandingSetupQuota\/\{document=\*\*\}/);
    expect(testoRules).toMatch(/match \/tonyLandingQuota\/\{document=\*\*\}/);
    expect(testoRules).toMatch(/match \/config\/tonyLanding/);
    const blocchi = testoRules.match(
      /match \/(tonyLandingQuota\/\{document=\*\*\}|config\/tonyLanding)[\s\S]*?allow read, write: if false;/g
    );
    expect(blocchi && blocchi.length).toBeGreaterThanOrEqual(2);
    const ttl = (indexes.fieldOverrides || []).filter(
      (f) =>
        f.ttl === true &&
        f.fieldPath === 'expireAt' &&
        (f.collectionGroup === 'tonyLandingSetupQuota' ||
          f.collectionGroup === 'tonyLandingQuota')
    );
    expect(ttl).toHaveLength(2);
  });
});

describe('Export', () => {
  it('index.js esporta tonyLandingAsk e le altre', () => {
    expect(testoIndex).toMatch(/exports\.tonyLandingAsk\s*=\s*tonyLandingAsk/);
    expect(testoIndex).toMatch(/exports\.tonyLandingSetup/);
    expect(testoIndex).toMatch(/exports\.tonyAsk\b/);
    expect(testoIndex).toMatch(/exports\.tonyAskStream/);
  });
});

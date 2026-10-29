/**
 * @vitest-environment node
 * Fase account di tonyLandingAsk (passo 14).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  handleTonyLandingAsk,
  svuotaCacheTonyLandingAsk
} = require('../functions/tony-landing-ask.js');
const {
  COSTANTI,
  validaRichiesta,
  idAccount,
  corpoRichiestaGemini,
  chiaviTempo,
  scadenze
} = require('../functions/lib/tony-landing-limiti.js');
const {
  promptSistemaAccount,
  rispostaAccountDaTesto,
  SCHEMA_RISPOSTA_ACCOUNT,
  regoleTenute,
  PREFISSI_ESCLUSI
} = require('../functions/lib/tony-landing-account.js');
const { REGOLE_TONY_LANDING } = require('../functions/lib/tony-landing-prompt.js');

const ORIGINE = 'https://gfvagri.com';
const SESSIONE = 'a1b2c3d4-e5f6-7890-abcd';
const ADESSO_FISSO = new Date('2026-10-28T10:00:00.000Z');
const { giorno, mese } = chiaviTempo(ADESSO_FISSO);
const scad = scadenze(ADESSO_FISSO);

function isIncrement(v) {
  return (
    v &&
    typeof v === 'object' &&
    typeof v.operand === 'number' &&
    v.constructor &&
    v.constructor.name === 'NumericIncrementTransform'
  );
}

function risolviMerge(prev, data) {
  const out = Object.assign({}, prev || {});
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (isIncrement(v)) {
      const base = typeof out[k] === 'number' ? out[k] : 0;
      out[k] = base + v.operand;
    } else {
      out[k] = structuredClone(v);
    }
  }
  return out;
}

function fakeDb(seed) {
  const docs = new Map(Object.entries(seed || {}));
  function makeDoc(fullPath) {
    return {
      path: fullPath,
      async get() {
        if (!docs.has(fullPath)) {
          return { exists: false, data: () => undefined };
        }
        return { exists: true, data: () => structuredClone(docs.get(fullPath)) };
      },
      async set(data, opts) {
        if (opts && opts.merge) {
          docs.set(fullPath, risolviMerge(docs.get(fullPath), data));
        } else {
          docs.set(fullPath, risolviMerge({}, data));
        }
      }
    };
  }
  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          return makeDoc(name + '/' + id);
        }
      };
    },
    runTransaction(fn) {
      const tx = {
        get(ref) {
          return ref.get();
        },
        set(ref, data, opts) {
          return ref.set(data, opts);
        }
      };
      return fn(tx);
    }
  };
}

function fakeRes() {
  const headers = {};
  const chunks = [];
  let statusCode = 200;
  let ended = false;
  let jsonBody = null;
  return {
    statusCode,
    headers,
    chunks,
    get jsonBody() {
      return jsonBody;
    },
    status(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      headers[k] = v;
    },
    json(body) {
      jsonBody = body;
      ended = true;
    },
    end() {
      ended = true;
    },
    write(s) {
      chunks.push(String(s));
    },
    flushHeaders() {},
    flush() {},
    get ended() {
      return ended;
    }
  };
}

function fakeReq(body, extraHeaders = {}) {
  return {
    method: 'POST',
    headers: Object.assign(
      {
        origin: ORIGINE,
        'x-firebase-appcheck': 'token-appcheck',
        'content-type': 'application/json',
        'user-agent': 'test'
      },
      extraHeaders
    ),
    ip: '1.2.3.4',
    body,
    on() {},
    removeListener() {}
  };
}

beforeEach(() => {
  svuotaCacheTonyLandingAsk();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validaRichiesta fase account', () => {
  it('senza fase come prima; account ok; errori', () => {
    expect(
      validaRichiesta({
        domanda: 'ciao',
        sessione: SESSIONE,
        storia: []
      }).ok
    ).toBe(true);
    const ok = validaRichiesta({
      domanda: 'sede a Faenza',
      sessione: SESSIONE,
      storia: [],
      fase: 'account',
      argomento: 'sede'
    });
    expect(ok.ok).toBe(true);
    expect(ok.fase).toBe('account');
    expect(
      validaRichiesta({
        domanda: 'x',
        sessione: SESSIONE,
        storia: [],
        fase: 'altro',
        argomento: 'sede'
      }).ok
    ).toBe(false);
    expect(
      validaRichiesta({
        domanda: 'x',
        sessione: SESSIONE,
        storia: [],
        fase: 'account',
        argomento: 'no'
      }).ok
    ).toBe(false);
    expect(
      validaRichiesta({
        domanda: 'x',
        sessione: SESSIONE,
        storia: [],
        fase: 'account',
        argomento: 'sede',
        extra: 1
      }).ok
    ).toBe(false);
  });
});

describe('handleFaseAccount', () => {
  it('token mancante / non valido dopo App Check; limite account', async () => {
    const db = fakeDb({
      ['tonyLandingQuota/config_tonyLanding']: { enabled: true },
      ['config/tonyLanding']: {
        enabled: true,
        voiceEnabled: false,
        monthlyBudgetEur: 30,
        dailyQuestionCap: 1000,
        dailyVoiceCharCap: 0
      }
    });

    const res1 = fakeRes();
    await handleTonyLandingAsk(
      fakeReq({
        domanda: 'via roma',
        sessione: SESSIONE,
        storia: [],
        fase: 'account',
        argomento: 'sede'
      }),
      res1,
      {
        db,
        adesso: ADESSO_FISSO,
        verificaAppCheck: async () => ({}),
        verificaIdToken: async () => {
          throw new Error('no');
        },
        leggiConfig: async () => ({
          enabled: true,
          voiceEnabled: false,
          monthlyBudgetEur: 30,
          dailyQuestionCap: 1000,
          dailyVoiceCharCap: 0
        }),
        chiamaGemini: async () => ({ ok: true, testo: '{}' })
      }
    );
    expect(res1.statusCode).toBe(401);
    expect(res1.jsonBody.codice).toBe('accesso-mancante');

    const res2 = fakeRes();
    await handleTonyLandingAsk(
      fakeReq(
        {
          domanda: 'via roma',
          sessione: SESSIONE,
          storia: [],
          fase: 'account',
          argomento: 'sede'
        },
        { authorization: 'Bearer bad' }
      ),
      res2,
      {
        db,
        adesso: ADESSO_FISSO,
        verificaAppCheck: async () => ({}),
        verificaIdToken: async () => {
          throw new Error('bad');
        },
        leggiConfig: async () => ({
          enabled: true,
          voiceEnabled: false,
          monthlyBudgetEur: 30,
          dailyQuestionCap: 1000,
          dailyVoiceCharCap: 0
        }),
        chiamaGemini: async () => ({ ok: true, testo: '{}' })
      }
    );
    expect(res2.statusCode).toBe(401);
    expect(res2.jsonBody.codice).toBe('accesso-non-valido');

    const uid = 'utente-test-1';
    const hash = idAccount(uid);
    const seed = {
      ['tonyLandingQuota/g_' + giorno]: { domande: 0 },
      ['tonyLandingQuota/m_' + mese]: { costoEur: 0, domande: 0 },
      ['tonyLandingQuota/a_' + hash]: { count: 15 }
    };
    const dbLim = fakeDb(seed);
    const res3 = fakeRes();
    await handleTonyLandingAsk(
      fakeReq(
        {
          domanda: 'via roma',
          sessione: SESSIONE,
          storia: [],
          fase: 'account',
          argomento: 'sede'
        },
        { authorization: 'Bearer ok' }
      ),
      res3,
      {
        db: dbLim,
        adesso: ADESSO_FISSO,
        verificaAppCheck: async () => ({}),
        verificaIdToken: async () => ({ uid }),
        leggiConfig: async () => ({
          enabled: true,
          voiceEnabled: false,
          monthlyBudgetEur: 30,
          dailyQuestionCap: 1000,
          dailyVoiceCharCap: 0
        }),
        chiamaGemini: async () => ({ ok: true, testo: '{}' })
      }
    );
    const testo = res3.chunks.join('');
    expect(testo).toMatch(/limite-account/);
  });

  it('risposta unica chunk + done dati; CORS Authorization', async () => {
    const uid = 'utente-ok';
    const db = fakeDb({
      ['tonyLandingQuota/g_' + giorno]: { domande: 0, caratteriVoce: 0 },
      ['tonyLandingQuota/m_' + mese]: { costoEur: 0, domande: 0 }
    });
    const json = JSON.stringify({
      testo: 'Ho capito la sede.',
      sede: {
        indirizzo: 'Via Roma 12',
        citta: 'Faenza',
        cap: '48018',
        provincia: 'RA'
      },
      poderi: [],
      terreni: [],
      fatto: true,
      piva: 'non-deve-passare'
    });
    const res = fakeRes();
    await handleTonyLandingAsk(
      fakeReq(
        {
          domanda: 'via roma faenza',
          sessione: SESSIONE,
          storia: [],
          fase: 'account',
          argomento: 'sede'
        },
        { authorization: 'Bearer ok' }
      ),
      res,
      {
        db,
        adesso: ADESSO_FISSO,
        verificaAppCheck: async () => ({}),
        verificaIdToken: async () => ({ uid }),
        leggiConfig: async () => ({
          enabled: true,
          voiceEnabled: false,
          monthlyBudgetEur: 30,
          dailyQuestionCap: 1000,
          dailyVoiceCharCap: 0
        }),
        chiamaGemini: async () => ({
          ok: true,
          testo: json,
          tokenIngresso: 10,
          tokenUscita: 20
        })
      }
    );
    const stream = res.chunks.join('');
    expect(stream.match(/event: chunk/g).length).toBe(1);
    expect(stream).toMatch(/event: done/);
    expect(stream).toMatch(/"fatto":true/);
    expect(stream).not.toMatch(/piva/);
    expect(res.headers['Access-Control-Allow-Headers']).toMatch(/Authorization/);

    const aDoc = [...db.docs.keys()].find((k) => k.indexOf('/a_') >= 0);
    expect(aDoc).toBeTruthy();
    const a = db.docs.get(aDoc);
    expect(a.count).toBe(1);
    expect(a.expireAt).toBeTruthy();
  });
});

describe('prompt e pulizia', () => {
  it('regole, schema, ripiego, CORS costante', () => {
    expect(regoleTenute().length).toBe(9);
    for (const p of PREFISSI_ESCLUSI) {
      expect(REGOLE_TONY_LANDING.some((r) => r.indexOf(p) === 0)).toBe(true);
    }
    const prompt = promptSistemaAccount('sede');
    expect(prompt).not.toMatch(/Pierpaolo|Pier\b/);
    expect(prompt).toMatch(/5 €/);
    expect(SCHEMA_RISPOSTA_ACCOUNT.type).toBe('OBJECT');
    const corpo = corpoRichiestaGemini({
      promptSistema: 'x',
      storia: [],
      domanda: 'y',
      formatoAccount: true,
      schemaRisposta: SCHEMA_RISPOSTA_ACCOUNT
    });
    expect(corpo.generationConfig.responseMimeType).toBe('application/json');
    expect(corpo.generationConfig.maxOutputTokens).toBe(600);
    expect(corpo.tools).toBeUndefined();
    const pulita = rispostaAccountDaTesto(
      JSON.stringify({
        testo: 'Ho salvato tutto',
        sede: null,
        poderi: [],
        terreni: [],
        fatto: true
      })
    );
    expect(pulita.testo).toBe('Ecco il riepilogo: controlla e conferma');
    const rotto = rispostaAccountDaTesto('non-json');
    expect(rotto.dati).toBeNull();
    expect(COSTANTI.MAX_DOMANDE_ACCOUNT).toBe(15);
  });
});

describe('isolamento account file', () => {
  it('niente parole vietate', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const t = fs.readFileSync(
      path.join(root, 'functions/lib/tony-landing-account.js'),
      'utf8'
    );
    expect(t).not.toMatch(/\btenants\b/);
    expect(t).not.toMatch(/\busers\b/);
    expect(t).not.toMatch(/tonyLandingSetup/);
    expect(t).not.toMatch(/functionDeclarations/);
  });
});

describe('R6 account: log, expireAt, contatori', () => {
  it('niente dati personali nei log; expireAt 48h fisso; niente s_/v_/sale_', async () => {
    const uid = 'utente-ok';
    const hash = idAccount(uid);
    const db = fakeDb({
      ['tonyLandingQuota/g_' + giorno]: { domande: 0, caratteriVoce: 0 },
      ['tonyLandingQuota/m_' + mese]: { costoEur: 0, domande: 0 }
    });
    const json = JSON.stringify({
      testo: 'Ho capito.',
      sede: {
        indirizzo: 'Via Roma 12',
        citta: 'Faenza',
        cap: '48018',
        provincia: 'RA'
      },
      poderi: [{ nome: 'Casetti' }],
      terreni: [
        { nome: 'Campo grande', superficie: 2.34, coltura: 'Grano', podere: 'Casetti' }
      ],
      fatto: true
    });

    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = fakeRes();
    await handleTonyLandingAsk(
      fakeReq(
        {
          domanda: 'Via Roma 12, Faenza',
          sessione: SESSIONE,
          storia: [],
          fase: 'account',
          argomento: 'sede'
        },
        { authorization: 'Bearer tokensegretoXYZ' }
      ),
      res,
      {
        db,
        adesso: ADESSO_FISSO,
        verificaAppCheck: async () => ({}),
        verificaIdToken: async () => ({ uid }),
        leggiConfig: async () => ({
          enabled: true,
          voiceEnabled: false,
          monthlyBudgetEur: 30,
          dailyQuestionCap: 1000,
          dailyVoiceCharCap: 0
        }),
        chiamaGemini: async () => ({
          ok: true,
          testo: json,
          tokenIngresso: 10,
          tokenUscita: 20
        })
      }
    );

    const righe = [...info.mock.calls, ...warn.mock.calls, ...error.mock.calls, ...log.mock.calls]
      .map((c) => c.join(' '))
      .join('\n');
    for (const vietato of [
      'utente-ok',
      hash,
      'Roma',
      'Faenza',
      'Casetti',
      'Campo grande',
      '2.34',
      'tokensegretoXYZ'
    ]) {
      expect(righe).not.toContain(vietato);
    }

    const aDoc = [...db.docs.keys()].find((k) => k.indexOf('/a_') >= 0);
    const a = db.docs.get(aDoc);
    const atteso = ADESSO_FISSO.getTime() + 48 * 60 * 60 * 1000;
    const expireMs = (ex) =>
      typeof ex?.toMillis === 'function'
        ? ex.toMillis()
        : typeof ex?._seconds === 'number'
          ? ex._seconds * 1000
          : typeof ex?.seconds === 'number'
            ? ex.seconds * 1000
            : Number(ex);
    expect(expireMs(a.expireAt)).toBe(atteso);
    expect(a.count).toBe(1);

    const res2 = fakeRes();
    const dopo1h = new Date(ADESSO_FISSO.getTime() + 60 * 60 * 1000);
    await handleTonyLandingAsk(
      fakeReq(
        {
          domanda: 'Via Roma 12, Faenza',
          sessione: SESSIONE,
          storia: [],
          fase: 'account',
          argomento: 'sede'
        },
        { authorization: 'Bearer tokensegretoXYZ' }
      ),
      res2,
      {
        db,
        adesso: dopo1h,
        verificaAppCheck: async () => ({}),
        verificaIdToken: async () => ({ uid }),
        leggiConfig: async () => ({
          enabled: true,
          voiceEnabled: false,
          monthlyBudgetEur: 30,
          dailyQuestionCap: 1000,
          dailyVoiceCharCap: 0
        }),
        chiamaGemini: async () => ({
          ok: true,
          testo: json,
          tokenIngresso: 5,
          tokenUscita: 5
        })
      }
    );
    const a2 = db.docs.get(aDoc);
    expect(expireMs(a2.expireAt)).toBe(atteso);
    expect(a2.count).toBe(2);

    for (const k of db.docs.keys()) {
      expect(k).not.toMatch(/\/s_/);
      expect(k).not.toMatch(/\/v_/);
      expect(k).not.toMatch(/\/sale_/);
    }
    expect(db.docs.has('tonyLandingQuota/g_' + giorno)).toBe(true);
    expect(db.docs.has('tonyLandingQuota/m_' + mese)).toBe(true);

    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();
    log.mockRestore();
  });
});

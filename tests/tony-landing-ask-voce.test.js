/**
 * @vitest-environment node
 * Biglietto voce in tonyLandingAsk + flusso verso tonyLandingAudio (passo 12b).
 */
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  handleTonyLandingAsk,
  svuotaCacheTonyLandingAsk
} = require('../functions/tony-landing-ask.js');
const {
  handleTonyLandingAudio,
  svuotaCacheTonyLandingAudio
} = require('../functions/tony-landing-audio.js');
const { chiaviTempo, scadenze } = require('../functions/lib/tony-landing-limiti.js');
const { preparaTestoVoce } = require('../functions/lib/tony-landing-voce.js');

const ORIGINE = 'https://gfvagri.com';
const SESSIONE = 'a1b2c3d4-e5f6-7890-abcd';
const ADESSO_FISSO = new Date('2026-10-28T10:00:00.000Z');
const { giorno } = chiaviTempo(ADESSO_FISSO);

function isIncrement(v) {
  return (
    v &&
    typeof v === 'object' &&
    typeof v.operand === 'number' &&
    v.constructor &&
    v.constructor.name === 'NumericIncrementTransform'
  );
}
function isServerTs(v) {
  return (
    v &&
    typeof v === 'object' &&
    v.constructor &&
    v.constructor.name === 'ServerTimestampTransform'
  );
}
function risolviMerge(prev, data) {
  const out = Object.assign({}, prev || {});
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (isIncrement(v)) {
      out[k] = (typeof out[k] === 'number' ? out[k] : 0) + v.operand;
    } else if (isServerTs(v)) {
      out[k] = { __serverTimestamp: true };
    } else {
      out[k] = structuredClone(v);
    }
  }
  return out;
}

function fakeDb(seed) {
  const docs = new Map(Object.entries(seed || {}));
  const percorsiToccati = [];
  const stato = { failVoce: false };
  function mark(p) {
    percorsiToccati.push(p);
  }
  function makeDoc(fullPath) {
    return {
      path: fullPath,
      id: fullPath.split('/').pop(),
      async get() {
        mark(fullPath);
        if (!docs.has(fullPath)) {
          return { exists: false, data: () => undefined, ref: makeDoc(fullPath) };
        }
        return {
          exists: true,
          ref: makeDoc(fullPath),
          data: () => structuredClone(docs.get(fullPath))
        };
      },
      async set(data, opts) {
        mark(fullPath);
        if (fullPath.includes('voce_') && stato.failVoce) {
          throw new Error('biglietto-fail');
        }
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
    stato,
    percorsiToccati,
    collection(name) {
      return {
        doc(id) {
          return makeDoc(name + '/' + id);
        }
      };
    },
    async runTransaction(fn) {
      const pending = [];
      const tx = {
        async get(ref) {
          mark(ref.path);
          if (!docs.has(ref.path)) {
            return { exists: false, data: () => undefined, ref };
          }
          return {
            exists: true,
            ref,
            data: () => structuredClone(docs.get(ref.path))
          };
        },
        set(ref, data, opts) {
          pending.push({ path: ref.path, data, merge: !!(opts && opts.merge) });
        }
      };
      const risultato = await fn(tx);
      for (const w of pending) {
        mark(w.path);
        if (w.merge) docs.set(w.path, risolviMerge(docs.get(w.path), w.data));
        else docs.set(w.path, risolviMerge({}, w.data));
      }
      return risultato;
    }
  };
}

function fakeReq(extra) {
  return Object.assign(
    {
      method: 'POST',
      headers: {
        origin: ORIGINE,
        'x-firebase-appcheck': 'token-ok',
        'user-agent': 'VitestUA/1.0',
        'x-forwarded-for': '203.0.113.10'
      },
      body: { domanda: "Cos'è GFV?", sessione: SESSIONE },
      ip: '203.0.113.10',
      on() {},
      off() {},
      removeListener() {}
    },
    extra || {}
  );
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
    get ended() {
      return ended;
    },
    get jsonBody() {
      return jsonBody;
    },
    get headersSent() {
      return ended || chunks.length > 0 || jsonBody != null;
    },
    status(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      headers[k] = v;
    },
    json(obj) {
      jsonBody = obj;
      ended = true;
      return this;
    },
    write(s) {
      chunks.push(String(s));
    },
    end() {
      ended = true;
    },
    flush() {},
    flushHeaders() {},
    ultimoDone() {
      const testo = chunks.join('');
      const re = /event: done\ndata: (\{[\s\S]*?\})\n\n/g;
      let m;
      let last = null;
      while ((m = re.exec(testo))) last = JSON.parse(m[1]);
      return last;
    }
  };
}

function configDoc(extra) {
  return {
    ['config/tonyLanding']: Object.assign(
      {
        enabled: true,
        voiceEnabled: true,
        dailyQuestionCap: 1000,
        dailyVoiceCharCap: 60000,
        monthlyBudgetEur: 30
      },
      extra || {}
    )
  };
}

function geminiOk(testo) {
  const pezzi = testo || 'GFV ti aiuta in azienda.';
  return async function (_corpo, segnali) {
    if (segnali && segnali.onChunk) segnali.onChunk(pezzi);
    return { ok: true, testo: pezzi, tokenIngresso: 100, tokenUscita: 50 };
  };
}

beforeEach(() => {
  svuotaCacheTonyLandingAsk();
  svuotaCacheTonyLandingAudio();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('biglietto in tonyLandingAsk', () => {
  it('voiceEnabled true → voce e documento voce_', async () => {
    const db = fakeDb(configDoc());
    const res = fakeRes();
    await handleTonyLandingAsk(fakeReq(), res, {
      db,
      verificaAppCheck: async () => ({}),
      chiamaGemini: geminiOk(),
      adesso: ADESSO_FISSO
    });
    const done = res.ultimoDone();
    expect(done.codice).toBe('ok');
    expect(done.voce).toBe(true);
    expect(done.idVoce).toMatch(/^[a-f0-9]{32}$/);
    const doc = db.docs.get('tonyLandingQuota/voce_' + done.idVoce);
    expect(doc).toBeTruthy();
    expect(doc.usato).toBe(false);
    expect(doc.hashTesto).toBeTruthy();
    expect(doc.hashSessione).toBeTruthy();
    expect(doc.caratteri).toBe(preparaTestoVoce(done.testo).length);
    expect(JSON.stringify(doc)).not.toContain(done.testo);
    expect(JSON.stringify(doc)).not.toContain(SESSIONE);
  });

  it('voiceEnabled false o assente → niente biglietto', async () => {
    for (const extra of [{ voiceEnabled: false }, {}]) {
      const seed = configDoc(extra);
      if (!('voiceEnabled' in extra)) delete seed['config/tonyLanding'].voiceEnabled;
      else seed['config/tonyLanding'].voiceEnabled = false;
      const db = fakeDb(seed);
      const res = fakeRes();
      await handleTonyLandingAsk(fakeReq(), res, {
        db,
        verificaAppCheck: async () => ({}),
        chiamaGemini: geminiOk(),
        adesso: ADESSO_FISSO,
        leggiConfig: async () => ({
          enabled: true,
          voiceEnabled: false,
          dailyVoiceCharCap: 60000,
          monthlyBudgetEur: 30,
          dailyQuestionCap: 1000
        })
      });
      const done = res.ultimoDone();
      expect(done.voce).toBe(false);
      expect(done.idVoce).toBeUndefined();
      const voci = [...db.docs.keys()].filter((k) => k.includes('/voce_'));
      expect(voci).toHaveLength(0);
    }
  });

  it('caratteriVoce al tetto → voce false', async () => {
    const db = fakeDb({
      ...configDoc(),
      ['tonyLandingQuota/g_' + giorno]: { caratteriVoce: 60000, domande: 0 }
    });
    const res = fakeRes();
    await handleTonyLandingAsk(fakeReq(), res, {
      db,
      verificaAppCheck: async () => ({}),
      chiamaGemini: geminiOk(),
      adesso: ADESSO_FISSO
    });
    const done = res.ultimoDone();
    expect(done.voce).toBe(false);
    expect(done.idVoce).toBeUndefined();
  });

  it('testo 801 caratteri → voce false', async () => {
    const db = fakeDb(configDoc());
    const res = fakeRes();
    await handleTonyLandingAsk(fakeReq(), res, {
      db,
      verificaAppCheck: async () => ({}),
      chiamaGemini: geminiOk('x'.repeat(801)),
      adesso: ADESSO_FISSO
    });
    expect(res.ultimoDone().voce).toBe(false);
  });

  it('scrittura biglietto fallita → ok ma voce false', async () => {
    const db = fakeDb(configDoc());
    db.stato.failVoce = true;
    const res = fakeRes();
    await handleTonyLandingAsk(fakeReq(), res, {
      db,
      verificaAppCheck: async () => ({}),
      chiamaGemini: geminiOk(),
      adesso: ADESSO_FISSO
    });
    const done = res.ultimoDone();
    expect(done.codice).toBe('ok');
    expect(done.voce).toBe(false);
    expect(done.idVoce).toBeUndefined();
  });

  it('done non ok senza idVoce', async () => {
    const db = fakeDb(
      configDoc({ enabled: false })
    );
    const res = fakeRes();
    await handleTonyLandingAsk(fakeReq(), res, {
      db,
      verificaAppCheck: async () => ({}),
      chiamaGemini: geminiOk(),
      adesso: ADESSO_FISSO,
      leggiConfig: async () => ({
        enabled: false,
        voiceEnabled: true,
        dailyVoiceCharCap: 60000,
        monthlyBudgetEur: 30,
        dailyQuestionCap: 1000
      })
    });
    const done = res.ultimoDone();
    expect(done.codice).toBe('spento');
    expect(done.voce).toBe(false);
    expect(done.idVoce).toBeUndefined();
  });
});

describe('flusso ask → audio', () => {
  it('done passato ad audio → 200; testo inventato → 409', async () => {
    const db = fakeDb(configDoc());
    const resAsk = fakeRes();
    await handleTonyLandingAsk(fakeReq(), resAsk, {
      db,
      verificaAppCheck: async () => ({}),
      chiamaGemini: geminiOk('Con GFV lavori meglio.'),
      adesso: ADESSO_FISSO
    });
    const done = resAsk.ultimoDone();
    expect(done.voce).toBe(true);

    const pezzi = [];
    const resAudio = fakeRes();
    await handleTonyLandingAudio(
      {
        method: 'POST',
        headers: {
          origin: ORIGINE,
          'x-firebase-appcheck': 'token-ok'
        },
        body: {
          idVoce: done.idVoce,
          sessione: SESSIONE,
          testo: done.testo
        },
        on() {},
        off() {},
        removeListener() {}
      },
      resAudio,
      {
        db,
        verificaAppCheck: async () => ({}),
        leggiConfig: async () => ({
          enabled: true,
          voiceEnabled: true,
          dailyVoiceCharCap: 60000,
          monthlyBudgetEur: 30
        }),
        adesso: ADESSO_FISSO,
        sintetizza: async (t) => {
          pezzi.push(t);
          return {
            ok: true,
            status: 200,
            body: {
              getReader() {
                let n = 0;
                return {
                  async read() {
                    if (n++) return { done: true };
                    return { done: false, value: Buffer.from('mp3') };
                  }
                };
              }
            }
          };
        }
      }
    );
    expect(resAudio.statusCode).toBe(200);
    expect(pezzi[0]).toContain('Gi, effe, vu');

    const resBad = fakeRes();
    await handleTonyLandingAudio(
      {
        method: 'POST',
        headers: {
          origin: ORIGINE,
          'x-firebase-appcheck': 'token-ok'
        },
        body: {
          idVoce: 'bb'.repeat(16),
          sessione: SESSIONE,
          testo: 'testo inventato del tutto'
        },
        on() {},
        off() {},
        removeListener() {}
      },
      resBad,
      {
        db,
        verificaAppCheck: async () => ({}),
        leggiConfig: async () => ({
          enabled: true,
          voiceEnabled: true,
          dailyVoiceCharCap: 60000,
          monthlyBudgetEur: 30
        }),
        adesso: ADESSO_FISSO,
        sintetizza: async () => {
          throw new Error('no');
        }
      }
    );
    expect(resBad.statusCode).toBe(409);
  });
});

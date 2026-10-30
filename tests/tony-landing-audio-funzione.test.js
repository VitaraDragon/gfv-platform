/**
 * @vitest-environment node
 * handleTonyLandingAudio con Firestore, App Check e sintesi finti (passo 12b).
 */
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  handleTonyLandingAudio,
  svuotaCacheTonyLandingAudio,
  sintetizzaDefault
} = require('../functions/tony-landing-audio.js');
const {
  COSTANTI_VOCE,
  preparaTestoVoce,
  impronta,
  datiBiglietto,
  corpoElevenLabs,
  urlElevenLabs
} = require('../functions/lib/tony-landing-voce.js');
const {
  ORIGINI_AMMESSE,
  chiaviTempo,
  scadenze
} = require('../functions/lib/tony-landing-limiti.js');

const ORIGINE = 'https://gfvagri.com';
const SESSIONE = 'a1b2c3d4-e5f6-7890-abcd';
const ID_VOCE = 'aabbccddeeff00112233445566778899';
const TESTO = 'Con GFV costi 5 € al mese.';
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
      const base = typeof out[k] === 'number' ? out[k] : 0;
      out[k] = base + v.operand;
    } else if (isServerTs(v)) {
      out[k] = { __serverTimestamp: true };
    } else if (v && typeof v === 'object' && typeof v.toDate === 'function') {
      out[k] = v;
    } else {
      out[k] = structuredClone(v);
    }
  }
  return out;
}

function fakeDb(seed) {
  const docs = new Map(Object.entries(seed || {}));
  const percorsiToccati = [];
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
          return {
            exists: false,
            data: () => undefined,
            id: fullPath.split('/').pop(),
            ref: makeDoc(fullPath)
          };
        }
        return {
          exists: true,
          id: fullPath.split('/').pop(),
          ref: makeDoc(fullPath),
          data: () => structuredClone(docs.get(fullPath))
        };
      },
      async set(data, opts) {
        mark(fullPath);
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
    percorsiToccati,
    collection(name) {
      return {
        path: name,
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
            return {
              exists: false,
              data: () => undefined,
              id: ref.path.split('/').pop(),
              ref
            };
          }
          return {
            exists: true,
            id: ref.path.split('/').pop(),
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
        if (w.merge) {
          docs.set(w.path, risolviMerge(docs.get(w.path), w.data));
        } else {
          docs.set(w.path, risolviMerge({}, w.data));
        }
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
        'user-agent': 'VitestUA/1.0'
      },
      body: { idVoce: ID_VOCE, sessione: SESSIONE, testo: TESTO },
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
      chunks.push(Buffer.isBuffer(s) ? s : Buffer.from(String(s)));
    },
    end() {
      ended = true;
    }
  };
}

function bigliettoSeed(overrides) {
  const base = datiBiglietto({
    testo: TESTO,
    sessione: SESSIONE,
    adesso: ADESSO_FISSO.getTime(),
    expireAt: scad.contatori
  });
  return Object.assign(base, overrides || {});
}

function configAccesa(extra) {
  return Object.assign(
    {
      enabled: true,
      voiceEnabled: true,
      dailyVoiceCharCap: 60000,
      monthlyBudgetEur: 30,
      dailyQuestionCap: 1000
    },
    extra || {}
  );
}

function pezziAudio() {
  return [Buffer.from('AAA'), Buffer.from('BBB'), Buffer.from('CCC')];
}

function sintetizzaOk(registro) {
  return async function (testoVoce) {
    registro.push(testoVoce);
    const pezzi = pezziAudio();
    let i = 0;
    return {
      ok: true,
      status: 200,
      body: {
        getReader() {
          return {
            async read() {
              if (i >= pezzi.length) return { done: true, value: undefined };
              const value = pezzi[i++];
              return { done: false, value };
            }
          };
        }
      }
    };
  };
}

beforeEach(() => {
  svuotaCacheTonyLandingAudio();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CORS e metodo', () => {
  it('origine non ammessa senza Allow-Origin; OPTIONS e GET', async () => {
    const res = fakeRes();
    await handleTonyLandingAudio(fakeReq({ headers: { origin: 'https://evil.it' } }), res, {
      db: fakeDb(),
      verificaAppCheck: async () => ({}),
      sintetizza: async () => {
        throw new Error('no');
      },
      adesso: ADESSO_FISSO
    });
    expect(res.statusCode).toBe(403);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();

    const resOpt = fakeRes();
    await handleTonyLandingAudio(
      fakeReq({ method: 'OPTIONS', headers: { origin: ORIGINE } }),
      resOpt,
      { db: fakeDb(), adesso: ADESSO_FISSO }
    );
    expect(resOpt.statusCode).toBe(204);
    expect(resOpt.headers['Access-Control-Allow-Origin']).toBe(ORIGINE);
    expect(resOpt.headers['Access-Control-Allow-Methods']).toContain('POST');

    const resGet = fakeRes();
    await handleTonyLandingAudio(fakeReq({ method: 'GET' }), resGet, {
      db: fakeDb(),
      adesso: ADESSO_FISSO
    });
    expect(resGet.statusCode).toBe(405);

    for (const o of ORIGINI_AMMESSE) {
      const r = fakeRes();
      await handleTonyLandingAudio(
        fakeReq({
          headers: { origin: o },
          body: { idVoce: 'no' }
        }),
        r,
        {
          db: fakeDb(),
          verificaAppCheck: async () => ({}),
          adesso: ADESSO_FISSO,
          sintetizza: async () => {
            throw new Error('no');
          }
        }
      );
      expect(r.headers['Access-Control-Allow-Origin']).toBe(o);
    }
    for (const o of ['https://gfvagri.com.evil.it', null]) {
      const r = fakeRes();
      await handleTonyLandingAudio(
        fakeReq({
          headers: o === null ? {} : { origin: o }
        }),
        r,
        { db: fakeDb(), adesso: ADESSO_FISSO }
      );
      expect(r.statusCode).toBe(403);
    }
  });
});

describe('App Check e corpo', () => {
  it('mancante o non valido: nessun doc e nessuna sintesi', async () => {
    const registro = [];
    const db = fakeDb();
    const res = fakeRes();
    await handleTonyLandingAudio(
      fakeReq({
        headers: { origin: ORIGINE }
      }),
      res,
      {
        db,
        sintetizza: sintetizzaOk(registro),
        adesso: ADESSO_FISSO
      }
    );
    expect(res.statusCode).toBe(401);
    expect(res.jsonBody.codice).toBe('app-check-mancante');
    expect(registro).toHaveLength(0);
    expect(db.percorsiToccati).toHaveLength(0);

    const db2 = fakeDb();
    const res2 = fakeRes();
    await handleTonyLandingAudio(fakeReq(), res2, {
      db: db2,
      verificaAppCheck: async () => {
        throw new Error('bad');
      },
      sintetizza: sintetizzaOk(registro),
      adesso: ADESSO_FISSO
    });
    expect(res2.jsonBody.codice).toBe('app-check-non-valido');
    expect(registro).toHaveLength(0);
    expect(db2.percorsiToccati).toHaveLength(0);
  });

  it('corpo troppo grande, JSON e validazione', async () => {
    const registro = [];
    const res = fakeRes();
    await handleTonyLandingAudio(
      fakeReq({ body: Buffer.alloc(COSTANTI_VOCE.MAX_BYTE_RICHIESTA + 1) }),
      res,
      {
        db: fakeDb(),
        verificaAppCheck: async () => ({}),
        sintetizza: sintetizzaOk(registro),
        adesso: ADESSO_FISSO
      }
    );
    expect(res.statusCode).toBe(413);

    const res2 = fakeRes();
    await handleTonyLandingAudio(fakeReq({ body: '{no' }), res2, {
      db: fakeDb(),
      verificaAppCheck: async () => ({}),
      sintetizza: sintetizzaOk(registro),
      adesso: ADESSO_FISSO
    });
    expect(res2.statusCode).toBe(400);

    const res3 = fakeRes();
    await handleTonyLandingAudio(
      fakeReq({ body: { ...fakeReq().body, extra: 1 } }),
      res3,
      {
        db: fakeDb(),
        verificaAppCheck: async () => ({}),
        sintetizza: sintetizzaOk(registro),
        adesso: ADESSO_FISSO
      }
    );
    expect(res3.jsonBody.codice).toBe('richiesta-non-valida');

    const res4 = fakeRes();
    await handleTonyLandingAudio(
      fakeReq({ body: { idVoce: ID_VOCE, sessione: SESSIONE, testo: 'x'.repeat(801) } }),
      res4,
      {
        db: fakeDb({ 'config/tonyLanding': configAccesa() }),
        verificaAppCheck: async () => ({}),
        leggiConfig: async () => configAccesa(),
        sintetizza: sintetizzaOk(registro),
        adesso: ADESSO_FISSO
      }
    );
    expect(res4.jsonBody.codice).toBe('testo-troppo-lungo');
    expect(registro).toHaveLength(0);
  });
});

describe('interruttori tetto biglietto riuscita', () => {
  it('voce spenta senza sintesi né contatori', async () => {
    const registro = [];
    for (const cfg of [null, { enabled: true, voiceEnabled: false }, { enabled: true }]) {
      const db = fakeDb(
        cfg ? { 'config/tonyLanding': cfg } : {}
      );
      const res = fakeRes();
      await handleTonyLandingAudio(fakeReq(), res, {
        db,
        verificaAppCheck: async () => ({}),
        leggiConfig: async () =>
          cfg
            ? Object.assign(
                { dailyVoiceCharCap: 60000, monthlyBudgetEur: 30 },
                cfg,
                { voiceEnabled: cfg.voiceEnabled === true }
              )
            : { enabled: false, voiceEnabled: false, dailyVoiceCharCap: 60000 },
        sintetizza: sintetizzaOk(registro),
        adesso: ADESSO_FISSO
      });
      expect(res.statusCode).toBe(503);
      expect(res.jsonBody.codice).toBe('voce-spenta');
    }
    expect(registro).toHaveLength(0);
  });

  it('biglietto assente/diverso/usato/scaduto', async () => {
    const registro = [];
    const casi = [
      {},
      {
        ['tonyLandingQuota/voce_' + ID_VOCE]: bigliettoSeed({
          hashTesto: impronta(TESTO + ' ')
        })
      },
      {
        ['tonyLandingQuota/voce_' + ID_VOCE]: bigliettoSeed({
          hashSessione: impronta('altra-sessione-xxxx')
        })
      },
      {
        ['tonyLandingQuota/voce_' + ID_VOCE]: bigliettoSeed({ usato: true })
      },
      {
        ['tonyLandingQuota/voce_' + ID_VOCE]: bigliettoSeed({
          scadeIlMs: ADESSO_FISSO.getTime() - 11 * 60 * 1000
        })
      }
    ];
    const codici = [
      'voce-non-valida',
      'voce-non-valida',
      'voce-non-valida',
      'voce-gia-usata',
      'voce-scaduta'
    ];
    for (let i = 0; i < casi.length; i++) {
      const db = fakeDb(casi[i]);
      const res = fakeRes();
      await handleTonyLandingAudio(fakeReq(), res, {
        db,
        verificaAppCheck: async () => ({}),
        leggiConfig: async () => configAccesa(),
        sintetizza: sintetizzaOk(registro),
        adesso: ADESSO_FISSO
      });
      expect(res.statusCode).toBe(409);
      expect(res.jsonBody.codice).toBe(codici[i]);
    }
    expect(registro).toHaveLength(0);
  });

  it('tetto caratteri giorno; spesa Gemini non spegne la voce', async () => {
    const registro = [];
    const b = bigliettoSeed({ caratteri: 200 });
    const db = fakeDb({
      ['tonyLandingQuota/voce_' + ID_VOCE]: b,
      ['tonyLandingQuota/g_' + giorno]: { caratteriVoce: 59900 },
      ['tonyLandingQuota/m_' + mese]: { costoEur: 0 }
    });
    const res = fakeRes();
    await handleTonyLandingAudio(fakeReq(), res, {
      db,
      verificaAppCheck: async () => ({}),
      leggiConfig: async () => configAccesa({ dailyVoiceCharCap: 60000 }),
      sintetizza: sintetizzaOk(registro),
      adesso: ADESSO_FISSO
    });
    expect(res.statusCode).toBe(429);
    expect(res.jsonBody.codice).toBe('tetto-voce');
    expect(db.docs.get('tonyLandingQuota/voce_' + ID_VOCE).usato).toBe(false);
    expect(registro).toHaveLength(0);

    const caratteri = preparaTestoVoce(TESTO).length;
    const db2 = fakeDb({
      ['tonyLandingQuota/voce_' + ID_VOCE]: bigliettoSeed({ caratteri }),
      ['tonyLandingQuota/g_' + giorno]: { caratteriVoce: 0 },
      ['tonyLandingQuota/m_' + mese]: { costoEur: 24, spesaGeminiRipartita: true }
    });
    const res2 = fakeRes();
    await handleTonyLandingAudio(fakeReq(), res2, {
      db: db2,
      verificaAppCheck: async () => ({}),
      leggiConfig: async () => configAccesa(),
      sintetizza: sintetizzaOk(registro),
      adesso: ADESSO_FISSO
    });
    expect(res2.statusCode).toBe(200);
  });

  it('riuscita 200 audio e seconda chiamata usata', async () => {
    const registro = [];
    const caratteri = preparaTestoVoce(TESTO).length;
    const db = fakeDb({
      ['tonyLandingQuota/voce_' + ID_VOCE]: bigliettoSeed({ caratteri }),
      ['tonyLandingQuota/g_' + giorno]: { caratteriVoce: 0, voci: 0, costoEur: 0 },
      ['tonyLandingQuota/m_' + mese]: { caratteriVoce: 0, costoEur: 0 }
    });
    const res = fakeRes();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await handleTonyLandingAudio(fakeReq(), res, {
      db,
      verificaAppCheck: async () => ({}),
      leggiConfig: async () => configAccesa(),
      sintetizza: sintetizzaOk(registro),
      adesso: ADESSO_FISSO
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('audio/mpeg');
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(Buffer.concat(res.chunks).toString()).toBe('AAABBBCCC');
    expect(registro).toEqual([preparaTestoVoce(TESTO)]);
    expect(registro[0]).toContain('Gi effe vu');
    expect(registro[0]).toContain('euro');
    const g = db.docs.get('tonyLandingQuota/g_' + giorno);
    expect(g.caratteriVoce).toBe(caratteri);
    expect(g.voci).toBe(1);
    expect(g.costoEur == null || g.costoEur === 0).toBe(true);
    expect(db.docs.get('tonyLandingQuota/m_' + mese).costoEur).toBe(0);
    expect(db.docs.get('tonyLandingQuota/voce_' + ID_VOCE).usato).toBe(true);

    const res2 = fakeRes();
    await handleTonyLandingAudio(fakeReq(), res2, {
      db,
      verificaAppCheck: async () => ({}),
      leggiConfig: async () => configAccesa(),
      sintetizza: sintetizzaOk(registro),
      adesso: ADESSO_FISSO
    });
    expect(res2.jsonBody.codice).toBe('voce-gia-usata');
    expect(registro).toHaveLength(1);

    const logJoin = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logJoin).not.toContain(TESTO);
    expect(logJoin).not.toContain(SESSIONE);
    expect(logJoin).not.toContain(ID_VOCE);
    spy.mockRestore();
  });

  it('ElevenLabs fallisce: 502 e contatore già conteggiato', async () => {
    const caratteri = preparaTestoVoce(TESTO).length;
    const db = fakeDb({
      ['tonyLandingQuota/voce_' + ID_VOCE]: bigliettoSeed({ caratteri }),
      ['tonyLandingQuota/g_' + giorno]: { caratteriVoce: 0 },
      ['tonyLandingQuota/m_' + mese]: { costoEur: 0 }
    });
    const res = fakeRes();
    await handleTonyLandingAudio(fakeReq(), res, {
      db,
      verificaAppCheck: async () => ({}),
      leggiConfig: async () => configAccesa(),
      sintetizza: async () => {
        throw new Error('boom');
      },
      adesso: ADESSO_FISSO
    });
    expect(res.statusCode).toBe(502);
    expect(res.jsonBody.codice).toBe('voce-errore');
    expect(db.docs.get('tonyLandingQuota/g_' + giorno).caratteriVoce).toBe(caratteri);
    expect(db.docs.get('tonyLandingQuota/voce_' + ID_VOCE).usato).toBe(true);
  });

  it('sintetizzaDefault con fetch finto', async () => {
    const chiamate = [];
    const fetchFn = async (url, opts) => {
      chiamate.push({ url, opts });
      return { ok: true, status: 200, body: { getReader: () => ({ async read() { return { done: true }; } }) } };
    };
    await sintetizzaDefault('ciao', {
      chiave: 'chiave-finta-test',
      fetchFn
    });
    expect(chiamate).toHaveLength(1);
    expect(chiamate[0].url).toBe(urlElevenLabs());
    expect(chiamate[0].opts.method).toBe('POST');
    expect(chiamate[0].opts.headers['xi-api-key']).toBe('chiave-finta-test');
    expect(chiamate[0].opts.headers.Accept).toBe('audio/mpeg');
    expect(JSON.parse(chiamate[0].opts.body)).toEqual(corpoElevenLabs('ciao'));
  });
});

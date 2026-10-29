/**
 * @vitest-environment node
 * handleTonyLandingAsk con Firestore, App Check e Gemini finti (passo 10).
 */
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const {
  handleTonyLandingAsk,
  svuotaCacheTonyLandingAsk
} = require('../functions/tony-landing-ask.js');
const { COSTANTI, chiaviTempo, scadenze } = require('../functions/lib/tony-landing-limiti.js');

const ORIGINE = 'https://gfvagri.com';
const SESSIONE = 'a1b2c3d4-e5f6-7890-abcd';
const ADESSO_FISSO = new Date('2026-10-28T10:00:00.000Z');
const { giorno, mese } = chiaviTempo(ADESSO_FISSO);
const scad = scadenze(ADESSO_FISSO);

function isIncrement(v) {
  return v && typeof v === 'object' && typeof v.operand === 'number' && v.constructor &&
    v.constructor.name === 'NumericIncrementTransform';
}

function isServerTs(v) {
  return v && typeof v === 'object' && v.constructor &&
    v.constructor.name === 'ServerTimestampTransform';
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

/**
 * Finto Firestore in memoria con FieldValue.increment e runTransaction.
 */
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
          return { exists: false, data: () => undefined, id: fullPath.split('/').pop(), ref: makeDoc(fullPath) };
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

  function makeCol(colPath) {
    return {
      path: colPath,
      doc(id) {
        return makeDoc(colPath + '/' + id);
      }
    };
  }

  return {
    docs,
    percorsiToccati,
    collection(name) {
      return makeCol(name);
    },
    async runTransaction(fn) {
      const pending = [];
      const tx = {
        async get(ref) {
          mark(ref.path);
          if (!docs.has(ref.path)) {
            return { exists: false, data: () => undefined, id: ref.path.split('/').pop(), ref };
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
  const listeners = {};
  return Object.assign(
    {
      method: 'POST',
      headers: {
        origin: ORIGINE,
        'x-firebase-appcheck': 'token-ok',
        'user-agent': 'VitestUA/1.0',
        'x-forwarded-for': '203.0.113.10'
      },
      body: { domanda: 'Cos\'è GFV?', sessione: SESSIONE },
      ip: '203.0.113.10',
      on(ev, fn) {
        listeners[ev] = listeners[ev] || [];
        listeners[ev].push(fn);
      },
      off(ev, fn) {
        listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn);
      },
      removeListener(ev, fn) {
        this.off(ev, fn);
      },
      _listeners: listeners
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
    eventiSse() {
      const testo = chunks.join('');
      const out = [];
      const re = /event: (\w+)\ndata: (\{[\s\S]*?\})\n\n/g;
      let m;
      while ((m = re.exec(testo))) {
        out.push({ evento: m[1], dati: JSON.parse(m[2]) });
      }
      return out;
    },
    ultimoDone() {
      const ev = this.eventiSse().filter((e) => e.evento === 'done');
      return ev.length ? ev[ev.length - 1].dati : null;
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
    if (segnali && segnali.onChunk) {
      segnali.onChunk(pezzi.slice(0, 5));
      segnali.onChunk(pezzi.slice(5));
    }
    return {
      ok: true,
      testo: pezzi,
      tokenIngresso: 3000,
      tokenUscita: 200
    };
  };
}

async function chiama(db, extraReq, extraOpt) {
  const req = fakeReq(extraReq);
  const res = fakeRes();
  const verifica = vi.fn(async () => ({ appId: 'fake' }));
  await handleTonyLandingAsk(req, res, Object.assign(
    {
      db,
      verificaAppCheck: verifica,
      chiamaGemini: geminiOk(),
      adesso: ADESSO_FISSO
    },
    extraOpt || {}
  ));
  return { req, res, verifica, db };
}

beforeEach(() => {
  svuotaCacheTonyLandingAsk();
});

afterEach(() => {
  svuotaCacheTonyLandingAsk();
  vi.restoreAllMocks();
});

describe('origine e metodi', () => {
  it('origine non ammessa → 403, niente App Check né Gemini né Firestore', async () => {
    const db = fakeDb(configDoc());
    const verifica = vi.fn();
    const gemini = vi.fn();
    const res = fakeRes();
    await handleTonyLandingAsk(
      fakeReq({ headers: { origin: 'https://esempio.com', 'x-firebase-appcheck': 't' } }),
      res,
      { db, verificaAppCheck: verifica, chiamaGemini: gemini, adesso: ADESSO_FISSO }
    );
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody.codice).toBe('origine-non-ammessa');
    expect(verifica).not.toHaveBeenCalled();
    expect(gemini).not.toHaveBeenCalled();
    expect(db.percorsiToccati).toHaveLength(0);
  });

  it('OPTIONS 204 e GET 405', async () => {
    const db = fakeDb({});
    const resOpt = fakeRes();
    await handleTonyLandingAsk(
      fakeReq({ method: 'OPTIONS', body: undefined }),
      resOpt,
      { db, verificaAppCheck: vi.fn(), chiamaGemini: vi.fn(), adesso: ADESSO_FISSO }
    );
    expect(resOpt.statusCode).toBe(204);
    expect(resOpt.headers['Access-Control-Allow-Origin']).toBe(ORIGINE);
    expect(resOpt.headers.Vary).toBe('Origin');

    const resGet = fakeRes();
    await handleTonyLandingAsk(
      fakeReq({ method: 'GET' }),
      resGet,
      { db, verificaAppCheck: vi.fn(), chiamaGemini: vi.fn(), adesso: ADESSO_FISSO }
    );
    expect(resGet.statusCode).toBe(405);
  });
});

describe('App Check', () => {
  it('senza header → 401; token rifiutato → 401; Firestore e Gemini intatti', async () => {
    const db = fakeDb(configDoc());
    const gemini = vi.fn();
    const res1 = fakeRes();
    await handleTonyLandingAsk(
      fakeReq({
        headers: { origin: ORIGINE, 'user-agent': 'x' }
      }),
      res1,
      { db, verificaAppCheck: vi.fn(), chiamaGemini: gemini, adesso: ADESSO_FISSO }
    );
    expect(res1.statusCode).toBe(401);
    expect(res1.jsonBody.codice).toBe('app-check-mancante');
    expect(gemini).not.toHaveBeenCalled();
    expect(db.percorsiToccati).toHaveLength(0);

    const res2 = fakeRes();
    await handleTonyLandingAsk(
      fakeReq(),
      res2,
      {
        db,
        verificaAppCheck: async () => {
          throw new Error('bad');
        },
        chiamaGemini: gemini,
        adesso: ADESSO_FISSO
      }
    );
    expect(res2.statusCode).toBe(401);
    expect(res2.jsonBody.codice).toBe('app-check-non-valido');
    expect(gemini).not.toHaveBeenCalled();
  });
});

describe('corpo', () => {
  it('troppo grande → 413; domanda lunga / chiave extra → 400', async () => {
    const db = fakeDb(configDoc());
    const res413 = fakeRes();
    await handleTonyLandingAsk(
      fakeReq({
        body: { domanda: 'x'.repeat(9000), sessione: SESSIONE }
      }),
      res413,
      {
        db,
        verificaAppCheck: async () => ({}),
        chiamaGemini: vi.fn(),
        adesso: ADESSO_FISSO
      }
    );
    expect(res413.statusCode).toBe(413);

    const res400a = fakeRes();
    await handleTonyLandingAsk(
      fakeReq({
        body: { domanda: 'a'.repeat(301), sessione: SESSIONE }
      }),
      res400a,
      {
        db,
        verificaAppCheck: async () => ({}),
        chiamaGemini: vi.fn(),
        adesso: ADESSO_FISSO
      }
    );
    expect(res400a.statusCode).toBe(400);
    expect(res400a.jsonBody.codice).toBe('domanda-troppo-lunga');

    const res400b = fakeRes();
    await handleTonyLandingAsk(
      fakeReq({
        body: { domanda: 'ciao', sessione: SESSIONE, hack: true }
      }),
      res400b,
      {
        db,
        verificaAppCheck: async () => ({}),
        chiamaGemini: vi.fn(),
        adesso: ADESSO_FISSO
      }
    );
    expect(res400b.statusCode).toBe(400);
    expect(res400b.jsonBody.codice).toBe('richiesta-non-valida');
  });
});

describe('interruttore config', () => {
  it('documento mancante → spento, niente Gemini né contatori', async () => {
    const gemini = vi.fn();
    const { res, db } = await chiama(fakeDb({}), {}, { chiamaGemini: gemini });
    const done = res.ultimoDone();
    expect(done.codice).toBe('spento');
    expect(done.testo).toBe('Tony è nei campi. Intanto prova GFV!');
    expect(gemini).not.toHaveBeenCalled();
    const quotaKeys = [...db.docs.keys()].filter((k) => k.startsWith('tonyLandingQuota/'));
    expect(quotaKeys).toHaveLength(0);
  });

  it('enabled false e lettura fallita → spento', async () => {
    const gemini = vi.fn();
    const r1 = await chiama(fakeDb(configDoc({ enabled: false })), {}, { chiamaGemini: gemini });
    expect(r1.res.ultimoDone().codice).toBe('spento');
    expect(gemini).not.toHaveBeenCalled();

    const r2 = await chiama(
      fakeDb(configDoc()),
      {},
      {
        chiamaGemini: gemini,
        leggiConfig: async () => {
          throw new Error('firestore down');
        }
      }
    );
    expect(r2.res.ultimoDone().codice).toBe('spento');
    expect(gemini).not.toHaveBeenCalled();
  });

  it('cache 60 secondi: valore vecchio entro CACHE_CONFIG_MS', async () => {
    const db = fakeDb(configDoc({ enabled: true }));
    let tick = ADESSO_FISSO.getTime();
    const adesso = () => new Date(tick);
    const gemini = geminiOk();

    const res1 = fakeRes();
    await handleTonyLandingAsk(fakeReq(), res1, {
      db,
      verificaAppCheck: async () => ({}),
      chiamaGemini: gemini,
      adesso
    });
    expect(res1.ultimoDone().codice).toBe('ok');

    db.docs.set('config/tonyLanding', {
      enabled: false,
      voiceEnabled: false,
      dailyQuestionCap: 1000,
      dailyVoiceCharCap: 60000,
      monthlyBudgetEur: 30
    });
    tick += 1000;
    const res2 = fakeRes();
    await handleTonyLandingAsk(fakeReq({
      body: { domanda: 'Ancora GFV?', sessione: SESSIONE + '2' }
    }), res2, {
      db,
      verificaAppCheck: async () => ({}),
      chiamaGemini: gemini,
      adesso
    });
    expect(res2.ultimoDone().codice).toBe('ok');

    tick += COSTANTI.CACHE_CONFIG_MS + 1;
    const res3 = fakeRes();
    await handleTonyLandingAsk(fakeReq({
      body: { domanda: 'Dopo cache?', sessione: SESSIONE + '3' }
    }), res3, {
      db,
      verificaAppCheck: async () => ({}),
      chiamaGemini: gemini,
      adesso
    });
    expect(res3.ultimoDone().codice).toBe('spento');
  });
});

describe('domanda riuscita e limiti', () => {
  it('chunk + done ok, contatori e expireAt', async () => {
    const db = fakeDb(configDoc());
    const { res } = await chiama(db);
    const events = res.eventiSse();
    expect(events.some((e) => e.evento === 'chunk')).toBe(true);
    const done = res.ultimoDone();
    expect(done.codice).toBe('ok');
    expect(done.testo).toContain('GFV');
    expect(done.domandeRimaste).toBe(14);
    expect(done.mostraRegistrazione).toBe(false);
    expect(done.voce).toBe(true);

    const g = db.docs.get('tonyLandingQuota/g_' + giorno);
    const vKeys = [...db.docs.keys()].filter((k) => k.startsWith('tonyLandingQuota/v_'));
    const sKeys = [...db.docs.keys()].filter((k) => k.startsWith('tonyLandingQuota/s_'));
    const m = db.docs.get('tonyLandingQuota/m_' + mese);
    const sale = db.docs.get('tonyLandingQuota/sale_' + giorno);
    expect(g.domande).toBe(1);
    expect(g.costoEur).toBeGreaterThan(0);
    expect(m.domande).toBe(1);
    expect(m.costoEur).toBeGreaterThan(0);
    expect(vKeys).toHaveLength(1);
    expect(sKeys).toHaveLength(1);
    expect(sale.sale).toMatch(/^[a-f0-9]{64}$/);

    for (const [path, data] of db.docs) {
      if (!path.startsWith('tonyLandingQuota/')) continue;
      expect(data.expireAt).toBeTruthy();
      const t = data.expireAt.toDate ? data.expireAt.toDate() : data.expireAt;
      if (path.startsWith('tonyLandingQuota/m_')) {
        expect(t.getTime()).toBe(scad.mese.getTime());
      } else {
        expect(t.getTime()).toBe(scad.contatori.getTime());
      }
    }
  });

  it('16ª domanda stessa sessione → limite-sessione; Gemini 15 volte', async () => {
    const db = fakeDb(configDoc());
    const gemini = vi.fn(geminiOk());
    for (let i = 0; i < 16; i++) {
      const res = fakeRes();
      await handleTonyLandingAsk(fakeReq(), res, {
        db,
        verificaAppCheck: async () => ({}),
        chiamaGemini: gemini,
        adesso: ADESSO_FISSO
      });
      if (i < 15) expect(res.ultimoDone().codice).toBe('ok');
      else expect(res.ultimoDone().codice).toBe('limite-sessione');
    }
    expect(gemini).toHaveBeenCalledTimes(15);
  });

  it('31ª stesso visitatore → limite-giorno; altro IP consentito', async () => {
    const db = fakeDb(configDoc());
    const gemini = vi.fn(geminiOk());
    for (let i = 0; i < 31; i++) {
      const res = fakeRes();
      await handleTonyLandingAsk(
        fakeReq({
          body: { domanda: 'Q' + i, sessione: 'sessione-visitatore-' + String(i).padStart(2, '0') }
        }),
        res,
        {
          db,
          verificaAppCheck: async () => ({}),
          chiamaGemini: gemini,
          adesso: ADESSO_FISSO
        }
      );
      if (i < 30) expect(res.ultimoDone().codice).toBe('ok');
      else expect(res.ultimoDone().codice).toBe('limite-giorno');
    }
    const resAltro = fakeRes();
    await handleTonyLandingAsk(
      fakeReq({
        headers: {
          origin: ORIGINE,
          'x-firebase-appcheck': 'token-ok',
          'user-agent': 'VitestUA/1.0',
          'x-forwarded-for': '198.51.100.20'
        },
        body: { domanda: 'Altro IP', sessione: 'sessione-altro-ip-0001' },
        ip: '198.51.100.20'
      }),
      resAltro,
      {
        db,
        verificaAppCheck: async () => ({}),
        chiamaGemini: gemini,
        adesso: ADESSO_FISSO
      }
    );
    expect(resAltro.ultimoDone().codice).toBe('ok');
  });

  it('limite globale dailyQuestionCap 2', async () => {
    const db = fakeDb(configDoc({ dailyQuestionCap: 2 }));
    const gemini = vi.fn(geminiOk());
    for (let i = 0; i < 3; i++) {
      const res = fakeRes();
      await handleTonyLandingAsk(
        fakeReq({
          headers: {
            origin: ORIGINE,
            'x-firebase-appcheck': 't',
            'user-agent': 'UA-' + i,
            'x-forwarded-for': '203.0.113.' + (10 + i)
          },
          body: { domanda: 'G' + i, sessione: 'sessione-globale-' + String(i).padStart(4, '0') },
          ip: '203.0.113.' + (10 + i)
        }),
        res,
        {
          db,
          verificaAppCheck: async () => ({}),
          chiamaGemini: gemini,
          adesso: ADESSO_FISSO
        }
      );
      if (i < 2) expect(res.ultimoDone().codice).toBe('ok');
      else expect(res.ultimoDone().codice).toBe('limite-globale');
    }
  });
});

describe('tetto e voce', () => {
  it('costoEur 30 → tetto; 24 voce false; 10 voce true; budget 100 resta 30', async () => {
    const dbTetto = fakeDb(configDoc());
    dbTetto.docs.set('tonyLandingQuota/m_' + mese, {
      costoEur: 30,
      domande: 5,
      expireAt: Timestamp.fromDate(scad.mese)
    });
    const gemini = vi.fn(geminiOk());
    const r1 = await chiama(dbTetto, {}, { chiamaGemini: gemini });
    expect(r1.res.ultimoDone().codice).toBe('tetto');
    expect(gemini).not.toHaveBeenCalled();

    svuotaCacheTonyLandingAsk();
    const db24 = fakeDb(configDoc());
    db24.docs.set('tonyLandingQuota/m_' + mese, {
      costoEur: 24,
      domande: 1,
      expireAt: Timestamp.fromDate(scad.mese)
    });
    const r2 = await chiama(db24);
    expect(r2.res.ultimoDone().codice).toBe('ok');
    expect(r2.res.ultimoDone().voce).toBe(false);

    svuotaCacheTonyLandingAsk();
    const db10 = fakeDb(configDoc());
    db10.docs.set('tonyLandingQuota/m_' + mese, {
      costoEur: 10,
      domande: 1,
      expireAt: Timestamp.fromDate(scad.mese)
    });
    const r3 = await chiama(db10);
    expect(r3.res.ultimoDone().voce).toBe(true);

    svuotaCacheTonyLandingAsk();
    const db100 = fakeDb(configDoc({ monthlyBudgetEur: 100 }));
    db100.docs.set('tonyLandingQuota/m_' + mese, {
      costoEur: 30,
      domande: 1,
      expireAt: Timestamp.fromDate(scad.mese)
    });
    const gemini2 = vi.fn(geminiOk());
    const r4 = await chiama(db100, {}, { chiamaGemini: gemini2 });
    expect(r4.res.ultimoDone().codice).toBe('tetto');
    expect(gemini2).not.toHaveBeenCalled();
  });
});

describe('dati personali e Gemini fallito', () => {
  it('email → dati-personali senza contatori né Gemini', async () => {
    const db = fakeDb(configDoc());
    const gemini = vi.fn();
    const { res } = await chiama(
      db,
      { body: { domanda: 'scrivi a mario.rossi@esempio.it', sessione: SESSIONE } },
      { chiamaGemini: gemini }
    );
    expect(res.ultimoDone().codice).toBe('dati-personali');
    expect(gemini).not.toHaveBeenCalled();
    expect([...db.docs.keys()].filter((k) => k.startsWith('tonyLandingQuota/'))).toHaveLength(0);
  });

  it('Gemini fallisce → errore gentile, domanda contata, solo costo fisso', async () => {
    const db = fakeDb(configDoc());
    const { res } = await chiama(db, {}, {
      chiamaGemini: async () => ({ ok: false, motivo: 'timeout', testo: '', tokenIngresso: 0, tokenUscita: 0 })
    });
    expect(res.ultimoDone().codice).toBe('errore');
    expect(res.ultimoDone().testo).toMatch(/non riesco/i);
    const g = db.docs.get('tonyLandingQuota/g_' + giorno);
    const m = db.docs.get('tonyLandingQuota/m_' + mese);
    expect(g.domande).toBe(1);
    expect(g.errori).toBe(1);
    expect(m.costoEur).toBeCloseTo(COSTANTI.COSTO_FISSO_RICHIESTA_EUR, 6);
  });
});

describe('privacy log e raccolte', () => {
  it('nessun dato sensibile nei documenti né nei log; solo config e tonyLandingQuota', async () => {
    const spie = ['info', 'warn', 'error', 'log'].map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {})
    );
    const db = fakeDb(configDoc());
    const domanda = 'Domanda-segreta-XYZ';
    const risposta = 'Risposta-segreta-ABC';
    await chiama(
      db,
      {
        body: { domanda, sessione: SESSIONE },
        headers: {
          origin: ORIGINE,
          'x-firebase-appcheck': 'token-segreto-appcheck',
          'user-agent': 'UA-SEGRETO-99',
          'x-forwarded-for': '203.0.113.77'
        },
        ip: '203.0.113.77'
      },
      { chiamaGemini: geminiOk(risposta) }
    );

    const blobDocs = JSON.stringify([...db.docs.entries()]);
    expect(blobDocs).not.toContain('203.0.113.77');
    expect(blobDocs).not.toContain('UA-SEGRETO-99');
    expect(blobDocs).not.toContain(SESSIONE);
    expect(blobDocs).not.toContain(domanda);
    expect(blobDocs).not.toContain(risposta);

    const blobLog = spie.map((s) => s.mock.calls.map((c) => c.join(' ')).join('\n')).join('\n');
    expect(blobLog).not.toContain(domanda);
    expect(blobLog).not.toContain(risposta);
    expect(blobLog).not.toContain('203.0.113.77');
    expect(blobLog).not.toContain('UA-SEGRETO-99');
    expect(blobLog).not.toContain(SESSIONE);
    expect(blobLog).not.toContain('token-segreto-appcheck');
    expect(blobLog).not.toContain('AIza');

    for (const p of db.percorsiToccati) {
      expect(p.startsWith('tonyLandingQuota/') || p.startsWith('config/')).toBe(true);
    }
    spie.forEach((s) => s.mockRestore());
  });
});

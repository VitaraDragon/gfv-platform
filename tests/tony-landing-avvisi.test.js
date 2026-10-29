/**
 * @vitest-environment node
 * Avvisi di spesa e budget Google di Tony landing (passo 15).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const require = createRequire(import.meta.url);
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const {
  DESTINATARIO_AVVISI,
  SOGLIE_AVVISO,
  ARGOMENTO_BUDGET,
  SPENTO_DA,
  FREQUENZA_CONTROLLO,
  percentualeSpesa,
  sogliaDaAvvisare,
  decisioneBudgetGoogle,
  testoEmailSpesa,
  testoEmailBudget,
  normalizzaConfig,
} = require('../functions/lib/tony-landing-avvisi.js');
const {
  handleAvvisiSpesa,
  handleBudgetGoogle,
} = require('../functions/tony-landing-avvisi.js');
const { chiaviTempo, scadenze } = require('../functions/lib/tony-landing-limiti.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADESSO = new Date('2026-11-15T10:00:00.000Z');
const { mese } = chiaviTempo(ADESSO);

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
    (v.constructor?.name === 'ServerTimestampTransform' ||
      v.__serverTimestamp === true)
  );
}

function isDelete(v) {
  return (
    v &&
    typeof v === 'object' &&
    (v.constructor?.name === 'DeleteTransform' || v.__delete === true)
  );
}

function risolviMerge(prev, data) {
  const out = Object.assign({}, prev || {});
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (isDelete(v)) {
      delete out[k];
    } else if (isIncrement(v)) {
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
      },
    };
  }
  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          return makeDoc(name + '/' + id);
        },
      };
    },
    async runTransaction(fn) {
      const pending = [];
      const tx = {
        async get(ref) {
          if (!docs.has(ref.path)) {
            return { exists: false, data: () => undefined };
          }
          return {
            exists: true,
            data: () => structuredClone(docs.get(ref.path)),
          };
        },
        set(ref, data, opts) {
          pending.push({
            path: ref.path,
            data,
            merge: !!(opts && opts.merge),
          });
        },
      };
      await fn(tx);
      for (const p of pending) {
        if (p.merge) {
          docs.set(p.path, risolviMerge(docs.get(p.path), p.data));
        } else {
          docs.set(p.path, risolviMerge({}, p.data));
        }
      }
    },
  };
}

function configAccesa(extra) {
  return Object.assign(
    {
      enabled: true,
      voiceEnabled: true,
      monthlyBudgetEur: 30,
      dailyQuestionCap: 1000,
      dailyVoiceCharCap: 60000,
    },
    extra || {}
  );
}

describe('percentualeSpesa e sogliaDaAvvisare', () => {
  it('soglie e salti', () => {
    expect(percentualeSpesa({ spesaMeseEur: 0, budgetEur: 30 })).toBe(0);
    expect(sogliaDaAvvisare({ percentuale: 0, giaInviate: {} })).toBeNull();
    expect(sogliaDaAvvisare({ percentuale: 49.9, giaInviate: {} })).toBeNull();
    expect(sogliaDaAvvisare({ percentuale: 50, giaInviate: {} })).toEqual({
      soglia: 50,
      daSegnare: [50],
    });
    expect(
      sogliaDaAvvisare({
        percentuale: 79.9,
        giaInviate: { p50: true },
      })
    ).toBeNull();
    expect(sogliaDaAvvisare({ percentuale: 80, giaInviate: {} }).soglia).toBe(80);
    const salto = sogliaDaAvvisare({ percentuale: 85, giaInviate: {} });
    expect(salto.soglia).toBe(80);
    expect(salto.daSegnare).toEqual([50, 80]);
    expect(sogliaDaAvvisare({ percentuale: 100, giaInviate: {} }).soglia).toBe(
      100
    );
    expect(percentualeSpesa({ spesaMeseEur: 10, budgetEur: 0 })).toBeNull();
    expect(sogliaDaAvvisare({ percentuale: null, giaInviate: {} })).toBeNull();
  });
});

describe('handleAvvisiSpesa', () => {
  let emails;
  let inviaEmail;

  beforeEach(() => {
    emails = [];
    inviaEmail = vi.fn(async (args) => {
      emails.push(args);
    });
  });

  it('15 € → email 50%; seconda esecuzione niente; 24 € → 80% senza config; 30 € → spegne', async () => {
    const db = fakeDb({
      'config/tonyLanding': configAccesa(),
      ['tonyLandingQuota/m_' + mese]: { costoEur: 15, domande: 10 },
    });

    await handleAvvisiSpesa({ db, adesso: ADESSO, inviaEmail });
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe('info@globalfarmview.net');
    expect(emails[0].subject).toMatch(/50%/);
    const avvisi = db.docs.get('tonyLandingQuota/avvisi_' + mese);
    expect(avvisi.p50).toBeTruthy();
    const scad = scadenze(ADESSO);
    expect(avvisi.expireAt.toMillis()).toBe(Timestamp.fromDate(scad.mese).toMillis());

    emails.length = 0;
    await handleAvvisiSpesa({ db, adesso: ADESSO, inviaEmail });
    expect(emails).toHaveLength(0);

    db.docs.set('tonyLandingQuota/m_' + mese, { costoEur: 24, domande: 20 });
    const cfgPrima = structuredClone(db.docs.get('config/tonyLanding'));
    await handleAvvisiSpesa({ db, adesso: ADESSO, inviaEmail });
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toMatch(/80%/);
    expect(db.docs.get('config/tonyLanding')).toEqual(cfgPrima);

    emails.length = 0;
    db.docs.set('tonyLandingQuota/m_' + mese, { costoEur: 30, domande: 30 });
    await handleAvvisiSpesa({ db, adesso: ADESSO, inviaEmail });
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toMatch(/spento|tetto/i);
    const cfg = db.docs.get('config/tonyLanding');
    expect(cfg.enabled).toBe(false);
    expect(cfg.spentoDa).toBe(SPENTO_DA.tetto);
    expect(cfg.spentoMese).toBe(mese);
    expect(cfg.voiceEnabled).toBe(true);
    expect(cfg.monthlyBudgetEur).toBe(30);
    expect(cfg.dailyQuestionCap).toBe(1000);
    expect(cfg.dailyVoiceCharCap).toBe(60000);
    const norm = normalizzaConfig(cfg);
    expect(norm.enabled).toBe(false);
    expect(norm.spentoDa).toBeUndefined();
  });

  it('100% già spento: email con era già spento, config intatta; invio fallito toglie prenotazione', async () => {
    const db = fakeDb({
      'config/tonyLanding': configAccesa({ enabled: false }),
      ['tonyLandingQuota/m_' + mese]: { costoEur: 30, domande: 5 },
    });
    await handleAvvisiSpesa({ db, adesso: ADESSO, inviaEmail });
    expect(emails).toHaveLength(1);
    expect(emails[0].html).toMatch(/era già spento/);
    expect(db.docs.get('config/tonyLanding').enabled).toBe(false);
    expect(db.docs.get('config/tonyLanding').spentoDa).toBeUndefined();

    const db2 = fakeDb({
      'config/tonyLanding': configAccesa(),
      ['tonyLandingQuota/m_' + mese]: { costoEur: 30, domande: 1 },
    });
    const fallisce = vi.fn(async () => {
      throw new Error('Resend boom dettagliato');
    });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await handleAvvisiSpesa({ db: db2, adesso: ADESSO, inviaEmail: fallisce });
    expect(db2.docs.get('config/tonyLanding').enabled).toBe(false);
    expect(db2.docs.get('tonyLandingQuota/avvisi_' + mese).p100).toBeUndefined();
    const log = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(log).toMatch(/email=errore/);
    expect(log).not.toMatch(/Resend boom/);
    spy.mockRestore();
  });

  it('mese nuovo riparte dalle soglie', async () => {
    const altro = new Date('2026-12-02T10:00:00.000Z');
    const { mese: mese2 } = chiaviTempo(altro);
    const db = fakeDb({
      'config/tonyLanding': configAccesa(),
      ['tonyLandingQuota/m_' + mese]: { costoEur: 30, domande: 1 },
      ['tonyLandingQuota/avvisi_' + mese]: { p50: true, p80: true, p100: true },
      ['tonyLandingQuota/m_' + mese2]: { costoEur: 15, domande: 2 },
    });
    await handleAvvisiSpesa({ db, adesso: altro, inviaEmail });
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toMatch(/50%/);
    expect(db.docs.get('tonyLandingQuota/avvisi_' + mese2).p50).toBeTruthy();
  });
});

describe('decisioneBudgetGoogle e handleBudgetGoogle', () => {
  it('messaggi e spegnimento', async () => {
    expect(decisioneBudgetGoogle(null).motivo).toBe('messaggio-non-valido');
    expect(decisioneBudgetGoogle('x').motivo).toBe('messaggio-non-valido');
    expect(
      decisioneBudgetGoogle({ costAmount: -1, budgetAmount: 50 }).motivo
    ).toBe('messaggio-non-valido');
    expect(
      decisioneBudgetGoogle({ costAmount: 40, budgetAmount: 50 }).superato
    ).toBe(false);
    expect(
      decisioneBudgetGoogle({ costAmount: 50, budgetAmount: 50 }).superato
    ).toBe(true);

    const emails = [];
    const inviaEmail = async (a) => emails.push(a);
    const db = fakeDb({ 'config/tonyLanding': configAccesa() });
    await handleBudgetGoogle(
      {
        budgetDisplayName: 'altro-nome',
        costAmount: 52,
        budgetAmount: 50,
        currencyCode: 'EUR',
      },
      { db, adesso: ADESSO, inviaEmail }
    );
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe(DESTINATARIO_AVVISI);
    expect(db.docs.get('config/tonyLanding').enabled).toBe(false);
    expect(db.docs.get('config/tonyLanding').spentoDa).toBe(SPENTO_DA.budget);

    emails.length = 0;
    db.docs.set('config/tonyLanding', configAccesa());
    await handleBudgetGoogle(
      { costAmount: 55, budgetAmount: 50, currencyCode: 'EUR' },
      { db, adesso: ADESSO, inviaEmail }
    );
    expect(emails).toHaveLength(0);
    expect(db.docs.get('config/tonyLanding').enabled).toBe(false);
  });
});

describe('testi email e isolamento', () => {
  it('oggetti, importi IT, niente nomi/email/uid; escapeHtml', () => {
    const m50 = testoEmailSpesa({
      soglia: 50,
      spesaMeseEur: 15.1,
      budgetEur: 30,
      domandeMese: 3,
      mese: 'novembre 2026',
    });
    expect(m50.oggetto).toMatch(/50%/);
    expect(m50.html).toMatch(/15,10 €/);
    expect(m50.html + m50.testo).not.toMatch(/Pierpaolo|Pier\b|Rossi/);
    expect(m50.html).not.toMatch(/@/);
    const mBud = testoEmailBudget({
      costo: 52,
      budget: 50,
      valuta: 'EUR',
      mese: 'novembre 2026',
      eraGiaSpento: false,
    });
    expect(mBud.oggetto).toMatch(/Budget Google/);
    const evil = testoEmailBudget({
      costo: 1,
      budget: 1,
      valuta: '<script>alert(1)</script>',
      mese: 'x',
    });
    expect(evil.html).toContain('&lt;script&gt;');
    expect(evil.html).not.toContain('<script>alert');
  });

  it('file isolati e export statici', () => {
    const lib = fs.readFileSync(
      path.join(ROOT, 'functions/lib/tony-landing-avvisi.js'),
      'utf8'
    );
    const fn = fs.readFileSync(
      path.join(ROOT, 'functions/tony-landing-avvisi.js'),
      'utf8'
    );
    for (const t of [lib, fn]) {
      expect(t).not.toMatch(/\btenants\b/);
      expect(t).not.toMatch(/\busers\b/);
      expect(t).not.toMatch(/tonyLandingSetup(?!Quota)/);
      expect(t).not.toMatch(/functionDeclarations/);
      expect(t).not.toMatch(/\bGEMINI\b/);
      expect(t).not.toMatch(/\bELEVENLABS\b/);
    }
    expect(fn).toMatch(/RESEND_API_KEY/);
    expect(fn).toMatch(/tonyLandingQuota/);
    expect(fn).toMatch(/collection\("config"\)/);

    const index = fs.readFileSync(path.join(ROOT, 'functions/index.js'), 'utf8');
    expect(index).toMatch(/tonyLandingAvvisiSpesa/);
    expect(index).toMatch(/tonyLandingBudget/);
    expect(fn).toMatch(/onSchedule/);
    expect(fn).toMatch(/europe-west1/);
    expect(fn).toMatch(/Europe\/Rome/);
    expect(fn).toMatch(/schedule:\s*FREQUENZA_CONTROLLO/);
    expect(lib).toMatch(/every 15 minutes/);
    expect(fn).toMatch(/onMessagePublished/);
    expect(fn).toMatch(/topic:\s*ARGOMENTO_BUDGET/);
    expect(lib).toMatch(/tony-landing-budget/);
    expect(FREQUENZA_CONTROLLO).toBe('every 15 minutes');
    expect(ARGOMENTO_BUDGET).toBe('tony-landing-budget');
    expect(SOGLIE_AVVISO).toEqual([50, 80, 100]);

    const resend = fs.readFileSync(
      path.join(ROOT, 'functions/email-resend.js'),
      'utf8'
    );
    expect(resend).toMatch(/sendWithResend,/);

    const anteprima = fs.readFileSync(
      path.join(ROOT, 'functions/scripts/anteprima-avvisi-tony-landing.cjs'),
      'utf8'
    );
    expect(anteprima).not.toMatch(/firebase-admin/);
    expect(anteprima).not.toMatch(/defineSecret/);
    expect(anteprima).not.toMatch(/\bfetch\b/);
    expect(anteprima).not.toMatch(/sendWithResend/);

    const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
    expect(rules).toMatch(/tonyLandingQuota/);
    expect(rules).toMatch(/match \/config\/tonyLanding/);
  });
});

/**
 * Tony Guida in onboarding per il piano Free — 7 giorni dalla registrazione, 30 domande/giorno.
 * Verifica server (functions/tony-guida-onboarding.js) e mirror client (core/config/tony-guida-onboarding.js)
 * allineati: stesse costanti, stessa regola "campo presente e nel futuro".
 */
import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';
import * as clientMod from '../core/config/tony-guida-onboarding.js';

const require = createRequire(import.meta.url);
const serverMod = require('../functions/tony-guida-onboarding.js');

const NOW = new Date('2026-09-16T10:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function fsTimestampLike(date) {
  return { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0, toDate: () => date };
}

describe('tony-guida-onboarding — costanti allineate server/client', () => {
  it('7 giorni e 30 richieste/giorno su entrambi i lati', () => {
    expect(serverMod.TONY_GUIDA_ONBOARDING_DAYS).toBe(7);
    expect(serverMod.TONY_GUIDA_ONBOARDING_DAILY_LIMIT).toBe(30);
    expect(clientMod.TONY_GUIDA_ONBOARDING_DAYS).toBe(serverMod.TONY_GUIDA_ONBOARDING_DAYS);
    expect(clientMod.TONY_GUIDA_ONBOARDING_DAILY_LIMIT).toBe(serverMod.TONY_GUIDA_ONBOARDING_DAILY_LIMIT);
    expect(clientMod.TONY_GUIDA_ONBOARDING_FIELD).toBe(serverMod.TONY_GUIDA_ONBOARDING_FIELD);
    expect(serverMod.TONY_GUIDA_ONBOARDING_FIELD).toBe('tonyGuidaOnboardingEndsAt');
  });

  it('computeTonyGuidaOnboardingEndsAt = now + 7 giorni', () => {
    const expected = new Date(NOW.getTime() + 7 * DAY_MS).getTime();
    expect(serverMod.computeTonyGuidaOnboardingEndsAt(NOW).getTime()).toBe(expected);
    expect(clientMod.computeTonyGuidaOnboardingEndsAt(NOW).getTime()).toBe(expected);
  });
});

describe('tony-guida-onboarding — resolveTonyGuidaOnboarding', () => {
  for (const [label, mod] of [['server', serverMod], ['client', clientMod]]) {
    describe(label, () => {
      it('tenant senza campo (creato prima della feature) → non attivo, non scaduto', () => {
        const r = mod.resolveTonyGuidaOnboarding({ piano: 'free', creatoIl: NOW }, NOW);
        expect(r).toEqual({ active: false, endsAt: null, daysLeft: 0, expired: false });
      });

      it('tenant appena registrato → attivo con 7 giorni rimanenti', () => {
        const endsAt = new Date(NOW.getTime() + 7 * DAY_MS);
        const r = mod.resolveTonyGuidaOnboarding({ tonyGuidaOnboardingEndsAt: fsTimestampLike(endsAt) }, NOW);
        expect(r.active).toBe(true);
        expect(r.daysLeft).toBe(7);
        expect(r.expired).toBe(false);
        expect(r.endsAt.getTime()).toBe(endsAt.getTime());
      });

      it('ultimo giorno (poche ore) → attivo, daysLeft 1', () => {
        const endsAt = new Date(NOW.getTime() + 3 * 60 * 60 * 1000);
        const r = mod.resolveTonyGuidaOnboarding({ tonyGuidaOnboardingEndsAt: endsAt }, NOW);
        expect(r.active).toBe(true);
        expect(r.daysLeft).toBe(1);
      });

      it('scaduto → non attivo, expired true', () => {
        const endsAt = new Date(NOW.getTime() - 1000);
        const r = mod.resolveTonyGuidaOnboarding({ tonyGuidaOnboardingEndsAt: endsAt }, NOW);
        expect(r.active).toBe(false);
        expect(r.expired).toBe(true);
        expect(r.daysLeft).toBe(0);
      });

      it('accetta Timestamp serializzato {seconds} e millisecondi numerici', () => {
        const endsAt = new Date(NOW.getTime() + 2 * DAY_MS);
        expect(mod.resolveTonyGuidaOnboarding({ tonyGuidaOnboardingEndsAt: { seconds: endsAt.getTime() / 1000 } }, NOW).active).toBe(true);
        expect(mod.resolveTonyGuidaOnboarding({ tonyGuidaOnboardingEndsAt: { _seconds: endsAt.getTime() / 1000 } }, NOW).active).toBe(true);
        expect(mod.resolveTonyGuidaOnboarding({ tonyGuidaOnboardingEndsAt: endsAt.getTime() }, NOW).active).toBe(true);
        expect(mod.resolveTonyGuidaOnboarding({ tonyGuidaOnboardingEndsAt: 'non-una-data' }, NOW).active).toBe(false);
      });

      it('isTonyGuidaOnboardingActive vale solo per piano free', () => {
        const td = { tonyGuidaOnboardingEndsAt: new Date(NOW.getTime() + DAY_MS) };
        expect(mod.isTonyGuidaOnboardingActive('free', td, NOW)).toBe(true);
        expect(mod.isTonyGuidaOnboardingActive('base', td, NOW)).toBe(false);
        expect(mod.isTonyGuidaOnboardingActive('free', {}, NOW)).toBe(false);
      });
    });
  }
});

describe('tony-guida-onboarding — messaggi server', () => {
  it('rifiuto Free distingue mai avuto vs periodo terminato', () => {
    expect(serverMod.tonyFreeDeniedMessage({}, NOW)).toBe(serverMod.TONY_FREE_DENIED_MESSAGE);
    expect(serverMod.tonyFreeDeniedMessage({ tonyGuidaOnboardingEndsAt: new Date(NOW.getTime() - DAY_MS) }, NOW))
      .toBe(serverMod.TONY_ONBOARDING_EXPIRED_MESSAGE);
    expect(serverMod.TONY_ONBOARDING_EXPIRED_MESSAGE).toMatch(/7 giorni/);
    expect(serverMod.TONY_ONBOARDING_EXPIRED_MESSAGE).toMatch(/Abbonamento/);
    expect(serverMod.TONY_ONBOARDING_QUOTA_MESSAGE).toMatch(/30 domande/);
  });

  it('messaggi contengono i marker che il widget mostra senza riformulare', () => {
    // core/js/tony/main.js tonyFormatCallableError: /periodo di prova di Tony Guida|piano Free/i
    const marker = /periodo di prova di Tony Guida|piano Free/i;
    expect(serverMod.TONY_FREE_DENIED_MESSAGE).toMatch(marker);
    expect(serverMod.TONY_ONBOARDING_EXPIRED_MESSAGE).toMatch(marker);
    expect(serverMod.TONY_ONBOARDING_QUOTA_MESSAGE).toMatch(marker);
  });

  it('nota prompt solo se attivo, con giorni rimanenti e limite', () => {
    expect(serverMod.buildTonyGuidaOnboardingPromptNote({ active: false, daysLeft: 0 })).toBe('');
    const note = serverMod.buildTonyGuidaOnboardingPromptNote({ active: true, daysLeft: 3 });
    expect(note).toMatch(/mancano 3 giorni/);
    expect(note).toMatch(/30 domande al giorno/);
    expect(serverMod.buildTonyGuidaOnboardingPromptNote({ active: true, daysLeft: 1 })).toMatch(/mancano 1 giorno\./);
  });

  it('benvenuto client cita giorni rimanenti e limite', () => {
    const msg = clientMod.tonyGuidaOnboardingWelcomeMessage({ active: true, daysLeft: 5 });
    expect(msg).toMatch(/ancora per 5 giorni/);
    expect(msg).toMatch(/30 domande al giorno/);
    expect(clientMod.tonyGuidaOnboardingWelcomeMessage({ active: true, daysLeft: 1 })).toMatch(/ancora per oggi/);
  });

  it('chiave giorno in fuso Europe/Rome (mezzanotte italiana, non UTC)', () => {
    // 22:30 UTC del 16/09 = 00:30 del 17/09 a Roma (CEST)
    expect(serverMod.tonyGuidaOnboardingDayKey(new Date('2026-09-16T22:30:00Z'))).toBe('2026-09-17');
    expect(serverMod.tonyGuidaOnboardingDayKey(new Date('2026-09-16T10:00:00Z'))).toBe('2026-09-16');
  });
});

describe('tony-guida-onboarding — quota giornaliera (mock Firestore transazionale)', () => {
  function makeDb() {
    const store = new Map();
    const paths = [];
    const db = {
      collection(c1) {
        return {
          doc(id1) {
            return {
              collection(c2) {
                return {
                  doc(id2) {
                    const p = `${c1}/${id1}/${c2}/${id2}`;
                    paths.push(p);
                    return { __path: p };
                  },
                };
              },
            };
          },
        };
      },
      async runTransaction(fn) {
        const tx = {
          async get(ref) {
            const data = store.get(ref.__path);
            return { exists: !!data, data: () => data };
          },
          set(ref, data, opts) {
            const prev = (opts && opts.merge && store.get(ref.__path)) || {};
            store.set(ref.__path, Object.assign({}, prev, data));
          },
        };
        return fn(tx);
      },
    };
    return { db, store, paths };
  }

  it('consente fino a 30 richieste, la 31ª è rifiutata; il giorno dopo riparte', async () => {
    const { db, paths } = makeDb();
    const day = new Date('2026-09-16T10:00:00Z');
    let last = null;
    for (let i = 1; i <= 30; i++) {
      last = await serverMod.consumeTonyGuidaOnboardingQuota(db, 'tenant_a', day);
      expect(last.allowed).toBe(true);
      expect(last.count).toBe(i);
    }
    expect(last.remaining).toBe(0);
    const denied = await serverMod.consumeTonyGuidaOnboardingQuota(db, 'tenant_a', day);
    expect(denied.allowed).toBe(false);
    expect(denied.count).toBe(30);
    expect(paths[0]).toBe('tenants/tenant_a/tonyOnboardingQuota/2026-09-16');

    const nextDay = await serverMod.consumeTonyGuidaOnboardingQuota(db, 'tenant_a', new Date('2026-09-17T06:00:00Z'));
    expect(nextDay.allowed).toBe(true);
    expect(nextDay.count).toBe(1);
    expect(nextDay.dayKey).toBe('2026-09-17');
  });

  it('la quota è per tenant', async () => {
    const { db } = makeDb();
    const day = new Date('2026-09-16T10:00:00Z');
    for (let i = 0; i < 30; i++) await serverMod.consumeTonyGuidaOnboardingQuota(db, 'tenant_a', day);
    expect((await serverMod.consumeTonyGuidaOnboardingQuota(db, 'tenant_a', day)).allowed).toBe(false);
    expect((await serverMod.consumeTonyGuidaOnboardingQuota(db, 'tenant_b', day)).allowed).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  proactiveDayKey,
  proactiveFasciaForDate,
  buildProactiveFingerprintFromBriefing,
  computeProactiveDelta,
  formatProactiveDeltaMessage,
  decideProactiveBriefingAction,
  loadProactiveBriefingState,
  saveProactiveBriefingState,
  proactiveBriefingStorageKey,
  createEmptyProactiveBriefingState,
} from '../core/js/tony-proactive-briefing-policy.js';

function dateAt(isoLocal) {
  // isoLocal: '2026-07-20T09:30:00' interpreted as local
  return new Date(isoLocal);
}

describe('tony-proactive-briefing-policy — fasce', () => {
  it('mattina / pomeriggio / sera (incl. notte)', () => {
    expect(proactiveFasciaForDate(dateAt('2026-07-20T05:00:00'))).toBe('mattina');
    expect(proactiveFasciaForDate(dateAt('2026-07-20T11:59:00'))).toBe('mattina');
    expect(proactiveFasciaForDate(dateAt('2026-07-20T12:00:00'))).toBe('pomeriggio');
    expect(proactiveFasciaForDate(dateAt('2026-07-20T17:59:00'))).toBe('pomeriggio');
    expect(proactiveFasciaForDate(dateAt('2026-07-20T18:00:00'))).toBe('sera');
    expect(proactiveFasciaForDate(dateAt('2026-07-20T23:30:00'))).toBe('sera');
    expect(proactiveFasciaForDate(dateAt('2026-07-20T02:00:00'))).toBe('sera');
  });

  it('dayKey YYYY-MM-DD locale', () => {
    expect(proactiveDayKey(dateAt('2026-07-20T09:00:00'))).toBe('2026-07-20');
  });
});

describe('tony-proactive-briefing-policy — fingerprint e delta', () => {
  it('buildProactiveFingerprintFromBriefing', () => {
    const fp = buildProactiveFingerprintFromBriefing({
      sottoScorta: 2,
      scadenzeUrgenti: 1,
      guastiAperti: 0,
      meteoConsigliCount: 3,
      oreDaValidare: 4,
      prodottiDaCompletare: 1,
    });
    expect(fp.sottoScorta).toBe(2);
    expect(fp.scadenzeUrgenti).toBe(1);
    expect(fp.guastiAperti).toBe(0);
    expect(fp.meteoConsigli).toBe(3);
    expect(fp.oreDaValidare).toBe(4);
    expect(fp.prodottiDaCompletare).toBe(1);
  });

  it('computeProactiveDelta — solo peggioramenti (incl. nuovi segnali catalogo)', () => {
    const delta = computeProactiveDelta(
      {
        sottoScorta: 1,
        scadenzeUrgenti: 2,
        guastiAperti: 1,
        meteoConsigli: 0,
        oreDaValidare: 0,
        prodottiDaCompletare: 0,
      },
      {
        sottoScorta: 3,
        scadenzeUrgenti: 1,
        guastiAperti: 1,
        meteoConsigli: 2,
        oreDaValidare: 5,
        prodottiDaCompletare: 2,
      }
    );
    expect(delta).toEqual([
      { id: 'oreDaValidare', from: 0, to: 5 },
      { id: 'prodottiDaCompletare', from: 0, to: 2 },
      { id: 'sottoScorta', from: 1, to: 3 },
      { id: 'meteoConsigli', from: 0, to: 2 },
    ]);
  });

  it('formatProactiveDeltaMessage', () => {
    const msg = formatProactiveDeltaMessage([
      { id: 'guastiAperti', from: 0, to: 2 },
      { id: 'sottoScorta', from: 1, to: 3 },
    ]);
    expect(msg).toContain('cambiata');
    expect(msg).toContain('guasti aperti');
    expect(msg).toContain('sotto scorta');
  });
});

describe('tony-proactive-briefing-policy — decide', () => {
  const morning = dateAt('2026-07-20T09:00:00');
  const afternoon = dateAt('2026-07-20T14:00:00');
  const fpOps = {
    sottoScorta: 2,
    scadenzeUrgenti: 0,
    guastiAperti: 1,
    meteoConsigli: 0,
    oreDaValidare: 0,
    prodottiDaCompletare: 0,
  };
  const fpIdle = {
    sottoScorta: 0,
    scadenzeUrgenti: 0,
    guastiAperti: 0,
    meteoConsigli: 0,
    oreDaValidare: 0,
    prodottiDaCompletare: 0,
  };

  it('prima apertura fascia → full', () => {
    const d = decideProactiveBriefingAction(null, morning, fpOps);
    expect(d.action).toBe('full');
    expect(d.fascia).toBe('mattina');
    expect(d.nextState.fasciaFull.mattina).toBe(true);
    expect(d.nextState.fingerprint.sottoScorta).toBe(2);
    expect(d.nextState.fingerprint.guastiAperti).toBe(1);
  });

  it('ritorno stessa fascia senza cambio → silence', () => {
    const first = decideProactiveBriefingAction(null, morning, fpOps);
    const second = decideProactiveBriefingAction(first.nextState, morning, fpOps);
    expect(second.action).toBe('silence');
  });

  it('stessa fascia con peggioramento → delta', () => {
    const first = decideProactiveBriefingAction(null, morning, fpOps);
    const worse = { ...fpOps, sottoScorta: 5 };
    const second = decideProactiveBriefingAction(first.nextState, morning, worse);
    expect(second.action).toBe('delta');
    expect(second.worsened).toEqual([{ id: 'sottoScorta', from: 2, to: 5 }]);
    expect(second.nextState.fingerprint.sottoScorta).toBe(5);
  });

  it('nuova fascia → nuovo full anche se fingerprint uguale', () => {
    const first = decideProactiveBriefingAction(null, morning, fpOps);
    const second = decideProactiveBriefingAction(first.nextState, afternoon, fpOps);
    expect(second.action).toBe('full');
    expect(second.fascia).toBe('pomeriggio');
    expect(second.nextState.fasciaFull.mattina).toBe(true);
    expect(second.nextState.fasciaFull.pomeriggio).toBe(true);
  });

  it('idle full al massimo 1×/fascia, poi silence', () => {
    const first = decideProactiveBriefingAction(null, morning, fpIdle);
    expect(first.action).toBe('full');
    expect(first.allowIdleFull).toBe(true);
    const second = decideProactiveBriefingAction(first.nextState, morning, fpIdle);
    expect(second.action).toBe('silence');
  });

  it('miglioramento conteggi (meno criticità) → silence, non delta', () => {
    const first = decideProactiveBriefingAction(null, morning, fpOps);
    const better = { ...fpOps, sottoScorta: 0, guastiAperti: 0 };
    const second = decideProactiveBriefingAction(first.nextState, morning, better);
    expect(second.action).toBe('silence');
  });

  it('cambio giorno resetta fasciaFull', () => {
    const first = decideProactiveBriefingAction(null, morning, fpOps);
    const nextMorning = dateAt('2026-07-21T09:00:00');
    const second = decideProactiveBriefingAction(first.nextState, nextMorning, fpOps);
    expect(second.action).toBe('full');
    expect(second.dayKey).toBe('2026-07-21');
    expect(second.nextState.fasciaFull.mattina).toBe(true);
    expect(second.nextState.fasciaFull.pomeriggio).toBe(false);
  });
});

describe('tony-proactive-briefing-policy — storage', () => {
  it('save/load roundtrip tenant-aware', () => {
    const mem = {};
    const storage = {
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
      },
      setItem(k, v) {
        mem[k] = String(v);
      },
    };
    const now = dateAt('2026-07-20T09:00:00');
    const state = createEmptyProactiveBriefingState(proactiveDayKey(now));
    state.fasciaFull.mattina = true;
    state.fingerprint = {
      sottoScorta: 1,
      scadenzeUrgenti: 0,
      guastiAperti: 0,
      meteoConsigli: 0,
      oreDaValidare: 0,
      prodottiDaCompletare: 0,
    };
    expect(saveProactiveBriefingState(storage, 'tenant-a', state)).toBe(true);
    expect(mem[proactiveBriefingStorageKey('tenant-a')]).toBeTruthy();
    const loaded = loadProactiveBriefingState(storage, 'tenant-a', now);
    expect(loaded.fasciaFull.mattina).toBe(true);
    expect(loaded.fingerprint.sottoScorta).toBe(1);
    const other = loadProactiveBriefingState(storage, 'tenant-b', now);
    expect(other.fasciaFull.mattina).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  TONY_PROACTIVE_SIGNALS,
  listApplicableProactiveSignals,
  buildRawProactiveCounts,
  collectProactiveSignals,
  formatProactiveOpsAttentionSnippet,
  getProactiveSignalIds,
  getProactiveSignalIdsForHub,
  pickProactiveOpenFollowUp,
  tonyWantsProactiveOpenPage,
  isProactiveOpenOfferFresh,
  PROACTIVE_OPEN_OFFER_TTL_MS,
  countVendemmieIncomplete,
  countPreventiviAperti,
  countRaccolteIncomplete,
  proactiveHubStorageKey,
} from '../core/config/tony-proactive-signals.js';
import { decideProactiveBriefingAction } from '../core/js/tony-proactive-briefing-policy.js';

describe('tony-proactive-signals catalog', () => {
  it('v1 include ore, lavori, preventivi, prodotti, scorte, guasti, scadenze, vendemmia, raccolte, meteo', () => {
    const ids = getProactiveSignalIds();
    expect(ids).toContain('oreDaValidare');
    expect(ids).toContain('lavoriInCorso');
    expect(ids).toContain('preventiviAperti');
    expect(ids).toContain('prodottiDaCompletare');
    expect(ids).toContain('vendemmieIncomplete');
    expect(ids).toContain('raccolteIncomplete');
    expect(ids).toContain('meteoConsigli');
    expect(TONY_PROACTIVE_SIGNALS.length).toBeGreaterThanOrEqual(10);
  });

  it('hub manodopera non include meteo né scorte', () => {
    const ids = getProactiveSignalIdsForHub('manodopera');
    expect(ids).toContain('oreDaValidare');
    expect(ids).toContain('lavoriInCorso');
    expect(ids).not.toContain('meteoConsigli');
    expect(ids).not.toContain('sottoScorta');
  });

  it('hub contoTerzi / parcoMacchine / frutteto', () => {
    expect(getProactiveSignalIdsForHub('contoTerzi')).toEqual(
      expect.arrayContaining(['preventiviAperti', 'lavoriInCorso', 'lavoriDaPianificare'])
    );
    expect(getProactiveSignalIdsForHub('parcoMacchine')).toEqual(
      expect.arrayContaining(['guastiAperti', 'scadenzeUrgenti'])
    );
    expect(getProactiveSignalIdsForHub('frutteto')).toContain('raccolteIncomplete');
  });

  it('gate moduli: senza manodopera niente ore', () => {
    const list = listApplicableProactiveSignals({
      availableModules: ['magazzino', 'tony'],
      roles: ['manager'],
      hubId: 'magazzino',
    });
    const ids = list.map((s) => s.id);
    expect(ids).not.toContain('oreDaValidare');
    expect(ids).toContain('sottoScorta');
    expect(ids).toContain('prodottiDaCompletare');
  });

  it('gate ruoli: operaio non vede segnali manager', () => {
    const list = listApplicableProactiveSignals({
      availableModules: ['manodopera', 'magazzino', 'parcoMacchine', 'meteo'],
      roles: ['operaio'],
      hubId: 'dashboard',
    });
    expect(list.length).toBe(0);
  });

  it('collectProactiveSignals dashboard — priorità ore prima di scorte', () => {
    const collected = collectProactiveSignals(
      {
        availableModules: ['manodopera', 'magazzino', 'parcoMacchine', 'meteo'],
        roles: ['manager'],
        hubId: 'dashboard',
      },
      buildRawProactiveCounts({
        oreDaValidare: 3,
        prodottiDaCompletare: 1,
        sottoScorta: 2,
        guastiAperti: 0,
        scadenzeUrgenti: 1,
        meteoConsigliCount: 2,
        lavoriInCorso: 1,
      })
    );
    expect(collected.fingerprint.oreDaValidare).toBe(3);
    expect(collected.opsActive[0].id).toBe('oreDaValidare');
    expect(collected.opsActive.map((a) => a.id)).toEqual([
      'oreDaValidare',
      'lavoriInCorso',
      'prodottiDaCompletare',
      'sottoScorta',
      'scadenzeUrgenti',
    ]);
    expect(collected.meteoActive[0].id).toBe('meteoConsigli');
  });

  it('formatProactiveOpsAttentionSnippet con hubLabel', () => {
    const collected = collectProactiveSignals(
      { availableModules: ['manodopera'], roles: ['amministratore'], hubId: 'manodopera' },
      { oreDaValidare: 2 }
    );
    const follow = pickProactiveOpenFollowUp(collected.opsActive);
    const text = formatProactiveOpsAttentionSnippet(collected.opsActive, follow, {
      hubLabel: 'Manodopera',
    });
    expect(text).toContain('Qui in Manodopera');
    expect(text).toContain('2 lavori con ore da validare');
    expect(text).toContain('Validazione ore');
  });

  it('tonyWantsProactiveOpenPage — apri sì, sì nudo no', () => {
    expect(tonyWantsProactiveOpenPage('apri')).toBe(true);
    expect(tonyWantsProactiveOpenPage('sì')).toBe(false);
  });

  it('isProactiveOpenOfferFresh rispetta TTL', () => {
    expect(isProactiveOpenOfferFresh({ openPageTarget: 'prodotti', at: Date.now() })).toBe(true);
    expect(
      isProactiveOpenOfferFresh({
        openPageTarget: 'prodotti',
        at: Date.now() - PROACTIVE_OPEN_OFFER_TTL_MS - 1000,
      })
    ).toBe(false);
  });

  it('countVendemmieIncomplete', () => {
    expect(
      countVendemmieIncomplete([
        { quantitaQli: 10, quantitaEttari: 1, destinazione: 'cantina' },
        { quantitaQli: 0, quantitaEttari: 1, destinazione: 'cantina' },
        { quantitaQli: 5, quantitaEttari: 1 },
      ])
    ).toBe(2);
  });

  it('countPreventiviAperti e countRaccolteIncomplete', () => {
    expect(
      countPreventiviAperti([
        { stato: 'bozza' },
        { stato: 'inviato' },
        { stato: 'rifiutato' },
        { stato: 'accettato_manager' },
      ])
    ).toBe(3);
    expect(
      countRaccolteIncomplete([
        { quantitaKg: 100, quantitaEttari: 1, specie: 'Melo', varieta: 'Golden' },
        { quantitaKg: null, quantitaEttari: 1, specie: 'Melo', varieta: 'Golden' },
        { quantitaKg: 50, quantitaEttari: 1, specie: '', varieta: 'Golden' },
      ])
    ).toBe(2);
  });

  it('proactiveHubStorageKey tenant+hub', () => {
    expect(proactiveHubStorageKey('t1', 'manodopera')).toBe('tony.proactiveHub.v1:t1:manodopera');
  });

  it('hub decide: zero segnali → silence (no idle)', () => {
    const now = new Date('2026-07-20T09:00:00');
    const d = decideProactiveBriefingAction(
      null,
      now,
      { oreDaValidare: 0 },
      { signalIds: ['oreDaValidare'], allowIdle: false }
    );
    expect(d.action).toBe('silence');
  });
});

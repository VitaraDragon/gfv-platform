import { describe, it, expect } from 'vitest';
import { buildAbbonamentoSummaryTrialState } from '../core/utils/abbonamento-summary.js';
import { resolveEffectiveModules } from '../core/utils/module-access-resolver.js';

describe('A2 — riepilogo Abbonamento con prova', () => {
  it('prova Manodopera senza modules: mostra In prova e non Nessun modulo attivo', () => {
    const tenant = {
      modules: [],
      moduleTrials: {
        manodopera: {
          status: 'active',
          endsAt: new Date('2026-12-03T12:00:00Z'),
        },
      },
    };
    const effective = resolveEffectiveModules(tenant, new Date('2026-11-03T12:00:00Z'));
    const state = buildAbbonamentoSummaryTrialState({
      effectiveModules: effective,
      trialModuleIds: ['manodopera'],
      trialLabels: ['Manodopera fino al 3 dicembre 2026'],
    });
    expect(state.trialBlockText).toMatch(/In prova \(1\)/);
    expect(state.trialBlockText).toMatch(/Manodopera/);
    expect(state.showNessunModuloAttivo).toBe(false);
  });

  it('senza moduli effettivi: mostra Nessun modulo attivo', () => {
    const state = buildAbbonamentoSummaryTrialState({
      effectiveModules: [],
      trialModuleIds: [],
    });
    expect(state.showNessunModuloAttivo).toBe(true);
    expect(state.trialBlockText).toBeNull();
  });
});

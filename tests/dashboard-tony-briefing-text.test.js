import { describe, it, expect } from 'vitest';
import {
  buildSottoScortaBriefingFromProdotti,
  buildGuastiApertiBriefingFromGuasti,
  buildScadenzeUrgentiBriefingFromMacchine,
} from '../core/js/dashboard-tony-briefing-text.js';

describe('dashboard-tony-briefing-text', () => {
  it('buildSottoScortaBriefingFromProdotti — nomi prodotti', () => {
    var r = buildSottoScortaBriefingFromProdotti([
      { id: 'p1', nome: 'Urea', scortaMinima: 10, giacenza: 2, attivo: true },
      { id: 'p2', nome: 'Glifosate', scortaMinima: 5, giacenza: 0, attivo: true },
      { id: 'p3', nome: 'Ok', scortaMinima: 5, giacenza: 20, attivo: true },
    ]);
    expect(r.count).toBe(2);
    expect(r.summarySottoScorta).toContain('Urea');
    expect(r.summarySottoScorta).toContain('Glifosate');
  });

  it('buildGuastiApertiBriefingFromGuasti — macchina e generico', () => {
    var macchine = [{ id: 'm1', nome: 'Trattore T5' }];
    var r = buildGuastiApertiBriefingFromGuasti(
      [
        { macchinaId: 'm1', gravita: 'alta', stato: 'aperto' },
        { tipoGuasto: 'generico', tipoProblema: 'Frana', ubicazione: 'Vigna nord', stato: 'in attesa' },
      ],
      macchine
    );
    expect(r.count).toBe(2);
    expect(r.summaryGuasti).toContain('Trattore T5');
    expect(r.summaryGuasti).toContain('Frana');
  });
});

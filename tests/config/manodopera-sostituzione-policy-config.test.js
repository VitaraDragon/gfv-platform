/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  resolvePrioritaLavoro,
  isLavoroPrestabile,
  getPrioritaRank,
  computeShortlistScore,
  PRIORITA_DEFAULT
} from '../../core/config/manodopera-sostituzione-policy-config.js';

describe('manodopera-sostituzione-policy-config', () => {
  test('priorita default e override', () => {
    expect(resolvePrioritaLavoro({})).toBe(PRIORITA_DEFAULT);
    expect(resolvePrioritaLavoro({ prioritaOperativa: 'critico' })).toBe('critico');
    expect(getPrioritaRank('critico')).toBeGreaterThan(getPrioritaRank('scalabile'));
  });

  test('prestabile solo se priorita origine inferiore o flag', () => {
    expect(
      isLavoroPrestabile(
        { prioritaOperativa: 'normale' },
        { prioritaOperativa: 'critico' }
      )
    ).toBe(true);
    expect(
      isLavoroPrestabile(
        { prioritaOperativa: 'critico' },
        { prioritaOperativa: 'normale' }
      )
    ).toBe(false);
    expect(
      isLavoroPrestabile({ ritardabile: true, prioritaOperativa: 'critico' }, { prioritaOperativa: 'normale' })
    ).toBe(true);
  });

  test('score penalita origine sotto soglia', () => {
    const base = computeShortlistScore({
      stelleMinime: 3,
      disponibilita: 'spostabile',
      origineSottoSogliaDopoPrestito: false
    });
    const penalizzato = computeShortlistScore({
      stelleMinime: 3,
      disponibilita: 'spostabile',
      origineSottoSogliaDopoPrestito: true
    });
    expect(penalizzato).toBeLessThan(base);
  });
});

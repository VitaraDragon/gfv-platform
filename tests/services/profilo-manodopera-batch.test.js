/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  getDefaultSkillBatchPeriod,
  isOreDateInPeriod,
  buildTipoLavoroResolver,
  buildNomeToSottocategoriaCodiceMap,
  resolveLavoroOreContext,
  accumulateValidatedOreForSkills,
  buildSkillCalcolateRows,
  buildSkillCalcolateByOperaioFromAccumulator
} from '../../core/services/profilo-manodopera-batch.js';
import { SKILL_ID_TRATTAMENTI, SKILL_ID_GUIDA_TRATTORE } from '../../core/config/manodopera-skills-config.js';

describe('profilo-manodopera-batch', () => {
  test('periodo default 12 mesi', () => {
    const ref = new Date('2026-05-16T12:00:00Z');
    const { periodoDa, periodoA } = getDefaultSkillBatchPeriod(ref);
    expect(periodoA.getFullYear()).toBe(2026);
    expect(periodoDa.getFullYear()).toBe(2025);
    expect(periodoDa.getMonth()).toBe(4);
  });

  test('accumula ore nel periodo e totali', () => {
    const period = getDefaultSkillBatchPeriod(new Date('2026-06-01'));
    const acc = new Map();
    const ctx = {
      tipoLavoroNome: 'Trattamento Manuale',
      sottocategoriaCodice: 'trattamenti_manuale',
      categoriaCodice: null,
      attrezzo: null,
      macchinaId: null,
      operatoreMacchinaId: null
    };

    accumulateValidatedOreForSkills(
      acc,
      {
        operaioId: 'u1',
        oreNette: 40,
        oreDate: new Date('2026-03-01'),
        oreContext: ctx
      },
      period
    );
    accumulateValidatedOreForSkills(
      acc,
      {
        operaioId: 'u1',
        oreNette: 100,
        oreDate: new Date('2024-01-01'),
        oreContext: ctx
      },
      period
    );

    const byOperaio = buildSkillCalcolateByOperaioFromAccumulator(acc, {
      ...period,
      aggiornatoIl: '2026-06-01T00:00:00.000Z'
    });
    const rows = byOperaio.get('u1');
    const tratt = rows.find((r) => r.skillId === SKILL_ID_TRATTAMENTI);
    expect(tratt.orePeriodo).toBe(40);
    expect(tratt.oreTotali).toBe(140);
    expect(tratt.stelle).toBeGreaterThanOrEqual(2);
  });

  test('vendemmia trasporto → guida_trattore', () => {
    const period = getDefaultSkillBatchPeriod(new Date('2026-06-01'));
    const acc = new Map();
    const ctx = {
      tipoLavoroNome: 'Vendemmia Meccanica',
      sottocategoriaCodice: 'raccolta_meccanica',
      categoriaCodice: null,
      attrezzo: null,
      macchinaId: 'tr1',
      operatoreMacchinaId: 'u2'
    };

    accumulateValidatedOreForSkills(
      acc,
      {
        operaioId: 'u2',
        oreNette: 8,
        oreDate: new Date('2026-05-01'),
        oreContext: ctx,
        ruoloOre: 'trasporto'
      },
      period
    );

    const rows = buildSkillCalcolateRows(acc.get('u2'), {
      ...period,
      aggiornatoIl: '2026-06-01T00:00:00.000Z'
    });
    expect(rows.some((r) => r.skillId === SKILL_ID_GUIDA_TRATTORE)).toBe(true);
    expect(rows.some((r) => r.skillId === 'raccolta_meccanica')).toBe(false);
  });

  test('resolve lavoro da nome tipo predefinito', () => {
    const nomeToSotto = buildNomeToSottocategoriaCodiceMap([
      { nome: 'Potatura', sottocategoriaCodice: 'potatura_manuale' }
    ]);
    const resolver = buildTipoLavoroResolver([], new Map(), nomeToSotto);
    const ctx = resolveLavoroOreContext({ tipoLavoro: 'Potatura' }, resolver, new Map());
    expect(ctx.sottocategoriaCodice).toBe('potatura_manuale');
  });

  test('isOreDateInPeriod', () => {
    const { periodoDa, periodoA } = getDefaultSkillBatchPeriod(new Date('2026-05-16'));
    expect(isOreDateInPeriod(new Date('2026-01-01'), periodoDa, periodoA)).toBe(true);
    expect(isOreDateInPeriod(new Date('2020-01-01'), periodoDa, periodoA)).toBe(false);
  });
});

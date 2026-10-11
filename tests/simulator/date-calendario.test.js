import { describe, expect, it } from 'vitest';
import { generaGiorniLavorativi } from '../../simulator/generators/date-calendario.js';

describe('generaGiorniLavorativi', () => {
  it('di sabato include il sabato e i giorni subito prima', () => {
    const sabato = new Date(2026, 9, 10, 15, 0, 0);
    expect(generaGiorniLavorativi(3, sabato)).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
  });

  it('di domenica include sabato e domenica e non va nel futuro', () => {
    const domenica = new Date(2026, 9, 11, 8, 0, 0);
    expect(generaGiorniLavorativi(2, domenica)).toEqual([
      '2026-10-10',
      '2026-10-11',
    ]);
  });
});

/**
 * @vitest-environment node
 */

import { describe, expect, test } from 'vitest';
import { dateLikeToLocalCalendarIso } from '../core/js/date-format-it.js';
import {
  aggregaOreReport,
  isOraRifiutata,
  riepilogoMediaOrePerPersona
} from '../core/js/statistiche-ore-report.js';

describe('statistiche-ore-report', () => {
  test('riga rifiutata esclusa dal totale (e da validate/da_validare)', () => {
    const agg = aggregaOreReport([
      { operaioId: 'a', oreNette: 8, stato: 'validate', data: new Date(2026, 2, 10) },
      { operaioId: 'a', oreNette: 2.5, stato: 'rifiutate', data: new Date(2026, 2, 11) },
      { operaioId: 'a', oreNette: 3, stato: 'da_validare', data: new Date(2026, 2, 12) }
    ]);

    expect(isOraRifiutata('rifiutate')).toBe(true);
    expect(agg.oreTotali).toBe(11);
    expect(agg.oreValidateTotali).toBe(8);
    expect(agg.oreDaValidareTotali).toBe(3);
    expect(agg.orePerOperaio.a.oreTotali).toBe(11);
    expect(agg.orePerOperaio.a.giorniLavorati.size).toBe(2);
  });

  test('media per persona: somma ore ÷ somma giorni di ciascun operaio', () => {
    const riepilogo = riepilogoMediaOrePerPersona([
      { oreTotali: 40, giorniLavorati: 5 },
      { oreTotali: 20, giorniLavorati: 2 }
    ]);
    expect(riepilogo.oreTotali).toBe(60);
    expect(riepilogo.giorniLavoratiSum).toBe(7);
    expect(riepilogo.mediaOreGiorno).toBeCloseTo(60 / 7, 5);
  });

  test('giorno locale a cavallo della mezzanotte UTC (non toISOString)', () => {
    // Mezzanotte locale 29 set 2026: in fuso est di UTC toISOString è ancora il 28.
    const mezzanotteLocale = new Date(2026, 8, 29, 0, 30, 0);
    const agg = aggregaOreReport([
      {
        operaioId: 'b',
        oreNette: 4,
        stato: 'validate',
        data: mezzanotteLocale
      }
    ]);

    const giornoLocale = dateLikeToLocalCalendarIso(mezzanotteLocale);
    expect(giornoLocale).toBe('2026-09-29');
    expect([...agg.orePerOperaio.b.giorniLavorati]).toEqual(['2026-09-29']);

    if (mezzanotteLocale.getTimezoneOffset() < 0) {
      expect(mezzanotteLocale.toISOString().slice(0, 10)).toBe('2026-09-28');
      expect([...agg.orePerOperaio.b.giorniLavorati][0]).not.toBe(
        mezzanotteLocale.toISOString().slice(0, 10)
      );
    }
  });
});

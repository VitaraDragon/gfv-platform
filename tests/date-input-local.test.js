import { describe, expect, it } from 'vitest';
import { dateLikeToLocalCalendarIso } from '../core/js/date-format-it.js';

describe('dateLikeToLocalCalendarIso', () => {
  it('restituisce il giorno locale, non la data UTC di toISOString', () => {
    const d = new Date(2026, 8, 29, 0, 30, 0);
    expect(dateLikeToLocalCalendarIso(d)).toBe('2026-09-29');
    expect(dateLikeToLocalCalendarIso({ toDate: () => d })).toBe('2026-09-29');
    expect(dateLikeToLocalCalendarIso({ seconds: Math.floor(d.getTime() / 1000) })).toBe('2026-09-29');

    // A est di UTC (es. Europe/Rome) la mezzanotte locale è ancora il giorno prima in UTC.
    if (d.getTimezoneOffset() < 0) {
      expect(d.toISOString().slice(0, 10)).toBe('2026-09-28');
      expect(dateLikeToLocalCalendarIso(d)).not.toBe(d.toISOString().slice(0, 10));
    }
  });
});

import { describe, expect, it } from 'vitest';
import { formatIsoDateToItalianShort } from '../core/js/date-format-it.js';

describe('formatIsoDateToItalianShort', () => {
  it('converte YYYY-MM-DD in gg/mm/aaaa', () => {
    expect(formatIsoDateToItalianShort('2026-04-10')).toBe('10/04/2026');
    expect(formatIsoDateToItalianShort('2026-11-27')).toBe('27/11/2026');
  });

  it('accetta prefisso ISO con orario e ignora il resto', () => {
    expect(formatIsoDateToItalianShort('2026-01-05T12:00:00.000Z')).toBe('05/01/2026');
  });

  it('gestisce input vuoti o non ISO senza inventare date', () => {
    expect(formatIsoDateToItalianShort('')).toBe('');
    expect(formatIsoDateToItalianShort(null)).toBe('');
    expect(formatIsoDateToItalianShort('non-una-data')).toBe('non-una-data');
  });
});

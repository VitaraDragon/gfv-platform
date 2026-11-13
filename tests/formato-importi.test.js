/**
 * Euro e ettari in formato italiano: virgola decimale, punto delle migliaia.
 */
import { describe, it, expect } from 'vitest';
import { formatEuro, formatEttari } from '../shared/js/formato-importi.js';

describe('formatEuro', () => {
  it('simbolo davanti, due decimali, migliaia col punto', () => {
    expect(formatEuro(915)).toBe('€ 915,00');
    expect(formatEuro(1234.5)).toBe('€ 1.234,50');
    expect(formatEuro(0)).toBe('€ 0,00');
    expect(formatEuro(-0)).toBe('€ 0,00');
    expect(formatEuro('915')).toBe('€ 915,00');
  });

  it('null, NaN e non numerico restituiscono il trattino', () => {
    expect(formatEuro(null)).toBe('-');
    expect(formatEuro(undefined)).toBe('-');
    expect(formatEuro(Number.NaN)).toBe('-');
    expect(formatEuro('')).toBe('-');
    expect(formatEuro('abc')).toBe('-');
    expect(formatEuro(null, '—')).toBe('—');
  });
});

describe('formatEttari', () => {
  it('almeno due decimali, fino a quattro, migliaia col punto', () => {
    expect(formatEttari(5)).toBe('5,00');
    expect(formatEttari(0.4567)).toBe('0,4567');
    expect(formatEttari(1200)).toBe('1.200,00');
    expect(formatEttari(0)).toBe('0,00');
    expect(formatEttari(-0)).toBe('0,00');
    expect(formatEttari(1.23456)).toBe('1,2346');
  });

  it('null, NaN e non numerico restituiscono il trattino', () => {
    expect(formatEttari(null)).toBe('-');
    expect(formatEttari(undefined)).toBe('-');
    expect(formatEttari(Number.NaN)).toBe('-');
    expect(formatEttari('')).toBe('-');
    expect(formatEttari(null, '—')).toBe('—');
  });
});

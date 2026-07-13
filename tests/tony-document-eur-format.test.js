import { describe, it, expect } from 'vitest';
import {
  formatEurDisplay,
  formatEurForInput,
  parseEurInput,
} from '../core/js/tony/document-eur-format.js';

describe('document-eur-format', () => {
  it('formatEurDisplay usa it-IT EUR', () => {
    expect(formatEurDisplay(12.5)).toMatch(/12,50/);
    expect(formatEurDisplay(12.5)).toMatch(/€/);
    expect(formatEurDisplay(1234.56)).toMatch(/234,56/);
    expect(formatEurDisplay(1234.56)).toMatch(/€/);
    expect(formatEurDisplay(null)).toBe('—');
  });

  it('formatEurForInput senza simbolo', () => {
    expect(formatEurForInput(12.5)).toBe('12,50');
    expect(formatEurForInput(null)).toBe('');
  });

  it('parseEurInput accetta virgola, punto e simbolo €', () => {
    expect(parseEurInput('12,50')).toBe(12.5);
    expect(parseEurInput('12.50')).toBe(12.5);
    expect(parseEurInput('1.234,56 €')).toBe(1234.56);
    expect(parseEurInput('')).toBeNull();
    expect(parseEurInput('abc')).toBeNull();
  });

  it('round-trip input blur', () => {
    var n = parseEurInput('45,8');
    expect(formatEurForInput(n)).toBe('45,80');
  });
});

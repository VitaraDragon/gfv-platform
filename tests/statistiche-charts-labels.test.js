/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  truncateChartLabel,
  wrapChartAxisLabel
} from '../core/js/statistiche-charts.js';

describe('statistiche-charts — etichette mobile', () => {
  it('non taglia etichette corte', () => {
    expect(truncateChartLabel('Potatura', 18)).toBe('Potatura');
  });

  it('abbrevia etichette lunghe con ellissi (legacy)', () => {
    const long = 'Potatura verde estiva dettagliata';
    const out = truncateChartLabel(long, 16);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(16);
    expect(out.startsWith('Potatura')).toBe(true);
  });

  it('wrapChartAxisLabel spezza etichette lunghe senza troncare Karate-like', () => {
    expect(wrapChartAxisLabel('Karate', 18)).toBe('Karate');
    const long = 'Insetticida Karate Zeon concime fogliare';
    const wrapped = wrapChartAxisLabel(long, 18);
    expect(Array.isArray(wrapped)).toBe(true);
    expect(wrapped.join(' ')).toContain('Karate');
    expect(wrapped.join('')).not.toMatch(/…/);
  });
});

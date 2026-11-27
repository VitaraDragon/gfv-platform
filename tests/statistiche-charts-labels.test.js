/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { truncateChartLabel } from '../core/js/statistiche-charts.js';

describe('statistiche-charts — etichette mobile', () => {
  it('non taglia etichette corte', () => {
    expect(truncateChartLabel('Potatura', 18)).toBe('Potatura');
  });

  it('abbrevia etichette lunghe con ellissi', () => {
    const long = 'Potatura verde estiva dettagliata';
    const out = truncateChartLabel(long, 16);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(16);
    expect(out.startsWith('Potatura')).toBe(true);
  });
});

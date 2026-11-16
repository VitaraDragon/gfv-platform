/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  OrticolaRaccolta,
  RACCOLTA_DESTINAZIONI,
  resaQliHa,
  statoDopoRaccolta
} from '../modules/orticole/models/OrticolaRaccolta.js';

describe('Orticole raccolta', () => {
  it('destinazioni industria/mercato/stoccaggio/uso_aziendale', () => {
    expect(RACCOLTA_DESTINAZIONI).toEqual([
      'industria', 'mercato', 'stoccaggio', 'uso_aziendale'
    ]);
    expect(RACCOLTA_DESTINAZIONI).not.toContain('vendita');
  });

  it('resa q/ha e validate', () => {
    expect(resaQliHa(100, 2)).toBe(50);
    const row = new OrticolaRaccolta({
      campagnaId: 'c1',
      lavoroId: 'l1',
      data: '2026-08-01',
      quantitaQli: 80,
      quantitaEttari: 2,
      destinazione: 'industria'
    });
    expect(row.validate().valid).toBe(true);
    expect(row.resaQliHa).toBe(40);
    expect(statoDopoRaccolta('trapiantato')).toBe('raccolto');
  });
});

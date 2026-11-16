/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  OrticolaImpianto,
  statoDopoImpianto,
  statoDopoRimozioneImpianto
} from '../modules/orticole/models/OrticolaImpianto.js';

describe('Orticole impianto (semina/trapianto)', () => {
  it('trapianto: densità opzionale, stato → trapiantato', () => {
    const row = new OrticolaImpianto({
      campagnaId: 'c1',
      dataImpianto: '2026-04-10',
      tipoImpianto: 'trapianto',
      densitaPianteHa: 25000
    });
    expect(row.validate().valid).toBe(true);
    expect(statoDopoImpianto('pianificato', 'trapianto')).toBe('trapiantato');
    expect(statoDopoRimozioneImpianto('trapiantato')).toBe('pianificato');
  });

  it('semina: unità dose e stato → seminato', () => {
    const row = new OrticolaImpianto({
      campagnaId: 'c1',
      dataImpianto: '2026-03-01',
      tipoImpianto: 'semina',
      doseSeme: 80,
      unitaDose: 'kg/ha'
    });
    expect(row.validate().valid).toBe(true);
    expect(statoDopoImpianto('pianificato', 'semina')).toBe('seminato');
    expect(row.toFirestore().densitaPianteHa).toBeNull();
  });

  it('non altera stati già avanzati', () => {
    expect(statoDopoImpianto('in_ciclo', 'trapianto')).toBe('in_ciclo');
    expect(statoDopoImpianto('raccolto', 'semina')).toBe('raccolto');
  });
});

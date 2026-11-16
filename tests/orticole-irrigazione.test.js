/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  OrticolaIrrigazione,
  IRRIGAZIONE_METODI,
  metodoDaTipoLavoro
} from '../modules/orticole/models/OrticolaIrrigazione.js';

describe('Orticole irrigazione', () => {
  it('metodi a_goccia | aspersione | scorrimento e volume m³', () => {
    expect(IRRIGAZIONE_METODI).toEqual(['a_goccia', 'aspersione', 'scorrimento']);
    expect(metodoDaTipoLavoro('Irrigazione a goccia')).toBe('a_goccia');
    expect(metodoDaTipoLavoro('Irrigazione a aspersione')).toBe('aspersione');
    expect(metodoDaTipoLavoro('Irrigazione a scorrimento')).toBe('scorrimento');

    const row = new OrticolaIrrigazione({
      campagnaId: 'c1',
      attivitaId: 'a1',
      data: '2026-06-01',
      metodo: 'a_goccia',
      volumeM3: 120,
      superficieEttari: 1.5
    });
    expect(row.validate().valid).toBe(true);
    expect(row.toFirestore().unitaVolume).toBe('m3');
  });

  it('validate rifiuta volume o metodo mancanti', () => {
    const bad = new OrticolaIrrigazione({
      campagnaId: 'c1',
      lavoroId: 'l1',
      data: '2026-06-01',
      metodo: 'foglia',
      volumeM3: 0
    });
    expect(bad.validate().valid).toBe(false);
  });
});

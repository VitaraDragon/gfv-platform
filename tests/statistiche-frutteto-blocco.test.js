/**
 * @vitest-environment node
 */

import { describe, expect, test } from 'vitest';
import { calcolaBloccoFruttetoAnnata } from '../core/js/statistiche-frutteto-blocco.js';

describe('statistiche-frutteto-blocco', () => {
  test('KPI annata: superficie aperti, produzione kg e resa; chiusi esclusi', () => {
    const result = calcolaBloccoFruttetoAnnata({
      anno: 2026,
      frutteti: [
        { id: 'f1', specie: 'Melo', varieta: 'Golden', superficieEttari: 1 },
        { id: 'f2', specie: 'Pesco', varieta: 'Redhaven', superficieEttari: 0.5 },
        { id: 'f3', specie: 'Melo', superficieEttari: 4, statoImpianto: 'chiuso' }
      ],
      raccolte: [
        { specie: 'Melo', quantitaKg: 800, data: new Date(2026, 8, 1) },
        { specie: 'Pesco', quantitaKg: 200, data: new Date(2026, 6, 15) },
        { specie: 'Melo', quantitaKg: 100, data: new Date(2025, 8, 1) }
      ]
    });

    expect(result.nFrutteti).toBe(2);
    expect(result.superficieHa).toBeCloseTo(1.5, 5);
    expect(result.produzioneKg).toBeCloseTo(1000, 5);
    expect(result.resaKgHa).toBeCloseTo(1000 / 1.5, 2);
    expect(result.produzionePerSpecie.some((r) => r.nome === 'Melo' && r.valore === 800)).toBe(true);
  });
});

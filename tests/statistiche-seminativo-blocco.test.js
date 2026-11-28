/**
 * @vitest-environment node
 */

import { describe, expect, test } from 'vitest';
import { calcolaBloccoSeminativoAnnata } from '../core/js/statistiche-seminativo-blocco.js';

describe('statistiche-seminativo-blocco', () => {
  test('KPI annata: solo raccolte solari; campo campagna 2025/2026 non sposta i confini', () => {
    const result = calcolaBloccoSeminativoAnnata({
      anno: 2026,
      campagne: [
        {
          id: 'c1',
          campagna: '2025/2026',
          colturaNome: 'Grano',
          superficieEttari: 2,
          resaPrevistaQliHa: 50
        },
        {
          id: 'c2',
          campagna: '2025/2026',
          colturaNome: 'Mais',
          superficieEttari: 1,
          resaPrevistaQliHa: 80
        },
        {
          id: 'c3',
          campagna: '2024/2025',
          colturaNome: 'Orzo',
          superficieEttari: 4,
          resaPrevistaQliHa: 40
        }
      ],
      raccolte: [
        { campagnaId: 'c1', quantitaQli: 100, data: new Date(2026, 6, 10) },
        { campagnaId: 'c2', quantitaQli: 60, data: new Date(2026, 8, 1) },
        { campagnaId: 'c1', quantitaQli: 20, data: new Date(2025, 6, 10) },
        { campagnaId: 'c3', quantitaQli: 200, data: new Date(2025, 6, 20) }
      ]
    });

    expect(result.nCampagne).toBe(2);
    expect(result.produzioneQli).toBeCloseTo(160, 5);
    expect(result.superficieHa).toBeCloseTo(3, 5);
    expect(result.resaEffettivaQliHa).toBeCloseTo(160 / 3, 2);
    // media ponderata: (50*2 + 80*1) / 3 = 60
    expect(result.resaPrevistaQliHa).toBeCloseTo(60, 5);
    expect(result.produzionePerColtura.some((r) => r.nome === 'Grano' && r.valore === 100)).toBe(true);
    expect(result.produzionePerColtura.some((r) => r.nome === 'Mais' && r.valore === 60)).toBe(true);
  });
});

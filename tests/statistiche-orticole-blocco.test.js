/**
 * @vitest-environment node
 */

import { describe, expect, test } from 'vitest';
import { calcolaBloccoOrticoleAnnata } from '../core/js/statistiche-orticole-blocco.js';

describe('statistiche-orticole-blocco', () => {
  test('KPI annata: raccolte, rese e m³; irrigazione sola conta la campagna; campagna label ignorata', () => {
    const result = calcolaBloccoOrticoleAnnata({
      anno: 2026,
      campagne: [
        {
          id: 'o1',
          campagna: '2025/2026',
          colturaNome: 'Pomodoro',
          superficieEttari: 1,
          resaPrevistaQliHa: 400
        },
        {
          id: 'o2',
          campagna: '2025/2026',
          colturaNome: 'Lattuga',
          superficieEttari: 0.5,
          resaPrevistaQliHa: 200
        },
        {
          id: 'o3',
          campagna: '2024/2025',
          colturaNome: 'Zucchina',
          superficieEttari: 2,
          resaPrevistaQliHa: 300
        }
      ],
      raccolte: [
        { campagnaId: 'o1', quantitaQli: 350, data: new Date(2026, 7, 5) },
        { campagnaId: 'o1', quantitaQli: 50, data: new Date(2025, 7, 5) },
        { campagnaId: 'o3', quantitaQli: 100, data: new Date(2025, 6, 1) }
      ],
      irrigazioni: [
        { campagnaId: 'o1', volumeM3: 120, data: new Date(2026, 5, 1) },
        { campagnaId: 'o2', volumeM3: 40, data: new Date(2026, 5, 15) },
        { campagnaId: 'o2', volumeM3: 10, data: new Date(2025, 5, 15) }
      ]
    });

    // o1 (raccolta+irrigazione 2026) + o2 (solo irrigazione 2026); o3 fuori anno
    expect(result.nCampagne).toBe(2);
    expect(result.produzioneQli).toBeCloseTo(350, 5);
    expect(result.superficieHa).toBeCloseTo(1.5, 5);
    expect(result.resaEffettivaQliHa).toBeCloseTo(350 / 1.5, 2);
    // (400*1 + 200*0.5) / 1.5 = 333.33...
    expect(result.resaPrevistaQliHa).toBeCloseTo((400 * 1 + 200 * 0.5) / 1.5, 2);
    expect(result.acquaM3).toBeCloseTo(160, 5);
    expect(result.produzionePerColtura.some((r) => r.nome === 'Pomodoro' && r.valore === 350)).toBe(true);
  });
});

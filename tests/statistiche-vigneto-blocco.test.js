/**
 * @vitest-environment node
 */

import { describe, expect, test } from 'vitest';
import { calcolaBloccoVignetoAnnata } from '../core/js/statistiche-vigneto-blocco.js';

describe('statistiche-vigneto-blocco', () => {
  test('KPI annata: superficie aperti, produzione e resa; chiusi esclusi', () => {
    const result = calcolaBloccoVignetoAnnata({
      anno: 2026,
      vigneti: [
        { id: 'v1', varieta: 'Sangiovese', superficieEttari: 2 },
        { id: 'v2', varieta: 'Trebbiano', superficieEttari: 1.5 },
        { id: 'v3', varieta: 'Chiuso', superficieEttari: 9, statoImpianto: 'chiuso' }
      ],
      vendemmie: [
        { varieta: 'Sangiovese', quantitaQli: 40, data: new Date(2026, 8, 10) },
        { varieta: 'Trebbiano', quantitaQli: 20, data: new Date(2026, 8, 15) },
        { varieta: 'Sangiovese', quantitaQli: 10, data: new Date(2025, 8, 10) },
        { varieta: 'Trebbiano', quantitaQli: 0, data: new Date(2026, 8, 20) }
      ]
    });

    expect(result.nVigneti).toBe(2);
    expect(result.superficieHa).toBeCloseTo(3.5, 5);
    expect(result.produzioneQli).toBeCloseTo(60, 5);
    expect(result.resaQliHa).toBeCloseTo(60 / 3.5, 2);
    expect(result.produzionePerVarieta[0].nome).toBe('Sangiovese');
    expect(result.produzionePerVarieta[0].valore).toBe(40);
  });
});

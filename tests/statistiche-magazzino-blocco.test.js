/**
 * @vitest-environment node
 */

import { describe, expect, test } from 'vitest';
import {
  calcolaBloccoMagazzinoAnnata,
  tipoMovimentoNorm
} from '../core/js/statistiche-magazzino-blocco.js';

describe('statistiche-magazzino-blocco', () => {
  test('KPI quantità annata senza euro; giacenze e riparto prodotti', () => {
    const result = calcolaBloccoMagazzinoAnnata({
      anno: 2026,
      prodotti: [
        { id: 'p1', nome: 'Zolfo', giacenza: 50, unitaMisura: 'kg' },
        { id: 'p2', nome: 'Rame', giacenza: 12, unitaMisura: 'kg' },
        { id: 'p3', nome: 'Vuoto', giacenza: 0 },
        { id: 'p4', nome: 'Negativo', giacenza: -2 }
      ],
      movimenti: [
        { prodottoId: 'p1', tipo: 'entrata', quantita: 20, data: new Date(2026, 1, 1) },
        { prodottoId: 'p1', tipo: 'uscita', quantita: 5, data: new Date(2026, 2, 1) },
        { prodottoId: 'p2', tipo: 'uscita', quantita: 3, data: new Date(2026, 3, 1) },
        { prodottoId: 'p2', tipo: 'entrata', quantita: 10, data: new Date(2025, 3, 1) },
        { prodottoId: 'p1', tipo: 'entrata', quantita: 0, data: new Date(2026, 4, 1) }
      ]
    });

    expect(result.nProdottiConGiacenza).toBe(2);
    expect(result.giacenzePrincipali[0].nome).toBe('Zolfo');
    expect(result.giacenzePrincipali[0].giacenza).toBe(50);
    expect(result.qtyEntrate).toBe(20);
    expect(result.qtyUscite).toBe(8);
    expect(result.nMovimenti).toBe(3);
    expect(result.movimentiPerProdotto.some((r) => r.nome === 'Zolfo' && r.valore === 25)).toBe(true);
    expect(result).not.toHaveProperty('valoreEntrate');
    expect(JSON.stringify(result)).not.toMatch(/€|euro/i);
  });

  test('tipoMovimentoNorm normalizza uscita/entrata', () => {
    expect(tipoMovimentoNorm({ tipo: 'uscita' })).toBe('uscita');
    expect(tipoMovimentoNorm({ tipo: 'ENTRATA' })).toBe('entrata');
    expect(tipoMovimentoNorm({})).toBe('entrata');
  });
});

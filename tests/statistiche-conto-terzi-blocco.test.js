/**
 * @vitest-environment node
 */

import { describe, expect, test } from 'vitest';
import {
  calcolaBloccoContoTerziAnnata,
  resolveEttariCtStats,
  topNConAltri
} from '../core/js/statistiche-conto-terzi-blocco.js';

describe('statistiche-conto-terzi-blocco', () => {
  test('KPI annata: lavori clienti, ettari, ore da attività, annullati esclusi', () => {
    const result = calcolaBloccoContoTerziAnnata({
      anno: 2026,
      lavori: [
        { id: 'l1', clienteId: 'c1', stato: 'completato', dataInizio: new Date(2026, 2, 1), terrenoId: 't1', superficieTotaleLavorata: 2.5 },
        { id: 'l2', clienteId: 'c1', stato: 'in_corso', dataInizio: new Date(2026, 5, 1), terrenoId: 't2' },
        { id: 'l3', clienteId: 'c2', stato: 'completato', dataInizio: new Date(2026, 4, 1), terrenoId: 't3', superficieTotaleLavorata: 1 },
        { id: 'l4', clienteId: 'c2', stato: 'annullato', dataInizio: new Date(2026, 1, 1), superficieTotaleLavorata: 9 },
        { id: 'l5', clienteId: 'c1', stato: 'completato', dataInizio: new Date(2025, 2, 1), superficieTotaleLavorata: 4 },
        { id: 'l6', stato: 'completato', dataInizio: new Date(2026, 3, 1), superficieTotaleLavorata: 3 }
      ],
      attivita: [
        { clienteId: 'c1', data: new Date(2026, 2, 10), oreNette: 8 },
        { clienteId: 'c2', data: new Date(2026, 4, 10), oreNette: 4 },
        { clienteId: 'c1', data: new Date(2025, 2, 10), oreNette: 20 },
        { data: new Date(2026, 2, 10), oreNette: 5 }
      ],
      clientiById: {
        c1: { ragioneSociale: 'Rossi Agricoltura' },
        c2: { nome: 'Bianchi' }
      },
      terreniById: {
        t2: { superficie: 3.2 },
        t3: { superficie: 10 }
      }
    });

    expect(result.nLavori).toBe(3);
    expect(result.clientiAttivi).toBe(2);
    expect(result.ettari).toBeCloseTo(2.5 + 3.2 + 1, 5);
    expect(result.ore).toBe(12);
    expect(result.lavoriPerCliente[0].nome).toBe('Rossi Agricoltura');
    expect(result.lavoriPerCliente[0].valore).toBe(2);
  });

  test('resolveEttariCtStats preferisce superficie lavorata al terreno', () => {
    expect(resolveEttariCtStats({ superficieTotaleLavorata: 1.5 }, { superficie: 9 })).toBe(1.5);
    expect(resolveEttariCtStats({}, { superficie: 4 })).toBe(4);
    expect(resolveEttariCtStats({}, null)).toBe(0);
  });

  test('topNConAltri aggrega il resto in Altri', () => {
    const out = topNConAltri([
      { id: 'a', nome: 'A', valore: 10 },
      { id: 'b', nome: 'B', valore: 8 },
      { id: 'c', nome: 'C', valore: 3 },
      { id: 'd', nome: 'D', valore: 2 }
    ], 2);
    expect(out).toHaveLength(3);
    expect(out[2].nome).toBe('Altri');
    expect(out[2].valore).toBe(5);
  });
});

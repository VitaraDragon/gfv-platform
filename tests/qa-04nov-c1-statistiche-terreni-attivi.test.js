import { describe, expect, it, vi } from 'vitest';
import {
  getAllTerreni,
  nomeTerrenoStatistiche,
  superficieTerreniAttivi
} from '../core/js/statistiche-controller.js';

const terreni = [
  { id: '1', nome: 'A', superficie: 1 },
  { id: '2', nome: 'B', superficie: 2 },
  { id: '3', nome: 'C', superficie: 3, stato: 'archiviato' },
  { id: '4', nome: 'D', superficie: 4 },
  { id: '5', nome: 'E', superficie: 5, stato: 'archiviato' },
  { id: '6', nome: 'F', superficie: 6 },
  { id: '7', nome: 'Cliente', superficie: 10, clienteId: 'cli' }
];

const dependencies = {
  query: vi.fn((value) => value),
  collection: vi.fn((_db, path) => path),
  db: {},
  getDocs: vi.fn(async () => ({
    docs: terreni.map((data) => ({ id: data.id, data: () => data }))
  }))
};

describe('C1 — statistiche terreni attivi', () => {
  it('esclude archiviati e terreni cliente da totale e filtro', async () => {
    const attivi = await getAllTerreni('tenant', dependencies);
    expect(attivi.map((t) => t.nome)).toEqual(['A', 'B', 'D', 'F']);
    expect(attivi).toHaveLength(4);
    expect(superficieTerreniAttivi(attivi)).toBe(13);
  });

  it('il lookup storico conserva il terreno archiviato con suffisso', async () => {
    const tutti = await getAllTerreni('tenant', dependencies, null, { includiArchiviati: true });
    const archivio = tutti.find((t) => t.id === '3');
    expect(nomeTerrenoStatistiche(archivio)).toBe('C (archiviato)');
  });
});

/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { getTotaleTerreni } from '../core/js/statistiche-controller.js';

describe('getTotaleTerreni — filtro terreno nella riga KPI', () => {
  it('senza filtro conta tutti i terreni', async () => {
    const getAll = vi.fn(async () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    await expect(getTotaleTerreni(getAll)).resolves.toBe(3);
    await expect(getTotaleTerreni(getAll, {})).resolves.toBe(3);
  });

  it('con terrenoId selezionato restituisce 1 se presente', async () => {
    const getAll = vi.fn(async () => [{ id: 'a' }, { id: 'b' }]);
    await expect(getTotaleTerreni(getAll, { terrenoId: 'b' })).resolves.toBe(1);
  });

  it('con terrenoId assente nell’anagrafica restituisce 0', async () => {
    const getAll = vi.fn(async () => [{ id: 'a' }]);
    await expect(getTotaleTerreni(getAll, { terrenoId: 'missing' })).resolves.toBe(0);
  });

  it('senza callback restituisce 0', async () => {
    await expect(getTotaleTerreni(null)).resolves.toBe(0);
  });
});

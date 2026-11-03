import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../core/services/terreni-service.js', () => ({
  getTerreno: vi.fn()
}));

vi.mock('../core/services/firebase-service.js', () => ({
  getDocumentData: vi.fn()
}));

vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => 'tenant-1')
}));

import { getTerreno } from '../core/services/terreni-service.js';
import { getDocumentData } from '../core/services/firebase-service.js';
import {
  assertLavoroModificabile,
  assertAttivitaModificabile,
  assertRegistroImpiantoModificabile
} from '../core/services/storico-guard.js';
import { MESSAGGIO_SOLA_LETTURA } from '../shared/js/storico-sola-lettura.js';

describe('servizi in sola lettura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('update e delete di un lavoro su terreno archiviato sono rifiutati', async () => {
    getTerreno.mockResolvedValue({ id: 't1', stato: 'archiviato', coltura: 'Vite' });
    const lavoro = { id: 'l1', terrenoId: 't1', stato: 'in_corso' };
    await expect(assertLavoroModificabile(lavoro)).rejects.toThrow(MESSAGGIO_SOLA_LETTURA);
  });

  it('un\'attività prima del cambio coltura è rifiutata', async () => {
    getTerreno.mockResolvedValue({ id: 't1', stato: 'attivo', colturaDal: '2026-06-01' });
    await expect(assertAttivitaModificabile({
      id: 'a1',
      terrenoId: 't1',
      data: '2026-01-04'
    })).rejects.toThrow(MESSAGGIO_SOLA_LETTURA);
  });

  it('un registro su impianto chiuso senza lavoro è rifiutato', async () => {
    getDocumentData.mockImplementation(async (collezione) => {
      if (collezione === 'vigneti') return { id: 'v1', statoImpianto: 'chiuso' };
      return null;
    });
    await expect(assertRegistroImpiantoModificabile(
      { data: '2026-02-01' },
      'vigneti',
      'v1'
    )).rejects.toThrow(MESSAGGIO_SOLA_LETTURA);
  });
});

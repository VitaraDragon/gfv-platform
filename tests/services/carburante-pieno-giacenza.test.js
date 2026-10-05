/**
 * Carico e pieno aggiornano la giacenza una sola volta, via increment.
 * Le quote litri per lavoro non sono un secondo movimento.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../core/services/firebase-service.js', () => ({
  getDocumentData: vi.fn(),
  updateDocument: vi.fn(),
  incrementDocumentField: vi.fn(),
  createDocument: vi.fn(),
  getCollectionData: vi.fn(),
  deleteDocument: vi.fn(),
  timestampToDate: (t) => (t instanceof Date ? t : (t ? new Date(t) : null)),
  dateToTimestamp: (d) => d,
}));
vi.mock('../../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(),
}));

import { createDocument, incrementDocumentField, getDocumentData } from '../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../core/services/tenant-service.js';
import { createMovimento } from '../../modules/magazzino/services/movimenti-service.js';

describe('createMovimento carburante — un solo increment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentTenantId.mockReturnValue('t1');
    getDocumentData.mockResolvedValue({ id: 'gas', nome: 'Gasolio', giacenza: 100, categoria: 'carburante' });
    createDocument.mockResolvedValue('mov-new');
    incrementDocumentField.mockResolvedValue(undefined);
  });

  it('pieno senza macchinaId non scrive e non tocca la giacenza', async () => {
    await expect(createMovimento({
      prodottoId: 'gas',
      data: new Date('2026-10-02'),
      tipo: 'uscita',
      quantita: 80,
      origineCarburante: 'pieno',
    })).rejects.toThrow(/Mezzo obbligatorio/);
    expect(createDocument).not.toHaveBeenCalled();
    expect(incrementDocumentField).not.toHaveBeenCalled();
  });

  it('carico +100 e pieno −80 sono due increment, non un overwrite', async () => {
    await createMovimento({
      prodottoId: 'gas',
      data: new Date('2026-10-02'),
      tipo: 'entrata',
      quantita: 100,
      origineCarburante: 'carico_cisterna',
    });
    await createMovimento({
      prodottoId: 'gas',
      data: new Date('2026-10-02'),
      tipo: 'uscita',
      quantita: 80,
      origineCarburante: 'pieno',
      macchinaId: 'mac-t5',
    });
    const deltas = incrementDocumentField.mock.calls.map((c) => c[3]);
    expect(deltas).toEqual([100, -80]);
    expect(incrementDocumentField).toHaveBeenCalledTimes(2);
    expect(createDocument).toHaveBeenCalledTimes(2);
    expect(createDocument.mock.calls[0][1].origineCarburante).toBe('carico_cisterna');
    expect(createDocument.mock.calls[1][1].origineCarburante).toBe('pieno');
    expect(createDocument.mock.calls[1][1].macchinaId).toBe('mac-t5');
    expect(createDocument.mock.calls[1][1].tipo).toBe('uscita');
  });
});

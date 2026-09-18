/**
 * Giacenza magazzino: increment atomico vs race read-modify-write.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../core/services/firebase-service.js', () => ({
  getDocumentData: vi.fn(),
  updateDocument: vi.fn(),
  incrementDocumentField: vi.fn(),
  createDocument: vi.fn(),
  getCollectionData: vi.fn(),
  deleteDocument: vi.fn(),
  timestampToDate: (t) => (t && t.toDate ? t.toDate() : t ? new Date(t) : null),
  dateToTimestamp: (d) => d,
}));
vi.mock('../../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(),
}));

import {
  parseGiacenzaDelta,
  movimentoGiacenzaDelta,
  omitGiacenzaFromAnagraficaPayload,
  composeGiacenza,
  lastWriteWinsGiacenza,
} from '../../modules/magazzino/services/giacenza-utils.js';
import { getDocumentData, updateDocument, incrementDocumentField } from '../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../core/services/tenant-service.js';
import { aggiornaGiacenzaProdotto, updateProdotto } from '../../modules/magazzino/services/prodotti-service.js';

describe('giacenza-utils', () => {
  it('parseGiacenzaDelta rifiuta NaN', () => {
    expect(parseGiacenzaDelta(-3.5)).toBe(-3.5);
    expect(() => parseGiacenzaDelta('x')).toThrow(/Delta giacenza non valido/);
  });

  it('movimentoGiacenzaDelta: entrata +, uscita −', () => {
    expect(movimentoGiacenzaDelta('entrata', 10)).toBe(10);
    expect(movimentoGiacenzaDelta('uscita', 7)).toBe(-7);
    expect(() => movimentoGiacenzaDelta('uscita', 0)).toThrow(/Quantità/);
    expect(() => movimentoGiacenzaDelta('altro', 1)).toThrow(/Tipo/);
  });

  it('omitGiacenzaFromAnagraficaPayload toglie giacenza e tiene il resto', () => {
    expect(omitGiacenzaFromAnagraficaPayload({ nome: 'Urea', giacenza: 40, scortaMinima: 5 }))
      .toEqual({ nome: 'Urea', scortaMinima: 5 });
  });

  it('RMW last-write-wins perde un delta; compose (increment) no', () => {
    const start = 100;
    const deltas = [-7, -5];
    expect(lastWriteWinsGiacenza(start, deltas)).toBe(95);
    expect(composeGiacenza(start, deltas)).toBe(88);
  });
});

describe('aggiornaGiacenzaProdotto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentTenantId.mockReturnValue('t1');
    getDocumentData.mockResolvedValue({ id: 'p1', nome: 'Urea', giacenza: 100 });
    incrementDocumentField.mockResolvedValue(undefined);
  });

  it('usa incrementDocumentField sul campo giacenza, non un valore calcolato', async () => {
    await aggiornaGiacenzaProdotto('p1', -7);
    expect(incrementDocumentField).toHaveBeenCalledWith('prodotti', 'p1', 'giacenza', -7, 't1');
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it('due delta restano due increment, non due overwrite dello stesso start', async () => {
    await Promise.all([
      aggiornaGiacenzaProdotto('p1', -7),
      aggiornaGiacenzaProdotto('p1', -5),
    ]);
    const deltas = incrementDocumentField.mock.calls.map((c) => c[3]);
    expect(deltas.sort((a, b) => a - b)).toEqual([-7, -5]);
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it('delta 0 non scrive', async () => {
    await aggiornaGiacenzaProdotto('p1', 0);
    expect(incrementDocumentField).not.toHaveBeenCalled();
  });

  it('prodotto assente', async () => {
    getDocumentData.mockResolvedValue(null);
    await expect(aggiornaGiacenzaProdotto('missing', -1)).rejects.toThrow(/Prodotto non trovato/);
    expect(incrementDocumentField).not.toHaveBeenCalled();
  });

  it('senza tenant', async () => {
    getCurrentTenantId.mockReturnValue(null);
    await expect(aggiornaGiacenzaProdotto('p1', 1)).rejects.toThrow(/tenant/);
  });
});

describe('updateProdotto non riscrive giacenza', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentTenantId.mockReturnValue('t1');
    getDocumentData.mockResolvedValue({
      id: 'p1',
      nome: 'Urea',
      categoria: 'fertilizzanti',
      unitaMisura: 'kg',
      giacenza: 40,
      dosaggioMin: 1,
      dosaggioMax: 2,
      attivo: true,
    });
    updateDocument.mockResolvedValue(undefined);
  });

  it('payload anagrafica senza chiave giacenza', async () => {
    await updateProdotto('p1', { nome: 'Urea 46' });
    expect(updateDocument).toHaveBeenCalledTimes(1);
    const payload = updateDocument.mock.calls[0][2];
    expect(payload).not.toHaveProperty('giacenza');
    expect(payload.nome).toBe('Urea 46');
  });
});

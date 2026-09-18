/**
 * Preventivi: numero atomico (seq tenant) e accettazione in transazione.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../core/services/firebase-service.js', () => ({
  getDocumentData: vi.fn(),
  updateDocument: vi.fn(),
  createDocument: vi.fn(),
  getCollectionData: vi.fn(),
  deleteDocument: vi.fn(),
  getDocument: vi.fn(),
  runFirestoreTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  timestampToDate: (t) => (t && t.toDate ? t.toDate() : t ? new Date(t) : null),
  dateToTimestamp: (d) => d,
}));
vi.mock('../../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(),
}));
vi.mock('../../modules/conto-terzi/services/tariffe-service.js', () => ({
  calcolaTariffaPreventivo: vi.fn(),
}));
vi.mock('../../modules/conto-terzi/services/clienti-service.js', () => ({
  getCliente: vi.fn(),
}));
vi.mock('../../modules/vendemmia-meccanica/services/preventivo-piano-sync-service.js', () => ({
  syncPreventivoAccettatoToPiano: vi.fn(),
}));

import {
  formatPreventivoNumero,
  parsePreventivoNumero,
  maxSeqFromNumeri,
  nextPreventivoSeq,
  lastWriteWinsNumeri,
  lockedNumeri,
  preventivoPuoEssereAccettato,
  decideTransizionePreventivo,
  applySerializedTransitions,
  lastWriteWinsStato,
  firestoreSnapExists,
} from '../../modules/conto-terzi/services/preventivo-lock-utils.js';
import {
  getCollectionData,
  createDocument,
  updateDocument,
  getDocument,
  runFirestoreTransaction,
} from '../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../core/services/tenant-service.js';
import { syncPreventivoAccettatoToPiano } from '../../modules/vendemmia-meccanica/services/preventivo-piano-sync-service.js';
import {
  allocatePreventivoNumero,
  createPreventivo,
  accettaPreventivo,
  rifiutaPreventivo,
} from '../../modules/conto-terzi/services/preventivi-service.js';

describe('preventivo-lock-utils — numero', () => {
  it('format/parse PREV-anno-seq', () => {
    expect(formatPreventivoNumero(2026, 1)).toBe('PREV-2026-001');
    expect(formatPreventivoNumero(2026, 42)).toBe('PREV-2026-042');
    expect(parsePreventivoNumero('PREV-2026-007')).toEqual({ anno: 2026, seq: 7 });
    expect(parsePreventivoNumero('ALTRO')).toBeNull();
  });

  it('nextPreventivoSeq usa max(stored, esistenti)', () => {
    expect(nextPreventivoSeq(0, 0)).toBe(1);
    expect(nextPreventivoSeq(5, 10)).toBe(11);
    expect(nextPreventivoSeq(10, 5)).toBe(11);
  });

  it('maxSeqFromNumeri ignora altri anni e formati', () => {
    expect(maxSeqFromNumeri(['PREV-2026-003', 'PREV-2025-099', 'PREV-2026-012', 'x'], 2026)).toBe(12);
  });

  it('RMW last-write-wins duplica il numero; lock serializzato no', () => {
    expect(lastWriteWinsNumeri(5, 2)).toEqual([6, 6]);
    expect(lockedNumeri(5, 2, 0)).toEqual([6, 7]);
    expect(lockedNumeri(8, 2, 10)).toEqual([11, 12]);
  });
});

describe('preventivo-lock-utils — accettazione', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  const future = new Date('2026-07-01T12:00:00Z');
  const past = new Date('2026-05-01T12:00:00Z');

  it('preventivoPuoEssereAccettato: bozza/inviato e non scaduto', () => {
    expect(preventivoPuoEssereAccettato('bozza', future, now)).toBe(true);
    expect(preventivoPuoEssereAccettato('inviato', future, now)).toBe(true);
    expect(preventivoPuoEssereAccettato('inviato', past, now)).toBe(false);
    expect(preventivoPuoEssereAccettato('accettato_manager', future, now)).toBe(false);
    expect(preventivoPuoEssereAccettato('rifiutato', future, now)).toBe(false);
  });

  it('decideTransizionePreventivo: accetta manager vs email, rifiuta', () => {
    expect(decideTransizionePreventivo('inviato', future, 'accetta', 'manager', now).patch.stato)
      .toBe('accettato_manager');
    expect(decideTransizionePreventivo('bozza', future, 'accetta', 'email', now).patch.stato)
      .toBe('accettato_email');
    expect(decideTransizionePreventivo('inviato', future, 'rifiuta', 'manager', now).patch)
      .toEqual({ stato: 'rifiutato' });
  });

  it('due accettazioni concorrenti: lock tiene uno; last-write-wins entrambi', () => {
    const locked = applySerializedTransitions(
      { stato: 'inviato', dataScadenza: future },
      [
        { azione: 'accetta', metodo: 'manager' },
        { azione: 'accetta', metodo: 'email' },
      ],
      now
    );
    expect(locked.stato).toBe('accettato_manager');
    expect(locked.outcomes.map((o) => o.ok)).toEqual([true, false]);
    expect(lastWriteWinsStato([{ stato: 'accettato_manager' }, { stato: 'accettato_email' }]))
      .toBe('accettato_email');
  });

  it('firestoreSnapExists copre client e admin', () => {
    expect(firestoreSnapExists({ exists: () => true })).toBe(true);
    expect(firestoreSnapExists({ exists: true })).toBe(true);
    expect(firestoreSnapExists({ exists: false })).toBe(false);
    expect(firestoreSnapExists(null)).toBe(false);
  });
});

describe('allocatePreventivoNumero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentTenantId.mockReturnValue('t1');
    getDocument.mockReturnValue({ path: 'tenants/t1' });
    getCollectionData.mockResolvedValue([{ numero: 'PREV-2026-004' }]);
  });

  it('scrive max(stored, esistenti)+1 sul tenant in transazione', async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ preventivoSeqByYear: { 2026: 2 } }),
      }),
      update: vi.fn(),
    };
    runFirestoreTransaction.mockImplementation(async (fn) => fn(tx));

    const numero = await allocatePreventivoNumero('t1', new Date('2026-03-01'));
    expect(numero).toBe('PREV-2026-005');
    expect(tx.update).toHaveBeenCalledWith(
      { path: 'tenants/t1' },
      expect.objectContaining({ 'preventivoSeqByYear.2026': 5 })
    );
  });

  it('due transazioni serializzate sul tenant danno numeri distinti', async () => {
    let stored = 4;
    runFirestoreTransaction.mockImplementation(async (fn) => {
      const tx = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ preventivoSeqByYear: { 2026: stored } }),
        }),
        update: vi.fn().mockImplementation((_ref, patch) => {
          stored = patch['preventivoSeqByYear.2026'];
        }),
      };
      return fn(tx);
    });
    getCollectionData.mockResolvedValue([{ numero: 'PREV-2026-004' }]);

    const a = await allocatePreventivoNumero('t1', new Date('2026-03-01'));
    const b = await allocatePreventivoNumero('t1', new Date('2026-03-01'));
    expect(new Set([a, b]).size).toBe(2);
    expect([a, b].sort()).toEqual(['PREV-2026-005', 'PREV-2026-006']);
  });
});

describe('createPreventivo usa allocate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentTenantId.mockReturnValue('t1');
    getDocument.mockReturnValue({ path: 'tenants/t1' });
    getCollectionData.mockResolvedValue([]);
    createDocument.mockResolvedValue('p-new');
    runFirestoreTransaction.mockImplementation(async (fn) => {
      const tx = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ preventivoSeqByYear: {} }),
        }),
        update: vi.fn(),
      };
      return fn(tx);
    });
  });

  it('salva il numero allocato, non un timestamp fallback', async () => {
    const id = await createPreventivo({
      clienteId: 'c1',
      tipoLavoro: 'Erpicatura',
      coltura: 'vite',
      tipoCampo: 'pianura',
      superficie: 1,
      totale: 10,
    }, false);
    expect(id).toBe('p-new');
    const payload = createDocument.mock.calls[0][1];
    expect(payload.numero).toMatch(/^PREV-\d{4}-001$/);
  });
});

describe('accettaPreventivo / rifiutaPreventivo in transazione', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentTenantId.mockReturnValue('t1');
    getDocument.mockReturnValue({ path: 'preventivi/p1' });
    syncPreventivoAccettatoToPiano.mockResolvedValue({ synced: false });
  });

  function mockTxGet(data) {
    runFirestoreTransaction.mockImplementation(async (fn) => {
      const tx = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => data,
        }),
        update: vi.fn(),
      };
      return fn(tx);
    });
  }

  it('accetta inviato senza passare da updateDocument (gate bozza)', async () => {
    const scadenza = new Date(Date.now() + 86400000);
    mockTxGet({ stato: 'inviato', dataScadenza: scadenza, numero: 'PREV-2026-001' });

    const result = await accettaPreventivo('p1', 'manager');
    expect(result.preventivo.stato).toBe('accettato_manager');
    expect(updateDocument).not.toHaveBeenCalled();
    expect(syncPreventivoAccettatoToPiano).toHaveBeenCalled();
    const txUpdate = runFirestoreTransaction.mock.calls.length;
    expect(txUpdate).toBeGreaterThan(0);
  });

  it('secondo accept concorrente fallisce', async () => {
    let stato = 'inviato';
    const scadenza = new Date(Date.now() + 86400000);
    runFirestoreTransaction.mockImplementation(async (fn) => {
      const tx = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ stato, dataScadenza: scadenza }),
        }),
        update: vi.fn().mockImplementation(() => {
          stato = 'accettato_manager';
        }),
      };
      return fn(tx);
    });

    const first = await accettaPreventivo('p1', 'manager');
    expect(first.preventivo.stato).toBe('accettato_manager');
    await expect(accettaPreventivo('p1', 'email')).rejects.toThrow(/non può essere accettato/);
    expect(stato).toBe('accettato_manager');
  });

  it('rifiuta in transazione', async () => {
    const scadenza = new Date(Date.now() + 86400000);
    const tx = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ stato: 'bozza', dataScadenza: scadenza }),
      }),
      update: vi.fn(),
    };
    runFirestoreTransaction.mockImplementation(async (fn) => fn(tx));
    await rifiutaPreventivo('p1');
    expect(tx.update).toHaveBeenCalledWith(
      { path: 'preventivi/p1' },
      expect.objectContaining({ stato: 'rifiutato' })
    );
    expect(updateDocument).not.toHaveBeenCalled();
  });
});

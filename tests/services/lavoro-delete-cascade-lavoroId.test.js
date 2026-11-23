/**
 * Elimina: conteggio trattamenti per lavoroId (collezioni piatte e sotto-path),
 * senza dover caricare a priori tutti i trattamenti del tenant via getAll*.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCollectionData = vi.fn();
const getDocumentData = vi.fn();
const deleteDocument = vi.fn();
const updateDocument = vi.fn();

vi.mock('../../core/services/firebase-service.js', () => ({
  getCollectionData: (...args) => getCollectionData(...args),
  getDocumentData: (...args) => getDocumentData(...args),
  deleteDocument: (...args) => deleteDocument(...args),
  updateDocument: (...args) => updateDocument(...args)
}));

vi.mock('../../core/services/tenant-service.js', () => ({
  getCurrentTenantId: () => 'tenant-1'
}));

vi.mock('../../core/services/auth-service.js', () => ({
  getCurrentUserData: () => ({ ruoli: ['manager'] })
}));

vi.mock('../../modules/vigneto/services/vigneti-service.js', () => ({
  getAllVigneti: vi.fn(async () => [])
}));
vi.mock('../../modules/vigneto/services/vendemmia-service.js', () => ({
  deleteVendemmia: vi.fn()
}));
vi.mock('../../modules/vigneto/services/potatura-vigneto-service.js', () => ({
  deletePotatura: vi.fn()
}));
vi.mock('../../modules/vigneto/services/trattamenti-vigneto-service.js', () => ({
  deleteTrattamento: vi.fn()
}));
vi.mock('../../modules/frutteto/services/frutteti-service.js', () => ({
  getAllFrutteti: vi.fn(async ({ terrenoId } = {}) => (
    terrenoId === 'ter-pesco' ? [{ id: 'fru-1' }] : []
  ))
}));
vi.mock('../../modules/frutteto/services/potatura-frutteto-service.js', () => ({
  deletePotatura: vi.fn()
}));
vi.mock('../../modules/frutteto/services/trattamenti-frutteto-service.js', () => ({
  deleteTrattamento: vi.fn()
}));
vi.mock('../../modules/frutteto/services/raccolta-frutta-service.js', () => ({
  deleteRaccolta: vi.fn()
}));
const deleteTrattamentoSeminativo = vi.fn(async () => undefined);
vi.mock('../../modules/seminativo/services/trattamenti-service.js', () => ({
  deleteTrattamentoSeminativo: (...args) => deleteTrattamentoSeminativo(...args)
}));
vi.mock('../../modules/orticole/services/trattamenti-service.js', () => ({
  deleteTrattamentoOrticole: vi.fn()
}));

const magazzino = vi.hoisted(() => ({
  giacenza: 8.59,
  movimenti: new Map()
}));

const deleteMovimento = vi.fn(async (movimentoId) => {
  const mov = magazzino.movimenti.get(String(movimentoId));
  if (!mov) {
    const err = new Error('Movimento non trovato');
    err.code = 'MOVIMENTO_NON_TROVATO';
    throw err;
  }
  // uscita: ripristina giacenza
  if (mov.tipo === 'uscita') magazzino.giacenza += Number(mov.quantita) || 0;
  else magazzino.giacenza -= Number(mov.quantita) || 0;
  magazzino.movimenti.delete(String(movimentoId));
});

vi.mock('../../modules/magazzino/services/movimenti-service.js', () => ({
  deleteMovimento: (...args) => deleteMovimento(...args)
}));

vi.mock('../../core/services/storico-guard.js', () => ({
  assertLavoroModificabile: vi.fn(async () => undefined)
}));
vi.mock('../../modules/vendemmia-meccanica/services/lavoro-piano-sync-service.js', () => ({
  clearLavoroFromPianoStagione: vi.fn(async () => undefined)
}));
vi.mock('../../core/services/lavoro-macchine-lifecycle.js', () => ({
  liberaMacchineDaLavoro: vi.fn(async () => undefined)
}));

describe('countRelatedLavoroData per lavoroId', () => {
  beforeEach(() => {
    getCollectionData.mockReset();
    getDocumentData.mockReset();
    getCollectionData.mockImplementation(async (collectionName, options = {}) => {
      const where = options.where || [];
      const lavoroEq = where.find((w) => w[0] === 'lavoroId' && w[1] === '==');
      const lid = lavoroEq ? lavoroEq[2] : null;

      if (collectionName === 'trattamentiSeminativo' && lid === 'lav-grano') {
        return [{ id: 'ts-1', lavoroId: 'lav-grano', campagnaId: 'camp-1' }];
      }
      if (collectionName === 'frutteti/fru-1/trattamenti' && lid === 'lav-pesco') {
        return [{ id: 'tf-1', lavoroId: 'lav-pesco' }];
      }
      if (collectionName === 'lavori') return [{ id: lid || 'x' }];
      // Altre collezioni: query lavoroId → vuoto (niente scan extra nei test)
      if (lavoroEq) return [];
      return [];
    });
  });

  it('grano: trova 1 trattamento seminativo con where lavoroId (messaggio Elimina)', async () => {
    const { countRelatedLavoroData } = await import('../../core/services/lavoro-delete-cascade.js');
    const { formatLavoroDeleteConfirmMessage } = await import('../../core/services/lavoro-delete-cascade-utils.js');

    const counts = await countRelatedLavoroData('lav-grano', {
      tenantId: 'tenant-1',
      lavoro: { id: 'lav-grano', nome: 'Insetticida grano', terrenoId: 'ter-grano' }
    });

    expect(counts.trattamenti).toBe(1);
    expect(formatLavoroDeleteConfirmMessage('Insetticida grano', counts)).toContain('1 trattamento');

    const chiamateSemi = getCollectionData.mock.calls.filter((c) => c[0] === 'trattamentiSeminativo');
    expect(chiamateSemi.length).toBeGreaterThan(0);
    expect(chiamateSemi.some((c) => {
      const where = (c[1] && c[1].where) || [];
      return where.some((w) => w[0] === 'lavoroId' && w[2] === 'lav-grano');
    })).toBe(true);
    // Non deve aver scaricato tutto il tenant senza filtro
    expect(chiamateSemi.every((c) => Array.isArray(c[1]?.where) && c[1].where.length > 0)).toBe(true);
  });

  it('pesco: trova 1 trattamento frutteto interrogando la sotto-collezione per lavoroId', async () => {
    const { countRelatedLavoroData } = await import('../../core/services/lavoro-delete-cascade.js');
    const { formatLavoroDeleteConfirmMessage } = await import('../../core/services/lavoro-delete-cascade-utils.js');

    const counts = await countRelatedLavoroData('lav-pesco', {
      tenantId: 'tenant-1',
      lavoro: { id: 'lav-pesco', nome: 'CIDELY pesco', terrenoId: 'ter-pesco' }
    });

    expect(counts.trattamenti).toBe(1);
    expect(formatLavoroDeleteConfirmMessage('CIDELY pesco', counts)).toContain('1 trattamento');

    const chiamateFru = getCollectionData.mock.calls.filter((c) => c[0] === 'frutteti/fru-1/trattamenti');
    expect(chiamateFru.some((c) => {
      const where = (c[1] && c[1].where) || [];
      return where.some((w) => w[0] === 'lavoroId' && w[2] === 'lav-pesco');
    })).toBe(true);
  });
});

describe('deleteLavoroCascade: lavoro → trattamento → uscita magazzino', () => {
  beforeEach(() => {
    getCollectionData.mockReset();
    getDocumentData.mockReset();
    deleteDocument.mockReset();
    updateDocument.mockReset();
    deleteMovimento.mockClear();
    deleteTrattamentoSeminativo.mockClear();
    magazzino.giacenza = 8.59;
    magazzino.movimenti = new Map([
      ['mov-karate', {
        id: 'mov-karate',
        tipo: 'uscita',
        quantita: 1.41,
        prodottoId: 'karate',
        lavoroId: null,
        origineTrattamentoId: 'ts-1'
      }]
    ]);

    getCollectionData.mockImplementation(async (collectionName, options = {}) => {
      const where = options.where || [];
      const lavoroEq = where.find((w) => w[0] === 'lavoroId' && w[1] === '==');
      const lid = lavoroEq ? lavoroEq[2] : null;

      if (collectionName === 'trattamentiSeminativo' && lid === 'lav-grano') {
        return [{
          id: 'ts-1',
          lavoroId: 'lav-grano',
          campagnaId: 'camp-1',
          magazzinoMovimentoIds: ['mov-karate']
        }];
      }
      if (collectionName === 'lavori') return [{ id: 'lav-grano' }];
      if (lavoroEq) return [];
      return [];
    });

    getDocumentData.mockImplementation(async (collectionName, id) => {
      if (collectionName === 'movimentiMagazzino' && id === 'mov-karate') {
        return magazzino.movimenti.get('mov-karate') || null;
      }
      if (collectionName === 'lavori' && id === 'lav-grano') {
        return { id: 'lav-grano', nome: 'KARATE grano', terrenoId: 'ter-grano' };
      }
      return null;
    });

    deleteDocument.mockImplementation(async (collectionName, id) => {
      if (collectionName === 'movimentiMagazzino') magazzino.movimenti.delete(String(id));
      if (collectionName === 'lavori' && id === 'lav-grano') return;
    });
  });

  it('dopo Elimina non resta movimento orfano e la giacenza torna a 10', async () => {
    const { deleteLavoroCascade, countRelatedLavoroData } = await import(
      '../../core/services/lavoro-delete-cascade.js'
    );
    const { formatLavoroDeleteConfirmMessage } = await import(
      '../../core/services/lavoro-delete-cascade-utils.js'
    );

    const counts = await countRelatedLavoroData('lav-grano', {
      tenantId: 'tenant-1',
      lavoro: { id: 'lav-grano', nome: 'KARATE grano', terrenoId: 'ter-grano' }
    });
    expect(counts.trattamenti).toBe(1);
    expect(counts.movimenti).toBe(1);
    expect(formatLavoroDeleteConfirmMessage('KARATE grano', counts)).toContain('1 movimento magazzino');

    await deleteLavoroCascade('lav-grano', {
      tenantId: 'tenant-1',
      lavoro: { id: 'lav-grano', nome: 'KARATE grano', terrenoId: 'ter-grano' }
    });

    expect(deleteTrattamentoSeminativo).toHaveBeenCalledWith('ts-1');
    expect(deleteMovimento).toHaveBeenCalledWith('mov-karate');
    expect(magazzino.movimenti.size).toBe(0);
    expect(magazzino.giacenza).toBeCloseTo(10, 5);
  });
});

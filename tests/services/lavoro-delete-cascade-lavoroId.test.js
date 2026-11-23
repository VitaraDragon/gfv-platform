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
vi.mock('../../modules/seminativo/services/trattamenti-service.js', () => ({
  deleteTrattamentoSeminativo: vi.fn()
}));
vi.mock('../../modules/orticole/services/trattamenti-service.js', () => ({
  deleteTrattamentoOrticole: vi.fn()
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

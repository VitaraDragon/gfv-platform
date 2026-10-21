/**
 * @vitest-environment node
 *
 * normalizeAssenza tiene sostitutoOperaioId: un'assenza con sostituto già scelto
 * esce da listAssenzeApertePerGiorno (inbox del giorno e banner Impegni).
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCollectionData: vi.fn()
}));

vi.mock('../../core/services/firebase-service.js', () => ({
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  getDocumentData: vi.fn(),
  getCollectionData: mocks.getCollectionData,
  serverTimestamp: () => ({ __ts: true })
}));

vi.mock('../../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => 'tenant-test')
}));

import {
  normalizeAssenza,
  listAssenzeApertePerGiorno
} from '../../core/services/manodopera-assenze-service.js';

const GIORNO = '2026-10-21';

describe('manodopera-assenze-service: sostituto sull\'assenza', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('normalizeAssenza copia sostitutoOperaioId, null se manca', () => {
    expect(normalizeAssenza({ id: 'A1', sostitutoOperaioId: 'marco' }).sostitutoOperaioId).toBe('marco');
    expect(normalizeAssenza({ id: 'A2' }).sostitutoOperaioId).toBeNull();
  });

  test('listAssenzeApertePerGiorno toglie la confermata con sostituto e tiene quella senza', async () => {
    mocks.getCollectionData.mockImplementation(async (_col, opts) => {
      const stato = opts.where[0][2];
      if (stato === 'segnalata') return [];
      return [
        {
          id: 'A-sost',
          operaioId: 'ion',
          stato: 'confermata',
          dataInizioGiorno: GIORNO,
          dataFineGiorno: GIORNO,
          standbyLavoroId: 'L239',
          sostitutoOperaioId: 'marco'
        },
        {
          id: 'A-aperta',
          operaioId: 'ana',
          stato: 'confermata',
          dataInizioGiorno: GIORNO,
          dataFineGiorno: GIORNO,
          standbyLavoroId: 'L240'
        }
      ];
    });
    const rows = await listAssenzeApertePerGiorno(GIORNO, 'tenant-test');
    expect(rows.map((a) => a.id)).toEqual(['A-aperta']);
  });
});   

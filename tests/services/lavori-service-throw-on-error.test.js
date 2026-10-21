/**
 * getAllLavori: di default un errore di lettura diventa [] (chiamanti esistenti invariati);
 * con throwOnError viene rilanciato, così il banner assenze distingue «errore» da «nessun lavoro».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    getCollectionData: vi.fn()
}));

vi.mock('../../core/services/firebase-service.js', () => ({
    createDocument: vi.fn(),
    getDocumentData: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    getCollectionData: mocks.getCollectionData,
    serverTimestamp: vi.fn(),
    doc: vi.fn(),
    updateDoc: vi.fn(),
    dateToTimestamp: vi.fn((value) => value),
    timestampToDate: vi.fn((value) => value),
    getAuthInstance: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    getCollection: vi.fn(),
}));

vi.mock('../../core/services/auth-service.js', () => ({
    getCurrentUserData: vi.fn(),
}));

vi.mock('../../core/services/tenant-service.js', () => ({
    getCurrentTenantId: vi.fn(() => 'tenant-test'),
}));

import { getAllLavori } from '../../core/services/lavori-service.js';

describe('getAllLavori: throwOnError', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('senza opzione: errore di rete → [] come prima', async () => {
        mocks.getCollectionData.mockRejectedValue(new Error('Errore lettura collection: offline'));
        await expect(getAllLavori({ stato: 'in_standby', orderBy: null })).resolves.toEqual([]);
    });

    it('con throwOnError: lo stesso errore viene rilanciato', async () => {
        mocks.getCollectionData.mockRejectedValue(new Error('Errore lettura collection: offline'));
        await expect(
            getAllLavori({ stato: 'in_standby', orderBy: null, throwOnError: true })
        ).rejects.toThrow('offline');
    });

    it('con throwOnError e lettura riuscita: lista normale, senza orderBy', async () => {
        mocks.getCollectionData.mockResolvedValue([{ id: 'L1', stato: 'in_standby', standbyAssenzaId: 'A1' }]);
        const lavori = await getAllLavori({ stato: 'in_standby', orderBy: null, throwOnError: true });
        expect(lavori.map((l) => [l.id, l.standbyAssenzaId])).toEqual([['L1', 'A1']]);
        const opts = mocks.getCollectionData.mock.calls[0][1];
        expect(opts.orderBy).toBeNull();
        expect(opts.where).toEqual([['stato', '==', 'in_standby']]);
    });
});

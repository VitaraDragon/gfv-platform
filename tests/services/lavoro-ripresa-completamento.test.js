import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/services/firebase-service.js', () => ({
    createDocument: vi.fn(),
    getDocumentData: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    getCollectionData: vi.fn(),
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

import { getDocumentData } from '../../core/services/firebase-service.js';
import {
    shouldCompletaLavoroSospesoOrigineDaRipresa,
    normalizeLavoroFirestoreId,
    resolveOrigineSospesoForRipresa,
    repairSospesiConRipresaGiaCompletata
} from '../../core/services/lavori-service.js';

describe('normalizeLavoroFirestoreId', () => {
    it('accetta id stringa semplice', () => {
        expect(normalizeLavoroFirestoreId('abc123')).toBe('abc123');
    });

    it('estrae id da path Firestore', () => {
        expect(normalizeLavoroFirestoreId('tenants/t1/lavori/origine1')).toBe('origine1');
    });

    it('estrae id da DocumentReference-like', () => {
        expect(normalizeLavoroFirestoreId({ id: 'origine1', path: 'tenants/t1/lavori/origine1' })).toBe('origine1');
    });
});

describe('resolveOrigineSospesoForRipresa', () => {
    it('trova sospeso via ripresaDaLavoroId', () => {
        const byId = new Map([
            ['sosp1', { id: 'sosp1', stato: 'sospeso', terrenoId: 't1', operaioId: 'op1' }],
            ['rip1', { id: 'rip1', stato: 'completato', ripresaDaLavoroId: 'sosp1', terrenoId: 't1', operaioId: 'op1' }]
        ]);
        const res = resolveOrigineSospesoForRipresa(byId.get('rip1'), byId);
        expect(res?.id).toBe('sosp1');
    });
});

describe('shouldCompletaLavoroSospesoOrigineDaRipresa', () => {
    it('true per ripresa completata e origine sospeso', () => {
        expect(shouldCompletaLavoroSospesoOrigineDaRipresa(
            { ripresaDaLavoroId: 'sosp1', stato: 'completato', completamentoParziale: false },
            'sospeso'
        )).toBe(true);
    });

    it('true con isParziale false anche se completamentoParziale true sul doc', () => {
        expect(shouldCompletaLavoroSospesoOrigineDaRipresa(
            { ripresaDaLavoroId: 'sosp1', completamentoParziale: true },
            'sospeso',
            { isParziale: false }
        )).toBe(true);
    });

    it('false se ripresa parziale esplicita', () => {
        expect(shouldCompletaLavoroSospesoOrigineDaRipresa(
            { ripresaDaLavoroId: 'sosp1', completamentoParziale: true },
            'sospeso',
            { isParziale: true }
        )).toBe(false);
    });

    it('false se origine già completato', () => {
        expect(shouldCompletaLavoroSospesoOrigineDaRipresa(
            { ripresaDaLavoroId: 'sosp1', stato: 'completato' },
            'completato'
        )).toBe(false);
    });

    it('false senza collegamento ripresa', () => {
        expect(shouldCompletaLavoroSospesoOrigineDaRipresa({}, 'sospeso')).toBe(false);
    });
});

describe('repairSospesiConRipresaGiaCompletata', () => {
    it("non avvisa se la ripresa e' completata e l'origine e' gia' chiusa", async () => {
        getDocumentData.mockClear();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const repaired = await repairSospesiConRipresaGiaCompletata([
            { id: 'orig', stato: 'completato', nome: 'Potatura' },
            { id: 'rip', stato: 'completato', ripresaDaLavoroId: 'orig', nome: 'Potatura (ripresa)' },
        ], 'tenant-1');
        expect(repaired).toEqual([]);
        expect(getDocumentData).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it("non avvisa se l'origine letta e' gia' completata", async () => {
        getDocumentData.mockResolvedValue({ stato: 'completato' });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await repairSospesiConRipresaGiaCompletata([
            { id: 'rip', stato: 'completato', ripresaDaLavoroId: 'orig-chiusa' },
        ], 'tenant-1');
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it("avvisa se la ripresa e' completata e l'origine manca", async () => {
        getDocumentData.mockResolvedValue(null);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await repairSospesiConRipresaGiaCompletata([
            { id: 'rip', stato: 'completato', ripresaDaLavoroId: 'mancante' },
        ], 'tenant-1');
        expect(warn).toHaveBeenCalled();
        const testo = warn.mock.calls.map((call) => JSON.stringify(call)).join('\n');
        expect(testo).toContain('origine_not_found');
        warn.mockRestore();
    });
});

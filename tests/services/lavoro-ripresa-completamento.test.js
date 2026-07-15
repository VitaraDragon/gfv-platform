import { describe, it, expect } from 'vitest';
import {
    shouldCompletaLavoroSospesoOrigineDaRipresa,
    normalizeLavoroFirestoreId,
    resolveOrigineSospesoForRipresa
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

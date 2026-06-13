import { describe, it, expect, vi } from 'vitest';
import {
    normalizeOraRecordData,
    createLavoroOreBundle,
    fetchOreOperaiForLavori,
    forEachOraInBundle
} from '../../core/services/manodopera-lavori-ore-loader.js';

describe('normalizeOraRecordData', () => {
    it('converte Timestamp in Date', () => {
        const d = new Date(2026, 0, 15);
        const out = normalizeOraRecordData({
            data: { toDate: () => d },
            creatoIl: { toDate: () => d }
        });
        expect(out.data).toBe(d);
        expect(out.creatoIl).toBe(d);
    });
});

describe('fetchOreOperaiForLavori', () => {
    it('esegue getDocs in parallelo per ogni lavoro', async () => {
        const getDocs = vi.fn(async () => ({ docs: [{ id: 'o1', data: () => ({ stato: 'da_validare' }) }] }));
        const lavoriDocs = [
            { id: 'L1', data: () => ({ nome: 'A' }) },
            { id: 'L2', data: () => ({ nome: 'B' }) }
        ];
        const map = await fetchOreOperaiForLavori(
            'tenant-1',
            lavoriDocs,
            { db: {}, collection: () => ({}), getDocs, query: (...a) => a, where: (...a) => a },
            { statoFilter: 'da_validare' }
        );
        expect(getDocs).toHaveBeenCalledTimes(2);
        expect(map.size).toBe(2);
        expect(map.get('L1').lavoroData.nome).toBe('A');
        expect(map.get('L2').oreDocs).toHaveLength(1);
    });
});

describe('forEachOraInBundle', () => {
    it('itera tutte le ore', () => {
        const bundle = createLavoroOreBundle([], new Map([
            ['L1', {
                lavoroData: { nome: 'X' },
                oreDocs: [
                    { id: 'o1', data: () => ({ oreNette: 8 }) }
                ]
            }]
        ]));
        const seen = [];
        forEachOraInBundle(bundle, (ctx) => {
            seen.push(ctx.lavoroId + ':' + ctx.oraData.oreNette);
        });
        expect(seen).toEqual(['L1:8']);
    });
});

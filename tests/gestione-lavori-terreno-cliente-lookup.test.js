/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    chiamate: []
}));

vi.mock('../core/services/service-helper.js', () => ({
    loadTerreniViaService: vi.fn(async (richiesta) => {
        mocks.chiamate.push(richiesta);
        return mocks.chiamate.terrenti || [
            { id: 't-cl', nome: 'Vigna cliente', superficie: 3.2, clienteId: 'cli-1' },
            { id: 't-az', nome: 'Podere', superficie: 1.5, clienteId: null }
        ];
    })
}));

import { loadTerreni, trovaTerrenoPerId } from '../core/admin/js/gestione-lavori-controller.js';

describe('lookup terreno cliente in Gestione lavori', () => {
    beforeEach(() => {
        mocks.chiamate.length = 0;
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('in vista normale la lista ha solo gli aziendali e il lookup trova il cliente', async () => {
        const terreniList = [];
        await loadTerreni('tenant', {}, {}, {}, terreniList, null, null, false);
        expect(terreniList.map((t) => t.id)).toEqual(['t-az']);
        expect(trovaTerrenoPerId(terreniList, 't-cl').superficie).toBe(3.2);
    });

    it('in conto terzi la lista resta solo dei clienti', async () => {
        const terreniList = [];
        await loadTerreni('tenant', {}, {}, {}, terreniList, null, null, true);
        expect(terreniList.map((t) => t.id)).toEqual(['t-cl']);
        expect(terreniList.some((t) => t.id === 't-az')).toBe(false);
    });

    it('chiede includeTerreniClienti e filtro e dropdown non vedono il terreno cliente', async () => {
        const terreniList = [];
        const vistiDalFiltro = [];
        const vistiDalDropdown = [];
        await loadTerreni(
            'tenant',
            {},
            {},
            {},
            terreniList,
            () => vistiDalFiltro.push(terreniList.map((t) => t.id)),
            () => vistiDalDropdown.push(terreniList.map((t) => t.id)),
            false
        );
        expect(mocks.chiamate[0].options).toMatchObject({
            clienteId: null,
            includeTerreniClienti: true
        });
        expect(vistiDalFiltro).toEqual([['t-az']]);
        expect(vistiDalDropdown).toEqual([['t-az']]);
        expect(trovaTerrenoPerId(terreniList, 't-cl')).toMatchObject({
            id: 't-cl',
            superficie: 3.2
        });
    });
});

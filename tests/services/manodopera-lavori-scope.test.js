import { describe, it, expect } from 'vitest';
import {
    isLavoroVisibileOperaioCampo,
    isLavoroInDropdownSegnaOre,
    isLavoroSegnabileOperaio,
    getLavoroDataFinePrevista,
    sliceOperaioLavoriWindow,
    resolveFieldUserIdVariants,
    lavoroAssegnatoDirettamenteAFieldUser,
} from '../../core/services/manodopera-lavori-scope.js';

describe('isLavoroVisibileOperaioCampo', () => {
    const oggi = new Date(2026, 4, 17);

    it('include da_pianificare con data inizio passata o oggi', () => {
        expect(isLavoroVisibileOperaioCampo({
            stato: 'da_pianificare',
            dataInizio: new Date(2026, 4, 16)
        }, oggi)).toBe(true);
    });

    it('esclude da_pianificare con data futura', () => {
        expect(isLavoroVisibileOperaioCampo({
            stato: 'da_pianificare',
            dataInizio: new Date(2026, 5, 1)
        }, oggi)).toBe(false);
    });

    it('include assegnato e in_corso', () => {
        expect(isLavoroVisibileOperaioCampo({ stato: 'assegnato' }, oggi)).toBe(true);
        expect(isLavoroVisibileOperaioCampo({ stato: 'in_corso' }, oggi)).toBe(true);
    });

    it('esclude completato', () => {
        expect(isLavoroVisibileOperaioCampo({ stato: 'completato' }, oggi)).toBe(false);
    });
});

describe('isLavoroInDropdownSegnaOre', () => {
    const oggi = new Date(2026, 4, 17);

    it('esclude da_pianificare senza data ma mantiene sospeso', () => {
        expect(isLavoroInDropdownSegnaOre({ stato: 'sospeso' }, oggi)).toBe(true);
        expect(isLavoroInDropdownSegnaOre({ stato: 'da_pianificare' }, oggi)).toBe(false);
    });

    it('include assegnato anche con finestra prevista già passata (lavoro ancora aperto)', () => {
        expect(isLavoroInDropdownSegnaOre({
            stato: 'assegnato',
            dataInizio: new Date(2026, 3, 1),
            durataPrevista: 5,
        }, oggi)).toBe(true);
    });

    it('esclude da_pianificare con finestra prevista già passata', () => {
        expect(isLavoroInDropdownSegnaOre({
            stato: 'da_pianificare',
            dataInizio: new Date(2026, 3, 1),
            durataPrevista: 5,
        }, oggi)).toBe(false);
    });

    it('include in_corso e assegnato imminente', () => {
        expect(isLavoroInDropdownSegnaOre({ stato: 'in_corso' }, oggi)).toBe(true);
        expect(isLavoroInDropdownSegnaOre({
            stato: 'assegnato',
            dataInizio: new Date(2026, 4, 20),
            durataPrevista: 3,
        }, oggi)).toBe(true);
    });

    it('include lavori di ripresa anche con finestra prevista passata', () => {
        expect(isLavoroInDropdownSegnaOre({
            stato: 'assegnato',
            ripresaDaLavoroId: 'sosp1',
            dataInizio: new Date(2026, 3, 1),
            durataPrevista: 5,
        }, oggi)).toBe(true);
    });

    it('isLavoroSegnabileOperaio allineato al dropdown', () => {
        expect(isLavoroSegnabileOperaio({ stato: 'sospeso' }, oggi)).toBe(true);
        expect(isLavoroSegnabileOperaio({ stato: 'in_standby' }, oggi)).toBe(false);
    });
});

describe('getLavoroDataFinePrevista', () => {
    it('calcola fine inclusiva', () => {
        const fine = getLavoroDataFinePrevista({
            dataInizio: new Date(2026, 4, 10),
            durataPrevista: 3,
        });
        expect(fine).toBeTruthy();
        expect(fine.getDate()).toBe(12);
    });
});

describe('sliceOperaioLavoriWindow', () => {
    it('preferisce il lavoro in_corso più recente, non il più vecchio', () => {
        const works = [
            { id: 'old', stato: 'in_corso', dataInizio: new Date(2024, 2, 1) },
            { id: 'new', stato: 'in_corso', dataInizio: new Date(2026, 4, 16) },
            { id: 'mid', stato: 'assegnato', dataInizio: new Date(2025, 0, 1) }
        ];
        const slice = sliceOperaioLavoriWindow(works, { maxNeighbors: 0 });
        expect(slice.map((w) => w.id)).toEqual(['new']);
    });

    it('prioritizza lavori di ripresa nel focus', () => {
        const works = [
            { id: 'old', stato: 'in_corso', dataInizio: new Date(2026, 4, 10) },
            { id: 'ripresa', stato: 'assegnato', ripresaDaLavoroId: 'sosp1', dataInizio: new Date(2026, 4, 12) },
        ];
        const slice = sliceOperaioLavoriWindow(works, { maxNeighbors: 0 });
        expect(slice.map((w) => w.id)).toEqual(['ripresa']);
    });
});

describe('resolveFieldUserIdVariants / lavoroAssegnatoDirettamenteAFieldUser', () => {
    it('accetta uid e doc id', () => {
        expect(resolveFieldUserIdVariants('uid-1')).toEqual(expect.arrayContaining(['uid-1']));
        expect(lavoroAssegnatoDirettamenteAFieldUser({ operaioId: 'doc-1' }, 'doc-1')).toBe(true);
        expect(lavoroAssegnatoDirettamenteAFieldUser({ operatoreMacchinaId: 'uid-1' }, 'uid-1')).toBe(true);
    });
});

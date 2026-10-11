import { describe, it, expect, vi } from 'vitest';

// Evita import CDN gstatic da firebase-service (setup importActual fallisce in alcuni ambienti Node).
vi.mock('../../core/services/firebase-service.js', () => ({
    collection: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
}));

import {
    isLavoroVisibileOperaioCampo,
    isLavoroInDropdownSegnaOre,
    isLavoroSegnabileOperaio,
    getLavoroDataFinePrevista,
    sliceOperaioLavoriWindow,
    resolveFieldUserIdVariants,
    lavoroAssegnatoDirettamenteAFieldUser,
    resolveFieldWorkspaceLavoriRoleFlags,
    resolveSegnaturaOreRoleFlags,
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

    it('esclude completato anche con data di completamento', () => {
        expect(isLavoroVisibileOperaioCampo({ stato: 'completato' }, oggi)).toBe(false);
        expect(isLavoroVisibileOperaioCampo({
            stato: 'completato',
            completatoIl: oggi
        }, oggi)).toBe(false);
        expect(isLavoroVisibileOperaioCampo({
            stato: 'completato_da_approvare',
            completatoIl: oggi
        }, oggi)).toBe(false);
    });
});

describe('isLavoroInDropdownSegnaOre', () => {
    const oggi = new Date(2026, 4, 17);

    it('esclude da_pianificare senza data e i sospesi', () => {
        expect(isLavoroInDropdownSegnaOre({ stato: 'sospeso' }, oggi)).toBe(false);
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
        expect(isLavoroSegnabileOperaio({ stato: 'sospeso' }, oggi)).toBe(false);
        expect(isLavoroSegnabileOperaio({
            stato: 'assegnato',
            ripresaDaLavoroId: 'sosp1',
        }, oggi)).toBe(true);
        expect(isLavoroSegnabileOperaio({ stato: 'in_standby' }, oggi)).toBe(false);
    });

    it('completato senza completatoIl resta fuori dal dropdown', () => {
        expect(isLavoroInDropdownSegnaOre({ stato: 'completato' }, oggi)).toBe(false);
        expect(isLavoroInDropdownSegnaOre({ stato: 'completato_da_approvare' }, oggi)).toBe(false);
        expect(isLavoroSegnabileOperaio({ stato: 'completato' }, oggi)).toBe(false);
    });

    it('completato negli ultimi 7 giorni resta nel dropdown', () => {
        expect(isLavoroInDropdownSegnaOre({
            stato: 'completato',
            completatoIl: new Date(2026, 4, 17)
        }, oggi)).toBe(true);
        expect(isLavoroInDropdownSegnaOre({
            stato: 'completato_da_approvare',
            completatoIl: new Date(2026, 4, 10)
        }, oggi)).toBe(true);
    });

    it('completato da 8 giorni resta fuori dal dropdown', () => {
        expect(isLavoroInDropdownSegnaOre({
            stato: 'completato',
            completatoIl: new Date(2026, 4, 9)
        }, oggi)).toBe(false);
        expect(isLavoroSegnabileOperaio({
            stato: 'completato_da_approvare',
            completatoIl: new Date(2026, 4, 9)
        }, oggi)).toBe(false);
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

    it('tiene un completato in finestra senza spostare il focus dal lavoro in corso', () => {
        const works = [
            { id: 'chiuso', stato: 'completato', completatoIl: new Date(), dataInizio: new Date(2020, 1, 1) },
            { id: 'vecchioChiuso', stato: 'completato', completatoIl: new Date(2020, 0, 2), dataInizio: new Date(2019, 0, 1) },
            { id: 'a', stato: 'assegnato', dataInizio: new Date(2024, 0, 1) },
            { id: 'b', stato: 'assegnato', dataInizio: new Date(2024, 6, 1) },
            { id: 'c', stato: 'assegnato', dataInizio: new Date(2025, 0, 1) },
            { id: 'focus', stato: 'in_corso', dataInizio: new Date(2026, 9, 11) },
            { id: 'd', stato: 'assegnato', dataInizio: new Date(2026, 9, 12) },
        ];
        const ids = sliceOperaioLavoriWindow(works, { maxNeighbors: 1 }).map((w) => w.id);
        expect(ids).toContain('chiuso');
        expect(ids).toContain('focus');
        expect(ids).toContain('d');
        expect(ids).not.toContain('vecchioChiuso');
    });
});

describe('resolveFieldWorkspaceLavoriRoleFlags', () => {
    it('caposquadra ha priorità rispetto a operaio (dual-role)', () => {
        const flags = resolveFieldWorkspaceLavoriRoleFlags({
            ruoli: ['operaio', 'caposquadra']
        });
        expect(flags.isCaposquadra).toBe(true);
        expect(flags.isOperaio).toBe(true);
        expect(flags.operaioIncludeSquadJobs).toBe(false);
    });

    it('segna-ore preferisce ancora operaio (comportamento dedicato)', () => {
        const flags = resolveSegnaturaOreRoleFlags({
            ruoli: ['operaio', 'caposquadra']
        });
        expect(flags.isCaposquadra).toBe(false);
        expect(flags.isOperaio).toBe(true);
    });

    it('capo puro vede solo scope caposquadra', () => {
        const flags = resolveFieldWorkspaceLavoriRoleFlags({ ruoli: ['caposquadra'] });
        expect(flags).toEqual({
            isCaposquadra: true,
            isOperaio: false,
            operaioIncludeSquadJobs: false
        });
    });
});

describe('resolveFieldUserIdVariants / lavoroAssegnatoDirettamenteAFieldUser', () => {
    it('accetta uid e doc id', () => {
        expect(resolveFieldUserIdVariants('uid-1')).toEqual(expect.arrayContaining(['uid-1']));
        expect(lavoroAssegnatoDirettamenteAFieldUser({ operaioId: 'doc-1' }, 'doc-1')).toBe(true);
        expect(lavoroAssegnatoDirettamenteAFieldUser({ operatoreMacchinaId: 'uid-1' }, 'uid-1')).toBe(true);
    });
});

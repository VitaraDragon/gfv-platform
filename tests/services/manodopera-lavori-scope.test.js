import { describe, it, expect } from 'vitest';
import {
    isLavoroVisibileOperaioCampo,
    sliceOperaioLavoriWindow
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
});

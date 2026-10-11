import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/services/auth-service.js', () => ({
    getCurrentUserData: vi.fn()
}));
vi.mock('../../core/services/tenant-service.js', () => ({
    getCurrentTenantId: vi.fn()
}));
vi.mock('../../core/services/firebase-service.js', () => ({
    collection: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn()
}));

import { assertGiornoOreAmmesso, testoIntestazioneOreDelGiorno } from '../../core/services/ore-service.js';
import { messaggioOreFuoriFinestra } from '../../core/services/ore-lavoro-selezionabile.js';

function giornoShift(delta) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + delta);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { iso, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()) };
}

const operaio = { id: 'op1', ruoli: ['operaio'] };

describe('assertGiornoOreAmmesso', () => {
    it('lavoro completato 8 giorni fa: errore col messaggio della finestra', () => {
        const chiuso = giornoShift(-8);
        const lavoro = {
            stato: 'completato',
            completatoIl: chiuso.date,
            dataInizio: giornoShift(-20).date
        };
        expect(() => assertGiornoOreAmmesso(lavoro, operaio, chiuso.iso)).toThrow(messaggioOreFuoriFinestra(chiuso.date));
    });

    it('lavoro in corso: nessun errore', () => {
        expect(() => assertGiornoOreAmmesso(
            { stato: 'in_corso' },
            operaio,
            giornoShift(0).iso
        )).not.toThrow();
    });

    it('utente senza ruoli noti: nessun errore, anche fuori finestra', () => {
        const chiuso = giornoShift(-8);
        expect(() => assertGiornoOreAmmesso(
            { stato: 'completato', completatoIl: chiuso.date },
            { id: 'x', ruoli: [] },
            chiuso.iso
        )).not.toThrow();
    });

    it('sospeso e annullato restano fuori da questo guard', () => {
        expect(() => assertGiornoOreAmmesso({ stato: 'sospeso' }, operaio, giornoShift(0).iso)).not.toThrow();
        expect(() => assertGiornoOreAmmesso({ stato: 'annullato' }, operaio, giornoShift(0).iso)).not.toThrow();
    });
});

describe('testoIntestazioneOreDelGiorno', () => {
    it('tiene il prefisso e l’etichetta che passa la pagina', () => {
        expect(testoIntestazioneOreDelGiorno('10/10')).toBe('Le tue ore del 10/10');
        expect(testoIntestazioneOreDelGiorno('11 ottobre 2026')).toBe('Le tue ore del 11 ottobre 2026');
        expect(testoIntestazioneOreDelGiorno('')).toBe('Le tue ore del ');
        expect(testoIntestazioneOreDelGiorno(undefined)).toBe('Le tue ore del ');
    });
});

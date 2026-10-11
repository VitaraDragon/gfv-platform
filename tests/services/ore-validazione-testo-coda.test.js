import { describe, it, expect } from 'vitest';
import { testoCodaValidazioneVuota } from '../../core/services/manodopera-ore-validazione-scope.js';

const TITOLO = 'Nessuna ora da validare';
const DETTAGLIO_INVARIATO = 'Tutte le ore sono state validate o rifiutate';
const DETTAGLIO_MANAGER = 'Nessuna ora da validare da te';

function riga(id, stato) {
    return { id, stato };
}

describe('testoCodaValidazioneVuota', () => {
    it('manager con coda vuota e nessun’altra ora: solo il testo neutro', () => {
        const testo = testoCodaValidazioneVuota({
            isManager: true,
            isCaposquadra: false,
            righe: [],
            visibili: []
        });
        expect(testo.titolo).toBe(TITOLO);
        expect(testo.dettaglio).toBe(DETTAGLIO_MANAGER);
        expect(testo.inAttesaCapisquadra).toBe('');
    });

    it('manager: 3 ore da_validare di operai su squadra', () => {
        const visibile = riga('mia', 'da_validare');
        const testo = testoCodaValidazioneVuota({
            isManager: true,
            isCaposquadra: false,
            righe: [
                visibile,
                riga('o1', 'da_validare'),
                riga('o2', 'da_validare'),
                riga('o3', 'da_validare')
            ],
            visibili: [visibile]
        });
        expect(testo.dettaglio).toBe(DETTAGLIO_MANAGER);
        expect(testo.inAttesaCapisquadra).toBe('3 ore in attesa dei capisquadra');
    });

    it('manager: una sola ora in attesa usa il singolare', () => {
        const testo = testoCodaValidazioneVuota({
            isManager: true,
            righe: [riga('o1', 'da_validare')],
            visibili: []
        });
        expect(testo.inAttesaCapisquadra).toBe('1 ora in attesa dei capisquadra');
    });

    it('ore già validate o rifiutate non contano', () => {
        const testo = testoCodaValidazioneVuota({
            isManager: true,
            isCaposquadra: false,
            righe: [
                riga('v1', 'validate'),
                riga('r1', 'rifiutate'),
                riga('o1', 'da_validare')
            ],
            visibili: []
        });
        expect(testo.inAttesaCapisquadra).toBe('1 ora in attesa dei capisquadra');
    });

    it('le ore già visibili al manager non si contano due volte', () => {
        const autonoma = riga('a1', 'da_validare');
        const copia = riga('a1', 'da_validare');
        const testo = testoCodaValidazioneVuota({
            isManager: true,
            isCaposquadra: false,
            righe: [autonoma, riga('o1', 'da_validare'), riga('o2', 'da_validare')],
            visibili: [autonoma, copia]
        });
        expect(testo.inAttesaCapisquadra).toBe('2 ore in attesa dei capisquadra');
    });

    it('caposquadra e ruolo ignoto tengono il testo di prima', () => {
        const righe = [riga('o1', 'da_validare'), riga('o2', 'da_validare'), riga('o3', 'da_validare')];
        for (const args of [
            { isManager: false, isCaposquadra: true, righe, visibili: [] },
            { isManager: true, isCaposquadra: true, righe, visibili: [] },
            { isManager: false, isCaposquadra: false, righe, visibili: [] },
            { righe, visibili: [] }
        ]) {
            const testo = testoCodaValidazioneVuota(args);
            expect(testo.titolo).toBe(TITOLO);
            expect(testo.dettaglio).toBe(DETTAGLIO_INVARIATO);
            expect(testo.inAttesaCapisquadra).toBe('');
        }
    });

    it('input vuoto o undefined', () => {
        for (const args of [undefined, null, {}]) {
            const testo = testoCodaValidazioneVuota(args);
            expect(testo.titolo).toBe(TITOLO);
            expect(testo.dettaglio).toBe(DETTAGLIO_INVARIATO);
            expect(testo.inAttesaCapisquadra).toBe('');
        }
        const managerVuoto = testoCodaValidazioneVuota({ isManager: true });
        expect(managerVuoto.dettaglio).toBe(DETTAGLIO_MANAGER);
        expect(managerVuoto.inAttesaCapisquadra).toBe('');
    });
});

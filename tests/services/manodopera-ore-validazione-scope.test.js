import { describe, it, expect } from 'vitest';
import {
    isLavoroSquadra,
    isLavoroAutonomo,
    isOraDelCaposquadraSuLavoroSquadra,
    oreVisibileInCodaValidazione,
    contaOreManagerDaValidareSuLavoro
} from '../../core/services/manodopera-ore-validazione-scope.js';

const lavoroSquadra = { caposquadraId: 'capo1', operaioId: null };
const lavoroAutonomo = { caposquadraId: null, operaioId: 'op1' };

describe('manodopera-ore-validazione-scope', () => {
    it('classifica lavori squadra e autonomi', () => {
        expect(isLavoroSquadra(lavoroSquadra)).toBe(true);
        expect(isLavoroAutonomo(lavoroAutonomo)).toBe(true);
    });

    it('rileva ore del caposquadra su lavoro di squadra', () => {
        expect(isOraDelCaposquadraSuLavoroSquadra({ operaioId: 'capo1' }, lavoroSquadra)).toBe(true);
        expect(isOraDelCaposquadraSuLavoroSquadra({ operaioId: 'op2' }, lavoroSquadra)).toBe(false);
    });

    it('manager vede ore autonome e ore capo; capo solo operai squadra', () => {
        const oraOperaio = { operaioId: 'op2' };
        const oraCapo = { operaioId: 'capo1' };
        expect(oreVisibileInCodaValidazione({
            oraData: oraOperaio,
            lavoroData: lavoroSquadra,
            userId: 'capo1',
            isCaposquadra: true,
            isManager: false
        })).toBe(true);
        expect(oreVisibileInCodaValidazione({
            oraData: oraCapo,
            lavoroData: lavoroSquadra,
            userId: 'capo1',
            isCaposquadra: true,
            isManager: false
        })).toBe(false);
        expect(oreVisibileInCodaValidazione({
            oraData: oraCapo,
            lavoroData: lavoroSquadra,
            userId: 'mgr1',
            isCaposquadra: false,
            isManager: true
        })).toBe(true);
        expect(oreVisibileInCodaValidazione({
            oraData: { operaioId: 'op1' },
            lavoroData: lavoroAutonomo,
            userId: 'mgr1',
            isCaposquadra: false,
            isManager: true
        })).toBe(true);
    });

    it('conteggio manager include solo ore pertinenti', () => {
        const ore = [
            { stato: 'da_validare', operaioId: 'op1' },
            { stato: 'da_validare', operaioId: 'capo1' },
            { stato: 'validate', operaioId: 'op1' }
        ];
        expect(contaOreManagerDaValidareSuLavoro(lavoroAutonomo, ore)).toBe(1);
        expect(contaOreManagerDaValidareSuLavoro(lavoroSquadra, ore)).toBe(1);
    });
});

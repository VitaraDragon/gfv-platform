/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../core/services/firebase-service.js', () => ({
    serverTimestamp: () => ({ __ts: true })
}));

vi.mock('../../core/services/lavori-service.js', () => ({
    getLavoro: vi.fn(),
    updateLavoro: vi.fn()
}));

vi.mock('../../core/services/manodopera-assenze-service.js', () => ({
    confermaAssenza: vi.fn(),
    collegaAssenzaALavoroStandby: vi.fn(),
    creaAssenzaConfermata: vi.fn(),
    getAssenza: vi.fn(),
    segnalaAssenza: vi.fn()
}));

vi.mock('../../core/services/tenant-service.js', () => ({
    getCurrentTenantId: () => 'tenant-test'
}));

import { getLavoro, updateLavoro } from '../../core/services/lavori-service.js';
import {
    collegaAssenzaALavoroStandby,
    confermaAssenza,
    getAssenza
} from '../../core/services/manodopera-assenze-service.js';
import { confermaAssenzaConStandbyLavori } from '../../core/services/lavoro-standby-assenza-service.js';
import {
    lavoriCandidatiAssenza,
    lavoroIdsDaAssenza,
    lavoroIdsPreselezionatiStandby
} from '../../core/services/assenza-lavori-giorno-logic.js';

const GIORNO = '2026-10-20';
const SQUADRE = [{ id: 'sq', caposquadraId: 'marco', operai: ['ion', 'paolo'] }];

function lavoro(partial) {
    return {
        stato: 'in_corso',
        dataInizio: GIORNO,
        ...partial
    };
}

describe('lavori del giorno per un\'assenza', () => {
    const autonomo = lavoro({ id: 'L239', operaioId: 'ion', caposquadraId: null, nome: 'Autonomo Ion' });
    const squadra = lavoro({ id: 'L222', caposquadraId: 'marco', operaioId: null, nome: 'Squadra Marco' });

    it('per Ion mette l\'autonomo prima della squadra e preseleziona solo l\'autonomo', () => {
        const candidati = lavoriCandidatiAssenza({
            operaioId: 'ion',
            giornoKey: GIORNO,
            lavori: [squadra, autonomo],
            squadre: SQUADRE
        });
        expect(candidati.map((item) => item.id)).toEqual(['L239', 'L222']);
        expect(lavoroIdsPreselezionatiStandby(candidati)).toEqual(['L239']);
        expect(lavoroIdsDaAssenza({ lavoroIds: ['L239'], lavoroId: 'L222' })).toEqual(['L239', 'L222']);
    });

    it('esclude un lavoro futuro', () => {
        const futuro = lavoro({ id: 'Lfut', operaioId: 'ion', dataInizio: '2099-01-01', stato: 'assegnato' });
        const candidati = lavoriCandidatiAssenza({
            operaioId: 'ion',
            giornoKey: GIORNO,
            lavori: [autonomo, futuro],
            squadre: SQUADRE
        });
        expect(candidati.map((item) => item.id)).toEqual(['L239']);
    });

    it('esclude un lavoro completato', () => {
        const fatto = lavoro({ id: 'Ldone', operaioId: 'ion', stato: 'completato', dataInizio: '2026-10-01' });
        const candidati = lavoriCandidatiAssenza({
            operaioId: 'ion',
            giornoKey: GIORNO,
            lavori: [fatto, squadra],
            squadre: SQUADRE
        });
        expect(candidati.map((item) => item.id)).toEqual(['L222']);
    });

    it('esclude il lavoro di un altro operaio', () => {
        const diPaolo = lavoro({ id: 'Lpaolo', operaioId: 'paolo' });
        const candidati = lavoriCandidatiAssenza({
            operaioId: 'ion',
            giornoKey: GIORNO,
            lavori: [diPaolo, autonomo],
            squadre: SQUADRE
        });
        expect(candidati.map((item) => item.id)).toEqual(['L239']);
    });

    it('usa il roster materializzato del giorno', () => {
        const daRoster = lavoro({
            id: 'Lrost',
            caposquadraId: 'marco',
            stato: 'assegnato',
            equipaggioGiorno: {
                [GIORNO]: {
                    materializzatoIl: '2026-10-20T06:00:00.000Z',
                    partecipazioni: [{ operaioId: 'ion', stato: 'previsto', origine: 'squadra' }]
                }
            }
        });
        const candidati = lavoriCandidatiAssenza({
            operaioId: 'ion',
            giornoKey: GIORNO,
            lavori: [daRoster],
            squadre: []
        });
        expect(candidati.map((item) => item.id)).toEqual(['Lrost']);
    });

    it('legge un Timestamp di Firestore', () => {
        const seconds = Math.floor(new Date(2026, 9, 20, 9, 30).getTime() / 1000);
        const conToDate = lavoro({
            id: 'Lto',
            operaioId: 'ion',
            dataInizio: { toDate: () => new Date(2026, 9, 20, 9, 30) }
        });
        const conSeconds = lavoro({
            id: 'Lsec',
            operaioId: 'ion',
            dataInizio: { seconds }
        });
        expect(lavoriCandidatiAssenza({
            operaioId: 'ion',
            giornoKey: GIORNO,
            lavori: [conToDate],
            squadre: []
        }).map((item) => item.id)).toEqual(['Lto']);
        expect(lavoriCandidatiAssenza({
            operaioId: 'ion',
            giornoKey: GIORNO,
            lavori: [conSeconds],
            squadre: []
        }).map((item) => item.id)).toEqual(['Lsec']);
    });
});

describe('conferma assenza con standby solo sui lavori scelti', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getAssenza.mockResolvedValue({
            id: 'A1',
            operaioId: 'ion',
            tipo: 'malattia',
            nota: '',
            dataInizioGiorno: GIORNO,
            stato: 'segnalata'
        });
        getLavoro.mockImplementation(async (id) => ({ id, stato: 'in_corso', operaioId: 'ion' }));
        updateLavoro.mockResolvedValue(undefined);
        confermaAssenza.mockResolvedValue(undefined);
        collegaAssenzaALavoroStandby.mockResolvedValue(undefined);
    });

    it('con zero lavori conferma una volta e non mette niente in standby', async () => {
        const esito = await confermaAssenzaConStandbyLavori({
            assenzaId: 'A1',
            lavoroIds: [],
            managerId: 'mgr'
        });
        expect(esito.lavoroIds).toEqual([]);
        expect(confermaAssenza).toHaveBeenCalledTimes(1);
        expect(updateLavoro).not.toHaveBeenCalled();
    });

    it('con due lavori conferma una volta e mette in standby solo quelli', async () => {
        const esito = await confermaAssenzaConStandbyLavori({
            assenzaId: 'A1',
            lavoroIds: ['L239', 'L222'],
            managerId: 'mgr'
        });
        expect(esito.lavoroIds).toEqual(['L239', 'L222']);
        expect(confermaAssenza).toHaveBeenCalledTimes(1);
        expect(updateLavoro).toHaveBeenCalledTimes(2);
        expect(updateLavoro.mock.calls.map((call) => call[0])).toEqual(['L239', 'L222']);
        expect(collegaAssenzaALavoroStandby).toHaveBeenCalledTimes(2);
    });
});

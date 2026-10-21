/**
 * @vitest-environment node
 *
 * Banner «assenze da gestire» (Gestione lavori e Impegni giornalieri):
 * la fonte dei lavori in standby è il lavoro (standbyAssenzaId), non standbyLavoroId dell'assenza.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    getAllLavori: vi.fn(),
    getAssenza: vi.fn(),
    listAssenzeApertePerGiorno: vi.fn()
}));

vi.mock('../../core/services/lavori-service.js', () => ({
    getAllLavori: mocks.getAllLavori
}));

vi.mock('../../core/services/manodopera-assenze-service.js', () => ({
    getAssenza: mocks.getAssenza,
    listAssenzeApertePerGiorno: mocks.listAssenzeApertePerGiorno
}));

import {
    assenzaDaGestireNelBanner,
    lavoriStandbyPerAssenza,
    lavoroDaAprireDaDeepLink,
    righeBannerAssenze,
    MSG_STANDBY_NON_VERIFICATO
} from '../../core/services/assenze-banner-logic.js';
import { caricaAssenzeDaGestire } from '../../core/services/assenze-banner-service.js';

const OGGI = '2026-10-21';
const IERI = '2026-10-20';

function confermata(extra = {}) {
    return {
        id: 'A1',
        operaioId: 'ion',
        stato: 'confermata',
        tipo: 'malattia',
        dataInizioGiorno: OGGI,
        dataFineGiorno: OGGI,
        standbyLavoroId: null,
        sostitutoOperaioId: null,
        ...extra
    };
}

describe('assenze-banner-logic', () => {
    it('lavoriStandbyPerAssenza raggruppa i lavori in standby per standbyAssenzaId', () => {
        const map = lavoriStandbyPerAssenza([
            { id: 'L1', nome: 'Vigna', stato: 'in_standby', standbyAssenzaId: 'A1' },
            { id: 'L2', nome: 'Oliveto', stato: 'in_standby', standbyAssenzaId: 'A1' },
            { id: 'L3', stato: 'in_corso', standbyAssenzaId: 'A1' },
            { id: 'L4', stato: 'in_standby', standbyAssenzaId: null },
            null
        ]);
        expect(map.get('A1')).toEqual([
            { id: 'L1', nome: 'Vigna' },
            { id: 'L2', nome: 'Oliveto' }
        ]);
        expect(map.size).toBe(1);
    });

    it('segnalata sempre; confermata finché ha lavori in standby', () => {
        expect(assenzaDaGestireNelBanner({ stato: 'segnalata' }, [])).toBe(true);
        expect(assenzaDaGestireNelBanner(confermata(), [{ id: 'L1' }])).toBe(true);
        expect(assenzaDaGestireNelBanner(confermata(), [])).toBe(false);
        // Con sostituto su un lavoro ma un altro ancora in standby: resta
        expect(assenzaDaGestireNelBanner(confermata({ sostitutoOperaioId: 'marco' }), [{ id: 'L1' }])).toBe(true);
        expect(assenzaDaGestireNelBanner({ stato: 'annullata' }, [{ id: 'L1' }])).toBe(false);
        expect(assenzaDaGestireNelBanner(null, [])).toBe(false);
    });

    it('standbyLavoroId vecchio non conta: senza lavori in standby l\'assenza esce', () => {
        expect(assenzaDaGestireNelBanner(confermata({ standbyLavoroId: 'L2' }), [])).toBe(false);
    });

    it('senza lista (lettura fallita): confermata senza sostituto resta, con sostituto no', () => {
        expect(assenzaDaGestireNelBanner(confermata(), null)).toBe(true);
        expect(assenzaDaGestireNelBanner(confermata({ standbyLavoroId: null }), undefined)).toBe(true);
        expect(assenzaDaGestireNelBanner(confermata({ sostitutoOperaioId: 'marco' }), null)).toBe(false);
    });

    it('righeBannerAssenze non duplica e allega i lavori in standby', () => {
        const map = new Map([['A1', [{ id: 'L1', nome: 'Vigna' }]]]);
        const rows = righeBannerAssenze({
            aperte: [confermata(), { id: 'S1', stato: 'segnalata' }],
            assenzeDaStandby: [confermata()],
            standbyPerAssenza: map
        });
        expect(rows.map((r) => [r.id, r.lavoriInStandby.map((l) => l.id)])).toEqual([
            ['A1', ['L1']],
            ['S1', []]
        ]);
    });

    it('lavoroDaAprireDaDeepLink: il richiesto se ancora in standby, altrimenti il primo', () => {
        const lista = [{ id: 'L1' }, { id: 'L2' }];
        expect(lavoroDaAprireDaDeepLink(lista, 'L2')).toBe('L2');
        expect(lavoroDaAprireDaDeepLink(lista, 'L9')).toBe('L1');
        expect(lavoroDaAprireDaDeepLink(lista)).toBe('L1');
        expect(lavoroDaAprireDaDeepLink([], 'L2')).toBeNull();
        expect(lavoroDaAprireDaDeepLink(null, 'L2')).toBe('L2');
        expect(lavoroDaAprireDaDeepLink(null)).toBeNull();
    });

    it('il messaggio d\'errore è quello deciso', () => {
        expect(MSG_STANDBY_NON_VERIFICATO).toBe('Non riesco a controllare i lavori in standby, riprova.');
    });
});

describe('caricaAssenzeDaGestire', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.listAssenzeApertePerGiorno.mockResolvedValue([]);
        mocks.getAssenza.mockResolvedValue(null);
        mocks.getAllLavori.mockResolvedValue([]);
    });

    it('legge i lavori in standby con throwOnError e senza orderBy', async () => {
        await caricaAssenzeDaGestire(OGGI);
        expect(mocks.getAllLavori).toHaveBeenCalledWith({ stato: 'in_standby', orderBy: null, throwOnError: true });
    });

    it('assenza di ieri con un lavoro ancora in standby: entra nel banner', async () => {
        mocks.getAllLavori.mockResolvedValue([
            { id: 'L1', nome: 'Vigna', stato: 'in_standby', standbyAssenzaId: 'A-ieri' }
        ]);
        mocks.getAssenza.mockResolvedValue(confermata({ id: 'A-ieri', dataInizioGiorno: IERI, dataFineGiorno: IERI }));
        const { rows, standbyVerificato } = await caricaAssenzeDaGestire(OGGI);
        expect(standbyVerificato).toBe(true);
        expect(mocks.getAssenza).toHaveBeenCalledWith('A-ieri');
        expect(rows.map((r) => [r.id, r.lavoriInStandby.map((l) => l.id)])).toEqual([['A-ieri', ['L1']]]);
    });

    it('sostituto scelto su un lavoro, l\'altro ancora in standby: l\'assenza resta con quel lavoro', async () => {
        // listAssenzeApertePerGiorno la toglie perché ha sostitutoOperaioId
        mocks.getAllLavori.mockResolvedValue([
            { id: 'L1', nome: 'Vigna', stato: 'in_standby', standbyAssenzaId: 'A1' }
        ]);
        mocks.getAssenza.mockResolvedValue(confermata({ standbyLavoroId: 'L2', sostitutoOperaioId: 'marco' }));
        const { rows } = await caricaAssenzeDaGestire(OGGI);
        expect(rows.map((r) => [r.id, r.lavoriInStandby.map((l) => l.id)])).toEqual([['A1', ['L1']]]);
    });

    it('confermata di oggi con standbyLavoroId vecchio ma nessun lavoro in standby: fuori', async () => {
        mocks.listAssenzeApertePerGiorno.mockResolvedValue([
            confermata({ standbyLavoroId: 'L2' }),
            { id: 'S1', operaioId: 'ana', stato: 'segnalata', dataInizioGiorno: OGGI }
        ]);
        const { rows } = await caricaAssenzeDaGestire(OGGI);
        expect(rows.map((r) => r.id)).toEqual(['S1']);
    });

    it('lettura dei lavori fallita: confermate del giorno visibili e standbyVerificato false', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.getAllLavori.mockRejectedValue(new Error('offline'));
        mocks.listAssenzeApertePerGiorno.mockResolvedValue([
            confermata(),
            { id: 'S1', operaioId: 'ana', stato: 'segnalata', dataInizioGiorno: OGGI }
        ]);
        const { rows, standbyVerificato } = await caricaAssenzeDaGestire(OGGI);
        expect(standbyVerificato).toBe(false);
        expect(rows.map((r) => r.id)).toEqual(['A1', 'S1']);
        expect(mocks.getAssenza).not.toHaveBeenCalled();
    });
});

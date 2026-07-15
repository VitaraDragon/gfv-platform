import { describe, it, expect } from 'vitest';
import {
    destinatariIncludesUser,
    confermeIncludesUser,
    formatComunicazioneLuogo,
    formatComunicazioneTesto,
    comunicazioneVisibilePerOperaio,
    normalizeDestinatariIds,
    formatManodoperaDisplayName,
    indexManodoperaUserInMap,
    getManodoperaDisplayNameFromMap,
    countConfermePendentiInvio,
    partitionComunicazioniRicevuteOperaio,
    partitionComunicazioniInviateCapo,
    isComunicazioneInviataInEvidenzaCapo,
} from '../../core/services/comunicazioni-squadra-utils.js';

describe('comunicazioni-squadra-utils', () => {
    const authUser = { uid: 'firebase-uid-1' };
    const userData = { id: 'doc-id-1', uid: 'firebase-uid-1' };

    it('destinatariIncludesUser accetta uid o userData.id', () => {
        expect(destinatariIncludesUser(['doc-id-1'], authUser, userData)).toBe(true);
        expect(destinatariIncludesUser(['firebase-uid-1'], authUser, userData)).toBe(true);
        expect(destinatariIncludesUser(['altro'], authUser, userData)).toBe(false);
    });

    it('confermeIncludesUser legge userId nelle conferme', () => {
        const conferme = [{ userId: 'firebase-uid-1', timestamp: new Date() }];
        expect(confermeIncludesUser(conferme, authUser, userData)).toBe(true);
    });

    it('formatComunicazioneLuogo preferisce podere/terreno o lavoroNome', () => {
        expect(formatComunicazioneLuogo({ podere: 'P1', terreno: 'T1' })).toBe('P1 - T1');
        expect(formatComunicazioneLuogo({ lavoroNome: 'Potatura nord' })).toBe('Potatura nord');
    });

    it('formatComunicazioneTesto usa messaggio o note', () => {
        expect(formatComunicazioneTesto({ messaggio: 'Iniziamo alle 7' })).toBe('Iniziamo alle 7');
        expect(formatComunicazioneTesto({ note: 'Portare guanti' })).toBe('Portare guanti');
    });

    it('normalizeDestinatariIds accetta stringhe e oggetti legacy', () => {
        expect(normalizeDestinatariIds(['uid-1', { id: 'uid-2' }])).toEqual(['uid-1', 'uid-2']);
    });

    it('comunicazioneVisibilePerOperaio con destinatari vuoti usa caposquadra', () => {
        const comm = { caposquadraId: 'capo-1', destinatari: [], stato: 'attiva' };
        expect(comunicazioneVisibilePerOperaio(comm, authUser, userData, 'capo-1')).toBe(true);
        expect(comunicazioneVisibilePerOperaio(comm, authUser, userData, 'altro-capo')).toBe(false);
    });

    it('comunicazioneVisibilePerOperaio con lavoroId nei lavori operaio', () => {
        const comm = { lavoroId: 'lav-99', destinatari: [] };
        expect(comunicazioneVisibilePerOperaio(comm, authUser, userData, [], ['lav-99'])).toBe(true);
        expect(comunicazioneVisibilePerOperaio(comm, authUser, userData, [], ['lav-altro'])).toBe(false);
    });

    it('formatManodoperaDisplayName e lookup caposquadra per uid', () => {
        expect(formatManodoperaDisplayName({ nome: 'Mario', cognome: 'Rossi' })).toBe('Mario Rossi');
        const map = new Map();
        indexManodoperaUserInMap(map, 'doc-capo', {
            nome: 'Luca',
            cognome: 'Bianchi',
            uid: 'firebase-capo'
        });
        expect(getManodoperaDisplayNameFromMap(map, 'firebase-capo')).toBe('Luca Bianchi');
        expect(getManodoperaDisplayNameFromMap(map, 'doc-capo')).toBe('Luca Bianchi');
    });

    it('partitionComunicazioniRicevuteOperaio separa pending e history per data desc', () => {
        const rows = [
            { id: 'a', haConfermato: false, dataCom: new Date('2026-07-10') },
            { id: 'b', haConfermato: true, dataCom: new Date('2026-07-12') },
            { id: 'c', haConfermato: false, dataCom: new Date('2026-07-11') },
        ];
        const { pending, history } = partitionComunicazioniRicevuteOperaio(rows);
        expect(pending.map((r) => r.id)).toEqual(['c', 'a']);
        expect(history.map((r) => r.id)).toEqual(['b']);
    });

    it('isComunicazioneInviataInEvidenzaCapo con conferme pendenti o invio legacy recente', () => {
        const now = new Date('2026-07-12T12:00:00');
        expect(isComunicazioneInviataInEvidenzaCapo({
            stato: 'attiva',
            destinatari: ['op-1', 'op-2'],
            conferme: [{ userId: 'op-1' }],
        }, now)).toBe(true);
        expect(isComunicazioneInviataInEvidenzaCapo({
            stato: 'attiva',
            destinatari: ['op-1'],
            conferme: [{ userId: 'op-1' }],
        }, now)).toBe(false);
        expect(isComunicazioneInviataInEvidenzaCapo({
            stato: 'attiva',
            destinatari: [],
            createdAt: { toDate: () => new Date('2026-07-10') },
        }, now)).toBe(true);
        expect(countConfermePendentiInvio({
            destinatari: ['a', 'b'],
            conferme: [{ userId: 'a' }],
        })).toBe(1);
    });

    it('partitionComunicazioniInviateCapo separa evidenza e storico', () => {
        const now = new Date('2026-07-12T12:00:00');
        const rows = [
            { id: '1', stato: 'attiva', destinatari: ['a'], conferme: [], createdAt: { toDate: () => new Date('2026-07-11') } },
            { id: '2', stato: 'attiva', destinatari: ['a'], conferme: [{ userId: 'a' }], createdAt: { toDate: () => new Date('2026-07-10') } },
        ];
        const { inEvidenza, storico } = partitionComunicazioniInviateCapo(rows, now);
        expect(inEvidenza.map((r) => r.id)).toEqual(['1']);
        expect(storico.map((r) => r.id)).toEqual(['2']);
    });
});

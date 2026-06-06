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
    getManodoperaDisplayNameFromMap
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
});

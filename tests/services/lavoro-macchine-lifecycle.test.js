import { describe, it, expect } from 'vitest';
import {
    LAVORO_STATI_CHE_RISERVANO_MACCHINA,
    lavoroStatoRiservaMacchine,
    collectMacchineIdsDaLavoriCheRiservano,
    collectMacchineIdsDaLavoriInCorso,
} from '../../core/services/lavoro-macchine-lifecycle-utils.js';

describe('lavoro-macchine-lifecycle', () => {
    it('lavoroStatoRiservaMacchine: sospeso e in_standby non riservano', () => {
        expect(lavoroStatoRiservaMacchine('in_corso')).toBe(true);
        expect(lavoroStatoRiservaMacchine('assegnato')).toBe(true);
        expect(lavoroStatoRiservaMacchine('da_pianificare')).toBe(true);
        expect(lavoroStatoRiservaMacchine('sospeso')).toBe(false);
        expect(lavoroStatoRiservaMacchine('in_standby')).toBe(false);
        expect(lavoroStatoRiservaMacchine('completato')).toBe(false);
    });

    it('collectMacchineIdsDaLavoriInCorso esclude sospeso e assegnato', () => {
        const lavori = [
            { id: 'a', stato: 'in_corso', macchinaId: 'tr1' },
            { id: 'b', stato: 'sospeso', macchinaId: 'tr2' },
            { id: 'c', stato: 'assegnato', macchinaId: 'tr3' },
        ];
        const { macchine } = collectMacchineIdsDaLavoriInCorso(lavori);
        expect(Array.from(macchine)).toEqual(['tr1']);
    });

    it('collectMacchineIdsDaLavoriCheRiservano rispetta excludeLavoroId', () => {
        const lavori = [
            { id: 'a', stato: 'in_corso', macchinaId: 'tr1' },
        ];
        const { macchine } = collectMacchineIdsDaLavoriCheRiservano(lavori, 'a');
        expect(macchine.size).toBe(0);
    });

    it('LAVORO_STATI_CHE_RISERVANO_MACCHINA contiene solo stati operativi', () => {
        expect(LAVORO_STATI_CHE_RISERVANO_MACCHINA).toEqual(['assegnato', 'in_corso', 'da_pianificare']);
    });
});

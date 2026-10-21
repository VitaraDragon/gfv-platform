/**
 * Stato progresso (In ritardo / In tempo / In anticipo): il giorno corrente non conta come già consumato.
 * Un lavoro iniziato oggi con durata 1 e niente fatto è «in tempo», non «in ritardo 1/1 giorni».
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calcolaStatoProgresso } from '../core/admin/js/gestione-lavori-utils.js';

const TERRENO = { superficie: 1 };
const giorno = (a, m, g) => new Date(a, m - 1, g);

function alle(ore, minuti) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, ore, minuti));
}

describe('calcolaStatoProgresso, oggi 21/10/2026', () => {
    afterEach(() => vi.useRealTimers());

    it('iniziato oggi, durata 1, niente fatto: in tempo (anche subito dopo mezzanotte)', () => {
        alle(13, 48);
        expect(calcolaStatoProgresso({ dataInizio: giorno(2026, 10, 21), durataPrevista: 1 }, TERRENO)).toBe('in_tempo');
        alle(0, 30);
        expect(calcolaStatoProgresso({ dataInizio: giorno(2026, 10, 21), durataPrevista: 1 }, TERRENO)).toBe('in_tempo');
    });

    it('iniziato oggi, durata 9, niente fatto: in tempo', () => {
        alle(13, 48);
        expect(calcolaStatoProgresso({ dataInizio: giorno(2026, 10, 21), durataPrevista: 9 }, TERRENO)).toBe('in_tempo');
    });

    it('iniziato ieri, durata 1, niente fatto: in ritardo', () => {
        alle(13, 48);
        expect(calcolaStatoProgresso({ dataInizio: giorno(2026, 10, 20), durataPrevista: 1 }, TERRENO)).toBe('in_ritardo');
    });

    it('iniziato ieri, durata 3: in tempo con un terzo fatto, in ritardo con niente fatto', () => {
        alle(13, 48);
        const lavoro = { dataInizio: giorno(2026, 10, 20), durataPrevista: 3 };
        expect(calcolaStatoProgresso({ ...lavoro, superficieTotaleLavorata: 0.34 }, TERRENO)).toBe('in_tempo');
        expect(calcolaStatoProgresso(lavoro, TERRENO)).toBe('in_ritardo');
    });

    it('iniziato oggi, durata 2, già metà fatta: in anticipo', () => {
        alle(13, 48);
        expect(calcolaStatoProgresso({ dataInizio: giorno(2026, 10, 21), durataPrevista: 2, superficieTotaleLavorata: 0.5 }, TERRENO)).toBe('in_anticipo');
    });

    it('inizia domani: nessuno stato', () => {
        alle(13, 48);
        expect(calcolaStatoProgresso({ dataInizio: giorno(2026, 10, 22), durataPrevista: 1 }, TERRENO)).toBe(null);
    });
});

describe('stessa formula in tutte le copie', () => {
    // Le copie che contano oggi (+1) usano giorniEffettivi − 1 per il tempo consumato.
    // lavori-caposquadra :3208 conta già senza +1 (valore salvato) e resta com'è.
    it('ogni copia con +1 usa giorniEffettivi − 1', async () => {
        const { readFileSync } = await import('node:fs');
        const { join } = await import('node:path');
        const root = join(__dirname, '..');
        const attese = {
            'core/admin/js/gestione-lavori-utils.js': 1,
            'core/admin/js/gestione-lavori-controller.js': 2,
            'core/admin/lavori-caposquadra-standalone.html': 1,
            'core/js/dashboard-maps.js': 1
        };
        for (const [f, n] of Object.entries(attese)) {
            const src = readFileSync(join(root, f), 'utf8');
            const trovate = src.match(/percentualeTempo = \(\((lavoro\.)?giorniEffettivi - 1\) \//g) || [];
            expect(trovate.length, f).toBe(n);
        }
    });
});

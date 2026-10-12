import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/services/firebase-service.js', () => ({
    collection: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
}));

import {
    FINESTRA_ORE_IN_RITARDO_GIORNI,
    lavoroSelezionabilePerOre,
    messaggioOreFuoriFinestra,
    suffissoEtichettaLavoroOre,
    componiEtichettaLavoroOre,
} from '../../core/services/ore-lavoro-selezionabile.js';
import { isLavoroInDropdownSegnaOre } from '../../core/services/manodopera-lavori-scope.js';

const OGGI = new Date(2026, 9, 11);
const RUOLI = ['operaio', 'caposquadra', 'manager'];

function ts(date) {
    return { toDate: () => date };
}

const NON_COMPLETATI = [
    { nome: 'da_pianificare senza data', lavoro: { stato: 'da_pianificare' } },
    { nome: 'da_pianificare data passata', lavoro: { stato: 'da_pianificare', dataInizio: new Date(2026, 9, 1), durataPrevista: 30 } },
    { nome: 'da_pianificare futura', lavoro: { stato: 'da_pianificare', dataInizio: new Date(2026, 10, 1) } },
    { nome: 'da_pianificare finestra gia passata', lavoro: { stato: 'da_pianificare', dataInizio: new Date(2026, 8, 1), durataPrevista: 5 } },
    { nome: 'assegnato', lavoro: { stato: 'assegnato' } },
    { nome: 'assegnato imminente', lavoro: { stato: 'assegnato', dataInizio: new Date(2026, 9, 20) } },
    { nome: 'assegnato oltre 14 giorni', lavoro: { stato: 'assegnato', dataInizio: new Date(2026, 11, 1) } },
    { nome: 'in_corso', lavoro: { stato: 'in_corso' } },
    { nome: 'sospeso', lavoro: { stato: 'sospeso' } },
    { nome: 'in_standby', lavoro: { stato: 'in_standby' } },
    { nome: 'annullato', lavoro: { stato: 'annullato' } },
    { nome: 'stato mancante', lavoro: { nome: 'senza stato' } },
    { nome: 'ripresa da sospensione', lavoro: { stato: 'assegnato', ripresaDaLavoroId: 's1', dataInizio: new Date(2026, 0, 1), durataPrevista: 2 } },
];

describe('lavoroSelezionabilePerOre — stati non completati, stessa regola del dropdown', () => {
    it.each(RUOLI)('ruolo %s: menu e salvataggio uguali a isLavoroInDropdownSegnaOre', (ruolo) => {
        for (const caso of NON_COMPLETATI) {
            const atteso = isLavoroInDropdownSegnaOre(caso.lavoro, OGGI);
            const menu = lavoroSelezionabilePerOre({ lavoro: caso.lavoro, ruolo, oggi: OGGI });
            const salva = lavoroSelezionabilePerOre({
                lavoro: caso.lavoro,
                ruolo,
                oggi: OGGI,
                giorno: '2026-10-11'
            });
            expect(menu.ok, caso.nome).toBe(atteso);
            expect(salva.ok, `${caso.nome} salvataggio`).toBe(atteso);
        }
    });

    it('ruolo sconosciuto è sempre false, anche su un lavoro in corso', () => {
        for (const ruolo of ['admin', 'amministratore', '', undefined]) {
            const esito = lavoroSelezionabilePerOre({
                lavoro: { stato: 'in_corso' },
                ruolo,
                oggi: OGGI
            });
            expect(esito.ok).toBe(false);
            expect(esito.motivo).toBe('Non puoi segnare ore su questo lavoro.');
        }
    });

    it('sospeso resta bloccato in menu e in salvataggio per ogni ruolo', () => {
        for (const ruolo of RUOLI) {
            const menu = lavoroSelezionabilePerOre({ lavoro: { stato: 'sospeso' }, ruolo, oggi: OGGI });
            const salva = lavoroSelezionabilePerOre({
                lavoro: { stato: 'sospeso' },
                ruolo,
                oggi: OGGI,
                giorno: '2026-10-11'
            });
            expect(menu.ok).toBe(false);
            expect(salva.ok).toBe(false);
            expect(menu.motivo).toContain('sospeso');
            expect(salva.motivo).toContain('sospeso');
        }
    });
});

describe('lavoroSelezionabilePerOre — completato e in attesa', () => {
    const chiusoOggi = { stato: 'completato', completatoIl: new Date(2026, 9, 11), dataInizio: new Date(2026, 9, 1) };
    const attesaOggi = { stato: 'completato_da_approvare', completatoIl: new Date(2026, 9, 11), dataInizio: new Date(2026, 9, 1) };
    const chiuso7 = { stato: 'completato', completatoIl: new Date(2026, 9, 4), dataInizio: new Date(2026, 9, 1) };
    const chiuso8 = { stato: 'completato', completatoIl: new Date(2026, 9, 3), dataInizio: new Date(2026, 8, 1) };

    it('la finestra è 7 giorni', () => {
        expect(FINESTRA_ORE_IN_RITARDO_GIORNI).toBe(7);
    });

    it.each(RUOLI)('menu: completato oggi / 7 giorni fa sì, 8 giorni fa o senza data no (%s)', (ruolo) => {
        expect(lavoroSelezionabilePerOre({ lavoro: chiusoOggi, ruolo, oggi: OGGI }).ok).toBe(true);
        expect(lavoroSelezionabilePerOre({ lavoro: attesaOggi, ruolo, oggi: OGGI }).ok).toBe(true);
        expect(lavoroSelezionabilePerOre({ lavoro: chiuso7, ruolo, oggi: OGGI }).ok).toBe(true);
        expect(lavoroSelezionabilePerOre({ lavoro: chiuso8, ruolo, oggi: OGGI }).ok).toBe(false);
        expect(lavoroSelezionabilePerOre({
            lavoro: { stato: 'completato_da_approvare' },
            ruolo,
            oggi: OGGI
        }).ok).toBe(false);
    });

    it('i tre ruoli danno lo stesso esito sul completato', () => {
        const visti = RUOLI.map((ruolo) => lavoroSelezionabilePerOre({
            lavoro: chiuso7,
            ruolo,
            oggi: OGGI,
            giorno: '2026-10-04'
        }).ok);
        expect(new Set(visti).size).toBe(1);
        expect(visti[0]).toBe(true);
    });

    it('salvataggio: giorno del completamento, il giorno prima, il giorno dopo, il futuro, prima dell’inizio', () => {
        const lavoro = {
            stato: 'completato_da_approvare',
            completatoIl: new Date(2026, 9, 10),
            dataInizio: new Date(2026, 9, 4)
        };
        const casi = [
            ['2026-10-10', true],
            ['2026-10-09', true],
            ['2026-10-11', false],
            ['2026-10-12', false],
            ['2026-10-03', false],
        ];
        for (const [giorno, atteso] of casi) {
            const esito = lavoroSelezionabilePerOre({ lavoro, ruolo: 'operaio', oggi: OGGI, giorno });
            expect(esito.ok, giorno).toBe(atteso);
        }
        expect(lavoroSelezionabilePerOre({
            lavoro,
            ruolo: 'caposquadra',
            oggi: OGGI,
            giorno: '2026-10-11'
        }).motivo).toContain('solo i giorni fino a quella data');
        expect(lavoroSelezionabilePerOre({
            lavoro: { ...lavoro, completatoIl: new Date(2026, 9, 11) },
            ruolo: 'manager',
            oggi: OGGI,
            giorno: '2026-10-12'
        }).motivo).toBe('Non puoi segnare ore per un giorno futuro.');
        expect(lavoroSelezionabilePerOre({
            lavoro,
            ruolo: 'operaio',
            oggi: OGGI,
            giorno: '2026-10-03'
        }).motivo).toContain('data di inizio');
    });

    it('fuori finestra: messaggio di blocco, anche se il giorno è quello del completamento', () => {
        const esito = lavoroSelezionabilePerOre({
            lavoro: chiuso8,
            ruolo: 'operaio',
            oggi: OGGI,
            giorno: '2026-10-03'
        });
        expect(esito.ok).toBe(false);
        expect(esito.motivo).toBe(messaggioOreFuoriFinestra(chiuso8.completatoIl));
        expect(esito.motivo).toBe('Il lavoro è stato completato il 03/10: le ore si possono segnare fino a 7 giorni dopo il completamento e per i giorni lavorati. Chiedi al caposquadra o al manager.');
    });

    it('completatoIl come Date, toDate() e stringa ISO', () => {
        const giornoIso = '2026-10-11T12:00:00.000Z';
        const varianti = [
            new Date(2026, 9, 11),
            ts(new Date(2026, 9, 11)),
            '2026-10-11',
            giornoIso
        ];
        for (const completatoIl of varianti) {
            const menu = lavoroSelezionabilePerOre({
                lavoro: { stato: 'completato', completatoIl, dataInizio: '2026-10-01' },
                ruolo: 'operaio',
                oggi: OGGI
            });
            const salva = lavoroSelezionabilePerOre({
                lavoro: { stato: 'completato', completatoIl, dataInizio: ts(new Date(2026, 9, 1)) },
                ruolo: 'manager',
                oggi: OGGI,
                giorno: new Date(2026, 9, 11)
            });
            expect(menu.ok, String(completatoIl)).toBe(true);
            expect(salva.ok, String(completatoIl)).toBe(true);
        }
    });

    it('completatoIl assente o non valido non viene indovinato', () => {
        for (const completatoIl of [null, undefined, '', 'non-una-data', {}, { toDate: () => new Date('x') }]) {
            const esito = lavoroSelezionabilePerOre({
                lavoro: { stato: 'completato', completatoIl },
                ruolo: 'caposquadra',
                oggi: OGGI
            });
            expect(esito.ok).toBe(false);
        }
    });

    it('senza dataInizio il giorno del completamento resta valido', () => {
        const esito = lavoroSelezionabilePerOre({
            lavoro: { stato: 'completato', completatoIl: new Date(2026, 9, 11) },
            ruolo: 'operaio',
            oggi: OGGI,
            giorno: '2026-10-11'
        });
        expect(esito.ok).toBe(true);
        expect(esito.motivo).toBe('');
    });
});

describe('etichetta lavoro ore', () => {
    it('accoda il testo solo per i chiusi', () => {
        expect(suffissoEtichettaLavoroOre('completato')).toBe(' — completato');
        expect(suffissoEtichettaLavoroOre('completato_da_approvare')).toBe(' — in attesa approvazione');
        expect(suffissoEtichettaLavoroOre('in_corso')).toBe('');
        expect(suffissoEtichettaLavoroOre('sospeso')).toBe('');
    });

    it('compone nome, terreno e stato', () => {
        expect(componiEtichettaLavoroOre({
            nome: 'Potatura',
            terrenoNome: 'Pinot',
            stato: 'completato'
        })).toBe('Potatura - Pinot — completato');
        expect(componiEtichettaLavoroOre({
            tipoLavoro: 'Legatura',
            stato: 'completato_da_approvare'
        })).toBe('Legatura — in attesa approvazione');
        expect(componiEtichettaLavoroOre({ nome: 'Potatura', stato: 'assegnato' })).toBe('Potatura');
    });
});

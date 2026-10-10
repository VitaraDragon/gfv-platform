import { describe, it, expect } from 'vitest';
import {
    puoAprireSegnalazioneGuasti,
    ritornoWorkspaceCampoDaGuasti,
    hrefRitornoSegnalazioneGuasti,
    etichettaRitornoSegnalazioneGuasti,
    primoTenantIdUtente,
    testoOpzioneTrattore,
    deveTentareSospensioneLavoroGuasto,
    esitoSegnalazioneGuasto,
    testoConfermaSegnalazione,
} from '../core/js/field-guasti-access.js';
import {
    voceCambiaAziendaVisibile,
    vociMenuCampo,
    ritornoValidazioneOre,
    menuCampoAbilitato,
} from '../core/mobile/js/field-menu-visibility.js';

describe('segnalazione guasti — profilo campo', () => {
    it('operaio e caposquadra possono aprire la pagina', () => {
        expect(puoAprireSegnalazioneGuasti(['operaio'])).toBe(true);
        expect(puoAprireSegnalazioneGuasti(['caposquadra'])).toBe(true);
        expect(puoAprireSegnalazioneGuasti(['manager', 'caposquadra'])).toBe(true);
    });

    it('manager e admin, anche con ruolo campo, non sono profilo campo puro', () => {
        expect(puoAprireSegnalazioneGuasti(['manager'])).toBe(false);
        expect(ritornoWorkspaceCampoDaGuasti(['manager', 'operaio'])).toBe(false);
        expect(puoAprireSegnalazioneGuasti([])).toBe(false);
        expect(puoAprireSegnalazioneGuasti(['contabile'])).toBe(false);
    });

    it('capo dal desktop torna in dashboard', () => {
        expect(etichettaRitornoSegnalazioneGuasti(['caposquadra'])).toBe('← Dashboard');
        expect(hrefRitornoSegnalazioneGuasti(['caposquadra'])).toMatch(/dashboard-standalone\.html/);
    });

    it('capo da from=field torna al campo', () => {
        expect(etichettaRitornoSegnalazioneGuasti(['Caposquadra'], null, 'field')).toBe('← Campo');
        expect(hrefRitornoSegnalazioneGuasti(['caposquadra'], null, 'field')).toMatch(/field-workspace-standalone\.html/);
        expect(etichettaRitornoSegnalazioneGuasti(['caposquadra'], null, 'mobile')).toBe('← Campo');
    });

    it('manager con from=field torna in dashboard', () => {
        expect(etichettaRitornoSegnalazioneGuasti(['manager', 'caposquadra'], null, 'field')).toBe('← Dashboard');
        expect(hrefRitornoSegnalazioneGuasti(['manager', 'operaio'], null, 'field')).toMatch(/dashboard-standalone\.html/);
        expect(hrefRitornoSegnalazioneGuasti(['amministratore', 'caposquadra'], null, 'mobile')).toMatch(/dashboard-standalone\.html/);
    });

    it('operaio da desktop torna in dashboard', () => {
        expect(etichettaRitornoSegnalazioneGuasti(['operaio'])).toBe('← Dashboard');
        expect(hrefRitornoSegnalazioneGuasti(['operaio'], null, '')).toMatch(/dashboard-standalone\.html/);
    });

    it('risolve il tenant dalla membership se manca tenantId', () => {
        expect(primoTenantIdUtente({ tenantId: 'az-a' })).toBe('az-a');
        expect(primoTenantIdUtente({
            tenantMemberships: {
                'az-b': { stato: 'attivo' },
                'az-c': { stato: 'sospeso' },
            },
        })).toBe('az-b');
        expect(primoTenantIdUtente(null)).toBeNull();
    });

    it('select trattore: messaggio se non ce ne sono', () => {
        expect(testoOpzioneTrattore(0)).toBe('Nessun trattore disponibile');
        expect(testoOpzioneTrattore(2)).toBe('-- Seleziona trattore --');
    });

    it('sospende il lavoro solo se è del caposquadra o se l’utente è manager', () => {
        const suo = { caposquadraId: 'capo-1' };
        expect(deveTentareSospensioneLavoroGuasto({
            ruoli: ['caposquadra'], uid: 'capo-1', lavoro: suo,
        })).toBe(true);
        expect(deveTentareSospensioneLavoroGuasto({
            ruoli: ['caposquadra'], uid: 'capo-2', lavoro: suo,
        })).toBe(false);
        expect(deveTentareSospensioneLavoroGuasto({
            ruoli: ['operaio'], uid: 'op-1', lavoro: { operaioId: 'op-1' },
        })).toBe(false);
        expect(deveTentareSospensioneLavoroGuasto({
            ruoli: ['manager'], uid: 'mgr-1', lavoro: suo,
        })).toBe(true);
    });
});

describe('esitoSegnalazioneGuasto', () => {
    it('principale ok e secondaria negata: chiude con avviso', () => {
        const esito = esitoSegnalazioneGuasto({
            scritturaPrincipaleOk: true,
            secondarie: [{ nome: 'macchina', ok: false, errore: 'Missing or insufficient permissions' }],
        });
        expect(esito.chiudi).toBe(true);
        expect(esito.successo).toBe(true);
        expect(esito.errore).toBeNull();
        expect(esito.avvisi).toEqual([
            'Non ho potuto aggiornare lo stato della macchina/il lavoro: avvisa il tuo responsabile.',
        ]);
    });

    it('principale ko: errore, il form resta aperto', () => {
        const esito = esitoSegnalazioneGuasto({
            scritturaPrincipaleOk: false,
            secondarie: [{ nome: 'principale', ok: false, errore: 'Missing or insufficient permissions' }],
        });
        expect(esito.chiudi).toBe(false);
        expect(esito.successo).toBe(false);
        expect(esito.avvisi).toEqual([]);
        expect(esito.errore).toBe('Missing or insufficient permissions');
    });

    it('tutto ok: chiude senza avvisi', () => {
        const esito = esitoSegnalazioneGuasto({
            scritturaPrincipaleOk: true,
            secondarie: [{ nome: 'lavoro', ok: true }],
        });
        expect(esito).toEqual({ chiudi: true, successo: true, avvisi: [], errore: null });
    });
});

describe('testoConfermaSegnalazione', () => {
    it('dal campo torna da solo; con avviso resta e offre il pulsante', () => {
        expect(testoConfermaSegnalazione({ dalCampo: true, haAvvisi: false })).toEqual({
            titolo: 'Segnalazione inviata. Grazie.',
            dettaglio: 'Torno al workspace…',
            tornaAutomatico: true,
            mostraTornaWorkspace: false,
        });
        const conAvviso = testoConfermaSegnalazione({ dalCampo: true, haAvvisi: true });
        expect(conAvviso.tornaAutomatico).toBe(false);
        expect(conAvviso.mostraTornaWorkspace).toBe(true);
        expect(testoConfermaSegnalazione({ dalCampo: false, haAvvisi: false }).dettaglio)
            .toContain('I Miei Guasti Segnalati');
    });
});

describe('menu campo', () => {
    it('voceCambiaAziendaVisibile solo da due aziende', () => {
        expect(voceCambiaAziendaVisibile(0)).toBe(false);
        expect(voceCambiaAziendaVisibile(1)).toBe(false);
        expect(voceCambiaAziendaVisibile(2)).toBe(true);
        expect(voceCambiaAziendaVisibile(null)).toBe(false);
    });

    it('vociMenuCampo: operaio, capo, operaio+capo, manager', () => {
        expect(vociMenuCampo({ ruoli: ['operaio'], moduli: ['manodopera'], numeroAziende: 1 })).toEqual({
            validazioneOre: false,
            segnalaGuasto: false,
            cambiaAzienda: false,
        });
        expect(vociMenuCampo({
            ruoli: ['caposquadra'],
            moduli: ['manodopera', 'parcoMacchine'],
            numeroAziende: 2,
        })).toEqual({
            validazioneOre: true,
            segnalaGuasto: true,
            cambiaAzienda: true,
        });
        expect(vociMenuCampo({
            ruoli: ['operaio', 'caposquadra'],
            moduli: ['parcoMacchine'],
            numeroAziende: 1,
        }).validazioneOre).toBe(true);
        expect(vociMenuCampo({
            ruoli: ['manager', 'operaio'],
            moduli: ['parcoMacchine'],
            numeroAziende: 2,
        }).validazioneOre).toBe(false);
        expect(vociMenuCampo({ ruoli: ['operaio'], moduli: [], numeroAziende: 3 }).segnalaGuasto).toBe(false);
    });

    it('ritornoValidazioneOre', () => {
        expect(ritornoValidazioneOre({ da: 'field', ruoli: ['caposquadra'] })).toEqual({
            etichetta: '← Campo',
            href: '../mobile/field-workspace-standalone.html',
        });
        expect(ritornoValidazioneOre({ ruoli: ['operaio'] }).etichetta).toBe('← Campo');
        expect(ritornoValidazioneOre({ da: 'field', ruoli: ['manager', 'caposquadra'] })).toEqual({
            etichetta: '← Dashboard',
            href: '../dashboard-standalone.html',
        });
        expect(ritornoValidazioneOre({ ruoli: ['manager'] })).toEqual({
            etichetta: '← Dashboard',
            href: '../dashboard-standalone.html',
        });
        expect(ritornoValidazioneOre({ da: 'field', ruoli: ['manager'] }).href).toBe('../dashboard-standalone.html');
        expect(ritornoValidazioneOre({ ruoli: ['caposquadra'] })).toEqual({
            etichetta: '← Campo',
            href: '../mobile/field-workspace-standalone.html',
        });
        expect(ritornoValidazioneOre({ da: 'field', ruoli: ['operaio'] }).etichetta).toBe('← Campo');
        expect(ritornoValidazioneOre({ ruoloSingolo: 'caposquadra' }).etichetta).toBe('← Campo');
        expect(ritornoValidazioneOre({ da: 'field', ruoli: ['amministratore', 'caposquadra'] }).etichetta).toBe('← Dashboard');
    });

    it('menuCampoAbilitato', () => {
        expect(menuCampoAbilitato(false)).toBe(false);
        expect(menuCampoAbilitato(undefined)).toBe(false);
        expect(menuCampoAbilitato(true)).toBe(true);
    });
});

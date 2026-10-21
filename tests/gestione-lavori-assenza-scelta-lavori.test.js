/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getAllLavori: vi.fn(),
    getLavoro: vi.fn(),
    getAssenza: vi.fn(),
    listAssenzeSegnalate: vi.fn(),
    listAssenzeApertePerGiorno: vi.fn(),
    findAssenzaSegnalataPerLavoro: vi.fn(),
    findAssenzaSegnalataPerOperaio: vi.fn(),
    confermaAssenzaConStandbyLavori: vi.fn(),
    confermaSegnalazioneEStandby: vi.fn(),
    mettiLavoroInStandbyPerAssenza: vi.fn(),
    riportaLavoroDaStandbyAssenza: vi.fn(),
    markAssenzaNotificationsSeen: vi.fn()
}));

vi.mock('../core/services/lavori-service.js', () => ({
    getAllLavori: mocks.getAllLavori,
    getLavoro: mocks.getLavoro
}));

vi.mock('../core/services/manodopera-assenze-service.js', () => ({
    getAssenza: mocks.getAssenza,
    listAssenzeSegnalate: mocks.listAssenzeSegnalate,
    listAssenzeApertePerGiorno: mocks.listAssenzeApertePerGiorno,
    findAssenzaSegnalataPerLavoro: mocks.findAssenzaSegnalataPerLavoro,
    findAssenzaSegnalataPerOperaio: mocks.findAssenzaSegnalataPerOperaio
}));

vi.mock('../core/services/lavoro-standby-assenza-service.js', () => ({
    confermaAssenzaConStandbyLavori: mocks.confermaAssenzaConStandbyLavori,
    confermaSegnalazioneEStandby: mocks.confermaSegnalazioneEStandby,
    mettiLavoroInStandbyPerAssenza: mocks.mettiLavoroInStandbyPerAssenza,
    riportaLavoroDaStandbyAssenza: mocks.riportaLavoroDaStandbyAssenza
}));

vi.mock('../core/services/notification-events-client.js', () => ({
    markAssenzaNotificationsSeen: mocks.markAssenzaNotificationsSeen
}));

vi.mock('../core/js/standalone-alert.js', () => ({
    showStandaloneAlert: vi.fn()
}));

import {
    confermaSegnalazioneStandby,
    initGestioneLavoriAssenzeUi,
    refreshAssenzeSegnalateBanner,
    submitStandbyAssenzaModal
} from '../core/admin/js/gestione-lavori-assenze-ui.js';

const GIORNO = '2026-10-20';

function montaModale() {
    document.body.innerHTML = `
        <div id="assenze-segnalate-banner" hidden></div>
        <div id="standby-assenza-modal" class="modal">
            <h3 id="standby-assenza-modal-title"></h3>
            <input id="standby-assenza-lavoro-id">
            <input id="standby-assenza-assenza-id">
            <p id="standby-assenza-info"></p>
            <div id="standby-assenza-lavori" hidden></div>
            <div id="standby-assenza-form-wrap"></div>
            <button type="button" id="standby-assenza-submit-btn"></button>
            <button type="button" id="standby-assenza-ripristina-btn"></button>
            <select id="assenza-tipo"></select>
            <select id="assenza-operaio"></select>
            <input id="assenza-giorno">
            <textarea id="assenza-nota"></textarea>
        </div>
    `;
}

describe('scelta lavori in standby per un\'assenza segnalata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        montaModale();
        mocks.getAllLavori.mockResolvedValue([
            { id: 'L222', nome: 'Squadra', caposquadraId: 'marco', stato: 'in_corso', dataInizio: GIORNO },
            { id: 'L239', nome: 'Autonomo Ion', operaioId: 'ion', stato: 'in_corso', dataInizio: GIORNO }
        ]);
        mocks.getAssenza.mockResolvedValue({
            id: 'A1',
            operaioId: 'ion',
            stato: 'segnalata',
            tipo: 'malattia',
            tipoLabel: 'Malattia',
            dataInizioGiorno: GIORNO,
            lavoroId: 'L222'
        });
        mocks.listAssenzeSegnalate.mockResolvedValue([]);
        mocks.listAssenzeApertePerGiorno.mockResolvedValue([]);
        mocks.confermaAssenzaConStandbyLavori.mockResolvedValue({ assenzaId: 'A1', lavoroIds: [] });
        initGestioneLavoriAssenzeUi({
            getCurrentUserData: () => ({ id: 'mgr' }),
            getOperaiList: () => [{ id: 'ion', nome: 'Ion', cognome: 'Rossi' }],
            getSquadreList: () => [{ caposquadraId: 'marco', operai: ['ion'] }],
            reloadLavori: vi.fn()
        });
    });

    it('mostra l\'autonomo spuntato e la squadra no', async () => {
        await confermaSegnalazioneStandby('A1', 'L222');
        const caselle = Array.from(document.querySelectorAll('#standby-assenza-lavori input[type="checkbox"]'));
        expect(caselle.map((input) => [input.value, input.checked])).toEqual([
            ['L239', true],
            ['L222', false]
        ]);
        expect(document.getElementById('standby-assenza-lavori').textContent)
            .toContain('prosegue senza di lui se non lo selezioni');
    });

    it('la conferma usa i lavori scelti e non il vecchio standby del lavoro di contesto', async () => {
        await confermaSegnalazioneStandby('A1', 'L222');
        await submitStandbyAssenzaModal();
        expect(mocks.confermaAssenzaConStandbyLavori).toHaveBeenCalledWith({
            assenzaId: 'A1',
            lavoroIds: ['L239'],
            managerId: 'mgr'
        });
        expect(mocks.confermaSegnalazioneEStandby).not.toHaveBeenCalled();
        expect(mocks.mettiLavoroInStandbyPerAssenza).not.toHaveBeenCalled();
    });

    it('il manager può spuntare anche la squadra', async () => {
        await confermaSegnalazioneStandby('A1');
        const squadra = document.querySelector('#standby-assenza-lavori input[value="L222"]');
        squadra.checked = true;
        await submitStandbyAssenzaModal();
        expect(mocks.confermaAssenzaConStandbyLavori).toHaveBeenCalledWith({
            assenzaId: 'A1',
            lavoroIds: ['L239', 'L222'],
            managerId: 'mgr'
        });
    });

    it('il banner offre Conferma e standby anche senza lavoroId', async () => {
        mocks.listAssenzeSegnalate.mockResolvedValue([{
            id: 'A1',
            operaioId: 'ion',
            stato: 'segnalata',
            tipo: 'malattia',
            tipoLabel: 'Malattia',
            dataInizioGiorno: GIORNO,
            lavoroId: null
        }]);
        await refreshAssenzeSegnalateBanner();
        const html = document.getElementById('assenze-segnalate-banner').innerHTML;
        expect(html).toContain('Conferma e standby');
        expect(html).toContain("confermaSegnalazioneStandby('A1')");
        expect(html).not.toContain("confermaSegnalazioneStandby('A1',");
    });
});

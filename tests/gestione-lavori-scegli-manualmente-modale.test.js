/**
 * @vitest-environment jsdom
 * Gestione lavori → «Assegna sostituto» → «Scegli manualmente…»: il modale roster ha i suoi stili
 * anche fuori da Impegni giornalieri, e la × (o il clic sullo sfondo) lo toglie dal DOM.
 * Il messaggio dopo l'assegnazione non ha genere: «Sostituto assegnato: Nome Cognome».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const showAlert = vi.fn();
const assegnaSostitutoDaStandby = vi.fn();

vi.mock('../core/admin/js/gestione-lavori-utils.js', async (importOriginal) => ({
    ...(await importOriginal()),
    showAlert: (...args) => showAlert(...args)
}));
vi.mock('../core/services/manodopera-sostituti-shortlist-service.js', () => ({
    DISPONIBILITA_IMPEGNATO: 'impegnato',
    DISPONIBILITA_SPOSTABILE: 'spostabile',
    DISPONIBILITA_LIBERO: 'libero',
    buildShortlistSostitutiPerLavoroStandby: vi.fn(async () => ({
        lavoroNome: 'Vendemmia',
        giornoKey: '2026-10-21',
        assenteOperaioId: 'op-assente',
        requiredSkillIds: [],
        equipaggioMinimo: null,
        isLavoroSquadra: false,
        equipaggioCheck: null,
        tuttiQualificati: 1,
        shortlist: [{
            operaioId: 'op-ff',
            nome: 'Francesca Fontana',
            disponibilita: 'libero',
            stelleDisplay: '★★★',
            motivo: 'libera oggi'
        }]
    }))
}));
vi.mock('../core/services/lavoro-sostituzione-assenza-service.js', () => ({
    assegnaSostitutoDaStandby: (...args) => assegnaSostitutoDaStandby(...args)
}));
vi.mock('../core/admin/js/gestione-lavori-assenze-ui.js', () => ({
    refreshAssenzeSegnalateBanner: vi.fn(async () => {})
}));
vi.mock('../core/services/manodopera-roster-giorno-service.js', () => ({
    aggiungiPartecipazioneRosterGiorno: vi.fn(async () => {}),
    rimuoviPartecipazioneRosterGiorno: vi.fn(async () => {}),
    ensureRosterGiornoPersisted: vi.fn(async () => {}),
    getEquipaggioSlice: vi.fn(() => ({ partecipazioni: [] }))
}));
vi.mock('../core/services/lavori-service.js', () => ({
    getLavoro: vi.fn(async () => ({ id: 'L1' }))
}));

const {
    initGestioneLavoriSostitutiUi,
    openSostitutoAssenzaModal
} = await import('../core/admin/js/gestione-lavori-sostituti-ui.js');

// Il modale di Gestione lavori, come in core/admin/gestione-lavori-standalone.html.
function montaPagina() {
    document.head.innerHTML = '';
    document.body.innerHTML = `
        <div id="sostituto-assenza-modal" class="modal">
            <div class="modal-content">
                <input type="hidden" id="sostituto-assenza-lavoro-id">
                <p id="sostituto-assenza-info"></p>
                <div id="sostituto-equipaggio-banner"></div>
                <div id="sostituto-shortlist"></div>
                <button type="button" id="sostituto-scegli-manualmente">Scegli manualmente…</button>
            </div>
        </div>`;
}

const attendi = () => new Promise((r) => setTimeout(r, 0));

async function apriSceltaManuale() {
    await openSostitutoAssenzaModal('L1');
    document.getElementById('sostituto-scegli-manualmente').click();
    await attendi();
    await attendi();
    return document.getElementById('roster-edit-modal');
}

describe('Gestione lavori: modale «Scegli manualmente…»', () => {
    beforeEach(() => {
        montaPagina();
        showAlert.mockReset();
        assegnaSostitutoDaStandby.mockReset();
        initGestioneLavoriSostitutiUi({
            getOperaiList: () => [],
            getSquadreList: () => [],
            getAttrezziList: () => [],
            getCurrentUserData: () => ({ id: 'manager-1' }),
            reloadLavori: vi.fn(async () => {})
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('si apre con i suoi stili e chiude il modale della shortlist', async () => {
        const modale = await apriSceltaManuale();
        expect(modale).not.toBeNull();
        expect(modale.classList.contains('active')).toBe(true);
        expect(document.getElementById('sostituto-assenza-modal').classList.contains('active')).toBe(false);
        const stile = document.getElementById('roster-edit-modal-style');
        expect(stile).not.toBeNull();
        expect(stile.textContent).toContain('.roster-edit-modal.active { display: flex; }');
        expect(getComputedStyle(modale).position).toBe('fixed');
    });

    it('la × toglie il modale dal DOM, senza residui', async () => {
        await apriSceltaManuale();
        document.getElementById('roster-edit-close').click();
        expect(document.getElementById('roster-edit-modal')).toBeNull();
        expect(document.querySelectorAll('.roster-edit-dialog').length).toBe(0);
    });

    it('il clic sullo sfondo lo chiude; riaprendo c\'è un solo modale e un solo stile', async () => {
        const modale = await apriSceltaManuale();
        modale.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.getElementById('roster-edit-modal')).toBeNull();

        await apriSceltaManuale();
        expect(document.querySelectorAll('#roster-edit-modal').length).toBe(1);
        expect(document.querySelectorAll('#roster-edit-close').length).toBe(1);
        expect(document.querySelectorAll('#roster-edit-modal-style').length).toBe(1);
        document.getElementById('roster-edit-close').click();
        expect(document.getElementById('roster-edit-modal')).toBeNull();
    });

    it('il clic dentro il dialogo non lo chiude', async () => {
        await apriSceltaManuale();
        document.getElementById('roster-edit-hint').click();
        expect(document.getElementById('roster-edit-modal')).not.toBeNull();
    });
});

describe('Gestione lavori: messaggio dopo l\'assegnazione del sostituto', () => {
    beforeEach(() => {
        montaPagina();
        showAlert.mockReset();
        assegnaSostitutoDaStandby.mockReset();
        assegnaSostitutoDaStandby.mockResolvedValue({ doppioMovimento: false, isLavoroSquadra: false });
        initGestioneLavoriSostitutiUi({
            getOperaiList: () => [],
            getSquadreList: () => [],
            getAttrezziList: () => [],
            getCurrentUserData: () => ({ id: 'manager-1' }),
            reloadLavori: vi.fn(async () => {})
        });
        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('forma neutra: «Sostituto assegnato: Francesca Fontana»', async () => {
        await openSostitutoAssenzaModal('L1');
        document.querySelector('.sostituto-card[data-operaio-id="op-ff"]').click();
        await attendi();
        await attendi();
        expect(assegnaSostitutoDaStandby).toHaveBeenCalledTimes(1);
        expect(showAlert).toHaveBeenCalledWith('Sostituto assegnato: Francesca Fontana. Lavoro riattivato.', 'success');
        const testi = showAlert.mock.calls.map((c) => c[0]).join(' ');
        expect(testi).not.toContain('assegnato come sostituto');
    });
});

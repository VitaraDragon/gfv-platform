/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    updateDoc: vi.fn(async () => {}),
    addDoc: vi.fn(async () => ({ id: 'nuovo' })),
    showStandaloneAlert: vi.fn(),
}));

vi.mock('../core/js/standalone-alert.js', () => ({
    showStandaloneAlert: mocks.showStandaloneAlert,
}));

vi.mock('../core/services/firebase-service.js', () => ({
    updateDoc: mocks.updateDoc,
    addDoc: mocks.addDoc,
    doc: (...args) => ({ path: args.map((a) => String(a && a.path ? a.path : a)).join('/') }),
    collection: (...args) => ({ path: args.join('/') }),
    getDoc: async () => ({ exists: () => false, data: () => ({}) }),
    getDocs: async () => ({ forEach() {}, docs: [] }),
    Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
    serverTimestamp: () => ({ server: true }),
    deleteField: () => ({ delete: true }),
    query: (...args) => args,
    where: (...args) => args,
    orderBy: (...args) => args,
}));

vi.mock('../core/services/tenant-service.js', () => ({
    hasModuleAccess: vi.fn(async () => false),
}));

import { populateTrattoriDropdown } from '../core/admin/js/gestione-lavori-controller.js';
import {
    handleSalvaLavoro,
    openCreaModal,
    openModificaModal,
    salvaLavoroInCorsoAttivo,
    setupMacchineHandlers,
} from '../core/admin/js/gestione-lavori-events.js';

function cssModale() {
    const style = document.createElement('style');
    style.textContent = '.modal { display: none; } .modal.active { display: flex; }';
    document.head.appendChild(style);
}

function formLavoro() {
    document.body.innerHTML = `
      <div id="lavoro-modal" class="modal">
        <form id="lavoro-form">
          <h3 id="modal-title"></h3>
          <input id="lavoro-id">
          <input id="lavoro-nome" required minlength="3">
          <select id="lavoro-categoria-principale" required>
            <option value="">—</option>
            <option value="cat1">Potatura</option>
          </select>
          <select id="lavoro-sottocategoria"><option value=""></option></select>
          <div id="lavoro-sottocategoria-group" style="display:none"></div>
          <div id="tipo-lavoro-group">
            <select id="lavoro-tipo-lavoro" required>
              <option value="">—</option>
              <option value="Potatura">Potatura</option>
            </select>
          </div>
          <select id="lavoro-terreno" required>
            <option value="">—</option>
            <option value="ter1">Vigna</option>
          </select>
          <input id="lavoro-data-inizio" type="date" required>
          <input id="lavoro-durata" type="number" required>
          <select id="lavoro-stato">
            <option value="assegnato">Assegnato</option>
            <option value="completato">Completato</option>
            <option value="in_corso">In corso</option>
          </select>
          <textarea id="lavoro-note"></textarea>
          <input type="radio" name="tipo-assegnazione" value="squadra" id="tipo-squadra" checked>
          <input type="radio" name="tipo-assegnazione" value="autonomo" id="tipo-autonomo">
          <select id="lavoro-caposquadra" required>
            <option value="">—</option>
            <option value="capo1">Mario</option>
          </select>
          <div id="operaio-group" style="display:none">
            <select id="lavoro-operaio"><option value=""></option></select>
          </div>
          <select id="lavoro-trattore">
            <option value="">-- Nessun trattore --</option>
            <option value="trattore-vecchio">New Holland</option>
            <option value="trattore-nuovo">Fendt</option>
          </select>
          <div id="attrezzo-group" style="display:none">
            <select id="lavoro-attrezzo"><option value="">-- Nessun attrezzo --</option></select>
          </div>
          <div id="operatore-macchina-group" style="display:none">
            <select id="lavoro-operatore-macchina"><option value=""></option></select>
          </div>
          <div id="nascosto" style="display:none">
            <input id="campo-nascosto" required>
          </div>
          <button type="submit">Salva</button>
        </form>
      </div>
    `;
}

function compila(overrides = {}) {
    const valori = {
        nome: 'Potatura vigna vecchia',
        categoria: 'cat1',
        tipo: 'Potatura',
        terreno: 'ter1',
        data: '2026-09-29',
        durata: '2',
        stato: 'assegnato',
        capo: 'capo1',
        trattore: 'trattore-vecchio',
        note: '',
        ...overrides,
    };
    document.getElementById('lavoro-nome').value = valori.nome;
    document.getElementById('lavoro-categoria-principale').value = valori.categoria;
    document.getElementById('lavoro-tipo-lavoro').value = valori.tipo;
    document.getElementById('lavoro-terreno').value = valori.terreno;
    document.getElementById('lavoro-data-inizio').value = valori.data;
    document.getElementById('lavoro-durata').value = valori.durata;
    document.getElementById('lavoro-stato').value = valori.stato;
    document.getElementById('lavoro-caposquadra').value = valori.capo;
    document.getElementById('lavoro-trattore').value = valori.trattore;
    document.getElementById('lavoro-note').value = valori.note;
    document.getElementById('lavoro-modal').classList.add('active');
}

function lavoroBase(extra = {}) {
    return {
        id: 'lav1',
        nome: 'Potatura vigna vecchia',
        terrenoId: 'ter1',
        tipoLavoro: 'Potatura',
        stato: 'assegnato',
        durataPrevista: 2,
        dataInizio: new Date(2026, 8, 29, 12, 0, 0, 0),
        caposquadraId: 'capo1',
        operaioId: null,
        macchinaId: 'trattore-vecchio',
        attrezzoId: null,
        operatoreMacchinaId: null,
        note: '',
        ...extra,
    };
}

function stateCon(lavori) {
    return {
        currentLavoroId: lavori[0] ? lavori[0].id : null,
        lavoriList: lavori,
        hasManodoperaModule: true,
        hasParcoMacchineModule: true,
        terreniList: [],
        attrezziList: [],
    };
}

function argsSalva(state, extra = {}) {
    const updateState = (patch) => Object.assign(state, patch);
    const close = () => document.getElementById('lavoro-modal')?.classList.remove('active');
    return [
        { preventDefault() {}, submitter: document.querySelector('#lavoro-form button[type="submit"]') },
        state,
        updateState,
        'tenant-1',
        {},
        { id: 'user-1' },
        extra.close || close,
        extra.loadLavori || (async () => {}),
        async () => {},
        async () => {},
        async () => {},
        async () => {},
        async () => {},
    ];
}

describe('gestione lavori — modale, trattore, Salva', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        cssModale();
        mocks.updateDoc.mockClear();
        mocks.addDoc.mockClear();
        mocks.showStandaloneAlert.mockClear();
    });

    it('openCreaModal: i required visibili non sono disabled, quelli nascosti sì', async () => {
        formLavoro();
        const modal = document.getElementById('lavoro-modal');
        expect(getComputedStyle(modal).display).toBe('none');

        await openCreaModal(
            { currentLavoroId: null },
            () => {},
            false,
            false,
            null, null, null, null, null, null, null, null, null, null
        );

        expect(modal.classList.contains('active')).toBe(true);
        expect(getComputedStyle(modal).display).toBe('flex');
        expect(document.getElementById('lavoro-nome').disabled).toBe(false);
        expect(document.getElementById('lavoro-nome').required).toBe(true);
        expect(document.getElementById('campo-nascosto').disabled).toBe(true);
        expect(document.getElementById('campo-nascosto').required).toBe(false);
    });

    it('openModificaModal non aspetta i 350 ms per riabilitare i required visibili', async () => {
        formLavoro();
        const lavori = [lavoroBase({ stato: 'completato' })];
        await openModificaModal(
            'lav1',
            stateCon(lavori),
            () => {},
            lavori,
            [],
            false,
            false,
            async () => {},
            () => {},
            () => {},
            () => {},
            () => {},
            () => {},
            () => {},
            () => {},
            async () => {},
            () => {},
            () => {},
            () => {},
            () => {}
        );

        const modal = document.getElementById('lavoro-modal');
        expect(modal.classList.contains('active')).toBe(true);
        expect(document.getElementById('lavoro-nome').disabled).toBe(false);
        expect(document.getElementById('campo-nascosto').disabled).toBe(true);
    });

    it('populateTrattoriDropdown due volte senza selectedId conserva il valore', () => {
        formLavoro();
        const select = document.getElementById('lavoro-trattore');
        select.value = 'trattore-nuovo';
        const lista = [
            { id: 'trattore-vecchio', nome: 'New Holland', stato: 'disponibile', cavalli: 100 },
            { id: 'trattore-nuovo', nome: 'Fendt', stato: 'disponibile', cavalli: 120 },
        ];
        populateTrattoriDropdown(lista);
        populateTrattoriDropdown(lista);
        expect(select.value).toBe('trattore-nuovo');
    });

    it('setupMacchineHandlers non perde il trattore già impostato', () => {
        formLavoro();
        const select = document.getElementById('lavoro-trattore');
        select.value = 'trattore-nuovo';
        setupMacchineHandlers(() => {}, () => {});
        setupMacchineHandlers(() => {}, () => {});
        expect(document.getElementById('lavoro-trattore').value).toBe('trattore-nuovo');
        expect(document.getElementById('lavoro-trattore')).toBe(select);
    });

    it('trattore cambiato e poi azzerato da un reload non riscrive il vecchio macchinaId', async () => {
        formLavoro();
        compila();
        const select = document.getElementById('lavoro-trattore');
        select.value = 'trattore-nuovo';
        select.dispatchEvent(new Event('change'));
        setupMacchineHandlers(() => {}, () => {});
        select.value = 'trattore-nuovo';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dataset.userTouched = '1';
        select.dataset.gfvUserValue = 'trattore-nuovo';
        select.value = '';

        const state = stateCon([lavoroBase()]);
        await handleSalvaLavoro(...argsSalva(state));

        expect(mocks.updateDoc).toHaveBeenCalledTimes(1);
        const payload = mocks.updateDoc.mock.calls[0][1];
        expect(payload.macchinaId).toBe('trattore-nuovo');
        expect(mocks.showStandaloneAlert).toHaveBeenCalledWith('Lavoro modificato con successo!', 'success');
    });

    it('payload invariato non mostra il toast di modifica', async () => {
        formLavoro();
        compila();
        const state = stateCon([lavoroBase()]);
        await handleSalvaLavoro(...argsSalva(state));

        expect(mocks.updateDoc).not.toHaveBeenCalled();
        expect(mocks.showStandaloneAlert).toHaveBeenCalledWith('Nessuna modifica da salvare', 'info');
        expect(mocks.showStandaloneAlert).not.toHaveBeenCalledWith('Lavoro modificato con successo!', 'success');
    });

    it('con un reload ancora appeso il secondo Salva parte e il primo non chiude il modale nuovo', async () => {
        formLavoro();
        compila({ note: 'nota nuova' });
        const pendenti = [];
        const loadLavori = () => new Promise((resolve) => pendenti.push(resolve));
        const lavori = [
            lavoroBase(),
            lavoroBase({ id: 'lav2', nome: 'Legatura completata', stato: 'completato', note: '' }),
        ];
        const state = stateCon(lavori);
        const primo = handleSalvaLavoro(...argsSalva(state, { loadLavori }));

        await vi.waitFor(() => {
            expect(mocks.showStandaloneAlert).toHaveBeenCalledWith('Lavoro modificato con successo!', 'success');
        });
        expect(document.getElementById('lavoro-modal').classList.contains('active')).toBe(false);
        expect(salvaLavoroInCorsoAttivo()).toBe(false);

        compila({ nome: 'Legatura completata', stato: 'completato', note: 'dopo' });
        await openModificaModal(
            'lav2',
            state,
            (patch) => Object.assign(state, patch),
            lavori,
            [],
            true,
            true,
            async () => {},
            () => {},
            () => {},
            () => {
                const capo = document.getElementById('lavoro-caposquadra');
                capo.value = 'capo1';
            },
            () => {},
            () => {},
            () => {},
            () => {},
            async () => {},
            () => {},
            () => {},
            () => {},
            (lavoro) => {
                document.getElementById('tipo-squadra').checked = true;
                document.getElementById('lavoro-caposquadra').value = lavoro.caposquadraId;
            }
        );
        expect(document.getElementById('lavoro-modal').classList.contains('active')).toBe(true);
        expect(document.querySelector('#lavoro-form button[type="submit"]').disabled).toBe(false);

        document.getElementById('lavoro-note').value = 'dopo il primo';
        let rilasciaSecondo;
        mocks.updateDoc.mockImplementationOnce(() => new Promise((resolve) => {
            rilasciaSecondo = resolve;
        }));
        const secondo = handleSalvaLavoro(...argsSalva(state, { loadLavori }));
        await vi.waitFor(() => {
            expect(mocks.updateDoc).toHaveBeenCalledTimes(2);
        });

        pendenti.splice(0).forEach((resolve) => resolve());
        await primo;
        await Promise.resolve();
        expect(document.getElementById('lavoro-modal').classList.contains('active')).toBe(true);

        rilasciaSecondo();
        await secondo;
    });

    it('se un salvataggio è ancora in corso, il secondo avvisa invece di uscire in silenzio', async () => {
        formLavoro();
        compila({ note: 'uno' });
        let rilascia;
        mocks.updateDoc.mockImplementationOnce(() => new Promise((resolve) => {
            rilascia = resolve;
        }));
        const state = stateCon([lavoroBase()]);
        const primo = handleSalvaLavoro(...argsSalva(state));
        await vi.waitFor(() => {
            expect(typeof rilascia).toBe('function');
        });
        const secondo = handleSalvaLavoro(...argsSalva(state));
        await secondo;
        expect(mocks.showStandaloneAlert).toHaveBeenCalledWith('Salvataggio precedente ancora in corso…', 'info');
        rilascia();
        await primo;
    });
});

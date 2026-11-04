/**
 * @vitest-environment jsdom
 * Avvio reale del workspace di campo: un ReferenceError (es. hasAnyRoleFn)
 * deve far fallire il test, non restare solo nel sorgente.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    role: 'operaio',
    uid: 'u-operaio',
    cbs: []
}));

vi.mock('../core/services/firebase-service.js', () => ({
    getAuthInstance: () => ({ currentUser: null }),
    getDb: () => ({}),
    getAppInstance: () => ({}),
    onAuthStateChanged: (_auth, cb) => {
        state.cbs.push(cb);
        return () => {};
    },
    getDoc: async (ref) => {
        if (ref && ref.col === 'users') {
            return {
                exists: () => true,
                id: state.uid,
                data: () => ({
                    id: state.uid,
                    nome: 'Ada',
                    cognome: 'Neri',
                    ruoli: [state.role],
                    tenantId: 't1',
                    stato: 'attivo',
                    tenantMemberships: {
                        t1: { stato: 'attivo', ruoli: [state.role], tenantIdPredefinito: true }
                    }
                })
            };
        }
        if (ref && ref.col === 'tenants') {
            return {
                exists: () => true,
                id: 't1',
                data: () => ({
                    plan: 'base',
                    piano: 'base',
                    modules: ['manodopera']
                })
            };
        }
        return { exists: () => false, id: ref && ref.id, data: () => ({}) };
    },
    doc: (_db, col, id) => ({ col, id }),
    collection: () => ({}),
    getDocs: async () => ({ empty: true, docs: [], size: 0, forEach() {} }),
    addDoc: async () => ({}),
    updateDoc: async () => {},
    query: () => ({}),
    where: () => ({}),
    serverTimestamp: () => ({}),
    Timestamp: { now: () => ({}) },
    signOut: async () => {},
    getDocumentData: async () => null
}));

vi.mock('../core/services/auth-service.js', () => ({
    getCurrentUserData: async () => null,
    initializeAuthService: () => {}
}));

vi.mock('../core/mobile/js/pieno-campo-ui.js', () => ({
    syncPienoCampoSection: async () => {},
    testoSegnapostoPieno: () => ''
}));

vi.mock('../core/js/notification-fcm-client.js', () => ({
    startNotificationFcmBackground: () => {}
}));

vi.mock('../core/services/manodopera-lavori-scope.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        fetchLavoriDocumentsForFieldUser: async () => []
    };
});

const HTML = `
    <p id="field-mobile-status"></p>
    <section id="field-swiper">
        <article class="field-slide" data-slide-title="Lavoro"></article>
        <article class="field-slide" data-slide-title="Comunicazioni"></article>
        <article class="field-slide capo-only" data-slide-title="Valida ore"></article>
        <article class="field-slide" data-slide-title="Ore"></article>
        <article class="field-slide" data-slide-title="Guasto"></article>
        <article class="field-slide" data-slide-title="Statistiche"></article>
    </section>
    <div id="slide-dots"></div>
    <section id="inline-team-section" hidden></section>
    <section id="inline-validate-hours-section" hidden></section>
    <section id="inline-segnala-assenza-section" hidden></section>
    <select id="selected-work"></select>
    <select id="quick-work-select"></select>
`;

async function avvia(ruolo) {
    vi.resetModules();
    state.role = ruolo;
    state.uid = ruolo === 'caposquadra' ? 'u-capo' : 'u-operaio';
    state.cbs.length = 0;
    window.GFVStandaloneReady = Promise.resolve();
    document.body.innerHTML = HTML;
    const swiper = document.getElementById('field-swiper');
    swiper.scrollTo = () => {};
    await import('../core/js/dashboard-utils.js');
    await import('../core/mobile/js/field-workspace-controller.js');
    expect(state.cbs.length).toBeGreaterThan(0);
    await state.cbs[state.cbs.length - 1]({ uid: state.uid, email: ruolo + '@example.test' });
}

describe('avvio workspace di campo', () => {
    beforeEach(() => {
        window.GFVStandaloneReady = Promise.resolve();
    });

    it('operaio entra e non vede la squadra', async () => {
        await avvia('operaio');
        expect(document.getElementById('field-mobile-status').textContent).toBe('Workspace mobile attivo.');
        expect(document.getElementById('inline-team-section').hidden).toBe(true);
        expect(document.querySelector('[data-slide-title="Valida ore"]').hidden).toBe(true);
    });

    it('caposquadra entra e vede squadra e valida ore', async () => {
        await avvia('caposquadra');
        expect(document.getElementById('field-mobile-status').textContent).toBe('Workspace mobile attivo.');
        expect(document.getElementById('inline-team-section').hidden).toBe(false);
        expect(document.querySelector('[data-slide-title="Valida ore"]').hidden).toBe(false);
    });
});

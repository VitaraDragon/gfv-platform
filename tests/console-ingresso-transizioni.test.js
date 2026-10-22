/**
 * @vitest-environment jsdom
 */
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ingresso: tempo dalla decisione', () => {
    const ctrl = readFileSync('core/mobile/js/field-workspace-controller.js', 'utf8');
    const dash = readFileSync('core/dashboard-standalone.html', 'utf8');

    it('il workspace consuma il timestamp alla prima lettura (F5 non lo rilegge)', () => {
        const i = ctrl.indexOf("sessionStorage.getItem('gfv_ingresso_deciso_at')");
        const j = ctrl.indexOf("sessionStorage.removeItem('gfv_ingresso_deciso_at')");
        const k = ctrl.indexOf("[ingresso] dalla decisione all");
        expect(i).toBeGreaterThan(0);
        expect(j).toBeGreaterThan(i);
        expect(k).toBeGreaterThan(j);
    });

    it('la dashboard scrive il timestamp solo se manda al workspace', () => {
        expect(dash).toMatch(/fase === 'decisione' && window\.__gfvIngressoScelta === 'workspace'\) sessionStorage\.setItem\('gfv_ingresso_deciso_at'/);
        const scelta = dash.indexOf('window.__gfvIngressoScelta = spiegato.scelta;');
        const log = dash.indexOf("logTempoIngresso('decisione');");
        expect(scelta).toBeGreaterThan(0);
        expect(log).toBeGreaterThan(scelta);
    });
});

describe('ui-pelle: transizione di pagina saltata', () => {
    afterEach(() => {
        document.documentElement.removeAttribute('data-pelle');
    });

    function transizioneFinta() {
        let rifiuta;
        const ready = new Promise((_, reject) => { rifiuta = reject; });
        return {
            ready,
            skipTransition: vi.fn(() => {
                const err = new Error('Transition was skipped. skipTransition() called');
                err.name = 'AbortError';
                rifiuta(err);
            })
        };
    }

    it.each(['pageswap', 'pagereveal'])('%s: salta e non lascia ready rifiutata senza gestione', async (tipo) => {
        await import('../core/js/ui-pelle.js');
        const nonGestite = [];
        const onUnhandled = (reason) => nonGestite.push(reason);
        process.on('unhandledRejection', onUnhandled);
        try {
            const vt = transizioneFinta();
            const ev = new Event(tipo);
            ev.viewTransition = vt;
            window.dispatchEvent(ev);
            expect(vt.skipTransition).toHaveBeenCalledTimes(1);
            await new Promise((r) => setTimeout(r, 20));
            expect(nonGestite).toEqual([]);
        } finally {
            process.off('unhandledRejection', onUnhandled);
        }
    });

    it('con la Proposta accesa non salta la transizione', async () => {
        await import('../core/js/ui-pelle.js');
        document.documentElement.setAttribute('data-pelle', 'proposta');
        const vt = transizioneFinta();
        const ev = new Event('pageswap');
        ev.viewTransition = vt;
        window.dispatchEvent(ev);
        expect(vt.skipTransition).not.toHaveBeenCalled();
    });
});

describe('home Manodopera: dipendenze dei conteggi', () => {
    it('dependencies include auth (loadAffittiUrgentiCountCondiviso legge dependencies.auth.currentUser)', () => {
        const html = readFileSync('modules/manodopera/views/manodopera-home-standalone.html', 'utf8');
        const m = html.match(/const dependencies = \{([^}]*)\};/);
        expect(m).not.toBeNull();
        const chiavi = m[1].split(',').map((s) => s.trim());
        expect(chiavi).toContain('auth');
        expect(html).toMatch(/loadDashboardCountsSnapshot\([^)]*dependencies\)/);
    });
});

describe('barra «nuova versione» nelle pagine dei moduli', () => {
    const versione = readFileSync('core/js/app-update.js', 'utf8').match(/VERSIONE_MODULO = '([^']+)'/)[1];
    // Pagine pubbliche o senza login: non registrano il worker da qui.
    const ESCLUSE_MODULI = new Set(['modules/conto-terzi/views/accetta-preventivo-standalone.html']);
    const paginaModuli = readdirSync('modules', { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .flatMap((d) => {
            const dir = `modules/${d.name}/views`;
            try {
                return readdirSync(dir).filter((n) => n.endsWith('-standalone.html')).map((n) => `${dir}/${n}`);
            } catch (e) {
                return [];
            }
        })
        .filter((f) => !ESCLUSE_MODULI.has(f));
    const pagineCore = [
        'core/admin/abbonamento-standalone.html',
        'core/admin/amministrazione-standalone.html',
        'core/admin/compensi-operai-standalone.html',
        'core/admin/gestione-guasti-standalone.html',
        'core/admin/gestione-lavori-standalone.html',
        'core/admin/gestione-macchine-standalone.html',
        'core/admin/gestione-operai-standalone.html',
        'core/admin/gestione-squadre-standalone.html',
        'core/admin/gestisci-utenti-standalone.html',
        'core/admin/lavori-caposquadra-standalone.html',
        'core/admin/report-standalone.html',
        'core/admin/statistiche-manodopera-standalone.html',
        'core/admin/validazione-ore-standalone.html',
        'core/mappa-aziendale-standalone.html',
        'core/mobile/statistiche-lavoratore-standalone.html'
    ];
    const pagine = [...pagineCore, ...paginaModuli];

    it('elenca tutte le pagine dei moduli', () => {
        expect(paginaModuli.length).toBeGreaterThanOrEqual(50);
        expect(pagine).toContain('modules/manodopera/views/manodopera-home-standalone.html');
    });

    it.each(pagine)('%s importa app-update.js una volta, con il ?v= corrente, e registra il worker', (f) => {
        const html = readFileSync(f, 'utf8');
        const imp = html.match(/app-update\.js\?v=([^'"]+)['"]/g) || [];
        expect(imp).toEqual([`app-update.js?v=${versione}'`]);
        expect(html).toContain('registraServiceWorker(swPath)');
        const su = '../'.repeat(f.split('/').length - 1);
        expect(html).toContain(`: '${su}service-worker.js'`);
    });

    it('nelle pagine che finiscono anche in iframe registra solo da pagina principale', () => {
        for (const f of ['core/admin/lavori-caposquadra-standalone.html', 'core/mobile/statistiche-lavoratore-standalone.html']) {
            expect(readFileSync(f, 'utf8')).toContain('if (window.self === window.top) registraServiceWorker(swPath);');
        }
    });
});

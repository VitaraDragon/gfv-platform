/**
 * Dashboard: attesa di Tony per il briefing (scheduleTonyDashboardDeferred in dashboard-standalone.html).
 * Se Tony diventa pronto durante l'attesa, l'evento tony-widget-ready fa partire il briefing; il polling
 * deve fermarsi lì. Prima continuava fino a 60 tentativi (30 s) e scriveva
 * «[Tony] briefing dashboard: timeout attesa Tony.isReady()» anche a briefing già partito.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(__dirname, '../core/dashboard-standalone.html'), 'utf8');

function estraiFunzione(nome) {
    const inizio = html.indexOf(`function ${nome}(`);
    if (inizio < 0) throw new Error(`${nome} non trovata`);
    let i = html.indexOf('{', inizio);
    let profondita = 0;
    for (; i < html.length; i++) {
        if (html[i] === '{') profondita++;
        else if (html[i] === '}') {
            profondita--;
            if (profondita === 0) return html.slice(inizio, i + 1);
        }
    }
    throw new Error(`${nome}: fine non trovata`);
}

function preparaPagina() {
    const listeners = {};
    const win = {
        Tony: null,
        addEventListener: (tipo, fn) => { (listeners[tipo] = listeners[tipo] || []).push(fn); },
        dispatch(tipo) {
            const fns = listeners[tipo] || [];
            listeners[tipo] = [];
            fns.forEach((fn) => fn());
        },
    };
    const avvii = [];
    const warn = vi.fn();
    const corpo = estraiFunzione('scheduleTonyDashboardDeferred');
    const crea = new Function(
        'window', 'console', 'dashboardPerfAsync', 'loadTonyVignetoContext', 'checkGlobalStatus', 'getDashboardCountsSnapshot', 'requestIdleCallback',
        `${corpo.replace(/\bTony\.isReady\(\)/g, 'window.Tony.isReady()')}
         return scheduleTonyDashboardDeferred;`
    );
    const schedule = crea(
        win,
        { warn, log() {}, info() {} },
        (_l, fn) => Promise.resolve().then(fn),
        async () => { avvii.push('vigneto'); },
        async () => { avvii.push('briefing'); },
        () => null,
        (fn) => setTimeout(fn, 0)
    );
    return { win, avvii, warn, schedule };
}

afterEach(() => {
    vi.useRealTimers();
});

describe('dashboard: attesa Tony per il briefing', () => {
    it('Tony pronto dopo 10 s (evento tony-widget-ready): briefing una volta e nessun timeout falso', async () => {
        vi.useFakeTimers();
        const p = preparaPagina();
        p.schedule(['tony'], { ruoli: ['manager'] }, 'T1');
        await vi.advanceTimersByTimeAsync(10000);
        expect(p.avvii).toEqual([]);
        p.win.Tony = { isReady: () => true };
        p.win.dispatch('tony-widget-ready');
        await vi.advanceTimersByTimeAsync(60000);
        expect(p.avvii.filter((a) => a === 'briefing')).toHaveLength(1);
        expect(p.warn).not.toHaveBeenCalled();
    });

    it('Tony già pronto: briefing subito, una volta', async () => {
        vi.useFakeTimers();
        const p = preparaPagina();
        p.win.Tony = { isReady: () => true };
        p.schedule(['tony'], { ruoli: ['manager'] }, 'T1');
        await vi.advanceTimersByTimeAsync(60000);
        expect(p.avvii.filter((a) => a === 'briefing')).toHaveLength(1);
        expect(p.warn).not.toHaveBeenCalled();
    });

    it('Tony pronto dopo 45 s: dopo il timeout l\'evento fa comunque partire il briefing', async () => {
        vi.useFakeTimers();
        const p = preparaPagina();
        p.schedule(['tony'], { ruoli: ['manager'] }, 'T1');
        await vi.advanceTimersByTimeAsync(45000);
        expect(p.warn).toHaveBeenCalledTimes(1);
        p.win.Tony = { isReady: () => true };
        p.win.dispatch('tony-widget-ready');
        await vi.advanceTimersByTimeAsync(1000);
        expect(p.avvii.filter((a) => a === 'briefing')).toHaveLength(1);
    });
});

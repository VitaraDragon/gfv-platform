/**
 * service-worker.js: una navigazione senza copia in cache non si annulla dopo ABORT_RETE_MS.
 * Prima l'annullo a 8 s rifiutava respondWith → «FetchEvent … network error», pagina chrome-error
 * («AbortError: signal is aborted without reason» a service-worker.js, riga di controllo.abort()).
 * Gli altri file senza versione restano annullabili come prima.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const ROOT = resolve(__dirname, '..');
const ORIGINE = 'https://vitaradragon.github.io';
const BASE = ORIGINE + '/gfv-platform';

afterEach(() => {
    vi.useRealTimers();
});

/** Carica service-worker.js in una sandbox con cache vuote e fetch lento (risponde dopo rispostaDopoMs). */
function caricaWorker(rispostaDopoMs) {
    const handlers = {};
    const chiamate = [];
    const cacheVuota = { match: async () => undefined, put: async () => {} };
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout, clearTimeout, URL, AbortController, Promise,
        caches: { keys: async () => [], open: async () => cacheVuota, delete: async () => true },
        fetch: (request, opzioni = {}) => {
            const voce = { url: request.url, opzioni, annullata: false };
            chiamate.push(voce);
            return new Promise((ok, ko) => {
                const t = setTimeout(() => ok({ status: 200, type: 'basic', clone() { return this; }, url: request.url }), rispostaDopoMs);
                if (opzioni.signal) {
                    opzioni.signal.addEventListener('abort', () => {
                        voce.annullata = true;
                        clearTimeout(t);
                        const e = new Error('signal is aborted without reason');
                        e.name = 'AbortError';
                        ko(e);
                    });
                }
            });
        },
    };
    // Nel worker self === globalThis: sw-strategy.js pubblica GFVSwStrategy lì.
    Object.assign(sandbox, {
        location: { href: BASE + '/service-worker.js', origin: ORIGINE },
        addEventListener: (tipo, fn) => { handlers[tipo] = fn; },
        registration: {},
        clients: { claim: async () => {} },
        skipWaiting: async () => {},
    });
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.importScripts = () => {
        vm.runInContext(readFileSync(resolve(ROOT, 'sw-strategy.js'), 'utf8'), ctx);
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(readFileSync(resolve(ROOT, 'service-worker.js'), 'utf8'), ctx);
    return { handlers, chiamate, sandbox };
}

function eventoFetch(url, mode, accept) {
    let promessa = null;
    return {
        evento: {
            request: { method: 'GET', url, mode, headers: { get: (h) => (h === 'accept' ? accept : null) } },
            respondWith: (p) => { promessa = Promise.resolve(p); },
        },
        risposta: () => promessa,
    };
}

describe('service-worker.js: navigazioni lente senza cache', () => {
    it('la navigazione aspetta la rete oltre ABORT_RETE_MS e risponde con la pagina', async () => {
        vi.useFakeTimers();
        const w = caricaWorker(12000);
        expect(w.sandbox.GFVSwStrategy.ABORT_RETE_MS).toBe(8000);
        const f = eventoFetch(BASE + '/core/mappa-aziendale-standalone.html', 'navigate', 'text/html');
        w.handlers.fetch(f.evento);
        let esito = null;
        f.risposta().then((r) => { esito = { ok: r }; }, (e) => { esito = { errore: e }; });
        await vi.advanceTimersByTimeAsync(9000);
        expect(esito).toBeNull();
        expect(w.chiamate).toHaveLength(1);
        expect(w.chiamate[0].opzioni.signal).toBeUndefined();
        expect(w.chiamate[0].opzioni.cache).toBe('no-cache');
        await vi.advanceTimersByTimeAsync(4000);
        expect(esito && esito.ok && esito.ok.status).toBe(200);
    });

    it('un file senza versione (non navigazione) resta annullato dopo ABORT_RETE_MS, come prima', async () => {
        vi.useFakeTimers();
        const w = caricaWorker(12000);
        const f = eventoFetch(BASE + '/core/config/tony-routes.json', 'cors', '*/*');
        w.handlers.fetch(f.evento);
        let esito = null;
        f.risposta().then((r) => { esito = { ok: r }; }, (e) => { esito = { errore: e }; });
        await vi.advanceTimersByTimeAsync(8100);
        expect(w.chiamate[0].annullata).toBe(true);
        expect(esito && esito.errore && esito.errore.name).toBe('AbortError');
    });
});

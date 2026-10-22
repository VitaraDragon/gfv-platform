import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let S;
beforeAll(async () => {
    await import('../sw-strategy.js');
    S = globalThis.GFVSwStrategy;
});

afterEach(() => {
    vi.useRealTimers();
});

const ORIGINE = 'https://vitaradragon.github.io';
const BASE = ORIGINE + '/gfv-platform';

function classifica(url, extra = {}) {
    return S.classificaRichiesta({ method: 'GET', url, mode: 'cors', accept: '*/*', origineSw: ORIGINE, ...extra });
}

function risposta(nome) {
    return { nome, clone() { return { nome: nome + '-copia' }; } };
}

describe('classificaRichiesta', () => {
    it('navigazioni e HTML: rete prima', () => {
        expect(classifica(BASE + '/core/dashboard-standalone.html', { mode: 'navigate', accept: 'text/html' })).toBe('html');
        expect(classifica(BASE + '/core/dashboard-standalone.html?v=1', { mode: 'navigate' })).toBe('html');
        expect(classifica(BASE + '/core/frammento', { accept: 'text/html,application/xhtml+xml' })).toBe('html');
    });

    it('?v= e hash nel nome: cache prima', () => {
        expect(classifica(BASE + '/core/js/app-update.js?v=2026-10-21a')).toBe('versionato');
        expect(classifica(BASE + '/core/styles/base.css?v=3')).toBe('versionato');
        expect(classifica(BASE + '/dist/app.3f2a9c1b.js')).toBe('versionato');
        expect(classifica(BASE + '/dist/chunk-5d41402abc4b.css')).toBe('versionato');
    });

    it('immagini, font e icone: statico (cache della build)', () => {
        expect(classifica(BASE + '/core/images/icon-192x192.png')).toBe('statico');
        expect(classifica(BASE + '/favicon.ico')).toBe('statico');
        expect(classifica(BASE + '/fonts/inter.woff2')).toBe('statico');
        expect(classifica(BASE + '/core/images/logo.svg')).toBe('statico');
    });

    it('JS/CSS/JSON senza versione: rete prima', () => {
        expect(classifica(BASE + '/core/services/firebase-service.js')).toBe('rete');
        expect(classifica(BASE + '/core/styles/responsive-standalone.css')).toBe('rete');
        expect(classifica(BASE + '/manifest.json')).toBe('rete');
        // "v" deve essere un parametro, non un pezzo di nome o di altro parametro
        expect(classifica(BASE + '/core/js/nav.js?view=1')).toBe('rete');
        expect(classifica(BASE + '/core/js/deadbeef.js')).toBe('rete');
    });

    it('.md non intercettati, anche con query o maiuscole', () => {
        expect(classifica(BASE + '/docs-sviluppo/GUIDA/CORE/tony/guida-tecnica.md')).toBe('ignora');
        expect(classifica(BASE + '/GUIDA/README.MD?x=1')).toBe('ignora');
        expect(classifica(BASE + '/GUIDA/guida.md', { mode: 'navigate', accept: 'text/html' })).toBe('ignora');
    });

    it('cross-origin e Firebase/Google non intercettati', () => {
        expect(classifica('https://cdn.jsdelivr.net/npm/chart.js?v=4')).toBe('ignora');
        expect(classifica('https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js')).toBe('ignora');
        expect(classifica('https://firestore.googleapis.com/v1/projects/x')).toBe('ignora');
        expect(classifica('https://gfv.firebaseapp.com/a.js', { origineSw: 'https://gfv.firebaseapp.com' })).toBe('ignora');
    });

    it('non GET, schemi non http e localhost senza swTest non intercettati', () => {
        expect(classifica(BASE + '/a.js?v=1', { method: 'POST' })).toBe('ignora');
        expect(classifica('chrome-extension://abc/x.js', { origineSw: 'chrome-extension://abc' })).toBe('ignora');
        expect(classifica('http://127.0.0.1:8000/a.js?v=1', { origineSw: 'http://127.0.0.1:8000' })).toBe('ignora');
        expect(classifica('http://127.0.0.1:8000/a.js?v=1', { origineSw: 'http://127.0.0.1:8000', swTest: true })).toBe('versionato');
        expect(classifica('non un url')).toBe('ignora');
    });
});

describe('pulizia cache in activate', () => {
    const CORRENTE = 'gfv-platform-t300';

    it('tiene la corrente e la precedente più recente, cancella le altre GFV', () => {
        const nomi = ['gfv-platform-t100', CORRENTE, 'gfv-platform-t200', 'gfv-platform-t150'];
        expect(S.cacheDaEliminare(nomi, CORRENTE).sort()).toEqual(['gfv-platform-t100', 'gfv-platform-t150']);
        expect(S.cachePrecedenti(nomi, CORRENTE)[0]).toBe('gfv-platform-t200');
    });

    it('al primo update non cancella nulla', () => {
        expect(S.cacheDaEliminare(['gfv-platform-t100', CORRENTE], CORRENTE)).toEqual([]);
        expect(S.cacheDaEliminare([CORRENTE], CORRENTE)).toEqual([]);
    });

    it('non tocca cache di altre app sullo stesso origin', () => {
        const nomi = ['altra-app-v1', 'workbox-precache', CORRENTE, 'gfv-platform-t200', 'gfv-platform-t100'];
        expect(S.cacheDaEliminare(nomi, CORRENTE)).toEqual(['gfv-platform-t100']);
    });

    it('nomi senza timestamp (build di prova) sono i più vecchi', () => {
        const nomi = ['gfv-platform-e2e-build', CORRENTE, 'gfv-platform-t200'];
        expect(S.cacheDaEliminare(nomi, CORRENTE)).toEqual(['gfv-platform-e2e-build']);
    });
});

describe('reteConTimeout (HTML e file senza versione)', () => {
    it('il timeout è al massimo 3 s', () => {
        expect(S.TIMEOUT_RETE_MS).toBeLessThanOrEqual(3000);
        expect(S.ABORT_RETE_MS).toBeGreaterThan(S.TIMEOUT_RETE_MS);
    });

    it('rete veloce: usa la rete e non guarda la cache', async () => {
        const daCache = vi.fn(async () => risposta('cache'));
        const r = await S.reteConTimeout({ rete: async () => risposta('rete'), daCache, timeoutMs: 3000 });
        expect(r.nome).toBe('rete');
        expect(daCache).not.toHaveBeenCalled();
    });

    it('rete lenta con copia in cache: dopo il timeout risponde la cache', async () => {
        vi.useFakeTimers();
        const rete = () => new Promise(() => {});
        const p = S.reteConTimeout({ rete, daCache: async () => risposta('cache'), timeoutMs: 3000 });
        await vi.advanceTimersByTimeAsync(2999);
        let fatto = false;
        p.then(() => { fatto = true; });
        await Promise.resolve();
        expect(fatto).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect((await p).nome).toBe('cache');
    });

    it('rete lenta senza copia: aspetta la rete oltre il timeout', async () => {
        vi.useFakeTimers();
        let consegna;
        const rete = () => new Promise((ok) => { consegna = ok; });
        const p = S.reteConTimeout({ rete, daCache: async () => null, timeoutMs: 3000 });
        await vi.advanceTimersByTimeAsync(5000);
        consegna(risposta('rete'));
        expect((await p).nome).toBe('rete');
    });

    it('rete giù: cache, poi pagina di riserva, poi errore', async () => {
        const giu = async () => { throw new TypeError('offline'); };
        expect((await S.reteConTimeout({ rete: giu, daCache: async () => risposta('cache') })).nome).toBe('cache');
        expect((await S.reteConTimeout({
            rete: giu, daCache: async () => null, fallback: async () => risposta('index')
        })).nome).toBe('index');
        await expect(S.reteConTimeout({ rete: giu, daCache: async () => null })).rejects.toThrow('offline');
    });
});

describe('cachePrima (file versionati e statici)', () => {
    it('copia nella cache della build: niente rete', async () => {
        const rete = vi.fn();
        const r = await S.cachePrima({ daCorrente: async () => risposta('corrente'), rete });
        expect(r.nome).toBe('corrente');
        expect(rete).not.toHaveBeenCalled();
    });

    it('niente nella cache della build: rete, anche se una build precedente ce l’ha', async () => {
        const daRiserva = vi.fn(async () => risposta('precedente'));
        const r = await S.cachePrima({ daCorrente: async () => null, rete: async () => risposta('rete'), daRiserva });
        expect(r.nome).toBe('rete');
        expect(daRiserva).not.toHaveBeenCalled();
    });

    it('rete giù: copia della build precedente, altrimenti errore', async () => {
        const giu = async () => { throw new TypeError('offline'); };
        const r = await S.cachePrima({ daCorrente: async () => null, rete: giu, daRiserva: async () => risposta('precedente') });
        expect(r.nome).toBe('precedente');
        await expect(S.cachePrima({ daCorrente: async () => null, rete: giu })).rejects.toThrow('offline');
    });
});

describe('service-worker.js usa le strategie', () => {
    const sw = readFileSync(resolve(__dirname, '../service-worker.js'), 'utf8');

    it('carica sw-strategy.js e il pattern del bump resta valido', () => {
        expect(sw).toMatch(/importScripts\('sw-strategy\.js\?v=' \+ encodeURIComponent\(SW_CACHE_BUILD_ID\)\)/);
        expect(sw).toMatch(/const SW_CACHE_BUILD_ID = '[^']*';/);
        expect(sw).toContain("const CACHE_NAME = 'gfv-platform-' + SW_CACHE_BUILD_ID;");
    });

    it('versionati e statici cache prima, il resto rete prima con timeout', () => {
        expect(sw).toMatch(/tipo === 'versionato' \|\| tipo === 'statico'\) \{\s*event\.respondWith\(rispostaCachePrima\(request\)\)/);
        expect(sw).toContain('event.respondWith(rispostaReteConTimeout(request));');
        expect(sw).not.toContain('setTimeout(() => controllo.abort(), 8000)');
    });

    it('activate non cancella tutte le cache diverse dalla corrente', () => {
        expect(sw).not.toMatch(/cacheName !== CACHE_NAME/);
        expect(sw).toContain('STRATEGIA.cacheDaEliminare(cacheNames, CACHE_NAME)');
    });

    it('skipWaiting e clients.claim invariati', () => {
        expect(sw).toContain('self.skipWaiting().then(');
        expect(sw).toContain('.then(() => self.clients.claim())');
    });
});

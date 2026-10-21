/**
 * @vitest-environment jsdom
 * Le card di Gestione lavori non restano a 0 mentre le letture sono in corso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import polygonClipping from 'polygon-clipping';
import { computeWorkedAreaHa } from '../core/services/zone-lavorate-area.js';

function cardStato() {
    if (!globalThis.__gfvCardStat) {
        globalThis.__gfvCardStat = {
            delayMs: 0,
            getDocCalls: 0,
            reads: 0,
            failIds: new Set(),
            oreByLavoro: new Map(),
            zoneByLavoro: new Map(),
            terreni: new Map()
        };
    }
    return globalThis.__gfvCardStat;
}

const pc = polygonClipping.default || polygonClipping;

function pathOf(ref) {
    return ref && ref.path ? ref.path : '';
}

function snap(rows) {
    return {
        forEach(cb) {
            (rows || []).forEach((data, index) => {
                cb({ id: `d${index}`, data: () => data });
            });
        }
    };
}

vi.mock('../core/services/firebase-service.js', () => ({
    collection: (...args) => ({ path: args.slice(1).join('/') }),
    doc: (...args) => ({ path: args.slice(1).join('/') }),
    getDocs: (ref) => {
        const s = cardStato();
        const ms = s.delayMs;
        s.reads += 1;
        const lavoroId = pathOf(ref).split('/')[3];
        const percorso = pathOf(ref);
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (s.failIds.has(lavoroId)) {
                    reject(new Error('lettura fallita'));
                    return;
                }
                if (percorso.endsWith('/oreOperai')) resolve(snap(s.oreByLavoro.get(lavoroId)));
                else if (percorso.endsWith('/zoneLavorate')) resolve(snap(s.zoneByLavoro.get(lavoroId)));
                else resolve(snap([]));
            }, ms);
        });
    },
    getDoc: (ref) => {
        const s = cardStato();
        const ms = s.delayMs;
        s.getDocCalls += 1;
        s.reads += 1;
        const terrenoId = pathOf(ref).split('/').pop();
        return new Promise((resolve) => {
            setTimeout(() => {
                const data = s.terreni.get(terrenoId);
                resolve({
                    exists: () => data != null,
                    data: () => data
                });
            }, ms);
        });
    }
}));

import { aggiornaCardDaLista, loadStatistics } from '../core/admin/js/gestione-lavori-controller.js';

const htmlPagina = readFileSync(
    join(process.cwd(), 'core/admin/gestione-lavori-standalone.html'),
    'utf8'
);
const controllerSrc = readFileSync(
    join(process.cwd(), 'core/admin/js/gestione-lavori-controller.js'),
    'utf8'
);

function montaCard() {
    document.body.innerHTML = [
        '<div class="stat-value" id="stat-totale-lavori">0</div>',
        '<div class="stat-value" id="stat-lavori-corso">0</div>',
        '<div class="stat-value" id="stat-ore-validate" aria-busy="true">-</div>',
        '<div class="stat-value" id="stat-superficie-lavorata" aria-busy="true">-</div>',
        '<div class="stat-value" id="stat-lavori-ritardo" aria-busy="true">-</div>',
        '<div class="stat-value" id="stat-lavori-tempo" aria-busy="true">-</div>',
        '<div class="stat-value" id="stat-lavori-anticipo" aria-busy="true">-</div>'
    ].join('');
}

function testo(id) {
    return document.getElementById(id).textContent;
}

function quadrato(lat, lng, dLat, dLng) {
    return [
        { lat, lng },
        { lat, lng: lng + dLng },
        { lat: lat + dLat, lng: lng + dLng },
        { lat: lat + dLat, lng },
        { lat, lng }
    ];
}

describe('card statistiche gestione lavori', () => {
    const appendOriginale = document.head.appendChild.bind(document.head);

    beforeEach(() => {
        const s = cardStato();
        s.delayMs = 0;
        s.getDocCalls = 0;
        s.reads = 0;
        s.failIds.clear();
        s.oreByLavoro.clear();
        s.zoneByLavoro.clear();
        s.terreni.clear();
        delete window.polygonClipping;
        document.head.appendChild = appendOriginale;
        montaCard();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        document.head.appendChild = appendOriginale;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('all\'avvio ore, superficie e scostamento sono «-», occupati, con una pulsazione leggera', () => {
        expect(htmlPagina).toContain('gestione-lavori-controller.js?v=2026-10-21b');
        expect(htmlPagina).toContain('id="stat-totale-lavori">0</div>');
        expect(htmlPagina).toContain('id="stat-lavori-corso">0</div>');
        for (const id of [
            'stat-ore-validate',
            'stat-superficie-lavorata',
            'stat-lavori-ritardo',
            'stat-lavori-tempo',
            'stat-lavori-anticipo'
        ]) {
            expect(htmlPagina).toContain(`id="${id}" aria-busy="true">-</div>`);
        }
        expect(htmlPagina).toContain('@keyframes stat-card-pulse');
        expect(htmlPagina).toContain('.stat-value[aria-busy="true"]');
        expect(controllerSrc).toContain('let statisticsGeneration = 0');
        expect(controllerSrc).toContain('const BLOCCO_LAVORI_STATISTICHE = 8');

        const da = htmlPagina.indexOf('const lavoriLoadPromise');
        const a = htmlPagina.indexOf('await loadVignetoModules');
        const init = htmlPagina.slice(da, a);
        expect(init).toContain('const terreniPromise = loadTerreniWrapper()');
        expect(init).toContain('await Promise.all([lavoriLoadPromise, rosterPromise, terreniPromise])');
        expect(init).toContain('const statsPromise = loadStatisticsWrapper()');
        expect(init).toContain('await Promise.all([statsPromise, macchinePromise, categoriePromise])');
        expect(init.indexOf('const statsPromise')).toBeLessThan(init.indexOf('const macchinePromise'));
        expect(init).not.toMatch(/await\s+loadStatisticsWrapper\s*\(/);
    });

    it('scrive Totale e In Corso appena c\'è la lista, e lascia le altre card sul segnaposto', () => {
        aggiornaCardDaLista([
            { stato: 'in_corso' },
            { stato: 'in_corso' },
            { stato: 'assegnato' },
            { stato: 'completato' }
        ]);
        expect(testo('stat-totale-lavori')).toBe('4');
        expect(testo('stat-lavori-corso')).toBe('2');
        expect(testo('stat-ore-validate')).toBe('-');
        expect(testo('stat-superficie-lavorata')).toBe('-');
        expect(testo('stat-lavori-ritardo')).toBe('-');
        expect(document.getElementById('stat-ore-validate').getAttribute('aria-busy')).toBe('true');
    });

    it('calcola ore e scostamento anche se polygon-clipping non c\'è', async () => {
        document.head.appendChild = (node) => {
            if (node && node.dataset && node.dataset.gfvPolygonClipping === '1') {
                if (typeof node.onerror === 'function') node.onerror(new Error('assente'));
                return node;
            }
            return appendOriginale(node);
        };
        const a = quadrato(43.7, 11.2, 0.001, 0.001);
        cardStato().zoneByLavoro.set('senza', [{ isChiuso: true, coordinate: a, superficieHa: 5 }]);
        cardStato().oreByLavoro.set('senza', [{ stato: 'validate', oreNette: 1.5 }]);
        cardStato().terreni.set('t-senza', { superficie: 10 });
        const ieri = new Date();
        ieri.setDate(ieri.getDate() - 1);
        ieri.setHours(14, 0, 0, 0);

        await loadStatistics('tenant', {}, [{
            id: 'senza',
            stato: 'in_corso',
            terrenoId: 't-senza',
            dataInizio: ieri,
            durataPrevista: 2
        }]);

        expect(testo('stat-ore-validate')).toBe('1h 30min');
        expect(testo('stat-superficie-lavorata')).toBe('0.00 ha');
        expect(testo('stat-lavori-ritardo')).toBe('1');
        expect(testo('stat-totale-lavori')).toBe('1');
        expect(testo('stat-lavori-corso')).toBe('1');
        expect(document.getElementById('stat-ore-validate').hasAttribute('aria-busy')).toBe(false);
    });

    it('57 lavori a 150 ms a lettura finiscono sotto i 3 s (prima circa 20 s) e il terreno si legge una volta', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        cardStato().delayMs = 150;
        const lavori = Array.from({ length: 57 }, (_, i) => {
            cardStato().oreByLavoro.set(`lav-${i}`, [{ stato: 'validate', oreNette: 1 }]);
            return {
                id: `lav-${i}`,
                stato: i < 10 ? 'in_corso' : 'assegnato',
                terrenoId: `ter-${i % 5}`
            };
        });
        for (let i = 0; i < 5; i += 1) cardStato().terreni.set(`ter-${i}`, { superficie: 1 });

        const t0 = Date.now();
        const pending = loadStatistics('tenant', {}, lavori);
        await vi.runAllTimersAsync();
        await pending;
        const elapsed = Date.now() - t0;

        expect(elapsed).toBeLessThan(3000);
        expect(elapsed).toBeGreaterThanOrEqual(8 * 150);
        expect(elapsed).toBeLessThan(2000);
        expect(cardStato().getDocCalls).toBe(5);
        expect(testo('stat-totale-lavori')).toBe('57');
        expect(testo('stat-lavori-corso')).toBe('10');
        expect(testo('stat-ore-validate')).toBe('57h');
        expect(testo('stat-superficie-lavorata')).toBe('0.00 ha');
    });

    it('un lavoro non letto lascia l\'asterisco e non azzera gli altri', async () => {
        cardStato().failIds.add('rotto');
        cardStato().oreByLavoro.set('ok1', [{ stato: 'validate', oreNette: 2 }]);
        cardStato().oreByLavoro.set('ok2', [{ stato: 'validate', oreNette: 3 }]);

        await loadStatistics('tenant', {}, [
            { id: 'ok1', stato: 'assegnato' },
            { id: 'rotto', stato: 'in_corso', terrenoId: 'tx' },
            { id: 'ok2', stato: 'assegnato' }
        ]);

        const ore = document.getElementById('stat-ore-validate');
        expect(ore.textContent).toBe('5h*');
        expect(ore.title).toBe('Dato parziale: 1 lavori non letti');
        expect(document.getElementById('stat-superficie-lavorata').title).toBe('Dato parziale: 1 lavori non letti');
        expect(document.getElementById('stat-lavori-ritardo').textContent).toBe('0*');
        expect(testo('stat-totale-lavori')).toBe('3');
        expect(testo('stat-lavori-corso')).toBe('1');
        expect(testo('stat-totale-lavori')).not.toContain('*');
    });

    it('una chiamata vecchia non sovrascrive il risultato di una più recente', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        cardStato().delayMs = 400;
        cardStato().oreByLavoro.set('vecchio', [{ stato: 'validate', oreNette: 1 }]);
        const prima = loadStatistics('tenant', {}, [{
            id: 'vecchio',
            stato: 'in_corso',
            terrenoId: 'tv'
        }]);
        for (let i = 0; i < 20 && cardStato().reads === 0; i += 1) {
            await vi.advanceTimersByTimeAsync(0);
        }
        expect(cardStato().reads).toBeGreaterThan(0);

        cardStato().delayMs = 0;
        cardStato().oreByLavoro.set('nuovo', [{ stato: 'validate', oreNette: 4 }]);
        const seconda = loadStatistics('tenant', {}, [{
            id: 'nuovo',
            stato: 'assegnato',
            terrenoId: 'tn'
        }]);
        await vi.runAllTimersAsync();
        await Promise.all([prima, seconda]);

        expect(testo('stat-ore-validate')).toBe('4h');
        expect(testo('stat-totale-lavori')).toBe('1');
        expect(testo('stat-lavori-corso')).toBe('0');
    });

    it('un secondo passaggio ricalcola i numeri e toglie il dato parziale', async () => {
        cardStato().failIds.add('rotto');
        cardStato().oreByLavoro.set('r1', [{ stato: 'validate', oreNette: 2 }]);
        await loadStatistics('tenant', {}, [
            { id: 'r1', stato: 'in_corso', terrenoId: 'tr' },
            { id: 'rotto', stato: 'assegnato' }
        ]);
        expect(testo('stat-ore-validate')).toBe('2h*');

        cardStato().failIds.clear();
        cardStato().oreByLavoro.set('r1', [{ stato: 'validate', oreNette: 5 }]);
        await loadStatistics('tenant', {}, [
            { id: 'r1', stato: 'assegnato', terrenoId: 'tr' },
            { id: 'r2', stato: 'in_corso', terrenoId: 'tr' }
        ]);
        const ore = document.getElementById('stat-ore-validate');
        expect(ore.textContent).toBe('5h');
        expect(ore.title).toBe('');
        expect(ore.hasAttribute('aria-busy')).toBe(false);
        expect(testo('stat-totale-lavori')).toBe('2');
        expect(testo('stat-lavori-corso')).toBe('1');
    });

    it('non modifica dataInizio degli oggetti in lista', async () => {
        const inizio = new Date(2026, 0, 15, 14, 30, 45);
        const istante = inizio.getTime();
        const lavoro = {
            id: 'lav-data',
            stato: 'in_corso',
            dataInizio: inizio,
            durataPrevista: 5,
            terrenoId: 't1'
        };
        cardStato().terreni.set('t1', { superficie: 4 });
        await loadStatistics('tenant', {}, [lavoro]);
        expect(lavoro.dataInizio).toBe(inizio);
        expect(inizio.getTime()).toBe(istante);
        expect(inizio.getHours()).toBe(14);
        expect(inizio.getMinutes()).toBe(30);
        expect(controllerSrc).not.toMatch(/lavoro\.dataInizio\.setHours/);
    });

    it('con zone sovrapposte la superficie è l\'unione, non la somma, e il terreno è letto una volta', async () => {
        window.polygonClipping = pc;
        const a = quadrato(43.7, 11.2, 0.001, 0.001);
        const b = quadrato(43.7004, 11.2004, 0.001, 0.001);
        const sovrapposte = [
            { isChiuso: true, coordinate: a, superficieHa: 50 },
            { isChiuso: true, coordinate: b, superficieHa: 50 }
        ];
        const soloA = [{ isChiuso: true, coordinate: a, superficieHa: 50 }];
        const unione = computeWorkedAreaHa(sovrapposte, null, pc);
        const solo = computeWorkedAreaHa(soloA, null, pc);
        expect(unione).toBeGreaterThan(Math.max(solo, 0));
        expect(unione).toBeLessThan(50 + 50 - 1e-6);

        cardStato().zoneByLavoro.set('sovrapposto', sovrapposte);
        cardStato().zoneByLavoro.set('solo', soloA);
        cardStato().terreni.set('t-condiviso', { superficie: 100 });
        await loadStatistics('tenant', {}, [
            { id: 'sovrapposto', stato: 'assegnato', terrenoId: 't-condiviso' },
            { id: 'solo', stato: 'assegnato', terrenoId: 't-condiviso' }
        ]);

        expect(testo('stat-superficie-lavorata')).toBe(`${(unione + solo).toFixed(2)} ha`);
        expect(testo('stat-superficie-lavorata')).not.toBe('150.00 ha');
        expect(cardStato().getDocCalls).toBe(1);
    });
});

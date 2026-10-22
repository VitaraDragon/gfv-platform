/**
 * Barra «C'è una nuova versione» sul service worker locale (?swTest=1).
 * Il primo avvio e un update senza file nuovo non mostrano la barra.
 * Aggiorna ricarica una volta sola.
 * Worker nuovo bloccato in attesa: «Aggiornamento in corso…», reload dopo ~10 s,
 * nessun reload con dati non salvati o con un salvataggio in corso.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import {
    loginAsCapoFromDevPage,
    loginAsManagerFromDevPage,
    waitForSegnaturaOreLoaded
} from './helpers/sim-login.js';

const PAGINA = '/core/auth/login-standalone.html?swTest=1';
const BARRA = '#gfv-app-update-bar';
const BUILD_NUOVA = 'e2e-build-nuova';

async function attendiController(page) {
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, {
        timeout: 20_000
    });
}

async function apriEControlla(page) {
    await page.goto(PAGINA);
    await page.locator('#login-form').waitFor();
    await attendiController(page);
    await page.reload();
    await page.locator('#login-form').waitFor();
    await attendiController(page);
}

async function chiediUpdate(page) {
    await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.update) await registration.update();
        document.dispatchEvent(new Event('visibilitychange'));
    });
}

const FILE_SW = resolve('service-worker.js');
let originaleSw = '';

/**
 * Chrome scarica lo script del service worker fuori da page.route.
 * Il server locale legge il file: per la prova si pubblica un build id diverso
 * e afterEach rimette il file com'era.
 */
function serviBuild(buildId) {
    if (!originaleSw) originaleSw = readFileSync(FILE_SW, 'utf8');
    writeFileSync(FILE_SW, originaleSw.replace(
        /const SW_CACHE_BUILD_ID = '[^']*';/,
        `const SW_CACHE_BUILD_ID = '${buildId}';`
    ));
}

function ripristinaServiceWorker() {
    if (!originaleSw) return;
    writeFileSync(FILE_SW, originaleSw);
    originaleSw = '';
}

test.afterEach(() => {
    ripristinaServiceWorker();
});

async function leggiBuildAttiva(page) {
    return page.evaluate(() => new Promise((resolve) => {
        const controller = navigator.serviceWorker.controller;
        if (!controller) {
            resolve('');
            return;
        }
        const channel = new MessageChannel();
        const timer = window.setTimeout(() => resolve(''), 3000);
        channel.port1.onmessage = (event) => {
            window.clearTimeout(timer);
            resolve((event.data && event.data.buildId) || '');
        };
        controller.postMessage({ type: 'GFV_GET_BUILD' }, [channel.port2]);
    }));
}

test.describe('barra nuova versione', () => {
    test('nessuna barra senza versione nuova', async ({ page }) => {
        await apriEControlla(page);
        await expect(page.locator(BARRA)).toHaveCount(0);
        await chiediUpdate(page);
        await page.waitForTimeout(800);
        await expect(page.locator(BARRA)).toHaveCount(0);
    });

    test('la barra compare quando online c’è una build diversa', async ({ page }) => {
        await apriEControlla(page);
        serviBuild(BUILD_NUOVA);
        await chiediUpdate(page);
        await expect(page.locator(BARRA)).toBeVisible();
        await expect(page.locator('#gfv-app-update-messaggio')).toHaveText("C'è una nuova versione");
        await expect(page.locator('#gfv-app-update-btn')).toHaveText('Aggiorna');
    });

    test('Aggiorna ricarica una volta, poi la stessa build non rifà la barra', async ({ page }) => {
        await apriEControlla(page);
        serviBuild(BUILD_NUOVA);
        await chiediUpdate(page);
        await expect(page.locator(BARRA)).toBeVisible();

        let navigazioni = 0;
        page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame()) navigazioni += 1;
        });
        const navigata = page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
        await page.locator('#gfv-app-update-btn').click();
        await navigata;
        await page.locator('#login-form').waitFor();
        await attendiController(page);
        await page.waitForTimeout(1200);

        expect(navigazioni).toBe(1);
        expect(await leggiBuildAttiva(page)).toBe(BUILD_NUOVA);
        await expect(page.locator(BARRA)).toHaveCount(0);

        await chiediUpdate(page);
        await page.waitForTimeout(800);
        await expect(page.locator(BARRA)).toHaveCount(0);
        expect(navigazioni).toBe(1);
    });

    test('Segna ore: Annulla tiene i dati e non ricarica', async ({ page }) => {
        await loginAsCapoFromDevPage(page, { waitForWorkspace: false });
        await page.goto('/core/segnatura-ore-standalone.html?emulator=1&swTest=1');
        await waitForSegnaturaOreLoaded(page);
        await attendiController(page);
        await page.reload();
        await waitForSegnaturaOreLoaded(page);
        await attendiController(page);

        serviBuild('e2e-build-ore');
        await chiediUpdate(page);
        await expect(page.locator(BARRA)).toBeVisible();

        await page.getByRole('button', { name: /Segna Nuova Ora/i }).click();
        await page.locator('#ora-modal.active').waitFor();
        await page.locator('#ora-note').fill('nota ancora da salvare');

        let navigazioni = 0;
        page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame()) navigazioni += 1;
        });
        await page.locator('#gfv-app-update-btn').click();
        const conferma = page.locator('#gfv-app-update-confirm');
        await expect(conferma).toBeVisible();
        await expect(conferma).toContainText('Hai dati non salvati: aggiorni lo stesso?');
        await page.locator('#gfv-app-update-annulla').click();

        await page.waitForTimeout(600);
        expect(navigazioni).toBe(0);
        await expect(page.locator('#ora-note')).toHaveValue('nota ancora da salvare');
        await expect(page.locator(BARRA)).toBeVisible();
    });

    test('la conversazione Tony salvata su beforeunload sopravvive ad Aggiorna', async ({ page }) => {
        test.setTimeout(180_000);
        await loginAsManagerFromDevPage(page);
        await page.goto('/core/dashboard-standalone.html?emulator=1&swTest=1&tonyE2e=1');
        await page.waitForFunction(() => typeof window.__tonyRestoreSession === 'function', null, {
            timeout: 60_000
        });
        await attendiController(page);
        await page.goto('/core/dashboard-standalone.html?emulator=1&swTest=1&tonyE2e=1');
        await page.waitForFunction(() => typeof window.__tonyRestoreSession === 'function', null, {
            timeout: 60_000
        });
        await attendiController(page);

        serviBuild('e2e-build-tony');
        await chiediUpdate(page);
        await expect(page.locator(BARRA)).toBeVisible();
        await page.evaluate(() => {
            window.Tony = window.Tony || {};
            window.Tony.chatHistory = [{
                role: 'user',
                parts: [{ text: 'GFV_UPDATE_CHAT_PROVA' }]
            }];
        });

        const statoSw = () => page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            const worker = (reg && (reg.waiting || reg.installing)) || null;
            return {
                waiting: !!(reg && reg.waiting),
                installing: !!(reg && reg.installing),
                workerState: worker ? worker.state : '',
                controller: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
                sporco: !!window.__gfvFormSporco,
                ingresso: document.documentElement.getAttribute('data-ingresso') || '',
                conferma: !!document.getElementById('gfv-app-update-conferma'),
                barra: !!document.getElementById('gfv-app-update-bar'),
                skipInviati: window.__gfvSkipInviati || 0,
                skipErrore: window.__gfvSkipErrore || ''
            };
        });
        const prima = await statoSw();
        const navigata = page.waitForEvent('framenavigated', {
            timeout: 30_000,
            predicate: (frame) => frame === page.mainFrame()
        }).catch(() => null);
        await page.evaluate(() => {
            const bottone = document.getElementById('gfv-app-update-btn');
            if (bottone) bottone.click();
        });
        const conferma = page.locator('#gfv-app-update-conferma');
        const dialogo = await conferma.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
        if (dialogo) await conferma.click({ force: true });
        const frame = await navigata;
        if (!frame) {
            const dopo = await statoSw();
            const ack = await page.evaluate(() => new Promise((resolve) => {
                navigator.serviceWorker.getRegistration().then((reg) => {
                    const worker = reg && reg.waiting;
                    const urls = {
                        controller: navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : '',
                        waiting: worker ? worker.scriptURL : '',
                        scope: reg ? reg.scope : ''
                    };
                    if (!worker) {
                        resolve({ urls, ack: 'no-waiting' });
                        return;
                    }
                    const channel = new MessageChannel();
                    const timer = setTimeout(() => resolve({ urls, ack: 'timeout' }), 3000);
                    channel.port1.onmessage = (event) => {
                        clearTimeout(timer);
                        const data = event.data || {};
                        resolve({
                            urls,
                            ack: data.type || 'vuoto',
                            ok: data.ok,
                            waiting: data.waiting,
                            errore: data.errore || ''
                        });
                    };
                    try {
                        worker.postMessage({ type: 'GFV_SKIP_WAITING' }, [channel.port2]);
                    } catch (error) {
                        clearTimeout(timer);
                        resolve({ urls, ack: 'errore' });
                    }
                }).catch(() => resolve({ ack: 'reg-errore' }));
            }));
            const dopoAck = await statoSw();
            throw new Error('NO_NAV ' + JSON.stringify({ prima, dopo, ack, dopoAck }));
        }
        await page.waitForFunction(() => {
            const raw = sessionStorage.getItem('tony_session_state') || '';
            return raw.indexOf('GFV_UPDATE_CHAT_PROVA') !== -1;
        }, null, { timeout: 20_000 });
    });
});

/**
 * Il browser rimanda l'attivazione del worker nuovo finché il vecchio ha una risposta
 * ancora in download (modulo grosso su rete lenta). Qui lo si simula scartando
 * GFV_SKIP_WAITING: il worker resta in attesa e controllerchange non arriva.
 */
async function bloccaSkipWaiting(page) {
    await page.addInitScript(() => {
        const originale = ServiceWorker.prototype.postMessage;
        ServiceWorker.prototype.postMessage = function (messaggio, ...resto) {
            if (messaggio && messaggio.type === 'GFV_SKIP_WAITING') {
                window.__e2eSkipScartati = (window.__e2eSkipScartati || 0) + 1;
                return undefined;
            }
            return originale.call(this, messaggio, ...resto);
        };
    });
}

function contaNavigazioni(page) {
    const stato = { n: 0, ultima: 0 };
    page.on('framenavigated', (frame) => {
        if (frame !== page.mainFrame()) return;
        stato.n += 1;
        stato.ultima = Date.now();
    });
    return stato;
}

async function barraConWorkerBloccato(page, build) {
    await bloccaSkipWaiting(page);
    await apriEControlla(page);
    serviBuild(build);
    await chiediUpdate(page);
    await expect(page.locator(BARRA)).toBeVisible();
    await expect(page.locator('#gfv-app-update-btn')).toHaveText('Aggiorna');
}

async function aggiungiFormDiProva(page) {
    await page.evaluate(() => {
        const form = document.createElement('form');
        form.id = 'e2e-form-sporco';
        const input = document.createElement('input');
        input.id = 'e2e-campo';
        input.type = 'text';
        form.appendChild(input);
        document.body.prepend(form);
    });
}

const ATTESA_MS = 10_000;

test.describe('Aggiorna con worker nuovo bloccato in attesa', () => {
    test('la barra resta con «Aggiornamento in corso…» e la pagina si ricarica dopo ~10 s', async ({ page }) => {
        test.setTimeout(90_000);
        await barraConWorkerBloccato(page, 'e2e-build-bloccata');
        const nav = contaNavigazioni(page);

        const click = Date.now();
        await page.locator('#gfv-app-update-btn').click();
        await expect(page.locator('#gfv-app-update-messaggio')).toHaveText('Aggiornamento in corso…');
        await expect(page.locator(BARRA)).toBeVisible();
        await expect(page.locator('#gfv-app-update-btn')).toBeHidden();

        await page.waitForTimeout(ATTESA_MS - 2500);
        expect(nav.n).toBe(0);
        await expect(page.locator('#gfv-app-update-messaggio')).toHaveText('Aggiornamento in corso…');
        expect(await page.evaluate(() => window.__e2eSkipScartati || 0)).toBeGreaterThan(1);

        // Reload senza controllerchange: la navigazione deve completarsi, non restare appesa.
        await expect.poll(() => nav.n, { timeout: 15_000 }).toBe(1);
        const dopo = nav.ultima - click;
        expect(dopo).toBeGreaterThanOrEqual(ATTESA_MS - 500);
        expect(dopo).toBeLessThan(ATTESA_MS + 5000);
        await page.locator('#login-form').waitFor({ timeout: 15_000 });
        await page.waitForFunction(() => document.readyState === 'complete', null, { timeout: 15_000 });
        await attendiController(page);

        // Il worker è ancora in attesa (lo skip è scartato anche qui): la barra torna
        // con Aggiorna e non parte un secondo reload.
        await expect(page.locator(BARRA)).toBeVisible();
        await expect(page.locator('#gfv-app-update-btn')).toHaveText('Aggiorna');
        await page.waitForTimeout(1500);
        expect(nav.n).toBe(1);
    });

    test('con un form sporco non ricarica e lascia Aggiorna per riprovare', async ({ page }) => {
        test.setTimeout(90_000);
        await barraConWorkerBloccato(page, 'e2e-build-sporco');
        await aggiungiFormDiProva(page);
        const nav = contaNavigazioni(page);

        await page.locator('#gfv-app-update-btn').click();
        await expect(page.locator('#gfv-app-update-messaggio')).toHaveText('Aggiornamento in corso…');
        // L'utente scrive mentre aspetta.
        await page.locator('#e2e-campo').fill('dato non salvato');
        expect(await page.evaluate(() => window.__gfvFormSporco)).toBe(true);

        await page.waitForTimeout(ATTESA_MS + 2500);
        expect(nav.n).toBe(0);
        await expect(page.locator('#e2e-campo')).toHaveValue('dato non salvato');
        await expect(page.locator('#gfv-app-update-messaggio')).toHaveText("C'è una nuova versione");
        await expect(page.locator('#gfv-app-update-btn')).toBeVisible();
        await expect(page.locator('#gfv-app-update-btn')).toHaveText('Aggiorna');

        // Riprova: chiede conferma; con Annulla non succede niente.
        await page.locator('#gfv-app-update-btn').click();
        await expect(page.locator('#gfv-app-update-confirm')).toBeVisible();
        await page.locator('#gfv-app-update-annulla').click();
        await page.waitForTimeout(800);
        expect(nav.n).toBe(0);
        await expect(page.locator('#e2e-campo')).toHaveValue('dato non salvato');

        // Riprova confermando: ricarica subito, senza altri 10 s.
        const click = Date.now();
        await page.locator('#gfv-app-update-btn').click();
        await page.locator('#gfv-app-update-conferma').click();
        await expect.poll(() => nav.n, { timeout: 8000 }).toBe(1);
        expect(nav.ultima - click).toBeLessThan(5000);
        await page.locator('#login-form').waitFor({ timeout: 15_000 });
    });

    test('con un salvataggio in corso non ricarica', async ({ page }) => {
        test.setTimeout(90_000);
        await barraConWorkerBloccato(page, 'e2e-build-salva');
        const nav = contaNavigazioni(page);

        await page.locator('#gfv-app-update-btn').click();
        await expect(page.locator('#gfv-app-update-messaggio')).toHaveText('Aggiornamento in corso…');
        await page.evaluate(() => { window.__gfvSalvataggioInCorso = true; });

        await page.waitForTimeout(ATTESA_MS + 2500);
        expect(nav.n).toBe(0);
        await expect(page.locator('#gfv-app-update-btn')).toBeVisible();
        await expect(page.locator('#gfv-app-update-messaggio')).toHaveText("C'è una nuova versione");
    });
});

/**
 * Barra «C'è una nuova versione» sul service worker locale (?swTest=1).
 * Restano due prove in browser: la barra compare, Aggiorna ricarica una volta.
 * Attese, form sporco e salvataggio in corso: tests/app-update-attesa.test.js.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from './helpers/gfv-test.js';

const ATTESA_TEST_MS = 1500;
const PAGINA = `/core/auth/login-standalone.html?swTest=1&swTestAttesaMs=${ATTESA_TEST_MS}`;
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
});

/**
 * Barra «C'è una nuova versione».
 * Il service worker resta in attesa: la pagina si ricarica solo dal pulsante Aggiorna.
 * @module core/js/app-update
 */

import { t, leggiLinguaCampo } from '../services/field-ui-i18n.js';

export const INTERVALLO_AGGIORNAMENTO_MS = 15 * 60 * 1000;
export const VERSIONE_MODULO = '2026-10-19a';

const TESTO = {
    disponibile: 'update.available',
    azione: 'update.action',
    nonSalvati: 'update.unsaved',
    annulla: 'update.cancel'
};

const controllerAlCaricamentoPagina = (() => {
    try {
        return typeof navigator !== 'undefined' && navigator.serviceWorker
            ? Boolean(navigator.serviceWorker.controller)
            : false;
    } catch (error) {
        return false;
    }
})();

let avvio = null;
let ascoltoPronto = false;
let controllerChangePronto = false;
let aggiornaRichiesto = false;
let ricaricando = false;
let buildInAttesa = '';
let ignoraAttesaCorrente = false;
let workerMostrato = null;

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function hostLocale(hostname) {
    const host = String(hostname || '');
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/**
 * In produzione la registrazione resta com'è.
 * Su localhost parte solo con ?swTest=1, per i test.
 * @param {{ hostname?: string, search?: string }} locationLike
 * @returns {boolean}
 */
export function registrazioneConsentita(locationLike) {
    const loc = locationLike || {};
    if (!hostLocale(loc.hostname)) return true;
    return new URLSearchParams(loc.search || '').get('swTest') === '1';
}

/**
 * @param {string} swPath
 * @param {{ hostname?: string, search?: string }} locationLike
 * @returns {string}
 */
export function urlServiceWorker(swPath, locationLike) {
    const path = String(swPath || '');
    if (!registrazioneConsentita(locationLike) || !hostLocale((locationLike || {}).hostname)) return path;
    if (path.indexOf('swTest=') !== -1) return path;
    return path + (path.indexOf('?') === -1 ? '?' : '&') + 'swTest=1';
}

/**
 * @param {{ controllerAlCaricamento?: boolean, waiting?: unknown }} stato
 * @returns {boolean}
 */
export function deveMostrareBarra({ controllerAlCaricamento, waiting } = {}) {
    return Boolean(controllerAlCaricamento) && Boolean(waiting);
}

/**
 * @param {{ formSporco?: boolean, salvataggioInCorso?: boolean, confermato?: boolean, giaRicaricatoPerBuild?: boolean }} stato
 * @returns {boolean}
 */
export function puoRicaricare({
    formSporco = false,
    salvataggioInCorso = false,
    confermato = false,
    giaRicaricatoPerBuild = false
} = {}) {
    if (giaRicaricatoPerBuild) return false;
    if ((formSporco || salvataggioInCorso) && !confermato) return false;
    return true;
}

/**
 * @param {{ aggiornaRichiesto?: boolean, ricaricando?: boolean, giaRicaricatoPerBuild?: boolean }} stato
 * @returns {boolean}
 */
export function deveRicaricareSuControllerChange({
    aggiornaRichiesto: richiesto = false,
    ricaricando: inCorso = false,
    giaRicaricatoPerBuild = false
} = {}) {
    return Boolean(richiesto) && !inCorso && !giaRicaricatoPerBuild;
}

/**
 * @param {string} buildId
 * @returns {string}
 */
export function chiaveReloadBuild(buildId) {
    return 'gfv-sw-reload-' + String(buildId || '');
}

export function attivaAscoltoForm() {
    if (ascoltoPronto || typeof document === 'undefined') return;
    ascoltoPronto = true;
    document.addEventListener('input', (event) => {
        if (!event.isTrusted) return;
        const target = event.target;
        if (!target || typeof target.closest !== 'function' || !target.closest('form')) return;
        window.__gfvFormSporco = true;
        try {
            if (window.parent && window.parent !== window) window.parent.__gfvFormSporco = true;
        } catch (error) {
            /* iframe di un'altra origine */
        }
    }, true);
}

if (typeof document !== 'undefined') attivaAscoltoForm();

/**
 * @param {string} swPath
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export function registraServiceWorker(swPath) {
    if (!avvio) avvio = avvia(swPath);
    return avvio;
}

async function avvia(swPath) {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return null;
    }
    if (!registrazioneConsentita(window.location)) return null;
    installaControllerChange();
    const path = urlServiceWorker(swPath, window.location);
    try {
        const registration = await navigator.serviceWorker.register(path);
        collegaBarra(registration);
        chiediAggiornamento(registration);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') chiediAggiornamento(registration);
        });
        window.setInterval(() => chiediAggiornamento(registration), INTERVALLO_AGGIORNAMENTO_MS);
        return registration;
    } catch (error) {
        console.warn('Registrazione Service Worker fallita:', error);
        return null;
    }
}

function chiediAggiornamento(registration) {
    if (!registration || typeof registration.update !== 'function') return;
    registration.update().catch(() => {});
}

function installaControllerChange() {
    if (controllerChangePronto || !navigator.serviceWorker) return;
    controllerChangePronto = true;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        const build = buildInAttesa || '';
        const gia = giaRicaricatoPerBuild(build);
        if (!deveRicaricareSuControllerChange({ aggiornaRichiesto, ricaricando, giaRicaricatoPerBuild: gia })) {
            if (aggiornaRichiesto && !ricaricando && gia) {
                console.warn('[app-update] Ricaricamento già fatto per questa versione', build);
            }
            return;
        }
        ricaricando = true;
        segnaRicaricato(build);
        window.location.reload();
    });
}

function giaRicaricatoPerBuild(build) {
    try {
        return sessionStorage.getItem(chiaveReloadBuild(build)) === '1';
    } catch (error) {
        return false;
    }
}

function segnaRicaricato(build) {
    try {
        sessionStorage.setItem(chiaveReloadBuild(build), '1');
    } catch (error) {
        /* sessione non disponibile */
    }
}

function workerInAttesa(registration, candidato) {
    if (registration && registration.waiting) return registration.waiting;
    if (!candidato || !registration || !registration.active || candidato === registration.active) return null;
    return candidato.state === 'installed' ? candidato : null;
}

function collegaBarra(registration) {
    const controllerAlCaricamento = controllerAlCaricamentoPagina;
    const valuta = (candidato) => {
        if (ignoraAttesaCorrente) return;
        const waiting = workerInAttesa(registration, candidato);
        if (deveMostrareBarra({ controllerAlCaricamento, waiting })) mostraBarra(registration, waiting);
        else nascondiBarra();
    };
    valuta(null);
    registration.addEventListener('updatefound', () => {
        ignoraAttesaCorrente = false;
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') valuta(worker);
        });
    });
}

function linguaBarra() {
    try {
        return leggiLinguaCampo(window.localStorage);
    } catch (error) {
        return 'it';
    }
}

function testo(chiave) {
    return t(chiave, linguaBarra());
}

function assicuraStile() {
    if (document.getElementById('gfv-app-update-style')) return;
    const style = document.createElement('style');
    style.id = 'gfv-app-update-style';
    style.textContent = [
        '#gfv-app-update-bar{position:fixed;left:0;right:0;bottom:0;z-index:10100;display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;padding:12px 16px calc(12px + env(safe-area-inset-bottom, 0px));background:#1f2937;color:#fff;font:16px/1.4 system-ui,sans-serif}',
        '#gfv-app-update-bar p{margin:0;flex:1 1 auto}',
        '#gfv-app-update-bar button,#gfv-app-update-confirm button{min-height:48px;min-width:48px;padding:10px 16px;font:700 16px/1.2 system-ui,sans-serif;border-radius:8px;cursor:pointer}',
        '#gfv-app-update-btn,#gfv-app-update-conferma{background:#2E8B57;color:#fff;border:0}',
        '#gfv-app-update-annulla{background:#fff;color:#1f2937;border:1px solid #d1d5db}',
        '#gfv-app-update-btn:focus-visible,#gfv-app-update-conferma:focus-visible,#gfv-app-update-annulla:focus-visible{outline:3px solid #fde68a;outline-offset:2px}',
        '#gfv-app-update-confirm{position:fixed;inset:0;z-index:10200;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(15,23,42,.45)}',
        '#gfv-app-update-confirm [role="document"],#gfv-app-update-confirm .gfv-app-update-dialog{background:#fff;color:#1a1a1a;border-radius:12px;padding:16px;width:min(420px,100%);box-shadow:0 8px 28px rgba(0,0,0,.25)}',
        '#gfv-app-update-confirm p{margin:0 0 16px;font:16px/1.4 system-ui,sans-serif}',
        '#gfv-app-update-confirm .gfv-app-update-azioni{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
        'html.gfv-update-bar-visibile body{padding-bottom:var(--gfv-update-bar-altezza, 72px)}',
        'html.gfv-update-bar-visibile .field-bottom-nav{bottom:var(--gfv-update-bar-altezza, 72px)}',
        'html.gfv-update-bar-visibile .field-mobile-main{padding-bottom:calc(72px + var(--gfv-update-bar-altezza, 72px))}',
        'html.gfv-update-bar-visibile .modal-content{padding-bottom:calc(24px + var(--gfv-update-bar-altezza, 72px))}',
        'html.gfv-update-bar-visibile .tony-widget-fab{bottom:calc(24px + var(--gfv-update-bar-altezza, 72px)) !important}',
        'html.gfv-update-bar-visibile .tony-widget-panel{bottom:calc(92px + var(--gfv-update-bar-altezza, 72px) + var(--tony-keyboard-inset, 0px)) !important}'
    ].join('');
    document.head.appendChild(style);
}

function aggiornaOffset() {
    const bar = document.getElementById('gfv-app-update-bar');
    const altezza = bar ? bar.offsetHeight : 0;
    document.documentElement.style.setProperty('--gfv-update-bar-altezza', altezza + 'px');
    document.documentElement.classList.toggle('gfv-update-bar-visibile', Boolean(bar));
}

function aggiornaTestiBarra() {
    const messaggio = document.getElementById('gfv-app-update-messaggio');
    const bottone = document.getElementById('gfv-app-update-btn');
    const domanda = document.getElementById('gfv-app-update-domanda');
    const annulla = document.getElementById('gfv-app-update-annulla');
    const conferma = document.getElementById('gfv-app-update-conferma');
    const bar = document.getElementById('gfv-app-update-bar');
    if (messaggio) messaggio.textContent = testo(TESTO.disponibile);
    if (bottone) bottone.textContent = testo(TESTO.azione);
    if (bar) bar.setAttribute('aria-label', testo(TESTO.disponibile));
    if (domanda) domanda.textContent = testo(TESTO.nonSalvati);
    if (annulla) annulla.textContent = testo(TESTO.annulla);
    if (conferma) conferma.textContent = testo(TESTO.azione);
}

function mostraBarra(registration, worker) {
    workerMostrato = worker || (registration && registration.waiting) || workerMostrato;
    assicuraStile();
    let bar = document.getElementById('gfv-app-update-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'gfv-app-update-bar';
        bar.setAttribute('role', 'region');
        const messaggio = document.createElement('p');
        messaggio.id = 'gfv-app-update-messaggio';
        const bottone = document.createElement('button');
        bottone.id = 'gfv-app-update-btn';
        bottone.type = 'button';
        bottone.addEventListener('click', () => {
            preparaAggiornamento(registration).catch(() => {});
        });
        bar.appendChild(messaggio);
        bar.appendChild(bottone);
        document.body.appendChild(bar);
        if (typeof MutationObserver !== 'undefined') {
            const osserva = new MutationObserver(() => aggiornaTestiBarra());
            osserva.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
        }
    }
    aggiornaTestiBarra();
    aggiornaOffset();
}

function nascondiBarra() {
    workerMostrato = null;
    const bar = document.getElementById('gfv-app-update-bar');
    if (bar) bar.remove();
    aggiornaOffset();
}

function formSporcoAdesso() {
    return Boolean(window.__gfvFormSporco);
}

function salvataggioInCorsoAdesso() {
    return Boolean(window.__gfvOreSalvataggioInCorso || window.__gfvSalvataggioInCorso);
}

function chiediConferma() {
    assicuraStile();
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.id = 'gfv-app-update-confirm';
        const dialog = document.createElement('div');
        dialog.className = 'gfv-app-update-dialog';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'gfv-app-update-domanda');
        const domanda = document.createElement('p');
        domanda.id = 'gfv-app-update-domanda';
        domanda.textContent = testo(TESTO.nonSalvati);
        const azioni = document.createElement('div');
        azioni.className = 'gfv-app-update-azioni';
        const annulla = document.createElement('button');
        annulla.id = 'gfv-app-update-annulla';
        annulla.type = 'button';
        annulla.textContent = testo(TESTO.annulla);
        const conferma = document.createElement('button');
        conferma.id = 'gfv-app-update-conferma';
        conferma.type = 'button';
        conferma.textContent = testo(TESTO.azione);
        const chiudi = (valore) => {
            document.removeEventListener('keydown', suTasto);
            overlay.remove();
            const bottone = document.getElementById('gfv-app-update-btn');
            if (bottone) bottone.focus();
            resolve(valore);
        };
        const suTasto = (event) => {
            if (event.key === 'Escape') chiudi(false);
        };
        annulla.addEventListener('click', () => chiudi(false));
        conferma.addEventListener('click', () => chiudi(true));
        azioni.appendChild(annulla);
        azioni.appendChild(conferma);
        dialog.appendChild(domanda);
        dialog.appendChild(azioni);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        document.addEventListener('keydown', suTasto);
        annulla.focus();
    });
}

function leggiBuild(worker) {
    return new Promise((resolve) => {
        if (!worker) {
            resolve('');
            return;
        }
        const channel = new MessageChannel();
        const timer = window.setTimeout(() => resolve(''), 1500);
        channel.port1.onmessage = (event) => {
            window.clearTimeout(timer);
            const data = event.data || {};
            resolve(data.buildId || '');
        };
        try {
            worker.postMessage({ type: 'GFV_GET_BUILD' }, [channel.port2]);
        } catch (error) {
            window.clearTimeout(timer);
            resolve('');
        }
    });
}

async function preparaAggiornamento(registration) {
    const waiting = (registration && registration.waiting) || workerMostrato;
    if (!waiting) return;
    const formSporco = formSporcoAdesso();
    const salvataggioInCorso = salvataggioInCorsoAdesso();
    const build = await leggiBuild(waiting);
    const gia = giaRicaricatoPerBuild(build);
    let confermato = true;
    if ((formSporco || salvataggioInCorso) && !gia) confermato = await chiediConferma();
    if (!puoRicaricare({ formSporco, salvataggioInCorso, confermato, giaRicaricatoPerBuild: gia })) return;
    ignoraAttesaCorrente = true;
    nascondiBarra();
    aggiornaRichiesto = true;
    buildInAttesa = build;
    const attuale = (registration && registration.waiting) || waiting;
    try {
        attuale.postMessage({ type: 'GFV_SKIP_WAITING' });
    } catch (error) {
        /* worker già chiuso */
    }
}

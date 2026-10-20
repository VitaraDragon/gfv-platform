import { describe, it, expect } from 'vitest';
import {
    deveMostrareBarra,
    puoRicaricare,
    deveRicaricareSuControllerChange,
    chiaveReloadBuild,
    registrazioneConsentita,
    urlServiceWorker
} from '../core/js/app-update.js';

describe('barra nuova versione', () => {
    it('non compare senza controller, al primo avvio', () => {
        expect(deveMostrareBarra({ controllerAlCaricamento: false, waiting: true })).toBe(false);
        expect(deveMostrareBarra({ controllerAlCaricamento: false, waiting: false })).toBe(false);
    });

    it('non compare con controller e senza worker in attesa', () => {
        expect(deveMostrareBarra({ controllerAlCaricamento: true, waiting: null })).toBe(false);
    });

    it('compare con controller e worker in attesa', () => {
        expect(deveMostrareBarra({ controllerAlCaricamento: true, waiting: {} })).toBe(true);
    });

    it('non ricarica con un form sporco senza conferma né durante un salvataggio', () => {
        expect(puoRicaricare({
            formSporco: true,
            salvataggioInCorso: false,
            confermato: false,
            giaRicaricatoPerBuild: false
        })).toBe(false);
        expect(puoRicaricare({
            formSporco: false,
            salvataggioInCorso: true,
            confermato: false,
            giaRicaricatoPerBuild: false
        })).toBe(false);
    });

    it('ricarica se i dati sporchi sono stati confermati e non è già stato fatto per quella build', () => {
        expect(puoRicaricare({
            formSporco: true,
            salvataggioInCorso: false,
            confermato: true,
            giaRicaricatoPerBuild: false
        })).toBe(true);
        expect(puoRicaricare({
            formSporco: false,
            salvataggioInCorso: false,
            confermato: false,
            giaRicaricatoPerBuild: false
        })).toBe(true);
    });

    it('non fa un secondo reload se la chiave della stessa build è già in sessionStorage', () => {
        expect(chiaveReloadBuild('build-2')).toBe('gfv-sw-reload-build-2');
        expect(puoRicaricare({
            formSporco: false,
            salvataggioInCorso: false,
            confermato: true,
            giaRicaricatoPerBuild: true
        })).toBe(false);
        expect(deveRicaricareSuControllerChange({
            aggiornaRichiesto: true,
            ricaricando: false,
            giaRicaricatoPerBuild: true
        })).toBe(false);
    });

    it('controllerchange senza Aggiorna non ricarica', () => {
        expect(deveRicaricareSuControllerChange({
            aggiornaRichiesto: false,
            ricaricando: false,
            giaRicaricatoPerBuild: false
        })).toBe(false);
        expect(deveRicaricareSuControllerChange({
            aggiornaRichiesto: true,
            ricaricando: true,
            giaRicaricatoPerBuild: false
        })).toBe(false);
    });

    it('su localhost registra il service worker solo con ?swTest=1', () => {
        expect(registrazioneConsentita({ hostname: 'localhost', search: '' })).toBe(false);
        expect(registrazioneConsentita({ hostname: '127.0.0.1', search: '?emulator=1' })).toBe(false);
        expect(registrazioneConsentita({ hostname: '127.0.0.1', search: '?swTest=1' })).toBe(true);
        expect(registrazioneConsentita({ hostname: 'vitaradragon.github.io', search: '' })).toBe(true);
        expect(urlServiceWorker('../service-worker.js', { hostname: 'vitaradragon.github.io', search: '' }))
            .toBe('../service-worker.js');
        expect(urlServiceWorker('../service-worker.js', { hostname: '127.0.0.1', search: '?swTest=1' }))
            .toBe('../service-worker.js?swTest=1');
    });
});

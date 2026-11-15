import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
    ATTESA_ATTIVAZIONE_MS,
    attesaAttivazioneMs,
    deveMostrareBarra,
    deveRicaricareDopoAttesa,
    puoRicaricare,
    urlPerRiprovaNavigazione,
} from '../core/js/app-update.js';
import { FIELD_UI_LANGS, FIELD_UI_STRINGS } from '../core/config/field-ui-i18n.js';

describe('Aggiorna con worker nuovo ancora in attesa', () => {
    it('aspetta circa 10 secondi prima di ricaricare a mano', () => {
        expect(ATTESA_ATTIVAZIONE_MS).toBe(10_000);
        expect(attesaAttivazioneMs({ hostname: 'gfv-platform.web.app', search: '?swTestAttesaMs=1500' })).toBe(10_000);
        expect(attesaAttivazioneMs({ hostname: '127.0.0.1', search: '' })).toBe(10_000);
        expect(attesaAttivazioneMs({ hostname: '127.0.0.1', search: '?swTest=1&swTestAttesaMs=1500' })).toBe(1500);
    });

    it('ricarica se non ci sono dati non salvati e nessun salvataggio', () => {
        expect(deveRicaricareDopoAttesa({ ricaricando: false, formSporco: false, salvataggioInCorso: false })).toBe(true);
        expect(deveRicaricareDopoAttesa()).toBe(true);
    });

    it('non ricarica con un form sporco o un salvataggio in corso', () => {
        expect(deveRicaricareDopoAttesa({ formSporco: true })).toBe(false);
        expect(deveRicaricareDopoAttesa({ salvataggioInCorso: true })).toBe(false);
    });

    it('non ricarica due volte se controllerchange ha già avviato il reload', () => {
        expect(deveRicaricareDopoAttesa({ ricaricando: true })).toBe(false);
    });

    it('«Aggiornamento in corso…» è tradotto in tutte le lingue del campo', () => {
        const voce = FIELD_UI_STRINGS['update.inProgress'];
        expect(voce.it).toBe('Aggiornamento in corso…');
        FIELD_UI_LANGS.forEach((lingua) => {
            expect(typeof voce[lingua]).toBe('string');
            expect(voce[lingua].length).toBeGreaterThan(0);
        });
    });

    it('dopo il click la barra non sparisce più: niente nascondiBarra() in preparaAggiornamento', () => {
        const sorgente = readFileSync('core/js/app-update.js', 'utf8');
        const inizio = sorgente.indexOf('async function preparaAggiornamento(');
        const fine = sorgente.indexOf('\n}\n', inizio);
        const corpo = sorgente.slice(inizio, fine);
        expect(corpo).not.toContain('nascondiBarra()');
        expect(corpo).toContain('mostraAggiornamentoInCorso(');
    });

    it('senza una build nuova la barra non compare; con worker in attesa sì', () => {
        expect(deveMostrareBarra({ controllerAlCaricamento: true, waiting: false })).toBe(false);
        expect(deveMostrareBarra({ controllerAlCaricamento: false, waiting: true })).toBe(false);
        expect(deveMostrareBarra({ controllerAlCaricamento: true, waiting: true })).toBe(true);
    });

    it('Annulla su un form sporco non ricarica; la conferma sì, una volta sola per build', () => {
        expect(puoRicaricare({ formSporco: true, confermato: false })).toBe(false);
        expect(puoRicaricare({ salvataggioInCorso: true, confermato: false })).toBe(false);
        expect(puoRicaricare({ formSporco: true, confermato: true })).toBe(true);
        expect(puoRicaricare({ giaRicaricatoPerBuild: true, confermato: true })).toBe(false);
    });

    it('il timer finto scade una sola volta e non ricarica se il form è sporco', () => {
        vi.useFakeTimers();
        try {
            const attesa = attesaAttivazioneMs({ hostname: '127.0.0.1', search: '?swTest=1&swTestAttesaMs=1500' });
            const stato = { formSporco: false, salvataggioInCorso: false, ricaricando: false };
            let ricariche = 0;
            setTimeout(() => {
                if (deveRicaricareDopoAttesa(stato)) {
                    ricariche += 1;
                    stato.ricaricando = true;
                }
            }, attesa);
            vi.advanceTimersByTime(attesa - 1);
            expect(ricariche).toBe(0);
            vi.advanceTimersByTime(1);
            expect(ricariche).toBe(1);
            vi.advanceTimersByTime(ATTESA_ATTIVAZIONE_MS);
            expect(ricariche).toBe(1);

            ricariche = 0;
            stato.formSporco = true;
            stato.ricaricando = false;
            setTimeout(() => {
                if (deveRicaricareDopoAttesa(stato)) ricariche += 1;
            }, attesa);
            vi.advanceTimersByTime(attesa);
            expect(ricariche).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it('la seconda prova di navigazione usa lo stesso indirizzo senza frammento', () => {
        expect(urlPerRiprovaNavigazione({ href: 'https://x.it/core/dashboard-standalone.html?a=1' }))
            .toBe('https://x.it/core/dashboard-standalone.html?a=1');
        expect(urlPerRiprovaNavigazione({ href: 'https://x.it/core/terreni-standalone.html#mappa' }))
            .toBe('https://x.it/core/terreni-standalone.html');
        expect(urlPerRiprovaNavigazione(null)).toBe('');
    });
});

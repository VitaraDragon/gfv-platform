import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATTESA_ATTIVAZIONE_MS, deveRicaricareDopoAttesa, urlPerRiprovaNavigazione } from '../core/js/app-update.js';
import { FIELD_UI_LANGS, FIELD_UI_STRINGS } from '../core/config/field-ui-i18n.js';

describe('Aggiorna con worker nuovo ancora in attesa', () => {
    it('aspetta circa 10 secondi prima di ricaricare a mano', () => {
        expect(ATTESA_ATTIVAZIONE_MS).toBe(10_000);
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

    it('la seconda prova di navigazione usa lo stesso indirizzo senza frammento', () => {
        expect(urlPerRiprovaNavigazione({ href: 'https://x.it/core/dashboard-standalone.html?a=1' }))
            .toBe('https://x.it/core/dashboard-standalone.html?a=1');
        expect(urlPerRiprovaNavigazione({ href: 'https://x.it/core/terreni-standalone.html#mappa' }))
            .toBe('https://x.it/core/terreni-standalone.html');
        expect(urlPerRiprovaNavigazione(null)).toBe('');
    });
});

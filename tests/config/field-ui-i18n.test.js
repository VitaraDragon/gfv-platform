/**
 * Completezza del catalogo campo.
 * BOZZA RO/EN/SQ: da rivedere da un madrelingua.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FIELD_UI_LANGS, FIELD_UI_LANG_OPTIONS, FIELD_UI_STRINGS } from '../../core/config/field-ui-i18n.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function leggi(rel) {
    return readFileSync(path.join(root, rel), 'utf8');
}

function segnaposto(testo) {
    const trovati = String(testo).match(/\{[A-Za-z0-9_]+\}/g) || [];
    return trovati.slice().sort().join('|');
}

function chiaviChiamate(src) {
    const chiavi = [];
    const re = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
    let m;
    while ((m = re.exec(src))) chiavi.push(m[1]);
    return chiavi;
}

function chiaviMarkup(src) {
    const chiavi = [];
    const re = /data-i18n(?:-placeholder|-aria|-title)?="([^"]+)"/g;
    let m;
    while ((m = re.exec(src))) chiavi.push(m[1]);
    return chiavi;
}

describe('field-ui-i18n catalogo', () => {
    const chiavi = Object.keys(FIELD_UI_STRINGS);

    it('ogni chiave ha it, ro, en e sq, senza stringhe vuote', () => {
        expect(FIELD_UI_LANGS).toEqual(['it', 'ro', 'en', 'sq']);
        expect(chiavi.length).toBe(201);
        chiavi.forEach((key) => {
            const entry = FIELD_UI_STRINGS[key];
            FIELD_UI_LANGS.forEach((lang) => {
                expect(typeof entry[lang], key + ' ' + lang).toBe('string');
                expect(entry[lang].trim().length, key + ' ' + lang).toBeGreaterThan(0);
            });
        });
    });

    it('i segnaposto sono gli stessi in it, ro, en e sq', () => {
        chiavi.forEach((key) => {
            const entry = FIELD_UI_STRINGS[key];
            const attesi = segnaposto(entry.it);
            FIELD_UI_LANGS.forEach((lang) => {
                expect(segnaposto(entry[lang]), key + ' ' + lang).toBe(attesi);
            });
        });
    });

    it('il markup italiano coincide con il catalogo it', () => {
        const html = leggi('core/mobile/field-workspace-standalone.html');
        const testi = [];
        const reTesto = /data-i18n="([^"]+)"[^>]*>([^<]*)</g;
        let m;
        while ((m = reTesto.exec(html))) testi.push([m[1], m[2]]);
        expect(testi.length).toBeGreaterThan(0);
        testi.forEach(([key, testo]) => {
            expect(FIELD_UI_STRINGS[key].it, key).toBe(testo);
        });
        const coppie = [
            ['data-i18n-placeholder', 'placeholder'],
            ['data-i18n-aria', 'aria-label'],
            ['data-i18n-title', 'title']
        ];
        let nAttr = 0;
        (html.match(/<[^>]+>/g) || []).forEach((tag) => {
            coppie.forEach(([dataAttr, htmlAttr]) => {
                const key = tag.match(new RegExp(dataAttr + '="([^"]+)"'));
                if (!key) return;
                const valore = tag.match(new RegExp('(?<![-\\w])' + htmlAttr + '="([^"]*)"'));
                expect(valore, tag).toBeTruthy();
                expect(FIELD_UI_STRINGS[key[1]].it, key[1]).toBe(valore[1]);
                nAttr += 1;
            });
        });
        expect(nAttr).toBeGreaterThan(0);
    });

    it('le stringhe italiane di cornice restano quelle di oggi', () => {
        expect(FIELD_UI_STRINGS['menu.logout'].it).toBe('Esci');
        expect(FIELD_UI_STRINGS['menu.account'].it).toBe('Impostazioni account');
        expect(FIELD_UI_STRINGS['ore.submit'].it).toBe('Salva ore lavorate');
        expect(FIELD_UI_STRINGS['ore.net'].it).toBe('Ore nette calcolate');
        expect(FIELD_UI_STRINGS['nav.back'].it).toBe('Indietro');
        expect(FIELD_UI_STRINGS['nav.next'].it).toBe('Avanti');
        expect(FIELD_UI_STRINGS['menu.guide'].it).toBe('Guida Manodopera');
        expect(FIELD_UI_STRINGS['slide.lavoro.title'].it).toBe('Seleziona lavoro');
        expect(FIELD_UI_STRINGS['squad.sent'].it).toBe('Segnalazione inviata al manager.');
        expect(FIELD_UI_STRINGS['status.refreshed'].it).toBe('Dati aggiornati.');
        expect(FIELD_UI_STRINGS['menu.lingua'].it).toBe('Lingua');
        expect(FIELD_UI_STRINGS['lang.choose'].it).toBe('Scegli la lingua');
        expect(FIELD_UI_STRINGS['lang.close'].it).toBe('Chiudi');
    });

    it('l’elenco lingue sta solo in configurazione e il menu ha una voce Lingua', () => {
        expect(FIELD_UI_LANG_OPTIONS.map((voce) => voce.code)).toEqual(FIELD_UI_LANGS);
        expect(FIELD_UI_LANG_OPTIONS).toEqual([
            { code: 'it', flag: '🇮🇹', name: 'Italiano' },
            { code: 'ro', flag: '🇷🇴', name: 'Română' },
            { code: 'en', flag: '🇬🇧', name: 'English' },
            { code: 'sq', flag: '🇦🇱', name: 'Shqip' }
        ]);
        const html = leggi('core/mobile/field-workspace-standalone.html');
        expect(html).not.toContain('field-lang-switch');
        expect(html).not.toContain('data-field-lang=');
        expect(html).toContain('data-i18n="menu.lingua"');
        expect(html).toContain('data-i18n="lang.choose"');
        expect(html).toContain('data-i18n="lang.close"');
        expect(html).toContain('role="dialog"');
        const ctrl = leggi('core/mobile/js/field-workspace-controller.js');
        expect(ctrl).toContain('FIELD_UI_LANG_OPTIONS');
        expect(ctrl).toContain("return 'sq-AL'");
        expect(ctrl).not.toContain('Shqip');
    });

    it('controller, helper UI e HTML usano solo chiavi del catalogo', () => {
        const usate = [
            ...chiaviChiamate(leggi('core/mobile/js/field-workspace-controller.js')),
            ...chiaviChiamate(leggi('core/mobile/js/pieno-campo-ui.js')),
            ...chiaviChiamate(leggi('core/mobile/js/field-ore-riquadro.js')),
            ...chiaviMarkup(leggi('core/mobile/field-workspace-standalone.html'))
        ];
        const sconosciute = usate.filter((key) => !FIELD_UI_STRINGS[key]);
        expect(sconosciute).toEqual([]);
        expect(usate.length).toBeGreaterThan(0);
    });

    it('non ci sono chiamate t() con chiave dinamica', () => {
        const src = [
            leggi('core/mobile/js/field-workspace-controller.js'),
            leggi('core/mobile/js/pieno-campo-ui.js'),
            leggi('core/mobile/js/field-ore-riquadro.js')
        ].join('\n');
        const dinamiche = src.match(/\bt\(\s*[^'"\s)/]/g) || [];
        expect(dinamiche).toEqual([]);
    });

    it('data-slide-title del workspace resta sui cinque valori attuali', () => {
        const html = leggi('core/mobile/field-workspace-standalone.html');
        const titoli = [];
        const re = /data-slide-title="([^"]+)"/g;
        let m;
        while ((m = re.exec(html))) titoli.push(m[1]);
        expect(titoli).toEqual([
            'Lavoro',
            'Comunicazioni',
            'Comunicazioni',
            'Valida ore',
            'Ore',
            'Statistiche'
        ]);
    });
});

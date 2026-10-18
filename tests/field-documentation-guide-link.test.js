import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function leggi(rel) {
    return readFileSync(join(root, rel), 'utf8');
}

describe('guida Manodopera sul campo', () => {
    const controller = leggi('core/mobile/js/field-workspace-controller.js');
    const html = leggi('core/mobile/field-workspace-standalone.html');

    it('aggiorna il link prima di abilitare il menu', () => {
        const inizio = controller.indexOf('userIsCaposquadra = isCaposquadra;');
        expect(inizio).toBeGreaterThan(-1);
        const dopoRuolo = controller.slice(inizio);
        const link = dopoRuolo.indexOf('updateFieldDocumentationGuideLink()');
        const menu = dopoRuolo.indexOf('applicaStatoMenuCampo(true)');
        expect(link).toBeGreaterThan(-1);
        expect(menu).toBeGreaterThan(link);
    });

    it('l’href fisso non forza ruolo=operaio', () => {
        const riga = html.split('\n').find((line) => line.includes('id="field-documentation-guide-link"'));
        expect(riga).toBeTruthy();
        expect(riga).not.toContain('ruolo=operaio');
    });
});

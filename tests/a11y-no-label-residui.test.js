/**
 * Residui «No label» segnalati su Terreni / Impostazioni (tony-input + select liste).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

describe('a11y etichette residue', () => {
  it('#tony-input ha aria-label Scrivi a Tony', () => {
    const ui = read('core/js/tony/ui.js');
    expect(ui).toMatch(/id="tony-input"[^>]*aria-label="Scrivi a Tony"|aria-label="Scrivi a Tony"[^>]*id="tony-input"/);
  });

  it('Impostazioni: select/input tipi lavoro e colture etichettati', () => {
    const html = read('core/admin/impostazioni-standalone.html');
    for (const id of [
      'new-tipo-lavoro-predeterminato',
      'new-tipo-lavoro',
      'new-coltura-predeterminata',
      'new-coltura',
    ]) {
      const re = new RegExp(
        `id="${id}"[^>]*(aria-label=|[^>]*</label>)|for="${id}"|id="${id}"[^>]*aria-label=`
      );
      expect(html, id).toMatch(new RegExp(`id="${id}"`));
      expect(
        html.includes(`for="${id}"`) ||
          new RegExp(`id="${id}"[^>]*aria-label=`).test(html),
        id + ' senza for/aria-label'
      ).toBe(true);
    }
  });
});

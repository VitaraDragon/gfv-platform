/**
 * Form attrezzi e flotta: i campi che l'e2e compilava.
 * Il salvataggio in browser resta su trattori e gestione macchine.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('form parco macchine attrezzi e flotta', () => {
  it('attrezzi: nuovo, nome, categoria, tipo fisso attrezzo', () => {
    const html = readFileSync('modules/macchine/views/attrezzi-list-standalone.html', 'utf8');
    expect(html).toContain('id="btn-nuovo"');
    expect(html).toContain('id="nome"');
    expect(html).toContain('id="categoriaId"');
    expect(html).toContain('id="tipoMacchina" value="attrezzo"');
  });

  it('flotta: nome e tipo mezzo selezionabile', () => {
    const html = readFileSync('modules/macchine/views/flotta-list-standalone.html', 'utf8');
    expect(html).toContain('id="nome"');
    expect(html).toContain('id="tipoMacchina"');
    expect(html).toContain('id="btn-nuovo"');
  });
});

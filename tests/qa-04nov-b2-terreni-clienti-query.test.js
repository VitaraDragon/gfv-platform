import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../modules/conto-terzi/views/terreni-clienti-standalone.html', import.meta.url),
  'utf8'
);

describe('B2 — collegamenti terreni clienti solo al clic', () => {
  it('il caricamento lista non interroga i collegamenti per ogni terreno', () => {
    const load = source.slice(
      source.indexOf('async function loadTerreni()'),
      source.indexOf('// Aggiorna info cliente')
    );
    expect(load).not.toContain('getCollegamentiTerreno');
    expect(load).not.toContain('Promise.all(terreniList.map');
  });

  it('il pulsante è neutro e il clic esegue una sola verifica', () => {
    expect(source).toContain('🗑️ Elimina / Archivia');
    const click = source.slice(
      source.lastIndexOf('window.deleteTerrenoConfirm = async function'),
      source.lastIndexOf('window.ripristinaTerrenoCliente')
    );
    expect(click.match(/getCollegamentiTerreno/g)).toHaveLength(2);
    expect(click).toContain('eseguiEliminazioneOArchiviazione');
  });
});

/**
 * Configurazione pagine frutteto per trattamento, potatura e concimazione.
 * L'e2e del salvataggio resta sulla coltura vigneto; qui si verifica che
 * le pagine frutteto abbiano titolo, id del record e gli stessi campi.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PAGINE = [
  {
    file: 'modules/frutteto/views/trattamenti-standalone.html',
    titolo: 'Trattamenti Frutteto',
    idRecord: 'trattamento-frutteto-id',
  },
  {
    file: 'modules/frutteto/views/potatura-standalone.html',
    titolo: 'Potatura Frutteto',
    idRecord: 'potatura-frutteto-id',
  },
  {
    file: 'modules/frutteto/views/concimazioni-standalone.html',
    titolo: 'Concimazioni Frutteto',
    idRecord: 'trattamento-frutteto-id',
  },
];

describe('configurazione operazioni frutteto', () => {
  it.each(PAGINE)('$titolo ha titolo e id record propri', ({ file, titolo, idRecord }) => {
    const html = readFileSync(file, 'utf8');
    expect(html).toContain(`<title>${titolo} - GFV</title>`);
    expect(html).toContain(titolo);
    expect(html).toContain(`id="${idRecord}"`);
  });
});

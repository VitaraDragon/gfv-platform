import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  filterAziendaByModuliAttivi,
  isApriPaginaTargetAllowed,
  sanitizeTonyResultForModules,
} = require('../functions/tony-module-gate.js');

describe('tony-module-gate', () => {
  it('filtra tariffe se contoTerzi off', () => {
    const azienda = {
      tariffe: [{ id: 't1' }],
      clienti: [{ id: 'c1' }],
      terreni: [{ nome: 'Campo 1' }],
      summaryScadenze: '1 affitti in scadenza',
    };
    const out = filterAziendaByModuliAttivi(azienda, ['tony'], {
      buildSummaryScadenze: (terreni, macchine) => (macchine.length ? 'mezzi' : 'solo terreni'),
    });
    expect(out.tariffe).toEqual([]);
    expect(out.clienti).toEqual([]);
    expect(out.terreni).toHaveLength(1);
  });

  it('blocca APRI_PAGINA tariffe senza contoTerzi', () => {
    expect(isApriPaginaTargetAllowed('tariffe', ['tony', 'vigneto'])).toBe(false);
    expect(isApriPaginaTargetAllowed('terreni', ['tony'])).toBe(true);
  });

  it('carburante richiede modulo magazzino', () => {
    expect(isApriPaginaTargetAllowed('carburante', ['tony'])).toBe(false);
    expect(isApriPaginaTargetAllowed('carburante', ['tony', 'magazzino'])).toBe(true);
    expect(isApriPaginaTargetAllowed('hub carburante', ['magazzino'])).toBe(true);
  });

  it('blocca APRI_PAGINA seminativo se il modulo non è attivo', () => {
    expect(isApriPaginaTargetAllowed('seminativo', ['tony', 'vigneto'])).toBe(false);
    expect(isApriPaginaTargetAllowed('seminativo', ['tony', 'seminativo'])).toBe(true);
    expect(isApriPaginaTargetAllowed('piano colturale', ['seminativo'])).toBe(true);
  });

  it('sanitizza comando navigazione modulo inattivo', () => {
    const result = sanitizeTonyResultForModules(
      {
        text: 'Ti porto alla pagina delle tariffe.',
        command: { type: 'APRI_PAGINA', target: 'tariffe' },
      },
      ['tony']
    );
    expect(result.command).toBeUndefined();
    expect(result.text).toMatch(/Conto Terzi.*non è attivo/i);
  });

  it('blocca APRI_PAGINA seminativo se il modulo non è attivo', () => {
    expect(isApriPaginaTargetAllowed('seminativo', ['tony', 'vigneto'])).toBe(false);
    expect(isApriPaginaTargetAllowed('seminativo', ['tony', 'seminativo'])).toBe(true);
    expect(isApriPaginaTargetAllowed('piano colturale', ['seminativo'])).toBe(true);
  });

  it('gate report e vendemmia meccanica', () => {
    expect(isApriPaginaTargetAllowed('report', ['tony'])).toBe(false);
    expect(isApriPaginaTargetAllowed('report', ['report'])).toBe(true);
    expect(isApriPaginaTargetAllowed('vendemmia meccanica', ['vendemmiaMeccanica'])).toBe(true);
    expect(isApriPaginaTargetAllowed('piano stagione', ['vendemmiaMeccanica'])).toBe(true);
  });

});

/** @vitest-environment jsdom */
/**
 * C3: quantità senza NaN nei modelli trattamento. C5: dose con step 0.001 e quantità a 3 decimali.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../core/services/firebase-service.js', () => ({
  dateToTimestamp: (d) => d,
  timestampToDate: (d) => d
}));

import { TrattamentoVigneto } from '../modules/vigneto/models/TrattamentoVigneto.js';
import { TrattamentoFrutteto } from '../modules/frutteto/models/TrattamentoFrutteto.js';
import { quantitaRigaProdotto, formattaQuantita, STEP_DOSE } from '../shared/js/quantita-dose.js';

const leggi = (rel) => readFileSync(resolve(__dirname, '..', rel), 'utf8');

describe('C3 – righe prodotto senza NaN', () => {
  const riga = { prodotto: 'Rame', dosaggio: null, quantita: null, costo: null };
  const righeNonValide = [
    { ...riga },
    { ...riga, dosaggio: '', quantita: '', costo: '' },
    { ...riga, dosaggio: 'x', quantita: 'y', costo: 'z' }
  ];

  it.each([
    ['vigneto', (p) => new TrattamentoVigneto({ vignetoId: 'v1', prodotti: p })],
    ['frutteto', (p) => new TrattamentoFrutteto({ fruttetoId: 'f1', prodotti: p })]
  ])('%s: dosaggio/quantita/costo non numerici → null', (_nome, crea) => {
    for (const r of righeNonValide) {
      const out = crea([r]).toFirestore().prodotti[0];
      expect(out.dosaggio).toBeNull();
      expect(out.quantita).toBeNull();
      expect(out.costo).toBeNull();
    }
  });

  it('valori validi (anche con virgola) restano numeri', () => {
    const t = new TrattamentoVigneto({ vignetoId: 'v1', prodotti: [{ prodotto: 'X', dosaggio: '0,125', quantita: 1.5, costo: '2' }] });
    expect(t.prodotti[0].dosaggio).toBe(0.125);
    expect(t.prodotti[0].quantita).toBe(1.5);
    expect(t.prodotti[0].costo).toBe(2);
  });

  it('formato legacy con costoProdotto null non produce NaN', () => {
    const v = new TrattamentoVigneto({ vignetoId: 'v1', prodotto: 'X', costoProdotto: null });
    const f = new TrattamentoFrutteto({ fruttetoId: 'f1', prodotto: 'X', costoProdotto: null });
    expect(v.prodotti[0].costo).toBeNull();
    expect(f.prodotti[0].costo).toBeNull();
  });
});

describe('C3 – quantità in tabella', () => {
  it('dosaggio × superficie se finiti', () => {
    expect(quantitaRigaProdotto({ dosaggio: 0.125, quantita: 99 }, 2)).toBe(0.25);
  });
  it('altrimenti quantità salvata, altrimenti null → "-"', () => {
    expect(quantitaRigaProdotto({ dosaggio: null, quantita: 1.5 }, 2)).toBe(1.5);
    expect(quantitaRigaProdotto({ dosaggio: NaN, quantita: NaN }, 2)).toBeNull();
    expect(quantitaRigaProdotto({ dosaggio: 1, quantita: null }, 0)).toBeNull();
    expect(formattaQuantita(null)).toBe('-');
    expect(formattaQuantita(NaN)).toBe('-');
  });
});

describe('C5 – dose a 3 decimali', () => {
  it('quantità mostrata in formato italiano, senza zeri fissi', () => {
    expect(STEP_DOSE).toBe('0.001');
    expect(formattaQuantita(0.125 * 2)).toBe('0,25');
    expect(formattaQuantita(0.001)).toBe('0,001');
  });

  it.each([
    ['shared/js/trattamenti-coltura-page.js', /class="prodotto-dosaggio"[^>]*step="0\.001"/],
    ['modules/vigneto/js/concimazioni-page.js', /class="prodotto-dosaggio"[^>]*step="0\.001"/],
    ['modules/frutteto/js/concimazioni-page.js', /class="prodotto-dosaggio"[^>]*step="0\.001"/],
    ['modules/seminativo/js/trattamenti-page.js', /class="prodotto-dosaggio"[^>]*step="0\.001"/],
    ['shared/js/registro-trattamenti-lavoro.js', /class="miscela-dose-extra"[^>]*step="0\.001"/],
    ['modules/magazzino/views/movimenti-standalone.html', /id="mov-quantita"[^>]*step="0\.001"/]
  ])('%s: input dose con step 0.001', (file, re) => {
    expect(leggi(file)).toMatch(re);
    expect(leggi(file)).not.toMatch(/class="(prodotto-dosaggio|miscela-dose-extra)"[^>]*step="0\.01"/);
  });
});

import { describe, it, expect } from 'vitest';
import {
  prodottoCategoriaRichiedeDosaggio,
  prodottoCategoriaRichiedeGiorniCarenza,
  getProdottoDosaggioCarenzaRequiredFieldIds,
  getProdottoDosaggioCarenzaMissingFromDraft,
} from '../core/js/prodotto-form-required.js';

describe('prodotto-form-required', () => {
  it('fitofarmaci richiede dosaggio e carenza', () => {
    expect(prodottoCategoriaRichiedeDosaggio('fitofarmaci')).toBe(true);
    expect(prodottoCategoriaRichiedeGiorniCarenza('fitofarmaci')).toBe(true);
    expect(getProdottoDosaggioCarenzaRequiredFieldIds('fitofarmaci')).toEqual([
      'prodotto-dosaggio-min',
      'prodotto-dosaggio-max',
      'prodotto-giorni-carenza',
    ]);
  });

  it('fertilizzanti richiede solo dosaggio', () => {
    expect(prodottoCategoriaRichiedeDosaggio('fertilizzanti')).toBe(true);
    expect(prodottoCategoriaRichiedeGiorniCarenza('fertilizzanti')).toBe(false);
    expect(getProdottoDosaggioCarenzaRequiredFieldIds('fertilizzanti')).toEqual([
      'prodotto-dosaggio-min',
      'prodotto-dosaggio-max',
    ]);
  });

  it('altro non richiede dosaggio né carenza', () => {
    expect(getProdottoDosaggioCarenzaRequiredFieldIds('altro')).toEqual([]);
  });

  it('draft fitofarmaci incompleto senza dosaggio/carenza', () => {
    const missing = getProdottoDosaggioCarenzaMissingFromDraft({
      'prodotto-categoria': 'fitofarmaci',
      'prodotto-dosaggio-min': '0.5',
    });
    expect(missing).toContain('prodotto-dosaggio-max');
    expect(missing).toContain('prodotto-giorni-carenza');
  });

  it('draft fitofarmaci completo', () => {
    expect(getProdottoDosaggioCarenzaMissingFromDraft({
      'prodotto-categoria': 'fitofarmaci',
      'prodotto-dosaggio-min': '0.5',
      'prodotto-dosaggio-max': '1',
      'prodotto-giorni-carenza': '30',
    })).toEqual([]);
  });
});

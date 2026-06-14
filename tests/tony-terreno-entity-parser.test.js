import { describe, it, expect } from 'vitest';
import { tryTonyTerrenoEntityParse } from '../core/js/tony-terreno-entity-parser.js';

const terreniCtx = {
  page: {
    pageType: 'terreni',
    pagePath: '/core/terreni-standalone.html',
    terreni: { poderi: ['Casetti', 'Barbavara Vecchia'], colture: ['Vite da Vino', 'Kaki'] },
    currentTableData: {
      pageType: 'terreni',
      items: [{ podere: 'Casetti', coltura: 'Vite da Vino' }],
    },
  },
};

describe('tryTonyTerrenoEntityParse', () => {
  it('ignora messaggi non terreno', () => {
    expect(tryTonyTerrenoEntityParse({ message: 'quanti terreni ho', ctx: terreniCtx })).toBeNull();
  });

  it('apre modal vuoto su richiesta generica', () => {
    const r = tryTonyTerrenoEntityParse({ message: 'aggiungi un terreno', ctx: terreniCtx });
    expect(r).not.toBeNull();
    expect(r.command.type).toBe('OPEN_MODAL');
    expect(r.command.id).toBe('terreno-modal');
    expect(r.fieldsCount).toBe(0);
  });

  it('compila campi da messaggio completo', () => {
    const r = tryTonyTerrenoEntityParse({
      message: 'Aggiungi il terreno vigneto sangiovese di 1 ettaro a Casetti coltura vite da vino di proprietà',
      ctx: terreniCtx,
    });
    expect(r.fieldsCount).toBeGreaterThanOrEqual(4);
    expect(r.command.fields['terreno-nome']).toMatch(/vigneto/i);
    expect(r.command.fields['terreno-superficie']).toBe('1');
    expect(r.command.fields['terreno-podere']).toBe('Casetti');
    expect(r.command.fields['terreno-coltura']).toBe('Vite da Vino');
    expect(r.command.fields['terreno-tipo-possesso']).toBe('proprieta');
  });
});

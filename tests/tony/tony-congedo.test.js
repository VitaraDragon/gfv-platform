import { describe, expect, it } from 'vitest';
import { checkFarewellIntent } from '../../core/js/tony/tony-congedo.js';

describe('checkFarewellIntent', () => {
  it('«ciao» primo messaggio (tonyHaGiaRisposto=false) → no', () => {
    expect(checkFarewellIntent('ciao', { tonyHaGiaRisposto: false })).toBe(false);
  });

  it('«ciao» dopo risposta Tony → sì', () => {
    expect(checkFarewellIntent('ciao', { tonyHaGiaRisposto: true })).toBe(true);
  });

  it('congedo esplicito e insulti → sì', () => {
    expect(checkFarewellIntent('vattene', { tonyHaGiaRisposto: false })).toBe(true);
    expect(checkFarewellIntent('vai via', { tonyHaGiaRisposto: false })).toBe(true);
    expect(checkFarewellIntent('fermati', { tonyHaGiaRisposto: false })).toBe(true);
    expect(checkFarewellIntent('basta', { tonyHaGiaRisposto: false })).toBe(true);
    expect(checkFarewellIntent('sei stupido', { tonyHaGiaRisposto: false })).toBe(true);
  });

  it('«ciao, mi segni le ore?» → no', () => {
    expect(checkFarewellIntent('ciao, mi segni le ore?', { tonyHaGiaRisposto: true })).toBe(false);
  });
});

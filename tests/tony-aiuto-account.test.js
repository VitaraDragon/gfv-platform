/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  decidiDopoRisposta,
  serializzaRaccolti,
  unisciDati,
} from '../landing/src/lib/tony-aiuto-account.js';

describe('unisciDati sede', () => {
  it('accetta sede da passo terreni se mancante', () => {
    const { dati } = unisciDati(
      { sede: null, poderi: [], terreni: [] },
      { sede: { citta: 'Faenza', indirizzo: null, cap: null, provincia: null } },
      'terreni'
    );
    expect(dati.sede.citta).toBe('Faenza');
  });
});

describe('decidiDopoRisposta', () => {
  it('apre riepilogo dopo due turni senza novità', () => {
    expect(
      decidiDopoRisposta({ turniSenzaNovitaNelPasso: 2, domandeRimaste: 10 }).apriRiepilogo
    ).toBe(true);
  });

  it('apre riepilogo con poche domande rimaste', () => {
    const r = decidiDopoRisposta({ domandeRimaste: 3 });
    expect(r.apriRiepilogo).toBe(true);
    expect(r.messaggio).toMatch(/riepilogo/i);
  });
});

describe('serializzaRaccolti', () => {
  it('include sede e terreni', () => {
    const t = serializzaRaccolti({
      sede: { citta: 'Faenza', indirizzo: 'Via Roma 1' },
      terreni: [{ nome: 'Campo', superficie: 2, coltura: 'Grano' }],
    });
    expect(t).toMatch(/Sede:/);
    expect(t).toMatch(/Campo/);
  });
});

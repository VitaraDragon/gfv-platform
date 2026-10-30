/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  collegaTerreniAiPoderi,
  corrispondeNomePodere,
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

  it('fonde la sede campo per campo anche se c’è già il comune', () => {
    const { dati } = unisciDati(
      {
        sede: { citta: 'Faenza', indirizzo: null, cap: null, provincia: null },
        poderi: [],
        terreni: [],
      },
      { sede: { citta: null, indirizzo: 'Via Roma 1', cap: '48018', provincia: 'RA' } },
      'sede'
    );
    expect(dati.sede).toEqual({
      citta: 'Faenza',
      indirizzo: 'Via Roma 1',
      cap: '48018',
      provincia: 'RA',
    });
  });
});

describe('unisciDati terreni e poderi', () => {
  it('assegna l’unico podere ai terreni senza podere', () => {
    const { dati } = unisciDati(
      { sede: null, poderi: [{ nome: 'Podere Colle' }], terreni: [] },
      {
        terreni: [
          { nome: 'Vigna Alta', superficie: 1.5, coltura: 'Vite da Vino', podere: null },
        ],
      },
      'terreni'
    );
    expect(dati.terreni[0].podere).toBe('Podere Colle');
  });

  it('allinea «Colle» a «Podere Colle»', () => {
    const { dati } = unisciDati(
      { sede: null, poderi: [{ nome: 'Podere Colle' }], terreni: [] },
      {
        terreni: [
          { nome: 'Vigna', superficie: 2, coltura: null, podere: 'Colle' },
        ],
      },
      'terreni'
    );
    expect(dati.terreni[0].podere).toBe('Podere Colle');
  });

  it('usa ultimoPodere con più poderi', () => {
    const passo1 = unisciDati(
      { sede: null, poderi: [], terreni: [] },
      { poderi: [{ nome: 'Podere Colle' }, { nome: 'Cascina Bassa' }] },
      'poderi'
    );
    expect(passo1.dati.ultimoPodere).toBe('Cascina Bassa');
    const passo2 = unisciDati(
      passo1.dati,
      {
        terreni: [
          { nome: 'Campo', superficie: 1, coltura: 'Grano', podere: null },
        ],
      },
      'terreni'
    );
    expect(passo2.dati.terreni[0].podere).toBe('Cascina Bassa');
  });

  it('senza contesto e con più poderi lascia il podere vuoto', () => {
    const dati = collegaTerreniAiPoderi({
      poderi: [{ nome: 'Podere Colle' }, { nome: 'Cascina Bassa' }],
      terreni: [{ nome: 'Campo', superficie: 1, coltura: null, podere: null }],
      ultimoPodere: null,
    });
    expect(dati.terreni[0].podere).toBeNull();
  });

  it('aggiorna superficie di un terreno già in elenco', () => {
    const { dati } = unisciDati(
      {
        sede: null,
        poderi: [],
        terreni: [
          { nome: 'Vigna Alta', superficie: 5, coltura: 'Vite da Vino', podere: null },
        ],
      },
      {
        terreni: [
          { nome: 'Vigna Alta', superficie: 1.5, coltura: null, podere: null },
        ],
      },
      'terreni'
    );
    expect(dati.terreni).toHaveLength(1);
    expect(dati.terreni[0].superficie).toBe(1.5);
    expect(dati.terreni[0].coltura).toBe('Vite da Vino');
  });
});

describe('corrispondeNomePodere', () => {
  it('riconosce prefissi', () => {
    expect(corrispondeNomePodere('Colle', 'Podere Colle')).toBe(true);
    expect(corrispondeNomePodere('Podere Colle', 'Podere Colle')).toBe(true);
    expect(corrispondeNomePodere('Colle', 'Cascina Bassa')).toBe(false);
  });
});

describe('decidiDopoRisposta', () => {
  it('da sede con 2 turni senza novità passa a poderi, non al riepilogo', () => {
    const r = decidiDopoRisposta({
      turniSenzaNovitaNelPasso: 2,
      domandeRimaste: 10,
      passo: 'sede',
    });
    expect(r.azione).toBe('prossimoPasso');
    expect(r.apriRiepilogo).toBe(false);
    expect(r.messaggio).toMatch(/poderi/i);
  });

  it('da poderi passa a terreni', () => {
    const r = decidiDopoRisposta({
      turniSenzaNovitaNelPasso: 2,
      domandeRimaste: 10,
      passo: 'poderi',
    });
    expect(r.azione).toBe('prossimoPasso');
    expect(r.messaggio).toMatch(/terreni/i);
  });

  it('da terreni apre il riepilogo', () => {
    const r = decidiDopoRisposta({
      turniSenzaNovitaNelPasso: 2,
      domandeRimaste: 10,
      passo: 'terreni',
    });
    expect(r.azione).toBe('riepilogo');
    expect(r.apriRiepilogo).toBe(true);
  });

  it('con poche domande rimaste apre il riepilogo', () => {
    const r = decidiDopoRisposta({ domandeRimaste: 3, passo: 'sede' });
    expect(r.azione).toBe('riepilogo');
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

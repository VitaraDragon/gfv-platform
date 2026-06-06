import { describe, it, expect } from 'vitest';
import {
  parsePrezzoUnitarioCatalogo,
  getPrezzoUnitarioFromCatalog,
  getPrezzoFromMovProdottoSelectDom,
  enrichMovimentoFormDataFromCatalog,
  isMovimentoEntrataTipo,
} from '../core/js/movimento-prezzo-catalogo.js';

const catalog = [
  { id: 'p1', nome: 'Nimrod', prezzoUnitario: 45 },
  { id: 'p2', nome: 'Concime', prezzoUnitario: null },
];

describe('parsePrezzoUnitarioCatalogo', () => {
  it('accetta numeri validi', () => {
    expect(parsePrezzoUnitarioCatalogo(45)).toBe(45);
    expect(parsePrezzoUnitarioCatalogo('12.5')).toBe(12.5);
  });

  it('rifiuta negativi e non numeri', () => {
    expect(parsePrezzoUnitarioCatalogo(-1)).toBe(null);
    expect(parsePrezzoUnitarioCatalogo('abc')).toBe(null);
    expect(parsePrezzoUnitarioCatalogo('')).toBe(null);
  });
});

describe('getPrezzoUnitarioFromCatalog', () => {
  it('trova prezzo per id', () => {
    expect(getPrezzoUnitarioFromCatalog('p1', catalog)).toBe(45);
  });

  it('null se prodotto senza prezzo', () => {
    expect(getPrezzoUnitarioFromCatalog('p2', catalog)).toBe(null);
  });
});

describe('enrichMovimentoFormDataFromCatalog', () => {
  it('aggiunge mov-prezzo su entrata se mancante', () => {
    const out = enrichMovimentoFormDataFromCatalog({
      'mov-prodotto': 'p1',
      'mov-tipo': 'entrata',
      'mov-quantita': '10',
    }, { context: { azienda: { prodotti: catalog } } });
    expect(out['mov-prezzo']).toBe('45');
  });

  it('non sovrascrive prezzo già indicato', () => {
    const out = enrichMovimentoFormDataFromCatalog({
      'mov-prodotto': 'p1',
      'mov-tipo': 'entrata',
      'mov-prezzo': '42',
    }, { context: { azienda: { prodotti: catalog } } });
    expect(out['mov-prezzo']).toBe('42');
  });

  it('non aggiunge prezzo su uscita', () => {
    const out = enrichMovimentoFormDataFromCatalog({
      'mov-prodotto': 'p1',
      'mov-tipo': 'uscita',
    }, { context: { azienda: { prodotti: catalog } } });
    expect(out['mov-prezzo']).toBeUndefined();
  });

  it('usa pageProdotti se context senza prezzoUnitario', () => {
    const out = enrichMovimentoFormDataFromCatalog({
      'mov-prodotto': 'p1',
      'mov-tipo': 'entrata',
    }, { context: { azienda: { prodotti: [{ id: 'p1', nome: 'Nimrod' }] } }, pageProdotti: catalog });
    expect(out['mov-prezzo']).toBe('45');
  });
});

describe('isMovimentoEntrataTipo', () => {
  it('riconosce entrata', () => {
    expect(isMovimentoEntrataTipo('entrata')).toBe(true);
    expect(isMovimentoEntrataTipo('uscita')).toBe(false);
  });
});

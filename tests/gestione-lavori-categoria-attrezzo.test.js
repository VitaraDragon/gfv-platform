import { describe, expect, it } from 'vitest';
import { getNomeCategoria } from '../core/admin/js/gestione-lavori-controller.js';

const categorieAttrezzi = [
  { id: 'cat_lt', nome: 'Lavorazione del Terreno', codice: 'lavorazione_terreno' },
  { id: 'cat_tr', nome: 'Trattamenti', codice: 'trattamenti' },
];

describe('getNomeCategoria — categorie attrezzi', () => {
  it('risolve per id Firestore', () => {
    expect(getNomeCategoria('cat_tr', categorieAttrezzi, [], new Map())).toBe('Trattamenti');
  });

  it('risolve per codice (seed sim / legacy)', () => {
    expect(getNomeCategoria('trattamenti', categorieAttrezzi, [], new Map())).toBe('Trattamenti');
  });

  it('restituisce Categoria sconosciuta se assente', () => {
    expect(getNomeCategoria('xyz', categorieAttrezzi, [], new Map())).toBe('Categoria sconosciuta');
  });

  it('fallback codice noto se lista categorie vuota (sim/legacy)', () => {
    expect(getNomeCategoria('trattamenti', [], [], new Map())).toBe('Trattamenti');
  });
});

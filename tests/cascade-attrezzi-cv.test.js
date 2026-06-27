import { describe, expect, it } from 'vitest';
import {
  attrezziCompatibiliConTrattoreCv,
  filterAttrezziDropdownCompatibili,
} from '../core/js/macchine-cv-compat.js';

const ATTREZZI = [
  { id: 'at-40', nome: 'Erpice leggero', cavalliMinimiRichiesti: 40, stato: 'disponibile' },
  { id: 'at-75', nome: 'Seminatrice pesante', cavalliMinimiRichiesti: 75, stato: 'disponibile' },
  { id: 'at-100', nome: 'Erpice rotante 350', cavalliMinimiRichiesti: 100, stato: 'disponibile' },
  { id: 'at-dismesso', nome: 'Vecchio aratro', cavalliMinimiRichiesti: 30, stato: 'dismesso' },
];

describe('cascade CV trattore → attrezzi (X → Y)', () => {
  it('trattore 50 CV → escluso attrezzo min 75, incluso min 40', () => {
    const trattore = { id: 'tr-50', nome: 'Trattore 50', cavalli: 50 };
    const ids = filterAttrezziDropdownCompatibili(trattore, ATTREZZI).map((a) => a.id);
    expect(ids).toContain('at-40');
    expect(ids).not.toContain('at-75');
    expect(ids).not.toContain('at-100');
    expect(ids).not.toContain('at-dismesso');
  });

  it('trattore 100 CV → entrambi attrezzi 40 e 75 e 100', () => {
    const trattore = { id: 'tr-100', nome: 'Nuovo T5', cavalli: 100 };
    const ids = filterAttrezziDropdownCompatibili(trattore, ATTREZZI).map((a) => a.id);
    expect(ids).toEqual(['at-40', 'at-75', 'at-100']);
  });

  it('trattore senza potenza CV → nessun filtro CV (tutti non dismessi)', () => {
    const trattore = { id: 'tr-nc', nome: 'Trattore senza CV', cavalli: null };
    const ids = filterAttrezziDropdownCompatibili(trattore, ATTREZZI).map((a) => a.id);
    expect(ids).toEqual(['at-40', 'at-75', 'at-100']);
  });

  it('attrezziCompatibiliConTrattoreCv — 80 CV solo erpice 40 (Tony/inverso)', () => {
    const attrezzi = [
      { id: 'at-200', nome: 'erpice rotante 200', cavalliMinimiRichiesti: 40 },
      { id: 'at-350', nome: 'erpice rotante 350', cavalliMinimiRichiesti: 100 },
    ];
    const hit = attrezziCompatibiliConTrattoreCv({ nome: 'Agrifull', cavalli: 80 }, attrezzi);
    expect(hit.map((a) => a.id)).toEqual(['at-200']);
  });

  it('attrezziCompatibiliConTrattoreCv — senza CV trattore restituisce lista intera', () => {
    const hit = attrezziCompatibiliConTrattoreCv({ nome: 'Senza CV' }, ATTREZZI);
    expect(hit.length).toBe(ATTREZZI.length);
  });
});

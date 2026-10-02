import { describe, it, expect } from 'vitest';
import {
  CATEGORIE_PRODOTTO,
  isCategoriaProdottoId,
  normalizeCategoriaProdottoId,
} from '../modules/magazzino/config/categorie-prodotto.js';

describe('categorie-prodotto', () => {
  it('include carburante come categoria di prima classe', () => {
    const row = CATEGORIE_PRODOTTO.find((c) => c.id === 'carburante');
    expect(row).toBeTruthy();
    expect(row.nome).toBe('Carburante');
    expect(isCategoriaProdottoId('carburante')).toBe(true);
  });

  it('normalizza gasolio / diesel / benzina / adblue → carburante', () => {
    expect(normalizeCategoriaProdottoId('gasolio')).toBe('carburante');
    expect(normalizeCategoriaProdottoId('GASOLIO AGRICOLO')).toBe('carburante');
    expect(normalizeCategoriaProdottoId('diesel')).toBe('carburante');
    expect(normalizeCategoriaProdottoId('benzina')).toBe('carburante');
    expect(normalizeCategoriaProdottoId('AdBlue')).toBe('carburante');
    expect(normalizeCategoriaProdottoId('ad blue')).toBe('carburante');
    expect(normalizeCategoriaProdottoId('carburanti')).toBe('carburante');
  });

  it('non mappa urea (concime) a carburante', () => {
    expect(normalizeCategoriaProdottoId('urea')).not.toBe('carburante');
  });

  it('resta compatibile con i sinonimi già usati da Tony', () => {
    expect(normalizeCategoriaProdottoId('concime')).toBe('fertilizzanti');
    expect(normalizeCategoriaProdottoId('fitofarmaco')).toBe('fitofarmaci');
    expect(normalizeCategoriaProdottoId('ricambio')).toBe('ricambi');
  });
});

/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { configuraMiscelaPerModuli } from '../shared/js/registro-trattamenti-lavoro.js';
import { righeTrattamentoDaMiscela } from '../shared/js/registro-trattamenti.js';

describe('A2 — miscela lavoro senza Magazzino', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="lavoro-miscela-prodotto-group">
        <select id="lavoro-miscela-prodotto"><option value="p1">Rame</option></select>
      </div>
      <label id="lavoro-miscela-nome-label"></label>
      <input id="lavoro-miscela-nome">
    `;
  });

  it('senza Magazzino non mostra il select prodotti e lascia il nome libero', () => {
    configuraMiscelaPerModuli(['manodopera']);
    expect(document.getElementById('lavoro-miscela-prodotto-group').hidden).toBe(true);
    expect(document.querySelector('#lavoro-miscela-prodotto:not([disabled])')).toBeNull();
    expect(document.getElementById('lavoro-miscela-nome-label').textContent).toBe('Nome prodotto');
  });

  it('con Magazzino mantiene il select prodotti', () => {
    configuraMiscelaPerModuli(['magazzino']);
    expect(document.getElementById('lavoro-miscela-prodotto-group').hidden).toBe(false);
    expect(document.getElementById('lavoro-miscela-prodotto').disabled).toBe(false);
  });

  it('le righe libere non hanno prodottoId né valori NaN', () => {
    const result = righeTrattamentoDaMiscela({
      prodotti: [{ nome: 'Rame', dosePerEttaro: '2' }]
    }, 1.5);
    expect(result.prodotti[0]).toMatchObject({
      prodottoId: null,
      prodotto: 'Rame',
      dosaggio: 2,
      quantita: 3
    });
    expect(Object.values(result.prodotti[0]).some(Number.isNaN)).toBe(false);
  });
});

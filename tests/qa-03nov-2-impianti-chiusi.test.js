/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { impiantiAperti, tieniImpiantoNellaTendina } from '../shared/js/impianto-tendina.js';

describe('tendine impianti chiusi', () => {
  const lista = [
    { id: 'aperto', varieta: 'Sangiovese', statoImpianto: 'attivo' },
    { id: 'chiuso', varieta: 'Vecchio', statoImpianto: 'chiuso' }
  ];

  it('la tendina nuova esclude i chiusi e la modifica tiene quello della riga', () => {
    expect(impiantiAperti(lista).map((v) => v.id)).toEqual(['aperto']);
    expect(impiantiAperti(lista, 'chiuso').map((v) => v.id)).toEqual(['aperto', 'chiuso']);
  });

  it('in modifica aggiunge l\'impianto chiuso alla tendina', () => {
    document.body.innerHTML = `
      <select id="vigneto">
        <option value="">Seleziona</option>
        <option value="aperto">Sangiovese</option>
      </select>
    `;
    const select = document.getElementById('vigneto');
    tieniImpiantoNellaTendina(select, lista[1], (v) => v.varieta);
    select.value = 'chiuso';
    expect(select.value).toBe('chiuso');
    expect(select.options[select.selectedIndex].textContent).toBe('Vecchio');
  });
});

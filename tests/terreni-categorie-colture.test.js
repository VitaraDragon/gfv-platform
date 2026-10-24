/**
 * Deduplica categorie coltura omonime nel form terreno.
 * Bug: seed può creare doc stesso nome/codice con id diversi; la prima copia
 * nel select non ha colture («Nessuna coltura disponibile»), la seconda sì.
 */
import { describe, it, expect } from 'vitest';
import {
  chiaveDedupeCategoria,
  conteggioColtureCategoria,
  confrontaCategorieDuplicate,
  dedupeCategorieColture,
  opzioniSelectCategorieColture,
  popolaSelectCategorieColture,
} from '../core/js/terreni-categorie-colture.js';

function fakeSelect(initialValue = '') {
  const options = [];
  return {
    options,
    value: initialValue,
    set innerHTML(_html) {
      options.length = 0;
    },
    get innerHTML() {
      return options.map((o) => `<option value="${o.value}">${o.textContent}</option>`).join('');
    },
    appendChild(opt) {
      options.push(opt);
      return opt;
    },
  };
}

const createElement = () => ({ value: '', textContent: '' });

describe('chiaveDedupeCategoria', () => {
  it('preferisce il codice normalizzato', () => {
    expect(chiaveDedupeCategoria({ codice: ' Vite ', nome: 'Altro' })).toBe('c:vite');
  });

  it('usa il nome se manca il codice', () => {
    expect(chiaveDedupeCategoria({ nome: ' Frutteto ' })).toBe('n:frutteto');
  });
});

describe('dedupeCategorieColture', () => {
  const orfana = {
    id: 'id-orfana',
    nome: 'Vite',
    codice: 'vite',
    predefinita: true,
    ordine: 3,
  };
  const conColture = {
    id: 'id-buona',
    nome: 'Vite',
    codice: 'vite',
    predefinita: true,
    ordine: 3,
  };
  const altra = {
    id: 'id-frutteto',
    nome: 'Frutteto',
    codice: 'frutteto',
    predefinita: true,
    ordine: 1,
  };

  it('con due doc stesso codice tiene quella che ha colture', () => {
    const colturePerCategoria = {
      'id-buona': [{ id: 'c1', nome: 'Chardonnay' }],
    };
    const out = dedupeCategorieColture([orfana, conColture, altra], colturePerCategoria);
    expect(out.map((c) => c.id)).toEqual(['id-frutteto', 'id-buona']);
  });

  it('senza mappa colture preferisce predefinita poi ordine', () => {
    const a = { id: 'a', nome: 'Vite', codice: 'vite', predefinita: false, ordine: 1 };
    const b = { id: 'b', nome: 'Vite', codice: 'vite', predefinita: true, ordine: 9 };
    const out = dedupeCategorieColture([a, b], {});
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b');
  });

  it('dedupe anche per nome se manca codice', () => {
    const a = { id: 'x1', nome: 'Orto', ordine: 2 };
    const b = { id: 'x2', nome: 'Orto', ordine: 1 };
    const out = dedupeCategorieColture([a, b], { x1: [{ nome: 'Pomodoro' }] });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('x1');
  });
});

describe('confrontaCategorieDuplicate / conteggio', () => {
  it('conteggioColtureCategoria legge la mappa', () => {
    expect(conteggioColtureCategoria({ id: 'a' }, { a: [1, 2] })).toBe(2);
    expect(conteggioColtureCategoria({ id: 'a' }, {})).toBe(0);
  });

  it('preferisce chi ha colture', () => {
    const a = { id: 'a', predefinita: true, ordine: 1 };
    const b = { id: 'b', predefinita: false, ordine: 99 };
    const map = { b: [{ nome: 'x' }] };
    expect(confrontaCategorieDuplicate(b, a, map)).toBeLessThan(0);
  });
});

describe('popolaSelectCategorieColture', () => {
  it('nel select resta solo la categoria con colture (stesso codice)', () => {
    const select = fakeSelect();
    const categorie = [
      { id: 'orfana', nome: 'Vite', codice: 'vite', ordine: 3, predefinita: true },
      { id: 'buona', nome: 'Vite', codice: 'vite', ordine: 3, predefinita: true },
      { id: 'frutteto', nome: 'Frutteto', codice: 'frutteto', ordine: 1, predefinita: true },
    ];
    const colturePerCategoria = {
      buona: [{ id: 'c1', nome: 'Chardonnay' }],
    };

    const shown = popolaSelectCategorieColture(select, categorie, colturePerCategoria, {
      createElement,
    });

    expect(shown.map((c) => c.id)).toEqual(['frutteto', 'buona']);
    const values = select.options.map((o) => o.value).filter(Boolean);
    expect(values).toEqual(['frutteto', 'buona']);
    expect(select.options.some((o) => o.value === 'orfana')).toBe(false);
  });

  it('dopo «seed» simulato il select si aggiorna dalla copia orfana a quella con colture', () => {
    const select = fakeSelect('orfana');
    const categorie = [
      { id: 'orfana', nome: 'Vite', codice: 'vite', ordine: 3, predefinita: true },
      { id: 'buona', nome: 'Vite', codice: 'vite', ordine: 3, predefinita: true },
    ];

    // Prima del seed: nessuna coltura nota → resta una sola (predefinita/ordine/id)
    popolaSelectCategorieColture(select, categorie, {}, { createElement });
    expect(select.options.filter((o) => o.value).map((o) => o.value)).toHaveLength(1);

    // Dopo seed: la copia «buona» ha colture → il select mostra quella
    const dopoSeed = {
      buona: [{ id: 'c1', nome: 'Chardonnay' }, { id: 'c2', nome: 'Merlot' }],
    };
    popolaSelectCategorieColture(select, categorie, dopoSeed, { createElement });
    const values = select.options.filter((o) => o.value).map((o) => o.value);
    expect(values).toEqual(['buona']);
    expect(select.value).toBe(''); // previous «orfana» non è più tra le opzioni
  });

  it('con messaggioErrore non mostra categorie (fallback catch)', () => {
    const select = fakeSelect();
    const shown = popolaSelectCategorieColture(
      select,
      [{ id: 'a', nome: 'Vite', codice: 'vite' }],
      {},
      { messaggioErrore: '-- Errore caricamento colture --', createElement }
    );
    expect(shown).toEqual([]);
    expect(select.options).toHaveLength(1);
    expect(select.options[0].textContent).toContain('Errore');
  });

  it('opzioniSelectCategorieColture allinea value/text', () => {
    const opts = opzioniSelectCategorieColture(
      [
        { id: '1', nome: 'A', codice: 'a', ordine: 2 },
        { id: '2', nome: 'A', codice: 'a', ordine: 2 },
      ],
      { '1': [{ nome: 'x' }] }
    );
    expect(opts).toEqual([{ value: '1', text: 'A' }]);
  });
});

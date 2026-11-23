/**
 * @vitest-environment jsdom
 *
 * Dopo una ricarica, un loadTipiLavoro() globale (senza categoria) non deve
 * smontare Tipo Lavoro Specifico / Miscela già compilati in Modifica.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../shared/js/registro-trattamenti-lavoro.js', async () => {
  const actual = await vi.importActual('../shared/js/registro-trattamenti-lavoro.js');
  return {
    ...actual,
    notificaSezioneMiscelaSeVisibile: vi.fn(() => ({ visibile: true }))
  };
});

import { populateTipoLavoroDropdown } from '../core/admin/js/gestione-lavori-controller.js';
import {
  scriviMiscelaNelForm,
  aggiornaSezioneMiscelaLavoro
} from '../shared/js/registro-trattamenti-lavoro.js';

function formTrattamento() {
  document.body.innerHTML = `
    <form id="lavoro-form">
      <select id="lavoro-categoria-principale">
        <option value="">—</option>
        <option value="cat-tratt" selected>Trattamenti</option>
      </select>
      <select id="lavoro-sottocategoria"><option value=""></option></select>
      <div id="lavoro-sottocategoria-group" style="display:none"></div>
      <div id="tipo-lavoro-group" style="display:block">
        <select id="lavoro-tipo-lavoro">
          <option value="">—</option>
        </select>
      </div>
      <select id="lavoro-terreno">
        <option value="">—</option>
        <option value="t1" selected>Grano</option>
      </select>
      <div id="lavoro-miscela-section" style="display:none">
        <select id="lavoro-miscela-prodotto">
          <option value="">—</option>
          <option value="p1">KARATE ZEON</option>
        </select>
        <input id="lavoro-miscela-nome">
        <input id="lavoro-miscela-dose-ha">
        <select id="lavoro-miscela-avversita"><option value="">—</option></select>
        <input id="lavoro-acqua-hl-ha">
        <input id="lavoro-acqua-hl-tot">
        <tbody id="tbody-miscela-lavoro"></tbody>
        <div id="lavoro-miscela-anteprima"></div>
      </div>
    </form>
  `;
}

describe('tipo/miscela dopo caricamento tipi tardivo', () => {
  beforeEach(() => {
    formTrattamento();
    window.lavoriState = { terreniList: [{ id: 't1', coltura: 'Grano' }] };
  });

  it('populateTipoLavoroDropdown senza categoria non azzera tipo e miscela già compilati', () => {
    const tipi = [
      { id: 'tipo1', nome: 'Trattamento Insetticida Manuale', categoriaId: 'cat-tratt' },
      { id: 'tipo2', nome: 'Trattamento Fungicida Manuale', categoriaId: 'cat-tratt' }
    ];
    const categorie = [{ id: 'cat-tratt', nome: 'Trattamenti fitosanitari' }];

    populateTipoLavoroDropdown(
      'cat-tratt',
      'Trattamento Insetticida Manuale',
      tipi,
      tipi,
      categorie,
      new Map()
    );
    expect(document.getElementById('lavoro-tipo-lavoro').value).toBe('Trattamento Insetticida Manuale');
    aggiornaSezioneMiscelaLavoro();
    expect(document.getElementById('lavoro-miscela-section').style.display).toBe('block');

    scriviMiscelaNelForm({
      prodotti: [{ prodottoId: 'p1', nome: 'KARATE ZEON', dosePerEttaro: 1.5 }],
      ettolitriPerEttaro: 4
    });
    expect(document.getElementById('lavoro-miscela-prodotto').value).toBe('p1');
    expect(document.getElementById('lavoro-miscela-dose-ha').value).toBe('1.5');

    // Simula loadTipiLavoro() di init che finisce dopo Modifica (categoriaId null).
    populateTipoLavoroDropdown(null, null, tipi, tipi, categorie, new Map());

    expect(document.getElementById('lavoro-tipo-lavoro').value).toBe('Trattamento Insetticida Manuale');
    expect(document.getElementById('tipo-lavoro-group').style.display).not.toBe('none');
    expect(document.getElementById('lavoro-miscela-prodotto').value).toBe('p1');
    expect(document.getElementById('lavoro-miscela-dose-ha').value).toBe('1.5');
    aggiornaSezioneMiscelaLavoro();
    expect(document.getElementById('lavoro-miscela-section').style.display).toBe('block');
  });

  it('un reload con la stessa categoria conserva il tipo selezionato (selectedValue null)', () => {
    const tipi = [
      { id: 'tipo1', nome: 'Trattamento Insetticida Manuale', categoriaId: 'cat-tratt' },
      { id: 'tipo2', nome: 'Trattamento Fungicida Manuale', categoriaId: 'cat-tratt' }
    ];
    const categorie = [{ id: 'cat-tratt', nome: 'Trattamenti fitosanitari' }];

    populateTipoLavoroDropdown(
      'cat-tratt',
      'Trattamento Insetticida Manuale',
      tipi,
      tipi,
      categorie,
      new Map()
    );
    populateTipoLavoroDropdown('cat-tratt', null, tipi, tipi, categorie, new Map());

    expect(document.getElementById('lavoro-tipo-lavoro').value).toBe('Trattamento Insetticida Manuale');
  });
});

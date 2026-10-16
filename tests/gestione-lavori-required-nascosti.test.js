/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { populateCategoriaLavoroDropdown } from '../core/admin/js/gestione-lavori-controller.js';
import { setupTipoAssegnazioneHandlers } from '../core/admin/js/gestione-lavori-events.js';
import {
  etichettaCampoLavoro,
  primoCampoVisibileNonValido,
  syncRequiredConVisibilita,
} from '../core/admin/js/gestione-lavori-utils.js';

function formBase() {
  document.body.innerHTML = `
    <form id="lavoro-form">
      <label for="lavoro-nome">Nome Lavoro *</label>
      <input id="lavoro-nome" required>
      <div id="nascosto" style="display:none">
        <label for="campo-nascosto">Campo nascosto *</label>
        <input id="campo-nascosto" required>
      </div>
      <div id="caposquadra-group">
        <label for="lavoro-caposquadra" id="label-caposquadra">Caposquadra *</label>
        <select id="lavoro-caposquadra" required data-required-orig="1">
          <option value="">Seleziona caposquadra...</option>
          <option value="c1">Mario</option>
        </select>
      </div>
      <div id="operaio-group" style="display:none">
        <label for="lavoro-operaio" id="label-operaio">Operaio Responsabile *</label>
        <select id="lavoro-operaio" required data-required-orig="1">
          <option value="">Seleziona operaio...</option>
          <option value="o1">Luca</option>
        </select>
      </div>
      <input type="radio" name="tipo-assegnazione" value="squadra" id="tipo-squadra" checked>
      <input type="radio" name="tipo-assegnazione" value="autonomo" id="tipo-autonomo">
    </form>
  `;
  return document.getElementById('lavoro-form');
}

describe('syncRequiredConVisibilita', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('toglie required al campo nascosto e lo lascia sul visibile', () => {
    const form = formBase();
    syncRequiredConVisibilita(form);

    const visibile = document.getElementById('lavoro-nome');
    const nascosto = document.getElementById('campo-nascosto');
    expect(visibile.required).toBe(true);
    expect(visibile.disabled).toBe(false);
    expect(nascosto.required).toBe(false);
    expect(nascosto.disabled).toBe(true);
    expect(nascosto.getAttribute('data-required-orig')).toBe('1');
  });

  it('squadra: solo il caposquadra resta required', () => {
    const form = formBase();
    syncRequiredConVisibilita(form);

    expect(document.getElementById('lavoro-caposquadra').required).toBe(true);
    expect(document.getElementById('lavoro-operaio').required).toBe(false);
  });

  it('autonomo: solo l\'operaio resta required', () => {
    const form = formBase();
    document.getElementById('caposquadra-group').style.display = 'none';
    document.getElementById('operaio-group').style.display = 'block';
    syncRequiredConVisibilita(form);

    expect(document.getElementById('lavoro-caposquadra').required).toBe(false);
    expect(document.getElementById('lavoro-operaio').required).toBe(true);
    expect(document.getElementById('lavoro-operaio').disabled).toBe(false);
  });

  it('il messaggio usa l\'etichetta del primo campo visibile non valido', () => {
    const form = formBase();
    syncRequiredConVisibilita(form);
    const mancante = primoCampoVisibileNonValido(form);
    expect(mancante.id).toBe('lavoro-nome');
    expect(etichettaCampoLavoro(mancante)).toBe('Nome Lavoro');
    expect(form.querySelector('#campo-nascosto').required).toBe(false);
  });
});

describe('setupTipoAssegnazioneHandlers — required e visibilità', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('squadra poi autonomo: required segue il gruppo visibile', () => {
    formBase();
    setupTipoAssegnazioneHandlers(true);

    const capo = document.getElementById('lavoro-caposquadra');
    const operaio = document.getElementById('lavoro-operaio');
    expect(capo.required).toBe(true);
    expect(operaio.required).toBe(false);

    document.getElementById('tipo-squadra').checked = false;
    document.getElementById('tipo-autonomo').checked = true;
    setupTipoAssegnazioneHandlers(true);

    expect(capo.required).toBe(false);
    expect(operaio.required).toBe(true);
  });
});

describe('populateCategoriaLavoroDropdown — non perde la selezione', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('se il ripopolamento non passa un id, resta la categoria già scelta', () => {
    document.body.innerHTML = `
      <select id="lavoro-categoria-principale">
        <option value="">-- Seleziona categoria principale --</option>
        <option value="cat-a">Potatura</option>
      </select>
    `;
    const select = document.getElementById('lavoro-categoria-principale');
    select.value = 'cat-a';

    populateCategoriaLavoroDropdown([
      { id: 'cat-a', nome: 'Potatura' },
      { id: 'cat-b', nome: 'Raccolta' },
    ]);

    expect(select.value).toBe('cat-a');
  });

  it('un id esplicito sostituisce la selezione precedente', () => {
    document.body.innerHTML = `
      <select id="lavoro-categoria-principale">
        <option value="">-- Seleziona categoria principale --</option>
        <option value="cat-a">Potatura</option>
      </select>
    `;
    const select = document.getElementById('lavoro-categoria-principale');
    select.value = 'cat-a';

    populateCategoriaLavoroDropdown([
      { id: 'cat-a', nome: 'Potatura' },
      { id: 'cat-b', nome: 'Raccolta' },
    ], 'cat-b');

    expect(select.value).toBe('cat-b');
  });
});

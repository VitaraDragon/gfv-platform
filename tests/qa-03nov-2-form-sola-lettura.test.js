/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { applicaSolaLetturaAlForm } from '../shared/js/form-sola-lettura.js';

describe('form in sola lettura', () => {
  it('nasconde Salva', () => {
    document.body.innerHTML = `
      <form id="lavoro-form">
        <input name="nome" value="Potatura">
        <button type="submit">Salva</button>
      </form>
    `;
    const form = document.getElementById('lavoro-form');
    const esito = applicaSolaLetturaAlForm(form, { solaLettura: true });
    expect(esito.salvaVisibile).toBe(false);
    expect(form.querySelector('button').style.display).toBe('none');
    expect(form.querySelector('#banner-sola-lettura')).toBeTruthy();
  });

  it('togliere la sola lettura riaccende solo i campi spenti da lei', () => {
    document.body.innerHTML = `
      <form id="lavoro-form">
        <input id="nome" value="Potatura">
        <input id="gia-spento" disabled>
        <button type="submit">Salva</button>
      </form>
    `;
    const form = document.getElementById('lavoro-form');
    applicaSolaLetturaAlForm(form, { solaLettura: true });
    const giaSpento = document.getElementById('gia-spento');
    giaSpento.disabled = true;
    giaSpento.removeAttribute('data-sola-lettura-spento');

    applicaSolaLetturaAlForm(form, { solaLettura: false });

    expect(document.getElementById('nome').disabled).toBe(false);
    expect(giaSpento.disabled).toBe(true);
    expect(giaSpento.hasAttribute('data-sola-lettura-spento')).toBe(false);
    expect(form.querySelector('button').style.display).not.toBe('none');
    expect(form.querySelector('#banner-sola-lettura')).toBeNull();
  });
});

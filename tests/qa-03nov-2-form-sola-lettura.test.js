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
});

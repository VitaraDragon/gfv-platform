/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { getNomeVisualizzato } from '../core/js/nome-visualizzato.js';

describe('getNomeVisualizzato', () => {
  it('nome completo', () => {
    expect(getNomeVisualizzato({ nome: 'Mario', cognome: 'Rossi', nomeAzienda: 'Azienda', email: 'a@b.it' }))
      .toBe('Mario Rossi');
  });

  it('solo nome', () => {
    expect(getNomeVisualizzato({ nome: 'Mario', cognome: '', nomeAzienda: 'Azienda', email: 'a@b.it' }))
      .toBe('Mario');
  });

  it('solo cognome', () => {
    expect(getNomeVisualizzato({ nome: '', cognome: 'Rossi', nomeAzienda: 'Azienda', email: 'a@b.it' }))
      .toBe('Rossi');
  });

  it('niente nome → azienda', () => {
    expect(getNomeVisualizzato({ nome: '', cognome: null, nomeAzienda: 'Vigneto Rossi', email: 'mario@esempio.it' }))
      .toBe('Vigneto Rossi');
  });

  it('niente azienda → parte email prima di @', () => {
    expect(getNomeVisualizzato({ nome: '  ', cognome: '', nomeAzienda: '', email: 'mario.rossi@esempio.it' }))
      .toBe('mario.rossi');
  });

  it('niente di tutto → stringa vuota', () => {
    expect(getNomeVisualizzato({})).toBe('');
    expect(getNomeVisualizzato({ nome: null, cognome: undefined, nomeAzienda: '', email: 'senza-chiocciola' }))
      .toBe('');
    expect(getNomeVisualizzato(null)).toBe('');
  });

  it('mai «undefined» o spazi in più', () => {
    expect(getNomeVisualizzato({ nome: 'Mario ', cognome: ' Rossi' })).toBe('Mario Rossi');
    expect(getNomeVisualizzato({ nome: undefined, cognome: undefined, email: undefined })).toBe('');
  });
});

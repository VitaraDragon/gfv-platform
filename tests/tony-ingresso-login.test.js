import { describe, it, expect } from 'vitest';
import { spiegaIngressoDopoLogin } from '../core/js/tony/tony-ingresso-login.js';

describe('spiegaIngressoDopoLogin', () => {
  it('operaio con Manodopera va nell’area di lavoro', () => {
    const esito = spiegaIngressoDopoLogin({
      ruoli: ['operaio'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('workspace');
    expect(esito.motivo).toMatch(/operaio/i);
  });

  it('il manager resta in dashboard', () => {
    const esito = spiegaIngressoDopoLogin({
      ruoli: ['manager'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('dashboard');
    expect(esito.motivo).toBe('manager');
  });

  it('l’amministratore resta in dashboard anche dopo i rimbalzi', () => {
    const esito = spiegaIngressoDopoLogin({
      ruoli: ['amministratore'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 2,
    });
    expect(esito.scelta).toBe('dashboard');
  });

  it('operaio senza Manodopera resta in dashboard', () => {
    const esito = spiegaIngressoDopoLogin({
      ruoli: ['operaio'],
      moduli: ['magazzino'],
      preferenza: 'auto',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('dashboard');
    expect(esito.motivo).toBe('senza manodopera');
  });

  it('la preferenza classica tiene la dashboard', () => {
    const esito = spiegaIngressoDopoLogin({
      ruoli: ['operaio'],
      moduli: ['manodopera'],
      preferenza: 'classic',
      rimbalzi: 0,
    });
    expect(esito.scelta).toBe('dashboard');
    expect(esito.motivo).toBe('preferenza classica');
  });

  it('dopo un solo rimbalzo si riprova l’area di lavoro', () => {
    const esito = spiegaIngressoDopoLogin({
      ruoli: ['operaio'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 1,
    });
    expect(esito.scelta).toBe('workspace');
  });

  it('al secondo rimbalzo si ferma', () => {
    const esito = spiegaIngressoDopoLogin({
      ruoli: ['caposquadra'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 2,
    });
    expect(esito.scelta).toBe('errore');
    expect(esito.motivo).toBe('secondo rimbalzo');
  });
});

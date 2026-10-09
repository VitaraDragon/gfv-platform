import { describe, it, expect } from 'vitest';
import { decidiIngressoDopoLogin } from '../core/js/tony/tony-ingresso-login.js';

describe('ingresso dopo il login', () => {
  it('operaio con Manodopera va nell’area di lavoro', () => {
    expect(decidiIngressoDopoLogin({
      ruoli: ['operaio'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 0,
    })).toBe('workspace');
  });

  it('il manager resta in dashboard', () => {
    expect(decidiIngressoDopoLogin({
      ruoli: ['manager'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 0,
    })).toBe('dashboard');
  });

  it('operaio senza Manodopera resta in dashboard', () => {
    expect(decidiIngressoDopoLogin({
      ruoli: ['operaio'],
      moduli: ['magazzino'],
      preferenza: 'auto',
      rimbalzi: 0,
    })).toBe('dashboard');
  });

  it('la preferenza classica tiene la dashboard', () => {
    expect(decidiIngressoDopoLogin({
      ruoli: ['operaio'],
      moduli: ['manodopera'],
      preferenza: 'classic',
      rimbalzi: 0,
    })).toBe('dashboard');
  });

  it('al secondo rimbalzo si ferma', () => {
    expect(decidiIngressoDopoLogin({
      ruoli: ['operaio'],
      moduli: ['manodopera'],
      preferenza: 'auto',
      rimbalzi: 2,
    })).toBe('errore');
  });
});

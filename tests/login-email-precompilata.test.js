/**
 * Email nel frammento # del login (passo 13, D1).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  frammentoDaPulire,
  leggiEmailDaFrammento,
  urlLoginConEmail,
} from '../core/js/login-email-precompilata.js';
import { urlDashboardDopoRegistrazione } from '../landing/src/lib/tony-registrazione.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('leggiEmailDaFrammento', () => {
  it('decodifica e minuscole', () => {
    expect(leggiEmailDaFrammento('#email=mario%40esempio.it')).toBe('mario@esempio.it');
    expect(leggiEmailDaFrammento('#email=Mario@Esempio.IT')).toBe('mario@esempio.it');
  });

  it('rifiuta email non valide', () => {
    expect(leggiEmailDaFrammento('#email=senzachiocciola')).toBe('');
    expect(leggiEmailDaFrammento('#email=a b@c.it')).toBe('');
    expect(leggiEmailDaFrammento('#email=<script>@x.it')).toBe('');
    expect(leggiEmailDaFrammento('#email=ab')).toBe('');
  });

  it('password nel frammento → vuoto e da pulire', () => {
    expect(leggiEmailDaFrammento('#email=a@b.it&password=segreta')).toBe('');
    expect(frammentoDaPulire('#email=a@b.it&password=segreta')).toBe(true);
    expect(frammentoDaPulire('#PASSWORD=x')).toBe(true);
  });

  it('query ?email= ignorata (solo frammento)', () => {
    expect(leggiEmailDaFrammento('')).toBe('');
    expect(leggiEmailDaFrammento('#altro=1')).toBe('');
  });
});

describe('urlLoginConEmail', () => {
  it('con registered e frammento', () => {
    const url = urlLoginConEmail(
      'https://example.com/core/auth/login-standalone.html',
      'Mario@Esempio.IT',
      { registrato: true }
    );
    expect(url).toBe(
      'https://example.com/core/auth/login-standalone.html?registered=true#email=mario%40esempio.it'
    );
    expect(url).not.toMatch(/password/i);
  });

  it('email non valida → niente frammento', () => {
    const url = urlLoginConEmail(
      'https://example.com/core/auth/login-standalone.html',
      'no',
      { registrato: true }
    );
    expect(url).toBe(
      'https://example.com/core/auth/login-standalone.html?registered=true'
    );
    expect(url).not.toContain('#');
  });
});

describe('urlDashboardDopoRegistrazione', () => {
  it('solo registered=true senza email in URL', () => {
    const url = urlDashboardDopoRegistrazione('mario@esempio.it');
    expect(url).toMatch(/registered=true/);
    expect(url).not.toMatch(/email=/i);
    expect(url).not.toContain('#');
  });
});

describe('login-standalone.html', () => {
  it('usa frammento e non scrive password', () => {
    const html = readFileSync(
      path.join(root, 'core/auth/login-standalone.html'),
      'utf8'
    );
    expect(html).toMatch(/leggiEmailDaFrammento/);
    expect(html).toMatch(/history\.replaceState/);
    expect(html).not.toMatch(/passwordInput\.value\s*=/);
    expect(html).toMatch(/sessione-esistente/);
    expect(html).toMatch(/Esci e accedi con il nuovo account/);
  });
});

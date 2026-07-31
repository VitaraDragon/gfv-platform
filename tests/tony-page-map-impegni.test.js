/**
 * APRI_PAGINA impegni: CF/nav emettono il target; PAGE_MAP deve risolvere l'URL client.
 */
import { describe, it, expect } from 'vitest';
import { resolveTarget, getUrlForTarget, TONY_PAGE_MAP, TONY_LABEL_MAP } from '../core/js/tony/engine.js';
import { getRequiredModuleForTarget } from '../core/config/tony-module-gate.js';

describe('TONY_PAGE_MAP — impegni giornalieri', () => {
  it('risolve target e URL verso impegni-giornalieri-standalone', () => {
    expect(resolveTarget('impegni giornalieri')).toBe('impegni giornalieri');
    expect(resolveTarget('impegni giorno')).toBe('impegni giorno');
    expect(getUrlForTarget('impegni giornalieri', '/core/dashboard-standalone.html')).toMatch(
      /modules\/manodopera\/views\/impegni-giornalieri-standalone\.html$/
    );
    expect(getUrlForTarget('impegni giorno', '/core/dashboard-standalone.html')).toMatch(
      /modules\/manodopera\/views\/impegni-giornalieri-standalone\.html$/
    );
  });

  it('ha label e gate modulo manodopera (mirror CF)', () => {
    expect(TONY_PAGE_MAP['impegni giornalieri']).toContain('impegni-giornalieri-standalone');
    expect(TONY_LABEL_MAP['impegni giornalieri']).toBe('Impegni giornalieri');
    expect(TONY_LABEL_MAP['impegni giorno']).toBe('Impegni giornalieri');
    expect(getRequiredModuleForTarget('impegni giornalieri')).toBe('manodopera');
    expect(getRequiredModuleForTarget('impegni giorno')).toBe('manodopera');
  });
});

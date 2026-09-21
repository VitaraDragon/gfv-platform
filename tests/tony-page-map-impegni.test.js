/**
 * APRI_PAGINA impegni: CF/nav emettono il target; PAGE_MAP deve risolvere l'URL client.
 */
import { describe, it, expect } from 'vitest';
import { resolveTarget, getUrlForTarget, TONY_PAGE_MAP, TONY_LABEL_MAP, isTonyMainDashboardPath, isTonyMainDashboardNavRequest, isTonyMeteoModulePath } from '../core/js/tony/engine.js';
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

describe('home ERP vs dashboard di modulo', () => {
  it('isTonyMainDashboardPath riconosce solo dashboard-standalone', () => {
    expect(isTonyMainDashboardPath('/core/dashboard-standalone.html')).toBe(true);
    expect(isTonyMainDashboardPath('/gfv-platform/core/dashboard-standalone.html')).toBe(true);
    expect(isTonyMainDashboardPath('/modules/meteo/views/meteo-dashboard-standalone.html')).toBe(false);
    expect(isTonyMainDashboardPath('/modules/frutteto/views/frutteto-dashboard-standalone.html')).toBe(false);
  });

  it('isTonyMainDashboardNavRequest ignora hub di modulo', () => {
    expect(isTonyMainDashboardNavRequest('portami alla dashboard')).toBe(true);
    expect(isTonyMainDashboardNavRequest('torna alla home')).toBe(true);
    expect(isTonyMainDashboardNavRequest('portami alla dashboard manodopera')).toBe(false);
    expect(isTonyMainDashboardNavRequest('portami alla home magazzino')).toBe(false);
  });

  it('isTonyMeteoModulePath riconosce solo il modulo meteo', () => {
    expect(isTonyMeteoModulePath('/modules/meteo/views/meteo-dashboard-standalone.html')).toBe(true);
    expect(isTonyMeteoModulePath('/core/dashboard-standalone.html')).toBe(false);
  });
});

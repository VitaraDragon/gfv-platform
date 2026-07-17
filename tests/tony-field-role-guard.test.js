/**
 * Profilo campo — gate APRI_PAGINA / OPEN_MODAL (matrice T-DENY-* tier 1).
 * @see tests/e2e/tony/fixtures/scenarios-matrix.json
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getTonyFieldProfileFromContext,
  isRawTonyApriPaginaAllowed,
  isTonyApriPaginaAllowedForFieldProfile,
  isTonyOpenModalBlockedForFieldProfile,
  remapTonyApriPaginaTargetForFieldProfile,
} from '../core/js/tony/field-role-guard.js';
import { resolveTarget, getUrlForTarget } from '../core/js/tony/engine.js';

function mockFieldWindow(roles, pathname = '/core/mobile/field-workspace-standalone.html', opts = {}) {
  const store = { ...(opts.sessionStore || {}) };
  const dashboard = opts.omitUtenteCorrente
    ? {}
    : { utente_corrente: { ruoli: roles } };
  globalThis.window = {
    Tony: {
      context: {
        dashboard,
      },
    },
    location: { pathname },
    sessionStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => {
        store[k] = v;
      },
    },
  };
}

describe('tony-field-role-guard', () => {
  afterEach(() => {
    delete globalThis.window;
  });

  it('manager/amministratore → nessun profilo campo', () => {
    mockFieldWindow(['amministratore']);
    expect(getTonyFieldProfileFromContext()).toBeNull();
    expect(isRawTonyApriPaginaAllowed('gestisci utenti')).toBe(true);
  });

  describe('T-DENY-001 — operaio APRI_PAGINA gestione utenti', () => {
    beforeEach(() => mockFieldWindow(['operaio']));

    it('resolveTarget da «apri gestione utenti» → utenti', () => {
      expect(resolveTarget('apri gestione utenti')).toBe('utenti');
    });

    it('blocca navigazione verso gestisci utenti', () => {
      expect(isRawTonyApriPaginaAllowed('apri gestione utenti')).toBe(false);
      expect(isRawTonyApriPaginaAllowed('gestisci utenti')).toBe(false);
      expect(isTonyApriPaginaAllowedForFieldProfile('utenti')).toBe(false);
    });

    it('consente workspace campo, comunicazioni e segnatura ore', () => {
      expect(isRawTonyApriPaginaAllowed('workspace campo')).toBe(true);
      expect(isRawTonyApriPaginaAllowed('comunicazioni')).toBe(true);
      expect(isRawTonyApriPaginaAllowed('comunicazioni del caposquadra')).toBe(true);
      expect(isRawTonyApriPaginaAllowed('segnatura ore')).toBe(true);
    });

    it('remap «statistiche» desktop → slide mobile lavoratore', () => {
      expect(remapTonyApriPaginaTargetForFieldProfile('statistiche')).toBe('statistiche lavoratore');
      expect(isRawTonyApriPaginaAllowed('statistiche')).toBe(true);
      const url = getUrlForTarget('statistiche lavoratore');
      expect(url).toMatch(/field-workspace-standalone\.html/);
      expect(url).toMatch(/openSlide=statistiche/);
    });

    it('remap «lavori» → slide lavoro campo', () => {
      expect(remapTonyApriPaginaTargetForFieldProfile('lavori')).toBe('lavoro campo');
      expect(isRawTonyApriPaginaAllowed('lavoro campo')).toBe(true);
      const url = getUrlForTarget('lavoro campo');
      expect(url).toMatch(/field-workspace-standalone\.html/);
      expect(url).toMatch(/openSlide=lavoro/);
    });
  });

  describe('profilo campo su statistiche-standalone (sessionStorage)', () => {
    it('riconosce operaio senza utente_corrente in context', () => {
      mockFieldWindow(['operaio'], '/core/statistiche-standalone.html', {
        omitUtenteCorrente: true,
        sessionStore: { gfv_tony_utente_ruoli: JSON.stringify(['operaio']) },
      });
      expect(getTonyFieldProfileFromContext()).toBe('operaio');
      expect(isRawTonyApriPaginaAllowed('comunicazioni')).toBe(true);
    });
  });

  describe('T-DENY-004 — operaio validazione ore negata', () => {
    beforeEach(() => mockFieldWindow(['operaio']));

    it('blocca validazione ore (solo caposquadra/manager)', () => {
      expect(resolveTarget('validazione ore')).toBe('validazione ore');
      expect(isRawTonyApriPaginaAllowed('validazione ore')).toBe(false);
      expect(isTonyApriPaginaAllowedForFieldProfile('validazione ore')).toBe(false);
    });
  });

  describe('caposquadra — validazione ore consentita', () => {
    beforeEach(() => mockFieldWindow(['caposquadra']));

    it('consente validazione ore e lavori caposquadra', () => {
      expect(isRawTonyApriPaginaAllowed('validazione ore')).toBe(true);
      expect(isRawTonyApriPaginaAllowed('lavori caposquadra')).toBe(true);
    });

    it('blocca ancora gestione utenti', () => {
      expect(isRawTonyApriPaginaAllowed('gestisci utenti')).toBe(false);
    });
  });

  describe('OPEN_MODAL bloccati profilo campo', () => {
    beforeEach(() => mockFieldWindow(['operaio']));

    it('blocca modali manager (preventivo, prodotto, …)', () => {
      expect(isTonyOpenModalBlockedForFieldProfile('preventivo-modal')).toBe(true);
      expect(isTonyOpenModalBlockedForFieldProfile('prodotto-form')).toBe(true);
    });
  });
});
